<script setup lang="ts">
import type { UploadFile, UploadFiles } from 'element-plus';

import type { ApplicationPayload } from '#/api/ai/types';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { confirm, Page } from '@vben/common-ui';

import {
  AlarmClock,
  ArrowDown,
  ChatDotRound,
  CircleCheckFilled,
  Clock,
  CopyDocument,
  Delete,
  Download,
  EditPen,
  FolderAdd,
  FolderOpened,
  Lock,
  MoreFilled,
  Plus,
  Rank,
  Refresh,
  Search,
  Setting,
  Share,
  Upload,
} from '@element-plus/icons-vue';
import {
  ElBreadcrumb,
  ElBreadcrumbItem,
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
  ElTable,
  ElTableColumn,
  ElTag,
  ElTooltip,
  ElTree,
  ElUpload,
} from 'element-plus';

import {
  batchDeleteApplications,
  createAccessToken,
  createApplication,
  deleteApplication,
  exportApplication,
  getApplication,
  importApplication,
  moveApplication,
  pageAccessTokens,
  pageApplications,
} from '#/api/ai/applications';
import {
  createResourceFolder,
  deleteResourceFolder,
  listResourceAuth,
  listResourceFolders,
  listResourceMappings,
  saveResourceAuth,
  updateResourceFolder,
} from '#/api/ai/resources';
import { pageList as pageUsers } from '#/api/core/user';

import { recordsOf, totalOf } from '../utils';
import {
  applicationPrimaryEntry,
  isWorkflowApplication,
  normalizeApplicationType,
} from './application-entry';

type Id = number | string;

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

interface FolderNode extends Record<string, unknown> {
  children?: FolderNode[];
  id?: Id;
  name?: string;
  parentId?: Id;
  parent_id?: Id;
}

interface UserOption {
  id: Id;
  label: string;
}

interface ResourceAuthRecord extends Record<string, unknown> {
  id?: Id;
  permission?: string;
  principalId?: Id;
  principalType?: string;
}

interface ResourceMappingRecord extends Record<string, unknown> {
  description?: string;
  name?: string;
  type?: string;
}

const router = useRouter();
const loading = ref(false);
const treeLoading = ref(false);
const applications = ref<ApplicationRecord[]>([]);
const total = ref(0);
const selectedIds = ref<Id[]>([]);
const batchMode = ref(false);

// --- Folder tree ---
const rootFolderId = '__root__';
const folders = ref<FolderNode[]>([]);
const activeFolderId = ref<Id>(rootFolderId);

// --- Search type switcher ---
type SearchType = 'create_user' | 'name' | 'publish_status';
const searchType = ref<SearchType>('name');
const createUserFilter = ref('');
const userOptions = ref<UserOption[]>([]);
const userSearchLoading = ref(false);

const query = reactive({
  current: 1,
  folderId: undefined as Id | undefined,
  name: '',
  page: 1,
  publishStatus: '',
  size: 12,
  type: '',
});

// --- Create dialog ---
const dialogOpen = ref(false);
const saving = ref(false);
// Workflow template selection (blank / assistant), mirrors MaxKB CreateApplicationDialog.
const workflowTemplate = ref<'assistant' | 'blank'>('blank');
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

// --- Copy dialog ---
const copyDialogOpen = ref(false);
const copying = ref(false);
const copyForm = reactive<ApplicationPayload>({
  description: '',
  icon: 'App',
  name: '',
  type: 'SIMPLE',
});

// --- Import dialog ---
const importDialogOpen = ref(false);
const importing = ref(false);
const importFiles = ref<UploadFile[]>([]);

// --- Folder creation dialog ---
const folderDialogOpen = ref(false);
const folderDialogMode = ref<'create' | 'edit'>('create');
const folderForm = reactive({
  name: '',
  description: '',
  _parentId: '' as string,
});
const editFolderId = ref<Id>();

// --- Folder move dialog ---
const movingFolder = ref<FolderNode>();
const folderMoveDialogOpen = ref(false);
const folderMoveForm = reactive({ parent_id: '' as string });

// --- Move dialog ---
const moveDialogOpen = ref(false);
const moveTargetApp = ref<ApplicationRecord>();
const moveFolders = ref<Array<{ id?: Id; name?: string }>>([]);
const selectedFolderId = ref<Id>();
const moveLoading = ref(false);

// --- Auth drawer ---
const authDrawerOpen = ref(false);
const authTargetApp = ref<ApplicationRecord>();
const authRecords = ref<ResourceAuthRecord[]>([]);
const authLoading = ref(false);

// --- Mappings drawer ---
const mappingsDrawerOpen = ref(false);
const mappingsTargetApp = ref<ApplicationRecord>();
const mappings = ref<ResourceMappingRecord[]>([]);
const mappingsLoading = ref(false);

// --- Computed ---
const currentPageAppIds = computed(() =>
  applications.value
    .map((item) => idValue(item.id))
    .filter((id): id is Id => id !== undefined),
);
const isAllCurrentPageSelected = computed(
  () =>
    currentPageAppIds.value.length > 0 &&
    currentPageAppIds.value.every((id) => selectedIds.value.includes(id)),
);
const isCurrentPageSelectionIndeterminate = computed(() => {
  const currentSelectedCount = currentPageAppIds.value.filter((id) =>
    selectedIds.value.includes(id),
  ).length;
  return (
    currentSelectedCount > 0 &&
    currentSelectedCount < currentPageAppIds.value.length
  );
});
const hasActiveFilter = computed(
  () =>
    query.name.trim() !== '' ||
    query.publishStatus !== '' ||
    query.type !== '' ||
    createUserFilter.value !== '',
);
const currentFolder = computed(() => {
  if (activeFolderId.value === rootFolderId) {
    return { id: rootFolderId as Id, name: '全部应用' };
  }
  return (
    findFolderById(folders.value, activeFolderId.value) || {
      id: rootFolderId as Id,
      name: '全部应用',
    }
  );
});
const currentFolderId = computed(() =>
  activeFolderId.value === rootFolderId ? undefined : activeFolderId.value,
);
const breadcrumbPath = computed(() => {
  if (activeFolderId.value === rootFolderId) return ['全部应用'];
  const path = findFolderPath(folders.value, activeFolderId.value);
  return path.length > 0
    ? ['全部应用', ...path]
    : ['全部应用', folderDisplayName(currentFolder.value)];
});
const visibleFolderTree = computed<FolderNode[]>(() => [
  {
    children: folders.value,
    id: rootFolderId as Id,
    name: '全部应用',
  },
]);

// --- Utility functions ---
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

// --- Folder tree functions ---
function folderDisplayName(folder?: FolderNode) {
  if (!folder || folder.id === rootFolderId) return '全部应用';
  return stringValue(folder.name || folder.id, '未命名文件夹');
}

function findFolderById(
  list: FolderNode[],
  folderId?: Id,
): FolderNode | undefined {
  if (folderId === undefined) return undefined;
  for (const folder of list) {
    if (folder.id === folderId) return folder;
    const child = findFolderById(folder.children || [], folderId);
    if (child) return child;
  }
  return undefined;
}

function findFolderPath(list: FolderNode[], folderId?: Id): string[] {
  if (folderId === undefined) return [];
  for (const item of list) {
    if (item.id === folderId) return [item.name || '未命名文件夹'];
    const childPath = findFolderPath(item.children || [], folderId);
    if (childPath.length > 0)
      return [item.name || '未命名文件夹', ...childPath];
  }
  return [];
}

function buildFolderHierarchy(list: FolderNode[]): FolderNode[] {
  const foldersById = new Map<string, FolderNode>();
  list.forEach((folder) => {
    const key = idValue(folder.id);
    if (key !== undefined && !foldersById.has(String(key))) {
      foldersById.set(String(key), folder);
    }
  });

  const rootFolders: FolderNode[] = [];
  list.forEach((folder) => {
    const folderKey = idValue(folder.id);
    const parentKey = idValue(folder.parentId ?? folder.parent_id);
    const parent =
      parentKey === undefined ? undefined : foldersById.get(String(parentKey));
    if (
      parentKey === undefined ||
      parent === undefined ||
      folderKey === undefined ||
      String(parentKey) === String(folderKey)
    ) {
      rootFolders.push(folder);
      return;
    }
    if (!parent.children) parent.children = [];
    parent.children.push(folder);
  });
  return rootFolders;
}

function normalizeFolderList(data: unknown): FolderNode[] {
  const records = recordsOf<FolderNode>(data);
  return buildFolderHierarchy(
    records.map((item) => ({
      ...item,
      id: idValue(item.id),
      name: stringValue(item.name, '未命名文件夹'),
      parentId: idValue(item.parentId ?? item.parent_id),
      parent_id: idValue(item.parentId ?? item.parent_id),
    })),
  );
}

async function loadFolders() {
  treeLoading.value = true;
  try {
    const data = await listResourceFolders({ resourceType: 'APPLICATION' });
    folders.value = normalizeFolderList(data);
  } finally {
    treeLoading.value = false;
  }
}

function selectFolder(folder: FolderNode) {
  activeFolderId.value = folder.id ?? rootFolderId;
  query.folderId = currentFolderId.value;
  searchApplications();
}

// --- Folder tree drag-and-drop ---
function allowDragFolder(): boolean {
  return true;
}

function allowDropFolder(
  dragging: FolderNode,
  drop: FolderNode,
  type: 'inner' | 'next' | 'prev',
): boolean {
  // Don't allow dropping onto the synthetic root
  if (drop.id === rootFolderId) return type === 'inner';
  // Don't allow dropping a folder onto itself
  if (dragging.id === drop.id) return false;
  return true;
}

async function handleFolderDragDrop(
  dragging: FolderNode,
  drop: FolderNode,
  type: 'inner' | 'next' | 'prev',
) {
  const dragId = idValue(dragging.id);
  if (dragId === undefined) return;

  let targetParentId: Id | undefined;
  if (type === 'inner') {
    targetParentId = drop.id === rootFolderId ? undefined : drop.id;
  } else {
    // 'prev' or 'next' → same parent as drop node
    targetParentId =
      drop.id === rootFolderId
        ? undefined
        : idValue(drop.parentId ?? drop.parent_id);
  }

  treeLoading.value = true;
  try {
    await updateResourceFolder(dragId, {
      name: stringValue(dragging.name, '未命名文件夹'),
      type: 'APPLICATION',
      ...(targetParentId === undefined
        ? {}
        : { parentId: targetParentId, parent_id: targetParentId }),
    });
    ElMessage.success('文件夹已移动');
    await loadFolders();
  } catch {
    ElMessage.error('移动失败');
  } finally {
    treeLoading.value = false;
  }
}

// --- Data loading ---
async function loadApplications() {
  loading.value = true;
  try {
    const params: Record<string, unknown> = {
      current: query.current,
      page: query.page,
      size: query.size,
    };
    if (query.folderId !== undefined) {
      params.folderId = query.folderId;
      params.folder_id = query.folderId;
    }
    if (query.name.trim()) {
      params.name = query.name.trim();
    }
    if (query.publishStatus) {
      params.publishStatus = query.publishStatus;
    }
    if (query.type) {
      params.type = query.type;
    }
    if (createUserFilter.value) {
      params.createUser = createUserFilter.value;
      params.create_user = createUserFilter.value;
    }
    const data = await pageApplications(params);
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
  createUserFilter.value = '';
  searchType.value = 'name';
  searchApplications();
}

function handlePageChange(page: number) {
  query.current = page;
  query.page = page;
  void loadApplications();
}

// --- Create dialog (MaxKB: only create, no edit from list page) ---
function resetForm(type = 'WORK_FLOW') {
  Object.assign(form, {
    accessEnabled: true,
    description: '',
    folderId: undefined,
    icon: 'App',
    name: '',
    showGuide: true,
    showHistory: true,
    showSource: true,
    type,
    workspaceId: 'default',
  });
  workflowTemplate.value = 'blank';
}

function openDialog(type = 'WORK_FLOW') {
  resetForm(type);
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

function selectWorkflowTemplate(template: 'assistant' | 'blank') {
  workflowTemplate.value = template;
}

async function saveApplication() {
  const trimmedName = form.name?.trim();
  if (!trimmedName) {
    ElMessage.warning('请输入应用名称');
    return;
  }
  saving.value = true;
  try {
    const payload: ApplicationPayload = { ...form, name: trimmedName };
    const saved = await createApplication(payload);
    ElMessage.success('创建成功');
    dialogOpen.value = false;
    await loadApplications();
    if (normalizeAppType(payload.type) === 'WORK_FLOW') {
      const createdId =
        createdIdFromResponse(saved) ||
        applications.value.find((item) => item.name === trimmedName)?.id;
      if (createdId !== undefined) {
        openWorkflow({ id: createdId, type: payload.type });
      }
    }
  } finally {
    saving.value = false;
  }
}

// --- Delete / duplicate / export ---
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

// --- Copy application (MaxKB CopyApplicationDialog: prefill from source, editable name/desc) ---
async function openCopyDialog(row: ApplicationRecord) {
  if (row.id === undefined) return;
  let source: ApplicationRecord = row;
  try {
    const detail = await getApplication(row.id);
    if (isRecord(detail)) source = { ...row, ...(detail as ApplicationRecord) };
  } catch {
    // fall back to row data
  }
  Object.assign(copyForm, {
    description: applicationDescription(source),
    icon: stringValue(source.icon, 'App'),
    name: `${applicationName(source)} 副本`,
    type: source.type || 'SIMPLE',
    workspaceId: stringValue(
      firstValue(source, ['workspaceId', 'workspace_id']),
      'default',
    ),
  });
  copyDialogOpen.value = true;
}

async function confirmCopyApplication() {
  const trimmedName = copyForm.name?.trim();
  if (!trimmedName) {
    ElMessage.warning('请输入应用名称');
    return;
  }
  copying.value = true;
  try {
    const payload: ApplicationPayload = { ...copyForm, name: trimmedName };
    const saved = await createApplication(payload);
    ElMessage.success('复制成功');
    copyDialogOpen.value = false;
    await loadApplications();
    if (normalizeAppType(payload.type) === 'WORK_FLOW') {
      const createdId =
        createdIdFromResponse(saved) ||
        applications.value.find((item) => item.name === trimmedName)?.id;
      if (createdId !== undefined) {
        openWorkflow({ id: createdId, type: payload.type });
      }
    }
  } finally {
    copying.value = false;
  }
}

async function exportApplicationFile(row: ApplicationRecord) {
  if (row.id === undefined) return;
  await exportApplication(row.id);
}

// --- Import ---
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

// --- Selection / batch ---
function isSelected(row: ApplicationRecord) {
  return row.id !== undefined && selectedIds.value.includes(row.id);
}

function toggleSelection(row: ApplicationRecord, checked: boolean) {
  if (row.id === undefined) return;
  selectedIds.value = checked
    ? [...new Set([row.id, ...selectedIds.value])]
    : selectedIds.value.filter((id) => id !== row.id);
}

function toggleCurrentPageSelection(checked: boolean) {
  if (checked) {
    selectedIds.value = [
      ...new Set([...currentPageAppIds.value, ...selectedIds.value]),
    ];
  } else {
    const pageIds = new Set(currentPageAppIds.value);
    selectedIds.value = selectedIds.value.filter((id) => !pageIds.has(id));
  }
}

function toggleBatchMode(activeOrEvent?: boolean | MouseEvent) {
  if (typeof activeOrEvent === 'boolean') {
    batchMode.value = activeOrEvent;
  } else if (activeOrEvent instanceof MouseEvent) {
    activeOrEvent.preventDefault();
    batchMode.value = !batchMode.value;
  } else {
    batchMode.value = !batchMode.value;
  }
  if (!batchMode.value) selectedIds.value = [];
}

// --- toChat: open public chat (MaxKB `toChat`, jk-ui token-based public chat route) ---
function tokenTextOf(record?: Record<string, unknown>): string {
  return stringValue(
    firstValue(record, ['token', 'accessToken', 'access_token']),
  );
}

const toChatLoadingIds = ref<Id[]>([]);

async function toChat(row: ApplicationRecord) {
  if (row.id === undefined) return;
  toChatLoadingIds.value = [...toChatLoadingIds.value, row.id];
  try {
    // Get-or-create an access token (jk-ui has no get-or-create endpoint).
    const page = await pageAccessTokens(row.id, {
      current: 1,
      page: 1,
      size: 20,
    });
    const records = recordsOf<Record<string, unknown>>(page);
    let token = tokenTextOf(records[0]);
    if (!token) {
      const created = await createAccessToken(row.id, {
        enabled: true,
        name: '默认令牌',
      });
      token = tokenTextOf(created as Record<string, unknown>);
    }
    if (!token) {
      ElMessage.warning('未找到公开访问令牌');
      return;
    }
    const url = `/ui/chat/${encodeURIComponent(token)}`;
    window.open(url);
  } finally {
    toChatLoadingIds.value = toChatLoadingIds.value.filter(
      (id) => id !== row.id,
    );
  }
}

// --- Navigation ---
function openApplicationSetting(row: ApplicationRecord) {
  if (isWorkflowApplication(row.type)) {
    openWorkflow(row);
    return;
  }
  if (row.id === undefined) return;
  router.push(`/ai/orchestration/applications/detail/${row.id}/setting`);
}

function openWorkflow(row?: ApplicationRecord) {
  if (!row?.id) return;
  if (!isWorkflowApplication(row.type)) {
    openApplicationPrimary(row);
    return;
  }
  router.push({
    name: 'AiOrchestrationApplicationWorkflow',
    params: { id: row.id },
  });
}

function openApplicationPrimary(row?: ApplicationRecord) {
  if (!row?.id) return;
  const entry = applicationPrimaryEntry(row);
  router.push({
    path: entry.path,
    query: entry.query,
  });
}

// --- Card click (MaxKB goApp): batch toggle + Ctrl+Click new tab ---
function handleCardClick(event: MouseEvent, row: ApplicationRecord) {
  if (batchMode.value) {
    const checked = !isSelected(row);
    toggleSelection(row, checked);
    return;
  }
  const targetPath = `/ai/orchestration/applications/detail/${row.id}/overview`;
  if (event.ctrlKey || event.metaKey) {
    const url = router.resolve({ path: targetPath }).href;
    window.open(url);
  } else {
    router.push(targetPath);
  }
}

// --- Search type switcher ---
function handleSearchTypeChange() {
  query.name = '';
  query.publishStatus = '';
  createUserFilter.value = '';
  searchApplications();
}

async function searchUsers(queryStr: string) {
  if (!queryStr.trim()) {
    userOptions.value = [];
    return;
  }
  userSearchLoading.value = true;
  try {
    const data = await pageUsers({
      current: 1,
      size: 20,
      nickname: queryStr.trim(),
    });
    const records = recordsOf<Record<string, unknown>>(data);
    userOptions.value = records.map((item) => ({
      id: idValue(item.userId ?? item.id) ?? '',
      label:
        stringValue(
          item.nick_name ??
            item.nickname ??
            item.realName ??
            item.userName ??
            item.username,
        ) ||
        stringValue(item.userId ?? item.id) ||
        '',
    }));
  } finally {
    userSearchLoading.value = false;
  }
}

function handleCreateUserChange(userId: string) {
  createUserFilter.value = userId;
  searchApplications();
}

// --- Folder creation / edit dialog ---
function isSyntheticRootFolder(folder?: FolderNode) {
  return folder?.id === rootFolderId;
}

function openCreateFolderDialog(parentFolder?: FolderNode) {
  folderDialogMode.value = 'create';
  editFolderId.value = undefined;
  Object.assign(folderForm, {
    name: '',
    description: '',
  });
  folderForm._parentId =
    parentFolder && !isSyntheticRootFolder(parentFolder)
      ? String(idValue(parentFolder.id) ?? '')
      : '';
  folderDialogOpen.value = true;
}

function openCreateSubFolder(folder: FolderNode) {
  if (isSyntheticRootFolder(folder)) {
    openCreateFolderDialog();
    return;
  }
  openCreateFolderDialog(folder);
}

function openEditFolder(folder: FolderNode) {
  if (isSyntheticRootFolder(folder)) {
    ElMessage.warning('根目录不可编辑');
    return;
  }
  folderDialogMode.value = 'edit';
  editFolderId.value = idValue(folder.id);
  Object.assign(folderForm, {
    name: stringValue(folder.name),
    description: '',
  });
  folderDialogOpen.value = true;
}

async function saveFolder() {
  const name = folderForm.name.trim();
  if (!name) {
    ElMessage.warning('请输入文件夹名称');
    return;
  }
  if (folderDialogMode.value === 'edit' && editFolderId.value !== undefined) {
    await updateResourceFolder(editFolderId.value, {
      name,
      type: 'APPLICATION',
    });
    ElMessage.success('文件夹已更新');
  } else {
    const parentId = folderForm._parentId || undefined;
    await createResourceFolder({
      name,
      type: 'APPLICATION',
      ...(parentId ? { parentId, parent_id: parentId } : {}),
    });
    ElMessage.success('文件夹已创建');
  }
  folderDialogOpen.value = false;
  await loadFolders();
  await loadApplications();
}

async function removeFolder(folder: FolderNode) {
  if (isSyntheticRootFolder(folder)) {
    ElMessage.warning('根目录不可删除');
    return;
  }
  const folderId = idValue(folder.id);
  if (folderId === undefined) return;
  confirm(
    `确认删除文件夹 ${folder.name || folderId}？该文件夹下的应用会移动到根目录。`,
  ).then(async () => {
    await deleteResourceFolder(folderId);
    ElMessage.success('文件夹已删除');
    if (activeFolderId.value === folderId) {
      activeFolderId.value = rootFolderId;
      query.folderId = undefined;
    }
    await loadFolders();
    await loadApplications();
  });
}

// --- Folder move ---
const folderMoveOptions = computed(() => {
  const rootOption = { id: '' as string, name: '根目录' };
  const flatList = flattenFolders(folders.value);
  return [rootOption, ...flatList];
});

function flattenFolders(
  list: FolderNode[],
): Array<{ id: string; name: string }> {
  const result: Array<{ id: string; name: string }> = [];
  for (const folder of list) {
    const folderId = idValue(folder.id);
    if (folderId !== undefined) {
      result.push({
        id: String(folderId),
        name: stringValue(folder.name, '未命名'),
      });
    }
    if (folder.children?.length) {
      result.push(...flattenFolders(folder.children));
    }
  }
  return result;
}

function openMoveFolder(folder: FolderNode) {
  if (isSyntheticRootFolder(folder)) {
    ElMessage.warning('根目录不可转移');
    return;
  }
  movingFolder.value = folder;
  const parentId = idValue(folder.parentId ?? folder.parent_id) ?? '';
  folderMoveForm.parent_id = parentId ? String(parentId) : '';
  folderMoveDialogOpen.value = true;
}

async function saveFolderMove() {
  const folder = movingFolder.value;
  if (!folder) return;
  const folderId = idValue(folder.id);
  if (folderId === undefined) return;
  const targetId = folderMoveForm.parent_id || undefined;
  await updateResourceFolder(folderId, {
    name: stringValue(folder.name, '未命名文件夹'),
    type: 'APPLICATION',
    ...(targetId ? { parentId: targetId, parent_id: targetId } : {}),
  });
  ElMessage.success('文件夹已移动');
  folderMoveDialogOpen.value = false;
  movingFolder.value = undefined;
  await loadFolders();
  await loadApplications();
}

// --- Move dialog ---
function openMoveDialog(row?: ApplicationRecord) {
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
  if (selectedFolderId.value === undefined) return;
  moveLoading.value = true;
  try {
    if (moveTargetApp.value?.id !== undefined) {
      // single
      await moveApplication(moveTargetApp.value.id, {
        targetFolderId: selectedFolderId.value,
      });
    } else if (batchMode.value && selectedIds.value.length > 0) {
      // batch
      await Promise.all(
        selectedIds.value.map((id) =>
          moveApplication(id, { targetFolderId: selectedFolderId.value }),
        ),
      );
      selectedIds.value = [];
      batchMode.value = false;
    } else {
      return;
    }
    ElMessage.success('移动成功');
    moveDialogOpen.value = false;
    await loadApplications();
  } finally {
    moveLoading.value = false;
  }
}

// --- Triggers ---
function navigateToTriggers(row: ApplicationRecord) {
  router.push({
    path: '/ai/orchestration/triggers/index',
    query: { applicationId: String(row.id) },
  });
}

// --- Resource Authorization ---
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
  await saveResourceAuth({
    id: app.id,
    applicationId: row.principalId,
    name: row.principalType ?? 'USER',
    configJson: JSON.stringify({ permission: row.permission }),
    type: 'APPLICATION',
  });
  ElMessage.success('授权已更新');
}

// --- Resource Mappings ---
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

onMounted(() => {
  void loadFolders();
  void loadApplications();
});
</script>

<template>
  <Page auto-content-height>
    <div class="application-manager" v-loading="loading">
      <section class="application-management-shell">
        <aside class="application-folder-pane" v-loading="treeLoading">
          <div class="folder-pane-header">
            <h4>应用</h4>
          </div>
          <ElTree
            class="application-folder-tree"
            :current-node-key="activeFolderId"
            :data="visibleFolderTree"
            :expand-on-click-node="false"
            :props="{ children: 'children', label: 'name' }"
            :allow-drop="allowDropFolder"
            :allow-drag="allowDragFolder"
            default-expand-all
            draggable
            highlight-current
            node-key="id"
            @node-click="selectFolder"
            @node-drop="handleFolderDragDrop"
          >
            <template #default="{ data }">
              <div
                class="folder-node"
                :class="{ 'is-root': data.id === rootFolderId }"
              >
                <span class="folder-node__main">
                  <FolderOpened class="folder-node__icon" />
                  <span
                    class="folder-node__label"
                    :title="folderDisplayName(data)"
                  >
                    {{ folderDisplayName(data) }}
                  </span>
                </span>
                <span class="folder-node__actions" @click.stop>
                  <ElDropdown trigger="click">
                    <ElButton class="folder-node__more" text>
                      <MoreFilled />
                    </ElButton>
                    <template #dropdown>
                      <ElDropdownMenu class="folder-action-menu">
                        <ElDropdownItem @click.stop="openCreateSubFolder(data)">
                          <span class="folder-action-menu__item">
                            <FolderAdd class="folder-action-menu__icon" />
                            <span>添加子文件夹</span>
                          </span>
                        </ElDropdownItem>
                        <ElDropdownItem
                          v-if="!isSyntheticRootFolder(data)"
                          @click.stop="openEditFolder(data)"
                        >
                          <span class="folder-action-menu__item">
                            <EditPen class="folder-action-menu__icon" />
                            <span>编辑</span>
                          </span>
                        </ElDropdownItem>
                        <ElDropdownItem
                          v-if="!isSyntheticRootFolder(data)"
                          @click.stop="openMoveFolder(data)"
                        >
                          <span class="folder-action-menu__item">
                            <Rank class="folder-action-menu__icon" />
                            <span>转移到</span>
                          </span>
                        </ElDropdownItem>
                        <ElDropdownItem
                          divided
                          :disabled="isSyntheticRootFolder(data)"
                          @click.stop="removeFolder(data)"
                        >
                          <span class="folder-action-menu__item">
                            <Delete class="folder-action-menu__icon" />
                            <span>删除</span>
                          </span>
                        </ElDropdownItem>
                      </ElDropdownMenu>
                    </template>
                  </ElDropdown>
                </span>
              </div>
            </template>
          </ElTree>
        </aside>

        <main class="application-list-pane">
          <header class="application-list-header">
            <ElBreadcrumb separator="/">
              <ElBreadcrumbItem
                v-for="(crumb, index) in breadcrumbPath"
                :key="index"
                @click="
                  index < breadcrumbPath.length - 1
                    ? selectFolder({ id: rootFolderId } as FolderNode)
                    : undefined
                "
              >
                <span
                  :class="{
                    'breadcrumb-link': index < breadcrumbPath.length - 1,
                  }"
                >
                  {{ crumb }}
                </span>
              </ElBreadcrumbItem>
            </ElBreadcrumb>
          </header>

          <section class="application-toolbar">
            <div class="toolbar-title">
              <span>共 {{ total }} 个应用</span>
            </div>
            <div class="toolbar-actions">
              <div class="filter-bar">
                <ElSelect
                  v-model="searchType"
                  class="filter-search-type"
                  @change="handleSearchTypeChange"
                >
                  <ElOption label="名称" value="name" />
                  <ElOption label="创建人" value="create_user" />
                  <ElOption label="发布状态" value="publish_status" />
                </ElSelect>
                <ElInput
                  v-if="searchType === 'name'"
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
                  v-else-if="searchType === 'create_user'"
                  v-model="createUserFilter"
                  class="filter-name"
                  clearable
                  filterable
                  remote
                  :remote-method="searchUsers"
                  :loading="userSearchLoading"
                  placeholder="搜索创建人"
                  @change="handleCreateUserChange"
                  @clear="searchApplications"
                >
                  <ElOption
                    v-for="user in userOptions"
                    :key="user.id"
                    :label="user.label"
                    :value="String(user.id)"
                  />
                </ElSelect>
                <ElSelect
                  v-else-if="searchType === 'publish_status'"
                  v-model="query.publishStatus"
                  class="filter-name"
                  clearable
                  placeholder="选择状态"
                  @change="searchApplications"
                >
                  <ElOption label="已发布" value="published" />
                  <ElOption label="未发布" value="unpublished" />
                </ElSelect>
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
                <ElButton v-if="hasActiveFilter" link @click="resetFilters">
                  重置
                </ElButton>
              </div>
              <ElButton :icon="Refresh" @click="loadApplications">
                刷新
              </ElButton>
              <ElButton :icon="Upload" @click="openImportDialog">
                导入应用
              </ElButton>
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
                    <ElDropdownItem @click="openDialog('SIMPLE')">
                      <div class="create-option">
                        <span class="create-option__icon simple">简</span>
                        <span>
                          <strong>简易智能体</strong>
                          <small>基于提示词快速创建对话应用</small>
                        </span>
                      </div>
                    </ElDropdownItem>
                    <ElDropdownItem @click="openDialog('WORK_FLOW')">
                      <div class="create-option">
                        <span class="create-option__icon advanced">高</span>
                        <span>
                          <strong>高级智能体</strong>
                          <small>使用工作流编排复杂应用能力</small>
                        </span>
                      </div>
                    </ElDropdownItem>
                    <ElDropdownItem divided @click="openCreateFolderDialog">
                      <div class="create-option">
                        <span class="create-option__icon folder">
                          <ElIcon><FolderAdd /></ElIcon>
                        </span>
                        <span>
                          <strong>创建文件夹</strong>
                        </span>
                      </div>
                    </ElDropdownItem>
                  </ElDropdownMenu>
                </template>
              </ElDropdown>
            </div>
          </section>

          <div v-if="batchMode" class="batch-operation-bar">
            <ElCheckbox
              :indeterminate="isCurrentPageSelectionIndeterminate"
              :model-value="isAllCurrentPageSelected"
              @change="
                (checked) => toggleCurrentPageSelection(Boolean(checked))
              "
            >
              全选
            </ElCheckbox>
            <ElButton
              :disabled="selectedIds.length === 0"
              @click="openMoveDialog()"
            >
              转移到
            </ElButton>
            <ElButton
              :disabled="selectedIds.length === 0"
              type="danger"
              @click="removeSelectedApplications"
            >
              删除
            </ElButton>
            <span class="batch-operation-bar__summary">
              已选择 {{ selectedIds.length }}/{{ total }} 个应用
            </span>
            <ElButton link type="primary" @click="toggleBatchMode(false)">
              取消选择
            </ElButton>
          </div>

          <section
            class="application-content"
            :class="{ 'is-empty': applications.length === 0 }"
          >
            <div v-if="applications.length > 0" class="application-grid">
              <article
                v-for="item in applications"
                :key="item.id"
                class="application-card"
                @click="handleCardClick($event, item)"
              >
                <!-- Batch checkbox - position absolute top-left -->
                <ElCheckbox
                  v-if="batchMode"
                  class="card-batch-check"
                  :model-value="isSelected(item)"
                  @click.stop
                  @change="(checked) => toggleSelection(item, checked === true)"
                />

                <!-- Card header: icon + title/subtitle -->
                <div class="card-header">
                  <div class="card-icon">
                    <span
                      class="app-avatar"
                      :class="{ advanced: !isSimpleApplication(item.type) }"
                    >
                      <img
                        v-if="appIconUrl(item)"
                        :src="appIconUrl(item)"
                        alt=""
                      />
                      <span v-else>{{ iconInitial(item) }}</span>
                    </span>
                  </div>
                  <div class="card-title-area">
                    <div class="card-title" :title="applicationName(item)">
                      {{ applicationName(item) }}
                    </div>
                    <div class="card-subtitle">
                      <span class="card-creator" :title="creatorLabel(item)">{{
                        creatorLabel(item)
                      }}</span>
                      <span class="card-subtitle-sep">创建于</span>
                      <span>{{ createTimeLabel(item) }}</span>
                    </div>
                  </div>
                </div>

                <!-- Type tag - absolute top-right (or batch checkbox) -->
                <div class="card-status-tag">
                  <ElTag
                    v-if="!batchMode"
                    class="type-tag"
                    :class="{ advanced: !isSimpleApplication(item.type) }"
                    size="small"
                  >
                    {{ appTypeLabel(item.type) }}
                  </ElTag>
                </div>

                <!-- Description - 2-line clamp -->
                <div class="card-description">
                  {{ applicationDescription(item) }}
                </div>

                <!-- Footer - absolute bottom (MaxKB: published: SuccessFilled + 已发布 + divider + clock + update_time; unpublished: disabled icon + 未发布) -->
                <div class="card-footer">
                  <div class="card-footer-left card-footer-default">
                    <template v-if="publishState(item) === 'published'">
                      <ElIcon class="card-publish-icon published">
                        <CircleCheckFilled />
                      </ElIcon>
                      <span class="card-footer-text">已发布</span>
                      <span class="card-footer-separator"></span>
                      <ElIcon class="card-publish-icon muted">
                        <Clock />
                      </ElIcon>
                      <span class="card-footer-text muted">{{
                        updateTimeLabel(item)
                      }}</span>
                    </template>
                    <template v-else>
                      <ElIcon class="card-publish-icon unpublished">
                        <Lock />
                      </ElIcon>
                      <span class="card-footer-text">未发布</span>
                    </template>
                  </div>

                  <!-- Hover actions - shows on hover via CSS (MaxKB mouseEnter slot) -->
                  <div class="card-hover-actions" @click.stop>
                    <!-- toChat button (MaxKB: "开始对话") -->
                    <ElTooltip content="开始对话" placement="top">
                      <ElButton
                        text
                        :disabled="publishState(item) !== 'published'"
                        :loading="toChatLoadingIds.includes(item.id!)"
                        @click="toChat(item)"
                      >
                        <ElIcon class="color-secondary">
                          <ChatDotRound />
                        </ElIcon>
                      </ElButton>
                    </ElTooltip>
                    <span class="card-hover-action-divider"></span>
                    <ElDropdown trigger="click">
                      <ElButton text @click.stop>
                        <ElIcon class="color-secondary"><MoreFilled /></ElIcon>
                      </ElButton>
                      <template #dropdown>
                        <ElDropdownMenu>
                          <ElDropdownItem @click="openApplicationSetting(item)">
                            <ElIcon class="color-secondary"><Setting /></ElIcon>
                            设置
                          </ElDropdownItem>
                          <ElDropdownItem @click="openAuthDrawer(item)">
                            <ElIcon class="color-secondary"><Lock /></ElIcon>
                            资源授权
                          </ElDropdownItem>
                          <ElDropdownItem @click="openMappingsDrawer(item)">
                            <ElIcon class="color-secondary"><Share /></ElIcon>
                            查看关联资源
                          </ElDropdownItem>
                          <ElDropdownItem
                            :disabled="publishState(item) !== 'published'"
                            @click="navigateToTriggers(item)"
                          >
                            <ElIcon class="color-secondary">
                              <AlarmClock />
                            </ElIcon>
                            触发器
                          </ElDropdownItem>
                          <ElDropdownItem
                            :disabled="publishState(item) !== 'published'"
                            @click="toChat(item)"
                          >
                            <ElIcon class="color-secondary">
                              <ChatDotRound />
                            </ElIcon>
                            开始对话
                          </ElDropdownItem>
                          <ElDropdownItem @click="openMoveDialog(item)">
                            <ElIcon class="color-secondary"><Rank /></ElIcon>
                            转移到
                          </ElDropdownItem>
                          <ElDropdownItem @click="openCopyDialog(item)">
                            <ElIcon class="color-secondary">
                              <CopyDocument />
                            </ElIcon>
                            复制
                          </ElDropdownItem>
                          <ElDropdownItem @click="exportApplicationFile(item)">
                            <ElIcon class="color-secondary">
                              <Download />
                            </ElIcon>
                            导出
                          </ElDropdownItem>
                          <ElDropdownItem
                            divided
                            @click="removeApplication(item)"
                          >
                            <ElIcon class="color-secondary"><Delete /></ElIcon>
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
        </main>
      </section>

      <ElDialog
        v-model="dialogOpen"
        :title="
          normalizeAppType(form.type) === 'WORK_FLOW'
            ? '创建工作流应用'
            : '创建应用'
        "
        width="650px"
        :close-on-click-modal="false"
      >
        <ElForm label-position="top" :model="form">
          <ElFormItem label="应用名称" required>
            <ElInput
              v-model="form.name"
              maxlength="64"
              placeholder="请输入应用名称"
              show-word-limit
            />
          </ElFormItem>
          <ElFormItem label="描述">
            <ElInput
              v-model="form.description"
              type="textarea"
              :rows="3"
              maxlength="256"
              placeholder="请输入应用描述"
              show-word-limit
            />
          </ElFormItem>
          <!-- Workflow template selection (blank / assistant), mirrors MaxKB -->
          <ElFormItem
            v-if="normalizeAppType(form.type) === 'WORK_FLOW'"
            label="工作流模板"
          >
            <div class="template-cards">
              <div
                class="template-card"
                :class="{
                  'template-card--active': workflowTemplate === 'blank',
                }"
                @click="selectWorkflowTemplate('blank')"
              >
                <span class="create-option__icon simple">空</span>
                <strong>空白应用</strong>
              </div>
              <div
                class="template-card"
                :class="{
                  'template-card--active': workflowTemplate === 'assistant',
                }"
                @click="selectWorkflowTemplate('assistant')"
              >
                <span class="create-option__icon advanced">助</span>
                <strong>助手应用</strong>
              </div>
            </div>
          </ElFormItem>
        </ElForm>
        <template #footer>
          <ElButton :loading="saving" @click="dialogOpen = false">
            取消
          </ElButton>
          <ElButton type="primary" :loading="saving" @click="saveApplication">
            创建
          </ElButton>
        </template>
      </ElDialog>

      <!-- Copy Application Dialog -->
      <ElDialog
        v-model="copyDialogOpen"
        title="复制应用"
        width="650px"
        :close-on-click-modal="false"
      >
        <ElForm label-position="top" :model="copyForm">
          <ElFormItem label="应用名称" required>
            <ElInput
              v-model="copyForm.name"
              maxlength="64"
              placeholder="请输入应用名称"
              show-word-limit
            />
          </ElFormItem>
          <ElFormItem label="描述">
            <ElInput
              v-model="copyForm.description"
              type="textarea"
              :rows="3"
              maxlength="256"
              placeholder="请输入应用描述"
              show-word-limit
            />
          </ElFormItem>
        </ElForm>
        <template #footer>
          <ElButton :loading="copying" @click="copyDialogOpen = false">
            取消
          </ElButton>
          <ElButton
            type="primary"
            :loading="copying"
            @click="confirmCopyApplication"
          >
            复制
          </ElButton>
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

      <ElDialog
        v-model="folderDialogOpen"
        :title="folderDialogMode === 'edit' ? '编辑文件夹' : '创建文件夹'"
        width="420px"
      >
        <ElForm label-width="80px" @submit.prevent>
          <ElFormItem label="文件夹名">
            <ElInput
              v-model="folderForm.name"
              placeholder="请输入文件夹名称"
              @keyup.enter="saveFolder"
            />
          </ElFormItem>
        </ElForm>
        <template #footer>
          <ElButton @click="folderDialogOpen = false">取消</ElButton>
          <ElButton type="primary" @click="saveFolder">
            {{ folderDialogMode === 'edit' ? '确定' : '添加' }}
          </ElButton>
        </template>
      </ElDialog>

      <!-- Folder Move Dialog -->
      <ElDialog v-model="folderMoveDialogOpen" title="转移到" width="460px">
        <ElForm label-width="90px">
          <ElFormItem label="当前目录">
            <ElInput :model-value="folderDisplayName(movingFolder)" disabled />
          </ElFormItem>
          <ElFormItem label="目标目录">
            <ElSelect
              v-model="folderMoveForm.parent_id"
              clearable
              filterable
              placeholder="请选择目标目录"
              style="width: 100%"
            >
              <ElOption
                v-for="item in folderMoveOptions"
                :key="item.id === '' ? 'root' : item.id"
                :label="item.name"
                :value="item.id"
              />
            </ElSelect>
          </ElFormItem>
        </ElForm>
        <template #footer>
          <ElButton @click="folderMoveDialogOpen = false">取消</ElButton>
          <ElButton type="primary" @click="saveFolderMove">确定</ElButton>
        </template>
      </ElDialog>

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
  --app-folder-pane-width: clamp(260px, 18vw, 320px);

  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  height: 100%;
  overflow: hidden;
  background: var(--app-page-bg);
}

.application-management-shell {
  display: grid;
  flex: 1;
  grid-template-columns: var(--app-folder-pane-width) minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
  background: var(--app-panel-bg);
  border: 1px solid var(--app-border-color);
  border-radius: var(--app-radius);
}

.application-folder-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: var(--app-space-4) var(--app-space-2) var(--app-space-3);
  overflow: hidden;
  border-right: 1px solid var(--app-border-color);
}

.folder-pane-header {
  display: flex;
  flex-shrink: 0;
  gap: var(--app-space-2);
  align-items: center;
  padding: var(--app-space-1) var(--app-space-2) var(--app-space-3);
}

.folder-pane-header h4 {
  margin: 0;
  font-size: calc(var(--el-font-size-base) * 1.25);
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.application-folder-tree {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: transparent;
}

.application-folder-tree :deep(.el-tree-node__content) {
  height: 36px;
  border-radius: var(--app-radius);
}

.application-folder-tree :deep(.el-tree-node__content:hover) {
  background: var(--el-fill-color-lighter);
}

.application-folder-tree
  :deep(.el-tree-node.is-current > .el-tree-node__content) {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.folder-node {
  display: flex;
  flex: 1;
  gap: var(--app-space-2);
  align-items: center;
  justify-content: space-between;
  min-width: 0;
}

.folder-node__main {
  display: inline-flex;
  gap: var(--app-space-2);
  align-items: center;
  min-width: 0;
}

.folder-node__icon {
  flex-shrink: 0;
  width: calc(var(--el-font-size-base) * 1.25);
  height: calc(var(--el-font-size-base) * 1.25);
  color: var(--el-color-warning);
}

.folder-node__label {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: calc(var(--el-font-size-base) * 0.875);
  white-space: nowrap;
}

.application-folder-tree
  :deep(.el-tree-node.is-current > .el-tree-node__content .folder-node__label) {
  font-weight: 600;
  color: var(--el-color-primary);
}

.folder-node__actions {
  flex-shrink: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--el-transition-duration);
}

.application-folder-tree
  :deep(.el-tree-node__content:hover .folder-node__actions),
.application-folder-tree
  :deep(
    .el-tree-node.is-current > .el-tree-node__content .folder-node__actions
  ),
.folder-node:focus-within .folder-node__actions {
  pointer-events: auto;
  opacity: 1;
}

.folder-node__more {
  width: calc(var(--app-space-4) + var(--app-space-2));
  height: calc(var(--app-space-4) + var(--app-space-2));
  color: var(--el-text-color-secondary);
}

.folder-node__more:hover {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.folder-action-menu__item {
  display: inline-flex;
  gap: var(--app-space-3);
  align-items: center;
}

.folder-action-menu__icon {
  width: calc(var(--el-font-size-base) * 1.125);
  height: calc(var(--el-font-size-base) * 1.125);
  color: var(--el-text-color-secondary);
}

.application-list-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.application-list-header {
  display: flex;
  flex-shrink: 0;
  gap: var(--app-space-2);
  align-items: center;
  padding: var(--app-space-3) var(--app-space-4);
  border-bottom: 1px solid var(--app-border-color);
}

.breadcrumb-link {
  color: var(--el-color-primary);
  cursor: pointer;
}

.breadcrumb-link:hover {
  text-decoration: underline;
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
  min-height: var(--app-toolbar-height, 66px);
  padding: var(--app-space-3) var(--app-space-4);
  margin: var(--app-space-3) var(--app-space-4) 0;
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
.publish-time,
.create-option small {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}

.toolbar-actions,
.filter-bar,
.batch-strip,
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

.filter-bar .filter-search-type {
  width: 100px;
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
  margin: 0 var(--app-space-4);
}

.application-content {
  flex: 1;
  min-height: 0;
  padding: var(--app-space-4);
  margin: var(--app-space-3) var(--app-space-4);
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
  margin: 0 var(--app-space-4) var(--app-space-3);
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
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: var(--app-card-min-width);
  min-height: var(--app-card-min-height);
  padding: 16px;
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
  box-shadow: 0 4px 12px rgb(0 0 0 / 8%);
}

.card-header {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: -5px;
}

.card-icon {
  flex-shrink: 0;
}

.card-title-area {
  flex: 1;
  min-width: 0;
}

.card-title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.card-subtitle {
  display: flex;
  gap: 4px;
  align-items: center;
  margin-top: 2px;
  font-size: 12px;
  line-height: 20px;
  color: var(--el-text-color-secondary);
}

.card-creator {
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-subtitle-sep {
  margin: 0 4px;
}

.card-status-tag {
  position: absolute;
  top: 14px;
  right: 16px;
}

.card-batch-check {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 1;
}

.card-description {
  display: -webkit-box;
  min-height: 44px;
  margin-top: 12px;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 14px;
  line-height: 22px;
  color: var(--el-text-color-secondary);
  -webkit-box-orient: vertical;
}

.card-footer {
  position: absolute;
  right: 0;
  bottom: 8px;
  left: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  min-height: 30px;
  padding: 0 16px;
  font-size: 14px;
  line-height: 20px;
}

.card-footer-left {
  position: absolute;
  left: 16px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.card-footer-default {
  opacity: 1;
  transition: opacity var(--el-transition-duration);
}

.application-card:hover .card-footer-default {
  pointer-events: none;
  opacity: 0;
}

.card-publish-icon {
  font-size: 16px;
}

.card-publish-icon.published {
  color: var(--el-color-success);
}

.card-publish-icon.unpublished {
  color: var(--el-text-color-secondary);
}

.card-footer-text {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.card-hover-actions {
  position: absolute;
  right: 16px;
  display: flex;
  gap: 0;
  align-items: center;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--el-transition-duration);
}

.application-card:hover .card-hover-actions {
  pointer-events: auto;
  opacity: 1;
}

.application-card:hover .card-hover-actions:focus-within {
  pointer-events: auto;
  opacity: 1;
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

.create-option__icon.folder {
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-7);
}

.app-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  .application-management-shell {
    grid-template-columns: 1fr;
  }

  .application-folder-pane {
    display: none;
  }

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
