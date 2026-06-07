<script setup lang="ts">
import type { UploadFile, UploadUserFile } from 'element-plus';

import type {
  KnowledgeFolderRequest,
  KnowledgeRequest,
} from '#/api/ai/knowledge';

import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { confirm, Page } from '@vben/common-ui';
import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import {
  ArrowLeft,
  Check,
  CircleCheckFilled,
  CircleCloseFilled,
  Delete,
  EditPen,
  Files,
  FolderAdd,
  FolderOpened,
  Loading,
  MoreFilled,
  Notebook,
  Plus,
  Rank,
  Reading,
  Search,
  Sort,
  Upload as UploadIcon,
  WarningFilled,
} from '@element-plus/icons-vue';
import {
  ElAlert,
  ElAnchor,
  ElAnchorLink,
  ElButton,
  ElCard,
  ElCascaderPanel,
  ElCheckbox,
  ElDialog,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElMenu,
  ElMenuItem,
  ElMessage,
  ElOption,
  ElPagination,
  ElPopover,
  ElRadio,
  ElRadioGroup,
  ElScrollbar,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
  ElTag,
  ElTree,
  ElUpload,
} from 'element-plus';

import {
  batchDeleteKnowledge,
  batchMoveKnowledge,
  createDocument,
  createDocumentFromFile,
  createKnowledge,
  createKnowledgeFolder,
  createParagraph,
  createProblem,
  createTag,
  createTerm,
  deleteDocument,
  deleteKnowledge,
  deleteKnowledgeFolder,
  deleteParagraph,
  deleteProblem,
  deleteTag,
  deleteTerm,
  exportKnowledge as exportKnowledgeApi,
  getKnowledge,
  getKnowledgeStats,
  importKnowledge as importKnowledgeApi,
  pageDocuments,
  pageKnowledge,
  pageParagraphs,
  pageProblems,
  pageTags,
  pageTermbase,
  reembedDocument,
  reembedKnowledge,
  reembedParagraph,
  searchKnowledge,
  treeKnowledge,
  updateDocument,
  updateKnowledge,
  updateKnowledgeFolder,
  updateParagraph,
  updateProblem,
  updateTag,
  updateTerm,
} from '#/api/ai/knowledge';
import { adaptationUrl } from '#/utils/other';

import {
  prettyJson,
  recordsOf,
  safeParseJson,
  statusType,
  totalOf,
} from '../utils';
import LocalModelSelect from '../workflow/designer/nodes/base-node/component/LocalModelSelect.vue';
import TagDrawer from './components/TagDrawer.vue';
import TagSettingDrawer from './components/TagSettingDrawer.vue';

type Id = number | string;
type DialogMode =
  | 'document'
  | 'knowledge'
  | 'paragraph'
  | 'problem'
  | 'tag'
  | 'term';
type DetailTab = 'documents' | 'problems' | 'search' | 'setting' | 'terms';
type SearchMode = 'blend' | 'embedding' | 'keywords';
type DocumentCreateMode = 'file' | 'text';
type DocumentEnabledFilter = 'all' | boolean;
type DocumentUploadTab = 'qa' | 'table' | 'text-file';
type DocumentVectorStatus =
  | 'CANCELED'
  | 'EMBEDDING'
  | 'FAILED'
  | 'PARSING'
  | 'SUCCESS'
  | 'WAITING';
type DocumentVectorStatusKey = 'UNKNOWN' | DocumentVectorStatus;
type FolderSortType =
  | 'createTimeAsc'
  | 'createTimeDesc'
  | 'nameAsc'
  | 'nameDesc';
type KnowledgeType = 'BASE' | 'WEB' | 'WORKFLOW';

interface DocumentTagValue extends Record<string, unknown> {
  doc_count?: number;
  docCount?: number;
  id?: Id;
  value?: string;
}

interface DocumentTagGroup extends Record<string, unknown> {
  key?: string;
  values?: DocumentTagValue[];
}

interface TagFilterOption extends Record<string, unknown> {
  children?: TagFilterOption[];
  label: string;
  value: 'NO_TAG' | Id;
}

interface KnowledgeRecord extends Record<string, unknown> {
  charLength?: number;
  char_length?: number;
  createBy?: string;
  createTime?: string;
  createUser?: string;
  create_by?: string;
  create_time?: string;
  create_user?: string;
  description?: string;
  documentCount?: number;
  document_count?: number;
  enabled?: boolean;
  embeddingModelId?: Id;
  embedding_model_id?: Id;
  fileCountLimit?: number;
  fileSizeLimit?: number;
  file_count_limit?: number;
  file_size_limit?: number;
  folderId?: Id;
  folder_id?: Id;
  id?: Id;
  isActive?: boolean;
  is_active?: boolean;
  name?: string;
  paragraphCount?: number;
  paragraph_count?: number;
  status?: string;
  title?: string;
  type?: number | string;
  updateTime?: string;
  update_time?: string;
  workspaceId?: string;
  workspace_id?: string;
}

interface KnowledgeFolder extends Record<string, unknown> {
  children?: KnowledgeFolder[];
  createTime?: string;
  create_time?: string;
  description?: string;
  id?: Id;
  name?: string;
  parentId?: Id;
  parent_id?: Id;
  updateTime?: string;
  update_time?: string;
  workspaceId?: string;
  workspace_id?: string;
}

interface FolderSortOption {
  divided?: boolean;
  label: string;
  value: FolderSortType;
}

interface FolderFormState {
  description: string;
  id?: Id;
  name: string;
  parent_id?: Id;
  workspace_id: string;
}

interface KnowledgeFormState {
  color: string;
  content: string;
  description: string;
  enabled: boolean;
  embedding_model_id: string;
  file_count_limit?: number;
  file_size_limit?: number;
  folder_id?: Id;
  tagKey: string;
  tagValue: string;
  name: string;
  selector: string;
  source_url: string;
  splitConfig: string;
  title: string;
  type: KnowledgeType;
  work_flow: string;
  workspace_id: string;
}

interface UploadedDocumentFile {
  fileName?: string;
  id?: Id;
  name?: string;
  original?: string;
  url?: string;
}

interface UploadResponse {
  code?: number;
  data?: UploadedDocumentFile;
  msg?: string;
}

interface CreateMenuItem {
  icon: typeof Notebook;
  iconClass: string;
  label: string;
  subtitle: string;
  type: KnowledgeType;
}

interface DetailNavigationItem {
  icon: typeof Notebook;
  label: string;
  subtitle: string;
  value: DetailTab;
}

const rootFolderId = '__root__';
const defaultDetailTab: DetailTab = 'documents';
const detailTabs = new Set<DetailTab>([
  'documents',
  'problems',
  'search',
  'setting',
  'terms',
]);
const documentSplitConfigTip =
  '默认使用后端智能分段，只有需要覆盖默认策略时填写。';
const documentUploadEmptyTip = '请选择或拖入一个文件，当前仅支持单文件导入。';
const documentUploadFormatText =
  '支持格式：TXT、Markdown、PDF、DOCX、HTML、XLS、XLSX、CSV';
const documentVectorStatuses: DocumentVectorStatus[] = [
  'WAITING',
  'PARSING',
  'EMBEDDING',
  'SUCCESS',
  'FAILED',
  'CANCELED',
];
const documentVectorStatusLabels: Record<DocumentVectorStatusKey, string> = {
  CANCELED: '已取消',
  EMBEDDING: '向量化中',
  FAILED: '失败',
  PARSING: '解析中',
  SUCCESS: '成功',
  UNKNOWN: '未知',
  WAITING: '等待中',
};
const documentVectorStatusClasses: Record<DocumentVectorStatusKey, string> = {
  CANCELED: 'is-canceled',
  EMBEDDING: 'is-processing',
  FAILED: 'is-failed',
  PARSING: 'is-processing',
  SUCCESS: 'is-success',
  UNKNOWN: 'is-unknown',
  WAITING: 'is-waiting',
};
const documentEnabledFilterOptions: Array<{
  label: string;
  value: DocumentEnabledFilter;
}> = [
  { label: '全部状态', value: 'all' },
  { label: '已启用', value: true },
  { label: '已停用', value: false },
];
const detailNavigationItems: DetailNavigationItem[] = [
  {
    icon: Files,
    label: '文档',
    subtitle: '上传、切分与向量化',
    value: 'documents',
  },
  {
    icon: Notebook,
    label: '问题',
    subtitle: '维护常见问答',
    value: 'problems',
  },
  { icon: Reading, label: '术语', subtitle: '配置专有名词', value: 'terms' },
  {
    icon: Search,
    label: '命中测试',
    subtitle: '验证召回效果',
    value: 'search',
  },
  {
    icon: EditPen,
    label: '设置',
    subtitle: '基础信息与来源',
    value: 'setting',
  },
];
const knowledgeTypeOptions: Array<{
  label: string;
  value: '' | KnowledgeType;
}> = [
  { label: '全部类型', value: '' },
  { label: '基础知识库', value: 'BASE' },
  { label: '网页知识库', value: 'WEB' },
  { label: '工作流知识库', value: 'WORKFLOW' },
];
const createMenuItems: CreateMenuItem[] = [
  {
    icon: Notebook,
    iconClass: 'is-create-blue',
    label: '基础知识库',
    subtitle: '上传文档、手动录入文本并向量化',
    type: 'BASE',
  },
  {
    icon: Reading,
    iconClass: 'is-create-green',
    label: '网页知识库',
    subtitle: '保存站点地址和选择器配置',
    type: 'WEB',
  },
  {
    icon: Rank,
    iconClass: 'is-create-orange',
    label: '工作流知识库',
    subtitle: '绑定知识处理工作流基础信息',
    type: 'WORKFLOW',
  },
];
const folderSortOptions: FolderSortOption[] = [
  { label: '按创建时间升序', value: 'createTimeAsc' },
  { label: '按创建时间降序', value: 'createTimeDesc' },
  { divided: true, label: '按名称升序', value: 'nameAsc' },
  { label: '按名称降序', value: 'nameDesc' },
];

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
const accessStore = useAccessStore();
const route = useRoute();
const router = useRouter();

const loading = ref(false);
const treeLoading = ref(false);
const detailLoading = ref(false);
const knowledgeList = ref<KnowledgeRecord[]>([]);
const folders = ref<KnowledgeFolder[]>([]);
const selectedKnowledge = ref<KnowledgeRecord>();
const selectedDocument = ref<KnowledgeRecord>();
const documents = ref<KnowledgeRecord[]>([]);
const paragraphs = ref<KnowledgeRecord[]>([]);
const problems = ref<KnowledgeRecord[]>([]);
const terms = ref<KnowledgeRecord[]>([]);
const tags = ref<KnowledgeRecord[]>([]);
const total = ref(0);
const folderSearchKeyword = ref('');
const folderSort = ref<FolderSortType>('createTimeDesc');
const activeFolder = ref<KnowledgeFolder>({
  id: rootFolderId,
  name: '全部知识库',
});
const batchMode = ref(false);
const selectedIds = ref<Id[]>([]);
const documentBatchMode = ref(false);
const documentSelectedIds = ref<Id[]>([]);
const paragraphBatchMode = ref(false);
const paragraphSelectedIds = ref<Id[]>([]);
const paragraphHoverId = ref<Id>();
const tagFilterValue = ref<Id[]>([]);
const query = reactive({
  current: 1,
  name: '',
  page: 1,
  size: 12,
  type: '' as '' | KnowledgeType,
  workspaceId: 'default',
});
const activeTab = ref<DetailTab>(defaultDetailTab);
const currentFolderId = computed(() =>
  isSyntheticRootFolder() ? undefined : idValue(activeFolder.value.id),
);
const isKnowledgeDetailRoute = computed(
  () => route.name === 'AiOrchestrationKnowledgeDetail',
);

const dialogOpen = ref(false);
const dialogMode = ref<DialogMode>('knowledge');
const editingRow = ref<KnowledgeRecord>();
const form = reactive<KnowledgeFormState>(createEmptyForm());
const searchForm = reactive({
  query: '',
  similarityThreshold: 0.2,
  topK: 5,
  searchMode: 'embedding' as SearchMode,
});
const searchResult = ref<unknown>();
const hitResults = computed(() => hitResultRecords(searchResult.value));
const documentCreateMode = ref<DocumentCreateMode>('text');
const documentUploadTab = ref<DocumentUploadTab>('text-file');
const documentAdvancedOpen = ref(false);
const documentQuery = reactive({ name: '' });
const documentEnabledFilter = ref<DocumentEnabledFilter>('all');
const paragraphQuery = reactive({
  keyword: '',
  searchType: 'title' as 'content' | 'title',
});
const paragraphTotal = ref(0);
const uploadedDocumentFile = ref<UploadedDocumentFile>();
const documentUploadList = ref<UploadUserFile[]>([]);
const documentUpdatingIds = ref<Id[]>([]);
const documentReembedPollTimer = ref<number>();
const documentReembedPollingActive = ref(false);
const tagDrawerRef = ref<InstanceType<typeof TagDrawer>>();
const tagSettingDrawerRef = ref<InstanceType<typeof TagSettingDrawer>>();

const folderDialogOpen = ref(false);
const folderDialogMode = ref<'create' | 'edit'>('create');
const folderForm = reactive<FolderFormState>({
  description: '',
  name: '',
  parent_id: '',
  workspace_id: query.workspaceId,
});
const folderMoveDialogOpen = ref(false);
const movingFolder = ref<KnowledgeFolder>();
const folderMoveForm = reactive<{ parent_id?: Id }>({ parent_id: undefined });
const moveDialogOpen = ref(false);
const moveIds = ref<Id[]>([]);
const moveForm = reactive<{ folder_id?: Id }>({ folder_id: undefined });

const documentUploadAction = computed(
  () => apiURL + adaptationUrl('/admin/sys-file/upload'),
);
const documentUploadHeaders = computed<Record<string, string>>(() => ({
  Authorization: `Bearer ${accessStore.accessToken}`,
}));
const visibleFolderTree = computed<KnowledgeFolder[]>(() => [
  {
    children: getVisibleFolders(folders.value),
    id: rootFolderId,
    name: '全部知识库',
  },
]);
const currentFolderSortLabel = computed(
  () =>
    folderSortOptions.find((item) => item.value === folderSort.value)?.label ||
    '排序',
);
const activeFolderPath = computed(() => {
  if (isSyntheticRootFolder()) return ['根目录'];
  const path = findFolderPath(folders.value, activeFolder.value.id);
  return path.length > 0
    ? ['根目录', ...path]
    : ['根目录', folderDisplayName(activeFolder.value)];
});
const pageSubtitle = computed(
  () =>
    `${folderDisplayName(activeFolder.value)} · ${knowledgeTypeLabel(query.type) || '全部类型'} · ${total.value} 个知识库`,
);
const folderOptions = computed(() => [
  { id: '', name: '根目录 / 全部知识库' },
  ...flattenFolders(folders.value),
]);
const tagGroups = computed<DocumentTagGroup[]>(() => {
  return normalizeDocumentTagGroups(tags.value);
});
const tagFilterOptions = computed<TagFilterOption[]>(() => [
  ...tagGroups.value.map((group) => ({
    children: (group.values || []).map((item) => ({
      label: stringValue(item.value, '-'),
      value:
        idValue(item.id) ?? tagValueFallbackFilterValue(group.key, item.value),
    })),
    label: stringValue(group.key, '未命名标签'),
    value: tagGroupFilterValue(group.key),
  })),
  { children: [], label: '无标签', value: 'NO_TAG' },
]);
const filteredDocuments = computed(() => documents.value);
const documentSelectionRows = computed(() =>
  filteredDocuments.value.filter(
    (row) => row.id !== undefined && documentSelectedIds.value.includes(row.id),
  ),
);
const currentDocumentIds = computed(() =>
  filteredDocuments.value
    .map((item) => idValue(item.id))
    .filter((id): id is Id => id !== undefined),
);
const isAllCurrentDocumentsSelected = computed(
  () =>
    currentDocumentIds.value.length > 0 &&
    currentDocumentIds.value.every((id) =>
      documentSelectedIds.value.includes(id),
    ),
);
const isCurrentDocumentSelectionIndeterminate = computed(() => {
  const currentSelectedCount = currentDocumentIds.value.filter((id) =>
    documentSelectedIds.value.includes(id),
  ).length;
  return (
    currentSelectedCount > 0 &&
    currentSelectedCount < currentDocumentIds.value.length
  );
});
const paragraphSelectionRows = computed(() =>
  paragraphs.value.filter(
    (row) =>
      row.id !== undefined && paragraphSelectedIds.value.includes(row.id),
  ),
);
const folderMoveOptions = computed<Array<{ id: Id; name: string }>>(() => {
  const movingFolderId = idValue(movingFolder.value?.id);
  const source =
    movingFolderId === undefined
      ? undefined
      : findFolderById(folders.value, movingFolderId) || movingFolder.value;
  const sourceId = idValue(source?.id);
  if (!source || sourceId === undefined) return [];
  const targetFolders = flattenFolders(folders.value)
    .filter((folder) => {
      const folderId = idValue(folder.id);
      return (
        folderId !== undefined &&
        folderId !== sourceId &&
        !containsFolderId(source, folderId)
      );
    })
    .map((folder) => ({
      id: idValue(folder.id) as Id,
      name: folder.name || '未命名文件夹',
    }));
  return [{ id: '', name: '根目录 / 全部知识库' }, ...targetFolders];
});
const selectedKnowledges = computed(() =>
  knowledgeList.value.filter(
    (item) => item.id !== undefined && selectedIds.value.includes(item.id),
  ),
);
const currentPageKnowledgeIds = computed(() =>
  knowledgeList.value
    .map((item) => idValue(item.id))
    .filter((id): id is Id => id !== undefined),
);
const isAllCurrentPageSelected = computed(
  () =>
    currentPageKnowledgeIds.value.length > 0 &&
    currentPageKnowledgeIds.value.every((id) => selectedIds.value.includes(id)),
);
const isCurrentPageSelectionIndeterminate = computed(() => {
  const currentSelectedCount = currentPageKnowledgeIds.value.filter((id) =>
    selectedIds.value.includes(id),
  ).length;
  return (
    currentSelectedCount > 0 &&
    currentSelectedCount < currentPageKnowledgeIds.value.length
  );
});
const folderDialogTitle = computed(() => {
  if (folderDialogMode.value === 'edit') return '编辑文件夹';
  return idValue(folderForm.parent_id) === undefined
    ? '添加文件夹'
    : '添加子文件夹';
});
const dialogTitle = computed(() => {
  if (dialogMode.value === 'knowledge') {
    return `${editingRow.value?.id ? '编辑' : '创建'}${knowledgeTypeLabel(form.type) || '知识库'}`;
  }
  if (dialogMode.value === 'document')
    return editingRow.value?.id ? '文档设置' : '上传文档';
  if (dialogMode.value === 'paragraph')
    return `${editingRow.value?.id ? '编辑' : '新增'}分段`;
  if (dialogMode.value === 'problem')
    return `${editingRow.value?.id ? '编辑' : '新增'}问题`;
  if (dialogMode.value === 'term')
    return `${editingRow.value?.id ? '编辑' : '新增'}术语`;
  return `${editingRow.value?.id ? '编辑' : '新增'}标签`;
});
const dialogWidth = computed(() =>
  dialogMode.value === 'document' ? '760px' : '680px',
);
const detailDrawerTitle = computed(() => {
  if (!selectedKnowledge.value) return '知识库详情';
  return `${knowledgeDisplayName(selectedKnowledge.value)} · ${knowledgeTypeLabel(selectedKnowledge.value.type)}`;
});
const uploadedDocumentFileName = computed(
  () =>
    getUploadedDocumentName(uploadedDocumentFile.value) ||
    documentUploadList.value[0]?.name ||
    '尚未选择文件',
);
const documentFileSizeLimit = computed(() =>
  numberValue(
    selectedKnowledge.value?.file_size_limit ??
      selectedKnowledge.value?.fileSizeLimit ??
      form.file_size_limit,
    100,
  ),
);
const documentFileCountLimit = computed(() =>
  numberValue(
    selectedKnowledge.value?.file_count_limit ??
      selectedKnowledge.value?.fileCountLimit ??
      form.file_count_limit,
    1,
  ),
);

function createEmptyForm(type: KnowledgeType = 'BASE'): KnowledgeFormState {
  return {
    color: '#409eff',
    content: '',
    description: '',
    enabled: true,
    embedding_model_id: '',
    file_count_limit: 50,
    file_size_limit: 100,
    folder_id: currentFolderId.value,
    tagKey: '',
    tagValue: '',
    name: '',
    selector: '',
    source_url: '',
    splitConfig: '',
    title: '',
    type,
    work_flow: '{}',
    workspace_id: query.workspaceId || 'default',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = '') {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string') return value;
  return `${value}`;
}

function parseTagName(name: unknown) {
  const value = stringValue(name).trim();
  if (!value) return { key: '标签', value: '未命名标签' };
  for (const separator of [' / ', ':', '：']) {
    const index = value.indexOf(separator);
    if (index > 0) {
      const key = value.slice(0, index).trim();
      const parsedValue = value.slice(index + separator.length).trim();
      if (key && parsedValue) return { key, value: parsedValue };
    }
  }
  return { key: '标签', value };
}

function tagDisplayName(key: string, value: string) {
  return `${key.trim()} / ${value.trim()}`;
}

function pushDocumentTagGroup(
  target: Map<string, DocumentTagGroup>,
  row: DocumentTagValue & { key: string },
) {
  const group = target.get(row.key) || { key: row.key, values: [] };
  group.values = [...(group.values || []), row];
  target.set(row.key, group);
}

function normalizeDocumentTagGroups(value: unknown): DocumentTagGroup[] {
  const records = recordsOf<KnowledgeRecord>(value);
  const grouped = new Map<string, DocumentTagGroup>();
  records.forEach((item) => {
    if (Array.isArray(item.values)) {
      const key = stringValue(item.key ?? item.name, '标签');
      item.values
        .filter((entry): entry is Record<string, unknown> => isRecord(entry))
        .forEach((entry) => {
          const parsed = parseTagName(entry.value ?? entry.name);
          pushDocumentTagGroup(grouped, {
            ...entry,
            id: idValue(entry.id),
            key,
            value: stringValue(entry.value ?? entry.name, parsed.value),
          });
        });
      if (item.values.length === 0 && key) {
        grouped.set(key, grouped.get(key) || { key, values: [] });
      }
      return;
    }
    const source = isRecord(item.tag) ? item.tag : item;
    const parsed = parseTagName(
      source.name ?? source.value ?? source.label ?? item.name,
    );
    pushDocumentTagGroup(grouped, {
      ...source,
      id: idValue(source.id ?? item.tagId ?? item.tag_id),
      key: parsed.key,
      value: parsed.value,
    });
  });
  return [...grouped.values()];
}

function tagGroupFilterValue(key: unknown) {
  return `group:${stringValue(key, '标签')}`;
}

function tagValueFallbackFilterValue(key: unknown, value: unknown) {
  return `${tagGroupFilterValue(key)}:${stringValue(value, '-')}`;
}

function isTagGroupFilterValue(value: Id) {
  return typeof value === 'string' && value.startsWith('group:');
}

function addTagId(target: Map<string, Id>, value: unknown) {
  const id = idValue(value);
  if (id === undefined || isTagGroupFilterValue(id)) return;
  target.set(`${id}`, id);
}

function selectedTagIds() {
  const selectedValues = new Set(
    tagFilterValue.value.map((value) => `${value}`),
  );
  const ids = new Map<string, Id>();

  tagFilterValue.value.forEach((value) => {
    if (value !== 'NO_TAG') addTagId(ids, value);
  });

  tagGroups.value.forEach((group) => {
    if (!selectedValues.has(tagGroupFilterValue(group.key))) return;
    (group.values || []).forEach((value) => addTagId(ids, value.id));
  });

  return [...ids.values()];
}

function isNoTagSelected() {
  return tagFilterValue.value.includes('NO_TAG');
}

function buildDocumentPageQuery() {
  const tagIds = selectedTagIds();
  const noTag = isNoTagSelected();
  const enabled =
    documentEnabledFilter.value === 'all'
      ? undefined
      : documentEnabledFilter.value;
  return {
    current: 1,
    enabled,
    name: documentQuery.name || undefined,
    noTag: noTag || undefined,
    no_tag: noTag || undefined,
    page: 1,
    size: 20,
    tagIds: tagIds.length > 0 ? tagIds : undefined,
    tag_ids: tagIds.length > 0 ? tagIds : undefined,
  };
}

function idValue(value: unknown): Id | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return value;
  return undefined;
}

function sameId(left: unknown, right: unknown) {
  const leftId = idValue(left);
  const rightId = idValue(right);
  return (
    leftId !== undefined &&
    rightId !== undefined &&
    `${leftId}` === `${rightId}`
  );
}

function normalizeDetailTab(value: unknown): DetailTab {
  return detailTabs.has(value as DetailTab)
    ? (value as DetailTab)
    : defaultDetailTab;
}

function routeKnowledgeId() {
  return idValue(route.query.knowledgeId);
}

function numberValue(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) return numericValue;
  }
  return fallback;
}

function booleanValue(value: unknown, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return fallback;
  return `${value}` !== 'false';
}

function normalizeKnowledgeType(type?: unknown): KnowledgeType {
  if (typeof type === 'number') {
    if (type === 1) return 'WEB';
    if (type === 4) return 'WORKFLOW';
    return 'BASE';
  }
  const value = stringValue(type, 'BASE').toUpperCase();
  if (['1', 'WEB', 'WEB_KNOWLEDGE'].includes(value)) return 'WEB';
  if (['4', 'WORK_FLOW', 'WORKFLOW', 'WORKFLOW_KNOWLEDGE'].includes(value))
    return 'WORKFLOW';
  return 'BASE';
}

function knowledgeTypeLabel(type?: unknown) {
  const value = normalizeKnowledgeType(type);
  if (value === 'WEB') return '网页知识库';
  if (value === 'WORKFLOW') return '工作流知识库';
  return '基础知识库';
}

function knowledgeTypeTagType(type?: unknown) {
  const value = normalizeKnowledgeType(type);
  if (value === 'WEB') return 'success';
  if (value === 'WORKFLOW') return 'warning';
  return 'primary';
}

function knowledgeTypeSubtitle(type?: unknown) {
  const value = normalizeKnowledgeType(type);
  if (value === 'WEB') return '通过网页地址与选择器抓取知识内容';
  if (value === 'WORKFLOW') return '通过工作流 JSON 定义知识处理链路';
  return '通过文档、文本和分段维护基础知识';
}

function knowledgeTypeClass(type?: unknown) {
  const value = normalizeKnowledgeType(type);
  if (value === 'WEB') return 'is-web';
  if (value === 'WORKFLOW') return 'is-workflow';
  return 'is-base';
}

function knowledgeDisplayName(row?: KnowledgeRecord) {
  return stringValue(row?.name || row?.title || row?.id, '未命名知识库');
}

function knowledgeDescription(row?: KnowledgeRecord) {
  return stringValue(
    row?.description || row?.desc,
    '暂无描述，点击编辑补充用途、数据来源或维护人。',
  );
}

function knowledgeCreator(row?: KnowledgeRecord) {
  return stringValue(
    row?.createUser ??
      row?.create_user ??
      row?.createBy ??
      row?.create_by ??
      row?.creator,
  );
}

function knowledgeDate(row?: KnowledgeRecord) {
  return stringValue(
    row?.createTime ?? row?.create_time ?? row?.updateTime ?? row?.update_time,
  );
}

function knowledgeSecondaryLine(row?: KnowledgeRecord) {
  const creator = knowledgeCreator(row);
  const date = knowledgeDate(row);
  if (creator && date) return `${creator} 创建于 ${date}`;
  if (creator) return creator;
  if (date) return `创建于 ${date}`;
  return `工作空间 ${knowledgeWorkspaceId(row)}`;
}

function knowledgeWorkspaceId(row?: KnowledgeRecord) {
  return stringValue(row?.workspace_id ?? row?.workspaceId, 'default');
}

function knowledgeFolderId(row?: KnowledgeRecord) {
  return idValue(row?.folder_id ?? row?.folderId);
}

function normalizeKnowledgeDetail(
  data: unknown,
  fallbackId?: Id,
): KnowledgeRecord | undefined {
  let source = data;
  if (isRecord(data)) {
    if (isRecord(data.knowledge)) source = data.knowledge;
    else if (isRecord(data.data)) source = data.data;
  }
  if (!isRecord(source)) return undefined;
  return {
    ...source,
    id: idValue(source.id) ?? fallbackId,
  };
}

function knowledgeEnabled(row?: KnowledgeRecord) {
  return booleanValue(row?.enabled ?? row?.isActive ?? row?.is_active, true);
}

function knowledgeDocumentCount(row?: KnowledgeRecord) {
  return numberValue(
    row?.document_count ?? row?.documentCount ?? row?.documentsCount,
  );
}

function knowledgeParagraphCount(row?: KnowledgeRecord) {
  return numberValue(
    row?.paragraph_count ?? row?.paragraphCount ?? row?.paragraphsCount,
  );
}

function knowledgeCharCount(row?: KnowledgeRecord) {
  return numberValue(
    row?.char_length ??
      row?.charLength ??
      row?.characterCount ??
      row?.character_count ??
      row?.charCount,
  );
}

function documentDisplayName(row?: KnowledgeRecord) {
  return stringValue(row?.name ?? row?.title ?? row?.id, '未命名文档');
}

function documentCharLength(row?: KnowledgeRecord) {
  return numberValue(
    row?.char_length ??
      row?.charLength ??
      row?.characterCount ??
      row?.character_count,
  );
}

function documentParagraphCount(row?: KnowledgeRecord) {
  return numberValue(
    row?.paragraph_count ?? row?.paragraphCount ?? row?.paragraphsCount,
  );
}

function documentTagCount(row?: KnowledgeRecord) {
  const tags = row?.tags;
  if (Array.isArray(tags)) return tags.length;
  return numberValue(row?.tag_count ?? row?.tagCount);
}

function documentTagDisplayList(row?: KnowledgeRecord) {
  const tags = row?.tags;
  if (Array.isArray(tags) && tags.length > 0) {
    return tags
      .map((tag) => {
        if (!isRecord(tag)) return stringValue(tag);
        const key = stringValue(tag.key ?? tag.name ?? tag.label);
        const value = stringValue(tag.value);
        if (key && value && key !== value) return `${key} / ${value}`;
        return stringValue(tag.name ?? tag.label ?? tag.value ?? tag.key);
      })
      .filter(Boolean);
  }
  const count = documentTagCount(row);
  return count > 0 ? [`${count} 个标签`] : [];
}

function documentHiddenTagCount(row?: KnowledgeRecord) {
  const count = documentTagDisplayList(row).length;
  return count > 3 ? count - 3 : 0;
}

function documentStatusText(row?: KnowledgeRecord) {
  return stringValue(
    row?.status ?? row?.embeddingStatus ?? row?.embedding_status,
    '-',
  );
}

function documentStatusRawText(row?: KnowledgeRecord) {
  return stringValue(
    row?.status ?? row?.embeddingStatus ?? row?.embedding_status,
  ).trim();
}

function normalizeDocumentVectorStatus(
  row?: KnowledgeRecord,
): DocumentVectorStatusKey {
  const status = documentStatusRawText(row).toUpperCase();
  const matchedStatus = documentVectorStatuses.find((item) => item === status);
  return matchedStatus || 'UNKNOWN';
}

function numberMetaValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function documentStatusMetaText(
  row?: KnowledgeRecord,
  status: DocumentVectorStatusKey = normalizeDocumentVectorStatus(row),
) {
  const meta = row?.status_meta ?? row?.statusMeta;
  if (isRecord(meta)) {
    const progress = numberMetaValue(
      meta.progress ?? meta.percent ?? meta.percentage,
    );
    if (progress !== undefined) {
      const progressPercent =
        progress <= 1 ? Math.round(progress * 100) : Math.round(progress);
      return `进度 ${progressPercent}%`;
    }
    const current = numberMetaValue(
      meta.current ?? meta.currentStep ?? meta.current_step,
    );
    const total = numberMetaValue(
      meta.total ?? meta.totalStep ?? meta.total_step,
    );
    if (current !== undefined && total !== undefined && total > 0)
      return `进度 ${current}/${total}`;
    const message = stringValue(
      meta.message ??
        meta.error ??
        meta.reason ??
        meta.step ??
        meta.taskName ??
        meta.task_name,
    ).trim();
    if (message) return message;
  }
  const paragraphCount = documentParagraphCount(row);
  if (status === 'SUCCESS') return `${paragraphCount} 个分段已完成`;
  if (status === 'FAILED')
    return paragraphCount > 0
      ? `${paragraphCount} 个分段保留，处理失败`
      : '处理失败，请检查文件内容';
  if (status === 'CANCELED')
    return paragraphCount > 0
      ? `${paragraphCount} 个分段保留，已取消`
      : '任务已取消';
  if (status === 'WAITING')
    return paragraphCount > 0
      ? `${paragraphCount} 个分段待处理`
      : '等待解析与向量化';
  if (status === 'PARSING')
    return paragraphCount > 0
      ? `已解析 ${paragraphCount} 个分段`
      : '正在解析文件';
  if (status === 'EMBEDDING')
    return paragraphCount > 0
      ? `${paragraphCount} 个分段向量化中`
      : '正在生成向量';
  return documentStatusText(row);
}

function documentVectorStatus(row?: KnowledgeRecord) {
  const status = normalizeDocumentVectorStatus(row);
  return {
    className: documentVectorStatusClasses[status],
    label: documentVectorStatusLabels[status],
    metaText: documentStatusMetaText(row, status),
    rawText: documentStatusText(row),
    status,
  };
}

function isDocumentProcessing(row?: KnowledgeRecord) {
  return ['EMBEDDING', 'PARSING', 'WAITING'].includes(
    normalizeDocumentVectorStatus(row),
  );
}

function documentHitHandlingMethod(row?: KnowledgeRecord) {
  const value = stringValue(
    row?.hit_handling_method ?? row?.hitHandlingMethod ?? row?.hitMethod,
  );
  if (!value) return '-';
  const labels: Record<string, string> = {
    directly_return: '直接返回',
    optimization: '模型优化',
  };
  return labels[value] || value;
}

function documentEnabled(row?: KnowledgeRecord) {
  return booleanValue(row?.enabled ?? row?.isActive ?? row?.is_active, true);
}

function setDocumentEnabled(row: KnowledgeRecord, enabled: boolean) {
  row.enabled = enabled;
  row.isActive = enabled;
  row.is_active = enabled;
}

function setDocumentUpdating(documentId: Id, updating: boolean) {
  documentUpdatingIds.value = updating
    ? [...new Set([documentId, ...documentUpdatingIds.value])]
    : documentUpdatingIds.value.filter((id) => `${id}` !== `${documentId}`);
}

function isDocumentUpdating(row: KnowledgeRecord) {
  const documentId = idValue(row.id);
  return (
    documentId !== undefined &&
    documentUpdatingIds.value.some((id) => `${id}` === `${documentId}`)
  );
}

function rowUpdateTime(row?: KnowledgeRecord) {
  return stringValue(row?.update_time ?? row?.updateTime, '-');
}

function rowCreateTime(row?: KnowledgeRecord) {
  return stringValue(row?.create_time ?? row?.createTime, '-');
}

function documentRowKey(row: KnowledgeRecord) {
  return String(idValue(row.id) ?? documentDisplayName(row));
}

function documentTableRowClassName({ row }: { row: KnowledgeRecord }) {
  return isDocumentSelected(row) ? 'is-document-selected' : '';
}

function paragraphTitle(row?: KnowledgeRecord) {
  return stringValue(row?.title ?? row?.name, '-');
}

function paragraphContent(row?: KnowledgeRecord) {
  return stringValue(row?.content ?? row?.text, '-');
}

function paragraphVectorStatus(row?: KnowledgeRecord) {
  return stringValue(
    row?.embeddingStatus ??
      row?.embedding_status ??
      row?.vectorStatus ??
      row?.vector_status ??
      row?.status,
    '-',
  );
}

function hitScore(row?: KnowledgeRecord) {
  const score =
    row?.similarity ??
    row?.score ??
    row?.comprehensive_score ??
    row?.comprehensiveScore;
  if (typeof score === 'number' && Number.isFinite(score))
    return score.toFixed(3);
  return stringValue(score, '-');
}

function hitDocumentName(row?: KnowledgeRecord) {
  const document = row?.document;
  return stringValue(
    row?.document_name ??
      row?.documentName ??
      (isRecord(document) ? document.name : undefined),
    '-',
  );
}

function hitResultRecords(value: unknown) {
  const directRecords = recordsOf<KnowledgeRecord>(value);
  if (directRecords.length > 0) return directRecords;
  if (!isRecord(value)) return [];
  const candidates = [
    value.data,
    value.result,
    value.results,
    value.documents,
    value.paragraphs,
  ];
  for (const candidate of candidates) {
    const records = recordsOf<KnowledgeRecord>(candidate);
    if (records.length > 0) return records;
    if (isRecord(candidate)) {
      const nestedRecords = recordsOf<KnowledgeRecord>(
        candidate.documents ?? candidate.results ?? candidate.paragraphs,
      );
      if (nestedRecords.length > 0) return nestedRecords;
    }
  }
  return [];
}

function knowledgeIconText(row?: KnowledgeRecord) {
  return knowledgeDisplayName(row).slice(0, 1).toUpperCase();
}

function detailNavigationCount(tab: DetailTab) {
  if (tab === 'documents') return documents.value.length;
  if (tab === 'problems') return problems.value.length;
  if (tab === 'terms') return terms.value.length;
  return undefined;
}

function folderDisplayName(folder?: KnowledgeFolder) {
  if (folder?.id === rootFolderId) return '根目录';
  return stringValue(folder?.name || folder?.id, '未命名文件夹');
}

function normalizeFolderSearchText(value: unknown) {
  return stringValue(value).trim().toLocaleLowerCase();
}

function folderTimestamp(folder: KnowledgeFolder) {
  const rawValue = folder.create_time ?? folder.createTime;
  const time = Date.parse(stringValue(rawValue));
  return Number.isNaN(time) ? 0 : time;
}

function compareFolderNames(left: KnowledgeFolder, right: KnowledgeFolder) {
  const nameCompare = folderDisplayName(left).localeCompare(
    folderDisplayName(right),
    'zh-CN',
    {
      numeric: true,
    },
  );
  if (nameCompare !== 0) return nameCompare;
  return stringValue(left.id).localeCompare(stringValue(right.id), 'zh-CN', {
    numeric: true,
  });
}

function compareFolders(left: KnowledgeFolder, right: KnowledgeFolder) {
  if (folderSort.value === 'nameAsc') return compareFolderNames(left, right);
  if (folderSort.value === 'nameDesc') return compareFolderNames(right, left);
  const timeCompare = folderTimestamp(left) - folderTimestamp(right);
  if (timeCompare !== 0) {
    return folderSort.value === 'createTimeAsc' ? timeCompare : -timeCompare;
  }
  return compareFolderNames(left, right);
}

function getVisibleFolders(list: KnowledgeFolder[]): KnowledgeFolder[] {
  const keyword = normalizeFolderSearchText(folderSearchKeyword.value);
  return list
    .map((folder) => ({
      ...folder,
      children: getVisibleFolders(folder.children || []),
    }))
    .filter(
      (folder) =>
        !keyword ||
        normalizeFolderSearchText(folderDisplayName(folder)).includes(
          keyword,
        ) ||
        (folder.children?.length || 0) > 0,
    )
    .toSorted(compareFolders);
}

function switchFolderSort(command: FolderSortType | number | object | string) {
  if (typeof command !== 'string') return;
  if (folderSortOptions.some((item) => item.value === command)) {
    folderSort.value = command as FolderSortType;
  }
}

function containsFolderId(folder: KnowledgeFolder, folderId?: Id): boolean {
  if (folderId === undefined) return false;
  if (folder.id === folderId) return true;
  return (folder.children || []).some((child) =>
    containsFolderId(child, folderId),
  );
}

function findFolderById(
  list: KnowledgeFolder[],
  folderId?: Id,
): KnowledgeFolder | undefined {
  if (folderId === undefined) return undefined;
  for (const folder of list) {
    if (folder.id === folderId) return folder;
    const child = findFolderById(folder.children || [], folderId);
    if (child) return child;
  }
  return undefined;
}

function flattenFolders(list: KnowledgeFolder[], depth = 0): KnowledgeFolder[] {
  return list.flatMap((folder) => [
    {
      ...folder,
      name: `${'　'.repeat(depth)}${folder.name || folder.id || '未命名文件夹'}`,
    },
    ...flattenFolders(folder.children || [], depth + 1),
  ]);
}

function findFolderPath(list: KnowledgeFolder[], folderId?: Id): string[] {
  if (folderId === undefined) return [];
  for (const item of list) {
    if (item.id === folderId) return [item.name || '未命名文件夹'];
    const childPath = findFolderPath(item.children || [], folderId);
    if (childPath.length > 0)
      return [item.name || '未命名文件夹', ...childPath];
  }
  return [];
}

function folderIdKey(value: unknown) {
  const id = idValue(value);
  return id === undefined ? undefined : `${id}`;
}

function folderParentKey(folder: KnowledgeFolder) {
  return folderIdKey(folder.parent_id ?? folder.parentId);
}

function folderContainsKey(
  folder: KnowledgeFolder,
  targetKey: string,
  visited = new Set<KnowledgeFolder>(),
): boolean {
  if (visited.has(folder)) return false;
  visited.add(folder);
  if (folderIdKey(folder.id) === targetKey) return true;
  return (folder.children || []).some((child) =>
    folderContainsKey(child, targetKey, visited),
  );
}

function appendFolderChild(parent: KnowledgeFolder, child: KnowledgeFolder) {
  const children = parent.children || [];
  parent.children = [...children, child];
}

function buildFolderHierarchy(list: KnowledgeFolder[]): KnowledgeFolder[] {
  const foldersById = new Map<string, KnowledgeFolder>();
  list.forEach((folder) => {
    const key = folderIdKey(folder.id);
    if (key !== undefined && !foldersById.has(key)) {
      foldersById.set(key, folder);
    }
  });

  const rootFolders: KnowledgeFolder[] = [];
  list.forEach((folder) => {
    const folderKey = folderIdKey(folder.id);
    const parentKey = folderParentKey(folder);
    const parent =
      parentKey === undefined ? undefined : foldersById.get(parentKey);
    if (
      parentKey === undefined ||
      parent === undefined ||
      folderKey === undefined ||
      parentKey === folderKey ||
      folderContainsKey(folder, parentKey)
    ) {
      rootFolders.push(folder);
      return;
    }
    appendFolderChild(parent, folder);
  });
  return rootFolders;
}

function normalizeFolders(list: unknown): KnowledgeFolder[] {
  if (!Array.isArray(list)) return [];
  const normalizedFolders = list
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => ({
      ...item,
      children: normalizeFolders(item.children),
      id: idValue(item.id),
      name: stringValue(item.name, '未命名文件夹'),
    }));
  return buildFolderHierarchy(normalizedFolders);
}

function isSyntheticRootFolder(folder: KnowledgeFolder = activeFolder.value) {
  return folder.id === rootFolderId;
}

function buildFolderPayload(parentId?: Id): KnowledgeFolderRequest {
  const payload: KnowledgeFolderRequest = {
    description: folderForm.description.trim(),
    name: folderForm.name.trim(),
    workspaceId: folderForm.workspace_id || query.workspaceId || 'default',
    workspace_id: folderForm.workspace_id || query.workspaceId || 'default',
  };
  if (parentId !== undefined) {
    payload.parentId = parentId;
    payload.parent_id = parentId;
  }
  return payload;
}

function buildKnowledgePayload(): KnowledgeRequest {
  const folderId = idValue(form.folder_id);
  const embeddingModelId = idValue(form.embedding_model_id);
  const payload: KnowledgeRequest = {
    description: form.description.trim(),
    enabled: form.enabled,
    folderId,
    folder_id: folderId,
    name: form.name.trim(),
    type: form.type,
    workspaceId: form.workspace_id || query.workspaceId || 'default',
    workspace_id: form.workspace_id || query.workspaceId || 'default',
  };
  if (embeddingModelId !== undefined) {
    payload.embeddingModelId = embeddingModelId;
    payload.embedding_model_id = embeddingModelId;
  }
  if (form.file_count_limit !== undefined) {
    payload.fileCountLimit = form.file_count_limit;
    payload.file_count_limit = form.file_count_limit;
  }
  if (form.file_size_limit !== undefined) {
    payload.fileSizeLimit = form.file_size_limit;
    payload.file_size_limit = form.file_size_limit;
  }
  if (form.type === 'WEB') {
    const sourceUrl = form.source_url.trim();
    payload.selector = form.selector.trim();
    payload.sourceUrl = sourceUrl;
    payload.source_url = sourceUrl;
  }
  if (form.type === 'WORKFLOW' && form.work_flow.trim()) {
    payload.workFlow = form.work_flow.trim();
    payload.work_flow = form.work_flow.trim();
  }
  return payload;
}

function treeFolderSource(data: unknown) {
  if (!isRecord(data)) return Array.isArray(data) ? data : recordsOf(data);
  const direct =
    data.folders ?? data.folderTree ?? data.folder_tree ?? data.children;
  if (Array.isArray(direct)) return direct;
  return recordsOf(data);
}

async function loadTree() {
  treeLoading.value = true;
  try {
    const data = await treeKnowledge({
      workspaceId: query.workspaceId,
      workspace_id: query.workspaceId,
    });
    folders.value = normalizeFolders(treeFolderSource(data));
    if (
      !isSyntheticRootFolder() &&
      !findFolderById(folders.value, activeFolder.value.id)
    ) {
      activeFolder.value = { id: rootFolderId, name: '全部知识库' };
    }
  } finally {
    treeLoading.value = false;
  }
}

async function loadKnowledge() {
  loading.value = true;
  try {
    const data = await pageKnowledge({
      current: query.current,
      folderId: currentFolderId.value,
      folder_id: currentFolderId.value,
      name: query.name || undefined,
      page: query.page,
      size: query.size,
      type: query.type || undefined,
      workspaceId: query.workspaceId || undefined,
      workspace_id: query.workspaceId || undefined,
    });
    knowledgeList.value = recordsOf<KnowledgeRecord>(data);
    total.value = totalOf(data);
    selectedIds.value = selectedIds.value.filter((id) =>
      knowledgeList.value.some((item) => item.id === id),
    );
    const selectedId = idValue(selectedKnowledge.value?.id);
    const updatedSelected = knowledgeList.value.find((item) =>
      sameId(item.id, selectedId),
    );
    if (updatedSelected) selectedKnowledge.value = updatedSelected;
    else if (!isKnowledgeDetailRoute.value) clearSelectedKnowledge();
  } finally {
    loading.value = false;
  }
}

async function refreshAll() {
  await Promise.all([loadTree(), loadKnowledge()]);
}

function clearSelectedKnowledge() {
  selectedKnowledge.value = undefined;
  selectedDocument.value = undefined;
  documents.value = [];
  paragraphs.value = [];
  paragraphTotal.value = 0;
  problems.value = [];
  terms.value = [];
  tags.value = [];
  documentBatchMode.value = false;
  documentSelectedIds.value = [];
  paragraphBatchMode.value = false;
  paragraphSelectedIds.value = [];
  tagFilterValue.value = [];
  searchResult.value = undefined;
}

async function openKnowledgeDetail(
  row: KnowledgeRecord,
  tab: DetailTab = defaultDetailTab,
) {
  if (batchMode.value) {
    toggleSelection(row, !isSelected(row));
    return;
  }
  const knowledgeId = idValue(row.id);
  if (knowledgeId === undefined) {
    ElMessage.warning('知识库 ID 无效');
    return;
  }
  await router.push({
    name: 'AiOrchestrationKnowledgeDetail',
    query: { knowledgeId, tab: normalizeDetailTab(tab) },
  });
}

function backToKnowledgeList() {
  router.push({ name: 'AiOrchestrationKnowledge' });
}

async function loadDetailKnowledge(knowledgeId: Id) {
  const listRow = knowledgeList.value.find((item) =>
    sameId(item.id, knowledgeId),
  );
  if (listRow) {
    selectedKnowledge.value = listRow;
    return;
  }
  const detail = normalizeKnowledgeDetail(
    await getKnowledge(knowledgeId),
    knowledgeId,
  );
  if (detail) selectedKnowledge.value = detail;
}

function prepareDetailSettingForm() {
  if (!selectedKnowledge.value) return;
  editingRow.value = selectedKnowledge.value;
  resetForm('knowledge', selectedKnowledge.value);
}

async function syncDetailRouteState() {
  if (!isKnowledgeDetailRoute.value) {
    clearSelectedKnowledge();
    return;
  }
  const knowledgeId = routeKnowledgeId();
  activeTab.value = normalizeDetailTab(route.query.tab);
  searchResult.value = undefined;
  if (knowledgeId === undefined) {
    clearSelectedKnowledge();
    return;
  }
  if (!sameId(selectedKnowledge.value?.id, knowledgeId)) {
    await loadDetailKnowledge(knowledgeId);
  }
  if (activeTab.value === 'setting') prepareDetailSettingForm();
  else await loadRelated();
}

async function handleDetailTabChange(tabName: number | string) {
  const nextTab = normalizeDetailTab(tabName);
  activeTab.value = nextTab;
  if (isKnowledgeDetailRoute.value && route.query.tab !== nextTab) {
    await router.replace({
      name: 'AiOrchestrationKnowledgeDetail',
      query: { ...route.query, tab: nextTab },
    });
  }
  if (nextTab === 'setting') prepareDetailSettingForm();
  else await loadRelated();
}

async function loadRelated() {
  const id = idValue(selectedKnowledge.value?.id);
  if (id === undefined) return;
  detailLoading.value = true;
  try {
    const [documentData, problemData, termData, tagData, statsData] =
      await Promise.all([
        pageDocuments(id, buildDocumentPageQuery()),
        pageProblems(id, { current: 1, page: 1, size: 20 }),
        pageTermbase(id, { current: 1, page: 1, size: 20 }),
        pageTags(id, { current: 1, page: 1, size: 20 }),
        getKnowledgeStats(id),
      ]);
    documents.value = recordsOf<KnowledgeRecord>(documentData);
    problems.value = recordsOf<KnowledgeRecord>(problemData);
    terms.value = recordsOf<KnowledgeRecord>(termData);
    tags.value = recordsOf<KnowledgeRecord>(tagData);
    mergeSelectedKnowledgeStats(statsData);
    if (selectedDocument.value) {
      const selectedDocumentId = idValue(selectedDocument.value.id);
      const nextDocument = documents.value.find((item) =>
        sameId(item.id, selectedDocumentId),
      );
      if (nextDocument) selectedDocument.value = nextDocument;
      else {
        selectedDocument.value = undefined;
        paragraphs.value = [];
        paragraphTotal.value = 0;
        paragraphSelectedIds.value = [];
        paragraphBatchMode.value = false;
      }
    } else {
      selectedDocument.value = undefined;
      paragraphs.value = [];
      paragraphTotal.value = 0;
      paragraphSelectedIds.value = [];
      paragraphBatchMode.value = false;
    }
  } finally {
    detailLoading.value = false;
  }
}

async function selectDocument(row: KnowledgeRecord) {
  if (documentBatchMode.value) {
    const rowId = idValue(row.id);
    if (rowId === undefined) return;
    documentSelectedIds.value = documentSelectedIds.value.includes(rowId)
      ? documentSelectedIds.value.filter((id) => id !== rowId)
      : [...documentSelectedIds.value, rowId];
    return;
  }
  await openParagraphView(row);
}

async function loadDocumentsOnly() {
  const knowledgeId = idValue(selectedKnowledge.value?.id);
  if (knowledgeId === undefined) return;
  detailLoading.value = true;
  try {
    const data = await pageDocuments(knowledgeId, buildDocumentPageQuery());
    documents.value = recordsOf<KnowledgeRecord>(data);
    const stats = await getKnowledgeStats(knowledgeId);
    mergeSelectedKnowledgeStats(stats);
  } finally {
    detailLoading.value = false;
  }
}

function handleDocumentSearch() {
  documentSelectedIds.value = [];
  loadDocumentsOnly();
}

async function openParagraphView(row: KnowledgeRecord) {
  selectedDocument.value = row;
  paragraphQuery.keyword = '';
  paragraphQuery.searchType = 'title';
  paragraphBatchMode.value = false;
  paragraphSelectedIds.value = [];
  await loadParagraphs();
}

function backToDocumentTable() {
  selectedDocument.value = undefined;
  paragraphs.value = [];
  paragraphTotal.value = 0;
  paragraphBatchMode.value = false;
  paragraphSelectedIds.value = [];
}

async function loadParagraphs() {
  const knowledgeId = idValue(selectedKnowledge.value?.id);
  const documentId = idValue(selectedDocument.value?.id);
  if (knowledgeId === undefined || documentId === undefined) return;
  const keyword = paragraphQuery.keyword.trim();
  const data = await pageParagraphs(knowledgeId, documentId, {
    current: 1,
    page: 1,
    size: 30,
    ...(keyword ? { [paragraphQuery.searchType]: keyword } : {}),
  });
  paragraphs.value = recordsOf<KnowledgeRecord>(data);
  paragraphTotal.value = totalOf(data);
}

function handleParagraphSearch() {
  paragraphSelectedIds.value = [];
  loadParagraphs();
}

function toggleDocumentBatchMode(active: boolean) {
  documentBatchMode.value = active;
  documentSelectedIds.value = [];
}

function isDocumentSelected(row: KnowledgeRecord) {
  const rowId = idValue(row.id);
  return rowId !== undefined && documentSelectedIds.value.includes(rowId);
}

function handleDocumentCardCheckboxChange(
  row: KnowledgeRecord,
  checked: boolean,
) {
  const rowId = idValue(row.id);
  if (rowId === undefined) return;
  documentSelectedIds.value = checked
    ? [...new Set([rowId, ...documentSelectedIds.value])]
    : documentSelectedIds.value.filter((id) => id !== rowId);
}

function toggleCurrentDocumentSelection(checked: boolean) {
  documentSelectedIds.value = checked
    ? [...new Set([...currentDocumentIds.value, ...documentSelectedIds.value])]
    : documentSelectedIds.value.filter(
        (id) => !currentDocumentIds.value.includes(id),
      );
}

async function batchReembedDocuments() {
  const knowledgeId = idValue(selectedKnowledge.value?.id);
  if (knowledgeId === undefined || documentSelectedIds.value.length === 0)
    return;
  await Promise.all(
    documentSelectedIds.value.map((documentId) =>
      reembedDocument(knowledgeId, documentId, true),
    ),
  );
  ElMessage.success('已提交文档向量化');
  documentSelectedIds.value = [];
  documentBatchMode.value = false;
  await loadRelated();
  startDocumentReembedPolling();
}

async function batchDeleteDocuments() {
  const knowledgeId = idValue(selectedKnowledge.value?.id);
  if (knowledgeId === undefined || documentSelectedIds.value.length === 0)
    return;
  await confirm(
    `确认删除选中的 ${documentSelectedIds.value.length} 个文档？`,
  ).then(async () => {
    await Promise.all(
      documentSelectedIds.value.map((documentId) =>
        deleteDocument(knowledgeId, documentId),
      ),
    );
    ElMessage.success('文档已删除');
    documentSelectedIds.value = [];
    documentBatchMode.value = false;
    await loadRelated();
  });
}

function openDocumentTagSetting(row: KnowledgeRecord) {
  tagSettingDrawerRef.value?.open(row);
}

async function handleDocumentEnabledChange(
  row: KnowledgeRecord,
  value: boolean | number | string,
) {
  const knowledgeId = idValue(selectedKnowledge.value?.id);
  const documentId = idValue(row.id);
  if (knowledgeId === undefined || documentId === undefined) return;
  const nextEnabled = value === true;
  const previousEnabled = documentEnabled(row);
  if (nextEnabled === previousEnabled) return;
  setDocumentEnabled(row, nextEnabled);
  setDocumentUpdating(documentId, true);
  try {
    await updateDocument(knowledgeId, documentId, {
      enabled: nextEnabled,
    });
    ElMessage.success(nextEnabled ? '文档已启用' : '文档已停用');
    await loadDocumentsOnly();
  } catch {
    setDocumentEnabled(row, previousEnabled);
    ElMessage.error('文档启用状态更新失败');
  } finally {
    setDocumentUpdating(documentId, false);
  }
}

function tagFilterOptionsChange(value: unknown) {
  tagFilterValue.value = Array.isArray(value)
    ? value.filter(
        (item): item is Id =>
          typeof item === 'number' || typeof item === 'string',
      )
    : [];
  documentSelectedIds.value = [];
  loadDocumentsOnly();
}

function clearDocumentTagFilter() {
  tagFilterValue.value = [];
  documentSelectedIds.value = [];
  loadDocumentsOnly();
}

function handleDocumentEnabledFilterChange() {
  documentSelectedIds.value = [];
  loadDocumentsOnly();
}

function toggleParagraphBatchMode(active: boolean) {
  paragraphBatchMode.value = active;
  paragraphSelectedIds.value = [];
}

function handleParagraphSelectionChange(rowId: Id, checked: boolean) {
  paragraphSelectedIds.value = checked
    ? [...new Set([rowId, ...paragraphSelectedIds.value])]
    : paragraphSelectedIds.value.filter((id) => id !== rowId);
}

function isParagraphSelected(row: KnowledgeRecord) {
  const rowId = idValue(row.id);
  return rowId !== undefined && paragraphSelectedIds.value.includes(rowId);
}

function handleParagraphCheckboxChange(row: KnowledgeRecord, checked: boolean) {
  const rowId = idValue(row.id);
  if (rowId === undefined) return;
  handleParagraphSelectionChange(rowId, checked);
}

function enterParagraphRow(row: KnowledgeRecord) {
  paragraphHoverId.value = idValue(row.id);
}

function isParagraphHovered(row: KnowledgeRecord) {
  const rowId = idValue(row.id);
  return rowId !== undefined && paragraphHoverId.value === rowId;
}

function toggleCurrentParagraphSelection(checked: boolean) {
  const currentIds = paragraphs.value
    .map((item) => idValue(item.id))
    .filter((id): id is Id => id !== undefined);
  paragraphSelectedIds.value = checked
    ? [...new Set([...currentIds, ...paragraphSelectedIds.value])]
    : paragraphSelectedIds.value.filter((id) => !currentIds.includes(id));
}

async function batchReembedParagraphs() {
  const knowledgeId = idValue(selectedKnowledge.value?.id);
  const documentId = idValue(selectedDocument.value?.id);
  if (
    knowledgeId === undefined ||
    documentId === undefined ||
    paragraphSelectedIds.value.length === 0
  )
    return;
  await Promise.all(
    paragraphSelectedIds.value.map((paragraphId) =>
      reembedParagraph(knowledgeId, documentId, paragraphId),
    ),
  );
  ElMessage.success('已提交分段向量化');
  paragraphSelectedIds.value = [];
  paragraphBatchMode.value = false;
  await loadParagraphs();
}

async function batchDeleteParagraphs() {
  const knowledgeId = idValue(selectedKnowledge.value?.id);
  const documentId = idValue(selectedDocument.value?.id);
  if (
    knowledgeId === undefined ||
    documentId === undefined ||
    paragraphSelectedIds.value.length === 0
  )
    return;
  await confirm(
    `确认删除选中的 ${paragraphSelectedIds.value.length} 个分段？`,
  ).then(async () => {
    await Promise.all(
      paragraphSelectedIds.value.map((paragraphId) =>
        deleteParagraph(knowledgeId, documentId, paragraphId),
      ),
    );
    ElMessage.success('分段已删除');
    paragraphSelectedIds.value = [];
    paragraphBatchMode.value = false;
    await loadParagraphs();
  });
}

function openTagDrawer() {
  tagDrawerRef.value?.open();
}

function handleSearchModeChange(mode: boolean | number | string | undefined) {
  if (mode !== 'blend' && mode !== 'embedding' && mode !== 'keywords') return;
  if (mode === 'keywords') {
    searchForm.similarityThreshold = 0;
  } else if (searchForm.similarityThreshold === 0) {
    searchForm.similarityThreshold = 0.2;
  }
}

function handleSearch() {
  query.current = 1;
  query.page = 1;
  loadKnowledge();
}

function handlePageChange(page: number) {
  query.current = page;
  query.page = page;
  loadKnowledge();
}

function selectFolder(folder: KnowledgeFolder) {
  activeFolder.value = folder;
  query.current = 1;
  query.page = 1;
  selectedIds.value = [];
  loadKnowledge();
}

function resetFolderForm(parentId?: Id) {
  Object.assign(folderForm, {
    description: '',
    id: undefined,
    name: '',
    parent_id: parentId ?? '',
    workspace_id: query.workspaceId || 'default',
  });
}

function openCreateRootFolder() {
  folderDialogMode.value = 'create';
  resetFolderForm('');
  folderDialogOpen.value = true;
}

function openCreateSubFolder(folder: KnowledgeFolder = activeFolder.value) {
  if (isSyntheticRootFolder(folder)) {
    openCreateRootFolder();
    return;
  }
  folderDialogMode.value = 'create';
  resetFolderForm(folder.id);
  folderDialogOpen.value = true;
}

function openEditFolder(folder: KnowledgeFolder = activeFolder.value) {
  if (isSyntheticRootFolder(folder)) {
    ElMessage.warning('根目录不可编辑');
    return;
  }
  folderDialogMode.value = 'edit';
  Object.assign(folderForm, {
    description: stringValue(folder.description),
    id: folder.id,
    name: stringValue(folder.name),
    parent_id: idValue(folder.parent_id ?? folder.parentId) ?? '',
    workspace_id: stringValue(
      folder.workspace_id ?? folder.workspaceId,
      query.workspaceId || 'default',
    ),
  });
  folderDialogOpen.value = true;
}

async function saveFolder() {
  const name = folderForm.name.trim();
  if (!name) {
    ElMessage.warning('请输入文件夹名称');
    return;
  }
  const folderId = idValue(folderForm.id);
  const isEdit = folderDialogMode.value === 'edit';
  const parentId = idValue(folderForm.parent_id);
  if (isEdit && folderId === undefined) {
    ElMessage.warning('文件夹 ID 无效');
    return;
  }
  const saved = isEdit
    ? await updateKnowledgeFolder(folderId as Id, buildFolderPayload(parentId))
    : await createKnowledgeFolder(buildFolderPayload(parentId));
  const savedFolder = isRecord(saved) ? saved : undefined;
  const savedId = idValue(savedFolder?.id) ?? folderId;
  if (savedId !== undefined) {
    activeFolder.value = {
      ...(savedFolder || activeFolder.value),
      id: savedId,
      name,
    };
  }
  ElMessage.success(isEdit ? '文件夹已更新' : '文件夹已创建');
  folderDialogOpen.value = false;
  query.current = 1;
  query.page = 1;
  await refreshAll();
}

function openMoveFolder(folder: KnowledgeFolder) {
  if (isSyntheticRootFolder(folder)) {
    ElMessage.warning('根目录不可转移');
    return;
  }
  const folderId = idValue(folder.id);
  const source =
    folderId === undefined
      ? folder
      : findFolderById(folders.value, folderId) || folder;
  movingFolder.value = source;
  folderMoveForm.parent_id = idValue(source.parent_id ?? source.parentId) ?? '';
  folderMoveDialogOpen.value = true;
}

async function saveFolderMove() {
  const source = movingFolder.value;
  if (!source) return;
  const sourceId = idValue(source.id);
  if (sourceId === undefined) return;
  const movesToRoot = folderMoveForm.parent_id === '';
  const targetParentId = idValue(folderMoveForm.parent_id);
  const currentParentId = idValue(source.parent_id ?? source.parentId);
  if (!movesToRoot && targetParentId === undefined) {
    ElMessage.warning('请选择目标文件夹');
    return;
  }
  if (
    (movesToRoot && currentParentId === undefined) ||
    targetParentId === currentParentId
  ) {
    folderMoveDialogOpen.value = false;
    movingFolder.value = undefined;
    return;
  }
  const payload: KnowledgeFolderRequest = {
    description: stringValue(source.description),
    name: stringValue(source.name, '未命名文件夹'),
    workspaceId: stringValue(
      source.workspace_id ?? source.workspaceId,
      query.workspaceId || 'default',
    ),
    workspace_id: stringValue(
      source.workspace_id ?? source.workspaceId,
      query.workspaceId || 'default',
    ),
  };
  if (movesToRoot) {
    payload.clearParent = true;
    payload.clear_parent = true;
  } else {
    payload.parentId = targetParentId;
    payload.parent_id = targetParentId;
  }
  await updateKnowledgeFolder(sourceId, payload);
  ElMessage.success('文件夹已转移');
  folderMoveDialogOpen.value = false;
  movingFolder.value = undefined;
  await refreshAll();
}

function removeFolder(folder: KnowledgeFolder = activeFolder.value) {
  if (isSyntheticRootFolder(folder)) {
    ElMessage.warning('根目录不可删除');
    return;
  }
  const folderId = idValue(folder.id);
  if (folderId === undefined) return;
  confirm(
    `确认删除文件夹 ${folder.name || folderId}？该文件夹下的知识库会由后端移动到根目录，不会删除知识库内容。`,
  ).then(async () => {
    await deleteKnowledgeFolder(folderId);
    ElMessage.success('文件夹已删除');
    const sourceFolder = findFolderById(folders.value, folderId) || folder;
    if (containsFolderId(sourceFolder, activeFolder.value.id)) {
      activeFolder.value = { id: rootFolderId, name: '全部知识库' };
      selectedIds.value = [];
      query.current = 1;
      query.page = 1;
    }
    await refreshAll();
  });
}

function resetForm(
  mode: DialogMode,
  row?: KnowledgeRecord,
  type: KnowledgeType = 'BASE',
) {
  const nextType =
    mode === 'knowledge' ? normalizeKnowledgeType(row?.type ?? type) : 'BASE';
  const parsedTag = parseTagName(
    row?.name ?? row?.title ?? row?.value ?? row?.content,
  );
  Object.assign(form, createEmptyForm(nextType));
  Object.assign(form, {
    color: mode === 'tag' ? stringValue(row?.color, '#409eff') : '#409eff',
    content: stringValue(row?.content ?? row?.answer ?? row?.definition),
    description: stringValue(row?.description),
    enabled: booleanValue(
      row?.enabled ?? row?.isActive ?? row?.is_active,
      true,
    ),
    embedding_model_id: stringValue(
      row?.embedding_model_id ?? row?.embeddingModelId,
    ),
    file_count_limit: numberValue(
      row?.file_count_limit ?? row?.fileCountLimit,
      50,
    ),
    file_size_limit: numberValue(
      row?.file_size_limit ?? row?.fileSizeLimit,
      100,
    ),
    folder_id: knowledgeFolderId(row) ?? currentFolderId.value,
    tagKey:
      mode === 'tag'
        ? stringValue(row?.key ?? row?.tag_key, parsedTag.key)
        : '',
    tagValue:
      mode === 'tag'
        ? stringValue(row?.value ?? row?.tag_value, parsedTag.value)
        : '',
    name: stringValue(row?.name ?? row?.term),
    selector: stringValue(row?.selector),
    source_url: stringValue(row?.source_url ?? row?.sourceUrl),
    splitConfig: '',
    title: stringValue(row?.title ?? row?.question ?? row?.name),
    type: nextType,
    work_flow: prettyJson(row?.work_flow ?? row?.workFlow, '{}'),
    workspace_id: knowledgeWorkspaceId(row),
  });
  if (!row) form.workspace_id = query.workspaceId || 'default';
}

function openDialog(
  mode: DialogMode,
  row?: KnowledgeRecord,
  type: KnowledgeType = 'BASE',
) {
  dialogMode.value = mode;
  editingRow.value = row;
  resetForm(mode, row, type);
  if (mode === 'document') {
    documentCreateMode.value = 'file';
    documentUploadTab.value = 'text-file';
    documentAdvancedOpen.value = false;
    uploadedDocumentFile.value = undefined;
    documentUploadList.value = [];
  }
  dialogOpen.value = true;
}

function openCreateKnowledge(type: KnowledgeType) {
  openDialog('knowledge', undefined, type);
}

async function saveDialog() {
  const knowledgeId = idValue(selectedKnowledge.value?.id);
  if (dialogMode.value === 'knowledge') {
    if (!form.name.trim()) {
      ElMessage.warning('请输入知识库名称');
      return;
    }
    if (form.type === 'WEB' && !form.source_url.trim()) {
      ElMessage.warning('请输入网页地址');
      return;
    }
    await (editingRow.value?.id
      ? updateKnowledge(editingRow.value.id, buildKnowledgePayload())
      : createKnowledge(buildKnowledgePayload()));
    ElMessage.success(editingRow.value?.id ? '保存成功' : '创建成功');
    dialogOpen.value = false;
    await refreshAll();
    return;
  }
  if (knowledgeId === undefined) {
    ElMessage.warning('请先选择知识库');
    return;
  }
  let saveSuccessMessage = '保存成功';
  switch (dialogMode.value) {
    case 'document': {
      if (editingRow.value?.id) {
        ElMessage.warning('当前接口暂不支持保存文档设置');
        dialogOpen.value = false;
        return;
      }
      if (documentCreateMode.value === 'file') {
        const file = uploadedDocumentFile.value;
        if (!file?.id || !file.url) {
          ElMessage.warning('请先上传文件');
          return;
        }
        const payload = {
          fileId: `${file.id}`,
          fileUrl: file.url,
          name: form.title || form.name || getUploadedDocumentName(file),
          ...(form.splitConfig.trim()
            ? { splitConfig: form.splitConfig.trim() }
            : {}),
        };
        await createDocumentFromFile(knowledgeId, payload);
        saveSuccessMessage = '文档已提交解析和向量化';
      } else {
        const name = form.title || form.name;
        if (!name || !form.content) {
          ElMessage.warning('请填写标题和内容');
          return;
        }
        const document = (await createDocument(knowledgeId, {
          metaJson: JSON.stringify({ source: 'manual' }),
          name,
          sourceType: 'QA',
        })) as KnowledgeRecord;
        if (!document.id) {
          ElMessage.warning('文档已创建但返回缺少文档 ID，无法写入分段');
          return;
        }
        await createParagraph(knowledgeId, document.id, {
          content: form.content,
          title: name,
        });
        saveSuccessMessage = '文档已创建';
      }
      await loadRelated();
      if (documentCreateMode.value === 'file') startDocumentReembedPolling();

      break;
    }
    case 'paragraph': {
      const documentId = idValue(selectedDocument.value?.id);
      if (documentId === undefined) {
        ElMessage.warning('请先选择文档');
        return;
      }
      if (!form.title.trim() && !form.content.trim()) {
        ElMessage.warning('请填写标题或内容');
        return;
      }
      const payload = {
        content: form.content,
        title: form.title,
      };
      await (editingRow.value?.id
        ? updateParagraph(knowledgeId, documentId, editingRow.value.id, payload)
        : createParagraph(knowledgeId, documentId, payload));
      await loadParagraphs();

      break;
    }
    case 'problem': {
      await (editingRow.value?.id
        ? updateProblem(knowledgeId, editingRow.value.id, form)
        : createProblem(knowledgeId, form));
      await loadRelated();

      break;
    }
    case 'tag': {
      if (!form.tagKey.trim() || !form.tagValue.trim()) {
        ElMessage.warning('请输入标签键和值');
        return;
      }
      const payload = {
        key: form.tagKey.trim(),
        name: tagDisplayName(form.tagKey, form.tagValue),
        value: form.tagValue.trim(),
      };
      await (editingRow.value?.id
        ? updateTag(knowledgeId, editingRow.value.id, payload)
        : createTag(knowledgeId, payload));
      await loadRelated();

      break;
    }
    case 'term': {
      await (editingRow.value?.id
        ? updateTerm(knowledgeId, editingRow.value.id, form)
        : createTerm(knowledgeId, form));
      await loadRelated();

      break;
    }
    // No default
  }
  ElMessage.success(saveSuccessMessage);
  dialogOpen.value = false;
}

async function saveDetailSettings() {
  const knowledgeId = idValue(selectedKnowledge.value?.id);
  if (knowledgeId === undefined) return;
  if (!form.name.trim()) {
    ElMessage.warning('请输入知识库名称');
    return;
  }
  if (form.type === 'WEB' && !form.source_url.trim()) {
    ElMessage.warning('请输入网页地址');
    return;
  }
  await updateKnowledge(knowledgeId, buildKnowledgePayload());
  ElMessage.success('设置已保存');
  const detail = normalizeKnowledgeDetail(
    await getKnowledge(knowledgeId),
    knowledgeId,
  );
  if (detail) selectedKnowledge.value = detail;
  await refreshAll();
  prepareDetailSettingForm();
}

function removeKnowledge(row: KnowledgeRecord) {
  confirm(`确认删除知识库 ${row.name || row.id}？`).then(async () => {
    if (!row.id) return;
    await deleteKnowledge(row.id);
    if (selectedKnowledge.value?.id === row.id) clearSelectedKnowledge();
    ElMessage.success('删除成功');
    await refreshAll();
  });
}

async function removeDocument(row: KnowledgeRecord) {
  const knowledgeId = idValue(selectedKnowledge.value?.id);
  const documentId = idValue(row.id);
  if (knowledgeId === undefined || documentId === undefined) return;
  await deleteDocument(knowledgeId, documentId);
  ElMessage.success('文档已删除');
  await loadRelated();
}

async function removeParagraph(row: KnowledgeRecord) {
  const knowledgeId = idValue(selectedKnowledge.value?.id);
  const documentId = idValue(selectedDocument.value?.id);
  const paragraphId = idValue(row.id);
  if (
    knowledgeId === undefined ||
    documentId === undefined ||
    paragraphId === undefined
  )
    return;
  await deleteParagraph(knowledgeId, documentId, paragraphId);
  ElMessage.success('分段已删除');
  await loadParagraphs();
}

async function removeAux(
  type: 'problem' | 'tag' | 'term',
  row: KnowledgeRecord,
) {
  const knowledgeId = idValue(selectedKnowledge.value?.id);
  if (knowledgeId === undefined || row.id === undefined) return;
  if (type === 'problem') await deleteProblem(knowledgeId, row.id);
  if (type === 'term') await deleteTerm(knowledgeId, row.id);
  if (type === 'tag') await deleteTag(knowledgeId, row.id);
  ElMessage.success('删除成功');
  await loadRelated();
}

async function hitTest() {
  const knowledgeId = idValue(selectedKnowledge.value?.id);
  if (knowledgeId === undefined) return;
  if (!searchForm.query.trim()) {
    ElMessage.warning('请输入检索问题');
    return;
  }
  const payload = {
    query: searchForm.query,
    query_text: searchForm.query,
    searchMode: searchForm.searchMode,
    search_mode: searchForm.searchMode,
    similarityThreshold: searchForm.similarityThreshold,
    similarity_threshold: searchForm.similarityThreshold,
    topK: searchForm.topK,
    top_number: searchForm.topK,
  };
  searchResult.value = await searchKnowledge(knowledgeId, payload);
}

async function reembedSelectedKnowledge(row?: KnowledgeRecord) {
  const knowledgeId = idValue((row || selectedKnowledge.value)?.id);
  if (knowledgeId === undefined) return;
  await reembedKnowledge(knowledgeId, true);
  ElMessage.success('已提交向量化');
}

async function reembedSelectedDocument(row: KnowledgeRecord) {
  const knowledgeId = idValue(selectedKnowledge.value?.id);
  const documentId = idValue(row.id);
  if (knowledgeId === undefined || documentId === undefined) return;
  await reembedDocument(knowledgeId, documentId, true);
  ElMessage.success('已提交文档向量化');
  await loadRelated();
  startDocumentReembedPolling();
}

function mergeSelectedKnowledgeStats(stats: unknown) {
  if (!selectedKnowledge.value || !isRecord(stats)) return;
  const source = isRecord(stats.data) ? stats.data : stats;
  if (!isRecord(source)) return;
  selectedKnowledge.value = {
    ...selectedKnowledge.value,
    charLength: numberValue(
      source.charLength ??
        source.characterCount ??
        source.character_count ??
        source.char_length,
    ),
    characterCount: numberValue(
      source.characterCount ??
        source.charLength ??
        source.character_count ??
        source.char_length,
    ),
    documentCount: numberValue(source.documentCount ?? source.document_count),
    paragraphCount: numberValue(
      source.paragraphCount ?? source.paragraph_count,
    ),
  };
}

function clearDocumentReembedPolling() {
  documentReembedPollingActive.value = false;
  if (!documentReembedPollTimer.value) return;
  window.clearTimeout(documentReembedPollTimer.value);
  documentReembedPollTimer.value = undefined;
}

function startDocumentReembedPolling() {
  clearDocumentReembedPolling();
  documentReembedPollingActive.value = true;
  const pollDocuments = async () => {
    if (!documentReembedPollingActive.value) return;
    try {
      await loadDocumentsOnly();
      if (!documents.value.some((item) => isDocumentProcessing(item))) {
        clearDocumentReembedPolling();
        return;
      }
    } catch {
      if (!documentReembedPollingActive.value) return;
    }
    if (documentReembedPollingActive.value) {
      documentReembedPollTimer.value = window.setTimeout(pollDocuments, 2500);
    }
  };
  documentReembedPollTimer.value = window.setTimeout(pollDocuments, 2500);
}

async function reembedSelectedParagraph(row: KnowledgeRecord) {
  const knowledgeId = idValue(selectedKnowledge.value?.id);
  const documentId = idValue(selectedDocument.value?.id);
  const paragraphId = idValue(row.id);
  if (
    knowledgeId === undefined ||
    documentId === undefined ||
    paragraphId === undefined
  )
    return;
  await reembedParagraph(knowledgeId, documentId, paragraphId);
  ElMessage.success('已提交分段向量化');
}

function isSelected(row: KnowledgeRecord) {
  return row.id !== undefined && selectedIds.value.includes(row.id);
}

function toggleSelection(row: KnowledgeRecord, checked: boolean) {
  if (row.id === undefined) return;
  selectedIds.value = checked
    ? [...new Set([row.id, ...selectedIds.value])]
    : selectedIds.value.filter((id) => id !== row.id);
}

function toggleBatchMode(active: boolean) {
  batchMode.value = active;
  selectedIds.value = [];
}

function toggleCurrentPageSelection(checked: boolean) {
  selectedIds.value = checked
    ? [...new Set([...currentPageKnowledgeIds.value, ...selectedIds.value])]
    : selectedIds.value.filter(
        (id) => !currentPageKnowledgeIds.value.includes(id),
      );
}

function removeSelectedKnowledge() {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('请选择要删除的知识库');
    return;
  }
  confirm(`确认删除选中的 ${selectedIds.value.length} 个知识库？`).then(
    async () => {
      await batchDeleteKnowledge([...selectedIds.value]);
      selectedIds.value = [];
      batchMode.value = false;
      ElMessage.success('批量删除成功');
      await refreshAll();
    },
  );
}

function openMoveDialog(row?: KnowledgeRecord) {
  moveIds.value = row?.id ? [row.id] : [...selectedIds.value];
  if (moveIds.value.length === 0) {
    ElMessage.warning('请选择要移动的知识库');
    return;
  }
  moveForm.folder_id = row
    ? (knowledgeFolderId(row) ?? '')
    : (currentFolderId.value ?? '');
  moveDialogOpen.value = true;
}

async function saveMove() {
  const targetFolderId =
    moveForm.folder_id === '' ? undefined : idValue(moveForm.folder_id);
  await batchMoveKnowledge(moveIds.value, targetFolderId);
  ElMessage.success('移动成功');
  moveDialogOpen.value = false;
  selectedIds.value = [];
  batchMode.value = false;
  await refreshAll();
}

function getUploadedDocumentName(file?: UploadedDocumentFile) {
  return file?.original || file?.fileName || file?.name || '';
}

function handleDocumentFileSuccess(response: UploadResponse, file: UploadFile) {
  if (response.code !== undefined && ![0, 200].includes(response.code)) {
    ElMessage.error(response.msg || '文件上传失败');
    uploadedDocumentFile.value = undefined;
    documentUploadList.value = [];
    return;
  }
  const data = response.data;
  if (!data?.id || !data.url) {
    ElMessage.error('上传响应缺少文件信息');
    uploadedDocumentFile.value = undefined;
    documentUploadList.value = [];
    return;
  }
  uploadedDocumentFile.value = data;
  documentUploadList.value = [
    { name: getUploadedDocumentName(data) || file.name, url: data.url },
  ];
}

function handleDocumentFileRemove() {
  uploadedDocumentFile.value = undefined;
  documentUploadList.value = [];
}

function handleDocumentFileError() {
  ElMessage.error('文件上传失败');
  uploadedDocumentFile.value = undefined;
  documentUploadList.value = [];
}

function handleDocumentFileExceed() {
  ElMessage.warning('一次只能选择 1 个文件');
}

async function fileToText(file: File) {
  return file.text();
}

function downloadJsonFile(fileName: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

async function handleImportFile(uploadFile: UploadFile) {
  if (!uploadFile.raw) return;
  const text = await fileToText(uploadFile.raw);
  const parsed = safeParseJson(text, undefined);
  if (!isRecord(parsed)) {
    ElMessage.warning('导入文件必须是 JSON 或 .knowledge 格式');
    return;
  }
  const folderId = currentFolderId.value;
  await importKnowledgeApi({
    ...parsed,
    folderId,
    folder_id: folderId,
    workspaceId: query.workspaceId,
    workspace_id: query.workspaceId,
  });
  ElMessage.success('导入成功');
  await refreshAll();
}

async function exportKnowledgeFile(row: KnowledgeRecord) {
  if (!row.id) return;
  const data = await exportKnowledgeApi(row.id);
  downloadJsonFile(`${knowledgeDisplayName(row)}.knowledge`, data);
}

async function init() {
  await refreshAll();
  await syncDetailRouteState();
}

onMounted(init);
onBeforeUnmount(clearDocumentReembedPolling);

watch(
  () => [route.name, route.query.knowledgeId, route.query.tab],
  async () => {
    await syncDetailRouteState();
  },
);
</script>

<template>
  <Page auto-content-height>
    <div
      class="knowledge-console"
      :class="{ 'is-detail-route': isKnowledgeDetailRoute }"
      v-loading="loading"
    >
      <section
        v-if="!isKnowledgeDetailRoute"
        class="knowledge-management-shell"
      >
        <aside class="knowledge-folder-pane" v-loading="treeLoading">
          <div class="folder-pane-header">
            <h4>知识库</h4>
          </div>
          <div class="folder-pane-controls">
            <ElInput
              v-model="folderSearchKeyword"
              class="folder-search-input"
              clearable
              placeholder="搜索"
            >
              <template #prefix><Search /></template>
            </ElInput>
            <ElDropdown
              trigger="click"
              :teleported="false"
              @command="switchFolderSort"
            >
              <ElButton
                class="folder-sort-button"
                :aria-label="currentFolderSortLabel"
                :title="currentFolderSortLabel"
              >
                <Sort />
              </ElButton>
              <template #dropdown>
                <ElDropdownMenu class="folder-sort-menu">
                  <ElDropdownItem
                    v-for="item in folderSortOptions"
                    :key="item.value"
                    :class="{ 'is-active': folderSort === item.value }"
                    :command="item.value"
                    :divided="item.divided"
                  >
                    <span class="folder-sort-option">
                      <span>{{ item.label }}</span>
                      <Check
                        v-if="folderSort === item.value"
                        class="folder-sort-option__check"
                      />
                    </span>
                  </ElDropdownItem>
                </ElDropdownMenu>
              </template>
            </ElDropdown>
          </div>

          <ElTree
            class="knowledge-folder-tree"
            :current-node-key="activeFolder.id"
            :data="visibleFolderTree"
            :expand-on-click-node="false"
            :props="{ children: 'children', label: 'name' }"
            default-expand-all
            highlight-current
            node-key="id"
            @node-click="selectFolder"
          >
            <template #default="{ data }">
              <div
                class="folder-node"
                :class="{ 'is-root': isSyntheticRootFolder(data) }"
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

        <main class="knowledge-list-pane">
          <header class="knowledge-list-header">
            <div class="knowledge-list-title">
              <div
                class="folder-breadcrumb"
                :title="activeFolderPath.join(' / ')"
              >
                <template
                  v-for="(item, index) in activeFolderPath"
                  :key="`${item}-${index}`"
                >
                  <span>{{ item }}</span>
                  <span
                    v-if="index < activeFolderPath.length - 1"
                    class="folder-breadcrumb__split"
                    v-text="'/'"
                  ></span>
                </template>
              </div>
              <div class="knowledge-list-title__meta">{{ pageSubtitle }}</div>
            </div>
            <span class="knowledge-header-divider"></span>
            <div class="knowledge-list-actions">
              <ElSelect
                v-model="query.type"
                class="knowledge-type-select"
                clearable
                placeholder="类型"
                @change="handleSearch"
              >
                <ElOption
                  v-for="item in knowledgeTypeOptions"
                  :key="item.value || 'all'"
                  :label="item.label"
                  :value="item.value"
                />
              </ElSelect>
              <ElInput
                v-model="query.name"
                class="knowledge-search-input"
                clearable
                placeholder="搜索知识库"
                @clear="handleSearch"
                @change="handleSearch"
                @keyup.enter="handleSearch"
              >
                <template #prefix><Search /></template>
              </ElInput>
              <ElButton @click="toggleBatchMode(!batchMode)">
                <Files class="button-icon" />
                {{ batchMode ? '取消选择' : '批量选择' }}
              </ElButton>
              <ElDropdown v-if="!batchMode" trigger="click">
                <ElButton :icon="Plus" type="primary">创建</ElButton>
                <template #dropdown>
                  <ElDropdownMenu class="knowledge-create-dropdown">
                    <ElDropdownItem
                      v-for="item in createMenuItems"
                      :key="item.type"
                      @click="openCreateKnowledge(item.type)"
                    >
                      <div class="create-menu-item">
                        <span class="create-menu-icon" :class="item.iconClass">
                          <component :is="item.icon" />
                        </span>
                        <span class="create-menu-copy">
                          <span class="create-menu-label">{{
                            item.label
                          }}</span>
                          <span class="create-menu-subtitle">{{
                            item.subtitle
                          }}</span>
                        </span>
                      </div>
                    </ElDropdownItem>
                    <ElUpload
                      :auto-upload="false"
                      :on-change="handleImportFile"
                      :show-file-list="false"
                      accept=".json,.knowledge"
                    >
                      <ElDropdownItem>
                        <div class="create-menu-item">
                          <span class="create-menu-icon is-create-import">
                            <UploadIcon />
                          </span>
                          <span class="create-menu-copy">
                            <span class="create-menu-label">导入创建</span>
                            <span class="create-menu-subtitle">
                              导入 JSON 或 .knowledge 包
                            </span>
                          </span>
                        </div>
                      </ElDropdownItem>
                    </ElUpload>
                    <ElDropdownItem divided @click="openCreateRootFolder">
                      <div class="create-menu-item">
                        <span class="create-menu-icon is-create-folder">
                          <FolderOpened />
                        </span>
                        <span class="create-menu-copy">
                          <span class="create-menu-label">添加文件夹</span>
                          <span class="create-menu-subtitle">
                            在左侧目录中管理知识库
                          </span>
                        </span>
                      </div>
                    </ElDropdownItem>
                  </ElDropdownMenu>
                </template>
              </ElDropdown>
            </div>
          </header>

          <section class="knowledge-card-scroll">
            <div v-if="knowledgeList.length > 0" class="knowledge-card-grid">
              <article
                v-for="item in knowledgeList"
                :key="item.id"
                class="knowledge-card"
                :class="{
                  'is-batch': batchMode,
                  'is-selected':
                    selectedKnowledge?.id === item.id || isSelected(item),
                }"
                role="button"
                tabindex="0"
                @click="openKnowledgeDetail(item, 'documents')"
                @keydown.enter="openKnowledgeDetail(item, 'documents')"
              >
                <div class="knowledge-card__body">
                  <div class="knowledge-card__head">
                    <span
                      class="knowledge-avatar"
                      :class="knowledgeTypeClass(item.type)"
                    >
                      {{ knowledgeIconText(item) }}
                    </span>
                    <span class="knowledge-card__identity">
                      <span class="knowledge-card__title-row">
                        <strong :title="knowledgeDisplayName(item)">{{
                          knowledgeDisplayName(item)
                        }}</strong>
                        <ElTag
                          effect="plain"
                          size="small"
                          :type="knowledgeTypeTagType(item.type)"
                        >
                          {{ knowledgeTypeLabel(item.type) }}
                        </ElTag>
                      </span>
                      <span
                        class="knowledge-card__subtitle"
                        :title="knowledgeSecondaryLine(item)"
                      >
                        {{ knowledgeSecondaryLine(item) }}
                      </span>
                    </span>
                    <ElCheckbox
                      v-if="batchMode"
                      class="knowledge-card__checkbox"
                      :model-value="isSelected(item)"
                      @click.stop
                      @change="
                        (checked) => toggleSelection(item, Boolean(checked))
                      "
                    />
                  </div>
                  <p
                    class="knowledge-card__desc"
                    :title="knowledgeDescription(item)"
                  >
                    {{ knowledgeDescription(item) }}
                  </p>
                </div>
                <div class="knowledge-card__meta-grid">
                  <span>
                    <strong>{{ knowledgeDocumentCount(item) }}</strong>
                    文档
                  </span>
                  <span>
                    <strong>{{ knowledgeParagraphCount(item) }}</strong>
                    分段
                  </span>
                  <span>
                    <strong>{{ knowledgeCharCount(item) }}</strong>
                    字符
                  </span>
                </div>
                <div class="knowledge-card__footer">
                  <span
                    class="knowledge-card__status"
                    :class="
                      knowledgeEnabled(item) ? 'is-enabled' : 'is-disabled'
                    "
                  >
                    <Check
                      v-if="knowledgeEnabled(item)"
                      class="knowledge-card__status-icon"
                    />
                    <span v-else class="knowledge-card__status-dot"></span>
                    {{ knowledgeEnabled(item) ? '启用' : '停用' }}
                  </span>
                  <div class="knowledge-card__footer-side">
                    <ElTag
                      effect="plain"
                      size="small"
                      :type="statusType(item.status)"
                    >
                      {{ item.status || 'READY' }}
                    </ElTag>
                    <div
                      v-if="!batchMode"
                      class="knowledge-card__hover-actions"
                      @click.stop
                    >
                      <ElDropdown trigger="click">
                        <ElButton :icon="MoreFilled" circle text />
                        <template #dropdown>
                          <ElDropdownMenu>
                            <ElDropdownItem
                              @click="openKnowledgeDetail(item, 'setting')"
                            >
                              设置
                            </ElDropdownItem>
                            <ElDropdownItem
                              @click="reembedSelectedKnowledge(item)"
                            >
                              重新向量化
                            </ElDropdownItem>
                            <ElDropdownItem @click="openMoveDialog(item)">
                              移动
                            </ElDropdownItem>
                            <ElDropdownItem @click="exportKnowledgeFile(item)">
                              导出
                            </ElDropdownItem>
                            <ElDropdownItem
                              divided
                              @click="removeKnowledge(item)"
                            >
                              删除
                            </ElDropdownItem>
                          </ElDropdownMenu>
                        </template>
                      </ElDropdown>
                    </div>
                  </div>
                </div>
              </article>
            </div>
            <ElEmpty
              v-else
              class="empty-panel"
              description="暂无知识库，试试创建或导入"
            />
          </section>

          <div class="pager">
            <span>共 {{ total }} 条</span>
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
              移动
            </ElButton>
            <ElButton
              :disabled="selectedIds.length === 0"
              type="danger"
              @click="removeSelectedKnowledge"
            >
              删除
            </ElButton>
            <span class="batch-operation-bar__summary">
              已选择 {{ selectedIds.length }}/{{ total }} 个知识库
            </span>
            <span class="batch-operation-bar__names">{{
              selectedKnowledges.map((item) => item.name || item.id).join('、')
            }}</span>
            <ElButton link type="primary" @click="toggleBatchMode(false)">
              取消选择
            </ElButton>
          </div>
        </main>
      </section>

      <section v-else class="knowledge-route-detail">
        <header class="detail-route-header">
          <div class="detail-route-header__title">
            <ElButton :icon="ArrowLeft" @click="backToKnowledgeList">
              知识库列表
            </ElButton>
            <div>
              <strong>{{ detailDrawerTitle }}</strong>
              <span v-if="selectedKnowledge">
                {{ knowledgeTypeLabel(selectedKnowledge.type) }} ·
                {{ knowledgeDescription(selectedKnowledge) }}
              </span>
              <span v-else>
                通过路由参数管理文档、分段、问题、术语、标签、检索和设置
              </span>
            </div>
          </div>
          <div v-if="selectedKnowledge" class="detail-context-actions">
            <ElButton size="small" @click="handleDetailTabChange('setting')">
              设置
            </ElButton>
            <ElButton size="small" @click="reembedSelectedKnowledge()">
              重新向量化
            </ElButton>
          </div>
        </header>
        <section
          v-if="selectedKnowledge"
          class="knowledge-detail-panel"
          v-loading="detailLoading"
        >
          <aside class="detail-side-nav">
            <div class="detail-side-nav__summary">
              <div class="detail-side-nav__identity">
                <span
                  class="knowledge-avatar"
                  :class="knowledgeTypeClass(selectedKnowledge.type)"
                >
                  {{ knowledgeIconText(selectedKnowledge) }}
                </span>
                <div>
                  <strong>{{ knowledgeDisplayName(selectedKnowledge) }}</strong>
                  <span>{{ knowledgeTypeLabel(selectedKnowledge.type) }}</span>
                </div>
              </div>
              <p class="detail-side-nav__description">
                {{ knowledgeDescription(selectedKnowledge) }}
              </p>
              <div class="detail-side-nav__stats">
                <span>
                  <strong>{{ documents.length }}</strong>
                  <em>文档</em>
                </span>
                <span>
                  <strong>{{
                    knowledgeParagraphCount(selectedKnowledge)
                  }}</strong>
                  <em>分段</em>
                </span>
                <span>
                  <strong>{{ knowledgeCharCount(selectedKnowledge) }}</strong>
                  <em>字符</em>
                </span>
              </div>
            </div>
            <ElMenu
              class="detail-menu"
              :default-active="activeTab"
              @select="handleDetailTabChange"
            >
              <ElMenuItem
                v-for="item in detailNavigationItems"
                :key="item.value"
                :index="item.value"
              >
                <span class="detail-menu__icon-shell">
                  <component :is="item.icon" class="detail-menu__icon" />
                </span>
                <span class="detail-menu__copy">
                  <span class="detail-menu__label">{{ item.label }}</span>
                  <span class="detail-menu__subtitle">{{ item.subtitle }}</span>
                </span>
                <ElTag
                  v-if="detailNavigationCount(item.value) !== undefined"
                  class="detail-menu__count"
                  effect="plain"
                  size="small"
                >
                  {{ detailNavigationCount(item.value) }}
                </ElTag>
              </ElMenuItem>
            </ElMenu>
          </aside>
          <main class="detail-content-panel">
            <section v-if="activeTab === 'documents'" class="detail-tab-pane">
              <section
                v-if="!selectedDocument"
                class="detail-section document-section"
              >
                <div class="document-section__header">
                  <h3>文档</h3>
                </div>
                <div class="document-toolbar">
                  <div class="document-toolbar__left">
                    <ElButton type="primary" @click="openDialog('document')">
                      上传文档
                    </ElButton>
                    <ElButton
                      :disabled="documentSelectedIds.length === 0"
                      @click="batchReembedDocuments"
                    >
                      向量化
                    </ElButton>
                    <ElButton disabled>生成问题</ElButton>
                    <ElButton disabled>设置</ElButton>
                    <ElDropdown trigger="click" :teleported="false">
                      <ElButton :icon="MoreFilled" aria-label="更多" />
                      <template #dropdown>
                        <ElDropdownMenu>
                          <ElDropdownItem
                            :disabled="documentSelectedIds.length === 0"
                            @click="batchDeleteDocuments"
                          >
                            删除
                          </ElDropdownItem>
                          <ElDropdownItem
                            :disabled="documentSelectedIds.length === 0"
                            @click="toggleDocumentBatchMode(false)"
                          >
                            清空选择
                          </ElDropdownItem>
                        </ElDropdownMenu>
                      </template>
                    </ElDropdown>
                  </div>
                  <div class="document-toolbar__right">
                    <ElSelect
                      class="document-field-select"
                      model-value="name"
                      disabled
                    >
                      <ElOption label="文件名称" value="name" />
                    </ElSelect>
                    <ElInput
                      v-model="documentQuery.name"
                      class="document-search-input"
                      clearable
                      placeholder="搜索文档名称"
                      @clear="handleDocumentSearch"
                      @change="handleDocumentSearch"
                      @keyup.enter="handleDocumentSearch"
                    >
                      <template #prefix><Search /></template>
                    </ElInput>
                    <ElSelect
                      v-model="documentEnabledFilter"
                      class="document-enabled-filter"
                      @change="handleDocumentEnabledFilterChange"
                    >
                      <ElOption
                        v-for="item in documentEnabledFilterOptions"
                        :key="`${item.value}`"
                        :label="item.label"
                        :value="item.value"
                      />
                    </ElSelect>
                    <ElDropdown trigger="click" :teleported="false">
                      <ElButton>标签筛选</ElButton>
                      <template #dropdown>
                        <div class="document-tag-filter">
                          <ElCascaderPanel
                            :model-value="tagFilterValue"
                            :options="tagFilterOptions"
                            :props="{
                              multiple: true,
                              checkStrictly: true,
                              emitPath: false,
                              showPrefix: false,
                            }"
                            @change="tagFilterOptionsChange"
                          />
                          <div class="document-tag-filter__actions">
                            <ElButton
                              link
                              type="primary"
                              @click="clearDocumentTagFilter"
                            >
                              清空
                            </ElButton>
                          </div>
                        </div>
                      </template>
                    </ElDropdown>
                    <ElButton @click="openTagDrawer">标签管理</ElButton>
                  </div>
                </div>
                <div class="document-table-shell">
                  <ElTable
                    v-loading="detailLoading"
                    :data="filteredDocuments"
                    :row-class-name="documentTableRowClassName"
                    :row-key="documentRowKey"
                    class="document-table"
                    height="100%"
                    size="small"
                    @row-click="selectDocument"
                  >
                    <ElTableColumn align="center" fixed="left" width="46">
                      <template #header>
                        <ElCheckbox
                          :indeterminate="
                            isCurrentDocumentSelectionIndeterminate
                          "
                          :model-value="isAllCurrentDocumentsSelected"
                          @change="
                            (checked) =>
                              toggleCurrentDocumentSelection(Boolean(checked))
                          "
                          @click.stop
                        />
                      </template>
                      <template #default="{ row }">
                        <ElCheckbox
                          :model-value="isDocumentSelected(row)"
                          @change="
                            (checked) =>
                              handleDocumentCardCheckboxChange(
                                row,
                                Boolean(checked),
                              )
                          "
                          @click.stop
                        />
                      </template>
                    </ElTableColumn>
                    <ElTableColumn
                      fixed="left"
                      label="文件名称"
                      min-width="260"
                      show-overflow-tooltip
                    >
                      <template #default="{ row }">
                        <div class="document-name-cell">
                          <span class="document-name-cell__icon">
                            <Files />
                          </span>
                          <div class="document-name-cell__main">
                            <button
                              class="document-name-cell__title"
                              type="button"
                              :title="documentDisplayName(row)"
                              @click.stop="openParagraphView(row)"
                            >
                              {{ documentDisplayName(row) }}
                            </button>
                            <span class="document-name-cell__meta">
                              命中处理：{{ documentHitHandlingMethod(row) }}
                            </span>
                          </div>
                        </div>
                      </template>
                    </ElTableColumn>
                    <ElTableColumn label="向量化状态" min-width="170">
                      <template #default="{ row }">
                        <div
                          class="document-vector-status"
                          :class="documentVectorStatus(row).className"
                          :title="documentVectorStatus(row).rawText"
                        >
                          <span class="document-vector-status__icon">
                            <ElIcon
                              v-if="
                                documentVectorStatus(row).status === 'SUCCESS'
                              "
                            >
                              <CircleCheckFilled />
                            </ElIcon>
                            <ElIcon
                              v-else-if="
                                documentVectorStatus(row).status === 'FAILED'
                              "
                            >
                              <CircleCloseFilled />
                            </ElIcon>
                            <ElIcon
                              v-else-if="
                                documentVectorStatus(row).status === 'CANCELED'
                              "
                            >
                              <WarningFilled />
                            </ElIcon>
                            <ElIcon v-else class="is-loading">
                              <Loading />
                            </ElIcon>
                          </span>
                          <span class="document-vector-status__copy">
                            <strong>{{
                              documentVectorStatus(row).label
                            }}</strong>
                            <small>{{
                              documentVectorStatus(row).metaText
                            }}</small>
                          </span>
                        </div>
                      </template>
                    </ElTableColumn>
                    <ElTableColumn align="right" label="字符数" width="100">
                      <template #default="{ row }">
                        <span class="document-table-number">{{
                          documentCharLength(row)
                        }}</span>
                      </template>
                    </ElTableColumn>
                    <ElTableColumn align="right" label="分段" width="90">
                      <template #default="{ row }">
                        <span class="document-table-number">{{
                          documentParagraphCount(row)
                        }}</span>
                      </template>
                    </ElTableColumn>
                    <ElTableColumn label="启用状态" width="120">
                      <template #default="{ row }">
                        <span class="document-enable-switch" @click.stop>
                          <ElSwitch
                            active-text="启用"
                            inactive-text="停用"
                            :loading="isDocumentUpdating(row)"
                            :model-value="documentEnabled(row)"
                            inline-prompt
                            size="small"
                            @change="
                              (value) => handleDocumentEnabledChange(row, value)
                            "
                          />
                        </span>
                      </template>
                    </ElTableColumn>
                    <ElTableColumn label="标签" min-width="170">
                      <template #default="{ row }">
                        <div class="document-table-tags">
                          <template
                            v-if="documentTagDisplayList(row).length > 0"
                          >
                            <ElTag
                              v-for="tag in documentTagDisplayList(row).slice(
                                0,
                                2,
                              )"
                              :key="tag"
                              effect="plain"
                              size="small"
                              type="info"
                            >
                              {{ tag }}
                            </ElTag>
                            <ElTag
                              v-if="documentHiddenTagCount(row) > 0"
                              effect="plain"
                              size="small"
                              type="info"
                            >
                              +{{ documentHiddenTagCount(row) }}
                            </ElTag>
                          </template>
                          <span v-else class="document-table-tag-empty">
                            未设置标签
                          </span>
                        </div>
                      </template>
                    </ElTableColumn>
                    <ElTableColumn label="创建/更新时间" width="190">
                      <template #default="{ row }">
                        <div class="document-time-cell">
                          <span>创建：{{ rowCreateTime(row) }}</span>
                          <span>更新：{{ rowUpdateTime(row) }}</span>
                        </div>
                      </template>
                    </ElTableColumn>
                    <ElTableColumn fixed="right" label="操作" width="210">
                      <template #default="{ row }">
                        <div class="document-table-actions" @click.stop>
                          <ElButton
                            link
                            type="primary"
                            @click="openParagraphView(row)"
                          >
                            分段
                          </ElButton>
                          <ElButton
                            link
                            type="primary"
                            @click="reembedSelectedDocument(row)"
                          >
                            向量化
                          </ElButton>
                          <ElButton
                            link
                            type="primary"
                            @click="openDocumentTagSetting(row)"
                          >
                            标签
                          </ElButton>
                          <ElButton
                            link
                            type="danger"
                            @click="removeDocument(row)"
                          >
                            删除
                          </ElButton>
                        </div>
                      </template>
                    </ElTableColumn>
                    <template #empty>
                      <div class="document-table-empty">
                        <ElEmpty
                          description="暂无文档，上传文件后会自动解析并向量化"
                        >
                          <ElButton
                            type="primary"
                            @click="openDialog('document')"
                          >
                            上传文档
                          </ElButton>
                        </ElEmpty>
                      </div>
                    </template>
                  </ElTable>
                </div>
                <div
                  v-if="documentSelectedIds.length > 0"
                  class="batch-operation-bar is-document"
                >
                  <ElCheckbox
                    :indeterminate="isCurrentDocumentSelectionIndeterminate"
                    :model-value="isAllCurrentDocumentsSelected"
                    @change="
                      (checked) =>
                        toggleCurrentDocumentSelection(Boolean(checked))
                    "
                  >
                    全选
                  </ElCheckbox>
                  <ElButton
                    :disabled="documentSelectedIds.length === 0"
                    @click="batchReembedDocuments"
                  >
                    向量化
                  </ElButton>
                  <ElButton
                    :disabled="documentSelectedIds.length === 0"
                    type="danger"
                    @click="batchDeleteDocuments"
                  >
                    删除
                  </ElButton>
                  <span class="batch-operation-bar__summary">
                    已选择 {{ documentSelectedIds.length }}/{{
                      filteredDocuments.length
                    }}
                    个文档
                  </span>
                  <span class="batch-operation-bar__names">{{
                    documentSelectionRows
                      .map((item) => item.name || item.title || item.id)
                      .join('、')
                  }}</span>
                  <ElButton
                    link
                    type="primary"
                    @click="toggleDocumentBatchMode(false)"
                  >
                    取消选择
                  </ElButton>
                </div>
              </section>
              <section v-else class="detail-section paragraph-section">
                <div class="paragraph-header">
                  <div class="paragraph-header__title">
                    <ElButton :icon="ArrowLeft" @click="backToDocumentTable">
                      返回
                    </ElButton>
                    <strong :title="documentDisplayName(selectedDocument)">{{
                      documentDisplayName(selectedDocument)
                    }}</strong>
                    <span class="muted">{{ paragraphTotal }} 个分段</span>
                  </div>
                  <div class="paragraph-header__actions">
                    <ElButton
                      @click="toggleParagraphBatchMode(!paragraphBatchMode)"
                    >
                      {{ paragraphBatchMode ? '取消选择' : '批量选择' }}
                    </ElButton>
                    <ElButton type="primary" @click="openDialog('paragraph')">
                      新增分段
                    </ElButton>
                  </div>
                </div>
                <div class="paragraph-layout">
                  <aside class="paragraph-sidebar">
                    <ElScrollbar class="paragraph-scrollbar">
                      <ElAnchor
                        direction="vertical"
                        :offset="130"
                        container=".paragraph-scrollbar"
                      >
                        <ElAnchorLink
                          v-for="item in paragraphs"
                          :key="`anchor-${item.id}`"
                          :href="`#paragraph-${item.id}`"
                          :title="paragraphTitle(item)"
                        >
                          <span :title="paragraphTitle(item)">{{
                            paragraphTitle(item)
                          }}</span>
                        </ElAnchorLink>
                      </ElAnchor>
                    </ElScrollbar>
                  </aside>
                  <main class="paragraph-main">
                    <div class="paragraph-toolbar">
                      <ElInput
                        v-model="paragraphQuery.keyword"
                        class="paragraph-search-input"
                        clearable
                        placeholder="搜索分段"
                        @clear="handleParagraphSearch"
                        @change="handleParagraphSearch"
                        @keyup.enter="handleParagraphSearch"
                      >
                        <template #prepend>
                          <ElSelect
                            v-model="paragraphQuery.searchType"
                            class="paragraph-search-type"
                            @change="handleParagraphSearch"
                          >
                            <ElOption label="标题" value="title" />
                            <ElOption label="内容" value="content" />
                          </ElSelect>
                        </template>
                      </ElInput>
                    </div>
                    <ElScrollbar class="paragraph-list-scrollbar">
                      <div class="paragraph-card-list">
                        <ElEmpty
                          v-if="paragraphs.length === 0"
                          description="暂无分段"
                        />
                        <ElCard
                          v-for="row in paragraphs"
                          v-else
                          :key="row.id"
                          :id="`paragraph-${row.id}`"
                          class="paragraph-card"
                          shadow="hover"
                          :class="{ 'is-selected': isParagraphSelected(row) }"
                          @mouseenter="enterParagraphRow(row)"
                          @mouseleave="paragraphHoverId = undefined"
                        >
                          <div class="paragraph-card__header">
                            <div class="paragraph-card__title-row">
                              <ElCheckbox
                                v-if="paragraphBatchMode"
                                :model-value="isParagraphSelected(row)"
                                @change="
                                  (checked) =>
                                    handleParagraphCheckboxChange(
                                      row,
                                      Boolean(checked),
                                    )
                                "
                              />
                              <strong :title="paragraphTitle(row)">{{
                                paragraphTitle(row)
                              }}</strong>
                            </div>
                            <div
                              v-if="
                                !paragraphBatchMode && isParagraphHovered(row)
                              "
                              class="paragraph-card__actions"
                            >
                              <ElButton
                                link
                                @click="openDialog('paragraph', row)"
                              >
                                编辑
                              </ElButton>
                              <ElButton
                                link
                                @click="reembedSelectedParagraph(row)"
                              >
                                向量化
                              </ElButton>
                              <ElButton
                                link
                                type="danger"
                                @click="removeParagraph(row)"
                              >
                                删除
                              </ElButton>
                            </div>
                          </div>
                          <p
                            class="paragraph-card__content"
                            :title="paragraphContent(row)"
                          >
                            {{ paragraphContent(row) }}
                          </p>
                          <div class="paragraph-card__footer">
                            <span class="paragraph-card__meta">
                              状态：{{ row.status || '-' }}
                            </span>
                            <span class="paragraph-card__meta">
                              向量：{{ paragraphVectorStatus(row) }}
                            </span>
                          </div>
                        </ElCard>
                      </div>
                    </ElScrollbar>
                  </main>
                </div>
                <div
                  v-if="paragraphBatchMode"
                  class="batch-operation-bar is-paragraph"
                >
                  <ElCheckbox
                    :indeterminate="
                      paragraphSelectedIds.length > 0 &&
                      paragraphSelectedIds.length < paragraphs.length
                    "
                    :model-value="
                      paragraphs.length > 0 &&
                      paragraphSelectedIds.length >= paragraphs.length
                    "
                    @change="
                      (checked) =>
                        toggleCurrentParagraphSelection(Boolean(checked))
                    "
                  >
                    全选
                  </ElCheckbox>
                  <ElButton
                    :disabled="paragraphSelectedIds.length === 0"
                    @click="batchReembedParagraphs"
                  >
                    向量化
                  </ElButton>
                  <ElButton
                    :disabled="paragraphSelectedIds.length === 0"
                    type="danger"
                    @click="batchDeleteParagraphs"
                  >
                    删除
                  </ElButton>
                  <span class="batch-operation-bar__summary">
                    已选择 {{ paragraphSelectedIds.length }}/{{
                      paragraphTotal
                    }}
                    个分段
                  </span>
                  <span class="batch-operation-bar__names">{{
                    paragraphSelectionRows
                      .map((item) => paragraphTitle(item))
                      .join('、')
                  }}</span>
                  <ElButton
                    link
                    type="primary"
                    @click="toggleParagraphBatchMode(false)"
                  >
                    取消选择
                  </ElButton>
                </div>
              </section>
            </section>
            <section
              v-else-if="activeTab === 'problems'"
              class="detail-tab-pane"
            >
              <div class="tab-toolbar">
                <ElButton type="primary" @click="openDialog('problem')">
                  新增问题
                </ElButton>
              </div>
              <ElTable :data="problems" height="100%" size="small">
                <ElTableColumn prop="question" label="问题" min-width="180" />
                <ElTableColumn prop="answer" label="答案" min-width="220" />
                <ElTableColumn label="操作" width="130">
                  <template #default="{ row }">
                    <ElButton link @click="openDialog('problem', row)">
                      编辑
                    </ElButton>
                    <ElButton
                      link
                      type="danger"
                      @click="removeAux('problem', row)"
                    >
                      删除
                    </ElButton>
                  </template>
                </ElTableColumn>
              </ElTable>
            </section>
            <section v-else-if="activeTab === 'terms'" class="detail-tab-pane">
              <div class="tab-toolbar">
                <ElButton type="primary" @click="openDialog('term')">
                  新增术语
                </ElButton>
              </div>
              <ElTable :data="terms" height="100%" size="small">
                <ElTableColumn prop="term" label="术语" width="180" />
                <ElTableColumn prop="definition" label="定义" min-width="240" />
                <ElTableColumn label="操作" width="130">
                  <template #default="{ row }">
                    <ElButton link @click="openDialog('term', row)">
                      编辑
                    </ElButton>
                    <ElButton
                      link
                      type="danger"
                      @click="removeAux('term', row)"
                    >
                      删除
                    </ElButton>
                  </template>
                </ElTableColumn>
              </ElTable>
            </section>
            <section v-else-if="activeTab === 'search'" class="detail-tab-pane">
              <div class="search-box">
                <ElInput
                  v-model="searchForm.query"
                  placeholder="输入检索问题"
                  @keyup.enter="hitTest"
                />
                <ElPopover trigger="click" :width="520" placement="right-end">
                  <template #reference>
                    <ElButton>参数设置</ElButton>
                  </template>
                  <div class="search-options">
                    <div class="search-options__title">选择检索模式</div>
                    <ElRadioGroup
                      v-model="searchForm.searchMode"
                      class="search-options__radios"
                      @change="handleSearchModeChange"
                    >
                      <ElCard
                        shadow="never"
                        class="search-options__card"
                        :class="
                          searchForm.searchMode === 'embedding'
                            ? 'is-active'
                            : ''
                        "
                      >
                        <ElRadio value="embedding">
                          <div class="search-options__card-body">
                            <strong>向量检索</strong>
                            <span>按向量相似度召回</span>
                          </div>
                        </ElRadio>
                      </ElCard>
                      <ElCard
                        shadow="never"
                        class="search-options__card"
                        :class="
                          searchForm.searchMode === 'keywords'
                            ? 'is-active'
                            : ''
                        "
                      >
                        <ElRadio value="keywords">
                          <div class="search-options__card-body">
                            <strong>全文检索</strong>
                            <span>按关键词匹配召回</span>
                          </div>
                        </ElRadio>
                      </ElCard>
                      <ElCard
                        shadow="never"
                        class="search-options__card"
                        :class="
                          searchForm.searchMode === 'blend' ? 'is-active' : ''
                        "
                      >
                        <ElRadio value="blend">
                          <div class="search-options__card-body">
                            <strong>混合检索</strong>
                            <span>结合向量与关键词召回</span>
                          </div>
                        </ElRadio>
                      </ElCard>
                    </ElRadioGroup>
                    <div class="search-options__grid">
                      <div>
                        <div class="search-options__label">相似度阈值</div>
                        <ElInputNumber
                          v-model="searchForm.similarityThreshold"
                          :min="0"
                          :max="searchForm.searchMode === 'blend' ? 2 : 1"
                          :precision="3"
                          :step="0.05"
                          controls-position="right"
                          class="w-full"
                        />
                      </div>
                      <div>
                        <div class="search-options__label">Top K</div>
                        <ElInputNumber
                          v-model="searchForm.topK"
                          :min="1"
                          :max="10000"
                          controls-position="right"
                          class="w-full"
                        />
                      </div>
                    </div>
                  </div>
                </ElPopover>
                <ElButton type="primary" @click="hitTest">测试</ElButton>
              </div>
              <div class="hit-result-list">
                <ElEmpty
                  v-if="!searchResult"
                  description="请输入问题并开始测试"
                />
                <ElEmpty
                  v-else-if="hitResults.length === 0"
                  description="暂无命中结果"
                />
                <article
                  v-for="(item, index) in hitResults"
                  v-else
                  :key="item.id || index"
                  class="hit-result-card"
                >
                  <div class="hit-result-card__head">
                    <span class="hit-result-card__index">{{ index + 1 }}</span>
                    <strong :title="paragraphTitle(item)">{{
                      paragraphTitle(item)
                    }}</strong>
                    <ElTag effect="plain" size="small">
                      {{ hitScore(item) }}
                    </ElTag>
                  </div>
                  <p
                    class="hit-result-card__content"
                    :title="paragraphContent(item)"
                  >
                    {{ paragraphContent(item) }}
                  </p>
                  <div class="hit-result-card__footer">
                    <Files class="hit-result-card__icon" />
                    <span>{{ hitDocumentName(item) }}</span>
                  </div>
                </article>
              </div>
            </section>
            <section v-else class="detail-tab-pane">
              <section class="detail-section setting-section">
                <div class="section-title">
                  <span>基础信息</span>
                  <ElTag
                    effect="plain"
                    size="small"
                    :type="knowledgeTypeTagType(form.type)"
                  >
                    {{ knowledgeTypeLabel(form.type) }}
                  </ElTag>
                </div>
                <div
                  class="knowledge-type-card"
                  :class="knowledgeTypeClass(form.type)"
                >
                  <span
                    class="knowledge-avatar"
                    :class="knowledgeTypeClass(form.type)"
                  >
                    {{ knowledgeTypeLabel(form.type).slice(0, 1) }}
                  </span>
                  <div>
                    <strong>{{ knowledgeTypeLabel(form.type) }}</strong>
                    <span>{{ knowledgeTypeSubtitle(form.type) }}</span>
                  </div>
                </div>
                <ElForm label-width="112px" :model="form">
                  <ElFormItem label="名称">
                    <ElInput
                      v-model="form.name"
                      maxlength="64"
                      show-word-limit
                    />
                  </ElFormItem>
                  <ElFormItem label="描述">
                    <ElInput
                      v-model="form.description"
                      type="textarea"
                      :rows="3"
                      maxlength="180"
                      show-word-limit
                    />
                  </ElFormItem>
                  <ElFormItem label="向量模型">
                    <LocalModelSelect
                      v-model="form.embedding_model_id"
                      model-type="EMBEDDING"
                      placeholder="请选择向量模型"
                    />
                  </ElFormItem>
                  <ElFormItem label="所属目录">
                    <ElSelect
                      v-model="form.folder_id"
                      clearable
                      placeholder="根目录 / 全部知识库"
                    >
                      <ElOption
                        v-for="item in folderOptions"
                        :key="item.id || 'root'"
                        :label="item.name"
                        :value="item.id ?? ''"
                      />
                    </ElSelect>
                  </ElFormItem>
                  <ElFormItem label="文件数量限制">
                    <ElInputNumber
                      v-model="form.file_count_limit"
                      :min="1"
                      :max="1000"
                      controls-position="right"
                    />
                  </ElFormItem>
                  <ElFormItem label="文件大小限制">
                    <ElInputNumber
                      v-model="form.file_size_limit"
                      :min="1"
                      :max="2048"
                      controls-position="right"
                    /><span class="form-item-tip">MB</span>
                  </ElFormItem>
                  <ElFormItem v-if="form.type === 'WEB'" label="网页地址">
                    <ElInput
                      v-model="form.source_url"
                      placeholder="https://example.com/docs"
                    />
                  </ElFormItem>
                  <ElFormItem v-if="form.type === 'WEB'" label="选择器">
                    <ElInput
                      v-model="form.selector"
                      placeholder="可选，如 main.article"
                    />
                  </ElFormItem>
                  <ElFormItem
                    v-if="form.type === 'WORKFLOW'"
                    label="工作流 JSON"
                  >
                    <ElInput
                      v-model="form.work_flow"
                      type="textarea"
                      :rows="8"
                      placeholder="可选，按后端约定填写 work_flow"
                    />
                  </ElFormItem>
                  <ElFormItem label="状态">
                    <ElSelect v-model="form.enabled">
                      <ElOption label="启用" :value="true" /><ElOption
                        label="停用"
                        :value="false"
                      />
                    </ElSelect>
                  </ElFormItem>
                  <ElFormItem>
                    <ElButton type="primary" @click="saveDetailSettings">
                      保存设置
                    </ElButton>
                  </ElFormItem>
                </ElForm>
              </section>
            </section>
          </main>
        </section>
        <ElEmpty
          v-else
          class="detail-empty"
          description="选择一个知识库查看详情"
        />
      </section>

      <ElDialog
        v-model="dialogOpen"
        :class="{ 'knowledge-document-dialog': dialogMode === 'document' }"
        :title="dialogTitle"
        :width="dialogWidth"
      >
        <ElForm label-width="96px" :model="form">
          <template v-if="dialogMode === 'knowledge'">
            <ElFormItem label="名称">
              <ElInput v-model="form.name" maxlength="64" show-word-limit />
            </ElFormItem>
            <ElFormItem label="描述">
              <ElInput
                v-model="form.description"
                type="textarea"
                :rows="3"
                maxlength="180"
                show-word-limit
              />
            </ElFormItem>
            <ElFormItem label="向量模型">
              <LocalModelSelect
                v-model="form.embedding_model_id"
                model-type="EMBEDDING"
                placeholder="请选择向量模型"
              />
            </ElFormItem>
            <ElFormItem label="类型">
              <ElSelect v-model="form.type">
                <ElOption label="基础知识库" value="BASE" />
                <ElOption label="网页知识库" value="WEB" />
                <ElOption label="工作流知识库" value="WORKFLOW" />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="所属目录">
              <ElSelect
                v-model="form.folder_id"
                clearable
                placeholder="根目录 / 全部知识库"
              >
                <ElOption
                  v-for="item in folderOptions"
                  :key="item.id || 'root'"
                  :label="item.name"
                  :value="item.id ?? ''"
                />
              </ElSelect>
            </ElFormItem>
            <ElFormItem v-if="form.type === 'WEB'" label="网页地址">
              <ElInput
                v-model="form.source_url"
                placeholder="https://example.com/docs"
              />
            </ElFormItem>
            <ElFormItem v-if="form.type === 'WEB'" label="选择器">
              <ElInput
                v-model="form.selector"
                placeholder="可选，如 main.article"
              />
            </ElFormItem>
            <ElFormItem v-if="form.type === 'WORKFLOW'" label="工作流 JSON">
              <ElInput
                v-model="form.work_flow"
                type="textarea"
                :rows="4"
                placeholder="可选，按后端约定填写 work_flow"
              />
            </ElFormItem>
            <ElFormItem label="状态">
              <ElSelect v-model="form.enabled">
                <ElOption label="启用" :value="true" /><ElOption
                  label="停用"
                  :value="false"
                />
              </ElSelect>
            </ElFormItem>
          </template>

          <template v-else-if="dialogMode === 'document'">
            <div class="document-dialog">
              <h4 class="document-dialog__title">上传文档</h4>
              <ElTabs v-model="documentUploadTab" class="document-upload-tabs">
                <ElTabPane label="文本文件" name="text-file" />
                <ElTabPane label="表格" name="table" disabled />
                <ElTabPane label="QA 问答对" name="qa" disabled />
              </ElTabs>
              <template v-if="documentCreateMode === 'file'">
                <div class="document-upload-flow">
                  <ElAlert
                    type="info"
                    :closable="false"
                    show-icon
                    class="document-upload-alert"
                  >
                    <template #title>
                      <div class="document-upload-alert__content">
                        <p>
                          1. 支持上传
                          TXT、Markdown、PDF、DOCX、HTML、XLS、XLSX、CSV 文件。
                        </p>
                        <p>
                          2. 当前后端一次仅接收 1 个系统文件；知识库最多
                          {{ documentFileCountLimit }} 个文件，单文件不超过
                          {{ documentFileSizeLimit }} MB。
                        </p>
                      </div>
                    </template>
                  </ElAlert>
                  <ElUpload
                    v-model:file-list="documentUploadList"
                    :action="documentUploadAction"
                    accept=".txt,.md,.doc,.docx,.pdf,.html,.xls,.xlsx,.csv"
                    drag
                    :headers="documentUploadHeaders"
                    :limit="1"
                    :on-error="handleDocumentFileError"
                    :on-exceed="handleDocumentFileExceed"
                    :on-remove="handleDocumentFileRemove"
                    :on-success="handleDocumentFileSuccess"
                    :show-file-list="false"
                    class="document-upload"
                  >
                    <div class="document-upload__dropzone">
                      <span class="document-upload__icon"><UploadIcon /></span>
                      <div class="document-upload__text">
                        <p>
                          拖拽文件至此上传或
                          <em>选择文件</em>
                          <span
                            class="document-upload__disabled-action"
                            title="当前后端暂不支持文件夹上传"
                            @click.prevent.stop
                            v-text="'选择文件夹'"
                          ></span>
                        </p>
                        <span v-text="documentUploadFormatText"></span>
                      </div>
                    </div>
                  </ElUpload>
                  <div
                    class="document-upload-file"
                    :class="uploadedDocumentFile ? 'is-ready' : ''"
                  >
                    <span class="document-upload-file__icon"><Files /></span>
                    <div>
                      <strong>{{ uploadedDocumentFileName }}</strong>
                      <span v-if="uploadedDocumentFile">
                        已上传到系统文件，点击下一步后创建文档并进入解析向量化流程。
                      </span>
                      <span v-else v-text="documentUploadEmptyTip"></span>
                    </div>
                    <ElButton
                      v-if="uploadedDocumentFile"
                      link
                      type="danger"
                      @click="handleDocumentFileRemove"
                    >
                      移除
                    </ElButton>
                  </div>
                  <div class="document-upload-options">
                    <ElFormItem label="文档名称">
                      <ElInput
                        v-model="form.title"
                        placeholder="可选，留空则使用上传文件名"
                        maxlength="128"
                        show-word-limit
                      />
                    </ElFormItem>
                    <div class="document-split-config">
                      <div class="document-split-config__head">
                        <div>
                          <strong>分段规则</strong>
                          <span v-text="documentSplitConfigTip"></span>
                        </div>
                        <ElButton
                          link
                          type="primary"
                          @click="documentAdvancedOpen = !documentAdvancedOpen"
                        >
                          {{ documentAdvancedOpen ? '收起' : '展开' }}
                        </ElButton>
                      </div>
                      <ElInput
                        v-if="documentAdvancedOpen"
                        v-model="form.splitConfig"
                        type="textarea"
                        :rows="3"
                        placeholder="可选，按后端约定填写分段配置；留空则使用智能分段。"
                      />
                    </div>
                    <ElButton
                      link
                      type="primary"
                      @click="documentCreateMode = 'text'"
                    >
                      手动录入内容
                    </ElButton>
                  </div>
                  <p class="document-upload-disabled-tip">
                    表格、QA
                    问答对和文件夹上传入口暂未接入当前后端，已禁用而非模拟提交。
                  </p>
                </div>
              </template>
              <div v-else class="document-manual-panel">
                <div class="document-manual-panel__head">
                  <strong>手动录入内容</strong>
                  <ElButton
                    link
                    type="primary"
                    @click="documentCreateMode = 'file'"
                  >
                    返回文件上传
                  </ElButton>
                </div>
                <ElFormItem label="文档名称">
                  <ElInput
                    v-model="form.title"
                    maxlength="128"
                    placeholder="请输入文档名称"
                    show-word-limit
                  />
                </ElFormItem>
                <ElFormItem label="内容">
                  <ElInput
                    v-model="form.content"
                    type="textarea"
                    :rows="6"
                    placeholder="手动录入内容会创建文档并写入一个初始分段"
                  />
                </ElFormItem>
              </div>
            </div>
          </template>

          <template v-else-if="dialogMode === 'paragraph'">
            <ElFormItem label="标题">
              <ElInput v-model="form.title" />
            </ElFormItem>
            <ElFormItem label="内容">
              <ElInput v-model="form.content" type="textarea" :rows="6" />
            </ElFormItem>
          </template>

          <template v-else-if="dialogMode === 'problem'">
            <ElFormItem label="问题">
              <ElInput v-model="form.title" />
            </ElFormItem>
            <ElFormItem label="答案">
              <ElInput v-model="form.content" type="textarea" :rows="5" />
            </ElFormItem>
          </template>

          <template v-else-if="dialogMode === 'term'">
            <ElFormItem label="术语">
              <ElInput v-model="form.name" />
            </ElFormItem>
            <ElFormItem label="定义">
              <ElInput v-model="form.content" type="textarea" :rows="5" />
            </ElFormItem>
          </template>

          <template v-else>
            <ElFormItem label="标签键">
              <ElInput v-model="form.tagKey" placeholder="请输入标签键" />
            </ElFormItem>
            <ElFormItem label="标签值">
              <ElInput v-model="form.tagValue" placeholder="请输入标签值" />
            </ElFormItem>
          </template>
        </ElForm>
        <template #footer>
          <ElButton @click="dialogOpen = false">取消</ElButton>
          <ElButton type="primary" @click="saveDialog">
            {{ dialogMode === 'document' ? '下一步' : '保存' }}
          </ElButton>
        </template>
      </ElDialog>

      <ElDialog
        v-model="folderDialogOpen"
        :title="folderDialogTitle"
        width="620px"
      >
        <ElForm :model="folderForm" label-position="top">
          <ElFormItem label="名称">
            <ElInput v-model="folderForm.name" maxlength="64" show-word-limit />
          </ElFormItem>
          <ElFormItem label="描述">
            <ElInput
              v-model="folderForm.description"
              maxlength="128"
              show-word-limit
              type="textarea"
              :rows="3"
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

      <ElDialog v-model="folderMoveDialogOpen" title="转移到" width="460px">
        <ElForm label-width="90px" :model="folderMoveForm">
          <ElFormItem label="当前目录">
            <ElInput :model-value="folderDisplayName(movingFolder)" disabled />
          </ElFormItem>
          <ElFormItem label="目标目录">
            <ElSelect
              v-model="folderMoveForm.parent_id"
              placeholder="请选择目标目录"
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
          <ElButton type="primary" @click="saveFolderMove">移动</ElButton>
        </template>
      </ElDialog>

      <ElDialog v-model="moveDialogOpen" title="移动知识库" width="460px">
        <ElForm label-width="90px" :model="moveForm">
          <ElFormItem label="目标目录">
            <ElSelect
              v-model="moveForm.folder_id"
              clearable
              placeholder="根目录 / 全部知识库"
            >
              <ElOption
                v-for="item in folderOptions"
                :key="item.id || 'root'"
                :label="item.name"
                :value="item.id ?? ''"
              />
            </ElSelect>
          </ElFormItem>
          <ElAlert
            :title="`将移动 ${moveIds.length} 个知识库，选择根目录会清空 folderId`"
            type="info"
            :closable="false"
          />
        </ElForm>
        <template #footer>
          <ElButton @click="moveDialogOpen = false">取消</ElButton>
          <ElButton type="primary" @click="saveMove">移动</ElButton>
        </template>
      </ElDialog>

      <TagDrawer
        ref="tagDrawerRef"
        :knowledge-id="selectedKnowledge?.id"
        @refresh="loadRelated"
      />
      <TagSettingDrawer
        ref="tagSettingDrawerRef"
        :knowledge-id="selectedKnowledge?.id"
        @refresh="loadRelated"
      />
    </div>
  </Page>
</template>

<style scoped lang="scss">
.knowledge-console {
  --knowledge-space-1: 4px;
  --knowledge-space-2: 8px;
  --knowledge-space-3: 12px;
  --knowledge-space-4: 16px;
  --knowledge-space-5: 20px;
  --knowledge-space-6: 24px;
  --knowledge-radius: 6px;
  --knowledge-radius-lg: calc(
    var(--knowledge-radius) + var(--knowledge-space-1)
  );
  --knowledge-folder-pane-width: clamp(320px, 22vw, 360px);
  --knowledge-card-min-width: 292px;
  --knowledge-transition-fast: 0.18s ease;

  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.knowledge-console.is-detail-route {
  gap: var(--knowledge-space-3);
}

.knowledge-management-shell {
  display: grid;
  grid-template-columns: var(--knowledge-folder-pane-width) minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--knowledge-radius);
}

.detail-section,
.detail-empty,
.empty-panel,
.knowledge-card,
.knowledge-detail-panel {
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--knowledge-radius);
}

.knowledge-folder-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: var(--knowledge-space-4) var(--knowledge-space-2)
    var(--knowledge-space-3);
  overflow: hidden;
  border-right: 1px solid var(--el-border-color-lighter);
}

.folder-pane-header,
.folder-pane-controls,
.knowledge-list-header,
.knowledge-list-actions,
.pager,
.batch-operation-bar,
.detail-context-actions,
.section-title,
.tab-toolbar,
.search-box,
.detail-side-nav__identity,
.detail-side-nav__stats,
.document-section__header,
.detail-menu__label,
.knowledge-type-card,
.create-menu-item {
  display: flex;
  gap: var(--knowledge-space-2);
  align-items: center;
}

.folder-pane-header {
  flex-shrink: 0;
  padding: var(--knowledge-space-1) var(--knowledge-space-2)
    var(--knowledge-space-3);
}

.folder-pane-header h4 {
  margin: 0;
  font-size: calc(var(--font-size-base) * 1.25);
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.folder-pane-controls {
  flex-shrink: 0;
  padding: 0 var(--knowledge-space-2) var(--knowledge-space-2);
  margin-bottom: var(--knowledge-space-1);
}

.folder-search-input {
  flex: 1;
  min-width: 0;
}

.folder-sort-button {
  width: calc(var(--knowledge-space-4) * 2);
  height: calc(var(--knowledge-space-4) * 2);
  padding: 0;
}

.folder-search-input :deep(.el-input__wrapper) {
  min-height: calc(var(--knowledge-space-4) * 2);
}

.folder-sort-button svg,
.button-icon {
  width: calc(var(--font-size-base) * 0.875);
  height: calc(var(--font-size-base) * 0.875);
}

.folder-sort-menu {
  min-width: calc(var(--knowledge-space-5) * 10);
}

.folder-sort-option {
  display: flex;
  gap: var(--knowledge-space-4);
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.folder-sort-menu :deep(.el-dropdown-menu__item.is-active) {
  color: var(--el-color-primary);
}

.folder-sort-option__check,
.folder-action-menu__icon {
  width: calc(var(--font-size-base) * 1.125);
  height: calc(var(--font-size-base) * 1.125);
}

.folder-sort-option__check {
  color: var(--el-color-primary);
}

.folder-action-menu__icon {
  color: var(--el-text-color-secondary);
}

.folder-action-menu__item {
  display: inline-flex;
  gap: var(--knowledge-space-3);
  align-items: center;
}

.knowledge-folder-tree {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: transparent;
}

.knowledge-folder-tree :deep(.el-tree-node__content) {
  height: calc((var(--knowledge-space-4) * 2) + var(--knowledge-space-1));
  border-radius: var(--knowledge-radius);
}

.knowledge-folder-tree :deep(.el-tree-node__content:hover) {
  background: var(--el-fill-color-lighter);
}

.knowledge-folder-tree
  :deep(.el-tree-node.is-current > .el-tree-node__content) {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.folder-node {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
}

.folder-node__main {
  display: inline-flex;
  gap: var(--knowledge-space-2);
  align-items: center;
  min-width: 0;
}

.folder-node__icon {
  flex-shrink: 0;
  width: calc(var(--font-size-base) * 1.25);
  height: calc(var(--font-size-base) * 1.25);
  color: var(--el-color-warning);
}

.folder-node__label {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: calc(var(--font-size-base) * 0.875);
  white-space: nowrap;
}

.knowledge-folder-tree
  :deep(.el-tree-node.is-current > .el-tree-node__content .folder-node__label) {
  font-weight: 600;
  color: var(--el-color-primary);
}

.folder-node__actions {
  flex-shrink: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--knowledge-transition-fast);
}

.knowledge-folder-tree
  :deep(.el-tree-node__content:hover .folder-node__actions),
.knowledge-folder-tree
  :deep(
    .el-tree-node.is-current > .el-tree-node__content .folder-node__actions
  ),
.folder-node:focus-within .folder-node__actions {
  pointer-events: auto;
  opacity: 1;
}

.folder-node__more {
  width: calc(var(--knowledge-space-4) + var(--knowledge-space-2));
  height: calc(var(--knowledge-space-4) + var(--knowledge-space-2));
  color: var(--el-text-color-secondary);
}

.folder-node__more:hover {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.knowledge-list-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.knowledge-list-header {
  flex-shrink: 0;
  flex-wrap: wrap;
  padding: var(--knowledge-space-3) var(--knowledge-space-4);
}

.knowledge-list-title {
  flex: 1 1 240px;
  min-width: 0;
}

.folder-breadcrumb {
  display: flex;
  gap: var(--knowledge-space-1);
  align-items: center;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: calc(var(--font-size-base) * 1.125);
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.folder-breadcrumb__split {
  color: var(--el-text-color-placeholder);
}

.knowledge-header-divider {
  flex-shrink: 0;
  width: 1px;
  height: calc(var(--knowledge-space-5) + var(--knowledge-space-1));
  background: var(--el-border-color);
}

.knowledge-list-actions {
  flex: 0 1 auto;
  flex-wrap: wrap;
  min-width: 0;
}

.knowledge-type-select {
  width: 132px;
}

.knowledge-search-input {
  width: 220px;
}

.knowledge-card-scroll {
  flex: 1;
  min-height: 210px;
  padding: var(--knowledge-space-1) var(--knowledge-space-4) 0;
  overflow: auto;
}

.knowledge-card-grid {
  display: grid;
  grid-template-columns: repeat(
    auto-fill,
    minmax(var(--knowledge-card-min-width), 1fr)
  );
  gap: var(--knowledge-space-4);
  padding-bottom: var(--knowledge-space-3);
}

.knowledge-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 194px;
  overflow: hidden;
  cursor: pointer;
  transition:
    border-color var(--el-transition-duration),
    box-shadow var(--el-transition-duration);
}

.knowledge-card:hover,
.knowledge-card:focus-visible,
.knowledge-card.is-selected {
  border-color: var(--el-color-primary-light-5);
  box-shadow: var(--el-box-shadow-light);
}

.knowledge-card.is-selected {
  background: var(--el-color-primary-light-9);
}

.knowledge-card__body {
  flex: 1;
  padding: var(--knowledge-space-4);
}

.knowledge-card__head {
  display: flex;
  gap: var(--knowledge-space-3);
  align-items: flex-start;
}

.knowledge-avatar {
  display: inline-flex;
  flex: 0 0 calc(var(--knowledge-space-5) * 2);
  align-items: center;
  justify-content: center;
  width: calc(var(--knowledge-space-5) * 2);
  height: calc(var(--knowledge-space-5) * 2);
  overflow: hidden;
  font-size: calc(var(--font-size-base) * 0.875);
  font-weight: 800;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: var(--knowledge-radius);
}

.knowledge-avatar.is-web {
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-7);
}

.knowledge-avatar.is-workflow {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning-light-7);
}

.knowledge-card__identity {
  flex: 1;
  min-width: 0;
}

.knowledge-card__title-row {
  display: flex;
  gap: var(--knowledge-space-2);
  align-items: center;
}

.knowledge-card__title-row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: calc(var(--font-size-base) * 0.875);
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.knowledge-card__subtitle,
.knowledge-card__desc,
.knowledge-list-title__meta,
.pager,
.batch-operation-bar__summary,
.batch-operation-bar__names,
.create-menu-subtitle,
.detail-context-bar span,
.muted {
  font-size: calc(var(--font-size-base) * 0.75);
  color: var(--el-text-color-secondary);
}

.knowledge-card__subtitle {
  display: block;
  margin-top: var(--knowledge-space-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.knowledge-card__checkbox {
  flex-shrink: 0;
}

.knowledge-card__desc {
  display: -webkit-box;
  margin: var(--knowledge-space-3) 0 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  line-height: 1.6;
  -webkit-box-orient: vertical;
}

.knowledge-card__meta-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--knowledge-space-2);
  padding: 0 var(--knowledge-space-4) var(--knowledge-space-3);
}

.knowledge-card__meta-grid span {
  padding: var(--knowledge-space-2);
  font-size: calc(var(--font-size-base) * 0.75);
  color: var(--el-text-color-secondary);
  text-align: center;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--knowledge-radius);
}

.knowledge-card__meta-grid strong {
  margin-right: var(--knowledge-space-1);
  color: var(--el-text-color-primary);
}

.knowledge-card__footer {
  display: flex;
  gap: var(--knowledge-space-3);
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  padding: var(--knowledge-space-2) var(--knowledge-space-4);
  background: var(--el-fill-color-extra-light);
  border-top: 1px solid var(--el-border-color-lighter);
}

.knowledge-card__footer-side {
  display: inline-flex;
  flex-shrink: 0;
  gap: var(--knowledge-space-2);
  align-items: center;
}

.knowledge-card__status {
  display: inline-flex;
  flex: 1;
  gap: var(--knowledge-space-2);
  align-items: center;
  min-width: 0;
  font-size: calc(var(--font-size-base) * 0.75);
  color: var(--el-text-color-secondary);
}

.knowledge-card__status.is-enabled {
  color: var(--el-color-success);
}

.knowledge-card__status-icon,
.knowledge-card__status-dot {
  display: inline-flex;
  width: calc(var(--knowledge-space-2) + var(--knowledge-space-1));
  height: calc(var(--knowledge-space-2) + var(--knowledge-space-1));
}

.knowledge-card__status-dot {
  background: var(--el-text-color-placeholder);
  border-radius: 50%;
}

.knowledge-card__hover-actions {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--el-transition-duration);
}

.knowledge-card:hover .knowledge-card__hover-actions,
.knowledge-card:focus-within .knowledge-card__hover-actions {
  pointer-events: auto;
  opacity: 1;
}

.empty-panel,
.detail-empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-panel {
  height: 100%;
}

.pager {
  flex-shrink: 0;
  justify-content: space-between;
  padding: var(--knowledge-space-2) var(--knowledge-space-4)
    var(--knowledge-space-3);
}

.batch-operation-bar {
  flex-shrink: 0;
  min-height: 50px;
  padding: var(--knowledge-space-2) var(--knowledge-space-4);
  border-top: 1px solid var(--el-border-color-lighter);
}

.batch-operation-bar__summary {
  flex: 1;
  min-width: max-content;
}

.batch-operation-bar__names {
  max-width: 32%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.knowledge-detail-panel {
  display: grid;
  flex: 1;
  grid-template-columns:
    minmax(
      calc(var(--knowledge-space-5) * 12),
      calc(var(--knowledge-space-5) * 14)
    )
    minmax(0, 1fr);
  min-height: 0;
  margin: 0;
  overflow: hidden;
}

.knowledge-route-detail {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--knowledge-space-3);
  min-height: 0;
}

.detail-route-header {
  display: flex;
  flex-shrink: 0;
  gap: var(--knowledge-space-3);
  align-items: center;
  justify-content: space-between;
  padding: var(--knowledge-space-3) var(--knowledge-space-4);
  background:
    radial-gradient(
      circle at 0% 0%,
      var(--el-color-primary-light-9),
      hsl(var(--card) / 0%) 42%
    ),
    hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--knowledge-radius);
}

.detail-route-header__title {
  display: flex;
  gap: var(--knowledge-space-3);
  align-items: center;
  min-width: 0;
}

.detail-route-header__title > div > strong {
  display: block;
  color: var(--el-text-color-primary);
}

.detail-route-header__title > div > span {
  display: block;
  margin-top: var(--knowledge-space-1);
  font-size: calc(var(--font-size-base) * 0.75);
  color: var(--el-text-color-secondary);
}

.detail-side-nav {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: var(--knowledge-space-4) var(--knowledge-space-3);
  overflow: hidden;
  background: linear-gradient(
    180deg,
    var(--el-fill-color-extra-light),
    hsl(var(--card)) 42%
  );
  border-right: 1px solid var(--el-border-color-lighter);
}

.detail-side-nav__summary {
  display: grid;
  flex-shrink: 0;
  gap: var(--knowledge-space-3);
  padding: 0 var(--knowledge-space-2) var(--knowledge-space-4);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.detail-side-nav__identity > div {
  min-width: 0;
}

.detail-side-nav__description {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  color: var(--el-text-color-secondary);
  -webkit-box-orient: vertical;
}

.detail-side-nav__stats {
  justify-content: space-between;
  padding: var(--knowledge-space-2);
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--knowledge-radius-lg);
}

.detail-side-nav__stats span {
  display: grid;
  gap: var(--knowledge-space-1);
  min-width: 0;
}

.detail-side-nav__stats em {
  font-style: normal;
}

.detail-side-nav__summary .knowledge-avatar {
  font-size: calc(var(--font-size-base) * 0.875);
  color: var(--el-color-primary);
}

.detail-side-nav__summary .knowledge-avatar.is-web {
  color: var(--el-color-success);
}

.detail-side-nav__summary .knowledge-avatar.is-workflow {
  color: var(--el-color-warning);
}

.detail-side-nav__summary strong,
.knowledge-type-card strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.detail-side-nav__summary span,
.knowledge-type-card span,
.detail-menu__subtitle,
.form-item-tip {
  font-size: calc(var(--font-size-base) * 0.75);
  color: var(--el-text-color-secondary);
}

.detail-menu {
  flex: 1;
  min-height: 0;
  padding-top: var(--knowledge-space-2);
  overflow: auto;
  background: transparent;
  border-right: 0;
}

.detail-menu :deep(.el-menu-item) {
  display: flex;
  gap: var(--knowledge-space-2);
  align-items: center;
  min-width: 0;
  height: auto;
  min-height: calc((var(--knowledge-space-4) * 2) + var(--knowledge-space-2));
  padding: var(--knowledge-space-1) var(--knowledge-space-2) !important;
  margin-bottom: var(--knowledge-space-1);
  line-height: calc(var(--font-size-base) + var(--knowledge-space-1));
  color: var(--el-text-color-regular);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--knowledge-radius);
  transition:
    background-color var(--knowledge-transition-fast),
    border-color var(--knowledge-transition-fast),
    color var(--knowledge-transition-fast);
}

.detail-menu :deep(.el-menu-item:hover) {
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color-lighter);
}

.detail-menu :deep(.el-menu-item.is-active) {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-7);
}

.detail-menu :deep(.el-menu-item.is-active .detail-menu__icon-shell) {
  color: var(--el-color-primary);
  background: hsl(var(--card));
  border-color: var(--el-color-primary-light-7);
}

.detail-menu__icon-shell {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: calc(var(--knowledge-space-4) + var(--knowledge-space-2));
  height: calc(var(--knowledge-space-4) + var(--knowledge-space-2));
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--knowledge-radius);
}

.detail-menu__icon {
  width: var(--knowledge-space-4);
  height: var(--knowledge-space-4);
}

.detail-menu__copy {
  display: flex;
  flex: 1;
  gap: var(--knowledge-space-1);
  align-items: baseline;
  min-width: 0;
  line-height: calc(var(--font-size-base) + var(--knowledge-space-1));
}

.detail-menu__label {
  flex-shrink: 0;
  min-width: 0;
  font-weight: 600;
}

.detail-menu__label,
.detail-menu__subtitle {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-menu__subtitle {
  min-width: 0;
}

.detail-menu__count {
  flex-shrink: 0;
  justify-content: center;
  min-width: calc(var(--knowledge-space-5) + var(--knowledge-space-2));
  font-weight: 600;
}

.detail-menu :deep(.el-menu-item.is-active .detail-menu__count) {
  color: var(--el-color-primary);
  background: hsl(var(--card));
  border-color: var(--el-color-primary-light-7);
}

.detail-content-panel {
  min-width: 0;
  min-height: 0;
  padding: var(--knowledge-space-3);
  overflow: hidden;
}

.detail-tab-pane {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.detail-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: var(--knowledge-space-3);
  overflow: hidden;
}

.section-title {
  flex-shrink: 0;
  justify-content: space-between;
  margin-bottom: var(--knowledge-space-2);
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.tab-toolbar {
  margin-bottom: var(--knowledge-space-2);
}

.search-box {
  margin-bottom: var(--knowledge-space-2);
}

.search-box .el-input {
  flex: 1;
}

.document-section,
.paragraph-section {
  height: 100%;
}

.document-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  background: hsl(var(--card));
}

.document-section__header {
  flex-shrink: 0;
  padding: var(--knowledge-space-4) var(--knowledge-space-5)
    var(--knowledge-space-2);
  background: hsl(var(--card));
}

.document-section__header h3 {
  margin: 0;
  font-size: calc(var(--font-size-base) * 1.125);
  font-weight: 700;
  line-height: 1.3;
  color: var(--el-text-color-primary);
}

.document-toolbar,
.paragraph-header,
.paragraph-toolbar,
.hit-result-card__head,
.hit-result-card__footer {
  display: flex;
  gap: var(--knowledge-space-2);
  align-items: center;
}

.document-toolbar,
.paragraph-header {
  flex-shrink: 0;
  justify-content: space-between;
  margin-bottom: var(--knowledge-space-2);
}

.document-toolbar {
  padding: 0 var(--knowledge-space-5) var(--knowledge-space-3);
  margin-bottom: 0;
  background: hsl(var(--card));
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.document-toolbar__left,
.document-toolbar__right {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--knowledge-space-2);
  align-items: center;
}

.document-toolbar__left,
.paragraph-header__title {
  display: inline-flex;
  gap: var(--knowledge-space-2);
  align-items: center;
  min-width: 0;
}

.document-toolbar__right {
  justify-content: flex-end;
  min-width: 0;
}

.paragraph-header__title strong {
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.paragraph-header__actions {
  display: inline-flex;
  gap: var(--knowledge-space-2);
  align-items: center;
}

.document-search-input,
.paragraph-search-input {
  max-width: calc(var(--knowledge-space-5) * 16);
}

.document-field-select {
  width: calc(var(--knowledge-space-5) * 5);
}

.document-enabled-filter {
  width: calc(var(--knowledge-space-5) * 6);
}

.document-search-input {
  width: calc(var(--knowledge-space-5) * 13);
}

.document-table-shell {
  flex: 1;
  min-height: 0;
  padding: var(--knowledge-space-3) var(--knowledge-space-5)
    var(--knowledge-space-5);
  background: var(--el-fill-color-extra-light);
}

.document-table {
  height: 100%;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--knowledge-radius);
}

.document-table :deep(.el-table__cell) {
  padding: var(--knowledge-space-2) 0;
}

.document-table :deep(.el-table__header th.el-table__cell) {
  font-weight: 700;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
}

.document-table :deep(.el-table__body tr) {
  cursor: pointer;
}

.document-table
  :deep(.el-table__body tr.is-document-selected > td.el-table__cell) {
  background: var(--el-color-primary-light-9);
}

.document-name-cell {
  display: flex;
  gap: var(--knowledge-space-2);
  align-items: center;
  min-width: 0;
}

.document-name-cell__icon {
  display: inline-flex;
  flex: 0 0 calc(var(--knowledge-space-6) + var(--knowledge-space-1));
  align-items: center;
  justify-content: center;
  width: calc(var(--knowledge-space-6) + var(--knowledge-space-1));
  height: calc(var(--knowledge-space-6) + var(--knowledge-space-1));
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: var(--knowledge-radius);
}

.document-name-cell__icon :deep(svg),
.document-upload__icon :deep(svg),
.document-upload-file__icon :deep(svg),
.document-dialog__hero-icon :deep(svg) {
  width: calc(var(--font-size-base) * 1.125);
  height: calc(var(--font-size-base) * 1.125);
}

.document-name-cell__main {
  display: grid;
  gap: var(--knowledge-space-1);
  min-width: 0;
}

.document-name-cell__title {
  display: block;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font: inherit;
  font-weight: 600;
  line-height: calc(var(--knowledge-space-5));
  color: var(--el-color-primary);
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.document-name-cell__meta,
.document-table-tag-empty,
.document-time-cell {
  font-size: calc(var(--font-size-base) * 0.75);
  color: var(--el-text-color-secondary);
}

.document-name-cell__meta {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.document-table-number {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.document-vector-status {
  display: inline-flex;
  gap: var(--knowledge-space-2);
  align-items: center;
  min-width: 0;
  line-height: 1.25;
}

.document-vector-status__icon {
  display: inline-flex;
  flex-shrink: 0;
  color: var(--el-color-info);
}

.document-vector-status__copy {
  display: grid;
  gap: var(--knowledge-space-1);
  min-width: 0;
}

.document-vector-status__copy strong,
.document-vector-status__copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.document-vector-status__copy strong {
  font-size: calc(var(--font-size-base) * 0.8125);
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.document-vector-status__copy small {
  font-size: calc(var(--font-size-base) * 0.75);
  color: var(--el-text-color-secondary);
}

.document-vector-status.is-success .document-vector-status__icon {
  color: var(--el-color-success);
}

.document-vector-status.is-failed .document-vector-status__icon {
  color: var(--el-color-danger);
}

.document-vector-status.is-canceled .document-vector-status__icon {
  color: var(--el-color-warning);
}

.document-vector-status.is-processing .document-vector-status__icon,
.document-vector-status.is-waiting .document-vector-status__icon {
  color: var(--el-color-primary);
}

.document-enable-switch {
  display: inline-flex;
  align-items: center;
}

.document-table-tags,
.document-table-actions {
  display: flex;
  gap: var(--knowledge-space-1);
  align-items: center;
}

.document-table-tags {
  flex-wrap: wrap;
  min-width: 0;
}

.document-table-actions {
  justify-content: flex-end;
}

.document-time-cell {
  display: grid;
  gap: var(--knowledge-space-1);
}

.document-table-empty {
  padding: var(--knowledge-space-6) 0;
}

.paragraph-search-type {
  width: 86px;
}

.paragraph-toolbar {
  flex-shrink: 0;
  justify-content: flex-end;
  margin-bottom: var(--knowledge-space-2);
}

.paragraph-content-cell,
.hit-result-card__content {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hit-result-list {
  height: calc(100% - 42px);
  overflow: auto;
}

.hit-result-card {
  padding: var(--knowledge-space-3);
  margin-bottom: var(--knowledge-space-2);
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--knowledge-radius);
}

.hit-result-card__head strong {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.hit-result-card__index {
  display: inline-flex;
  flex: 0 0 calc(var(--knowledge-space-5) + var(--knowledge-space-1));
  align-items: center;
  justify-content: center;
  width: calc(var(--knowledge-space-5) + var(--knowledge-space-1));
  height: calc(var(--knowledge-space-5) + var(--knowledge-space-1));
  font-size: calc(var(--font-size-base) * 0.75);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 50%;
}

.hit-result-card__content {
  margin: var(--knowledge-space-2) 0;
  color: var(--el-text-color-regular);
}

.hit-result-card__footer {
  font-size: calc(var(--font-size-base) * 0.75);
  color: var(--el-text-color-secondary);
}

.hit-result-card__icon {
  width: calc(var(--font-size-base) * 0.875);
  height: calc(var(--font-size-base) * 0.875);
}

.setting-section {
  max-width: calc(var(--knowledge-space-5) * 34);
}

.knowledge-type-card {
  padding: var(--knowledge-space-3);
  margin-bottom: var(--knowledge-space-4);
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--knowledge-radius);
}

.knowledge-type-card.is-web {
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-7);
}

.knowledge-type-card.is-workflow {
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning-light-7);
}

.form-item-tip {
  margin-left: var(--knowledge-space-2);
}

.detail-empty {
  flex: 1;
  margin: 0;
}

.document-dialog {
  display: grid;
  gap: var(--knowledge-space-3);
}

.document-dialog__title {
  margin: 0;
  font-size: calc(var(--font-size-base) * 1.125);
  font-weight: 700;
  line-height: 1.4;
  color: var(--el-text-color-primary);
}

.document-upload-tabs {
  margin-bottom: calc(var(--knowledge-space-2) * -1);
}

.document-upload-tabs :deep(.el-tabs__header) {
  margin-bottom: var(--knowledge-space-3);
}

.document-upload-alert :deep(.el-alert__title) {
  display: block;
  width: 100%;
}

.document-upload-alert__content {
  display: grid;
  gap: var(--knowledge-space-1);
  width: 100%;
}

.document-upload-alert__content p,
.document-upload-disabled-tip {
  margin: 0;
}

.document-upload-disabled-tip {
  font-size: calc(var(--font-size-base) * 0.75);
  color: var(--el-text-color-secondary);
}

.document-dialog__hero {
  display: flex;
  gap: var(--knowledge-space-3);
  align-items: flex-start;
  padding: var(--knowledge-space-4);
  margin-bottom: var(--knowledge-space-1);
  background:
    radial-gradient(
      circle at 0% 0%,
      var(--el-color-primary-light-9),
      hsl(var(--card) / 0%) 48%
    ),
    var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--knowledge-radius-lg);
}

.document-dialog__hero-icon,
.document-upload__icon,
.document-upload-file__icon {
  display: inline-flex;
  flex: 0 0 calc(var(--knowledge-space-5) * 2);
  align-items: center;
  justify-content: center;
  width: calc(var(--knowledge-space-5) * 2);
  height: calc(var(--knowledge-space-5) * 2);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: var(--knowledge-radius-lg);
}

.document-dialog__hero strong,
.document-split-config__head strong,
.document-upload-file strong,
.document-upload__dropzone strong {
  display: block;
  color: var(--el-text-color-primary);
}

.document-dialog__hero p,
.document-split-config__head span,
.document-upload-file span,
.document-upload__dropzone p {
  margin: var(--knowledge-space-1) 0 0;
  color: var(--el-text-color-secondary);
}

.document-mode-group {
  display: inline-flex;
}

.document-upload-flow {
  display: grid;
  gap: var(--knowledge-space-3);
  width: 100%;
}

.document-upload {
  width: 100%;
}

.document-upload :deep(.el-upload),
.document-upload :deep(.el-upload-dragger) {
  width: 100%;
}

.document-upload :deep(.el-upload-dragger) {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(var(--knowledge-space-5) * 9);
  padding: var(--knowledge-space-6);
  background: hsl(var(--card));
  border-color: var(--el-border-color);
  border-radius: var(--knowledge-radius-lg);
}

.document-upload :deep(.el-upload-dragger:hover) {
  border-color: var(--el-color-primary);
}

.document-upload__dropzone {
  display: grid;
  gap: var(--knowledge-space-2);
  justify-items: center;
  width: 100%;
  text-align: center;
}

.document-upload__text {
  display: grid;
  gap: var(--knowledge-space-2);
  color: var(--el-text-color-secondary);
}

.document-upload__text p {
  margin: 0;
  font-size: calc(var(--font-size-base) * 0.9375);
  color: var(--el-text-color-primary);
}

.document-upload__text em,
.document-upload__disabled-action {
  font-style: normal;
}

.document-upload__text em {
  color: var(--el-color-primary);
}

.document-upload__disabled-action {
  margin-left: var(--knowledge-space-1);
  color: var(--el-text-color-placeholder);
  cursor: not-allowed;
}

.document-upload-options,
.document-manual-panel {
  display: grid;
  gap: var(--knowledge-space-3);
}

.document-upload-options :deep(.el-form-item),
.document-manual-panel :deep(.el-form-item) {
  margin-bottom: 0;
}

.document-manual-panel {
  padding: var(--knowledge-space-3);
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--knowledge-radius-lg);
}

.document-manual-panel__head {
  display: flex;
  gap: var(--knowledge-space-3);
  align-items: center;
  justify-content: space-between;
}

.document-manual-panel__head strong {
  color: var(--el-text-color-primary);
}

.document-upload-file {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--knowledge-space-3);
  align-items: center;
  padding: var(--knowledge-space-3);
  background: var(--el-fill-color-extra-light);
  border: 1px dashed var(--el-border-color);
  border-radius: var(--knowledge-radius-lg);
}

.document-upload-file.is-ready {
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-7);
}

.document-upload-file.is-ready .document-upload-file__icon {
  color: var(--el-color-success);
  background: hsl(var(--card));
  border-color: var(--el-color-success-light-7);
}

.document-upload-file > div {
  min-width: 0;
}

.document-upload-file strong,
.document-upload-file span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.document-upload-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--knowledge-space-2);
}

.document-upload-steps span {
  display: inline-flex;
  gap: var(--knowledge-space-2);
  align-items: center;
  padding: var(--knowledge-space-2) var(--knowledge-space-3);
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-extra-light);
  border-radius: var(--knowledge-radius);
}

.document-upload-steps strong {
  display: inline-flex;
  flex: 0 0 var(--knowledge-space-5);
  align-items: center;
  justify-content: center;
  width: var(--knowledge-space-5);
  height: var(--knowledge-space-5);
  font-size: calc(var(--font-size-base) * 0.75);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 50%;
}

.document-split-config {
  display: grid;
  gap: var(--knowledge-space-2);
  width: 100%;
  padding: var(--knowledge-space-3);
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--knowledge-radius-lg);
}

.document-split-config__head {
  display: flex;
  gap: var(--knowledge-space-3);
  align-items: flex-start;
  justify-content: space-between;
}

.document-tag-filter {
  display: grid;
  gap: var(--knowledge-space-2);
  min-width: calc(var(--knowledge-space-5) * 16);
  padding: var(--knowledge-space-2);
}

.document-tag-filter__actions {
  display: flex;
  justify-content: flex-end;
}

.paragraph-layout {
  display: grid;
  grid-template-columns: minmax(200px, 240px) minmax(0, 1fr);
  gap: var(--knowledge-space-3);
  min-height: 0;
}

.paragraph-sidebar {
  min-height: 0;
  padding-right: var(--knowledge-space-2);
  border-right: 1px solid var(--el-border-color-lighter);
}

.paragraph-scrollbar,
.paragraph-list-scrollbar {
  height: 100%;
}

.paragraph-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.paragraph-card-list {
  display: grid;
  gap: var(--knowledge-space-3);
  padding-right: var(--knowledge-space-2);
}

.paragraph-card {
  --el-card-padding: 12px 16px;

  cursor: pointer;
  transition:
    border-color var(--knowledge-transition-fast),
    box-shadow var(--knowledge-transition-fast);
}

.paragraph-card.is-selected {
  border-color: var(--el-color-primary);
  box-shadow: var(--el-box-shadow-light);
}

.paragraph-card__header {
  display: flex;
  gap: var(--knowledge-space-2);
  align-items: flex-start;
  justify-content: space-between;
}

.paragraph-card__title-row {
  display: flex;
  gap: var(--knowledge-space-2);
  align-items: center;
  min-width: 0;
}

.paragraph-card__title-row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.paragraph-card__actions {
  flex-shrink: 0;
  white-space: nowrap;
}

.paragraph-card__content {
  display: -webkit-box;
  margin: var(--knowledge-space-3) 0 var(--knowledge-space-2);
  overflow: hidden;
  -webkit-line-clamp: 3;
  color: var(--el-text-color-secondary);
  -webkit-box-orient: vertical;
}

.paragraph-card__footer {
  display: flex;
  gap: var(--knowledge-space-3);
  align-items: center;
  justify-content: space-between;
  font-size: calc(var(--font-size-base) * 0.75);
  color: var(--el-text-color-secondary);
}

.search-options {
  display: grid;
  gap: var(--knowledge-space-3);
}

.search-options__title,
.search-options__label {
  font-size: calc(var(--font-size-base) * 0.875);
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.search-options__radios {
  display: grid;
  gap: var(--knowledge-space-2);
}

.search-options__card.is-active {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
}

.search-options__card {
  --el-card-padding: 10px 12px;
}

.search-options__card-body {
  display: grid;
  gap: var(--knowledge-space-1);
  margin-left: var(--knowledge-space-2);
}

.search-options__card-body strong {
  color: var(--el-text-color-primary);
}

.search-options__card-body span {
  font-size: calc(var(--font-size-base) * 0.75);
  color: var(--el-text-color-secondary);
}

.search-options__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--knowledge-space-3);
}

:global(.knowledge-create-dropdown) {
  min-width: 260px;
  padding: var(--knowledge-space-2, 8px) 0;
}

:global(.knowledge-create-dropdown .el-upload) {
  display: block;
}

:global(.knowledge-create-dropdown .el-dropdown-menu__item) {
  min-height: 58px;
  padding: var(--knowledge-space-2, 8px) var(--knowledge-space-4, 16px);
  line-height: 1;
}

:global(.knowledge-create-dropdown .el-dropdown-menu__item.is-divided) {
  margin-top: var(--knowledge-space-2, 8px);
  border-top-color: var(--el-border-color-lighter);
}

:global(.knowledge-create-dropdown .el-dropdown-menu__item.is-divided::before) {
  height: var(--knowledge-space-2, 8px);
  margin: 0 calc(var(--knowledge-space-4, 16px) * -1);
}

:global(.knowledge-document-dialog .el-dialog__body) {
  padding-top: 0;
  padding-bottom: 0;
}

:global(.knowledge-document-dialog .el-dialog__footer) {
  position: sticky;
  bottom: 0;
  padding: var(--el-dialog-padding-primary);
  background: hsl(var(--card));
  border-top: 1px solid var(--el-border-color-lighter);
}

.create-menu-item {
  width: 100%;
}

.create-menu-icon {
  display: inline-flex;
  flex: 0 0 calc(var(--knowledge-space-4) * 2);
  align-items: center;
  justify-content: center;
  width: calc(var(--knowledge-space-4) * 2);
  height: calc(var(--knowledge-space-4) * 2);
  overflow: hidden;
  font-size: calc(var(--font-size-base) * 1.125);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: calc(var(--knowledge-radius) + 2px);
}

.create-menu-icon :deep(svg) {
  width: calc(var(--font-size-base) * 1.125);
  height: calc(var(--font-size-base) * 1.125);
}

.create-menu-icon.is-create-green {
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
}

.create-menu-icon.is-create-orange,
.create-menu-icon.is-create-folder {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
}

.create-menu-icon.is-create-import {
  color: var(--el-color-info);
  background: var(--el-fill-color-light);
}

.create-menu-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.create-menu-label {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: calc(var(--font-size-base) * 0.875);
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.create-menu-subtitle {
  max-width: 190px;
  margin-top: var(--knowledge-space-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 960px) {
  .knowledge-management-shell {
    grid-template-columns: 1fr;
  }

  .knowledge-folder-pane {
    max-height: 280px;
    border-right: 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .knowledge-list-header,
  .knowledge-list-actions,
  .document-section__header,
  .document-toolbar,
  .batch-operation-bar {
    flex-wrap: wrap;
  }

  .knowledge-search-input,
  .knowledge-type-select,
  .document-field-select,
  .document-search-input {
    width: 100%;
    max-width: none;
  }

  .knowledge-detail-panel {
    grid-template-columns: 1fr;
  }

  .detail-side-nav {
    max-height: 260px;
    border-right: 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .document-upload-steps {
    grid-template-columns: 1fr;
  }

  .document-toolbar__left,
  .document-toolbar__right,
  .document-upload-file,
  .document-split-config__head {
    flex-direction: column;
    grid-template-columns: 1fr;
    align-items: flex-start;
    width: 100%;
  }

  .batch-operation-bar__names {
    display: none;
  }
}
</style>
