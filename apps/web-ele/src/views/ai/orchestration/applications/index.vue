<script setup lang="ts">
import type { UploadFile, UploadFiles } from 'element-plus';

import type { SimpleApplicationSettings } from './simple-application-settings';

import type { ApplicationPayload } from '#/api/ai/types';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { confirm, Page } from '@vben/common-ui';

import {
  AlarmClock,
  ArrowDown,
  ChatDotRound,
  CircleCheckFilled,
  CircleCloseFilled,
  Connection,
  CopyDocument,
  Delete,
  Download,
  EditPen,
  Key,
  Lock,
  MoreFilled,
  Plus,
  Promotion,
  Rank,
  Refresh,
  Search,
  Setting,
  Share,
  Tickets,
  Upload,
} from '@element-plus/icons-vue';
import {
  ElButton,
  ElCheckbox,
  ElDialog,
  ElDrawer,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElMessage,
  ElOption,
  ElPagination,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
  ElTag,
  ElUpload,
} from 'element-plus';

import {
  batchDeleteApplications,
  copyApplication,
  createAccessToken,
  createApplication,
  createApplicationKey,
  deleteAccessToken,
  deleteApplication,
  deleteApplicationKey,
  exportApplication,
  getWorkflowDraft,
  importApplication,
  moveApplication,
  pageAccessTokens,
  pageApplicationKeys,
  pageApplications,
  pageWorkflowVersions,
  publishWorkflow,
  restoreWorkflowVersion,
  saveWorkflowDraft,
  toggleAccessToken,
  toggleApplicationKey,
  updateApplication,
} from '#/api/ai/applications';
import {
  listResourceAuth,
  listResourceFolders,
  listResourceMappings,
  saveResourceAuth,
} from '#/api/ai/resources';

import { enabledText, prettyJson, recordsOf, totalOf } from '../utils';
import {
  applicationChatEntry,
  applicationDetailEntry,
  applicationPrimaryEntry,
  isWorkflowApplication,
  normalizeApplicationType,
  WORKFLOW_EDITOR_PATH,
} from './application-entry';
import {
  createDefaultSimpleApplicationSettings,
  parseSimpleApplicationSettings,
  serializeSimpleApplicationGraph,
} from './simple-application-settings';
import SimpleApplicationSettingsPanel from './SimpleApplicationSettings.vue';

type Id = number | string;
type DetailTab = 'access' | 'settings' | 'workflow';

interface ApplicationRecord extends Record<string, unknown> {
  accessEnabled?: boolean;
  createBy?: string;
  createTime?: string;
  createUser?: string;
  create_by?: string;
  create_time?: string;
  create_user?: string;
  desc?: string;
  description?: string;
  folderId?: Id;
  folder_id?: Id;
  icon?: string;
  id?: Id;
  isPublish?: boolean;
  is_publish?: boolean;
  lastPublishTime?: string;
  name?: string;
  nick_name?: string;
  publishStatus?: string;
  publishTime?: string;
  publish_status?: string;
  showGuide?: boolean;
  showHistory?: boolean;
  showSource?: boolean;
  status?: string;
  title?: string;
  type?: string;
  updateTime?: string;
  update_time?: string;
  userName?: string;
  workflowStatus?: string;
  workspaceId?: string;
  workspace_id?: string;
}

interface AccessTokenRecord extends Record<string, unknown> {
  enabled?: boolean;
  id?: Id;
  name?: string;
  token?: string;
}

interface ApplicationKeyRecord extends Record<string, unknown> {
  enabled?: boolean;
  id?: Id;
  keyValue?: string;
  name?: string;
}

interface WorkflowVersionRecord extends Record<string, unknown> {
  createTime?: string;
  graphData?: unknown;
  id?: Id;
  status?: string;
  versionNo?: string;
}

const router = useRouter();
const loading = ref(false);
const applications = ref<ApplicationRecord[]>([]);
const total = ref(0);
const selectedIds = ref<Id[]>([]);
const batchMode = ref(false);
const query = reactive({
  current: 1,
  name: '',
  page: 1,
  publishStatus: '',
  size: 12,
  type: '',
});

const dialogOpen = ref(false);
const editingId = ref<Id>();
const form = reactive<ApplicationPayload>({
  accessEnabled: true,
  description: '',
  icon: 'App',
  name: '',
  showGuide: true,
  showHistory: true,
  showSource: true,
  type: 'WORK_FLOW',
  workspaceId: 'default',
});

const importDialogOpen = ref(false);
const importing = ref(false);
const importFiles = ref<UploadFile[]>([]);

const drawerOpen = ref(false);
const activeApp = ref<ApplicationRecord>();
const detailTab = ref<DetailTab>('settings');
const workflowGraphData = ref('{}');
const applicationConfig = ref('{}');
const simpleSettingsLoading = ref(false);
const simpleSettings = ref<SimpleApplicationSettings>(
  createDefaultSimpleApplicationSettings(),
);
const accessTokens = ref<AccessTokenRecord[]>([]);
const appKeys = ref<ApplicationKeyRecord[]>([]);
const versions = ref<WorkflowVersionRecord[]>([]);

const drawerTitle = computed(() => activeApp.value?.name || '应用设置');
const drawerSize = computed(() =>
  activeApp.value && !isWorkflowApplication(activeApp.value.type)
    ? '920px'
    : '760px',
);
const activeAppId = computed(() => activeApp.value?.id);
const isActiveWorkflowApp = computed(() =>
  isWorkflowApplication(activeApp.value?.type),
);
const selectedApps = computed(() =>
  applications.value.filter(
    (item) => item.id !== undefined && selectedIds.value.includes(item.id),
  ),
);
const hasActiveFilter = computed(
  () =>
    query.name.trim() !== '' || query.publishStatus !== '' || query.type !== '',
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function firstValue(
  row: ApplicationRecord | undefined,
  keys: string[],
): unknown {
  if (!row) return undefined;
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function stringValue(value: unknown, fallback = '') {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function booleanValue(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return undefined;
}

function idValue(value: unknown): Id | undefined {
  if (typeof value === 'number' || typeof value === 'string') return value;
  return undefined;
}

function normalizeAppType(type?: string) {
  return normalizeApplicationType(type);
}

function isSimpleApplication(type?: string) {
  return !isWorkflowApplication(type);
}

function appTypeLabel(type?: string) {
  return isSimpleApplication(type) ? '简易智能体' : '高级智能体';
}

function applicationName(row?: ApplicationRecord) {
  return stringValue(firstValue(row, ['name', 'title', 'id']), '未命名应用');
}

function applicationDescription(row?: ApplicationRecord) {
  return stringValue(firstValue(row, ['description', 'desc']), '暂无描述');
}

function creatorLabel(row?: ApplicationRecord) {
  return stringValue(
    firstValue(row, [
      'nick_name',
      'userName',
      'createUser',
      'create_user',
      'createBy',
      'create_by',
      'creator',
    ]),
    '未知用户',
  );
}

function createTimeLabel(row?: ApplicationRecord) {
  return stringValue(firstValue(row, ['createTime', 'create_time']), '-');
}

function updateTimeLabel(row?: ApplicationRecord) {
  return stringValue(
    firstValue(row, [
      'lastPublishTime',
      'publishTime',
      'updateTime',
      'update_time',
      'createTime',
      'create_time',
    ]),
    '-',
  );
}

function publishState(row?: ApplicationRecord) {
  const publishFlag = booleanValue(
    firstValue(row, ['isPublish', 'is_publish', 'published']),
  );
  if (publishFlag === true) return 'published';
  if (publishFlag === false) return 'unpublished';

  const value = stringValue(
    firstValue(row, [
      'publishStatus',
      'publish_status',
      'status',
      'workflowStatus',
    ]),
  ).toUpperCase();
  if (['ONLINE', 'PUBLISHED', 'RELEASED'].includes(value)) return 'published';
  if (['DRAFT', 'OFFLINE', 'UNPUBLISHED'].includes(value)) {
    return 'unpublished';
  }
  return firstValue(row, ['lastPublishTime', 'publishTime'])
    ? 'published'
    : 'unpublished';
}

function publishLabel(row?: ApplicationRecord) {
  return publishState(row) === 'published' ? '已发布' : '未发布';
}

function publishTagType(row?: ApplicationRecord) {
  return publishState(row) === 'published' ? 'success' : 'info';
}

function iconInitial(row?: ApplicationRecord) {
  return applicationName(row).slice(0, 1).toUpperCase();
}

function appIconUrl(row?: ApplicationRecord) {
  const icon = stringValue(firstValue(row, ['icon']));
  if (
    /^(?:(?:data:image|https?:\/\/|\/|\.\/|@\/).+|.+\.(?:svg|png|jpg|jpeg|webp))$/i.test(
      icon,
    )
  ) {
    return icon;
  }
  return '';
}

async function loadApplications() {
  loading.value = true;
  try {
    const data = await pageApplications({
      current: query.current,
      name: query.name.trim() || undefined,
      page: query.page,
      publishStatus: query.publishStatus || undefined,
      size: query.size,
      type: query.type || undefined,
    });
    applications.value = recordsOf<ApplicationRecord>(data);
    total.value = totalOf(data);
    selectedIds.value = selectedIds.value.filter((id) =>
      applications.value.some((item) => item.id === id),
    );
  } finally {
    loading.value = false;
  }
}

function searchApplications() {
  query.page = 1;
  query.current = 1;
  void loadApplications();
}

function resetFilters() {
  query.name = '';
  query.publishStatus = '';
  query.type = '';
  searchApplications();
}

function handlePageChange(page: number) {
  query.current = page;
  query.page = page;
  void loadApplications();
}

function resetForm(row?: ApplicationRecord, type = 'WORK_FLOW') {
  editingId.value = row?.id;
  Object.assign(form, {
    accessEnabled: row?.accessEnabled !== false,
    description:
      applicationDescription(row) === '暂无描述'
        ? ''
        : applicationDescription(row),
    folderId: idValue(firstValue(row, ['folderId', 'folder_id'])),
    icon: stringValue(row?.icon, 'App'),
    name: row ? applicationName(row) : '',
    showGuide: row?.showGuide !== false,
    showHistory: row?.showHistory !== false,
    showSource: row?.showSource !== false,
    type: row?.type || type,
    workspaceId: stringValue(
      firstValue(row, ['workspaceId', 'workspace_id']),
      'default',
    ),
  });
}

function openDialog(row?: ApplicationRecord, type = 'WORK_FLOW') {
  resetForm(row, type);
  dialogOpen.value = true;
}

function createdIdFromResponse(response: unknown): Id | undefined {
  if (!isRecord(response)) return undefined;
  const directId = idValue(response.id);
  if (directId !== undefined) return directId;
  const data = response.data;
  if (!isRecord(data)) return undefined;
  return idValue(data.id);
}

async function saveApplication() {
  if (!form.name) {
    ElMessage.warning('请输入应用名称');
    return;
  }
  const payload: ApplicationPayload = { ...form };
  const wasCreating = editingId.value === undefined;
  const saved = await (editingId.value
    ? updateApplication(editingId.value, payload)
    : createApplication(payload));
  ElMessage.success('保存成功');
  dialogOpen.value = false;
  await loadApplications();
  if (wasCreating && normalizeAppType(payload.type) === 'WORK_FLOW') {
    const createdId =
      createdIdFromResponse(saved) ||
      applications.value.find((item) => item.name === payload.name)?.id;
    if (createdId !== undefined) {
      openWorkflow({ id: createdId, type: payload.type });
    }
  }
  if (activeApp.value?.id === editingId.value) {
    activeApp.value =
      applications.value.find((item) => item.id === editingId.value) ||
      activeApp.value;
  }
}

async function saveSettings() {
  const id = activeAppId.value;
  if (id === undefined) return;
  if (!isActiveWorkflowApp.value) {
    await saveSimpleSettings(id);
    return;
  }
  await updateApplication(id, { ...form });
  ElMessage.success('设置已保存');
  await loadApplications();
  activeApp.value =
    applications.value.find((item) => item.id === id) || activeApp.value;
}

async function saveSimpleSettings(id: Id) {
  const persisted = await persistSimpleSettings(id);
  if (!persisted) return;
  ElMessage.success('设置已保存');
  await refreshActiveApplication(id);
}

async function publishSimpleSettings() {
  const id = activeAppId.value;
  if (id === undefined) return;
  const persisted = await persistSimpleSettings(id);
  if (!persisted) return;
  await publishWorkflow(id, { description: '从简易智能体设置发布' });
  ElMessage.success('发布成功');
  await refreshActiveApplication(id);
}

async function persistSimpleSettings(id: Id) {
  const name = simpleSettings.value.name.trim();
  if (!name) {
    ElMessage.warning('请输入应用名称');
    return false;
  }
  simpleSettings.value = {
    ...simpleSettings.value,
    name,
  };
  const payload: ApplicationPayload = {
    ...form,
    description: simpleSettings.value.desc,
    name,
    type: 'SIMPLE',
  };
  await updateApplication(id, payload);
  await saveWorkflowDraft(id, {
    applicationConfig: applicationConfig.value || '{}',
    graphData: serializeSimpleApplicationGraph(simpleSettings.value),
  });
  return true;
}

async function refreshActiveApplication(id: Id) {
  await loadApplications();
  activeApp.value = applications.value.find((item) => item.id === id) || {
    ...activeApp.value,
    description: simpleSettings.value.desc,
    name: simpleSettings.value.name,
    type: 'SIMPLE',
  };
  resetForm(activeApp.value);
}

function removeApplication(row: ApplicationRecord) {
  confirm(`确认删除应用 ${applicationName(row)}？`).then(async () => {
    if (row.id === undefined) return;
    await deleteApplication(row.id);
    ElMessage.success('删除成功');
    await loadApplications();
  });
}

function removeSelectedApplications() {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('请选择要删除的应用');
    return;
  }
  confirm(`确认删除选中的 ${selectedIds.value.length} 个应用？`).then(
    async () => {
      await batchDeleteApplications([...selectedIds.value]);
      ElMessage.success('批量删除成功');
      selectedIds.value = [];
      batchMode.value = false;
      await loadApplications();
    },
  );
}

async function duplicateApplication(row: ApplicationRecord) {
  if (row.id === undefined) return;
  await copyApplication(row.id);
  ElMessage.success('复制成功');
  await loadApplications();
}

async function exportApplicationFile(row: ApplicationRecord) {
  if (row.id === undefined) return;
  await exportApplication(row.id);
}

function openImportDialog() {
  importFiles.value = [];
  importing.value = false;
  importDialogOpen.value = true;
}

function handleImportDialogClose() {
  importFiles.value = [];
  importing.value = false;
}

function handleImportFileChange(_file: UploadFile, files: UploadFiles) {
  // Keep only the latest one
  importFiles.value = files.length > 0 ? [files[files.length - 1]!] : [];
}

function handleImportFileRemove() {
  importFiles.value = [];
}

async function confirmImport() {
  const target = importFiles.value[0];
  const rawFile = target?.raw;
  if (!rawFile) {
    ElMessage.warning('请选择要导入的 JSON 文件');
    return;
  }
  importing.value = true;
  try {
    await importApplication(rawFile);
    ElMessage.success('导入成功');
    importDialogOpen.value = false;
    importFiles.value = [];
    await loadApplications();
  } finally {
    importing.value = false;
  }
}

function isSelected(row: ApplicationRecord) {
  return row.id !== undefined && selectedIds.value.includes(row.id);
}

function toggleSelection(row: ApplicationRecord, checked: boolean) {
  if (row.id === undefined) return;
  selectedIds.value = checked
    ? [...new Set([row.id, ...selectedIds.value])]
    : selectedIds.value.filter((id) => id !== row.id);
}

function toggleBatchMode() {
  batchMode.value = !batchMode.value;
  if (!batchMode.value) selectedIds.value = [];
}

async function openManagementDrawer(
  row: ApplicationRecord,
  tab: DetailTab = 'settings',
) {
  activeApp.value = row;
  detailTab.value =
    tab === 'workflow' && !isWorkflowApplication(row.type) ? 'settings' : tab;
  resetForm(row);
  if (!isWorkflowApplication(row.type)) {
    simpleSettings.value = createDefaultSimpleApplicationSettings(row);
  }
  drawerOpen.value = true;
  await loadDrawerTab(detailTab.value);
}

function openApplicationSetting(row: ApplicationRecord) {
  // Matches MaxKB settingApplication(): SIMPLE apps open the detail page's
  // setting tab (in-place form); WORKFLOW (高级智能体) apps go DIRECTLY to the
  // full-page workflow editor, bypassing the detail page entirely. Routing
  // workflow "设置" through the detail page would briefly render it and then
  // redirect to the editor (a visible flash) — so we navigate straight there.
  // 概览/对话日志 for workflow apps are reached via the card body click
  // (openApplicationDetail -> overview), not this entry.
  if (isWorkflowApplication(row.type)) {
    openWorkflow(row);
    return;
  }
  const entry = applicationDetailEntry(row, 'setting');
  router.push({ path: entry.path, query: entry.query });
}

function openApplicationAccess(row: ApplicationRecord) {
  if (!isWorkflowApplication(row.type)) {
    const entry = applicationDetailEntry(row, 'overview');
    router.push({ path: entry.path, query: entry.query });
    return;
  }
  void openManagementDrawer(row, 'access');
}

async function loadDrawerTab(tab: DetailTab) {
  if (tab === 'settings' && activeApp.value && !isActiveWorkflowApp.value) {
    await loadSimpleSettings();
    return;
  }
  if (tab === 'access') {
    await Promise.all([loadTokens(), loadKeys()]);
    return;
  }
  if (tab === 'workflow') {
    await Promise.all([loadDraft(), loadVersions()]);
  }
}

async function loadSimpleSettings() {
  const id = activeAppId.value;
  if (id === undefined || isActiveWorkflowApp.value) return;
  simpleSettingsLoading.value = true;
  try {
    const draft = await getWorkflowDraft(id);
    const graphData = isRecord(draft)
      ? draft.graphData || draft.graph_data
      : draft;
    applicationConfig.value = prettyJson(
      isRecord(draft)
        ? draft.applicationConfig || draft.application_config
        : undefined,
      '{}',
    );
    simpleSettings.value = parseSimpleApplicationSettings(
      graphData,
      activeApp.value,
    );
  } finally {
    simpleSettingsLoading.value = false;
  }
}

function handleDetailTabChange(name: number | string) {
  if (name === 'settings' || name === 'access' || name === 'workflow') {
    void loadDrawerTab(name);
  }
}

async function loadDraft() {
  const id = activeAppId.value;
  if (id === undefined || !isActiveWorkflowApp.value) {
    resetWorkflowDetail();
    return;
  }
  const draft = await getWorkflowDraft(id);
  workflowGraphData.value = prettyJson(
    isRecord(draft) ? draft.graphData || draft : draft,
    '{}',
  );
  applicationConfig.value = prettyJson(
    isRecord(draft) ? draft.applicationConfig : undefined,
    '{}',
  );
}

function resetWorkflowDetail() {
  workflowGraphData.value = '{}';
  applicationConfig.value = '{}';
  versions.value = [];
}

async function loadTokens() {
  const id = activeAppId.value;
  if (id === undefined) return;
  accessTokens.value = recordsOf<AccessTokenRecord>(
    await pageAccessTokens(id, {
      current: 1,
      page: 1,
      size: 20,
    }),
  );
}

async function loadKeys() {
  const id = activeAppId.value;
  if (id === undefined) return;
  appKeys.value = recordsOf<ApplicationKeyRecord>(
    await pageApplicationKeys(id, {
      current: 1,
      page: 1,
      size: 20,
    }),
  );
}

async function loadVersions() {
  const id = activeAppId.value;
  if (id === undefined || !isActiveWorkflowApp.value) {
    versions.value = [];
    return;
  }
  versions.value = recordsOf<WorkflowVersionRecord>(
    await pageWorkflowVersions(id, {
      current: 1,
      page: 1,
      size: 20,
    }),
  );
}

async function saveDraft() {
  const id = activeAppId.value;
  if (id === undefined || !isActiveWorkflowApp.value) return;
  await saveWorkflowDraft(id, {
    applicationConfig: applicationConfig.value,
    graphData: workflowGraphData.value,
  });
  ElMessage.success('草稿已保存');
}

async function publishActiveWorkflow() {
  const id = activeAppId.value;
  if (id === undefined || !isActiveWorkflowApp.value) return;
  await publishWorkflow(id, { description: '从应用管理发布' });
  ElMessage.success('发布成功');
  await loadVersions();
  await loadApplications();
}

async function addToken() {
  const id = activeAppId.value;
  if (id === undefined) return;
  await createAccessToken(id, {
    enabled: true,
    name: '访问令牌',
  });
  ElMessage.success('令牌已创建');
  await loadTokens();
}

async function addKey() {
  const id = activeAppId.value;
  if (id === undefined) return;
  await createApplicationKey(id, {
    enabled: true,
    name: 'API Key',
  });
  ElMessage.success('密钥已创建');
  await loadKeys();
}

async function toggleToken(row: AccessTokenRecord) {
  const id = activeAppId.value;
  if (id === undefined || row.id === undefined) return;
  await toggleAccessToken(id, row.id, !row.enabled);
  await loadTokens();
}

async function toggleKey(row: ApplicationKeyRecord) {
  const id = activeAppId.value;
  if (id === undefined || row.id === undefined) return;
  await toggleApplicationKey(id, row.id, !row.enabled);
  await loadKeys();
}

async function removeToken(row: AccessTokenRecord) {
  const id = activeAppId.value;
  if (id === undefined || row.id === undefined) return;
  await deleteAccessToken(id, row.id);
  await loadTokens();
}

async function removeKey(row: ApplicationKeyRecord) {
  const id = activeAppId.value;
  if (id === undefined || row.id === undefined) return;
  await deleteApplicationKey(id, row.id);
  await loadKeys();
}

async function restoreVersion(row: WorkflowVersionRecord) {
  const id = activeAppId.value;
  if (id === undefined || row.id === undefined || !isActiveWorkflowApp.value)
    return;
  await restoreWorkflowVersion(id, row.id);
  ElMessage.success('已恢复到草稿');
  await loadDraft();
}

function openWorkflow(row = activeApp.value) {
  if (!row?.id) return;
  if (!isWorkflowApplication(row.type)) {
    openApplicationPrimary(row);
    return;
  }
  router.push({
    path: WORKFLOW_EDITOR_PATH,
    query: { applicationId: row.id },
  });
}

function openApplicationPrimary(row = activeApp.value) {
  if (!row?.id) return;
  const entry = applicationPrimaryEntry(row);
  router.push({
    path: entry.path,
    query: entry.query,
  });
}

// Card body click: enter the detail page overview for BOTH app types,
// matching MaxKB's goApp/get_route (which returns /overview). This is the
// ONLY way workflow (高级智能体) apps reach 概览/对话日志, since their "设置"
// dropdown shortcuts directly to the workflow editor.
function openApplicationDetail(row: ApplicationRecord) {
  if (!row?.id) return;
  const entry = applicationDetailEntry(row, 'overview');
  router.push({ path: entry.path, query: entry.query });
}

function openPublic(row = activeApp.value) {
  if (!row?.id) return;
  const entry = applicationChatEntry(row);
  router.push({ path: entry.path, query: entry.query });
}

// --- Move To (转移到) ---
const moveDialogOpen = ref(false);
const moveTargetApp = ref<ApplicationRecord>();
const moveFolders = ref<Array<{ id?: Id; name?: string }>>([]);
const selectedFolderId = ref<Id>();
const moveLoading = ref(false);

function openMoveDialog(row: ApplicationRecord) {
  moveTargetApp.value = row;
  selectedFolderId.value = undefined;
  moveDialogOpen.value = true;
  void loadMoveFolders();
}

async function loadMoveFolders() {
  moveLoading.value = true;
  try {
    const data = await listResourceFolders({ resourceType: 'APPLICATION' });
    moveFolders.value = recordsOf<{ id?: Id; name?: string }>(data);
  } finally {
    moveLoading.value = false;
  }
}

async function confirmMove() {
  const app = moveTargetApp.value;
  if (!app?.id || selectedFolderId.value === undefined) return;
  await moveApplication(app.id, { targetFolderId: selectedFolderId.value });
  ElMessage.success('移动成功');
  moveDialogOpen.value = false;
  await loadApplications();
}

// --- Triggers (触发器) ---
function navigateToTriggers(row: ApplicationRecord) {
  router.push({
    path: '/ai/orchestration/triggers/index',
    query: { applicationId: String(row.id) },
  });
}

// --- View Related Resources (查看关联资源) ---
interface ResourceMappingRecord extends Record<string, unknown> {
  description?: string;
  name?: string;
  type?: string;
}

const mappingsDrawerOpen = ref(false);
const mappingsTargetApp = ref<ApplicationRecord>();
const mappings = ref<ResourceMappingRecord[]>([]);
const mappingsLoading = ref(false);

async function openMappingsDrawer(row: ApplicationRecord) {
  mappingsTargetApp.value = row;
  mappingsDrawerOpen.value = true;
  mappingsLoading.value = true;
  try {
    const data = await listResourceMappings({
      resourceId: row.id,
      resourceType: 'APPLICATION',
    });
    mappings.value = recordsOf<ResourceMappingRecord>(data);
  } finally {
    mappingsLoading.value = false;
  }
}

// --- Resource Authorization (资源授权) ---
// Backend `listAuth` returns ai_resource_auth rows: { id, principalId,
// principalType, permissionJson (JSON string) }. We parse permissionJson
// into a flat `permission` for the select control.
interface ResourceAuthRecord extends Record<string, unknown> {
  id?: Id;
  permission?: string;
  principalId?: Id;
  principalType?: string;
}

const authDrawerOpen = ref(false);
const authTargetApp = ref<ApplicationRecord>();
const authRecords = ref<ResourceAuthRecord[]>([]);
const authLoading = ref(false);

function parseAuthPermission(permissionJson: unknown): string {
  if (typeof permissionJson !== 'string' || !permissionJson.trim()) {
    return 'NOT_AUTH';
  }
  try {
    const parsed = JSON.parse(permissionJson) as { permission?: string };
    return typeof parsed?.permission === 'string'
      ? parsed.permission
      : 'NOT_AUTH';
  } catch {
    // Malformed permissionJson: fall back to the unauthorized default.
    return 'NOT_AUTH';
  }
}

async function openAuthDrawer(row: ApplicationRecord) {
  authTargetApp.value = row;
  authDrawerOpen.value = true;
  authLoading.value = true;
  try {
    const data = await listResourceAuth({
      resourceId: row.id,
      resourceType: 'APPLICATION',
    });
    authRecords.value = recordsOf<Record<string, unknown>>(data).map(
      (item) => ({
        id: item.id as Id,
        permission: parseAuthPermission(item.permissionJson),
        principalId: item.principalId as Id,
        principalType: (item.principalType as string) ?? 'USER',
      }),
    );
  } finally {
    authLoading.value = false;
  }
}

async function updateAuthPermission(row: ResourceAuthRecord) {
  const app = authTargetApp.value;
  if (!app?.id || row.principalId === undefined || row.principalId === null) {
    return;
  }
  // Backend (ResourceController#saveAuth) maps OrchestrationRequest ->
  // ResourceAuth as: id -> resourceId (the application being authorized),
  // applicationId -> principalId (the granted user), name -> principalType,
  // configJson -> permissionJson, type -> resourceType.
  await saveResourceAuth({
    id: app.id,
    applicationId: row.principalId,
    name: row.principalType ?? 'USER',
    configJson: JSON.stringify({ permission: row.permission }),
    type: 'APPLICATION',
  });
  ElMessage.success('授权已更新');
}

onMounted(loadApplications);
</script>

<template>
  <Page auto-content-height>
    <div class="application-manager" v-loading="loading">
      <section class="application-toolbar">
        <div class="toolbar-title">
          <h2>应用</h2>
          <span>共 {{ total }} 个应用</span>
        </div>
        <div class="toolbar-actions">
          <div class="filter-bar">
            <ElInput
              v-model="query.name"
              class="filter-name"
              clearable
              placeholder="搜索应用名称"
              @keyup.enter="searchApplications"
              @clear="searchApplications"
            >
              <template #prefix>
                <ElIcon><Search /></ElIcon>
              </template>
            </ElInput>
            <ElSelect
              v-model="query.type"
              class="filter-select"
              clearable
              placeholder="全部类型"
              @change="searchApplications"
            >
              <ElOption label="简易智能体" value="SIMPLE" />
              <ElOption label="高级智能体" value="WORK_FLOW" />
            </ElSelect>
            <ElSelect
              v-model="query.publishStatus"
              class="filter-select"
              clearable
              placeholder="全部状态"
              @change="searchApplications"
            >
              <ElOption label="已发布" value="published" />
              <ElOption label="未发布" value="unpublished" />
            </ElSelect>
            <ElButton v-if="hasActiveFilter" link @click="resetFilters">
              重置
            </ElButton>
          </div>
          <ElButton :icon="Refresh" @click="loadApplications">刷新</ElButton>
          <ElButton :icon="Upload" @click="openImportDialog">导入应用</ElButton>
          <ElButton @click="toggleBatchMode">
            {{ batchMode ? '取消选择' : '批量选择' }}
          </ElButton>
          <ElButton
            v-if="batchMode"
            :disabled="selectedIds.length === 0"
            type="danger"
            @click="removeSelectedApplications"
          >
            删除 {{ selectedIds.length > 0 ? selectedIds.length : '' }}
          </ElButton>
          <ElDropdown trigger="click">
            <ElButton type="primary">
              <ElIcon><Plus /></ElIcon>
              创建应用
              <ElIcon class="button-arrow"><ArrowDown /></ElIcon>
            </ElButton>
            <template #dropdown>
              <ElDropdownMenu class="create-dropdown">
                <ElDropdownItem @click="openDialog(undefined, 'SIMPLE')">
                  <div class="create-option">
                    <span class="create-option__icon simple">简</span>
                    <span>
                      <strong>简易智能体</strong>
                      <small>基于提示词快速创建对话应用</small>
                    </span>
                  </div>
                </ElDropdownItem>
                <ElDropdownItem @click="openDialog(undefined, 'WORK_FLOW')">
                  <div class="create-option">
                    <span class="create-option__icon advanced">高</span>
                    <span>
                      <strong>高级智能体</strong>
                      <small>使用工作流编排复杂应用能力</small>
                    </span>
                  </div>
                </ElDropdownItem>
              </ElDropdownMenu>
            </template>
          </ElDropdown>
        </div>
      </section>

      <section v-if="batchMode" class="batch-strip">
        <span>
          已选择 {{ selectedIds.length }} / {{ applications.length }}
        </span>
        <span class="muted">
          {{ selectedApps.map(applicationName).join('、') }}
        </span>
      </section>

      <section
        class="application-content"
        :class="{ 'is-empty': applications.length === 0 }"
      >
        <div v-if="applications.length > 0" class="application-grid">
          <article
            v-for="item in applications"
            :key="item.id"
            class="application-card"
            @click="openApplicationDetail(item)"
          >
            <div class="card-head">
              <ElCheckbox
                v-if="batchMode"
                :model-value="isSelected(item)"
                @click.stop
                @change="(checked) => toggleSelection(item, checked === true)"
              />
              <div class="app-identity">
                <span
                  class="app-avatar"
                  :class="{ advanced: !isSimpleApplication(item.type) }"
                >
                  <img v-if="appIconUrl(item)" :src="appIconUrl(item)" alt="" />
                  <span v-else>{{ iconInitial(item) }}</span>
                </span>
                <div class="app-title">
                  <strong :title="applicationName(item)">{{
                    applicationName(item)
                  }}</strong>
                  <span :title="applicationDescription(item)">
                    {{ applicationDescription(item) }}
                  </span>
                </div>
              </div>
              <ElTag
                class="type-tag"
                :class="{ advanced: !isSimpleApplication(item.type) }"
                size="small"
              >
                {{ appTypeLabel(item.type) }}
              </ElTag>
            </div>

            <div class="card-meta">
              <span>{{ creatorLabel(item) }}</span>
              <span>创建于</span>
              <span>{{ createTimeLabel(item) }}</span>
            </div>

            <div class="card-footer">
              <div class="publish-state">
                <ElIcon :class="publishState(item)">
                  <CircleCheckFilled
                    v-if="publishState(item) === 'published'"
                  />
                  <CircleCloseFilled v-else />
                </ElIcon>
                <span>发布状态</span>
                <ElTag :type="publishTagType(item)" size="small">
                  {{ publishLabel(item) }}
                </ElTag>
                <span v-if="updateTimeLabel(item) !== '-'" class="publish-time">
                  {{ updateTimeLabel(item) }}
                </span>
              </div>
              <div class="card-actions" @click.stop>
                <ElButton
                  link
                  type="primary"
                  :icon="ChatDotRound"
                  @click="openPublic(item)"
                >
                  对话
                </ElButton>
                <ElDropdown trigger="click">
                  <ElButton link>
                    更多
                    <ElIcon><MoreFilled /></ElIcon>
                  </ElButton>
                  <template #dropdown>
                    <ElDropdownMenu>
                      <ElDropdownItem @click="openApplicationSetting(item)">
                        <ElIcon><Setting /></ElIcon>
                        设置
                      </ElDropdownItem>
                      <ElDropdownItem @click="openApplicationAccess(item)">
                        <ElIcon><Key /></ElIcon>
                        访问管理
                      </ElDropdownItem>
                      <ElDropdownItem @click="openAuthDrawer(item)">
                        <ElIcon><Lock /></ElIcon>
                        资源授权
                      </ElDropdownItem>
                      <ElDropdownItem @click="openMappingsDrawer(item)">
                        <ElIcon><Share /></ElIcon>
                        查看关联资源
                      </ElDropdownItem>
                      <ElDropdownItem @click="navigateToTriggers(item)">
                        <ElIcon><AlarmClock /></ElIcon>
                        触发器
                      </ElDropdownItem>
                      <ElDropdownItem @click="openMoveDialog(item)">
                        <ElIcon><Rank /></ElIcon>
                        转移到
                      </ElDropdownItem>
                      <ElDropdownItem
                        v-if="isWorkflowApplication(item.type)"
                        @click="openManagementDrawer(item, 'workflow')"
                      >
                        <ElIcon><Promotion /></ElIcon>
                        发布管理
                      </ElDropdownItem>
                      <ElDropdownItem
                        v-if="isWorkflowApplication(item.type)"
                        @click="openWorkflow(item)"
                      >
                        <ElIcon><Connection /></ElIcon>
                        工作流编辑
                      </ElDropdownItem>
                      <ElDropdownItem @click="duplicateApplication(item)">
                        <ElIcon><CopyDocument /></ElIcon>
                        复制
                      </ElDropdownItem>
                      <ElDropdownItem @click="exportApplicationFile(item)">
                        <ElIcon><Download /></ElIcon>
                        导出
                      </ElDropdownItem>
                      <ElDropdownItem divided @click="removeApplication(item)">
                        <ElIcon><Delete /></ElIcon>
                        删除
                      </ElDropdownItem>
                    </ElDropdownMenu>
                  </template>
                </ElDropdown>
              </div>
            </div>
          </article>
        </div>
        <ElEmpty v-else class="empty-panel" description="暂无应用" />
      </section>

      <div v-if="total > 0" class="pager">
        <span>共 {{ total }} 个应用</span>
        <ElPagination
          :current-page="query.current"
          :page-size="query.size"
          :total="total"
          background
          layout="prev, pager, next"
          small
          @current-change="handlePageChange"
        />
      </div>

      <ElDialog
        v-model="dialogOpen"
        :title="editingId ? '设置应用' : '创建应用'"
        width="560px"
      >
        <ElForm label-width="90px" :model="form">
          <ElFormItem label="应用名称">
            <ElInput v-model="form.name" />
          </ElFormItem>
          <ElFormItem label="应用描述">
            <ElInput v-model="form.description" type="textarea" :rows="3" />
          </ElFormItem>
          <ElFormItem label="应用类型">
            <ElInput :model-value="appTypeLabel(form.type)" disabled />
          </ElFormItem>
          <ElFormItem label="工作空间">
            <ElInput v-model="form.workspaceId" />
          </ElFormItem>
          <ElFormItem label="应用能力">
            <div class="switch-row">
              <ElSwitch v-model="form.accessEnabled" active-text="公开访问" />
              <ElSwitch v-model="form.showSource" active-text="引用来源" />
              <ElSwitch v-model="form.showHistory" active-text="历史记录" />
              <ElSwitch v-model="form.showGuide" active-text="开场引导" />
            </div>
          </ElFormItem>
        </ElForm>
        <template #footer>
          <ElButton @click="dialogOpen = false">取消</ElButton>
          <ElButton type="primary" @click="saveApplication">保存</ElButton>
        </template>
      </ElDialog>

      <ElDialog
        v-model="importDialogOpen"
        title="导入应用"
        width="480px"
        @close="handleImportDialogClose"
      >
        <ElUpload
          :auto-upload="false"
          :file-list="importFiles"
          :on-change="handleImportFileChange"
          :on-remove="handleImportFileRemove"
          :limit="1"
          accept=".json"
          drag
        >
          <ElIcon class="el-icon--upload"><Upload /></ElIcon>
          <div class="el-upload__text">
            将 JSON 文件拖入此处，或<em>点击上传</em>
          </div>
          <template #tip>
            <div class="muted">仅支持单个 .json 应用导出文件</div>
          </template>
        </ElUpload>
        <template #footer>
          <ElButton :disabled="importing" @click="importDialogOpen = false">
            取消
          </ElButton>
          <ElButton :loading="importing" type="primary" @click="confirmImport">
            导入
          </ElButton>
        </template>
      </ElDialog>

      <ElDrawer v-model="drawerOpen" :title="drawerTitle" :size="drawerSize">
        <ElTabs
          v-model="detailTab"
          class="detail-tabs"
          @tab-change="handleDetailTabChange"
        >
          <ElTabPane label="设置" name="settings">
            <template v-if="activeApp && !isActiveWorkflowApp">
              <SimpleApplicationSettingsPanel
                v-model="simpleSettings"
                v-loading="simpleSettingsLoading"
              />
              <div class="drawer-toolbar mt12">
                <ElButton type="primary" :icon="EditPen" @click="saveSettings">
                  保存设置
                </ElButton>
                <ElButton :icon="Promotion" @click="publishSimpleSettings">
                  发布
                </ElButton>
                <ElButton
                  :icon="ChatDotRound"
                  @click="openApplicationPrimary()"
                >
                  打开对话
                </ElButton>
              </div>
            </template>
            <ElForm v-else label-width="100px" :model="form">
              <ElFormItem label="应用名称">
                <ElInput v-model="form.name" />
              </ElFormItem>
              <ElFormItem label="应用描述">
                <ElInput v-model="form.description" type="textarea" :rows="4" />
              </ElFormItem>
              <ElFormItem label="应用类型">
                <ElInput :model-value="appTypeLabel(form.type)" disabled />
              </ElFormItem>
              <ElFormItem label="工作空间">
                <ElInput v-model="form.workspaceId" />
              </ElFormItem>
              <ElFormItem label="访问能力">
                <div class="switch-row">
                  <ElSwitch
                    v-model="form.accessEnabled"
                    active-text="公开访问"
                  />
                  <ElSwitch v-model="form.showSource" active-text="引用来源" />
                  <ElSwitch v-model="form.showHistory" active-text="历史记录" />
                  <ElSwitch v-model="form.showGuide" active-text="开场引导" />
                </div>
              </ElFormItem>
              <div class="drawer-toolbar">
                <ElButton type="primary" :icon="EditPen" @click="saveSettings">
                  保存设置
                </ElButton>
                <ElButton
                  :icon="ChatDotRound"
                  @click="openApplicationPrimary()"
                >
                  打开对话
                </ElButton>
              </div>
            </ElForm>
          </ElTabPane>

          <ElTabPane label="访问管理" name="access">
            <div class="access-grid">
              <section class="detail-section">
                <div class="section-title">
                  <span>访问令牌</span>
                  <ElButton size="small" type="primary" @click="addToken">
                    创建令牌
                  </ElButton>
                </div>
                <ElTable :data="accessTokens" size="small">
                  <ElTableColumn prop="name" label="名称" />
                  <ElTableColumn prop="token" label="Token" min-width="220" />
                  <ElTableColumn label="状态" width="90">
                    <template #default="{ row }">
                      <ElTag size="small">{{ enabledText(row.enabled) }}</ElTag>
                    </template>
                  </ElTableColumn>
                  <ElTableColumn label="操作" width="150">
                    <template #default="{ row }">
                      <ElButton link @click="toggleToken(row)">切换</ElButton>
                      <ElButton link type="danger" @click="removeToken(row)">
                        删除
                      </ElButton>
                    </template>
                  </ElTableColumn>
                </ElTable>
              </section>
              <section class="detail-section">
                <div class="section-title">
                  <span>API Keys</span>
                  <ElButton size="small" type="primary" @click="addKey">
                    创建 Key
                  </ElButton>
                </div>
                <ElTable :data="appKeys" size="small">
                  <ElTableColumn prop="name" label="名称" />
                  <ElTableColumn prop="keyValue" label="Key" min-width="220" />
                  <ElTableColumn label="状态" width="90">
                    <template #default="{ row }">
                      <ElTag size="small">{{ enabledText(row.enabled) }}</ElTag>
                    </template>
                  </ElTableColumn>
                  <ElTableColumn label="操作" width="150">
                    <template #default="{ row }">
                      <ElButton link @click="toggleKey(row)">切换</ElButton>
                      <ElButton link type="danger" @click="removeKey(row)">
                        删除
                      </ElButton>
                    </template>
                  </ElTableColumn>
                </ElTable>
              </section>
            </div>
          </ElTabPane>

          <ElTabPane
            v-if="isActiveWorkflowApp"
            label="发布管理"
            name="workflow"
          >
            <div class="drawer-toolbar">
              <ElButton type="primary" @click="saveDraft">保存草稿</ElButton>
              <ElButton :icon="Promotion" @click="publishActiveWorkflow">
                发布
              </ElButton>
              <ElButton :icon="Connection" @click="openWorkflow()">
                完整编辑器
              </ElButton>
            </div>
            <ElInput
              v-model="workflowGraphData"
              class="mt12"
              type="textarea"
              :rows="12"
              placeholder="graphData JSON"
            />
            <ElInput
              v-model="applicationConfig"
              class="mt8"
              type="textarea"
              :rows="5"
              placeholder="applicationConfig JSON"
            />
            <section class="detail-section mt12">
              <div class="section-title">
                <span>版本历史</span>
                <span class="muted">发布后可恢复到草稿</span>
              </div>
              <ElTable :data="versions" size="small">
                <ElTableColumn prop="versionNo" label="版本" width="90" />
                <ElTableColumn prop="status" label="状态" width="100" />
                <ElTableColumn prop="createTime" label="发布时间" width="170" />
                <ElTableColumn prop="graphData" label="Graph">
                  <template #default="{ row }">
                    <span class="mono-line">{{
                      prettyJson(row.graphData, '-')
                    }}</span>
                  </template>
                </ElTableColumn>
                <ElTableColumn label="操作" width="100">
                  <template #default="{ row }">
                    <ElButton
                      :icon="Tickets"
                      link
                      type="primary"
                      @click="restoreVersion(row)"
                    >
                      恢复
                    </ElButton>
                  </template>
                </ElTableColumn>
              </ElTable>
            </section>
          </ElTabPane>
        </ElTabs>
      </ElDrawer>

      <!-- Move To Dialog -->
      <ElDialog v-model="moveDialogOpen" title="转移到" width="480px">
        <ElForm label-width="80px">
          <ElFormItem label="目标文件夹">
            <ElSelect
              v-model="selectedFolderId"
              clearable
              filterable
              placeholder="选择文件夹"
              style="width: 100%"
            >
              <ElOption
                v-for="folder in moveFolders"
                :key="folder.id ?? ''"
                :label="folder.name ?? ''"
                :value="folder.id ?? ''"
              />
            </ElSelect>
          </ElFormItem>
        </ElForm>
        <template #footer>
          <ElButton @click="moveDialogOpen = false">取消</ElButton>
          <ElButton
            :disabled="!selectedFolderId"
            type="primary"
            @click="confirmMove"
          >
            确定
          </ElButton>
        </template>
      </ElDialog>

      <!-- Resource Auth Drawer -->
      <ElDrawer v-model="authDrawerOpen" size="850px" title="资源授权">
        <ElTable v-loading="authLoading" :data="authRecords">
          <ElTableColumn
            label="主体类型"
            min-width="120"
            prop="principalType"
          />
          <ElTableColumn label="主体ID" min-width="160" prop="principalId" />
          <ElTableColumn label="权限" min-width="180">
            <template #default="{ row }">
              <ElSelect
                :model-value="row.permission || 'NOT_AUTH'"
                @change="
                  (val: string) => {
                    row.permission = val;
                    updateAuthPermission(row);
                  }
                "
              >
                <ElOption label="未授权" value="NOT_AUTH" />
                <ElOption label="查看" value="VIEW" />
                <ElOption label="管理" value="MANAGE" />
              </ElSelect>
            </template>
          </ElTableColumn>
        </ElTable>
        <ElEmpty
          v-if="!authLoading && authRecords.length === 0"
          description="暂无授权数据"
        />
      </ElDrawer>

      <!-- Resource Mappings Drawer -->
      <ElDrawer v-model="mappingsDrawerOpen" size="60%" title="查看关联资源">
        <ElTable v-loading="mappingsLoading" :data="mappings">
          <ElTableColumn label="名称" min-width="160" prop="name" />
          <ElTableColumn label="类型" min-width="120" prop="type" />
          <ElTableColumn label="描述" min-width="200" prop="description" />
        </ElTable>
        <ElEmpty
          v-if="!mappingsLoading && mappings.length === 0"
          description="暂无关联资源"
        />
      </ElDrawer>
    </div>
  </Page>
</template>

<style scoped lang="scss">
.application-manager {
  --app-space-1: 4px;
  --app-space-2: 8px;
  --app-space-3: 12px;
  --app-space-4: 16px;
  --app-space-5: 20px;
  --app-card-min-width: 292px;
  --app-card-min-height: 156px;
  --app-avatar-size: 40px;
  --app-border-color: var(--el-border-color-lighter);
  --app-create-icon-size: 30px;
  --app-create-menu-width: 292px;
  --app-empty-min-height: 420px;
  --app-panel-bg: hsl(var(--card));
  --app-page-bg: var(--el-fill-color-light);
  --app-radius: 6px;
  --app-search-control-width: 220px;
  --app-filter-select-width: 130px;
  --app-shadow-dropdown: var(--el-box-shadow-light);
  --app-shadow-hover: var(--el-box-shadow-light);
  --app-tab-header-height: 48px;
  --app-title-max-width: 220px;
  --app-toolbar-height: 66px;

  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  height: 100%;
  padding: var(--app-space-3);
  overflow: hidden;
  background: var(--app-page-bg);
}

.application-toolbar,
.batch-strip,
.application-content,
.detail-section {
  background: var(--app-panel-bg);
  border: 1px solid var(--app-border-color);
  border-radius: var(--app-radius);
}

.application-toolbar {
  display: flex;
  flex-shrink: 0;
  gap: var(--app-space-3);
  align-items: center;
  justify-content: space-between;
  min-height: var(--app-toolbar-height);
  padding: var(--app-space-3) var(--app-space-4);
}

.toolbar-title {
  display: flex;
  gap: var(--app-space-2);
  align-items: baseline;
  min-width: max-content;
}

.toolbar-title h2 {
  margin: 0;
  font-size: var(--el-font-size-large);
  font-weight: var(--el-font-weight-primary);
  color: var(--el-text-color-primary);
}

.toolbar-title span,
.muted,
.card-meta,
.publish-time,
.create-option small {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}

.toolbar-actions,
.filter-bar,
.batch-strip,
.card-head,
.app-identity,
.card-footer,
.publish-state,
.card-actions,
.drawer-toolbar,
.switch-row,
.section-title {
  display: flex;
  gap: var(--app-space-2);
  align-items: center;
}

.toolbar-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.toolbar-actions :deep(.el-button) {
  padding-right: var(--app-space-3);
  padding-left: var(--app-space-3);
}

.filter-bar {
  gap: var(--app-space-2);
}

.filter-bar .filter-name {
  width: var(--app-search-control-width);
}

.filter-bar .filter-select {
  width: var(--app-filter-select-width);
}

.button-arrow {
  margin-left: var(--app-space-1);
}

.batch-strip {
  flex-shrink: 0;
  padding: var(--app-space-2) var(--app-space-3);
}

.application-content {
  flex: 1;
  min-height: 0;
  padding: var(--app-space-4);
  overflow: auto;
}

.application-content.is-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--app-empty-min-height);
}

.pager {
  display: flex;
  flex-shrink: 0;
  gap: var(--app-space-3);
  align-items: center;
  justify-content: space-between;
  padding: var(--app-space-2) var(--app-space-4);
  background: var(--app-panel-bg);
  border: 1px solid var(--app-border-color);
  border-radius: var(--app-radius);
}

.pager > span {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}

.empty-panel {
  width: 100%;
}

.empty-panel :deep(.el-empty__image) {
  width: 180px;
}

.empty-panel :deep(.el-empty__description) {
  margin-top: var(--app-space-3);
}

.empty-panel :deep(.el-empty__description p) {
  font-size: var(--el-font-size-base);
  color: var(--el-text-color-secondary);
}

.application-grid {
  display: grid;
  grid-template-columns: repeat(
    auto-fill,
    minmax(var(--app-card-min-width), 1fr)
  );
  gap: var(--app-space-3);
}

.application-card {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  min-height: var(--app-card-min-height);
  padding: var(--app-space-3);
  cursor: pointer;
  background: var(--app-panel-bg);
  border: 1px solid var(--app-border-color);
  border-radius: var(--app-radius);
  transition:
    border-color var(--el-transition-duration),
    box-shadow var(--el-transition-duration);
}

.application-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: var(--app-shadow-hover);
}

.card-head,
.card-footer {
  justify-content: space-between;
}

.app-identity {
  min-width: 0;
}

.app-avatar,
.create-option__icon {
  display: inline-flex;
  flex: 0 0 var(--app-avatar-size);
  align-items: center;
  justify-content: center;
  width: var(--app-avatar-size);
  height: var(--app-avatar-size);
  overflow: hidden;
  font-weight: var(--el-font-weight-primary);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: var(--app-radius);
}

.app-avatar.advanced,
.create-option__icon.advanced {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning-light-7);
}

.app-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.app-title {
  min-width: 0;
}

.app-title strong,
.app-title span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-title strong {
  color: var(--el-text-color-primary);
}

.app-title span {
  max-width: var(--app-title-max-width);
  margin-top: var(--app-space-1);
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}

.type-tag {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-7);
}

.type-tag.advanced {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning-light-7);
}

.card-meta {
  gap: var(--app-space-1);
  min-height: 18px;
}

.card-footer {
  padding-top: var(--app-space-2);
  border-top: 1px solid var(--app-border-color);
}

.publish-state {
  min-width: 0;
  color: var(--el-text-color-secondary);
}

.publish-state .published {
  color: var(--el-color-success);
}

.publish-state .unpublished {
  color: var(--el-text-color-secondary);
}

.card-actions {
  opacity: 0;
  transition: opacity var(--el-transition-duration);
}

.application-card:hover .card-actions,
.card-actions:focus-within {
  opacity: 1;
}

.create-dropdown {
  min-width: var(--app-create-menu-width);
}

:global(.create-dropdown) {
  --app-create-icon-size: 30px;
  --app-panel-bg: hsl(var(--card));
  --app-radius: 6px;
  --app-shadow-dropdown: var(--el-box-shadow-light);
  --app-space-1: 4px;
  --app-space-2: 8px;
  --app-space-3: 12px;

  min-width: var(--app-create-menu-width, 292px);
  padding: var(--app-space-1, 4px);
  background: var(--app-panel-bg, hsl(var(--card)));
  border-radius: var(--app-radius, 6px);
  box-shadow: var(--app-shadow-dropdown, var(--el-box-shadow-light));
}

:global(.create-dropdown .el-dropdown-menu__item) {
  padding: var(--app-space-2, 8px);
  line-height: 1.35;
  border-radius: var(--app-radius, 6px);
}

:global(.create-dropdown .el-dropdown-menu__item:not(.is-disabled):focus),
:global(.create-dropdown .el-dropdown-menu__item:not(.is-disabled):hover) {
  color: var(--el-text-color-primary);
  background: var(--el-color-primary-light-9);
}

.create-option {
  display: flex;
  gap: var(--app-space-2);
  align-items: center;
  width: 100%;
  padding: var(--app-space-1) 0;
}

.create-option__icon {
  flex-basis: var(--app-create-icon-size);
  width: var(--app-create-icon-size);
  height: var(--app-create-icon-size);
  font-size: var(--el-font-size-extra-small);
}

.create-option strong,
.create-option small {
  display: block;
}

.create-option strong {
  font-size: var(--el-font-size-base);
  font-weight: var(--el-font-weight-primary);
  color: var(--el-text-color-primary);
}

.create-option small {
  margin-top: var(--app-space-1);
}

.detail-tabs {
  height: 100%;
}

.detail-tabs :deep(.el-tabs__content) {
  height: calc(100% - var(--app-tab-header-height));
  overflow: auto;
}

.access-grid {
  display: grid;
  gap: var(--app-space-3);
}

.detail-section {
  padding: var(--app-space-3);
}

.section-title {
  justify-content: space-between;
  margin-bottom: var(--app-space-2);
  font-weight: var(--el-font-weight-primary);
}

.switch-row {
  flex-wrap: wrap;
}

.mt8 {
  margin-top: var(--app-space-2);
}

.mt12 {
  margin-top: var(--app-space-3);
}

.mono-line {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: nowrap;
}

@media (max-width: 960px) {
  .application-toolbar,
  .toolbar-title,
  .toolbar-actions {
    align-items: stretch;
  }

  .application-toolbar,
  .toolbar-actions {
    flex-direction: column;
  }

  .filter-bar,
  .filter-bar .filter-name,
  .filter-bar .filter-select {
    width: 100%;
  }
}
</style>
