<script setup lang="ts">
import type { FormInstance, FormRules, InputInstance } from 'element-plus';

import { computed, nextTick, ref, watch } from 'vue';

import { Delete, EditPen, Plus } from '@element-plus/icons-vue';
import {
  ElButton,
  ElCascader,
  ElCheckbox,
  ElDatePicker,
  ElDialog,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTag,
  ElTree,
  ElTreeSelect,
} from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

import { listKnowledge } from '#/api/ai/knowledge';
import { listActiveModels } from '#/api/ai/models';

type FieldOption = Record<string, any> & {
  label: string;
  value: string;
};

type ApiRecord = Record<string, unknown>;

type SelectRecordOption = {
  label: string;
  record: ApiRecord;
  value: string;
};

type TreeOptionNode = {
  children?: TreeOptionNode[];
  id: string;
  label: string;
  value: string;
};

type FieldCascaderOption = Record<string, any> & {
  children?: FieldCascaderOption[];
  fieldConfig?: Record<string, any>;
  label: string;
  value: string;
};

type FieldFormState = Record<string, any> & {
  assignment_method: string;
  attrs: Record<string, unknown>;
  default_value: any;
  default_value_assignment_method: string;
  field: string;
  input_type: string;
  label: string;
  option_list: FieldOption[] | string[];
  required: boolean;
  tooltip: string;
  value_field: string;
  visibility_rules: Record<string, unknown>;
};

const props = defineProps<{
  currentNodeFields?: Array<Record<string, any>>;
  nodeModel?: Record<string, any>;
}>();
const emit = defineEmits<{
  refresh: [field: Record<string, any>, index: null | number];
}>();

const inputTypeList = [
  { label: '文本', value: 'TextInput' },
  { label: '多行文本', value: 'TextareaInput' },
  { label: 'JSON', value: 'JsonInput' },
  { label: '密码', value: 'PasswordInput' },
  { label: '单选下拉', value: 'SingleSelect' },
  { label: '多选下拉', value: 'MultiSelect' },
  { label: '单选卡片', value: 'RadioCard' },
  { label: '单选行', value: 'RadioRow' },
  { label: '多行输入', value: 'MultiRow' },
  { label: '滑块', value: 'Slider' },
  { label: '开关', value: 'SwitchInput' },
  { label: '日期', value: 'DatePicker' },
  { label: '上传', value: 'UploadInput' },
  { label: '模型', value: 'Model' },
  { label: '知识库', value: 'Knowledge' },
  { label: '树选择', value: 'TreeSelect' },
];
const optionInputTypes = new Set([
  'MultiRow',
  'MultiSelect',
  'RadioCard',
  'RadioRow',
  'SingleSelect',
]);
const lengthInputTypes = new Set([
  'MultiRow',
  'PasswordInput',
  'TextareaInput',
  'TextInput',
]);
const dateFormatDefaults = {
  date: 'YYYY-MM-DD',
  datetime: 'YYYY-MM-DD HH:mm:ss',
  month: 'YYYY-MM',
  year: 'YYYY',
};
type DateInputType = keyof typeof dateFormatDefaults;
const dateTypeOptions: Array<{ label: string; value: DateInputType }> = [
  { label: '年', value: 'year' },
  { label: '月', value: 'month' },
  { label: '日期', value: 'date' },
  { label: '日期时间', value: 'datetime' },
];
const dialogVisible = ref(false);
const fieldFormRef = ref<FormInstance>();
const currentIndex = ref<null | number>(null);
const isEdit = ref(false);
const optionInputVisible = ref(false);
const optionForm = ref<FieldOption>({ label: '', value: '' });
const form = ref<FieldFormState>(defaultForm());
const defaultValueText = ref('');
const originalLabel = ref<any>();
const acceptInputVisible = ref(false);
const acceptInputValue = ref('');
const acceptInputRef = ref<InputInstance>();
const modelLoading = ref(false);
const modelRecords = ref<ApiRecord[]>([]);
const knowledgeLoading = ref(false);
const knowledgeRecords = ref<ApiRecord[]>([]);
const treeOptionMode = ref<'child' | 'edit' | 'root' | undefined>();
const treeOptionParentId = ref('');
const treeOptionTargetId = ref('');
const treeOptionForm = ref({ label: '', value: '' });

const showOptions = computed(() => optionInputTypes.has(form.value.input_type));
const showLengthAttrs = computed(() =>
  lengthInputTypes.has(form.value.input_type),
);
const showCustomOptions = computed(
  () => showOptions.value && form.value.assignment_method === 'custom',
);
const showOptionReference = computed(
  () => showOptions.value && form.value.assignment_method === 'ref_variables',
);
const showJsonAssignment = computed(
  () => form.value.input_type === 'JsonInput',
);
const showJsonCustomDefault = computed(
  () =>
    form.value.input_type === 'JsonInput' &&
    form.value.default_value_assignment_method === 'custom',
);
const showJsonRefDefault = computed(
  () =>
    form.value.input_type === 'JsonInput' &&
    form.value.default_value_assignment_method === 'ref_variables',
);
const showJsonDefault = computed(() => showJsonCustomDefault.value);
const showSliderAttrs = computed(() => form.value.input_type === 'Slider');
const showDateAttrs = computed(() => form.value.input_type === 'DatePicker');
const showUploadAttrs = computed(() => form.value.input_type === 'UploadInput');
const showModelAttrs = computed(() => form.value.input_type === 'Model');
const showKnowledgeAttrs = computed(
  () => form.value.input_type === 'Knowledge',
);
const showTreeSelectAttrs = computed(
  () => form.value.input_type === 'TreeSelect',
);
const showDefaultValue = computed(() => {
  if (
    showUploadAttrs.value ||
    showModelAttrs.value ||
    showKnowledgeAttrs.value ||
    showJsonRefDefault.value
  )
    return false;
  if (showOptions.value) return form.value.assignment_method === 'custom';
  return true;
});
const showDefaultValueToggle = computed(() => {
  if (showJsonCustomDefault.value || showTreeSelectAttrs.value) return true;
  if (showOptions.value) return form.value.assignment_method === 'custom';
  return ['DatePicker', 'PasswordInput', 'TextareaInput', 'TextInput'].includes(
    form.value.input_type,
  );
});
const currentEditingIndex = computed(
  () => currentIndex.value ?? (props.currentNodeFields || []).length,
);
const fieldCascaderOptions = computed(() => {
  const options: FieldCascaderOption[] = [];
  const currentChildren = currentSiblingFields().map((field) =>
    fieldToCascaderOption(field),
  );
  if (currentChildren.length > 0) {
    options.push({
      children: currentChildren,
      label: currentNodeLabel(),
      value: currentNodeId(),
    });
  }
  options.push(...upstreamFieldOptions());
  return options;
});
const customOptions = computed(() => normalizeOptions(form.value.option_list));
const optionReferenceValue = computed({
  get: () =>
    Array.isArray(form.value.option_list) &&
    form.value.option_list.every((item) => typeof item === 'string')
      ? form.value.option_list
      : [],
  set: (value: string[]) => {
    form.value.option_list = value;
    form.value.default_value = '';
  },
});
const jsonDefaultReference = computed({
  get: () =>
    Array.isArray(form.value.default_value) ? form.value.default_value : [],
  set: (value: string[]) => {
    form.value.default_value = value;
  },
});
const showDefaultValueFlag = computed({
  get: () => form.value.show_default_value !== false,
  set: (value: boolean) => {
    form.value.show_default_value = value;
  },
});
const modelSelectedIds = computed({
  get: () =>
    modelProviderList()
      .map((item) => `${item.model_id || ''}`)
      .filter(Boolean),
  set: (value: string[]) => {
    const oldList = modelProviderList();
    const nextList = value.map((id) => {
      const oldItem = oldList.find((item) => `${item.model_id}` === `${id}`);
      return oldItem || providerItemFromModelId(id);
    });
    writeAttr('provider_list', nextList);
    const currentId = modelDefaultModelId.value;
    if (currentId && !value.includes(currentId)) modelDefaultModelId.value = '';
  },
});
const modelDefaultModelId = computed({
  get: () => {
    const value = form.value.default_value;
    if (value && typeof value === 'object' && !Array.isArray(value))
      return `${value.model_id || ''}`;
    return `${value || ''}`;
  },
  set: (value: string) => {
    const provider = modelProviderList().find(
      (item) => `${item.model_id}` === `${value}`,
    );
    form.value.default_value = value
      ? {
          model_id: value,
          model_params_setting: provider?.model_params_setting || {},
        }
      : {};
  },
});
const knowledgeSelectedIds = computed({
  get: () =>
    knowledgeList()
      .map((item) => `${item.id || ''}`)
      .filter(Boolean),
  set: (value: string[]) => {
    const currentList = knowledgeList();
    const nextList = value.map((id) => {
      const current = currentList.find((item) => `${item.id}` === `${id}`);
      return (
        current ||
        knowledgeItemFromRecord(
          knowledgeRecords.value.find(
            (record) => knowledgeId(record) === id,
          ) || { id },
        )
      );
    });
    writeAttr('knowledge_list', nextList);
    form.value.default_value = knowledgeDefaultIds.value.filter((id) =>
      value.includes(id),
    );
  },
});
const knowledgeDefaultIds = computed({
  get: () =>
    Array.isArray(form.value.default_value)
      ? form.value.default_value.map((item) => `${item}`)
      : splitCsv(`${form.value.default_value || ''}`),
  set: (value: string[]) => {
    form.value.default_value = cloneDeep(value);
  },
});
const uploadAcceptTags = computed(() =>
  acceptTags(readStringAttr('accept', '.jpg')),
);
const treeDefaultValue = computed({
  get: () => {
    if (treeMultiple.value)
      return Array.isArray(form.value.default_value)
        ? form.value.default_value
        : splitCsv(`${form.value.default_value || ''}`);
    return Array.isArray(form.value.default_value)
      ? `${form.value.default_value[0] || ''}`
      : `${form.value.default_value || ''}`;
  },
  set: (value: string | string[]) => {
    form.value.default_value = cloneDeep(value);
  },
});
const treeData = computed({
  get: () =>
    Array.isArray(form.value.attrs.data)
      ? (form.value.attrs.data as TreeOptionNode[])
      : [],
  set: (value: TreeOptionNode[]) => writeAttr('data', value),
});
const treeSelectOptions = computed(() => flattenOptionTree(treeData.value));
const modelOptions = computed(() =>
  modelRecords.value
    .map((record) => modelOption(record))
    .filter((item) => item.value),
);
const selectedModelOptions = computed(() =>
  modelOptions.value.filter((item) =>
    modelSelectedIds.value.includes(item.value),
  ),
);
const knowledgeOptions = computed(() =>
  knowledgeRecords.value
    .map((record) => knowledgeOption(record))
    .filter((item) => item.value),
);

const rules: FormRules = {
  field: [
    { message: '请输入字段', required: true, trigger: 'blur' },
    {
      message: '仅支持字母、数字、下划线',
      pattern: /^\w+$/,
      trigger: 'blur',
    },
    { trigger: 'blur', validator: validateUniqueField },
  ],
  label: [{ message: '请输入名称', required: true, trigger: 'blur' }],
};

function defaultForm(): FieldFormState {
  return {
    assignment_method: 'custom',
    attrs: {},
    default_value: '',
    default_value_assignment_method: 'custom',
    field: '',
    input_type: 'TextInput',
    label: '',
    option_list: [],
    required: false,
    tooltip: '',
    value_field: '',
    visibility_rules: defaultVisibilityRules(),
  };
}

function defaultVisibilityRules(): Record<string, unknown> {
  return { action: 'show', condition: 'and', conditions: [] };
}

function normalizeAttrs(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? cloneDeep(value as Record<string, unknown>)
    : {};
}

function readNumberAttr(key: string, fallback: number) {
  const value = form.value.attrs[key];
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function readStringAttr(key: string, fallback = '') {
  const value = form.value.attrs[key];
  return typeof value === 'string' ? value : fallback;
}

function readBooleanAttr(key: string, fallback = false) {
  const value = form.value.attrs[key];
  return typeof value === 'boolean' ? value : fallback;
}

function isApiRecord(value: unknown): value is ApiRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordsOf(value: unknown): ApiRecord[] {
  if (Array.isArray(value))
    return value
      .filter((item) => isApiRecord(item))
      .map((item) => cloneDeep(item));
  if (!isApiRecord(value)) return [];
  const data = value.data;
  if (data !== undefined && data !== value) {
    const dataRecords = recordsOf(data);
    if (dataRecords.length > 0) return dataRecords;
  }
  for (const key of ['records', 'items', 'list', 'rows']) {
    const result = recordsOf(value[key]);
    if (result.length > 0) return result;
  }
  return [];
}

function stringValue(value: unknown) {
  return typeof value === 'number' || typeof value === 'string'
    ? `${value}`
    : '';
}

function firstString(record: ApiRecord, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = stringValue(record[key]);
    if (value) return value;
  }
  return fallback;
}

function modelId(record: ApiRecord) {
  return firstString(record, ['id', 'modelId', 'model_id', 'value']);
}

function modelName(record: ApiRecord) {
  return firstString(
    record,
    ['name', 'modelName', 'model_name', 'label'],
    modelId(record),
  );
}

function modelProvider(record: ApiRecord) {
  return firstString(
    record,
    ['provider', 'providerName', 'provider_name'],
    '默认',
  );
}

function modelOption(record: ApiRecord): SelectRecordOption {
  const provider = modelProvider(record);
  const name = modelName(record);
  return {
    label: provider ? `${provider} / ${name}` : name,
    record,
    value: modelId(record),
  };
}

function modelProviderList(): Array<Record<string, any>> {
  const list = form.value.attrs.provider_list;
  return Array.isArray(list)
    ? cloneDeep(list).filter((item) => item && typeof item === 'object')
    : [];
}

function providerItemFromModelId(id: string) {
  const record =
    modelRecords.value.find((item) => modelId(item) === `${id}`) || {};
  return {
    model_id: id,
    model_name: modelName(record),
    provider: modelProvider(record),
    model_params_setting: {},
    model_form_field: [],
  };
}

function mergeModelRecords(records: ApiRecord[]) {
  const map = new Map<string, ApiRecord>();
  for (const provider of modelProviderList()) {
    const model_id = `${provider.model_id || ''}`;
    if (!model_id) continue;
    map.set(model_id, {
      id: model_id,
      name: provider.model_name,
      provider: provider.provider,
    });
  }
  for (const record of records) {
    const id = modelId(record);
    if (id) map.set(id, cloneDeep(record));
  }
  modelRecords.value = [...map.values()];
}

function apiModelType(value: string) {
  return value === 'LLM' ? 'LLM' : value;
}

async function loadModelsByType(type = modelType.value) {
  if (!showModelAttrs.value) return;
  modelLoading.value = true;
  try {
    mergeModelRecords(
      recordsOf(await listActiveModels(apiModelType(type || 'LLM'))),
    );
  } catch {
    mergeModelRecords([]);
    ElMessage.error('模型列表加载失败');
  } finally {
    modelLoading.value = false;
  }
}

function knowledgeId(record: ApiRecord) {
  return firstString(record, ['id', 'knowledgeId', 'knowledge_id', 'value']);
}

function knowledgeName(record: ApiRecord) {
  return firstString(
    record,
    ['name', 'knowledgeName', 'knowledge_name', 'title', 'label'],
    knowledgeId(record),
  );
}

function knowledgeType(record: ApiRecord) {
  return firstString(
    record,
    ['type', 'knowledgeType', 'knowledge_type'],
    '知识库',
  );
}

function embeddingModelId(record: ApiRecord) {
  const embeddingModel = record.embeddingModel;
  if (isApiRecord(embeddingModel))
    return firstString(embeddingModel, ['id', 'model_id']);
  return firstString(record, ['embedding_model_id', 'embeddingModelId']);
}

function knowledgeItemFromRecord(record: ApiRecord) {
  return {
    id: knowledgeId(record),
    name: knowledgeName(record),
    type: knowledgeType(record),
    embedding_model_id: embeddingModelId(record),
  };
}

function knowledgeList(): Array<Record<string, any>> {
  const list = form.value.attrs.knowledge_list;
  return Array.isArray(list)
    ? cloneDeep(list).filter((item) => item && typeof item === 'object')
    : [];
}

function knowledgeOption(record: ApiRecord): SelectRecordOption {
  return {
    label: `${knowledgeName(record)} (${knowledgeType(record)})`,
    record,
    value: knowledgeId(record),
  };
}

function mergeKnowledgeRecords(records: ApiRecord[]) {
  const map = new Map<string, ApiRecord>();
  for (const item of knowledgeList()) {
    const id = `${item.id || ''}`;
    if (id) map.set(id, cloneDeep(item));
  }
  for (const record of records) {
    const id = knowledgeId(record);
    if (id) map.set(id, cloneDeep(record));
  }
  knowledgeRecords.value = [...map.values()];
}

async function loadKnowledgeRecords() {
  if (!showKnowledgeAttrs.value) return;
  knowledgeLoading.value = true;
  try {
    mergeKnowledgeRecords(recordsOf(await listKnowledge()));
  } catch {
    mergeKnowledgeRecords([]);
    ElMessage.error('知识库列表加载失败');
  } finally {
    knowledgeLoading.value = false;
  }
}

function normalizeDateType(value: string): DateInputType {
  return value in dateFormatDefaults ? (value as DateInputType) : 'datetime';
}

function writeAttr(key: string, value: unknown) {
  const attrs = cloneDeep(form.value.attrs || {});
  set(attrs, key, value);
  form.value.attrs = attrs;
}

const textMinLength = computed({
  get: () => readNumberAttr('minlength', 0),
  set: (value: number | undefined) => writeAttr('minlength', value ?? 0),
});
const textMaxLength = computed({
  get: () => readNumberAttr('maxlength', 200),
  set: (value: number | undefined) => writeAttr('maxlength', value ?? 200),
});
const sliderMin = computed({
  get: () => readNumberAttr('min', 0),
  set: (value: number | undefined) => writeAttr('min', value ?? 0),
});
const sliderMax = computed({
  get: () => readNumberAttr('max', 20),
  set: (value: number | undefined) => writeAttr('max', value ?? 20),
});
const sliderStep = computed({
  get: () => readNumberAttr('step', 0.1),
  set: (value: number | undefined) => writeAttr('step', value ?? 0.1),
});
const sliderShowInput = computed({
  get: () => readBooleanAttr('show-input', true),
  set: (value: boolean) => writeAttr('show-input', value),
});
const dateType = computed({
  get: () => normalizeDateType(readStringAttr('type', 'datetime')),
  set: (value: string) => writeAttr('type', value || 'datetime'),
});
const dateFormat = computed({
  get: () =>
    readStringAttr(
      'format',
      dateFormatDefaults[dateType.value] || dateFormatDefaults.datetime,
    ),
  set: (value: string) => {
    writeAttr('format', value);
    writeAttr('value-format', value);
  },
});
const uploadLimit = computed({
  get: () => readNumberAttr('limit', 3),
  set: (value: number | undefined) => writeAttr('limit', value ?? 3),
});
const uploadMaxFileSize = computed({
  get: () => Number(form.value.max_file_size ?? 10),
  set: (value: number | undefined) => {
    form.value.max_file_size = value ?? 10;
  },
});
const uploadAcceptText = computed({
  get: () => readStringAttr('accept', '.jpg'),
  set: (value: string) => writeAttr('accept', normalizeAccept(value)),
});
const modelType = computed({
  get: () => readStringAttr('model_type', `${form.value.model_type || 'LLM'}`),
  set: (value: string) => {
    writeAttr('model_type', value);
    form.value.model_type = value;
  },
});
const treeMultiple = computed({
  get: () =>
    readBooleanAttr('multiple', Array.isArray(form.value.default_value)),
  set: (value: boolean) => {
    writeAttr('multiple', value);
    normalizeTreeDefault(value);
  },
});

function labelText(row: Record<string, any>) {
  if (typeof row?.label === 'string') return row.label;
  if (row?.label?.label) return row.label.label;
  return row?.name || row?.field || '';
}

function normalizeOptions(value: any): FieldOption[] {
  return Array.isArray(value)
    ? value
        .map((item) => ({
          ...cloneDeep(item),
          label: `${item?.label || item?.key || item?.value || ''}`,
          value: `${item?.value || item?.key || item?.label || ''}`,
        }))
        .filter((item) => item.value)
    : [];
}

function flattenOptionTree(options: unknown): FieldOption[] {
  if (!Array.isArray(options)) return [];
  const result: FieldOption[] = [];
  for (const option of options) {
    const source =
      option && typeof option === 'object'
        ? (option as Record<string, unknown>)
        : {};
    const value = `${source.value || source.key || source.label || ''}`;
    if (value)
      result.push({
        ...cloneDeep(source),
        label: `${source.label || value}`,
        value,
      });
    result.push(...flattenOptionTree(source.children));
  }
  return result;
}

function normalizeVisibilityRules(value: unknown): Record<string, unknown> {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? cloneDeep(value as Record<string, unknown>)
      : {};
  return {
    ...source,
    action: source.action === 'hide' ? 'hide' : 'show',
    condition: source.condition === 'or' ? 'or' : 'and',
    conditions: Array.isArray(source.conditions) ? source.conditions : [],
  };
}

function currentNodeId() {
  return `${props.nodeModel?.id || ''}`;
}

function currentNodeLabel() {
  const text = props.nodeModel?.text;
  if (typeof text === 'string') return text;
  return `${props.nodeModel?.properties?.stepName || text?.value || '当前节点'}`;
}

function currentSiblingFields() {
  return (props.currentNodeFields || []).filter(
    (field, index) => index < currentEditingIndex.value && field?.field,
  );
}

function fieldToCascaderOption(
  field: Record<string, any>,
): FieldCascaderOption {
  const value = `${field.field || field.value || field.name || ''}`;
  return {
    ...cloneDeep(field),
    fieldConfig: cloneDeep(field),
    label: labelText(field) || value,
    value,
  };
}

function normalizeNodeOption(
  entry: Record<string, any>,
): FieldCascaderOption | undefined {
  const nodeValue = `${entry.value || entry.id || ''}`;
  if (!nodeValue || nodeValue === currentNodeId()) return undefined;
  const children = Array.isArray(entry.children)
    ? entry.children
        .map((child: Record<string, any>) => fieldToCascaderOption(child))
        .filter((child) => child.value)
    : [];
  if (children.length === 0) return undefined;
  return {
    ...cloneDeep(entry),
    children,
    label: `${entry.label || entry.name || nodeValue}`,
    value: nodeValue,
  };
}

function upstreamFieldOptions() {
  const list: FieldCascaderOption[] = [];
  const seen = new Set<string>();
  const append = (items: any) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      const option = normalizeNodeOption(item);
      if (!option || seen.has(option.value)) continue;
      seen.add(option.value);
      list.push(option);
    }
  };
  append(props.nodeModel?.get_up_node_field_list?.(true, true));
  append(props.nodeModel?.graphModel?.get_up_node_field_list?.(true, true));
  return list;
}

function stringifyJson(value: any) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function parseJsonText(value: string, fallback: any) {
  const text = value.trim();
  if (!text) return '';
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function splitCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function acceptTags(value: string) {
  return splitCsv(value)
    .map((item) => item.replace(/^\./, ''))
    .filter(Boolean);
}

function normalizeAccept(value: string) {
  return splitCsv(value)
    .map((item) => {
      const text = item.trim();
      return text.startsWith('.') ? text : `.${text}`;
    })
    .join(',');
}

function syncAcceptTags(tags: string[]) {
  uploadAcceptText.value = tags
    .map((item) => item.replace(/^\./, ''))
    .filter(Boolean)
    .join(',');
}

function addAcceptTag() {
  const value = acceptInputValue.value.trim().replace(/^\./, '');
  if (!value) {
    acceptInputVisible.value = false;
    return;
  }
  const tags = uploadAcceptTags.value;
  if (tags.includes(value)) {
    ElMessage.warning(`扩展名已存在：${value}`);
  } else {
    syncAcceptTags([...tags, value]);
  }
  acceptInputValue.value = '';
  acceptInputVisible.value = false;
}

function removeAcceptTag(value: string) {
  syncAcceptTags(uploadAcceptTags.value.filter((item) => item !== value));
}

function showAcceptInput() {
  acceptInputVisible.value = true;
  nextTick(() => acceptInputRef.value?.input?.focus());
}

function createTreeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTreeNode(value: unknown): TreeOptionNode | undefined {
  if (!isApiRecord(value)) return undefined;
  const label = firstString(
    value,
    ['label', 'name'],
    firstString(value, ['value']),
  );
  const optionValue = firstString(value, ['value', 'key'], label);
  if (!label || !optionValue) return undefined;
  const children = Array.isArray(value.children)
    ? value.children
        .map((item) => normalizeTreeNode(item))
        .filter((item): item is TreeOptionNode => !!item)
    : [];
  return {
    id: firstString(value, ['id'], createTreeId()),
    label,
    value: optionValue,
    ...(children.length > 0 ? { children } : {}),
  };
}

function normalizeTreeData(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => normalizeTreeNode(item))
        .filter((item): item is TreeOptionNode => !!item)
    : [];
}

function findTreeNode(
  list: TreeOptionNode[],
  id: string,
): TreeOptionNode | undefined {
  for (const item of list) {
    if (item.id === id) return item;
    const child = findTreeNode(item.children || [], id);
    if (child) return child;
  }
  return undefined;
}

function removeTreeNode(
  list: TreeOptionNode[],
  id: string,
): { nextList: TreeOptionNode[]; removedValue?: string } {
  let removedValue: string | undefined;
  const nextList = list
    .map((item) => {
      if (item.id === id) {
        removedValue = item.value;
        return undefined;
      }
      const result = removeTreeNode(item.children || [], id);
      if (result.removedValue) removedValue = result.removedValue;
      const nextItem = { ...item };
      if (result.nextList.length > 0) nextItem.children = result.nextList;
      else delete nextItem.children;
      return nextItem;
    })
    .filter((item): item is TreeOptionNode => !!item);
  return { nextList, removedValue };
}

function cleanupTreeDefault(removedValue?: string) {
  const validValues = new Set(
    treeSelectOptions.value.map((item) => item.value),
  );
  if (removedValue) validValues.delete(removedValue);
  if (Array.isArray(form.value.default_value)) {
    form.value.default_value = form.value.default_value.filter((item) =>
      validValues.has(`${item}`),
    );
  } else if (
    form.value.default_value &&
    !validValues.has(`${form.value.default_value}`)
  ) {
    form.value.default_value = '';
  }
}

function openTreeOptionDialog(
  mode: 'child' | 'edit' | 'root',
  node?: TreeOptionNode,
) {
  treeOptionMode.value = mode;
  treeOptionParentId.value = mode === 'child' && node ? node.id : '';
  treeOptionTargetId.value = mode === 'edit' && node ? node.id : '';
  treeOptionForm.value =
    mode === 'edit' && node
      ? { label: node.label, value: node.value }
      : { label: '', value: '' };
}

function cancelTreeOption() {
  treeOptionMode.value = undefined;
  treeOptionParentId.value = '';
  treeOptionTargetId.value = '';
  treeOptionForm.value = { label: '', value: '' };
}

function submitTreeOption() {
  const label = treeOptionForm.value.label.trim();
  const value = treeOptionForm.value.value.trim();
  if (!label || !value) {
    ElMessage.warning('请输入选项名称和值');
    return;
  }
  const data = cloneDeep(treeData.value);
  if (treeOptionMode.value === 'edit') {
    const target = findTreeNode(data, treeOptionTargetId.value);
    if (!target) return;
    const oldValue = target.value;
    target.label = label;
    target.value = value;
    treeData.value = data;
    if (oldValue !== value) cleanupTreeDefault(oldValue);
  } else {
    const nextNode: TreeOptionNode = { id: createTreeId(), label, value };
    if (treeOptionMode.value === 'child') {
      const parent = findTreeNode(data, treeOptionParentId.value);
      if (!parent) return;
      parent.children = [...(parent.children || []), nextNode];
    } else {
      data.push(nextNode);
    }
    treeData.value = data;
  }
  cancelTreeOption();
}

function deleteTreeOption(node: TreeOptionNode) {
  const result = removeTreeNode(cloneDeep(treeData.value), node.id);
  treeData.value = result.nextList;
  cleanupTreeDefault(result.removedValue);
}

function defaultValueForType(inputType: string) {
  if (['Knowledge', 'UploadInput'].includes(inputType)) return [];
  if (inputType === 'JsonInput') return {};
  if (inputType === 'Slider') return 1;
  if (inputType === 'SwitchInput') return false;
  if (inputType === 'Model') return {};
  return '';
}

function ensureShowDefaultValue(inputType: string) {
  if (['Slider', 'SwitchInput'].includes(inputType)) {
    form.value.show_default_value = true;
    return;
  }
  if (
    ([
      'DatePicker',
      'JsonInput',
      'PasswordInput',
      'TextareaInput',
      'TextInput',
      'TreeSelect',
    ].includes(inputType) ||
      optionInputTypes.has(inputType)) &&
    form.value.show_default_value === undefined
  )
    form.value.show_default_value = true;
}

function normalizeTextAttrs(inputType: string) {
  if (!lengthInputTypes.has(inputType)) return;
  if (form.value.attrs.minlength === undefined) writeAttr('minlength', 0);
  if (form.value.attrs.maxlength === undefined) writeAttr('maxlength', 200);
  if (textMinLength.value > textMaxLength.value)
    textMaxLength.value = textMinLength.value;
  writeAttr('show-word-limit', true);
  if (inputType === 'TextareaInput') writeAttr('rows', 3);
  if (inputType === 'PasswordInput') {
    writeAttr('type', 'password');
    writeAttr('show-password', true);
  }
}

function normalizeSliderAttrs() {
  if (form.value.attrs.min === undefined) writeAttr('min', 0);
  if (form.value.attrs.max === undefined) writeAttr('max', 20);
  if (form.value.attrs.step === undefined) writeAttr('step', 0.1);
  if (form.value.attrs['show-input'] === undefined)
    writeAttr('show-input', true);
  if (sliderMin.value > sliderMax.value) sliderMax.value = sliderMin.value;
  if (typeof form.value.default_value !== 'number')
    form.value.default_value = sliderMin.value;
}

function normalizeDateAttrs() {
  const type = dateFormatDefaults[dateType.value] ? dateType.value : 'datetime';
  writeAttr('type', type);
  if (!dateFormat.value) dateFormat.value = dateFormatDefaults[type];
  writeAttr('value-format', dateFormat.value);
}

function normalizeUploadAttrs() {
  if (form.value.attrs.limit === undefined) writeAttr('limit', 3);
  if (form.value.max_file_size === undefined) form.value.max_file_size = 10;
  if (!readStringAttr('accept')) writeAttr('accept', '.jpg');
  form.value.default_value = [];
}

function normalizeModelAttrs() {
  if (!modelType.value) modelType.value = 'LLM';
  const providers = modelProviderList()
    .map((item) => ({
      model_id: `${item.model_id || ''}`,
      model_name: `${item.model_name || ''}`,
      provider: `${item.provider || ''}`,
      model_params_setting: item.model_params_setting || {},
      model_form_field: Array.isArray(item.model_form_field)
        ? item.model_form_field
        : [],
    }))
    .filter((item) => item.model_id);
  writeAttr('provider_list', providers);
  const currentDefault = modelDefaultModelId.value;
  if (
    currentDefault &&
    !providers.some((item) => item.model_id === currentDefault)
  )
    modelDefaultModelId.value = '';
  loadModelsByType();
}

function normalizeKnowledgeAttrs() {
  const items = knowledgeList()
    .map((item) => knowledgeItemFromRecord(item))
    .filter((item) => item.id);
  writeAttr('knowledge_list', items);
  form.value.default_value = knowledgeDefaultIds.value.filter((id) =>
    items.some((item) => `${item.id}` === `${id}`),
  );
  loadKnowledgeRecords();
}

function normalizeTreeDefault(multiple = treeMultiple.value) {
  if (multiple && !Array.isArray(form.value.default_value))
    form.value.default_value = splitCsv(`${form.value.default_value || ''}`);
  if (!multiple && Array.isArray(form.value.default_value))
    form.value.default_value = form.value.default_value[0] || '';
}

function normalizeTreeAttrs() {
  treeData.value = normalizeTreeData(form.value.attrs.data);
  writeAttr('filterable', true);
  normalizeTreeDefault();
}

function normalizeTypeDefaults(resetDefault: boolean) {
  form.value.attrs = normalizeAttrs(form.value.attrs);
  const inputType = form.value.input_type;
  if (resetDefault) form.value.default_value = defaultValueForType(inputType);
  if (showOptions.value) {
    form.value.assignment_method =
      form.value.assignment_method === 'ref_variables'
        ? 'ref_variables'
        : 'custom';
    if (form.value.assignment_method === 'custom')
      form.value.option_list = normalizeOptions(form.value.option_list);
  }
  if (inputType === 'JsonInput') {
    form.value.default_value_assignment_method =
      form.value.default_value_assignment_method === 'ref_variables'
        ? 'ref_variables'
        : 'custom';
    defaultValueText.value = stringifyJson(form.value.default_value);
  }
  ensureShowDefaultValue(inputType);
  normalizeTextAttrs(inputType);
  if (inputType === 'Slider') normalizeSliderAttrs();
  if (inputType === 'DatePicker') normalizeDateAttrs();
  if (inputType === 'UploadInput') normalizeUploadAttrs();
  if (inputType === 'Model') normalizeModelAttrs();
  if (inputType === 'Knowledge') normalizeKnowledgeAttrs();
  if (inputType === 'TreeSelect') normalizeTreeAttrs();
}

function handleInputTypeChange(newType: string, oldType: string) {
  if (!dialogVisible.value || newType === oldType) return;
  if (optionInputTypes.has(oldType) || optionInputTypes.has(newType)) {
    form.value.option_list = [];
    form.value.assignment_method = 'custom';
  }
  if (newType !== 'JsonInput')
    form.value.default_value_assignment_method = 'custom';
  normalizeTypeDefaults(true);
}

function handleAssignmentMethodChange() {
  form.value.option_list = [];
  form.value.default_value = '';
}

function handleDefaultValueAssignmentMethodChange() {
  form.value.default_value =
    form.value.default_value_assignment_method === 'ref_variables' ? [] : {};
  defaultValueText.value = stringifyJson(form.value.default_value);
}

function handleDateTypeChange() {
  dateFormat.value =
    dateFormatDefaults[dateType.value] || dateFormatDefaults.datetime;
  form.value.default_value = '';
}

function normalizeField(row?: Record<string, any>): FieldFormState {
  const source = cloneDeep(row || {});
  const labelObject =
    source.label &&
    typeof source.label === 'object' &&
    !Array.isArray(source.label)
      ? source.label
      : undefined;
  const normalized = {
    ...defaultForm(),
    ...source,
    attrs: {
      ...normalizeAttrs(source.attrs),
      ...(source.model_type && !source.attrs?.model_type
        ? { model_type: source.model_type }
        : {}),
      ...(Array.isArray(source.provider_list) && !source.attrs?.provider_list
        ? { provider_list: source.provider_list }
        : {}),
      ...(Array.isArray(source.knowledge_list) && !source.attrs?.knowledge_list
        ? { knowledge_list: source.knowledge_list }
        : {}),
    },
    field: source.field || source.key || source.variable || '',
    input_type: source.input_type || source.type || 'TextInput',
    label: labelText(source),
    option_list:
      source.assignment_method === 'ref_variables' &&
      Array.isArray(source.option_list)
        ? source.option_list.map((item) => `${item || ''}`).filter(Boolean)
        : normalizeOptions(source.option_list),
    required:
      source.required === undefined ? !!source.is_required : !!source.required,
    tooltip:
      labelObject?.input_type === 'TooltipLabel'
        ? `${labelObject.attrs?.tooltip || ''}`
        : `${source.tooltip || ''}`,
    value_field: source.value_field || '',
    visibility_rules: normalizeVisibilityRules(source.visibility_rules),
  };
  return normalized;
}

function validateUniqueField(
  _rule: unknown,
  value: string,
  callback: (error?: Error) => void,
) {
  const fieldName = `${value || ''}`.trim();
  const exists = (props.currentNodeFields || []).some(
    (item, index) => item.field === fieldName && index !== currentIndex.value,
  );
  if (exists) callback(new Error(`字段已存在：${fieldName}`));
  else callback();
}

watch(dialogVisible, (visible) => {
  if (visible) return;
  form.value = defaultForm();
  currentIndex.value = null;
  isEdit.value = false;
  optionInputVisible.value = false;
  optionForm.value = { label: '', value: '' };
  defaultValueText.value = '';
  originalLabel.value = undefined;
  acceptInputVisible.value = false;
  acceptInputValue.value = '';
  modelRecords.value = [];
  knowledgeRecords.value = [];
  cancelTreeOption();
});

function open(row?: Record<string, any>, index: null | number = null) {
  form.value = normalizeField(row);
  defaultValueText.value = stringifyJson(form.value.default_value);
  originalLabel.value = cloneDeep(row?.label);
  currentIndex.value = row ? index : null;
  isEdit.value = !!row;
  normalizeTypeDefaults(false);
  dialogVisible.value = true;
}

function close() {
  dialogVisible.value = false;
}

function addOption() {
  const value = optionForm.value.value.trim();
  const label = optionForm.value.label.trim() || value;
  if (!value) return;
  const options = normalizeOptions(form.value.option_list);
  if (options.some((item) => item.value === value)) {
    ElMessage.error(`选项值已存在：${value}`);
    return;
  }
  form.value.option_list = [...options, { label, value }];
  optionForm.value = { label: '', value: '' };
  optionInputVisible.value = false;
}

function removeOption(value: string) {
  form.value.option_list = normalizeOptions(form.value.option_list).filter(
    (item) => item.value !== value,
  );
  if (Array.isArray(form.value.default_value)) {
    form.value.default_value = form.value.default_value.filter(
      (item) => item !== value,
    );
  } else if (form.value.default_value === value) {
    form.value.default_value = '';
  }
}

function buildSubmitData() {
  const data = cloneDeep(form.value);
  const output: Record<string, unknown> = data;
  data.field = data.field.trim();
  data.required = !!data.required;
  data.is_required = data.required;
  data.attrs = normalizeAttrs(data.attrs);
  const tooltip = `${data.tooltip || ''}`.trim();
  if (tooltip) {
    output.label = {
      input_type: 'TooltipLabel',
      label: data.label,
      attrs: { tooltip },
      props_info: {},
    };
  } else if (
    originalLabel.value &&
    typeof originalLabel.value === 'object' &&
    !Array.isArray(originalLabel.value) &&
    originalLabel.value.input_type !== 'TooltipLabel'
  ) {
    output.label = { ...originalLabel.value, label: data.label };
  }
  delete output.tooltip;
  if (lengthInputTypes.has(data.input_type)) {
    data.attrs.minlength = textMinLength.value;
    data.attrs.maxlength = textMaxLength.value;
    data.attrs['show-word-limit'] = true;
    if (data.input_type === 'TextareaInput') data.attrs.rows = 3;
    if (data.input_type === 'PasswordInput') {
      data.attrs.type = 'password';
      data.attrs['show-password'] = true;
    }
  }
  if (optionInputTypes.has(data.input_type)) {
    data.assignment_method =
      data.assignment_method === 'ref_variables' ? 'ref_variables' : 'custom';
    data.option_list = normalizeOptions(data.option_list);
    if (data.assignment_method === 'ref_variables') {
      data.option_list = cloneDeep(optionReferenceValue.value);
      data.default_value = '';
      delete output.show_default_value;
    } else {
      data.show_default_value = showDefaultValueFlag.value;
    }
    data.text_field = 'label';
    data.value_field = 'value';
  } else {
    delete output.assignment_method;
    delete output.option_list;
    delete output.text_field;
    delete output.value_field;
  }
  if (data.input_type === 'JsonInput') {
    data.attrs = {};
    data.default_value_assignment_method =
      data.default_value_assignment_method === 'ref_variables'
        ? 'ref_variables'
        : 'custom';
    data.default_value =
      data.default_value_assignment_method === 'ref_variables'
        ? cloneDeep(jsonDefaultReference.value)
        : parseJsonText(defaultValueText.value, defaultValueText.value);
    if (data.default_value_assignment_method === 'custom')
      data.show_default_value = showDefaultValueFlag.value;
    else delete output.show_default_value;
  } else {
    delete output.default_value_assignment_method;
  }
  if (showJsonDefault.value) {
    data.default_value = parseJsonText(
      defaultValueText.value,
      defaultValueText.value,
    );
  }
  if (data.input_type === 'Slider') {
    data.attrs.min = sliderMin.value;
    data.attrs.max = sliderMax.value;
    data.attrs.step = sliderStep.value;
    data.attrs.precision = data.attrs.precision ?? 1;
    data.attrs['show-input-controls'] = false;
    data.attrs['show-input'] = sliderShowInput.value;
    data.show_default_value = true;
    if (typeof data.default_value !== 'number')
      data.default_value = sliderMin.value;
  }
  if (data.input_type === 'DatePicker') {
    data.attrs.type = dateType.value;
    data.attrs.format = dateFormat.value;
    data.attrs['value-format'] = dateFormat.value;
    data.show_default_value = showDefaultValueFlag.value;
  }
  if (data.input_type === 'UploadInput') {
    data.attrs.accept = normalizeAccept(uploadAcceptText.value);
    data.attrs.limit = uploadLimit.value;
    data.max_file_size = uploadMaxFileSize.value;
    data.default_value = [];
  }
  if (data.input_type === 'Model') {
    data.model_type = modelType.value;
    data.default_value = cloneDeep(
      form.value.default_value && typeof form.value.default_value === 'object'
        ? form.value.default_value
        : {},
    );
    data.attrs = {
      provider_list: modelProviderList()
        .map((item) => ({
          model_id: `${item.model_id || ''}`,
          model_name: `${item.model_name || ''}`,
          provider: `${item.provider || ''}`,
          model_params_setting: item.model_params_setting || {},
          model_form_field: Array.isArray(item.model_form_field)
            ? item.model_form_field
            : [],
        }))
        .filter((item) => item.model_id),
    };
    delete output.show_default_value;
  }
  if (data.input_type === 'Knowledge') {
    const ids = new Set(knowledgeSelectedIds.value);
    data.default_value = knowledgeDefaultIds.value.filter((id) => ids.has(id));
    data.attrs = {
      knowledge_list: knowledgeList()
        .map((item) => knowledgeItemFromRecord(item))
        .filter((item) => item.id),
    };
    delete output.show_default_value;
  }
  if (data.input_type === 'TreeSelect') {
    data.attrs.multiple = treeMultiple.value;
    data.attrs.data = cloneDeep(treeData.value);
    data.attrs.filterable = true;
    data.default_value = cloneDeep(form.value.default_value);
    data.show_default_value = showDefaultValueFlag.value;
  }
  if (data.input_type === 'SwitchInput') {
    if (data.default_value === '') data.default_value = false;
    data.show_default_value = true;
  }
  if (['PasswordInput', 'TextareaInput', 'TextInput'].includes(data.input_type))
    data.show_default_value = showDefaultValueFlag.value;
  data.visibility_rules = normalizeVisibilityRules(data.visibility_rules);
  return data;
}

async function submit() {
  const formEl = fieldFormRef.value;
  if (!formEl) return;
  try {
    await formEl.validate();
    const data = buildSubmitData();
    dialogVisible.value = false;
    await nextTick();
    emit('refresh', data, currentIndex.value);
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message);
  }
}

watch(() => form.value.input_type, handleInputTypeChange);
watch(textMinLength, () => {
  if (textMinLength.value > textMaxLength.value)
    textMaxLength.value = textMinLength.value;
});
watch(sliderMin, () => {
  if (sliderMin.value > sliderMax.value) sliderMax.value = sliderMin.value;
  if (
    typeof form.value.default_value === 'number' &&
    form.value.default_value < sliderMin.value
  )
    form.value.default_value = sliderMin.value;
});
watch(modelType, () => {
  if (!dialogVisible.value || !showModelAttrs.value) return;
  writeAttr('provider_list', []);
  form.value.default_value = {};
  loadModelsByType();
});

defineExpose({ close, open });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑参数' : '添加参数'"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    append-to-body
    width="720"
  >
    <ElForm
      ref="fieldFormRef"
      :model="form"
      :rules="rules"
      label-position="top"
      @submit.prevent
    >
      <div class="form-field-dialog__grid">
        <ElFormItem label="字段" prop="field">
          <ElInput
            v-model="form.field"
            maxlength="64"
            placeholder="请输入字段"
            show-word-limit
            @blur="form.field = form.field.trim()"
          />
        </ElFormItem>
        <ElFormItem label="名称" prop="label">
          <ElInput
            v-model="form.label"
            maxlength="64"
            placeholder="请输入名称"
            show-word-limit
          />
        </ElFormItem>
      </div>
      <ElFormItem label="提示说明">
        <ElInput
          v-model="form.tooltip"
          maxlength="128"
          placeholder="请输入参数提示说明"
          show-word-limit
        />
      </ElFormItem>
      <div class="form-field-dialog__grid">
        <ElFormItem label="类型" prop="input_type">
          <ElSelect v-model="form.input_type" :teleported="false">
            <ElOption
              v-for="item in inputTypeList"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="必填">
          <ElSwitch v-model="form.required" size="small" />
        </ElFormItem>
      </div>
      <div v-if="showLengthAttrs" class="form-field-dialog__grid">
        <ElFormItem label="最小长度">
          <ElInputNumber
            v-model="textMinLength"
            :min="0"
            :step="1"
            step-strictly
            controls-position="right"
            class="form-field-dialog__control"
          />
        </ElFormItem>
        <ElFormItem label="最大长度">
          <ElInputNumber
            v-model="textMaxLength"
            :min="textMinLength"
            :step="1"
            step-strictly
            controls-position="right"
            class="form-field-dialog__control"
          />
        </ElFormItem>
      </div>
      <ElFormItem v-if="showOptions" label="赋值方式">
        <ElSelect
          v-model="form.assignment_method"
          :teleported="false"
          @change="handleAssignmentMethodChange"
        >
          <ElOption label="自定义" value="custom" />
          <ElOption label="引用变量" value="ref_variables" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem v-if="showOptionReference" label="引用变量">
        <ElCascader
          v-model="optionReferenceValue"
          :options="fieldCascaderOptions"
          :teleported="false"
          clearable
          class="form-field-dialog__control"
          placeholder="选择提供选项列表的变量"
        />
      </ElFormItem>
      <ElFormItem v-if="showJsonAssignment" label="默认值赋值方式">
        <ElSelect
          v-model="form.default_value_assignment_method"
          :teleported="false"
          @change="handleDefaultValueAssignmentMethodChange"
        >
          <ElOption label="自定义" value="custom" />
          <ElOption label="引用变量" value="ref_variables" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem v-if="showJsonRefDefault" label="引用变量">
        <ElCascader
          v-model="jsonDefaultReference"
          :options="fieldCascaderOptions"
          :teleported="false"
          clearable
          class="form-field-dialog__control"
          placeholder="选择 JSON 默认值变量"
        />
      </ElFormItem>
      <div v-if="showSliderAttrs" class="form-field-dialog__grid">
        <ElFormItem label="最小值">
          <ElInputNumber
            v-model="sliderMin"
            controls-position="right"
            class="form-field-dialog__control"
          />
        </ElFormItem>
        <ElFormItem label="最大值">
          <ElInputNumber
            v-model="sliderMax"
            :min="sliderMin"
            controls-position="right"
            class="form-field-dialog__control"
          />
        </ElFormItem>
        <ElFormItem label="步长">
          <ElInputNumber
            v-model="sliderStep"
            :min="0"
            controls-position="right"
            class="form-field-dialog__control"
          />
        </ElFormItem>
        <ElFormItem label="显示输入框">
          <ElSwitch v-model="sliderShowInput" size="small" />
        </ElFormItem>
      </div>
      <div v-if="showDateAttrs" class="form-field-dialog__grid">
        <ElFormItem label="日期类型">
          <ElSelect
            v-model="dateType"
            :teleported="false"
            @change="handleDateTypeChange"
          >
            <ElOption
              v-for="item in dateTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="格式">
          <ElInput v-model="dateFormat" placeholder="YYYY-MM-DD HH:mm:ss" />
        </ElFormItem>
      </div>
      <div v-if="showUploadAttrs" class="form-field-dialog__grid">
        <ElFormItem label="上传数量">
          <ElInputNumber
            v-model="uploadLimit"
            :min="0"
            controls-position="right"
            class="form-field-dialog__control"
          />
        </ElFormItem>
        <ElFormItem label="最大文件大小 MB">
          <ElInputNumber
            v-model="uploadMaxFileSize"
            :min="0"
            controls-position="right"
            class="form-field-dialog__control"
          />
        </ElFormItem>
      </div>
      <ElFormItem v-if="showUploadAttrs" label="允许扩展名">
        <div class="form-field-dialog__options">
          <div class="form-field-dialog__tags">
            <ElTag
              v-for="item in uploadAcceptTags"
              :key="item"
              closable
              type="info"
              @close="removeAcceptTag(item)"
            >
              .{{ item }}
            </ElTag>
          </div>
          <div v-if="acceptInputVisible" class="form-field-dialog__accept-row">
            <ElInput
              ref="acceptInputRef"
              v-model="acceptInputValue"
              placeholder="jpg"
              @blur="addAcceptTag"
              @keyup.enter="addAcceptTag"
            />
          </div>
          <ElButton v-else plain type="primary" @click="showAcceptInput">
            <ElIcon class="form-field-dialog__icon"><Plus /></ElIcon>
            添加扩展名
          </ElButton>
        </div>
      </ElFormItem>
      <div v-if="showModelAttrs" class="form-field-dialog__grid">
        <ElFormItem label="模型类型">
          <ElSelect
            v-model="modelType"
            :teleported="false"
            filterable
            default-first-option
          >
            <ElOption label="聊天模型" value='LLM' />
            <ElOption label="向量模型" value="EMBEDDING" />
            <ElOption label="重排模型" value="RERANKER" />
            <ElOption label="语音识别" value="STT" />
            <ElOption label="语音合成" value="TTS" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="可选模型">
          <ElSelect
            v-model="modelSelectedIds"
            :loading="modelLoading"
            :teleported="false"
            multiple
            filterable
            clearable
            collapse-tags
            placeholder="请选择可选模型"
          >
            <ElOption
              v-for="item in modelOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
            <template #empty>
              <span class="form-field-dialog__empty">暂无可用模型</span>
            </template>
          </ElSelect>
        </ElFormItem>
      </div>
      <ElFormItem
        v-if="showModelAttrs && selectedModelOptions.length > 0"
        label="默认模型"
      >
        <ElSelect
          v-model="modelDefaultModelId"
          :teleported="false"
          filterable
          clearable
          placeholder="请选择默认模型"
        >
          <ElOption
            v-for="item in selectedModelOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </ElSelect>
      </ElFormItem>
      <ElEmpty
        v-else-if="showModelAttrs"
        description="请先选择可选模型"
        :image-size="52"
      />
      <ElFormItem v-if="showKnowledgeAttrs" label="可选知识库">
        <ElSelect
          v-model="knowledgeSelectedIds"
          :loading="knowledgeLoading"
          :teleported="false"
          multiple
          filterable
          clearable
          collapse-tags
          placeholder="请选择可选知识库"
        >
          <ElOption
            v-for="item in knowledgeOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
          <template #empty>
            <span class="form-field-dialog__empty">暂无可用知识库</span>
          </template>
        </ElSelect>
      </ElFormItem>
      <ElFormItem
        v-if="showKnowledgeAttrs && knowledgeSelectedIds.length > 0"
        label="默认知识库"
      >
        <ElSelect
          v-model="knowledgeDefaultIds"
          :teleported="false"
          multiple
          filterable
          clearable
          collapse-tags
          placeholder="请选择默认知识库"
        >
          <ElOption
            v-for="item in knowledgeOptions.filter((option) =>
              knowledgeSelectedIds.includes(option.value),
            )"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem v-if="showTreeSelectAttrs">
        <template #label>
          <div class="form-field-dialog__section-head">
            <span>树选项</span>
            <div class="form-field-dialog__section-actions">
              <ElCheckbox v-model="treeMultiple">允许多选</ElCheckbox>
              <ElButton
                link
                type="primary"
                @click="openTreeOptionDialog('root')"
              >
                <ElIcon class="form-field-dialog__icon"><Plus /></ElIcon>
                添加根选项
              </ElButton>
            </div>
          </div>
        </template>
        <div class="form-field-dialog__tree-panel">
          <ElTree
            v-if="treeData.length > 0"
            :data="treeData"
            node-key="id"
            default-expand-all
            :expand-on-click-node="false"
          >
            <template #default="{ data }">
              <div class="form-field-dialog__tree-node">
                <span class="form-field-dialog__tree-label">
                  {{ data.label }} / {{ data.value }}
                </span>
                <span class="form-field-dialog__tree-actions">
                  <ElButton
                    link
                    type="primary"
                    @click.stop="openTreeOptionDialog('child', data)"
                  >
                    <ElIcon><Plus /></ElIcon>
                  </ElButton>
                  <ElButton
                    link
                    type="primary"
                    @click.stop="openTreeOptionDialog('edit', data)"
                  >
                    <ElIcon><EditPen /></ElIcon>
                  </ElButton>
                  <ElButton
                    link
                    type="danger"
                    @click.stop="deleteTreeOption(data)"
                  >
                    <ElIcon><Delete /></ElIcon>
                  </ElButton>
                </span>
              </div>
            </template>
          </ElTree>
          <ElEmpty v-else description="暂无树选项" :image-size="52" />
          <div v-if="treeOptionMode" class="form-field-dialog__tree-edit-row">
            <ElInput v-model="treeOptionForm.label" placeholder="名称" />
            <ElInput
              v-model="treeOptionForm.value"
              placeholder="值"
              @keyup.enter="submitTreeOption"
            />
            <ElButton type="primary" @click="submitTreeOption">确定</ElButton>
            <ElButton @click="cancelTreeOption">取消</ElButton>
          </div>
        </div>
      </ElFormItem>
      <ElFormItem v-if="showCustomOptions" label="选项">
        <div class="form-field-dialog__options">
          <div class="form-field-dialog__tags">
            <ElTag
              v-for="item in customOptions"
              :key="item.value"
              closable
              type="info"
              @close="removeOption(item.value)"
            >
              {{ item.label }} / {{ item.value }}
            </ElTag>
          </div>
          <div v-if="optionInputVisible" class="form-field-dialog__option-row">
            <ElInput v-model="optionForm.label" placeholder="名称" />
            <ElInput
              v-model="optionForm.value"
              placeholder="值"
              @keyup.enter="addOption"
            />
            <ElButton type="primary" @click="addOption">确定</ElButton>
          </div>
          <ElButton
            v-else
            plain
            type="primary"
            @click="optionInputVisible = true"
          >
            <ElIcon class="form-field-dialog__icon"><Plus /></ElIcon>
            添加选项
          </ElButton>
        </div>
      </ElFormItem>
      <ElFormItem v-if="showDefaultValue">
        <template #label>
          <div class="form-field-dialog__section-head">
            <span>默认值</span>
            <ElCheckbox
              v-if="showDefaultValueToggle"
              v-model="showDefaultValueFlag"
            >
              显示默认值
            </ElCheckbox>
          </div>
        </template>
        <ElSwitch
          v-if="form.input_type === 'SwitchInput'"
          v-model="form.default_value"
          size="small"
        />
        <ElSelect
          v-else-if="showCustomOptions"
          v-model="form.default_value"
          :multiple="
            form.input_type === 'MultiSelect' || form.input_type === 'MultiRow'
          "
          :teleported="false"
          clearable
          placeholder="请选择默认值"
        >
          <ElOption
            v-for="item in customOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </ElSelect>
        <ElInput
          v-else-if="showJsonCustomDefault"
          v-model="defaultValueText"
          type="textarea"
          :rows="4"
          placeholder="支持 JSON；无法解析时按文本保存"
        />
        <ElInputNumber
          v-else-if="showSliderAttrs"
          v-model="form.default_value"
          :min="sliderMin"
          :max="sliderMax"
          :step="sliderStep || 0.1"
          controls-position="right"
          class="form-field-dialog__control"
        />
        <ElDatePicker
          v-else-if="showDateAttrs"
          v-model="form.default_value"
          :type="dateType"
          :format="dateFormat"
          :value-format="dateFormat"
          class="form-field-dialog__control"
        />
        <ElInput
          v-else-if="form.input_type === 'TextareaInput'"
          v-model="form.default_value"
          type="textarea"
          :rows="3"
          :maxlength="textMaxLength"
          show-word-limit
          placeholder="请输入默认值"
        />
        <ElInput
          v-else-if="form.input_type === 'PasswordInput'"
          v-model="form.default_value"
          type="password"
          show-password
          :maxlength="textMaxLength"
          placeholder="请输入默认值"
        />
        <ElTreeSelect
          v-else-if="showTreeSelectAttrs"
          v-model="treeDefaultValue"
          :data="treeData"
          :multiple="treeMultiple"
          :render-after-expand="false"
          :teleported="false"
          clearable
          filterable
          class="form-field-dialog__control"
        />
        <ElInput
          v-else
          v-model="form.default_value"
          :maxlength="showLengthAttrs ? textMaxLength : undefined"
          placeholder="请输入默认值"
        />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="close">取消</ElButton>
      <ElButton type="primary" @click="submit">
        {{ isEdit ? '保存' : '添加' }}
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped lang="scss">
.form-field-dialog__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.form-field-dialog__control {
  width: 100%;
}

.form-field-dialog__options {
  display: grid;
  gap: 8px;
  width: 100%;
}

.form-field-dialog__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.form-field-dialog__option-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.form-field-dialog__tree-edit-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto auto;
  gap: 8px;
  align-items: center;
}

.form-field-dialog__accept-row {
  width: 160px;
}

.form-field-dialog__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.form-field-dialog__section-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.form-field-dialog__tree-panel {
  display: grid;
  gap: 8px;
  width: 100%;
  padding: 8px;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.form-field-dialog__tree-panel :deep(.el-tree) {
  background: transparent;
}

.form-field-dialog__tree-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-width: 0;
}

.form-field-dialog__tree-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.form-field-dialog__tree-actions {
  display: flex;
  flex-shrink: 0;
  gap: 2px;
  align-items: center;
}

.form-field-dialog__empty {
  display: block;
  padding: 8px 12px;
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-placeholder);
}

.form-field-dialog__icon {
  margin-right: 4px;
}
</style>
