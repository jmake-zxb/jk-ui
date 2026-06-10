<script setup lang="ts">
import type { UploadFile, UploadFiles } from 'element-plus';

import type { Component } from 'vue';

import type {
  InitParamValue,
  InitParamValues,
} from './component/init-param-utils';
import type { ToolSearchType } from './component/tool-query-utils';

import type {
  AiToolType,
  ToolFieldSchema,
  ToolFolderRequest,
  ToolRequest,
} from '#/api/ai/tools';
import type { BasicUserInfo } from '#/api/core/user';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { confirm, Page } from '@vben/common-ui';

import {
  Check,
  Connection,
  Delete,
  Download as DownloadIcon,
  EditPen,
  Files,
  FolderAdd,
  FolderOpened,
  Lock,
  MagicStick,
  MoreFilled,
  Operation,
  Plus,
  Promotion,
  Rank,
  Search,
  ShoppingCart,
  Sort,
  Upload as UploadIcon,
} from '@element-plus/icons-vue';
import {
  ElAlert,
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
  ElInput,
  ElInputNumber,
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
  ElTree,
  ElUpload,
} from 'element-plus';
import { cloneDeep } from 'lodash-es';

import {
  addInternalTool as addInternalToolApi,
  addStoreTool,
  batchDeleteTools,
  batchMoveTools,
  createTool,
  createToolFolder,
  debugDraftTool,
  debugTool,
  deleteTool,
  deleteToolFolder,
  downloadSkillFile,
  editToolIcon,
  exportTool,
  getTool,
  importTool,
  listInternalTools,
  listStoreTools,
  pageToolRecords,
  pageTools,
  pylintTool,
  testToolConnection,
  treeTools,
  updateStoreTool,
  updateTool,
  updateToolFolder,
  uploadSkillFile,
} from '#/api/ai/tools';
import { pageList as pageUserList } from '#/api/core/user';
import { CodeEditor } from '#/component';

import {
  enabledText,
  prettyJson,
  recordsOf,
  safeParseJson,
  statusType,
  totalOf,
} from '../utils';
import DynamicInitForm from './component/DynamicInitForm.vue';
import GenerateCodeDialog from './component/GenerateCodeDialog.vue';
import {
  normalizeInitFields,
  parseInitParamsText,
  seedInitParams,
  stringifyInitParamsForPayload,
  validateInitParamValues,
} from './component/init-param-utils';
import InitParamDrawer from './component/InitParamDrawer.vue';
import {
  buildToolPayload,
  defaultCodeForToolType,
  DEFAULT_CONFIG_JSON as defaultConfigJson,
  DEFAULT_WORKFLOW_JSON as defaultWorkflowJson,
  isValidMcpServerConfigJson,
  keepLatestSkillZipFiles,
  MAX_SKILL_ZIP_FILE_SIZE_MB,
  MCP_SERVER_JSON_EXAMPLE as mcpServerJsonExample,
  supportsToolAiGenerate,
  validateSkillZipFile,
} from './component/tool-form-utils';
import {
  buildToolSearchParams,
  normalizeCreatorLabel,
  normalizeCreatorValue,
} from './component/tool-query-utils';

type Id = number | string;
type DebugControl =
  | 'boolean'
  | 'json'
  | 'multiselect'
  | 'number'
  | 'select'
  | 'text'
  | 'textarea';
type FieldMode = 'init' | 'input';
type FolderSortType =
  | 'createTimeAsc'
  | 'createTimeDesc'
  | 'nameAsc'
  | 'nameDesc';
type InitParamTab = 'form' | 'raw';
type StoreTab = 'internal' | 'store';

interface ToolRecord extends Record<string, unknown> {
  code?: string;
  configJson?: string;
  config_json?: string;
  createTime?: string;
  create_time?: string;
  desc?: string;
  description?: string;
  enabled?: boolean;
  folderId?: Id;
  folder_id?: Id;
  icon?: string;
  id?: Id;
  initFieldList?: string | ToolFieldSchema[];
  initParams?: Record<string, unknown> | string;
  init_field_list?: string | ToolFieldSchema[];
  init_params?: Record<string, unknown> | string;
  inputFieldList?: string | ToolFieldSchema[];
  input_field_list?: string | ToolFieldSchema[];
  isActive?: boolean;
  is_active?: boolean;
  label?: string;
  name?: string;
  scope?: string;
  templateId?: Id;
  template_id?: Id;
  toolType?: string;
  tool_type?: string;
  updateTime?: string;
  update_time?: string;
  version?: string;
  workFlow?: Record<string, unknown> | string;
  work_flow?: Record<string, unknown> | string;
  workflow?: Record<string, unknown>;
  workspaceId?: string;
  workspace_id?: string;
}

interface ToolFolder extends Record<string, unknown> {
  children?: ToolFolder[];
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

interface ToolFormState {
  code: string;
  config_json: string;
  description: string;
  enabled: boolean;
  folder_id?: Id;
  icon: string;
  id?: Id;
  init_field_list: ToolFieldSchema[];
  init_params: string;
  input_field_list: ToolFieldSchema[];
  label: string;
  name: string;
  scope: string;
  tool_type: AiToolType;
  version: string;
  workspace_id: string;
}

interface FieldFormState {
  attrs_json: string;
  default_value: string;
  desc: string;
  field: string;
  input_type: string;
  is_required: boolean;
  label: string;
  name: string;
  option_list_json: string;
  required: boolean;
  show_default_value: boolean;
  source: string;
  type: string;
}

interface DebugOption {
  label: string;
  value: boolean | number | string;
}

interface DebugFieldView {
  control: DebugControl;
  desc: string;
  inputType: string;
  key: string;
  label: string;
  options: DebugOption[];
  required: boolean;
  schema: ToolFieldSchema;
  type: string;
}

interface JsonSyntaxResult {
  column?: number;
  line?: number;
  message: string;
  valid: boolean;
}

interface PythonSyntaxDiagnostic {
  column?: number;
  line?: number;
  message: string;
  type: string;
}

interface PythonSyntaxRecord extends Record<string, unknown> {
  column?: number;
  line?: number;
  message?: string;
  type?: string;
}

interface ToolFileRecord extends Record<string, unknown> {
  contentBase64?: string;
  contentType?: string;
  content_base64?: string;
  content_type?: string;
  fileName?: string;
  fileSize?: number;
  file_name?: string;
  file_size?: number;
  id?: Id;
}

interface CreatorOption {
  label: string;
  value: Id;
}

interface CreateMenuItem {
  icon: Component;
  iconClass: string;
  label: string;
  type: AiToolType;
}

const rootFolderId = '__root__';
const searchTypeOptions: Array<{ label: string; value: ToolSearchType }> = [
  { label: '名称', value: 'name' },
  { label: '创建者', value: 'create_user' },
];
const createMenuItems: CreateMenuItem[] = [
  {
    icon: Operation,
    iconClass: 'is-create-green',
    label: '工具',
    type: 'CUSTOM',
  },
  {
    icon: Connection,
    iconClass: 'is-create-green',
    label: '工作流',
    type: 'WORKFLOW',
  },
  {
    icon: MagicStick,
    iconClass: 'is-create-blue',
    label: 'Skills',
    type: 'SKILL',
  },
  { icon: Promotion, iconClass: 'is-create-blue', label: 'MCP', type: 'MCP' },
  {
    icon: Files,
    iconClass: 'is-create-purple',
    label: '数据源',
    type: 'DATA_SOURCE',
  },
];
const toolTypes: Array<{ label: string; value: '' | AiToolType }> = [
  { label: '全部类型', value: '' },
  { label: '自定义工具', value: 'CUSTOM' },
  { label: 'Skill 技能', value: 'SKILL' },
  { label: '工作流工具', value: 'WORKFLOW' },
  { label: 'MCP', value: 'MCP' },
  { label: '数据源', value: 'DATA_SOURCE' },
  { label: '内置', value: 'INTERNAL' },
  { label: 'HTTP 旧版', value: 'HTTP' },
  { label: 'MOCK 旧版', value: 'MOCK' },
];
const creatableToolTypes = toolTypes.filter(
  (item): item is { label: string; value: AiToolType } => item.value !== '',
);
const inputTypeOptions = ['string', 'int', 'float', 'boolean', 'dict', 'array'];
const initInputTypeOptions = [
  'TextInput',
  'PasswordInput',
  'SingleSelect',
  'MultiSelect',
  'SwitchInput',
  'Slider',
  'DatePicker',
  'JsonInput',
];
const initParamToolTypes = new Set<AiToolType>([
  'CUSTOM',
  'DATA_SOURCE',
  'SKILL',
]);
const inputParamToolTypes = new Set<AiToolType>(['CUSTOM', 'DATA_SOURCE']);
const codeEditorToolTypes = new Set<AiToolType>([
  'CUSTOM',
  'DATA_SOURCE',
  'HTTP',
  'MOCK',
]);
const draftDebugToolTypes = new Set<AiToolType>(['CUSTOM', 'HTTP', 'MOCK']);
const skillZipFileSizeLimitMb = MAX_SKILL_ZIP_FILE_SIZE_MB;
const folderSortOptions: FolderSortOption[] = [
  { label: '按创建时间升序', value: 'createTimeAsc' },
  { label: '按创建时间降序', value: 'createTimeDesc' },
  { divided: true, label: '按名称升序', value: 'nameAsc' },
  { label: '按名称降序', value: 'nameDesc' },
];

const loading = ref(false);
const router = useRouter();
const treeLoading = ref(false);
const drawerLoading = ref(false);
const tools = ref<ToolRecord[]>([]);
const folders = ref<ToolFolder[]>([]);
const folderSearchKeyword = ref('');
const folderSort = ref<FolderSortType>('createTimeDesc');
const total = ref(0);
const batchMode = ref(false);
const selectedIds = ref<Id[]>([]);
const activeFolder = ref<ToolFolder>({ id: rootFolderId, name: '全部工具' });
const query = reactive({
  create_user: '' as '' | Id,
  current: 1,
  name: '',
  page: 1,
  searchType: 'name' as ToolSearchType,
  size: 20,
  toolType: '' as '' | AiToolType,
  workspaceId: 'default',
});
const creatorLoading = ref(false);
const creatorOptions = ref<CreatorOption[]>([]);
let creatorOptionsRequestId = 0;

const toolDrawerOpen = ref(false);
const workflowDialogOpen = ref(false);
const editingId = ref<Id>();
const form = reactive<ToolFormState>(createEmptyForm());
const toolInitFormRef = ref<InstanceType<typeof DynamicInitForm>>();
const initParamTab = ref<InitParamTab>('raw');
const formInitParamValues = reactive<InitParamValues>({});
const initParamDrawerOpen = ref(false);
const initParamDrawerSaving = ref(false);
const initParamDrawerTarget = ref<ToolRecord>();
const initParamDrawerFields = ref<ToolFieldSchema[]>([]);
const initParamDrawerValues = reactive<InitParamValues>({});
const initParamDrawerRawText = ref('{}');
const togglingToolIds = ref<Id[]>([]);
const generateCodeDialogOpen = ref(false);
const workflowJson = ref(defaultWorkflowJson);
const mcpLoading = ref(false);
const uploadedSkillFile = ref<ToolFileRecord>();

const fieldDialogOpen = ref(false);
const fieldMode = ref<FieldMode>('input');
const fieldIndex = ref<number>();
const fieldForm = reactive<FieldFormState>(createEmptyFieldForm('input'));

const debugOpen = ref(false);
const debugRunning = ref(false);
const debugTitle = ref('工具调试');
const debugTargetId = ref<Id>();
const debugDraftPayload = ref<ToolRequest>();
const debugInputTab = ref<'form' | 'raw'>('form');
const debugInitParamTab = ref<InitParamTab>('raw');
const debugInput = ref('{\n  "query": "ping"\n}');
const debugInitParamsRaw = ref('{}');
const debugOutput = ref<unknown>();
const debugInitFormRef = ref<InstanceType<typeof DynamicInitForm>>();
const debugInitSchemaFields = ref<ToolFieldSchema[]>([]);
const debugInitParamValues = reactive<InitParamValues>({});
const debugSchemaFields = ref<ToolFieldSchema[]>([]);
const debugFieldValues = reactive<Record<string, InitParamValue>>({});
const pythonSyntaxLoading = ref(false);
const pythonSyntaxCheckedCode = ref('');
const pythonSyntaxDiagnostics = ref<PythonSyntaxDiagnostic[]>([]);
const pythonSyntaxError = ref('');

const recordsOpen = ref(false);
const recordsLoading = ref(false);
const records = ref<ToolRecord[]>([]);
const recordsTotal = ref(0);
const recordsQuery = reactive({ current: 1, page: 1, size: 20 });
const activeTool = ref<ToolRecord>();

const moveDialogOpen = ref(false);
const moveIds = ref<Id[]>([]);
const moveForm = reactive<{ folder_id?: Id }>({ folder_id: undefined });
const folderMoveDialogOpen = ref(false);
const movingFolder = ref<ToolFolder>();
const folderMoveForm = reactive<{ parent_id?: Id }>({ parent_id: undefined });

const storeOpen = ref(false);
const storeTab = ref<StoreTab>('internal');
const storeLoading = ref(false);
const storeSearch = ref('');
const internalToolList = ref<ToolRecord[]>([]);
const storeToolList = ref<ToolRecord[]>([]);

const folderDialogOpen = ref(false);
const folderDialogMode = ref<'create' | 'edit'>('create');
const folderForm = reactive<FolderFormState>({
  description: '',
  name: '',
  parent_id: '',
  workspace_id: query.workspaceId || 'default',
});

const visibleFolderTree = computed<ToolFolder[]>(() => [
  {
    children: getVisibleFolders(folders.value),
    id: rootFolderId,
    name: '全部工具',
  },
]);
const currentFolderSortLabel = computed(
  () =>
    folderSortOptions.find((item) => item.value === folderSort.value)?.label ||
    '排序',
);
const currentFolderId = computed(() =>
  activeFolder.value.id === rootFolderId ? undefined : activeFolder.value.id,
);
const folderOptions = computed(() => [
  { id: '', name: '根目录 / 全部工具' },
  ...flattenFolders(folders.value),
]);
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
  return [{ id: '', name: '根目录 / 全部工具' }, ...targetFolders];
});
const selectedTools = computed(() =>
  tools.value.filter(
    (item) => item.id !== undefined && selectedIds.value.includes(item.id),
  ),
);
const currentPageToolIds = computed(() =>
  tools.value
    .map((item) => idValue(item.id))
    .filter((id): id is Id => id !== undefined),
);
const isAllCurrentPageSelected = computed(
  () =>
    currentPageToolIds.value.length > 0 &&
    currentPageToolIds.value.every((id) => selectedIds.value.includes(id)),
);
const isCurrentPageSelectionIndeterminate = computed(() => {
  const currentSelectedCount = currentPageToolIds.value.filter((id) =>
    selectedIds.value.includes(id),
  ).length;
  return (
    currentSelectedCount > 0 &&
    currentSelectedCount < currentPageToolIds.value.length
  );
});
const activeFolderPath = computed(() => {
  if (isSyntheticRootFolder()) return ['根目录'];
  const path = findFolderPath(folders.value, activeFolder.value.id);
  return path.length > 0
    ? ['根目录', ...path]
    : ['根目录', activeFolder.value.name || '未命名文件夹'];
});
const pageSubtitle = computed(
  () =>
    `${folderDisplayName(activeFolder.value)} · ${toolTypeLabel(query.toolType) || '全部类型'} · ${total.value} 个工具`,
);
const folderDialogTitle = computed(() => {
  if (folderDialogMode.value === 'edit') return '编辑文件夹';
  return idValue(folderForm.parent_id) === undefined
    ? '添加文件夹'
    : '添加子文件夹';
});
const canGenerateToolCode = computed(() =>
  supportsToolAiGenerate(form.tool_type),
);
const isEditingTool = computed(() => editingId.value !== undefined);
const toolDrawerTitle = computed(
  () =>
    `${isEditingTool.value ? '编辑' : '创建'}${toolTypeFormTitle(form.tool_type)}`,
);
const workflowDialogTitle = computed(() =>
  isEditingTool.value ? '编辑工作流' : '创建工作流',
);
const toolPrimaryButtonText = computed(() =>
  isEditingTool.value ? '保存' : '创建',
);
const workflowPrimaryButtonText = computed(() =>
  isEditingTool.value ? '确定' : '添加',
);
const showInitParamSection = computed(() =>
  initParamToolTypes.has(form.tool_type),
);
const showInputParamSection = computed(() =>
  inputParamToolTypes.has(form.tool_type),
);
const showCodeSection = computed(() => codeEditorToolTypes.has(form.tool_type));
const showDraftDebugButton = computed(() =>
  draftDebugToolTypes.has(form.tool_type),
);
const showOutputHint = computed(() => form.tool_type === 'CUSTOM');
const showSkillFileSection = computed(() => form.tool_type === 'SKILL');
const showMcpConfigSection = computed(() => form.tool_type === 'MCP');
const pythonSyntaxCheckApplies = computed(() =>
  ['CUSTOM', 'DATA_SOURCE'].includes(form.tool_type),
);
const toolInitParamsJsonSyntax = computed(() =>
  checkJsonSyntax(form.init_params, {
    emptyMessage: '空值将按 {} 保存',
    requireObject: true,
    successMessage: '初始化参数 JSON 语法正确',
  }),
);
const mcpConfigJsonSyntax = computed(() =>
  checkJsonSyntax(form.code, {
    emptyValid: false,
    emptyMessage: '请输入 MCP Server JSON',
    requireObject: true,
    successMessage: 'MCP JSON 语法正确',
  }),
);
const debugInitParamsJsonSyntax = computed(() =>
  checkJsonSyntax(debugInitParamsRaw.value, {
    emptyMessage: '空值将按 {} 运行',
    requireObject: true,
    successMessage: '调试初始化 JSON 语法正确',
  }),
);
const debugInputJsonSyntax = computed(() =>
  checkJsonSyntax(debugInput.value, {
    emptyMessage: '空值将按 {} 运行',
    successMessage: '调试输入 JSON 语法正确',
  }),
);
const pythonSyntaxHasErrors = computed(() =>
  pythonSyntaxDiagnostics.value.some((item) => isPythonSyntaxError(item)),
);
const pythonSyntaxStatus = computed(() => {
  if (!pythonSyntaxCheckApplies.value) return 'idle';
  if (pythonSyntaxLoading.value) return 'checking';
  if (pythonSyntaxError.value || pythonSyntaxHasErrors.value) return 'error';
  if (pythonSyntaxDiagnostics.value.length > 0) return 'warning';
  if (pythonSyntaxCheckedCode.value === form.code && form.code.trim())
    return 'success';
  return 'idle';
});
const pythonSyntaxStatusText = computed(() => {
  if (pythonSyntaxLoading.value) return '正在检查 Python 语法...';
  if (pythonSyntaxError.value) return pythonSyntaxError.value;
  if (pythonSyntaxDiagnostics.value.length > 0) {
    return pythonSyntaxHasErrors.value
      ? `发现 ${pythonSyntaxDiagnostics.value.length} 个 Python 语法问题`
      : `发现 ${pythonSyntaxDiagnostics.value.length} 个 Python 提示`;
  }
  if (pythonSyntaxCheckedCode.value === form.code && form.code.trim()) {
    return 'Python 语法检查通过';
  }
  return form.code.trim()
    ? '代码已修改，建议保存前运行语法检查'
    : '请输入 Python 代码';
});
const hasFormInitSchema = computed(
  () => normalizeInitFields(form.init_field_list).length > 0,
);
const debugFields = computed<DebugFieldView[]>(() =>
  normalizeDebugFields(debugSchemaFields.value),
);
const hasDebugSchema = computed(() => debugFields.value.length > 0);
const hasDebugInitSchema = computed(
  () => normalizeInitFields(debugInitSchemaFields.value).length > 0,
);
const initParamDrawerToolName = computed(() =>
  stringValue(
    initParamDrawerTarget.value?.name ?? initParamDrawerTarget.value?.id,
  ),
);

function createEmptyForm(type: AiToolType = 'CUSTOM'): ToolFormState {
  return {
    code: defaultCodeForType(type),
    config_json: type === 'MCP' ? '{}' : defaultConfigJson,
    description: '',
    enabled: false,
    folder_id:
      activeFolder.value.id === rootFolderId
        ? undefined
        : activeFolder.value.id,
    icon: '',
    init_field_list: [],
    init_params: '{}',
    input_field_list: [],
    label: '',
    name: '',
    scope: type === 'INTERNAL' ? 'INTERNAL' : 'WORKSPACE',
    tool_type: type,
    version: '',
    workspace_id: query.workspaceId || 'default',
  };
}

function createEmptyFieldForm(mode: FieldMode): FieldFormState {
  return {
    attrs_json:
      mode === 'init' ? '{\n  "maxlength": 200,\n  "minlength": 0\n}' : '{}',
    default_value: '',
    desc: '',
    field: '',
    input_type: 'TextInput',
    is_required: true,
    label: '',
    name: '',
    option_list_json: '[]',
    required: false,
    show_default_value: true,
    source: 'reference',
    type: 'string',
  };
}

function defaultCodeForType(type: AiToolType) {
  if (type === 'MOCK') return 'return {"result": "ok"}';
  return defaultCodeForToolType(type);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = '') {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string') return value;
  return `${value}`;
}

function idValue(value: unknown): Id | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return value;
  return undefined;
}

function toolIdFromResponse(response: unknown): Id | undefined {
  const directId = idValue(response);
  if (directId !== undefined) return directId;
  if (!isRecord(response)) return undefined;
  const tool = isRecord(response.tool) ? response.tool : undefined;
  const data = isRecord(response.data) ? response.data : undefined;
  return idValue(response.id ?? tool?.id ?? data?.id);
}

function booleanValue(value: unknown, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return fallback;
  return `${value}` !== 'false';
}

function normalizeJsonText(value: unknown, fallback = '{}') {
  const text = prettyJson(value, fallback);
  return text.trim() || fallback;
}

function parseArrayValue(value: unknown): ToolFieldSchema[] {
  const source = typeof value === 'string' ? safeParseJson(value, []) : value;
  if (!Array.isArray(source)) return [];
  return cloneDeep(source).filter((item): item is ToolFieldSchema =>
    isRecord(item),
  );
}

function parseObjectValue(value: unknown): Record<string, unknown> {
  const source = typeof value === 'string' ? safeParseJson(value, {}) : value;
  return isRecord(source) ? cloneDeep(source) : {};
}

function lineColumnFromPosition(text: string, position: number) {
  const safePosition = Math.max(0, Math.min(position, text.length));
  let line = 1;
  let column = 1;
  for (let index = 0; index < safePosition; index += 1) {
    const code = text.codePointAt(index);
    if (code === 13) {
      if (text.codePointAt(index + 1) === 10 && index + 1 < safePosition)
        index += 1;
      line += 1;
      column = 1;
    } else if (code === 10) {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { column, line };
}

function jsonErrorLocation(text: string, message: string) {
  const lineColumnMatch = /line\s+(\d+)\s+column\s+(\d+)/i.exec(message);
  if (lineColumnMatch) {
    return {
      column: Number(lineColumnMatch[2]),
      line: Number(lineColumnMatch[1]),
    };
  }
  const positionMatch = /position\s+(\d+)/i.exec(message);
  if (positionMatch) {
    const position = Number(positionMatch[1]);
    if (Number.isFinite(position))
      return lineColumnFromPosition(text, position);
  }
  return {};
}

function jsonSyntaxMessage(result: JsonSyntaxResult) {
  if (result.valid) return result.message;
  const location = result.line
    ? `第 ${result.line} 行${result.column === undefined ? '' : `，第 ${result.column} 列`}`
    : '';
  return location ? `${location}：${result.message}` : result.message;
}

function checkJsonSyntax(
  value: string,
  options: {
    emptyMessage?: string;
    emptyValid?: boolean;
    requireObject?: boolean;
    successMessage?: string;
  } = {},
): JsonSyntaxResult {
  const text = value.trim();
  const emptyValid = options.emptyValid !== false;
  if (!text) {
    return {
      message:
        options.emptyMessage ||
        (emptyValid ? '空值将按 {} 处理' : '请输入 JSON'),
      valid: emptyValid,
    };
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (options.requireObject && !isRecord(parsed)) {
      return { message: 'JSON 必须是对象', valid: false };
    }
    return { message: options.successMessage || 'JSON 语法正确', valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'JSON 解析失败';
    return {
      ...jsonErrorLocation(text, message),
      message,
      valid: false,
    };
  }
}

function ensureJsonSyntax(result: JsonSyntaxResult, warningPrefix: string) {
  if (result.valid) return true;
  ElMessage.warning(`${warningPrefix}：${jsonSyntaxMessage(result)}`);
  return false;
}

function jsonSyntaxTagType(result: JsonSyntaxResult) {
  return result.valid ? 'success' : 'danger';
}

function jsonSyntaxTagText(result: JsonSyntaxResult) {
  return result.valid ? 'JSON' : '错误';
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : undefined;
  }
  return undefined;
}

function normalizePythonSyntaxDiagnostic(
  value: unknown,
): PythonSyntaxDiagnostic | undefined {
  if (typeof value === 'string' && value.trim()) {
    return { message: value, type: 'error' };
  }
  if (!isRecord(value)) return undefined;
  const record = value as PythonSyntaxRecord;
  const message = stringValue(
    record.message || record.msg || record.detail,
    'Python 语法错误',
  );
  return {
    column: numberValue(record.column ?? record.col),
    line: numberValue(record.line ?? record.lineno),
    message,
    type: stringValue(record.type || record.severity, 'error'),
  };
}

function normalizePythonSyntaxDiagnostics(value: unknown) {
  const source =
    isRecord(value) && Array.isArray(value.data)
      ? value.data
      : recordsOf(value);
  return source
    .map((item) => normalizePythonSyntaxDiagnostic(item))
    .filter((item): item is PythonSyntaxDiagnostic => item !== undefined);
}

function isPythonSyntaxError(item: PythonSyntaxDiagnostic) {
  return stringValue(item.type, 'error').toLowerCase() === 'error';
}

function pythonDiagnosticLocation(item: PythonSyntaxDiagnostic) {
  if (!item.line) return '';
  return `第 ${item.line} 行${item.column === undefined ? '' : `，第 ${item.column} 列`}`;
}

function pythonSyntaxTagType() {
  if (pythonSyntaxStatus.value === 'success') return 'success';
  if (pythonSyntaxStatus.value === 'warning') return 'warning';
  if (pythonSyntaxStatus.value === 'error') return 'danger';
  return 'info';
}

function pythonSyntaxTagText() {
  if (pythonSyntaxStatus.value === 'checking') return '检查中';
  if (pythonSyntaxStatus.value === 'success') return '通过';
  if (pythonSyntaxStatus.value === 'warning') return '提示';
  if (pythonSyntaxStatus.value === 'error') return '错误';
  return '待检查';
}

function resetPythonSyntaxState() {
  pythonSyntaxCheckedCode.value = '';
  pythonSyntaxDiagnostics.value = [];
  pythonSyntaxError.value = '';
}

function markPythonSyntaxStale(value = form.code) {
  if (value === pythonSyntaxCheckedCode.value) return;
  pythonSyntaxCheckedCode.value = '';
  pythonSyntaxDiagnostics.value = [];
  pythonSyntaxError.value = '';
}

async function runPythonSyntaxCheck(showSuccessMessage = true) {
  if (!pythonSyntaxCheckApplies.value) return true;
  if (!form.code.trim()) {
    resetPythonSyntaxState();
    pythonSyntaxError.value = '请输入 Python 代码';
    ElMessage.warning(pythonSyntaxError.value);
    return false;
  }
  const checkingCode = form.code;
  pythonSyntaxLoading.value = true;
  pythonSyntaxError.value = '';
  try {
    const data = await pylintTool(checkingCode);
    if (checkingCode !== form.code) {
      pythonSyntaxError.value = '代码已变更，请重新运行语法检查';
      return false;
    }
    pythonSyntaxDiagnostics.value = normalizePythonSyntaxDiagnostics(data);
    pythonSyntaxCheckedCode.value = checkingCode;
    if (
      pythonSyntaxDiagnostics.value.some((item) => isPythonSyntaxError(item))
    ) {
      ElMessage.warning('Python 语法检查未通过，请修复错误后再保存');
      return false;
    }
    if (showSuccessMessage) {
      ElMessage.success(
        pythonSyntaxDiagnostics.value.length > 0
          ? 'Python 语法检查通过，但存在提示'
          : 'Python 语法检查通过',
      );
    }
    return true;
  } catch {
    pythonSyntaxError.value = 'Python 语法检查失败，请稍后重试';
    ElMessage.error(pythonSyntaxError.value);
    return false;
  } finally {
    pythonSyntaxLoading.value = false;
  }
}

function replaceInitParamValues(
  target: InitParamValues,
  values: InitParamValues,
) {
  Object.keys(target).forEach((key) => {
    delete target[key];
  });
  Object.assign(target, values);
}

function initParamSourceFromRecord(record: ToolRecord) {
  return record.init_params ?? record.initParams;
}

function resetToolInitParamsFromRaw() {
  replaceInitParamValues(
    formInitParamValues,
    seedInitParams(form.init_field_list, form.init_params),
  );
  initParamTab.value = hasFormInitSchema.value ? 'form' : 'raw';
  if (hasFormInitSchema.value) syncToolInitRawFromForm();
}

function syncToolInitRawFromForm() {
  form.init_params = stringifyInitParamsForPayload(
    form.init_field_list,
    formInitParamValues,
  );
}

function syncToolInitFormFromRaw(showWarning = false) {
  const parsed = parseInitParamsText(form.init_params || '{}');
  if (!parsed) {
    if (showWarning) ElMessage.warning('初始化参数值必须是 JSON 对象');
    return false;
  }
  replaceInitParamValues(
    formInitParamValues,
    seedInitParams(form.init_field_list, parsed),
  );
  return true;
}

function handleToolInitParamsUpdate(values: InitParamValues) {
  replaceInitParamValues(formInitParamValues, values);
  syncToolInitRawFromForm();
}

function handleToolInitParamTabChange(tabName: number | string) {
  if (tabName === 'raw') syncToolInitRawFromForm();
  if (tabName === 'form') syncToolInitFormFromRaw(false);
}

async function prepareToolInitParamsForPayload(shouldValidate: boolean) {
  if (!hasFormInitSchema.value) return true;
  if (initParamTab.value === 'raw' && !syncToolInitFormFromRaw(true))
    return false;
  if (shouldValidate) {
    const valid = await toolInitFormRef.value?.validate();
    if (valid === false) return false;
    const errors = validateInitParamValues(
      form.init_field_list,
      formInitParamValues,
    );
    if (errors.length > 0) {
      initParamTab.value = 'form';
      ElMessage.warning(errors[0]);
      return false;
    }
  }
  syncToolInitRawFromForm();
  return true;
}

function setEnableDrawerParams(
  target: ToolRecord,
  source: ToolRecord,
  fields: ToolFieldSchema[],
) {
  initParamDrawerTarget.value = target;
  initParamDrawerFields.value = cloneDeep(fields);
  const seeded = seedInitParams(fields, initParamSourceFromRecord(source));
  replaceInitParamValues(initParamDrawerValues, seeded);
  initParamDrawerRawText.value = stringifyInitParamsForPayload(fields, seeded);
  initParamDrawerOpen.value = true;
}

function syncDebugInitRawFromForm() {
  debugInitParamsRaw.value = stringifyInitParamsForPayload(
    debugInitSchemaFields.value,
    debugInitParamValues,
  );
}

function syncDebugInitFormFromRaw(showWarning = false) {
  const parsed = parseInitParamsText(debugInitParamsRaw.value || '{}');
  if (!parsed) {
    if (showWarning) ElMessage.warning('调试初始化参数必须是 JSON 对象');
    return false;
  }
  replaceInitParamValues(
    debugInitParamValues,
    seedInitParams(debugInitSchemaFields.value, parsed),
  );
  return true;
}

function handleDebugInitParamsUpdate(values: InitParamValues) {
  replaceInitParamValues(debugInitParamValues, values);
  syncDebugInitRawFromForm();
}

function handleDebugInitParamTabChange(tabName: number | string) {
  if (tabName === 'raw') syncDebugInitRawFromForm();
  if (tabName === 'form') syncDebugInitFormFromRaw(false);
}

function initializeDebugInitSchema(fields: ToolFieldSchema[], params: unknown) {
  debugInitSchemaFields.value = cloneDeep(fields);
  replaceInitParamValues(debugInitParamValues, seedInitParams(fields, params));
  debugInitParamTab.value = hasDebugInitSchema.value ? 'form' : 'raw';
  syncDebugInitRawFromForm();
}

async function prepareDebugInitParamsForRun() {
  if (!hasDebugInitSchema.value) return { ok: true };
  if (debugInitParamTab.value === 'raw' && !syncDebugInitFormFromRaw(true)) {
    return { ok: false };
  }
  const valid = await debugInitFormRef.value?.validate();
  if (valid === false) return { ok: false };
  const errors = validateInitParamValues(
    debugInitSchemaFields.value,
    debugInitParamValues,
  );
  if (errors.length > 0) {
    debugInitParamTab.value = 'form';
    ElMessage.warning(errors[0]);
    return { ok: false };
  }
  syncDebugInitRawFromForm();
  return { ok: true, value: debugInitParamsRaw.value };
}

function debugFieldKey(field: ToolFieldSchema) {
  return stringValue(field.name ?? field.field ?? field.variable).trim();
}

function debugFieldLabel(field: ToolFieldSchema, key: string) {
  const rawLabel = field.label;
  if (isRecord(rawLabel))
    return stringValue(rawLabel.label ?? rawLabel.value, key);
  return stringValue(rawLabel ?? field.name ?? field.field, key);
}

function debugFieldInputType(field: ToolFieldSchema) {
  return stringValue(field.input_type ?? field.inputType).trim();
}

function debugFieldType(field: ToolFieldSchema) {
  return stringValue(field.type).trim().toLowerCase();
}

function debugFieldDefaultValue(field: ToolFieldSchema) {
  return field.default_value ?? field.defaultValue;
}

function normalizeDebugOptionValue(value: unknown): boolean | number | string {
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  return stringValue(value);
}

function normalizeDebugOptions(field: ToolFieldSchema): DebugOption[] {
  const rawSource = field.option_list ?? field.optionList;
  const source =
    typeof rawSource === 'string' ? safeParseJson(rawSource, []) : rawSource;
  if (!Array.isArray(source)) return [];
  return source
    .map((option, index) => {
      if (!isRecord(option)) {
        const value = normalizeDebugOptionValue(option);
        return { label: stringValue(option, `选项 ${index + 1}`), value };
      }
      const rawValue =
        option.value ??
        option.key ??
        option.id ??
        option.name ??
        option.label ??
        '';
      const rawLabel =
        option.label ?? option.name ?? option.text ?? option.key ?? rawValue;
      return {
        label: stringValue(rawLabel, `选项 ${index + 1}`),
        value: normalizeDebugOptionValue(rawValue),
      };
    })
    .filter((option) => option.label || `${option.value}`.length > 0);
}

function debugFieldControl(
  field: ToolFieldSchema,
  options: DebugOption[],
): DebugControl {
  const inputType = debugFieldInputType(field);
  const type = debugFieldType(field);
  if (options.length > 0) {
    if (inputType === 'MultiSelect' || type === 'array') return 'multiselect';
    return 'select';
  }
  if (['array', 'dict', 'object'].includes(type) || inputType === 'JsonInput') {
    return 'json';
  }
  if (['bool', 'boolean'].includes(type) || inputType === 'SwitchInput') {
    return 'boolean';
  }
  if (['float', 'int', 'integer', 'number'].includes(type)) return 'number';
  if (['MultiRow', 'TextareaInput'].includes(inputType)) return 'textarea';
  return 'text';
}

function normalizeDebugFields(fields: ToolFieldSchema[]): DebugFieldView[] {
  const seenKeys = new Set<string>();
  const normalized: DebugFieldView[] = [];
  fields.forEach((field) => {
    const key = debugFieldKey(field);
    if (!key || seenKeys.has(key)) return;
    seenKeys.add(key);
    const options = normalizeDebugOptions(field);
    normalized.push({
      control: debugFieldControl(field, options),
      desc: stringValue(field.desc ?? field.description),
      inputType: debugFieldInputType(field),
      key,
      label: debugFieldLabel(field, key),
      options,
      required: booleanValue(field.is_required ?? field.required, false),
      schema: field,
      type: debugFieldType(field),
    });
  });
  return normalized;
}

function debugDefaultJsonText(field: DebugFieldView) {
  return field.type === 'array' ? '[]' : '{}';
}

function debugBooleanValue(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return false;
  return ['1', 'on', 'true', 'y', 'yes'].includes(
    stringValue(value).toLowerCase(),
  );
}

function debugNumberValue(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function debugSelectValue(key: string) {
  const value = debugFieldValues[key];
  if (
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return value;
  }
  return undefined;
}

function debugMultiSelectValue(key: string): Array<boolean | number | string> {
  const value = debugFieldValues[key];
  if (!Array.isArray(value)) return [];
  const values: Array<boolean | number | string> = [];
  value.forEach((item) => {
    if (
      typeof item === 'boolean' ||
      typeof item === 'number' ||
      typeof item === 'string'
    ) {
      values.push(item);
    }
  });
  return values;
}

function debugTextValue(key: string) {
  return stringValue(debugFieldValues[key]);
}

function patchDebugFieldValue(key: string, value: unknown) {
  debugFieldValues[key] =
    value === undefined ||
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string' ||
    Array.isArray(value) ||
    isRecord(value)
      ? value
      : stringValue(value);
  syncRawDebugInputFromForm();
}

function coerceDebugOptionValue(field: DebugFieldView, value: unknown) {
  const normalizedValue = normalizeDebugOptionValue(value);
  const option = field.options.find(
    (item) => item.value === value || `${item.value}` === `${normalizedValue}`,
  );
  return option ? option.value : normalizedValue;
}

function normalizeDebugValueForForm(
  field: DebugFieldView,
  value: unknown,
): InitParamValue {
  if (field.control === 'boolean') return debugBooleanValue(value);
  if (field.control === 'number') return debugNumberValue(value);
  if (field.control === 'multiselect') {
    if (value === undefined || value === null || value === '') return [];
    const values = Array.isArray(value) ? value : [value];
    return values.map((item) => coerceDebugOptionValue(field, item));
  }
  if (field.control === 'select') {
    if (value === undefined || value === null) return '';
    return coerceDebugOptionValue(field, value);
  }
  if (field.control === 'json') {
    if (value === undefined || value === null || value === '')
      return debugDefaultJsonText(field);
    return typeof value === 'string'
      ? value
      : prettyJson(value, debugDefaultJsonText(field));
  }
  return stringValue(value);
}

function debugDefaultFormValue(field: DebugFieldView): InitParamValue {
  const defaultValue = debugFieldDefaultValue(field.schema);
  if (
    defaultValue !== undefined &&
    defaultValue !== null &&
    defaultValue !== ''
  ) {
    return normalizeDebugValueForForm(field, defaultValue);
  }
  if (field.control === 'boolean') return false;
  if (field.control === 'json') return debugDefaultJsonText(field);
  if (field.control === 'multiselect') return [];
  if (field.control === 'number') return undefined;
  return '';
}

function normalizeDebugValueForPayload(
  field: DebugFieldView,
  value: unknown,
): unknown {
  if (field.control === 'boolean') return debugBooleanValue(value);
  if (field.control === 'number') return debugNumberValue(value) ?? null;
  if (field.control === 'multiselect') return Array.isArray(value) ? value : [];
  if (field.control === 'json') {
    if (typeof value !== 'string') return value;
    const text = value.trim();
    if (!text) return field.type === 'array' ? [] : {};
    const parsed = safeParseJson(text, undefined);
    return parsed === undefined ? value : parsed;
  }
  return value ?? '';
}

function resetDebugFieldValues() {
  Object.keys(debugFieldValues).forEach((key) => {
    delete debugFieldValues[key];
  });
}

function syncRawDebugInputFromForm() {
  if (!hasDebugSchema.value) return;
  const input: Record<string, unknown> = {};
  debugFields.value.forEach((field) => {
    input[field.key] = normalizeDebugValueForPayload(
      field,
      debugFieldValues[field.key],
    );
  });
  debugInput.value = prettyJson(input, '{}');
}

function syncDebugFormFromRaw(showWarning = false) {
  if (!hasDebugSchema.value) return false;
  const parsed = safeParseJson(debugInput.value, undefined);
  if (!isRecord(parsed)) {
    if (showWarning) {
      ElMessage.warning('原始 JSON 不是对象，表单字段未同步，但仍可直接运行');
    }
    return false;
  }
  debugFields.value.forEach((field) => {
    const value = Object.prototype.hasOwnProperty.call(parsed, field.key)
      ? parsed[field.key]
      : debugDefaultFormValue(field);
    debugFieldValues[field.key] = normalizeDebugValueForForm(field, value);
  });
  return true;
}

function initializeDebugSchema(fields: ToolFieldSchema[]) {
  debugSchemaFields.value = cloneDeep(fields);
  resetDebugFieldValues();
  debugFields.value.forEach((field) => {
    debugFieldValues[field.key] = debugDefaultFormValue(field);
  });
  debugInputTab.value = hasDebugSchema.value ? 'form' : 'raw';
  if (hasDebugSchema.value) syncRawDebugInputFromForm();
}

function handleDebugTabChange(tabName: number | string) {
  if (tabName === 'form') syncDebugFormFromRaw(false);
}

function debugInputJsonForRun() {
  const text = debugInput.value.trim();
  if (!text) return '{}';
  if (safeParseJson(text, undefined) === undefined) {
    ElMessage.warning('调试输入不是合法 JSON，将按原始内容提交');
    return text;
  }
  return normalizeJsonText(text, '{}');
}

function toolTypeOf(row?: ToolRecord): AiToolType {
  const raw = row?.tool_type || row?.toolType || row?.type || 'CUSTOM';
  const value = stringValue(raw, 'CUSTOM').toUpperCase();
  return (
    creatableToolTypes.find((item) => item.value === value)?.value || 'CUSTOM'
  );
}

function toolTypeLabel(type?: string) {
  if (!type) return '';
  return toolTypes.find((item) => item.value === type)?.label || type;
}

function toolTypeFormTitle(type: AiToolType) {
  if (type === 'DATA_SOURCE') return '数据源';
  if (type === 'SKILL') return 'Skill';
  if (type === 'MCP') return 'MCP';
  if (type === 'WORKFLOW') return '工作流';
  return '工具';
}

function rawToolType(row?: ToolRecord) {
  return stringValue(
    row?.tool_type || row?.toolType || row?.type,
    'CUSTOM',
  ).toUpperCase();
}

function toolTypeDisplay(row?: ToolRecord) {
  const rawType = rawToolType(row);
  return toolTypeLabel(rawType) || rawType || '自定义工具';
}

function toolTypeClass(type?: string) {
  return `is-${stringValue(type, 'custom')
    .toLowerCase()
    .replaceAll('_', '-')
    .replaceAll(/[^a-z0-9-]/g, '')}`;
}

function toolTypeTagType(type?: string) {
  const value = stringValue(type).toUpperCase();
  if (value === 'MCP') return 'warning';
  if (value === 'WORKFLOW') return 'success';
  if (value === 'SKILL') return 'danger';
  if (value === 'DATA_SOURCE') return 'info';
  return 'primary';
}

function isToolEnabled(row?: ToolRecord) {
  return booleanValue(row?.enabled ?? row?.isActive ?? row?.is_active, false);
}

function setToolEnabledState(row: ToolRecord, enabled: boolean) {
  row.enabled = enabled;
  row.isActive = enabled;
  row.is_active = enabled;
}

function setToolToggleLoading(id: Id, loadingState: boolean) {
  togglingToolIds.value = loadingState
    ? [...new Set([id, ...togglingToolIds.value])]
    : togglingToolIds.value.filter((item) => item !== id);
}

function isToolToggleLoading(row?: ToolRecord) {
  const id = idValue(row?.id);
  return id !== undefined && togglingToolIds.value.includes(id);
}

function hasOwnField(record: ToolRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function workflowPublishedState(row: ToolRecord) {
  if (toolTypeOf(row) !== 'WORKFLOW') return undefined;
  const booleanKeys = [
    'is_publish',
    'isPublished',
    'is_published',
    'isPublish',
    'published',
  ];
  for (const key of booleanKeys) {
    if (hasOwnField(row, key)) return booleanValue(row[key], false);
  }
  const statusKeys = [
    'publishStatus',
    'publish_status',
    'workflowStatus',
    'workflow_status',
  ];
  for (const key of statusKeys) {
    if (!hasOwnField(row, key)) continue;
    const status = stringValue(row[key]).toUpperCase();
    if (['ONLINE', 'PUBLISHED', 'RELEASED'].includes(status)) return true;
    if (['DRAFT', 'OFFLINE', 'PENDING', 'UNPUBLISHED'].includes(status))
      return false;
  }
  const timeKeys = [
    'lastPublishTime',
    'last_publish_time',
    'publishTime',
    'publish_time',
    'publishedAt',
    'published_at',
  ];
  for (const key of timeKeys) {
    if (hasOwnField(row, key)) return !!stringValue(row[key]);
  }
  return undefined;
}

function blockWorkflowEnableIfUnpublished(row: ToolRecord) {
  if (workflowPublishedState(row) !== false) return false;
  ElMessage.warning('工作流工具尚未发布，请发布工作流版本后再启用');
  return true;
}

function showWorkflowEnableRejected(row: ToolRecord) {
  if (toolTypeOf(row) === 'WORKFLOW') {
    ElMessage.warning('工作流工具启用失败，请确认工作流已发布后再启用');
  }
}

function toolDescription(row?: ToolRecord) {
  return stringValue(row?.description ?? row?.desc, '暂无描述');
}

function toolCreator(row?: ToolRecord) {
  return stringValue(
    row?.nick_name ??
      row?.nickName ??
      row?.creatorName ??
      row?.createUserName ??
      row?.create_user_name ??
      row?.createdBy ??
      row?.create_user,
  );
}

function toolDate(row?: ToolRecord) {
  return stringValue(
    row?.createTime ?? row?.create_time ?? row?.updateTime ?? row?.update_time,
  );
}

function toolSecondaryLine(row?: ToolRecord) {
  const creator = toolCreator(row);
  const date = toolDate(row);
  if (creator && date) return `${creator} 创建于 ${date}`;
  if (creator) return creator;
  if (date) return `创建于 ${date}`;
  return `工作空间 ${toolWorkspaceId(row)}`;
}

function isImageIcon(icon?: unknown) {
  const value = stringValue(icon).trim();
  return /^(?:https?:|data:image|blob:|\/|\.\/)/i.test(value);
}

function toolIconText(row?: ToolRecord) {
  const icon = stringValue(row?.icon).trim();
  if (icon && !isImageIcon(icon)) return icon.slice(0, 2).toUpperCase();
  const name = stringValue(row?.name || row?.id, rawToolType(row));
  return name.slice(0, 1).toUpperCase();
}

function toolFolderId(row?: ToolRecord) {
  return idValue(row?.folder_id ?? row?.folderId);
}

function toolWorkspaceId(row?: ToolRecord) {
  return stringValue(row?.workspace_id ?? row?.workspaceId, 'default');
}

function folderDisplayName(folder?: ToolFolder) {
  if (folder?.id === rootFolderId) return '根目录';
  return stringValue(folder?.name || folder?.id, '未命名文件夹');
}

function normalizeFolderSearchText(value: unknown) {
  return stringValue(value).trim().toLocaleLowerCase();
}

function folderTimestamp(folder: ToolFolder) {
  const rawValue = folder.create_time ?? folder.createTime;
  const time = Date.parse(stringValue(rawValue));
  return Number.isNaN(time) ? 0 : time;
}

function compareFolderNames(left: ToolFolder, right: ToolFolder) {
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

function compareFolders(left: ToolFolder, right: ToolFolder) {
  if (folderSort.value === 'nameAsc') return compareFolderNames(left, right);
  if (folderSort.value === 'nameDesc') return compareFolderNames(right, left);

  const timeCompare = folderTimestamp(left) - folderTimestamp(right);
  if (timeCompare !== 0) {
    return folderSort.value === 'createTimeAsc' ? timeCompare : -timeCompare;
  }
  return compareFolderNames(left, right);
}

function getVisibleFolders(list: ToolFolder[]): ToolFolder[] {
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

function containsFolderId(folder: ToolFolder, folderId?: Id): boolean {
  if (folderId === undefined) return false;
  if (folder.id === folderId) return true;
  return (folder.children || []).some((child) =>
    containsFolderId(child, folderId),
  );
}

function findFolderById(
  list: ToolFolder[],
  folderId?: Id,
): ToolFolder | undefined {
  if (folderId === undefined) return undefined;
  for (const folder of list) {
    if (folder.id === folderId) return folder;
    const child = findFolderById(folder.children || [], folderId);
    if (child) return child;
  }
  return undefined;
}

function flattenFolders(list: ToolFolder[], depth = 0): ToolFolder[] {
  return list.flatMap((folder) => [
    {
      ...folder,
      name: `${'　'.repeat(depth)}${folder.name || folder.id || '未命名文件夹'}`,
    },
    ...flattenFolders(folder.children || [], depth + 1),
  ]);
}

function findFolderPath(list: ToolFolder[], folderId?: Id): string[] {
  if (folderId === undefined) return [];
  for (const item of list) {
    if (item.id === folderId) return [item.name || '未命名文件夹'];
    const childPath = findFolderPath(item.children || [], folderId);
    if (childPath.length > 0)
      return [item.name || '未命名文件夹', ...childPath];
  }
  return [];
}

function normalizeFolders(list: unknown): ToolFolder[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => ({
      ...item,
      children: normalizeFolders(item.children),
      id: idValue(item.id),
      name: stringValue(item.name, '未命名文件夹'),
    }));
}

function detailToToolRecord(
  detail: unknown,
  fallback?: ToolRecord,
): ToolRecord {
  if (!isRecord(detail)) return fallback ? cloneDeep(fallback) : {};
  const tool = isRecord(detail.tool) ? detail.tool : detail;
  const workflow = isRecord(detail.workflow) ? detail.workflow : undefined;
  const workFlow = detail.work_flow || detail.workFlow;
  const workflowPayload =
    typeof workFlow === 'string' || isRecord(workFlow) ? workFlow : undefined;
  return {
    ...fallback,
    ...tool,
    ...(workflow ? { workflow } : {}),
    ...(workflowPayload ? { work_flow: workflowPayload } : {}),
  };
}

function buildPayload(
  enabled = form.enabled,
  isEdit = isEditingTool.value,
): ToolRequest {
  return buildToolPayload(form, {
    enabled,
    isEdit,
    workflowValue: workflowJson.value,
  });
}

function applyFormDefaults(type: AiToolType) {
  Object.assign(form, createEmptyForm(type));
  workflowJson.value = defaultWorkflowJson;
  uploadedSkillFile.value = undefined;
  resetPythonSyntaxState();
  resetToolInitParamsFromRaw();
}

function setFormFromRecord(record: ToolRecord, copy = false) {
  const type = toolTypeOf(record);
  const configJson = record.config_json ?? record.configJson;
  const initParams = record.init_params ?? record.initParams;
  const workflow = isRecord(record.workflow) ? record.workflow : undefined;
  const workflowValue =
    record.work_flow ||
    record.workFlow ||
    workflow?.workFlow ||
    workflow?.work_flow;
  Object.assign(form, {
    code: stringValue(record.code, defaultCodeForType(type)),
    config_json: normalizeJsonText(
      configJson,
      type === 'MCP' ? '{}' : defaultConfigJson,
    ),
    description: stringValue(record.description ?? record.desc),
    enabled: copy ? false : isToolEnabled(record),
    folder_id: toolFolderId(record) || currentFolderId.value,
    icon: stringValue(record.icon),
    id: copy ? undefined : idValue(record.id),
    init_field_list: parseArrayValue(
      record.init_field_list ?? record.initFieldList,
    ),
    init_params: normalizeJsonText(initParams, '{}'),
    input_field_list: parseArrayValue(
      record.input_field_list ?? record.inputFieldList,
    ),
    label: stringValue(record.label),
    name: `${stringValue(record.name, '未命名工具')}${copy ? ' 副本' : ''}`,
    scope: stringValue(
      record.scope,
      type === 'INTERNAL' ? 'INTERNAL' : 'WORKSPACE',
    ),
    tool_type: type,
    version: stringValue(record.version),
    workspace_id: toolWorkspaceId(record),
  });
  workflowJson.value = normalizeJsonText(workflowValue, defaultWorkflowJson);
  uploadedSkillFile.value = undefined;
  resetPythonSyntaxState();
  resetToolInitParamsFromRaw();
}

async function loadTree() {
  treeLoading.value = true;
  try {
    const data = await treeTools({ workspaceId: query.workspaceId });
    const source = isRecord(data) ? data.folders : [];
    folders.value = normalizeFolders(source);
  } finally {
    treeLoading.value = false;
  }
}

function normalizeCreatorOption(
  user: BasicUserInfo,
): CreatorOption | undefined {
  const value = normalizeCreatorValue(user);
  if (value === undefined) return undefined;
  return {
    label: normalizeCreatorLabel(user) || `${value}`,
    value,
  };
}

async function loadCreatorOptions(keyword = '') {
  const requestId = ++creatorOptionsRequestId;
  const username = keyword.trim() || undefined;
  creatorLoading.value = true;
  try {
    const data = await pageUserList({
      current: 1,
      page: 1,
      size: 20,
      username,
    });
    if (requestId !== creatorOptionsRequestId) return;
    creatorOptions.value = recordsOf<BasicUserInfo>(data)
      .map((item) => normalizeCreatorOption(item))
      .filter((item): item is CreatorOption => item !== undefined);
  } finally {
    if (requestId === creatorOptionsRequestId) creatorLoading.value = false;
  }
}

function handleCreatorSelectVisibleChange(visible: boolean) {
  if (visible && creatorOptions.value.length === 0) loadCreatorOptions();
}

function handleSearchTypeChange(type: string) {
  query.searchType = type === 'create_user' ? 'create_user' : 'name';
  if (query.searchType === 'name') {
    query.create_user = '';
  } else {
    query.name = '';
    if (creatorOptions.value.length === 0) loadCreatorOptions();
  }
  handleSearch();
}

async function loadTools() {
  loading.value = true;
  try {
    const data = await pageTools({
      current: query.current,
      folderId: currentFolderId.value,
      ...buildToolSearchParams(query),
      page: query.page,
      size: query.size,
      toolType: query.toolType || undefined,
      workspaceId: query.workspaceId || undefined,
    });
    tools.value = recordsOf<ToolRecord>(data);
    total.value = totalOf(data);
    selectedIds.value = selectedIds.value.filter((id) =>
      tools.value.some((item) => item.id === id),
    );
  } finally {
    loading.value = false;
  }
}

async function refreshAll() {
  await Promise.all([loadTree(), loadTools()]);
}

function isSyntheticRootFolder(folder: ToolFolder = activeFolder.value) {
  return folder.id === rootFolderId;
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

function openCreateSubFolder(folder: ToolFolder = activeFolder.value) {
  if (isSyntheticRootFolder(folder)) {
    openCreateRootFolder();
    return;
  }
  folderDialogMode.value = 'create';
  resetFolderForm(folder.id);
  folderDialogOpen.value = true;
}

function openCreateFolderFromMenu() {
  openCreateRootFolder();
}

function openEditFolder(folder: ToolFolder = activeFolder.value) {
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
  const description = folderForm.description.trim();
  if (!name) {
    ElMessage.warning('请输入文件夹名称');
    return;
  }
  folderForm.name = name;
  folderForm.description = description;
  const folderId = idValue(folderForm.id);
  const isEdit = folderDialogMode.value === 'edit';
  const parentId = idValue(folderForm.parent_id);
  const payload: ToolFolderRequest = {
    description,
    name,
    parent_id: parentId,
    workspace_id: folderForm.workspace_id || query.workspaceId || 'default',
  };
  if (isEdit && folderId === undefined) {
    ElMessage.warning('文件夹 ID 无效');
    return;
  }
  const saved = isEdit
    ? await updateToolFolder(folderId as Id, payload)
    : await createToolFolder(payload);
  const savedFolder = isRecord(saved) ? saved : undefined;
  const savedId = idValue(savedFolder?.id) ?? folderId;
  if (savedId !== undefined) {
    activeFolder.value = {
      ...(savedFolder || activeFolder.value),
      description: payload.description,
      id: savedId,
      name: payload.name,
      parent_id: payload.parent_id,
      workspace_id: payload.workspace_id,
    };
  }
  ElMessage.success(isEdit ? '文件夹已更新' : '文件夹已创建');
  folderDialogOpen.value = false;
  query.current = 1;
  query.page = 1;
  await refreshAll();
}

function openMoveFolder(folder: ToolFolder) {
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
  const payload: ToolFolderRequest = {
    description: stringValue(source.description),
    name: stringValue(source.name, '未命名文件夹'),
    workspace_id: stringValue(
      source.workspace_id ?? source.workspaceId,
      query.workspaceId || 'default',
    ),
  };
  if (movesToRoot) {
    payload.clearParent = true;
    payload.clear_parent = true;
  } else {
    payload.parent_id = targetParentId;
  }
  await updateToolFolder(sourceId, payload);
  ElMessage.success('文件夹已转移');
  folderMoveDialogOpen.value = false;
  movingFolder.value = undefined;
  await refreshAll();
}

function openFolderAuthorization() {
  ElMessage.info('资源授权功能待接入');
}

function removeFolder(folder: ToolFolder = activeFolder.value) {
  if (isSyntheticRootFolder(folder)) {
    ElMessage.warning('根目录不可删除');
    return;
  }
  const folderId = folder.id;
  if (!folderId) return;
  confirm(
    `确认删除文件夹 ${folder.name || folderId}？该文件夹下的工具将由后端移回根目录。`,
  ).then(async () => {
    await deleteToolFolder(folderId);
    ElMessage.success('文件夹已删除');
    const sourceFolder = findFolderById(folders.value, folderId) || folder;
    if (containsFolderId(sourceFolder, activeFolder.value.id)) {
      activeFolder.value = { id: rootFolderId, name: '全部工具' };
      selectedIds.value = [];
      query.current = 1;
      query.page = 1;
    }
    await refreshAll();
  });
}

function handleSearch() {
  query.current = 1;
  query.page = 1;
  loadTools();
}

function handlePageChange(page: number) {
  query.current = page;
  query.page = page;
  loadTools();
}

function selectFolder(folder: ToolFolder) {
  activeFolder.value = folder;
  query.current = 1;
  query.page = 1;
  loadTools();
}

function isSelected(row: ToolRecord) {
  return row.id !== undefined && selectedIds.value.includes(row.id);
}

function toggleSelection(row: ToolRecord, checked: boolean) {
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
    ? [...new Set([...currentPageToolIds.value, ...selectedIds.value])]
    : selectedIds.value.filter((id) => !currentPageToolIds.value.includes(id));
}

async function handleToolCardClick(row: ToolRecord) {
  if (batchMode.value) {
    toggleSelection(row, !isSelected(row));
    return;
  }
  if (toolTypeOf(row) === 'WORKFLOW') {
    await openWorkflowEditor(row);
    return;
  }
  openToolDrawer(toolTypeOf(row), row);
}

async function openWorkflowEditor(row: ToolRecord) {
  if (toolTypeOf(row) !== 'WORKFLOW') return;
  const toolId = idValue(row.id);
  if (toolId === undefined) {
    ElMessage.warning('工具 ID 无效，无法打开工作流编辑器');
    return;
  }
  await router.push({
    name: 'AiOrchestrationToolWorkflow',
    query: { toolId },
  });
}

async function openToolDrawer(type: AiToolType = 'CUSTOM', row?: ToolRecord) {
  drawerLoading.value = true;
  try {
    editingId.value = row?.id;
    const targetType = row ? toolTypeOf(row) : type;
    applyFormDefaults(targetType);
    if (row?.id) {
      const detail = await getTool(row.id);
      setFormFromRecord(detailToToolRecord(detail, row));
    }
    if (form.tool_type === 'WORKFLOW') {
      toolDrawerOpen.value = false;
      workflowDialogOpen.value = true;
    } else {
      workflowDialogOpen.value = false;
      toolDrawerOpen.value = true;
    }
  } finally {
    drawerLoading.value = false;
  }
}

async function copyTool(row: ToolRecord) {
  drawerLoading.value = true;
  try {
    const detail = row.id ? await getTool(row.id) : row;
    const record = detailToToolRecord(detail, row);
    editingId.value = undefined;
    setFormFromRecord(record, true);
    if (form.tool_type === 'WORKFLOW') {
      toolDrawerOpen.value = false;
      workflowDialogOpen.value = true;
    } else {
      workflowDialogOpen.value = false;
      toolDrawerOpen.value = true;
    }
  } finally {
    drawerLoading.value = false;
  }
}

async function saveTool() {
  if (!form.name.trim()) {
    ElMessage.warning('请输入工具名称');
    return;
  }
  if (form.tool_type === 'MCP') {
    if (!ensureJsonSyntax(mcpConfigJsonSyntax.value, 'MCP JSON 语法错误'))
      return;
    if (!isValidMcpServerConfigJson(form.code)) {
      ElMessage.warning(
        'MCP Server 必须是非空 JSON 对象，且每个 Server 配置不能为空',
      );
      return;
    }
  }
  if (showCodeSection.value && !form.code.trim()) {
    ElMessage.warning('请输入 Python 代码');
    return;
  }
  if (pythonSyntaxCheckApplies.value && !(await runPythonSyntaxCheck(false)))
    return;
  if (form.tool_type === 'SKILL' && !form.code.trim()) {
    ElMessage.warning('请上传 Skill ZIP 文件');
    return;
  }
  if (showInitParamSection.value) {
    if (
      !ensureJsonSyntax(
        toolInitParamsJsonSyntax.value,
        '初始化参数 JSON 语法错误',
      )
    )
      return;
    const initParamsReady = await prepareToolInitParamsForPayload(form.enabled);
    if (!initParamsReady) return;
  }
  const payload = buildPayload(
    isEditingTool.value ? form.enabled : false,
    isEditingTool.value,
  );
  const savedTool = isEditingTool.value
    ? await updateTool(editingId.value as Id, payload)
    : await createTool(payload);
  if (form.tool_type === 'WORKFLOW') {
    if (!isEditingTool.value) {
      const createdId = toolIdFromResponse(savedTool);
      toolDrawerOpen.value = false;
      workflowDialogOpen.value = false;
      await refreshAll();
      if (createdId !== undefined) {
        ElMessage.success('工作流工具已创建，正在打开工作流编辑器');
        await router.push({
          name: 'AiOrchestrationToolWorkflow',
          query: { toolId: createdId },
        });
        return;
      }
      ElMessage.warning(
        '工作流工具已创建，但返回数据缺少工具 ID，无法自动打开编辑器',
      );
      return;
    }
    ElMessage.success('工作流工具信息已保存');
  } else {
    ElMessage.success(isEditingTool.value ? '保存成功' : '创建成功');
  }
  toolDrawerOpen.value = false;
  workflowDialogOpen.value = false;
  await refreshAll();
}

function removeTool(row: ToolRecord) {
  confirm(`确认删除工具 ${row.name || row.id}？`).then(async () => {
    if (!row.id) return;
    await deleteTool(row.id);
    ElMessage.success('删除成功');
    await refreshAll();
  });
}

function removeSelectedTools() {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('请选择要删除的工具');
    return;
  }
  confirm(`确认删除选中的 ${selectedIds.value.length} 个工具？`).then(
    async () => {
      await batchDeleteTools([...selectedIds.value]);
      selectedIds.value = [];
      batchMode.value = false;
      ElMessage.success('批量删除成功');
      await refreshAll();
    },
  );
}

async function toggleToolEnabled(row: ToolRecord, enabled: boolean) {
  const id = idValue(row.id);
  if (id === undefined) return;
  const previousEnabled = isToolEnabled(row);
  if (previousEnabled === enabled || isToolToggleLoading(row)) return;
  if (enabled && blockWorkflowEnableIfUnpublished(row)) return;
  setToolToggleLoading(id, true);
  try {
    let targetRecord = row;
    if (enabled) {
      const detail = await getTool(id);
      targetRecord = detailToToolRecord(detail, row);
      if (blockWorkflowEnableIfUnpublished(targetRecord)) return;
      const initFields = parseArrayValue(
        targetRecord.init_field_list ?? targetRecord.initFieldList,
      );
      if (initFields.length > 0) {
        setEnableDrawerParams(row, targetRecord, initFields);
        return;
      }
    }
    await updateTool(id, { enabled, is_active: enabled });
    setToolEnabledState(row, enabled);
    ElMessage.success(enabled ? '工具已启用' : '工具已停用');
  } catch {
    setToolEnabledState(row, previousEnabled);
    if (enabled) showWorkflowEnableRejected(row);
  } finally {
    setToolToggleLoading(id, false);
  }
}

async function saveEnableInitParams(params: Record<string, unknown>) {
  const row = initParamDrawerTarget.value;
  const id = idValue(row?.id);
  if (!row || id === undefined) return;
  if (blockWorkflowEnableIfUnpublished(row)) return;
  const initParams = JSON.stringify(params, null, 2);
  initParamDrawerSaving.value = true;
  setToolToggleLoading(id, true);
  try {
    await updateTool(id, {
      enabled: true,
      initParams,
      init_params: initParams,
      isActive: true,
      is_active: true,
    });
    row.initParams = initParams;
    row.init_params = initParams;
    setToolEnabledState(row, true);
    initParamDrawerOpen.value = false;
    ElMessage.success('初始化参数已保存，工具已启用');
    await refreshAll();
  } catch {
    setToolEnabledState(row, false);
    showWorkflowEnableRejected(row);
  } finally {
    initParamDrawerSaving.value = false;
    setToolToggleLoading(id, false);
  }
}

function openMoveDialog(row?: ToolRecord) {
  moveIds.value = row?.id ? [row.id] : [...selectedIds.value];
  if (moveIds.value.length === 0) {
    ElMessage.warning('请选择要移动的工具');
    return;
  }
  moveForm.folder_id = currentFolderId.value;
  moveDialogOpen.value = true;
}

async function saveMove() {
  await batchMoveTools(moveIds.value, moveForm.folder_id || undefined);
  ElMessage.success('移动成功');
  moveDialogOpen.value = false;
  selectedIds.value = [];
  batchMode.value = false;
  await refreshAll();
}

function openFieldDialog(
  mode: FieldMode,
  row?: ToolFieldSchema,
  index?: number,
) {
  fieldMode.value = mode;
  fieldIndex.value = index;
  Object.assign(fieldForm, createEmptyFieldForm(mode));
  if (row) {
    Object.assign(fieldForm, {
      attrs_json: normalizeJsonText(row.attrs, '{}'),
      default_value: stringValue(row.default_value),
      desc: stringValue(row.desc),
      field: stringValue(row.field),
      input_type: stringValue(row.input_type, 'TextInput'),
      is_required: booleanValue(row.is_required, true),
      label: stringValue(row.label),
      name: stringValue(row.name),
      option_list_json: normalizeJsonText(row.option_list, '[]'),
      required: booleanValue(row.required, false),
      show_default_value: booleanValue(row.show_default_value, true),
      source: stringValue(row.source, 'reference'),
      type: stringValue(row.type, 'string'),
    });
  }
  fieldDialogOpen.value = true;
}

function saveField() {
  const target =
    fieldMode.value === 'init' ? form.init_field_list : form.input_field_list;
  let payload: ToolFieldSchema;
  if (fieldMode.value === 'init') {
    if (!fieldForm.field.trim()) {
      ElMessage.warning('请输入字段名');
      return;
    }
    payload = {
      attrs: parseObjectValue(fieldForm.attrs_json),
      default_value: fieldForm.default_value,
      field: fieldForm.field.trim(),
      input_type: fieldForm.input_type,
      label: fieldForm.label || fieldForm.field,
      option_list: parseArrayValue(fieldForm.option_list_json),
      required: fieldForm.required,
      show_default_value: fieldForm.show_default_value,
    };
  } else {
    if (!fieldForm.name.trim()) {
      ElMessage.warning('请输入参数名');
      return;
    }
    payload = {
      desc: fieldForm.desc,
      is_required: fieldForm.is_required,
      name: fieldForm.name.trim(),
      source: fieldForm.source,
      type: fieldForm.type,
    };
  }
  if (fieldIndex.value === undefined) target.push(payload);
  else target.splice(fieldIndex.value, 1, payload);
  if (fieldMode.value === 'init') resetToolInitParamsFromRaw();
  fieldDialogOpen.value = false;
}

function removeField(mode: FieldMode, index: number) {
  const target = mode === 'init' ? form.init_field_list : form.input_field_list;
  target.splice(index, 1);
}

function openGenerateCodeDialog() {
  if (!canGenerateToolCode.value) {
    ElMessage.warning('当前工具类型不支持生成 Python 工具代码');
    return;
  }
  generateCodeDialogOpen.value = true;
}

function handleGeneratedCodeInsert(code: string) {
  const currentCode = form.code.trimEnd();
  form.code = currentCode ? `${currentCode}\n\n${code}` : code;
  markPythonSyntaxStale();
  ElMessage.success('生成代码已插入');
}

function handleGeneratedCodeReplace(code: string) {
  form.code = code;
  markPythonSyntaxStale();
  ElMessage.success('生成代码已替换');
}

async function runTestConnection() {
  if (!ensureJsonSyntax(mcpConfigJsonSyntax.value, 'MCP JSON 语法错误')) return;
  if (!isValidMcpServerConfigJson(form.code)) {
    ElMessage.warning(
      'MCP Server 必须是非空 JSON 对象，且每个 Server 配置不能为空',
    );
    return;
  }
  mcpLoading.value = true;
  try {
    await testToolConnection({ code: form.code, mcp_servers: form.code });
    ElMessage.success('MCP 连接成功');
  } finally {
    mcpLoading.value = false;
  }
}

async function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const result = stringValue(reader.result);
      resolve(result.includes(',') ? result.split(',').pop() || '' : result);
    });
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

async function fileToText(file: File) {
  return file.text();
}

function removeUploadFile(uploadFiles: UploadFiles, uploadFile: UploadFile) {
  const index = uploadFiles.findIndex((item) => item.uid === uploadFile.uid);
  if (index !== -1) uploadFiles.splice(index, 1);
}

function keepLatestUploadFile(uploadFiles: UploadFiles) {
  const latestFiles = keepLatestSkillZipFiles(uploadFiles);
  if (latestFiles.length !== uploadFiles.length) {
    uploadFiles.splice(0, uploadFiles.length, ...latestFiles);
  }
}

async function handleSkillUpload(
  uploadFile: UploadFile,
  uploadFiles: UploadFiles = [],
) {
  if (!uploadFile.raw) return;
  const fileName = uploadFile.name || uploadFile.raw.name;
  const validation = validateSkillZipFile({
    name: fileName,
    size: uploadFile.raw.size,
  });
  if (!validation.valid) {
    removeUploadFile(uploadFiles, uploadFile);
    ElMessage.warning(validation.message);
    return;
  }
  keepLatestUploadFile(uploadFiles);
  try {
    const contentBase64 = await fileToBase64(uploadFile.raw);
    const file = await uploadSkillFile({
      content_base64: contentBase64,
      content_type: uploadFile.raw.type || 'application/zip',
      file_name: fileName,
      workspace_id: form.workspace_id,
    });
    const record = isRecord(file) ? (file as ToolFileRecord) : undefined;
    uploadedSkillFile.value = record;
    form.code = stringValue(record?.id || form.code);
    ElMessage.success('技能文件已上传');
  } catch {
    ElMessage.error('技能文件上传失败');
  }
}

async function downloadSkill() {
  let file = uploadedSkillFile.value;
  if (editingId.value) {
    const data = await downloadSkillFile(editingId.value);
    file = isRecord(data) ? (data as ToolFileRecord) : file;
  }
  if (!file) {
    ElMessage.warning('暂无可下载的技能文件');
    return;
  }
  downloadBase64File(
    stringValue(file.fileName || file.file_name, `${form.name || 'skill'}.zip`),
    stringValue(file.contentBase64 || file.content_base64),
    stringValue(file.contentType || file.content_type, 'application/zip'),
  );
}

function downloadBase64File(
  fileName: string,
  contentBase64: string,
  contentType: string,
) {
  const binary = atob(contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.codePointAt(index) ?? 0;
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: contentType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
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
    ElMessage.warning('导入文件必须是 JSON 格式');
    return;
  }
  await importTool({
    ...parsed,
    folder_id: currentFolderId.value,
    workspace_id: query.workspaceId,
  });
  ElMessage.success('导入成功');
  await refreshAll();
}

async function exportToolFile(row: ToolRecord) {
  if (!row.id) return;
  const data = await exportTool(row.id);
  downloadJsonFile(`${row.name || row.id}.tool`, data);
}

async function saveIcon() {
  if (!editingId.value) return;
  const icon = await editToolIcon(editingId.value, { icon: form.icon });
  form.icon = stringValue(icon, form.icon);
  ElMessage.success('图标已保存');
}

async function openDebugDialog(row?: ToolRecord) {
  debugOutput.value = undefined;
  if (row?.id) {
    const detail = await getTool(row.id).catch(() => row);
    const record = detailToToolRecord(detail, row);
    debugTargetId.value = row.id;
    debugDraftPayload.value = undefined;
    debugTitle.value = `${record.name || row.name || row.id} 调试`;
    initializeDebugInitSchema(
      parseArrayValue(record.init_field_list ?? record.initFieldList),
      initParamSourceFromRecord(record),
    );
    initializeDebugSchema(
      parseArrayValue(record.input_field_list ?? record.inputFieldList),
    );
  } else {
    if (hasFormInitSchema.value) syncToolInitRawFromForm();
    debugTargetId.value = undefined;
    debugDraftPayload.value = buildPayload();
    debugTitle.value = form.name ? `${form.name} 草稿调试` : '草稿调试';
    initializeDebugInitSchema(form.init_field_list, form.init_params);
    initializeDebugSchema(form.input_field_list);
  }
  debugOpen.value = true;
}

async function runDebug() {
  debugRunning.value = true;
  try {
    const initParams = await prepareDebugInitParamsForRun();
    if (!initParams.ok) return;
    if (debugInputTab.value === 'form' && hasDebugSchema.value) {
      syncRawDebugInputFromForm();
    }
    const inputJson = debugInputJsonForRun();
    const initParamPayload = initParams.value
      ? { initParams: initParams.value, init_params: initParams.value }
      : {};
    debugOutput.value = debugTargetId.value
      ? await debugTool(debugTargetId.value, {
          ...initParamPayload,
          input_json: inputJson,
          inputJson,
        })
      : await debugDraftTool({
          ...(debugDraftPayload.value || buildPayload()),
          ...initParamPayload,
          input_json: inputJson,
          inputJson,
        });
  } finally {
    debugRunning.value = false;
  }
}

async function openRecords(row: ToolRecord) {
  if (!row.id) return;
  activeTool.value = row;
  recordsQuery.current = 1;
  recordsQuery.page = 1;
  recordsOpen.value = true;
  await loadRecords();
}

async function loadRecords() {
  if (!activeTool.value?.id) return;
  recordsLoading.value = true;
  try {
    const data = await pageToolRecords(activeTool.value.id, recordsQuery);
    records.value = recordsOf<ToolRecord>(data);
    recordsTotal.value = totalOf(data);
  } finally {
    recordsLoading.value = false;
  }
}

function handleRecordsPageChange(page: number) {
  recordsQuery.current = page;
  recordsQuery.page = page;
  loadRecords();
}

async function openStoreDialog(tab: StoreTab = 'internal') {
  storeTab.value = tab;
  storeOpen.value = true;
  await loadStoreTools();
}

async function loadStoreTools() {
  storeLoading.value = true;
  try {
    const [internalData, storeData] = await Promise.all([
      listInternalTools({ name: storeSearch.value || undefined }),
      listStoreTools({ name: storeSearch.value || undefined }),
    ]);
    internalToolList.value = recordsOf<ToolRecord>(internalData);
    const storeRecord = isRecord(storeData) ? storeData : {};
    const apps = storeRecord.apps;
    storeToolList.value = Array.isArray(apps)
      ? apps
          .filter((item): item is Record<string, unknown> => isRecord(item))
          .map((item) => cloneDeep(item) as ToolRecord)
      : recordsOf<ToolRecord>(storeData);
  } finally {
    storeLoading.value = false;
  }
}

async function addTemplateTool(row: ToolRecord, source: StoreTab) {
  if (!row.id) return;
  const payload: ToolRequest = {
    folder_id: currentFolderId.value,
    name: stringValue(row.name, '未命名工具'),
    workspace_id: query.workspaceId,
  };
  await (source === 'internal'
    ? addInternalToolApi(row.id, payload)
    : addStoreTool(row.id, payload));
  ElMessage.success('已添加到当前工作空间');
  storeOpen.value = false;
  await refreshAll();
}

async function updateFromStore(row: ToolRecord) {
  if (!row.id) return;
  await updateStoreTool(row.id, {
    description: stringValue(row.description ?? row.desc),
    icon: stringValue(row.icon),
    label: stringValue(row.label),
    name: stringValue(row.name),
    version: stringValue(row.version),
  });
  ElMessage.success('商店版本信息已更新');
  await refreshAll();
}

async function init() {
  await refreshAll();
}

onMounted(init);
</script>

<template>
  <Page auto-content-height>
    <div class="tool-console" v-loading="loading || drawerLoading">
      <section class="tool-management-shell">
        <aside class="tool-folder-pane" v-loading="treeLoading">
          <div class="folder-pane-header">
            <h4>工具</h4>
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
                    :command="item.value"
                    :divided="item.divided"
                    :class="{ 'is-active': folderSort === item.value }"
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
            class="tool-folder-tree"
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
                        <ElDropdownItem @click.stop="openFolderAuthorization">
                          <span class="folder-action-menu__item">
                            <Lock class="folder-action-menu__icon" />
                            <span>资源授权</span>
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

        <main class="tool-list-pane">
          <header class="tool-list-header">
            <div class="tool-list-title">
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
              <div class="tool-list-title__meta">{{ pageSubtitle }}</div>
            </div>
            <span class="tool-header-divider"></span>
            <div class="tool-list-actions">
              <ElSelect
                v-model="query.toolType"
                class="tool-type-select"
                clearable
                placeholder="类型"
                @change="handleSearch"
              >
                <ElOption
                  v-for="item in toolTypes"
                  :key="item.value || 'all'"
                  :label="item.label"
                  :value="item.value"
                />
              </ElSelect>

              <div class="complex-search">
                <ElSelect
                  v-model="query.searchType"
                  class="complex-search__type"
                  @change="handleSearchTypeChange"
                >
                  <ElOption
                    v-for="item in searchTypeOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </ElSelect>
                <ElInput
                  v-if="query.searchType === 'name'"
                  v-model="query.name"
                  class="complex-search__input"
                  clearable
                  placeholder="搜索工具"
                  @clear="handleSearch"
                  @change="handleSearch"
                  @keyup.enter="handleSearch"
                >
                  <template #prefix><Search /></template>
                </ElInput>
                <ElSelect
                  v-else
                  v-model="query.create_user"
                  class="complex-search__input"
                  clearable
                  filterable
                  :loading="creatorLoading"
                  placeholder="搜索创建者"
                  remote
                  :remote-method="loadCreatorOptions"
                  @change="handleSearch"
                  @clear="handleSearch"
                  @visible-change="handleCreatorSelectVisibleChange"
                >
                  <ElOption
                    v-for="item in creatorOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </ElSelect>
              </div>

              <ElButton @click="toggleBatchMode(!batchMode)">
                <Files class="button-icon" />
                {{ batchMode ? '取消选择' : '批量选择' }}
              </ElButton>
              <ElButton
                v-if="!batchMode"
                :icon="ShoppingCart"
                @click="openStoreDialog('internal')"
              >
                工具商店
              </ElButton>
              <ElDropdown v-if="!batchMode" trigger="click">
                <ElButton :icon="Plus" type="primary">创建</ElButton>
                <template #dropdown>
                  <ElDropdownMenu class="tool-create-dropdown">
                    <ElDropdownItem
                      v-for="item in createMenuItems"
                      :key="item.type"
                      @click="openToolDrawer(item.type)"
                    >
                      <div class="create-menu-item">
                        <span class="create-menu-icon" :class="item.iconClass">
                          <component :is="item.icon" />
                        </span>
                        <span class="create-menu-label">{{ item.label }}</span>
                      </div>
                    </ElDropdownItem>
                    <ElUpload
                      :auto-upload="false"
                      :on-change="handleImportFile"
                      :show-file-list="false"
                      accept=".json,.tool"
                      class="create-menu-upload"
                    >
                      <ElDropdownItem>
                        <div class="create-menu-item">
                          <span class="create-menu-icon is-create-blue">
                            <UploadIcon />
                          </span>
                          <span class="create-menu-label">导入创建</span>
                        </div>
                      </ElDropdownItem>
                    </ElUpload>
                    <ElDropdownItem divided @click="openCreateFolderFromMenu">
                      <div class="create-menu-item">
                        <span class="create-menu-icon is-create-folder">
                          <FolderOpened />
                        </span>
                        <span class="create-menu-label">添加文件夹</span>
                      </div>
                    </ElDropdownItem>
                  </ElDropdownMenu>
                </template>
              </ElDropdown>
            </div>
          </header>

          <section class="tool-card-scroll">
            <div v-if="tools.length > 0" class="tool-card-grid">
              <article
                v-for="item in tools"
                :key="item.id"
                class="tool-card"
                :class="{
                  'is-batch': batchMode,
                  'is-selected': isSelected(item),
                }"
                role="button"
                tabindex="0"
                @click="handleToolCardClick(item)"
                @keydown.enter="handleToolCardClick(item)"
              >
                <div class="tool-card__body">
                  <div class="tool-card__head">
                    <span
                      class="tool-avatar"
                      :class="toolTypeClass(rawToolType(item))"
                    >
                      <img
                        v-if="isImageIcon(item.icon)"
                        :src="stringValue(item.icon)"
                        alt=""
                      />
                      <span v-else>{{ toolIconText(item) }}</span>
                    </span>
                    <span class="tool-card__identity">
                      <span class="tool-card__title-row">
                        <strong
                          :title="
                            stringValue(item.name || item.id, '未命名工具')
                          "
                        >
                          {{ item.name || item.id || '未命名工具' }}
                        </strong>
                        <ElTag
                          v-if="item.version"
                          effect="plain"
                          size="small"
                          type="info"
                        >
                          {{ item.version }}
                        </ElTag>
                      </span>
                      <span
                        class="tool-card__subtitle"
                        :title="toolSecondaryLine(item)"
                      >
                        {{ toolSecondaryLine(item) }}
                      </span>
                    </span>
                    <ElCheckbox
                      v-if="batchMode"
                      class="tool-card__checkbox"
                      :model-value="isSelected(item)"
                      @click.stop
                      @change="
                        (checked) => toggleSelection(item, Boolean(checked))
                      "
                    />
                  </div>
                  <p class="tool-card__desc" :title="toolDescription(item)">
                    {{ toolDescription(item) }}
                  </p>
                </div>
                <div class="tool-card__footer">
                  <span
                    class="tool-card__status"
                    :class="isToolEnabled(item) ? 'is-enabled' : 'is-disabled'"
                  >
                    <Check
                      v-if="isToolEnabled(item)"
                      class="tool-card__status-icon"
                    />
                    <span v-else class="tool-card__status-dot"></span>
                    {{ enabledText(isToolEnabled(item)) }}
                  </span>
                  <ElTag
                    effect="plain"
                    size="small"
                    :type="toolTypeTagType(rawToolType(item))"
                  >
                    {{ toolTypeDisplay(item) }}
                  </ElTag>
                </div>
                <div
                  v-if="!batchMode"
                  class="tool-card__hover-actions"
                  @click.stop
                >
                  <ElSwitch
                    :disabled="isToolToggleLoading(item)"
                    :loading="isToolToggleLoading(item)"
                    :model-value="isToolEnabled(item)"
                    size="small"
                    @change="(value) => toggleToolEnabled(item, Boolean(value))"
                  />
                  <span class="tool-card__action-divider"></span>
                  <ElDropdown trigger="click">
                    <ElButton :icon="MoreFilled" circle text />
                    <template #dropdown>
                      <ElDropdownMenu>
                        <ElDropdownItem
                          @click="openToolDrawer(toolTypeOf(item), item)"
                        >
                          编辑
                        </ElDropdownItem>
                        <ElDropdownItem
                          v-if="toolTypeOf(item) === 'WORKFLOW'"
                          @click="openWorkflowEditor(item)"
                        >
                          打开工作流
                        </ElDropdownItem>
                        <ElDropdownItem @click="openDebugDialog(item)">
                          调试
                        </ElDropdownItem>
                        <ElDropdownItem @click="openRecords(item)">
                          执行记录
                        </ElDropdownItem>
                        <ElDropdownItem @click="copyTool(item)">
                          复制
                        </ElDropdownItem>
                        <ElDropdownItem @click="openMoveDialog(item)">
                          移动
                        </ElDropdownItem>
                        <ElDropdownItem @click="exportToolFile(item)">
                          导出
                        </ElDropdownItem>
                        <ElDropdownItem
                          v-if="item.templateId || item.template_id"
                          @click="updateFromStore(item)"
                        >
                          更新商店信息
                        </ElDropdownItem>
                        <ElDropdownItem divided @click="removeTool(item)">
                          删除
                        </ElDropdownItem>
                      </ElDropdownMenu>
                    </template>
                  </ElDropdown>
                </div>
              </article>
            </div>
            <ElEmpty
              v-else
              class="empty-panel"
              description="暂无工具，试试导入或从商店添加"
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
              @click="removeSelectedTools"
            >
              删除
            </ElButton>
            <span class="batch-operation-bar__summary">
              已选择 {{ selectedIds.length }}/{{ total }} 个工具
            </span>
            <span class="batch-operation-bar__names">
              {{ selectedTools.map((item) => item.name || item.id).join('、') }}
            </span>
            <ElButton link type="primary" @click="toggleBatchMode(false)">
              取消选择
            </ElButton>
          </div>
        </main>
      </section>

      <ElDrawer v-model="toolDrawerOpen" :title="toolDrawerTitle" size="60%">
        <div class="tool-form-stack">
          <section class="detail-section">
            <div class="section-title">
              <span>基础信息</span>
              <ElTag
                effect="plain"
                size="small"
                :type="toolTypeTagType(form.tool_type)"
              >
                {{ toolTypeLabel(form.tool_type) }}
              </ElTag>
            </div>
            <ElForm
              :model="form"
              label-position="top"
              require-asterisk-position="right"
            >
              <ElFormItem label="名称" required>
                <ElInput
                  v-model="form.name"
                  maxlength="64"
                  placeholder="请输入工具名称"
                  show-word-limit
                  @blur="form.name = form.name.trim()"
                />
              </ElFormItem>
              <ElFormItem label="描述">
                <ElInput
                  v-model="form.description"
                  maxlength="128"
                  placeholder="请输入描述"
                  show-word-limit
                  type="textarea"
                  :rows="3"
                  @blur="form.description = form.description.trim()"
                />
              </ElFormItem>
              <ElFormItem label="图标">
                <div class="inline-action">
                  <ElInput
                    v-model="form.icon"
                    placeholder="图标 URL、资源 ID 或标识"
                  />
                  <ElButton :disabled="!editingId" @click="saveIcon">
                    保存图标
                  </ElButton>
                </div>
              </ElFormItem>
            </ElForm>
          </section>

          <section v-if="showInitParamSection" class="detail-section">
            <div class="section-title">
              <span>初始化参数</span>
              <ElButton
                size="small"
                type="primary"
                @click="openFieldDialog('init')"
              >
                新增
              </ElButton>
            </div>
            <ElTable :data="form.init_field_list" size="small">
              <ElTableColumn label="字段" min-width="120">
                <template #default="{ row }">
                  {{ row.field || row.name }}
                </template>
              </ElTableColumn>
              <ElTableColumn label="组件" width="130">
                <template #default="{ row }">
                  <ElTag size="small">
                    {{ row.input_type || '-' }}
                  </ElTag>
                </template>
              </ElTableColumn>
              <ElTableColumn label="必填" width="80">
                <template #default="{ row }">
                  {{ row.required ? '是' : '否' }}
                </template>
              </ElTableColumn>
              <ElTableColumn label="操作" width="120">
                <template #default="{ row, $index }">
                  <ElButton link @click="openFieldDialog('init', row, $index)">
                    编辑
                  </ElButton>
                  <ElButton
                    link
                    type="danger"
                    @click="removeField('init', $index)"
                  >
                    删
                  </ElButton>
                </template>
              </ElTableColumn>
            </ElTable>

            <div class="section-title mt12">
              <span>初始化参数值 init_params</span>
              <span class="muted">启用工具时会校验必填启动参数</span>
            </div>
            <ElTabs
              v-model="initParamTab"
              class="init-param-tabs"
              @tab-change="handleToolInitParamTabChange"
            >
              <ElTabPane v-if="hasFormInitSchema" label="参数表单" name="form">
                <DynamicInitForm
                  ref="toolInitFormRef"
                  :fields="form.init_field_list"
                  :model-value="formInitParamValues"
                  @update:model-value="handleToolInitParamsUpdate"
                />
              </ElTabPane>
              <ElTabPane label="原始 JSON" name="raw">
                <div class="init-param-raw-hint">
                  高级编辑入口。提交 JSON 对象，保存时仍会校验必填启动参数。
                </div>
                <CodeEditor
                  v-model="form.init_params"
                  class="init-param-raw-input tool-code-editor"
                  height="180px"
                  mode="json"
                  @blur="syncToolInitFormFromRaw(false)"
                  @change="syncToolInitFormFromRaw(false)"
                />
                <div
                  class="syntax-status"
                  :class="
                    toolInitParamsJsonSyntax.valid ? 'is-success' : 'is-error'
                  "
                >
                  <ElTag
                    effect="plain"
                    size="small"
                    :type="jsonSyntaxTagType(toolInitParamsJsonSyntax)"
                  >
                    {{ jsonSyntaxTagText(toolInitParamsJsonSyntax) }}
                  </ElTag>
                  <span>{{ jsonSyntaxMessage(toolInitParamsJsonSyntax) }}</span>
                </div>
              </ElTabPane>
            </ElTabs>
          </section>

          <section v-if="showInputParamSection" class="detail-section">
            <div class="section-title">
              <span>输入参数</span>
              <span class="muted">运行工具时由调用方传入</span>
              <ElButton
                size="small"
                type="primary"
                @click="openFieldDialog('input')"
              >
                新增
              </ElButton>
            </div>
            <ElTable :data="form.input_field_list" size="small">
              <ElTableColumn label="名称" min-width="120">
                <template #default="{ row }">{{ row.name }}</template>
              </ElTableColumn>
              <ElTableColumn label="类型" width="100">
                <template #default="{ row }">
                  <ElTag size="small">{{ row.type }}</ElTag>
                </template>
              </ElTableColumn>
              <ElTableColumn label="来源" width="100">
                <template #default="{ row }">
                  {{ row.source === 'custom' ? '自定义' : '引用' }}
                </template>
              </ElTableColumn>
              <ElTableColumn label="操作" width="120">
                <template #default="{ row, $index }">
                  <ElButton link @click="openFieldDialog('input', row, $index)">
                    编辑
                  </ElButton>
                  <ElButton
                    link
                    type="danger"
                    @click="removeField('input', $index)"
                  >
                    删
                  </ElButton>
                </template>
              </ElTableColumn>
            </ElTable>
          </section>

          <section v-if="showCodeSection" class="detail-section">
            <div class="section-title">
              <span>{{
                form.tool_type === 'DATA_SOURCE'
                  ? '数据源 Python 代码'
                  : 'Python 代码'
              }}</span>
              <ElButton
                v-if="canGenerateToolCode"
                :icon="MagicStick"
                link
                type="primary"
                @click="openGenerateCodeDialog"
              >
                AI 生成代码
              </ElButton>
              <ElButton
                v-if="pythonSyntaxCheckApplies"
                :loading="pythonSyntaxLoading"
                link
                type="primary"
                @click="runPythonSyntaxCheck()"
              >
                语法检查
              </ElButton>
            </div>
            <CodeEditor
              v-model="form.code"
              class="code-editor-input tool-code-editor"
              height="460px"
              mode="python"
              @change="markPythonSyntaxStale"
            />
            <div
              v-if="pythonSyntaxCheckApplies"
              class="syntax-status"
              :class="`is-${pythonSyntaxStatus}`"
            >
              <ElTag effect="plain" size="small" :type="pythonSyntaxTagType()">
                {{ pythonSyntaxTagText() }}
              </ElTag>
              <span>{{ pythonSyntaxStatusText }}</span>
            </div>
            <ul
              v-if="
                pythonSyntaxCheckApplies && pythonSyntaxDiagnostics.length > 0
              "
              class="syntax-diagnostic-list"
            >
              <li
                v-for="(item, index) in pythonSyntaxDiagnostics"
                :key="`${item.line || 0}-${item.column || 0}-${index}`"
                :class="isPythonSyntaxError(item) ? 'is-error' : 'is-warning'"
              >
                <span class="syntax-diagnostic-list__location">
                  {{ pythonDiagnosticLocation(item) || 'Python' }}
                </span>
                <span>{{ item.message }}</span>
              </li>
            </ul>
          </section>

          <section v-if="showOutputHint" class="detail-section">
            <div class="section-title">
              <span>输出参数</span>
              <span class="muted">MaxKB 工具默认输出结果字段</span>
            </div>
            <div class="output-hint">结果 {result}</div>
          </section>

          <section v-if="showSkillFileSection" class="detail-section">
            <div class="section-title">
              <span>技能 ZIP</span>
              <span class="muted">上传后后端返回文件 ID，并写入 code 字段</span>
            </div>
            <div v-if="form.code || uploadedSkillFile" class="skill-file-card">
              <div>
                <strong>{{
                  uploadedSkillFile?.fileName ||
                  uploadedSkillFile?.file_name ||
                  '已选择 Skill 文件'
                }}</strong>
                <p>文件 ID：{{ form.code || '-' }}</p>
              </div>
              <div class="file-actions">
                <ElUpload
                  :auto-upload="false"
                  :on-change="handleSkillUpload"
                  :show-file-list="false"
                  accept=".zip"
                >
                  <ElButton :icon="UploadIcon" link type="primary">
                    重新上传
                  </ElButton>
                </ElUpload>
                <ElButton
                  :disabled="!form.code"
                  :icon="DownloadIcon"
                  link
                  type="primary"
                  @click="downloadSkill"
                >
                  下载
                </ElButton>
              </div>
            </div>
            <ElUpload
              v-else
              :auto-upload="false"
              class="skill-upload"
              drag
              :on-change="handleSkillUpload"
              :show-file-list="false"
              accept=".zip"
            >
              <UploadIcon class="skill-upload__icon" />
              <div class="skill-upload__text">
                拖拽 Skill ZIP 到此处，或点击上传
              </div>
              <template #tip>
                <div class="skill-upload__tip muted">
                  仅支持 ZIP 格式，单个文件不超过
                  {{ skillZipFileSizeLimitMb }}MB，保存时 code
                  将使用上传返回的文件 ID。
                </div>
              </template>
            </ElUpload>
            <ElInput
              v-model="form.code"
              class="skill-file-id-input mt12"
              placeholder="上传后写入文件 ID"
              readonly
            />
          </section>

          <section v-if="showMcpConfigSection" class="detail-section">
            <div class="section-title">
              <span>MCP Server Config JSON</span>
              <span class="muted">必填，MaxKB 兼容 mcp_servers 配置</span>
            </div>
            <ElAlert
              title="填写 MCP Server 配置 JSON，可在保存前测试连接。"
              type="info"
              :closable="false"
            />
            <details class="mcp-config-example mt12">
              <summary>查看 MCP JSON 示例</summary>
              <pre>{{ mcpServerJsonExample }}</pre>
            </details>
            <CodeEditor
              v-model="form.code"
              class="mcp-config-input mt12 tool-code-editor"
              height="280px"
              mode="json"
            />
            <div
              class="syntax-status"
              :class="mcpConfigJsonSyntax.valid ? 'is-success' : 'is-error'"
            >
              <ElTag
                effect="plain"
                size="small"
                :type="jsonSyntaxTagType(mcpConfigJsonSyntax)"
              >
                {{ jsonSyntaxTagText(mcpConfigJsonSyntax) }}
              </ElTag>
              <span>{{ jsonSyntaxMessage(mcpConfigJsonSyntax) }}</span>
            </div>
          </section>
        </div>
        <template #footer>
          <ElButton
            v-if="showMcpConfigSection"
            :loading="mcpLoading"
            @click="runTestConnection"
          >
            测试连接
          </ElButton>
          <ElButton @click="toolDrawerOpen = false">取消</ElButton>
          <ElButton v-if="showDraftDebugButton" @click="openDebugDialog()">
            调试
          </ElButton>
          <ElButton type="primary" @click="saveTool">
            {{ toolPrimaryButtonText }}
          </ElButton>
        </template>
      </ElDrawer>

      <ElDialog
        v-model="workflowDialogOpen"
        append-to-body
        :close-on-click-modal="false"
        :close-on-press-escape="false"
        :title="workflowDialogTitle"
        width="550px"
      >
        <ElForm
          :model="form"
          label-position="top"
          require-asterisk-position="right"
        >
          <ElFormItem label="名称" required>
            <ElInput
              v-model="form.name"
              maxlength="64"
              placeholder="请输入工作流名称"
              show-word-limit
              @blur="form.name = form.name.trim()"
            />
          </ElFormItem>
          <ElFormItem label="描述">
            <ElInput
              v-model="form.description"
              maxlength="128"
              placeholder="请输入描述"
              show-word-limit
              type="textarea"
              :rows="3"
              @blur="form.description = form.description.trim()"
            />
          </ElFormItem>
        </ElForm>
        <template #footer>
          <ElButton @click="workflowDialogOpen = false">取消</ElButton>
          <ElButton type="primary" @click="saveTool">
            {{ workflowPrimaryButtonText }}
          </ElButton>
        </template>
      </ElDialog>

      <GenerateCodeDialog
        v-model="generateCodeDialogOpen"
        :current-code="form.code"
        :init-field-list="form.init_field_list"
        :input-field-list="form.input_field_list"
        :tool-description="form.description"
        :tool-name="form.name"
        @insert="handleGeneratedCodeInsert"
        @replace="handleGeneratedCodeReplace"
      />

      <InitParamDrawer
        v-model="initParamDrawerOpen"
        :fields="initParamDrawerFields"
        :loading="initParamDrawerSaving"
        :params="initParamDrawerValues"
        :raw-text="initParamDrawerRawText"
        :tool-name="initParamDrawerToolName"
        @save="saveEnableInitParams"
        @update:params="
          (value) => replaceInitParamValues(initParamDrawerValues, value)
        "
        @update:raw-text="(value) => (initParamDrawerRawText = value)"
      />

      <ElDialog
        v-model="fieldDialogOpen"
        :title="fieldMode === 'init' ? '初始化参数' : '输入参数'"
        width="620px"
      >
        <ElForm :model="fieldForm" label-width="96px">
          <template v-if="fieldMode === 'init'">
            <ElFormItem label="字段名">
              <ElInput v-model="fieldForm.field" />
            </ElFormItem>
            <ElFormItem label="显示名称">
              <ElInput v-model="fieldForm.label" />
            </ElFormItem>
            <ElFormItem label="组件类型">
              <ElSelect v-model="fieldForm.input_type">
                <ElOption
                  v-for="item in initInputTypeOptions"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="必填">
              <ElSwitch v-model="fieldForm.required" />
            </ElFormItem>
            <ElFormItem label="默认值">
              <ElInput v-model="fieldForm.default_value" />
            </ElFormItem>
            <ElFormItem label="显示默认">
              <ElSwitch v-model="fieldForm.show_default_value" />
            </ElFormItem>
            <ElFormItem label="Attrs JSON">
              <ElInput
                v-model="fieldForm.attrs_json"
                type="textarea"
                :rows="4"
              />
            </ElFormItem>
            <ElFormItem label="选项 JSON">
              <ElInput
                v-model="fieldForm.option_list_json"
                type="textarea"
                :rows="4"
              />
            </ElFormItem>
          </template>
          <template v-else>
            <ElFormItem label="参数名">
              <ElInput v-model="fieldForm.name" />
            </ElFormItem>
            <ElFormItem label="数据类型">
              <ElSelect v-model="fieldForm.type">
                <ElOption
                  v-for="item in inputTypeOptions"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="来源">
              <ElSelect v-model="fieldForm.source">
                <ElOption label="引用" value="reference" /><ElOption
                  label="自定义"
                  value="custom"
                />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="必填">
              <ElSwitch v-model="fieldForm.is_required" />
            </ElFormItem>
            <ElFormItem label="说明">
              <ElInput v-model="fieldForm.desc" />
            </ElFormItem>
          </template>
        </ElForm>
        <template #footer>
          <ElButton @click="fieldDialogOpen = false">取消</ElButton>
          <ElButton type="primary" @click="saveField">保存</ElButton>
        </template>
      </ElDialog>

      <ElDialog
        v-model="folderDialogOpen"
        :title="folderDialogTitle"
        width="720px"
      >
        <ElForm :model="folderForm" label-position="top">
          <ElFormItem label="名称">
            <ElInput
              v-model="folderForm.name"
              maxlength="64"
              placeholder="请输入文件夹名称"
              show-word-limit
              @blur="folderForm.name = folderForm.name.trim()"
            />
          </ElFormItem>
          <ElFormItem label="描述">
            <ElInput
              v-model="folderForm.description"
              maxlength="128"
              placeholder="请输入描述"
              show-word-limit
              type="textarea"
              :rows="3"
              @blur="folderForm.description = folderForm.description.trim()"
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

      <ElDialog v-model="debugOpen" :title="debugTitle" width="860px">
        <div class="debug-grid">
          <section>
            <div v-if="hasDebugInitSchema" class="debug-init-panel">
              <div class="section-title">
                <span>初始化参数</span><span class="muted">仅本次调试</span>
              </div>
              <ElTabs
                v-model="debugInitParamTab"
                class="debug-tabs"
                @tab-change="handleDebugInitParamTabChange"
              >
                <ElTabPane label="参数表单" name="form">
                  <DynamicInitForm
                    ref="debugInitFormRef"
                    :fields="debugInitSchemaFields"
                    :model-value="debugInitParamValues"
                    @update:model-value="handleDebugInitParamsUpdate"
                  />
                </ElTabPane>
                <ElTabPane label="原始 JSON" name="raw">
                  <div class="debug-raw-hint">
                    高级编辑入口。运行前会校验必填启动参数。
                  </div>
                  <CodeEditor
                    v-model="debugInitParamsRaw"
                    class="debug-raw-input tool-code-editor"
                    height="180px"
                    mode="json"
                    @blur="syncDebugInitFormFromRaw(false)"
                    @change="syncDebugInitFormFromRaw(false)"
                  />
                  <div
                    class="syntax-status"
                    :class="
                      debugInitParamsJsonSyntax.valid
                        ? 'is-success'
                        : 'is-error'
                    "
                  >
                    <ElTag
                      effect="plain"
                      size="small"
                      :type="jsonSyntaxTagType(debugInitParamsJsonSyntax)"
                    >
                      {{ jsonSyntaxTagText(debugInitParamsJsonSyntax) }}
                    </ElTag>
                    <span>{{
                      jsonSyntaxMessage(debugInitParamsJsonSyntax)
                    }}</span>
                  </div>
                </ElTabPane>
              </ElTabs>
            </div>
            <div class="section-title">
              <span>调试输入</span>
              <span class="muted">支持已保存工具和当前草稿</span>
            </div>
            <ElTabs
              v-model="debugInputTab"
              class="debug-tabs"
              @tab-change="handleDebugTabChange"
            >
              <ElTabPane label="参数表单" name="form">
                <ElForm
                  v-if="hasDebugSchema"
                  class="debug-form"
                  label-position="top"
                >
                  <ElFormItem
                    v-for="item in debugFields"
                    :key="item.key"
                    :label="item.label"
                    :required="item.required"
                  >
                    <ElSelect
                      v-if="item.control === 'select'"
                      class="debug-control"
                      clearable
                      filterable
                      :model-value="debugSelectValue(item.key)"
                      :placeholder="`请选择${item.label}`"
                      @update:model-value="
                        (value) => patchDebugFieldValue(item.key, value)
                      "
                    >
                      <ElOption
                        v-for="option in item.options"
                        :key="`${item.key}-${option.value}`"
                        :label="option.label"
                        :value="option.value"
                      />
                    </ElSelect>
                    <ElSelect
                      v-else-if="item.control === 'multiselect'"
                      class="debug-control"
                      clearable
                      collapse-tags
                      collapse-tags-tooltip
                      filterable
                      :model-value="debugMultiSelectValue(item.key)"
                      multiple
                      :placeholder="`请选择${item.label}`"
                      @update:model-value="
                        (value) => patchDebugFieldValue(item.key, value)
                      "
                    >
                      <ElOption
                        v-for="option in item.options"
                        :key="`${item.key}-${option.value}`"
                        :label="option.label"
                        :value="option.value"
                      />
                    </ElSelect>
                    <ElInputNumber
                      v-else-if="item.control === 'number'"
                      class="debug-control"
                      controls-position="right"
                      :model-value="
                        debugNumberValue(debugFieldValues[item.key])
                      "
                      :placeholder="`请输入${item.label}`"
                      @update:model-value="
                        (value) => patchDebugFieldValue(item.key, value)
                      "
                    />
                    <ElSwitch
                      v-else-if="item.control === 'boolean'"
                      :model-value="
                        debugBooleanValue(debugFieldValues[item.key])
                      "
                      @update:model-value="
                        (value) => patchDebugFieldValue(item.key, value)
                      "
                    />
                    <ElInput
                      v-else-if="
                        item.control === 'json' || item.control === 'textarea'
                      "
                      :model-value="debugTextValue(item.key)"
                      type="textarea"
                      :placeholder="
                        item.control === 'json'
                          ? debugDefaultJsonText(item)
                          : `请输入${item.label}`
                      "
                      :rows="item.control === 'json' ? 4 : 3"
                      @update:model-value="
                        (value) => patchDebugFieldValue(item.key, value)
                      "
                    />
                    <ElInput
                      v-else
                      clearable
                      :model-value="debugTextValue(item.key)"
                      :placeholder="`请输入${item.label}`"
                      :show-password="item.inputType === 'PasswordInput'"
                      @update:model-value="
                        (value) => patchDebugFieldValue(item.key, value)
                      "
                    />
                    <div v-if="item.desc" class="debug-field-desc">
                      {{ item.desc }}
                    </div>
                  </ElFormItem>
                </ElForm>
                <ElEmpty
                  v-else
                  class="debug-empty"
                  description="当前工具未声明 input_field_list，请使用原始 JSON 调试"
                />
              </ElTabPane>
              <ElTabPane label="原始 JSON" name="raw">
                <div class="debug-raw-hint">
                  高级编辑入口。JSON 无法解析时仍会按原始内容提交。
                </div>
                <CodeEditor
                  v-model="debugInput"
                  class="debug-raw-input tool-code-editor"
                  height="var(--debug-panel-height)"
                  mode="json"
                  @blur="syncDebugFormFromRaw(false)"
                  @change="syncDebugFormFromRaw(false)"
                />
                <div
                  class="syntax-status"
                  :class="
                    debugInputJsonSyntax.valid ? 'is-success' : 'is-error'
                  "
                >
                  <ElTag
                    effect="plain"
                    size="small"
                    :type="jsonSyntaxTagType(debugInputJsonSyntax)"
                  >
                    {{ jsonSyntaxTagText(debugInputJsonSyntax) }}
                  </ElTag>
                  <span>
                    {{
                      jsonSyntaxMessage(debugInputJsonSyntax)
                    }}，无效时仍会按原始内容提交
                  </span>
                </div>
              </ElTabPane>
            </ElTabs>
          </section>
          <section>
            <div class="section-title">
              <span>输出</span>
              <span class="muted">R.ok 已按请求拦截器解包</span>
            </div>
            <pre class="result-box debug-result">{{
              prettyJson(debugOutput, '暂无调试结果')
            }}</pre>
          </section>
        </div>
        <template #footer>
          <ElButton @click="debugOpen = false">关闭</ElButton>
          <ElButton :loading="debugRunning" type="primary" @click="runDebug">
            运行调试
          </ElButton>
        </template>
      </ElDialog>

      <ElDialog v-model="moveDialogOpen" title="移动工具" width="460px">
        <ElForm label-width="90px" :model="moveForm">
          <ElFormItem label="目标目录">
            <ElSelect v-model="moveForm.folder_id" clearable>
              <ElOption
                v-for="item in folderOptions"
                :key="item.id || 'root'"
                :label="item.name"
                :value="item.id ?? ''"
              />
            </ElSelect>
          </ElFormItem>
          <ElAlert
            :title="`将移动 ${moveIds.length} 个工具`"
            type="info"
            :closable="false"
          />
        </ElForm>
        <template #footer>
          <ElButton @click="moveDialogOpen = false">取消</ElButton>
          <ElButton type="primary" @click="saveMove">移动</ElButton>
        </template>
      </ElDialog>

      <ElDialog v-model="storeOpen" title="工具商店 / 内置工具" width="980px">
        <div class="store-header">
          <ElInput
            v-model="storeSearch"
            clearable
            placeholder="搜索工具"
            @keyup.enter="loadStoreTools"
          />
          <ElButton :icon="Search" type="primary" @click="loadStoreTools">
            搜索
          </ElButton>
        </div>
        <ElTabs v-model="storeTab" v-loading="storeLoading">
          <ElTabPane label="内置工具" name="internal">
            <div class="store-grid">
              <article
                v-for="item in internalToolList"
                :key="item.id"
                class="store-card"
              >
                <div>
                  <strong>{{ item.name || item.id }}</strong>
                  <p>{{ toolDescription(item) }}</p>
                </div>
                <ElTag size="small">
                  {{ toolTypeLabel(toolTypeOf(item)) }}
                </ElTag>
                <ElButton
                  type="primary"
                  @click="addTemplateTool(item, 'internal')"
                >
                  添加
                </ElButton>
              </article>
            </div>
          </ElTabPane>
          <ElTabPane label="Store" name="store">
            <div class="store-grid">
              <article
                v-for="item in storeToolList"
                :key="item.id"
                class="store-card"
              >
                <div>
                  <strong>{{ item.name || item.id }}</strong>
                  <p>{{ toolDescription(item) }}</p>
                </div>
                <ElTag size="small" type="info">
                  {{ item.label || toolTypeLabel(toolTypeOf(item)) }}
                </ElTag>
                <ElButton
                  type="primary"
                  @click="addTemplateTool(item, 'store')"
                >
                  添加
                </ElButton>
              </article>
            </div>
          </ElTabPane>
        </ElTabs>
      </ElDialog>

      <ElDrawer
        v-model="recordsOpen"
        :title="`${activeTool?.name || ''} 调用记录`"
        size="760px"
      >
        <ElTable
          v-loading="recordsLoading"
          :data="records"
          height="calc(100vh - 170px)"
          size="small"
        >
          <ElTableColumn label="状态" width="110">
            <template #default="{ row }">
              <ElTag :type="statusType(row.status)" size="small">
                {{ row.status || '-' }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn prop="runTime" label="耗时" width="100" />
          <ElTableColumn prop="createTime" label="时间" width="170" />
          <ElTableColumn label="输入">
            <template #default="{ row }">
              <span class="mono-line">{{
                prettyJson(row.inputJson || row.input_json, '-')
              }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="输出">
            <template #default="{ row }">
              <span class="mono-line">{{
                prettyJson(row.outputJson || row.output_json, '-')
              }}</span>
            </template>
          </ElTableColumn>
        </ElTable>
        <div class="pager drawer-pager">
          <span>共 {{ recordsTotal }} 条</span>
          <ElPagination
            :current-page="recordsQuery.current"
            :page-size="recordsQuery.size"
            :total="recordsTotal"
            background
            layout="prev, pager, next"
            small
            @current-change="handleRecordsPageChange"
          />
        </div>
      </ElDrawer>
    </div>
  </Page>
</template>

<style scoped lang="scss">
.tool-console {
  --tool-space-1: 4px;
  --tool-space-2: 8px;
  --tool-space-3: 12px;
  --tool-space-4: 16px;
  --tool-space-5: 20px;
  --tool-radius: 6px;
  --tool-folder-pane-width: clamp(320px, 22vw, 360px);
  --tool-card-min-width: 300px;
  --tool-transition-fast: 0.18s ease;

  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.tool-management-shell {
  display: grid;
  grid-template-columns: var(--tool-folder-pane-width) minmax(0, 1fr);
  gap: 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--tool-radius);
}

.detail-section,
.empty-panel,
.store-card {
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--tool-radius);
}

.tool-folder-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: var(--tool-space-4) var(--tool-space-2) var(--tool-space-3);
  overflow: hidden;
  background: transparent;
  border-right: 1px solid var(--el-border-color-lighter);
}

.folder-pane-header,
.folder-pane-controls,
.tool-list-header,
.tool-list-actions,
.pager,
.batch-operation-bar,
.section-title,
.drawer-toolbar,
.file-actions,
.store-header,
.inline-action {
  display: flex;
  gap: var(--tool-space-2);
  align-items: center;
}

.folder-pane-header {
  flex-shrink: 0;
  padding: var(--tool-space-1) var(--tool-space-2) var(--tool-space-3);
}

.folder-pane-header h4 {
  margin: 0;
  font-size: calc(var(--font-size-base) * 1.25);
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.folder-pane-controls {
  flex-shrink: 0;
  padding: 0 var(--tool-space-2) var(--tool-space-2);
  margin-bottom: var(--tool-space-1);
}

.folder-search-input {
  flex: 1;
  min-width: 0;
}

.folder-sort-button {
  width: calc(var(--tool-space-4) * 2);
  height: calc(var(--tool-space-4) * 2);
  padding: 0;
}

.folder-search-input :deep(.el-input__wrapper) {
  min-height: calc(var(--tool-space-4) * 2);
}

.folder-sort-button svg {
  width: calc(var(--font-size-base) * 0.875);
  height: calc(var(--font-size-base) * 0.875);
}

.folder-sort-menu {
  min-width: calc(var(--tool-space-5) * 10);
}

.folder-sort-option {
  display: flex;
  gap: var(--tool-space-4);
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.folder-sort-menu :deep(.el-dropdown-menu__item.is-active) {
  color: var(--el-color-primary);
}

:global(.folder-action-menu) {
  min-width: 190px;
}

:global(.folder-action-menu .el-dropdown-menu__item) {
  min-height: 40px;
}

.folder-action-menu__item {
  display: inline-flex;
  gap: var(--tool-space-3);
  align-items: center;
}

.folder-action-menu__icon {
  width: calc(var(--font-size-base) * 1.125);
  height: calc(var(--font-size-base) * 1.125);
  color: var(--el-text-color-secondary);
}

.folder-sort-option__check {
  width: calc(var(--font-size-base) * 0.875);
  height: calc(var(--font-size-base) * 0.875);
  color: var(--el-color-primary);
}

.tool-folder-tree {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: transparent;
}

.tool-folder-tree :deep(.el-tree-node__content) {
  height: calc((var(--tool-space-4) * 2) + var(--tool-space-1));
  border-radius: var(--tool-radius);
}

.tool-folder-tree :deep(.el-tree-node__content:hover) {
  background: var(--el-fill-color-lighter);
}

.tool-folder-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
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
  gap: var(--tool-space-2);
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

.tool-folder-tree
  :deep(.el-tree-node.is-current > .el-tree-node__content .folder-node__label) {
  font-weight: 600;
  color: var(--el-color-primary);
}

.folder-node__actions {
  flex-shrink: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--tool-transition-fast);
}

.tool-folder-tree :deep(.el-tree-node__content:hover .folder-node__actions),
.tool-folder-tree
  :deep(
    .el-tree-node.is-current > .el-tree-node__content .folder-node__actions
  ),
.folder-node:focus-within .folder-node__actions {
  pointer-events: auto;
  opacity: 1;
}

.folder-node__more {
  width: calc(var(--tool-space-4) + var(--tool-space-2));
  height: calc(var(--tool-space-4) + var(--tool-space-2));
  color: var(--el-text-color-secondary);
}

.folder-node__more:hover {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.tool-list-title__meta,
.tool-card__subtitle,
.tool-card__desc,
.pager,
.batch-operation-bar__summary,
.batch-operation-bar__names,
.store-card p,
.muted {
  font-size: calc(var(--font-size-base) * 0.75);
  color: var(--el-text-color-secondary);
}

.tool-list-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.tool-list-header {
  flex-shrink: 0;
  flex-wrap: wrap;
  padding: var(--tool-space-3) var(--tool-space-4);
}

.tool-list-title {
  flex: 0 1 248px;
  min-width: 0;
}

.tool-list-title__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-breadcrumb {
  display: flex;
  gap: var(--tool-space-1);
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

.tool-header-divider {
  flex-shrink: 0;
  width: 1px;
  height: calc(var(--tool-space-5) + var(--tool-space-1));
  background: var(--el-border-color);
}

.tool-type-select {
  flex: 0 0 112px;
  width: 112px;
}

.tool-list-actions {
  flex: 0 1 auto;
  flex-wrap: nowrap;
  min-width: 0;
}

.tool-list-actions :deep(.el-button) {
  flex-shrink: 0;
}

.complex-search {
  display: flex;
  flex: 0 0 auto;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
  border-radius: var(--tool-radius);
}

.complex-search__type {
  width: 90px;
}

.complex-search__input {
  width: 190px;
}

.complex-search :deep(.el-select__wrapper),
.complex-search :deep(.el-input__wrapper) {
  box-shadow: none;
}

.complex-search :deep(.el-select__wrapper) {
  border-right: 1px solid var(--el-border-color-lighter);
  border-radius: 0;
}

.button-icon {
  width: calc(var(--font-size-base) * 0.875);
  height: calc(var(--font-size-base) * 0.875);
}

.tool-card-scroll {
  flex: 1;
  min-height: 0;
  padding: 0 var(--tool-space-4);
  overflow: auto;
}

.tool-card-grid {
  display: grid;
  grid-template-columns: repeat(
    auto-fill,
    minmax(var(--tool-card-min-width), 1fr)
  );
  gap: var(--tool-space-4);
  padding-bottom: var(--tool-space-3);
}

.tool-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 178px;
  overflow: hidden;
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--tool-radius);
  transition:
    border-color var(--el-transition-duration),
    box-shadow var(--el-transition-duration),
    transform var(--el-transition-duration);
}

.tool-card:hover,
.tool-card:focus-visible,
.tool-card.is-selected {
  border-color: var(--el-color-primary-light-5);
  box-shadow: var(--el-box-shadow-light);
}

.tool-card:hover,
.tool-card:focus-visible {
  transform: translateY(calc(var(--tool-space-1) * -0.25));
}

.tool-card.is-selected {
  background: var(--el-color-primary-light-9);
}

.tool-card__body {
  flex: 1;
  padding: var(--tool-space-4);
}

.tool-card__head {
  display: flex;
  gap: var(--tool-space-3);
  align-items: flex-start;
}

.tool-avatar {
  display: inline-flex;
  flex: 0 0 calc(var(--tool-space-5) * 2);
  align-items: center;
  justify-content: center;
  width: calc(var(--tool-space-5) * 2);
  height: calc(var(--tool-space-5) * 2);
  overflow: hidden;
  font-size: calc(var(--font-size-base) * 0.875);
  font-weight: 700;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: var(--tool-radius);
}

.tool-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tool-avatar.is-workflow {
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-7);
}

.tool-avatar.is-skill {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-7);
}

.tool-avatar.is-mcp {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning-light-7);
}

.tool-avatar.is-data-source {
  color: var(--el-color-info);
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color);
}

.tool-card__identity {
  flex: 1;
  min-width: 0;
}

.tool-card__title-row {
  display: flex;
  gap: var(--tool-space-2);
  align-items: center;
}

.tool-card__title-row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: calc(var(--font-size-base) * 0.875);
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.tool-card__subtitle {
  display: block;
  margin-top: var(--tool-space-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-card__checkbox {
  flex-shrink: 0;
}

.tool-card__desc {
  display: -webkit-box;
  margin: var(--tool-space-3) 0 0;
  overflow: hidden;
  -webkit-line-clamp: 3;
  line-height: 1.6;
  -webkit-box-orient: vertical;
}

.tool-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  padding: var(--tool-space-2) var(--tool-space-4);
  background: var(--el-fill-color-extra-light);
  border-top: 1px solid var(--el-border-color-lighter);
}

.tool-card__status {
  display: inline-flex;
  gap: var(--tool-space-2);
  align-items: center;
  font-size: calc(var(--font-size-base) * 0.75);
  color: var(--el-text-color-secondary);
}

.tool-card__status.is-enabled {
  color: var(--el-color-success);
}

.tool-card__status-icon,
.tool-card__status-dot {
  display: inline-flex;
  width: calc(var(--tool-space-2) + var(--tool-space-1));
  height: calc(var(--tool-space-2) + var(--tool-space-1));
}

.tool-card__status-dot {
  background: var(--el-text-color-placeholder);
  border-radius: 50%;
}

.tool-card__hover-actions {
  position: absolute;
  right: var(--tool-space-3);
  bottom: var(--tool-space-2);
  display: inline-flex;
  gap: var(--tool-space-2);
  align-items: center;
  padding: var(--tool-space-1) var(--tool-space-2);
  pointer-events: none;
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--tool-radius);
  box-shadow: var(--el-box-shadow-light);
  opacity: 0;
  transition: opacity var(--el-transition-duration);
}

.tool-card:hover .tool-card__hover-actions,
.tool-card:focus-within .tool-card__hover-actions {
  pointer-events: auto;
  opacity: 1;
}

.tool-card__action-divider {
  width: 1px;
  height: calc(var(--tool-space-5) + var(--tool-space-1));
  background: var(--el-border-color-lighter);
}

.empty-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.pager {
  flex-shrink: 0;
  justify-content: space-between;
  padding: var(--tool-space-2) var(--tool-space-4) var(--tool-space-3);
}

.batch-operation-bar {
  flex-shrink: 0;
  min-height: 50px;
  padding: var(--tool-space-2) var(--tool-space-4);
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

.tool-form-stack {
  display: flex;
  flex-direction: column;
  gap: var(--tool-space-3);
}

.form-grid,
.schema-grid,
.debug-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--tool-space-3);
}

.detail-section {
  padding: var(--tool-space-3);
}

.tool-code-editor {
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--tool-radius);
  transition:
    border-color var(--tool-transition-fast),
    box-shadow var(--tool-transition-fast);
}

.tool-code-editor:focus-within {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-9);
}

.tool-code-editor :deep(.cm-editor) {
  font-size: calc(var(--font-size-base) * 0.8125);
  background: var(--el-bg-color);
}

.tool-code-editor :deep(.cm-scroller) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.tool-code-editor :deep(.cm-gutters) {
  background: var(--el-fill-color-extra-light);
  border-right-color: var(--el-border-color-lighter);
}

.tool-code-editor :deep(.cm-focused) {
  outline: none;
}

.syntax-status {
  display: flex;
  gap: var(--tool-space-2);
  align-items: flex-start;
  min-height: 28px;
  padding: var(--tool-space-2) 0 0;
  font-size: calc(var(--font-size-base) * 0.75);
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.syntax-status .el-tag {
  flex-shrink: 0;
  margin-top: 1px;
}

.syntax-status.is-success {
  color: var(--el-color-success);
}

.syntax-status.is-warning,
.syntax-diagnostic-list .is-warning {
  color: var(--el-color-warning);
}

.syntax-status.is-error,
.syntax-diagnostic-list .is-error {
  color: var(--el-color-danger);
}

.syntax-status.is-idle,
.syntax-status.is-checking {
  color: var(--el-text-color-secondary);
}

.syntax-diagnostic-list {
  display: grid;
  gap: var(--tool-space-1);
  padding: var(--tool-space-2) var(--tool-space-3);
  margin: var(--tool-space-2) 0 0;
  font-size: calc(var(--font-size-base) * 0.75);
  line-height: 1.55;
  list-style: none;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--tool-radius);
}

.syntax-diagnostic-list li {
  display: flex;
  gap: var(--tool-space-2);
  align-items: flex-start;
}

.syntax-diagnostic-list__location {
  flex-shrink: 0;
  min-width: 76px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--el-text-color-secondary);
}

.mcp-config-example {
  padding: var(--tool-space-2) var(--tool-space-3);
  font-size: calc(var(--font-size-base) * 0.75);
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--tool-radius);
}

.mcp-config-example summary {
  width: fit-content;
  font-weight: 600;
  color: var(--el-text-color-regular);
  cursor: pointer;
}

.mcp-config-example pre {
  padding-top: var(--tool-space-2);
  margin: var(--tool-space-2) 0 0;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  line-height: 1.5;
  white-space: pre-wrap;
  border-top: 1px solid var(--el-border-color-lighter);
}

.output-hint,
.skill-file-card {
  padding: var(--tool-space-3);
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--tool-radius);
}

.skill-file-card {
  display: flex;
  gap: var(--tool-space-3);
  align-items: center;
  justify-content: space-between;
}

.skill-file-card strong {
  display: block;
  color: var(--el-text-color-primary);
}

.skill-file-card p {
  margin: var(--tool-space-1) 0 0;
  font-size: calc(var(--font-size-base) * 0.75);
  color: var(--el-text-color-secondary);
}

.skill-upload {
  display: block;
  width: 100%;
}

.skill-upload :deep(.el-upload) {
  display: block;
  width: 100%;
}

.skill-upload :deep(.el-upload-dragger) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 156px;
  padding: var(--tool-space-5);
  background: linear-gradient(
    180deg,
    var(--el-fill-color-extra-light),
    hsl(var(--card))
  );
  border: 1px dashed var(--el-color-primary-light-5);
  border-radius: calc(var(--tool-radius) + 2px);
  transition:
    background var(--tool-transition-fast),
    border-color var(--tool-transition-fast),
    box-shadow var(--tool-transition-fast);
}

.skill-upload :deep(.el-upload-dragger:hover) {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
  box-shadow: inset 0 0 0 1px var(--el-color-primary-light-8);
}

.skill-upload__icon {
  width: calc(var(--font-size-base) * 2.75);
  height: calc(var(--font-size-base) * 2.75);
  padding: var(--tool-space-2);
  margin-bottom: var(--tool-space-2);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: calc(var(--tool-radius) + 4px);
}

.skill-upload__text {
  font-size: calc(var(--font-size-base) * 0.9375);
  font-weight: 600;
  line-height: 1.5;
  color: var(--el-text-color-primary);
  text-align: center;
}

.skill-upload__tip {
  max-width: 560px;
  margin: var(--tool-space-2) auto 0;
  line-height: 1.6;
  text-align: center;
}

.skill-file-id-input :deep(.el-input__wrapper) {
  background: var(--el-fill-color-extra-light);
}

.inline-action .el-input,
.store-header .el-input {
  flex: 1;
}

.result-box {
  min-height: 160px;
  padding: var(--tool-space-3);
  margin: 0;
  overflow: auto;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--tool-radius);
}

.debug-result {
  height: var(--debug-panel-height);
}

.init-param-tabs {
  margin-top: var(--tool-space-2);
}

.init-param-raw-hint {
  margin-bottom: var(--tool-space-2);
  font-size: calc(var(--font-size-base) * 0.75);
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.debug-grid {
  --debug-space-xs: var(--tool-space-1);
  --debug-space-sm: var(--tool-space-2);
  --debug-panel-height: min(52vh, 420px);

  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
}

.debug-tabs :deep(.el-tabs__content) {
  min-height: var(--debug-panel-height);
}

.debug-form {
  max-height: var(--debug-panel-height);
  padding-right: var(--debug-space-xs);
  overflow: auto;
}

.debug-init-panel {
  padding-bottom: var(--debug-space-sm);
  margin-bottom: var(--debug-space-sm);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.debug-control {
  width: 100%;
}

.debug-field-desc,
.debug-raw-hint {
  margin-top: var(--debug-space-xs);
  font-size: calc(var(--font-size-base) * 0.75);
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.debug-raw-hint {
  margin-bottom: var(--debug-space-sm);
}

.debug-empty {
  height: var(--debug-panel-height);
}

.mono-line {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: nowrap;
}

.store-header {
  margin-bottom: var(--tool-space-3);
}

.store-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--tool-space-3);
  max-height: 560px;
  overflow: auto;
}

.store-card {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--tool-space-3);
  align-items: center;
  padding: var(--tool-space-3);
}

.store-card strong {
  display: block;
  color: var(--el-text-color-primary);
}

.store-card p {
  margin: var(--tool-space-1) 0 0;
}

.drawer-pager {
  margin-top: var(--tool-space-3);
}

.mt12 {
  margin-top: var(--tool-space-3);
}

:global(.tool-create-dropdown) {
  min-width: 196px;
  padding: var(--tool-space-2, 8px) 0;
  background: #fff;
}

:global(.tool-create-dropdown .el-dropdown-menu__item) {
  min-height: 48px;
  padding: var(--tool-space-2, 8px) var(--tool-space-4, 16px);
  line-height: 1;
}

:global(.tool-create-dropdown .el-dropdown-menu__item.is-divided) {
  margin-top: var(--tool-space-2, 8px);
  border-top-color: var(--el-border-color-lighter);
}

:global(.tool-create-dropdown .el-dropdown-menu__item.is-divided::before) {
  height: var(--tool-space-2, 8px);
  margin: 0 calc(var(--tool-space-4, 16px) * -1);
}

:global(.create-menu-upload) {
  display: block;
}

:global(.create-menu-upload .el-upload) {
  display: block;
  width: 100%;
  text-align: left;
}

.create-menu-item {
  --tool-space-1: 4px;
  --tool-space-2: 8px;
  --tool-space-3: 12px;
  --tool-space-4: 16px;
  --tool-space-5: 20px;
  --tool-radius: 6px;

  display: flex;
  gap: var(--tool-space-2);
  align-items: center;
  width: 100%;
}

.create-menu-icon {
  display: inline-flex;
  flex: 0 0 32px;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  overflow: hidden;
  font-size: calc(var(--font-size-base) * 1.125);
  border-radius: calc(var(--tool-radius) + 2px);
}

.create-menu-icon :deep(svg) {
  width: calc(var(--font-size-base) * 1.125);
  height: calc(var(--font-size-base) * 1.125);
}

.create-menu-icon.is-create-green {
  color: #fff;
  background: #37c77f;
}

.create-menu-icon.is-create-blue {
  color: #fff;
  background: #3375ff;
}

.create-menu-icon.is-create-purple {
  color: #fff;
  background: #7c5cff;
}

.create-menu-icon.is-create-folder {
  color: #e6a23c;
  background: #fff4d6;
}

.create-menu-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: calc(var(--font-size-base) * 0.875);
  font-weight: 500;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

@media (max-width: 960px) {
  .tool-management-shell {
    grid-template-columns: 1fr;
  }

  .tool-folder-pane {
    max-height: 280px;
    border-right: 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .tool-list-header,
  .tool-list-actions,
  .batch-operation-bar {
    flex-wrap: wrap;
  }

  .complex-search,
  .complex-search__input {
    width: 100%;
  }

  .batch-operation-bar__names {
    display: none;
  }
}
</style>
