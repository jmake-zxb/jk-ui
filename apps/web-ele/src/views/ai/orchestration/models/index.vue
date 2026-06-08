<script setup lang="ts">
import type {
  AiModelId,
  JsonObject,
  JsonValue,
  ModelConfigPayload,
  ModelFormField,
  ProviderConfigPayload,
} from '#/api/ai/models';

import { computed, onMounted, reactive, ref } from 'vue';

import { confirm, Page } from '@vben/common-ui';

import {
  Collection,
  EditPen,
  Plus,
  Refresh,
  Search,
  Setting,
} from '@element-plus/icons-vue';
import {
  ElButton,
  ElDialog,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElScrollbar,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
  ElTag,
} from 'element-plus';
import { cloneDeep } from 'lodash-es';

import {
  createModel,
  createProvider,
  deleteModel,
  deleteProvider,
  getDefaultModel,
  getModel,
  getModelMeta,
  getModelParamsForm,
  listActiveModels,
  listProviderBaseModels,
  listProviderCredentialFields,
  listProviderMetadata,
  listProviderModelParamsForm,
  listProviderModelTypes,
  listProviders,
  pageModels,
  pageProviders,
  updateModel,
  updateModelParamsForm,
  updateProvider,
} from '#/api/ai/models';

import {
  enabledText,
  prettyJson,
  recordsOf,
  safeParseJson,
  statusType,
} from '../utils';

type Id = number | string;
type DynamicFieldValue =
  | boolean
  | null
  | number
  | string
  | string[]
  | undefined;
type DynamicValues = Record<string, DynamicFieldValue>;

const providerCodeAliasMap: Record<string, string> = {
  aliyun_bai_lian_model_provider: 'aliyun-bai-lian',
  model_aws_bedrock_provider: 'aws-bedrock',
  model_azure_provider: 'azure',
  model_deepseek_provider: 'deepseek',
  model_docker_ai_provider: 'docker-ai',
  model_gemini_provider: 'gemini',
  model_kimi_provider: 'kimi',
  model_local_provider: 'local',
  model_minimax_provider: 'minimax',
  model_ollama_provider: 'ollama',
  model_openai_provider: 'openai',
  model_regolo_provider: 'regolo',
  model_siliconcloud_provider: 'siliconflow',
  model_tencent_cloud_provider: 'tencent-cloud',
  model_tencent_provider: 'tencent',
  model_vllm_provider: 'vllm',
  model_volcanic_engine_provider: 'volcanic-engine',
  model_wenxin_provider: 'wenxin',
  model_xf_provider: 'xunfei',
  model_xinference_provider: 'xinference',
  model_zhipu_provider: 'zhipu',
};

interface ProviderRecord extends Record<string, unknown> {
  apiBase?: string;
  apiKey?: string;
  apiUrl?: string;
  code?: string;
  description?: string;
  enabled?: boolean;
  icon?: string;
  id?: Id;
  isActive?: boolean;
  name?: string;
  provider?: string;
  providerCode?: string;
  providerName?: string;
  providerType?: string;
  sortOrder?: number;
}

interface ProviderOption extends ProviderRecord {
  configured?: boolean;
  modelCount?: number;
}

interface ModelRecord extends Record<string, unknown> {
  configJson?: string;
  createTime?: string;
  credential?: unknown;
  defaultFlag?: boolean;
  displayName?: string;
  enabled?: boolean;
  id?: Id;
  isActive?: boolean;
  isDefault?: boolean;
  modelName?: string;
  modelParamsForm?: unknown;
  modelType?: string;
  name?: string;
  providerCode?: string;
  providerId?: Id;
  providerName?: string;
  providerType?: string;
  sortOrder?: number;
  status?: string;
  updateTime?: string;
}

interface ModelTypeOption {
  label: string;
  value: string;
}

interface BaseModelOption {
  desc: string;
  label: string;
  value: string;
}

interface FieldOption {
  label: string;
  value: boolean | number | string;
}

interface ModelFormState {
  credential: DynamicValues;
  displayName: string;
  isActive: boolean;
  isDefault: boolean;
  modelName: string;
  modelParamsForm: ModelFormField[];
  modelType: string;
  providerCode: string;
  providerId?: Id;
  providerName: string;
  providerType: string;
  sortOrder: number;
  status: string;
}

interface ProviderFormState {
  apiKey: string;
  apiUrl: string;
  isActive: boolean;
  providerCode: string;
  providerName: string;
  providerType: string;
  sortOrder: number;
}

const providerLoading = ref(false);
const modelLoading = ref(false);
const dialogLoading = ref(false);
const providers = ref<ProviderRecord[]>([]);
const providerMetadata = ref<ProviderOption[]>([]);
const models = ref<ModelRecord[]>([]);
const activeModels = ref<ModelRecord[]>([]);
const defaultModel = ref<ModelRecord>();
const selectedProviderCode = ref('');
const searchKeyword = ref('');
const modelTypeFilter = ref('');

const modelDialogOpen = ref(false);
const modelDialogTab = ref('base');
const editingModelId = ref<Id>();
const credentialFields = ref<ModelFormField[]>([]);
const modelTypeOptions = ref<ModelTypeOption[]>([]);
const baseModelOptions = ref<BaseModelOption[]>([]);
const modelParamsRawText = ref('[]');
const modelForm = reactive<ModelFormState>(createEmptyModelForm());

const providerDialogOpen = ref(false);
const editingProviderId = ref<Id>();
const providerForm = reactive<ProviderFormState>(createEmptyProviderForm());

const paramsDialogOpen = ref(false);
const paramsDialogLoading = ref(false);
const paramsModel = ref<ModelRecord>();
const paramsForm = ref<ModelFormField[]>([]);
const paramsRawText = ref('[]');

const metaDialogOpen = ref(false);
const metaDialogLoading = ref(false);
const metaDialogTitle = ref('模型元数据');
const metaRawText = ref('{}');

const providerItems = computed<ProviderOption[]>(() => {
  const configuredByCode = new Map<string, ProviderRecord>();
  providers.value.forEach((item) => {
    const code = providerKeyOf(item);
    if (code) configuredByCode.set(code, item);
  });

  const itemsByCode = new Map<string, ProviderOption>();
  providerMetadata.value.forEach((item) => {
    const code = providerKeyOf(item);
    if (!code) return;
    const configured = configuredByCode.get(code);
    itemsByCode.set(code, {
      ...item,
      ...configured,
      configured: configured !== undefined,
      modelCount: countModelsByProvider(code),
      providerCode: code,
      providerName: providerDisplayName(configured || item),
      providerType: providerTypeOf(configured || item),
    });
  });
  configuredByCode.forEach((item, code) => {
    if (itemsByCode.has(code)) return;
    itemsByCode.set(code, {
      ...item,
      configured: true,
      modelCount: countModelsByProvider(code),
      providerCode: code,
      providerName: providerDisplayName(item),
      providerType: providerTypeOf(item),
    });
  });

  return [
    {
      configured: true,
      modelCount: models.value.length,
      providerCode: '',
      providerName: '全部供应商',
      providerType: 'ALL',
    },
    ...[...itemsByCode.values()].toSorted((left, right) =>
      providerDisplayName(left).localeCompare(providerDisplayName(right)),
    ),
  ];
});

const activeProvider = computed(() =>
  providerItems.value.find(
    (item) => providerKeyOf(item) === selectedProviderCode.value,
  ),
);
const selectedProviderConfig = computed(() =>
  providers.value.find(
    (item) => providerKeyOf(item) === selectedProviderCode.value,
  ),
);
const activeProviderName = computed(() =>
  providerDisplayName(activeProvider.value),
);
const visibleModels = computed<ModelRecord[]>(() => {
  const keyword = searchKeyword.value.trim().toLowerCase();
  const result: ModelRecord[] = [];
  for (const item of models.value) {
    if (modelMatchesFilters(item, keyword)) result.push(item);
  }
  return result;
});
const allModelTypeOptions = computed<ModelTypeOption[]>(() => {
  const options = new Map<string, string>();
  models.value.forEach((item) => {
    const type = modelTypeOf(item);
    if (type) options.set(type, modelTypeLabel(type));
  });
  providerMetadata.value.forEach((item) => {
    const values = arrayOfUnknown(item.modelTypes ?? item.model_types);
    values.forEach((value) => {
      const option = normalizeModelTypeOption(value);
      if (option) options.set(option.value, option.label);
    });
  });
  return [...options.entries()].map(([value, label]) => ({ label, value }));
});
const defaultModelName = computed(() =>
  defaultModel.value ? modelDisplayName(defaultModel.value) : '-',
);
const modelDialogTitle = computed(() =>
  editingModelId.value
    ? '编辑模型'
    : `添加${activeProviderName.value || '模型'}`,
);
const paramsDialogTitle = computed(() =>
  paramsModel.value
    ? `${modelDisplayName(paramsModel.value)} 参数表单`
    : '模型参数表单',
);
const modelParamsCountText = computed(
  () => `模型参数字段 ${modelForm.modelParamsForm.length} 项`,
);

function createEmptyModelForm(): ModelFormState {
  return {
    credential: {},
    displayName: '',
    isActive: true,
    isDefault: false,
    modelName: '',
    modelParamsForm: [],
    modelType: '',
    providerCode: '',
    providerId: undefined,
    providerName: '',
    providerType: '',
    sortOrder: 0,
    status: 'ACTIVE',
  };
}

function createEmptyProviderForm(): ProviderFormState {
  return {
    apiKey: '',
    apiUrl: '',
    isActive: true,
    providerCode: '',
    providerName: '',
    providerType: 'OPENAI',
    sortOrder: 0,
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

function idValue(value: unknown): Id | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return value;
  return undefined;
}

function numberValue(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function booleanValue(value: unknown, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return fallback;
  return `${value}` !== 'false';
}

function arrayOfUnknown(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.data)) return value.data;
  if (isRecord(value) && Array.isArray(value.records)) return value.records;
  if (isRecord(value) && Array.isArray(value.items)) return value.items;
  return [];
}

function providerCodeOf(
  row?: ProviderOption | ProviderRecord | Record<string, unknown>,
) {
  return stringValue(row?.providerCode ?? row?.code ?? row?.provider);
}

function canonicalProviderCode(value: unknown) {
  const code = stringValue(value).trim();
  if (!code) return '';
  const normalized = code.toLowerCase();
  const alias = providerCodeAliasMap[normalized];
  if (alias) return alias;
  if (normalized.startsWith('model_') && normalized.endsWith('_provider')) {
    return normalized
      .slice('model_'.length, -'_provider'.length)
      .replaceAll('_', '-');
  }
  return normalized;
}

function providerKeyOf(
  row?: ModelRecord | ProviderOption | ProviderRecord | Record<string, unknown>,
) {
  if (!row) return '';
  return canonicalProviderCode(row.code ?? row.providerCode ?? row.provider);
}

function providerDisplayName(
  row?: ProviderOption | ProviderRecord | Record<string, unknown>,
) {
  return stringValue(
    row?.providerName ??
      row?.name ??
      row?.displayName ??
      row?.providerCode ??
      row?.code,
    '未命名供应商',
  );
}

function providerTypeOf(
  row?: ProviderOption | ProviderRecord | Record<string, unknown>,
) {
  return stringValue(row?.providerType ?? row?.type, 'ONLINE');
}

function providerApiUrlOf(row?: ProviderRecord | Record<string, unknown>) {
  return stringValue(row?.apiUrl ?? row?.apiBase);
}

function modelProviderCode(row?: ModelRecord) {
  return stringValue(row?.providerCode ?? row?.provider ?? row?.provider_code);
}

function modelMatchesFilters(item: ModelRecord, keyword: string) {
  const providerMatched =
    !selectedProviderCode.value ||
    providerKeyOf(item) === selectedProviderCode.value;
  const typeMatched =
    !modelTypeFilter.value || modelTypeOf(item) === modelTypeFilter.value;
  const keywordMatched =
    !keyword ||
    [modelDisplayName(item), modelNameOf(item), providerNameOf(item)]
      .join(' ')
      .toLowerCase()
      .includes(keyword);
  return providerMatched && typeMatched && keywordMatched;
}

function providerNameOf(row?: ModelRecord) {
  return stringValue(
    row?.providerName ?? row?.provider_name ?? row?.providerCode,
    '-',
  );
}

function modelDisplayName(row?: ModelRecord) {
  return stringValue(
    row?.displayName ?? row?.name ?? row?.modelName ?? row?.id,
    '未命名模型',
  );
}

function modelNameOf(row?: ModelRecord) {
  return stringValue(row?.modelName ?? row?.model_name ?? row?.name, '-');
}

function modelTypeOf(row?: ModelRecord) {
  return stringValue(row?.modelType ?? row?.model_type, '');
}

function modelTypeLabel(type?: string) {
  const value = stringValue(type).toUpperCase();
  const labels: Record<string, string> = {
    CHAT: '聊天模型',
    EMBEDDING: '向量模型',
    IMAGE: '图像理解',
    ITV: '图生视频',
    LLM: '大语言模型',
    RERANK: '重排模型',
    RERANKER: '重排模型',
    STT: '语音识别',
    TTI: '文生图',
    TTS: '语音合成',
    TTV: '文生视频',
  };
  return labels[value] || value || '未分类';
}

function countModelsByProvider(providerCode: string) {
  let count = 0;
  for (const item of models.value) {
    if (providerKeyOf(item) === providerCode) count += 1;
  }
  return count;
}

function normalizeProviderMetadata(value: unknown): ProviderOption[] {
  const providers: ProviderOption[] = [];
  for (const item of arrayOfUnknown(value)) {
    if (!isRecord(item)) continue;
    const provider: ProviderOption = {
      ...item,
      providerCode: canonicalProviderCode(
        item.code ?? item.providerCode ?? item.provider,
      ),
      providerName: stringValue(
        item.providerName ?? item.name ?? item.displayName,
      ),
      providerType: stringValue(item.providerType ?? item.type),
    };
    if (providerCodeOf(provider)) providers.push(provider);
  }
  return providers;
}

function normalizeModelTypeOption(value: unknown): ModelTypeOption | undefined {
  if (typeof value === 'string') return { label: modelTypeLabel(value), value };
  if (!isRecord(value)) return undefined;
  const optionValue = stringValue(
    value.value ?? value.code ?? value.modelType ?? value.model_type,
  );
  if (!optionValue) return undefined;
  return {
    label: stringValue(
      value.label ?? value.text ?? value.key ?? value.name,
      modelTypeLabel(optionValue),
    ),
    value: optionValue,
  };
}

function normalizeModelTypeOptions(value: unknown): ModelTypeOption[] {
  return arrayOfUnknown(value)
    .map((item) => normalizeModelTypeOption(item))
    .filter((item): item is ModelTypeOption => item !== undefined);
}

function normalizeBaseModelOptions(value: unknown): BaseModelOption[] {
  return arrayOfUnknown(value)
    .map((item) => {
      if (typeof item === 'string')
        return { desc: '', label: item, value: item };
      if (!isRecord(item)) return undefined;
      const name = stringValue(
        item.modelName ?? item.model_name ?? item.name ?? item.value,
      );
      if (!name) return undefined;
      return {
        desc: stringValue(item.desc ?? item.description),
        label: stringValue(
          item.label ?? item.displayName ?? item.display_name,
          name,
        ),
        value: name,
      };
    })
    .filter((item): item is BaseModelOption => item !== undefined);
}

function normalizeFormFields(value: unknown): ModelFormField[] {
  const source = typeof value === 'string' ? safeParseJson(value, []) : value;
  return arrayOfUnknown(source)
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => cloneDeep(item) as ModelFormField);
}

function normalizeCredential(value: unknown): DynamicValues {
  const source = typeof value === 'string' ? safeParseJson(value, {}) : value;
  if (!isRecord(source)) return {};
  const result: DynamicValues = {};
  Object.entries(source).forEach(([key, fieldValue]) => {
    result[key] = dynamicFieldValue(fieldValue);
  });
  return result;
}

function dynamicFieldValue(value: unknown): DynamicFieldValue {
  if (
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stringValue(item));
  }
  if (value === null) return null;
  if (value === undefined) return undefined;
  return prettyJson(value, '{}');
}

function dynamicValueToJson(value: DynamicFieldValue): JsonValue {
  if (Array.isArray(value)) return value.map((item) => item);
  if (value === undefined) return null;
  return value;
}

function dynamicValuesToJson(values: DynamicValues): JsonObject {
  const result: JsonObject = {};
  Object.entries(values).forEach(([key, value]) => {
    if (!key || value === undefined || value === '') return;
    result[key] = dynamicValueToJson(value);
  });
  return result;
}

function fieldKey(field: ModelFormField) {
  return stringValue(field.field ?? field.name);
}

function fieldLabel(field: ModelFormField) {
  const label = field.label;
  if (isRecord(label)) {
    return stringValue(label.label ?? label.name ?? fieldKey(field));
  }
  return stringValue(label ?? field.name ?? field.field, fieldKey(field));
}

function fieldHelp(field: ModelFormField) {
  return stringValue(field.desc ?? field.description ?? field.tooltip);
}

function fieldRequired(field: ModelFormField) {
  return booleanValue(field.required ?? field.is_required, false);
}

function fieldInputType(field: ModelFormField) {
  return stringValue(
    field.inputType ?? field.input_type ?? field.type,
    'TextInput',
  );
}

function fieldControl(field: ModelFormField) {
  const inputType = fieldInputType(field).toLowerCase();
  if (fieldOptions(field).length > 0 || inputType.includes('select'))
    return 'select';
  if (inputType.includes('switch') || inputType.includes('boolean'))
    return 'switch';
  if (
    inputType.includes('number') ||
    inputType.includes('int') ||
    inputType.includes('float')
  )
    return 'number';
  if (inputType.includes('password')) return 'password';
  if (inputType.includes('json') || inputType.includes('textarea'))
    return 'textarea';
  return 'text';
}

function fieldDefaultValue(field: ModelFormField): DynamicFieldValue {
  return dynamicFieldValue(field.defaultValue ?? field.default_value);
}

function credentialValue(field: ModelFormField) {
  return modelForm.credential[fieldKey(field)];
}

function setCredentialValue(field: ModelFormField, value: DynamicFieldValue) {
  const key = fieldKey(field);
  if (!key) return;
  modelForm.credential[key] = value;
}

function credentialSelectValue(
  field: ModelFormField,
): boolean | number | string | undefined {
  const value = credentialValue(field);
  if (
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return value;
  }
  return undefined;
}

function credentialSwitchValue(field: ModelFormField) {
  return booleanValue(credentialValue(field), false);
}

function credentialNumberValue(field: ModelFormField): null | number {
  const value = credentialValue(field);
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function credentialTextValue(field: ModelFormField) {
  const value = credentialValue(field);
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.join(',');
  return stringValue(value);
}

function fieldOptions(field: ModelFormField): FieldOption[] {
  const raw =
    field.options ??
    field.optionList ??
    field.option_list ??
    field.option_list_json;
  const source = typeof raw === 'string' ? safeParseJson(raw, []) : raw;
  return arrayOfUnknown(source)
    .map((item) => {
      if (
        typeof item === 'string' ||
        typeof item === 'number' ||
        typeof item === 'boolean'
      ) {
        return { label: stringValue(item), value: item };
      }
      if (!isRecord(item)) return undefined;
      const value = item.value ?? item.key ?? item.name ?? item.label;
      if (!['boolean', 'number', 'string'].includes(typeof value))
        return undefined;
      return {
        label: stringValue(item.label ?? item.text ?? item.name ?? value),
        value,
      };
    })
    .filter((item): item is FieldOption => item !== undefined);
}

function modelActive(row?: ModelRecord) {
  return booleanValue(row?.isActive ?? row?.enabled, true);
}

function modelDefault(row?: ModelRecord) {
  return booleanValue(row?.isDefault ?? row?.defaultFlag, false);
}

function providerActive(row?: ProviderOption | ProviderRecord) {
  return booleanValue(row?.isActive ?? row?.enabled, true);
}

function statusTagTypeValue(row?: ModelRecord) {
  const status = stringValue(
    row?.status || (modelActive(row) ? 'ONLINE' : 'DISABLED'),
  );
  return statusType(status);
}

function applyProviderToModelForm(providerCode: string) {
  const provider = providerItems.value.find(
    (item) => providerKeyOf(item) === providerCode,
  );
  const config = providers.value.find(
    (item) => providerKeyOf(item) === providerCode,
  );
  modelForm.providerCode = providerCode;
  modelForm.providerId = idValue(config?.id);
  modelForm.providerName = providerDisplayName(config || provider);
  modelForm.providerType = providerTypeOf(config || provider);
}

function resetModelForm(row?: ModelRecord) {
  const providerCode = modelProviderCode(row) || selectedProviderCode.value;
  Object.assign(modelForm, createEmptyModelForm(), {
    credential: normalizeCredential(row?.credential),
    displayName: stringValue(row?.displayName ?? row?.name),
    isActive: modelActive(row),
    isDefault: modelDefault(row),
    modelName: modelNameOf(row) === '-' ? '' : modelNameOf(row),
    modelParamsForm: normalizeFormFields(
      row?.modelParamsForm ?? row?.configJson,
    ),
    modelType: modelTypeOf(row),
    providerCode,
    providerId: idValue(row?.providerId),
    providerName: providerNameOf(row) === '-' ? '' : providerNameOf(row),
    providerType: stringValue(row?.providerType),
    sortOrder: numberValue(row?.sortOrder),
    status: stringValue(row?.status, 'ACTIVE'),
  });
  applyProviderToModelForm(providerCode);
  modelParamsRawText.value = prettyJson(modelForm.modelParamsForm, '[]');
}

function resetProviderForm(row?: ProviderOption | ProviderRecord) {
  Object.assign(providerForm, createEmptyProviderForm(), {
    apiKey: stringValue(row?.apiKey),
    apiUrl: providerApiUrlOf(row),
    isActive: providerActive(row),
    providerCode: providerCodeOf(row),
    providerName: providerDisplayName(row),
    providerType: providerTypeOf(row),
    sortOrder: numberValue(row?.sortOrder),
  });
}

async function loadProviderConfigs() {
  const page = await pageProviders({ current: 1, page: 1, size: 100 });
  let records = recordsOf<ProviderRecord>(page);
  if (records.length === 0)
    records = recordsOf<ProviderRecord>(await listProviders());
  providers.value = records;
}

async function loadProviderMetadata(modelType = modelTypeFilter.value) {
  try {
    providerMetadata.value = normalizeProviderMetadata(
      await listProviderMetadata(modelType || undefined),
    );
  } catch {
    providerMetadata.value = providers.value.map((item) => ({
      ...item,
      providerCode: providerCodeOf(item),
      providerName: providerDisplayName(item),
      providerType: providerTypeOf(item),
    }));
  }
}

async function loadProvidersData() {
  providerLoading.value = true;
  try {
    await loadProviderConfigs();
    await loadProviderMetadata();
    if (
      selectedProviderCode.value &&
      !providerItems.value.some(
        (item) => providerCodeOf(item) === selectedProviderCode.value,
      )
    ) {
      selectedProviderCode.value = '';
    }
  } finally {
    providerLoading.value = false;
  }
}

async function loadModels() {
  modelLoading.value = true;
  try {
    const page = await pageModels({ current: 1, page: 1, size: 200 });
    models.value = recordsOf<ModelRecord>(page);
    await loadActiveModels();
  } finally {
    modelLoading.value = false;
  }
}

async function loadActiveModels() {
  const modelType = modelTypeFilter.value || 'CHAT';
  try {
    activeModels.value = recordsOf<ModelRecord>(
      await listActiveModels(modelType),
    );
  } catch {
    activeModels.value = [];
  }
  try {
    const data = await getDefaultModel(modelType);
    defaultModel.value = isRecord(data) ? (data as ModelRecord) : undefined;
  } catch {
    defaultModel.value = undefined;
  }
}

async function refreshAll() {
  await loadProvidersData();
  await loadModels();
}

async function selectProvider(providerCode: string) {
  selectedProviderCode.value = providerCode;
  await loadActiveModels();
}

async function onFilterModelTypeChange() {
  await loadProviderMetadata();
  await loadActiveModels();
}

async function loadModelTypesForDialog(providerCode: string) {
  if (!providerCode) {
    modelTypeOptions.value = [];
    return;
  }
  modelTypeOptions.value = normalizeModelTypeOptions(
    await listProviderModelTypes(providerCode),
  );
}

async function loadBaseModelsForDialog(
  providerCode: string,
  modelType: string,
) {
  if (!providerCode || !modelType) {
    baseModelOptions.value = [];
    return;
  }
  baseModelOptions.value = normalizeBaseModelOptions(
    await listProviderBaseModels(providerCode, modelType),
  );
}

async function loadCredentialFieldsForDialog(providerCode: string) {
  if (!providerCode) {
    credentialFields.value = [];
    return;
  }
  credentialFields.value = normalizeFormFields(
    await listProviderCredentialFields(providerCode),
  );
  credentialFields.value.forEach((field) => {
    const key = fieldKey(field);
    if (key && modelForm.credential[key] === undefined) {
      modelForm.credential[key] = fieldDefaultValue(field);
    }
  });
}

async function loadParamsFormForDialog(
  providerCode: string,
  modelType: string,
) {
  if (!providerCode || !modelType || editingModelId.value) return;
  const paramsFormSource: unknown = await listProviderModelParamsForm(
    providerCode,
    modelType,
  );
  modelForm.modelParamsForm = normalizeFormFields(paramsFormSource);
  modelParamsRawText.value = prettyJson(modelForm.modelParamsForm, '[]');
}

async function openModelDialog(row?: ModelRecord) {
  editingModelId.value = idValue(row?.id);
  modelDialogTab.value = 'base';
  resetModelForm(row);
  modelDialogOpen.value = true;
  dialogLoading.value = true;
  try {
    if (editingModelId.value) {
      const detail = await getModel(editingModelId.value);
      if (isRecord(detail)) resetModelForm({ ...row, ...detail });
    }
    if (modelForm.providerCode) {
      await Promise.all([
        loadModelTypesForDialog(modelForm.providerCode),
        loadCredentialFieldsForDialog(modelForm.providerCode),
      ]);
      await loadBaseModelsForDialog(
        modelForm.providerCode,
        modelForm.modelType,
      );
      if (!editingModelId.value) {
        await loadParamsFormForDialog(
          modelForm.providerCode,
          modelForm.modelType,
        );
      }
    }
  } finally {
    dialogLoading.value = false;
  }
}

async function onModelProviderChange(providerCode: string) {
  applyProviderToModelForm(providerCode);
  modelForm.modelType = '';
  modelForm.modelName = '';
  modelForm.credential = {};
  modelForm.modelParamsForm = [];
  modelParamsRawText.value = '[]';
  await Promise.all([
    loadModelTypesForDialog(providerCode),
    loadCredentialFieldsForDialog(providerCode),
  ]);
  baseModelOptions.value = [];
}

async function onModelTypeChange(modelType: string) {
  modelForm.modelName = '';
  modelForm.modelParamsForm = [];
  modelParamsRawText.value = '[]';
  await loadBaseModelsForDialog(modelForm.providerCode, modelType);
  await loadParamsFormForDialog(modelForm.providerCode, modelType);
}

async function onBaseModelChange(modelName: string) {
  if (!modelForm.displayName) modelForm.displayName = modelName;
  await loadParamsFormForDialog(modelForm.providerCode, modelForm.modelType);
}

function syncModelParamsFromRaw() {
  const parsed = safeParseJson(modelParamsRawText.value, undefined) as unknown;
  if (!Array.isArray(parsed)) {
    ElMessage.warning('模型参数表单 JSON 必须是数组');
    return false;
  }
  modelForm.modelParamsForm = normalizeFormFields(parsed);
  modelParamsRawText.value = prettyJson(modelForm.modelParamsForm, '[]');
  return true;
}

function validateModelForm() {
  if (!modelForm.providerCode) return '请选择供应商';
  if (!modelForm.providerId) return '请先保存供应商配置';
  if (!modelForm.modelType) return '请选择模型类型';
  if (!modelForm.modelName) return '请选择或输入基础模型';
  if (!modelForm.displayName) return '请输入显示名称';
  const missingField = credentialFields.value.find((field) => {
    const key = fieldKey(field);
    return fieldRequired(field) && key && !modelForm.credential[key];
  });
  if (missingField) return `请输入${fieldLabel(missingField)}`;
  return '';
}

async function saveModel() {
  const warning = validateModelForm();
  if (warning) {
    ElMessage.warning(warning);
    return;
  }
  if (!syncModelParamsFromRaw()) return;
  const payload: ModelConfigPayload = {
    credential: dynamicValuesToJson(modelForm.credential),
    displayName: modelForm.displayName,
    isActive: modelForm.isActive,
    isDefault: modelForm.isDefault,
    modelName: modelForm.modelName,
    modelParamsForm: cloneDeep(modelForm.modelParamsForm),
    modelType: modelForm.modelType,
    providerCode: modelForm.providerCode,
    providerId: modelForm.providerId,
    providerName: modelForm.providerName,
    providerType: modelForm.providerType,
    sortOrder: modelForm.sortOrder,
    status: modelForm.status,
  };
  dialogLoading.value = true;
  try {
    await (editingModelId.value
      ? updateModel(editingModelId.value, payload)
      : createModel(payload));
    ElMessage.success('保存成功');
    modelDialogOpen.value = false;
    await loadModels();
  } finally {
    dialogLoading.value = false;
  }
}

function openProviderDialog(row?: ProviderOption | ProviderRecord) {
  const source = row || selectedProviderConfig.value || activeProvider.value;
  editingProviderId.value = idValue(
    selectedProviderConfig.value?.id ?? source?.id,
  );
  resetProviderForm(source);
  providerDialogOpen.value = true;
}

async function saveProvider() {
  if (!providerForm.providerCode) {
    ElMessage.warning('请输入供应商编码');
    return;
  }
  const payload: ProviderConfigPayload = {
    apiKey: providerForm.apiKey,
    apiUrl: providerForm.apiUrl,
    isActive: providerForm.isActive,
    providerCode: providerForm.providerCode,
    providerName: providerForm.providerName,
    providerType: providerForm.providerType,
    sortOrder: providerForm.sortOrder,
  };
  await (editingProviderId.value
    ? updateProvider(editingProviderId.value, payload)
    : createProvider(payload));
  ElMessage.success('供应商已保存');
  providerDialogOpen.value = false;
  await loadProvidersData();
}

function removeProvider(row: ProviderOption | ProviderRecord) {
  const id = idValue(row.id ?? selectedProviderConfig.value?.id);
  if (!id) {
    ElMessage.warning('当前供应商尚未保存配置');
    return;
  }
  confirm(`确认删除供应商 ${providerDisplayName(row)}？`).then(async () => {
    await deleteProvider(id);
    ElMessage.success('删除成功');
    await loadProvidersData();
  });
}

function removeModel(row: ModelRecord) {
  const id = idValue(row.id);
  if (!id) return;
  confirm(`确认删除模型 ${modelDisplayName(row)}？`).then(async () => {
    await deleteModel(id);
    ElMessage.success('删除成功');
    await loadModels();
  });
}

async function openParamsDialog(row: ModelRecord) {
  const id = idValue(row.id);
  if (!id) return;
  paramsModel.value = row;
  paramsDialogOpen.value = true;
  paramsDialogLoading.value = true;
  try {
    paramsForm.value = normalizeFormFields(await getModelParamsForm(id));
    paramsRawText.value = prettyJson(paramsForm.value, '[]');
  } finally {
    paramsDialogLoading.value = false;
  }
}

function syncParamsDialogFromRaw() {
  const parsed = safeParseJson(paramsRawText.value, undefined) as unknown;
  if (!Array.isArray(parsed)) {
    ElMessage.warning('模型参数表单 JSON 必须是数组');
    return false;
  }
  paramsForm.value = normalizeFormFields(parsed);
  paramsRawText.value = prettyJson(paramsForm.value, '[]');
  return true;
}

async function saveParamsDialog() {
  const id = idValue(paramsModel.value?.id);
  if (!id || !syncParamsDialogFromRaw()) return;
  paramsDialogLoading.value = true;
  try {
    await updateModelParamsForm(id as AiModelId, cloneDeep(paramsForm.value));
    ElMessage.success('参数表单已保存');
    paramsDialogOpen.value = false;
    await loadModels();
  } finally {
    paramsDialogLoading.value = false;
  }
}

async function openMetaDialog(row: ModelRecord) {
  const id = idValue(row.id);
  if (!id) return;
  metaDialogTitle.value = `${modelDisplayName(row)} 元数据`;
  metaDialogOpen.value = true;
  metaDialogLoading.value = true;
  try {
    metaRawText.value = prettyJson(await getModelMeta(id), '{}');
  } finally {
    metaDialogLoading.value = false;
  }
}

function fieldValuePreview(value: unknown) {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'object') return prettyJson(value, '{}');
  return stringValue(value);
}

onMounted(refreshAll);
</script>

<template>
  <Page auto-content-height>
    <div class="model-page">
      <aside class="provider-sidebar" v-loading="providerLoading">
        <div class="sidebar-head">
          <div>
            <div class="eyebrow">PROVIDERS</div>
            <h3>模型供应商</h3>
          </div>
          <ElButton :icon="Refresh" link @click="loadProvidersData" />
        </div>
        <ElScrollbar class="provider-scrollbar">
          <button
            v-for="item in providerItems"
            :key="providerCodeOf(item) || '__all__'"
            class="provider-item"
            :class="{ active: providerCodeOf(item) === selectedProviderCode }"
            type="button"
            @click="selectProvider(providerCodeOf(item))"
          >
            <span class="provider-mark">{{
              providerDisplayName(item).slice(0, 1)
            }}</span>
            <span class="provider-copy">
              <strong>{{ providerDisplayName(item) }}</strong>
              <em>
                {{ providerTypeOf(item) }} · {{ item.modelCount || 0 }} 个模型
              </em>
            </span>
            <ElTag
              v-if="providerCodeOf(item)"
              size="small"
              :type="item.configured ? 'success' : 'info'"
            >
              {{ item.configured ? '已配置' : '元数据' }}
            </ElTag>
          </button>
        </ElScrollbar>
      </aside>

      <main class="model-content" v-loading="modelLoading">
        <section class="model-hero">
          <div>
            <div class="eyebrow">MODEL MANAGEMENT</div>
            <h2>{{ activeProviderName }}</h2>
            <p>按供应商选择模型，维护凭证、基础模型、默认状态和参数表单。</p>
          </div>
          <div class="hero-actions">
            <ElButton @click="refreshAll">刷新</ElButton>
            <ElButton :icon="Setting" @click="openProviderDialog()">
              供应商设置
            </ElButton>
            <ElButton :icon="Plus" type="primary" @click="openModelDialog()">
              新增模型
            </ElButton>
          </div>
        </section>

        <section class="filter-bar">
          <ElInput
            v-model="searchKeyword"
            clearable
            :prefix-icon="Search"
            placeholder="搜索显示名称、基础模型或供应商"
          />
          <ElSelect
            v-model="modelTypeFilter"
            clearable
            placeholder="全部模型类型"
            @change="onFilterModelTypeChange"
          >
            <ElOption
              v-for="item in allModelTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </ElSelect>
          <ElTag type="success">默认：{{ defaultModelName }}</ElTag>
          <ElTag type="info">启用：{{ activeModels.length }}</ElTag>
        </section>

        <section v-if="visibleModels.length > 0" class="model-grid">
          <article
            v-for="item in visibleModels"
            :key="item.id"
            class="model-card"
          >
            <div class="card-head">
              <span class="model-icon">
                <ElIcon><Collection /></ElIcon>
              </span>
              <div class="card-title">
                <strong>{{ modelDisplayName(item) }}</strong>
                <em>{{ providerNameOf(item) }}</em>
              </div>
              <ElTag size="small" :type="statusTagTypeValue(item)">
                {{ item.status || enabledText(modelActive(item)) }}
              </ElTag>
            </div>
            <div class="card-lines">
              <span>类型</span>
              <strong>{{ modelTypeLabel(modelTypeOf(item)) }}</strong>
              <span>基础模型</span><strong>{{ modelNameOf(item) }}</strong>
              <span>供应商编码</span>
              <strong>{{ modelProviderCode(item) || '-' }}</strong>
            </div>
            <div class="card-tags">
              <ElTag v-if="modelDefault(item)" size="small" type="warning">
                默认模型
              </ElTag>
              <ElTag
                size="small"
                :type="modelActive(item) ? 'success' : 'info'"
              >
                {{ enabledText(modelActive(item)) }}
              </ElTag>
              <span>{{
                item.updateTime || item.createTime || '未记录时间'
              }}</span>
            </div>
            <div class="card-actions">
              <ElButton
                link
                type="primary"
                :icon="EditPen"
                @click="openModelDialog(item)"
              >
                编辑
              </ElButton>
              <ElButton link @click="openParamsDialog(item)">参数</ElButton>
              <ElButton link @click="openMetaDialog(item)">元数据</ElButton>
              <ElButton link type="danger" @click="removeModel(item)">
                删除
              </ElButton>
            </div>
          </article>
        </section>
        <ElEmpty v-else class="empty-panel" description="暂无匹配模型" />
      </main>

      <ElDialog
        v-model="modelDialogOpen"
        :close-on-click-modal="false"
        :title="modelDialogTitle"
        width="760px"
      >
        <div v-loading="dialogLoading">
          <ElTabs v-model="modelDialogTab">
            <ElTabPane label="基础信息" name="base">
              <ElForm :model="modelForm" label-position="top">
                <div class="form-grid">
                  <ElFormItem label="供应商" required>
                    <ElSelect
                      v-model="modelForm.providerCode"
                      filterable
                      placeholder="请选择供应商"
                      @change="onModelProviderChange"
                    >
                      <ElOption
                        v-for="item in providerItems.filter((provider) =>
                          providerCodeOf(provider),
                        )"
                        :key="providerCodeOf(item)"
                        :label="providerDisplayName(item)"
                        :value="providerCodeOf(item)"
                      />
                    </ElSelect>
                  </ElFormItem>
                  <ElFormItem label="模型类型" required>
                    <ElSelect
                      v-model="modelForm.modelType"
                      :disabled="!modelForm.providerCode"
                      filterable
                      placeholder="请选择模型类型"
                      @change="onModelTypeChange"
                    >
                      <ElOption
                        v-for="item in modelTypeOptions"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      />
                    </ElSelect>
                  </ElFormItem>
                </div>
                <div class="form-grid">
                  <ElFormItem label="基础模型" required>
                    <ElSelect
                      v-model="modelForm.modelName"
                      :disabled="!modelForm.modelType"
                      allow-create
                      default-first-option
                      filterable
                      placeholder="请选择或输入基础模型"
                      @change="onBaseModelChange"
                    >
                      <ElOption
                        v-for="item in baseModelOptions"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      >
                        <div class="option-with-desc">
                          <span>{{ item.label }}</span>
                          <em v-if="item.desc">{{ item.desc }}</em>
                        </div>
                      </ElOption>
                    </ElSelect>
                  </ElFormItem>
                  <ElFormItem label="显示名称" required>
                    <ElInput
                      v-model="modelForm.displayName"
                      maxlength="64"
                      show-word-limit
                    />
                  </ElFormItem>
                </div>
                <div class="form-grid compact">
                  <ElFormItem label="默认模型">
                    <ElSwitch v-model="modelForm.isDefault" />
                  </ElFormItem>
                  <ElFormItem label="启用">
                    <ElSwitch v-model="modelForm.isActive" />
                  </ElFormItem>
                  <ElFormItem label="排序">
                    <ElInputNumber v-model="modelForm.sortOrder" :min="0" />
                  </ElFormItem>
                  <ElFormItem label="状态">
                    <ElInput v-model="modelForm.status" />
                  </ElFormItem>
                </div>
              </ElForm>
            </ElTabPane>

            <ElTabPane label="凭证字段" name="credential">
              <ElForm :model="modelForm.credential" label-position="top">
                <template v-if="credentialFields.length > 0">
                  <ElFormItem
                    v-for="field in credentialFields"
                    :key="fieldKey(field)"
                    :label="fieldLabel(field)"
                    :required="fieldRequired(field)"
                  >
                    <ElSelect
                      v-if="fieldControl(field) === 'select'"
                      :model-value="credentialSelectValue(field)"
                      filterable
                      placeholder="请选择"
                      @update:model-value="
                        (value) => setCredentialValue(field, value)
                      "
                    >
                      <ElOption
                        v-for="option in fieldOptions(field)"
                        :key="`${fieldKey(field)}-${option.value}`"
                        :label="option.label"
                        :value="option.value"
                      />
                    </ElSelect>
                    <ElSwitch
                      v-else-if="fieldControl(field) === 'switch'"
                      :model-value="credentialSwitchValue(field)"
                      @update:model-value="
                        (value) => setCredentialValue(field, value)
                      "
                    />
                    <ElInputNumber
                      v-else-if="fieldControl(field) === 'number'"
                      :model-value="credentialNumberValue(field)"
                      @update:model-value="
                        (value) => setCredentialValue(field, value)
                      "
                    />
                    <ElInput
                      v-else
                      :model-value="credentialTextValue(field)"
                      :rows="fieldControl(field) === 'textarea' ? 4 : undefined"
                      :show-password="fieldControl(field) === 'password'"
                      :type="
                        fieldControl(field) === 'textarea' ? 'textarea' : 'text'
                      "
                      @update:model-value="
                        (value) => setCredentialValue(field, value)
                      "
                    />
                    <div v-if="fieldHelp(field)" class="field-help">
                      {{ fieldHelp(field) }}
                    </div>
                  </ElFormItem>
                </template>
                <ElEmpty v-else description="当前供应商未返回动态凭证字段" />
              </ElForm>
            </ElTabPane>

            <ElTabPane label="参数表单" name="params">
              <div class="params-toolbar">
                <span v-text="modelParamsCountText"></span>
                <ElButton
                  size="small"
                  @click="
                    modelParamsRawText = prettyJson(
                      modelForm.modelParamsForm,
                      '[]',
                    )
                  "
                >
                  更新 JSON
                </ElButton>
                <ElButton
                  size="small"
                  type="primary"
                  @click="syncModelParamsFromRaw"
                >
                  同步 JSON
                </ElButton>
              </div>
              <ElTable
                :data="modelForm.modelParamsForm"
                max-height="220"
                size="small"
              >
                <ElTableColumn label="名称" min-width="130">
                  <template #default="{ row }">{{ fieldLabel(row) }}</template>
                </ElTableColumn>
                <ElTableColumn label="字段" min-width="120">
                  <template #default="{ row }">{{ fieldKey(row) }}</template>
                </ElTableColumn>
                <ElTableColumn label="控件" width="110">
                  <template #default="{ row }">
                    <ElTag size="small">
                      {{ fieldInputType(row) }}
                    </ElTag>
                  </template>
                </ElTableColumn>
                <ElTableColumn label="默认值" min-width="140">
                  <template #default="{ row }">
                    {{
                      fieldValuePreview(row.defaultValue ?? row.default_value)
                    }}
                  </template>
                </ElTableColumn>
              </ElTable>
              <ElInput
                v-model="modelParamsRawText"
                class="json-editor"
                type="textarea"
                :rows="8"
              />
            </ElTabPane>
          </ElTabs>
        </div>
        <template #footer>
          <ElButton @click="modelDialogOpen = false">取消</ElButton>
          <ElButton :loading="dialogLoading" type="primary" @click="saveModel">
            保存
          </ElButton>
        </template>
      </ElDialog>

      <ElDialog v-model="providerDialogOpen" title="供应商配置" width="620px">
        <ElForm :model="providerForm" label-position="top">
          <div class="form-grid">
            <ElFormItem label="供应商名称" required>
              <ElInput v-model="providerForm.providerName" />
            </ElFormItem>
            <ElFormItem label="供应商编码" required>
              <ElInput v-model="providerForm.providerCode" />
            </ElFormItem>
          </div>
          <div class="form-grid">
            <ElFormItem label="供应商类型">
              <ElInput v-model="providerForm.providerType" />
            </ElFormItem>
            <ElFormItem label="排序">
              <ElInputNumber v-model="providerForm.sortOrder" :min="0" />
            </ElFormItem>
          </div>
          <ElFormItem label="API URL">
            <ElInput v-model="providerForm.apiUrl" />
          </ElFormItem>
          <ElFormItem label="API Key">
            <ElInput v-model="providerForm.apiKey" show-password />
          </ElFormItem>
          <ElFormItem label="启用">
            <ElSwitch v-model="providerForm.isActive" />
          </ElFormItem>
        </ElForm>
        <template #footer>
          <ElButton
            v-if="editingProviderId"
            type="danger"
            @click="removeProvider(providerForm)"
          >
            删除
          </ElButton>
          <ElButton @click="providerDialogOpen = false">取消</ElButton>
          <ElButton type="primary" @click="saveProvider">保存</ElButton>
        </template>
      </ElDialog>

      <ElDialog
        v-model="paramsDialogOpen"
        :title="paramsDialogTitle"
        width="800px"
      >
        <div v-loading="paramsDialogLoading">
          <div class="params-toolbar">
            <span>字段 {{ paramsForm.length }} 项</span>
            <ElButton
              size="small"
              @click="paramsRawText = prettyJson(paramsForm, '[]')"
            >
              更新 JSON
            </ElButton>
            <ElButton
              size="small"
              type="primary"
              @click="syncParamsDialogFromRaw"
            >
              同步 JSON
            </ElButton>
          </div>
          <ElTable :data="paramsForm" max-height="260" size="small">
            <ElTableColumn label="名称" min-width="150">
              <template #default="{ row }">{{ fieldLabel(row) }}</template>
            </ElTableColumn>
            <ElTableColumn label="字段" min-width="130">
              <template #default="{ row }">{{ fieldKey(row) }}</template>
            </ElTableColumn>
            <ElTableColumn label="控件" width="120">
              <template #default="{ row }">
                <ElTag size="small">{{ fieldInputType(row) }}</ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="默认值" min-width="160">
              <template #default="{ row }">
                {{ fieldValuePreview(row.defaultValue ?? row.default_value) }}
              </template>
            </ElTableColumn>
          </ElTable>
          <ElInput
            v-model="paramsRawText"
            class="json-editor"
            type="textarea"
            :rows="9"
          />
        </div>
        <template #footer>
          <ElButton @click="paramsDialogOpen = false">取消</ElButton>
          <ElButton
            :loading="paramsDialogLoading"
            type="primary"
            @click="saveParamsDialog"
          >
            保存
          </ElButton>
        </template>
      </ElDialog>

      <ElDialog v-model="metaDialogOpen" :title="metaDialogTitle" width="720px">
        <div v-loading="metaDialogLoading">
          <ElInput v-model="metaRawText" type="textarea" :rows="16" readonly />
        </div>
      </ElDialog>
    </div>
  </Page>
</template>

<style scoped lang="scss">
.model-page {
  --model-space-1: 4px;
  --model-space-2: 8px;
  --model-space-3: 12px;
  --model-space-4: 16px;
  --model-space-5: 20px;
  --model-panel-radius: 6px;
  --model-sidebar-width: 280px;

  box-sizing: border-box;
  display: grid;
  grid-template-columns: var(--model-sidebar-width) minmax(0, 1fr);
  gap: var(--model-space-3);
  height: 100%;
  overflow: hidden;
}

.provider-sidebar,
.model-content,
.model-card,
.empty-panel {
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--model-panel-radius);
}

.provider-sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.sidebar-head,
.model-hero,
.filter-bar,
.hero-actions,
.card-head,
.card-tags,
.card-actions,
.params-toolbar {
  display: flex;
  gap: var(--model-space-2);
  align-items: center;
}

.sidebar-head,
.model-hero {
  justify-content: space-between;
  padding: var(--model-space-3) var(--model-space-4);
}

.sidebar-head {
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.provider-scrollbar {
  flex: 1;
  min-height: 0;
  padding: var(--model-space-2);
}

.provider-item {
  display: flex;
  gap: var(--model-space-2);
  align-items: center;
  width: 100%;
  padding: var(--model-space-2) var(--model-space-3);
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--model-panel-radius);
}

.provider-item:hover {
  background: var(--el-color-primary-light-9);
}

.provider-item.active {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-7);
}

.provider-mark,
.model-icon {
  display: inline-flex;
  flex: 0 0 32px;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-weight: 600;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-8);
  border-radius: var(--model-panel-radius);
}

.provider-copy,
.card-title {
  display: grid;
  flex: 1;
  gap: var(--model-space-1);
  min-width: 0;
}

.provider-copy strong,
.card-title strong,
.card-lines strong {
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.provider-copy em,
.card-title em,
.card-tags,
.eyebrow,
.model-hero p,
.field-help,
.option-with-desc em {
  font-size: 12px;
  font-style: normal;
  color: var(--el-text-color-secondary);
}

.model-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.model-hero {
  flex-shrink: 0;
  background: hsl(var(--card));
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.model-hero h2,
.sidebar-head h3 {
  margin: var(--model-space-1) 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.model-hero p {
  margin: 0;
}

.filter-bar {
  flex-shrink: 0;
  flex-wrap: wrap;
  padding: var(--model-space-3) var(--model-space-4);
  background: var(--el-fill-color-extra-light);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.filter-bar .el-input {
  width: 320px;
  max-width: 100%;
}

.filter-bar .el-select {
  width: 190px;
}

.model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--model-space-3);
  min-height: 0;
  padding: var(--model-space-3) var(--model-space-4) var(--model-space-4);
  overflow: auto;
}

.model-card {
  display: flex;
  flex-direction: column;
  gap: var(--model-space-2);
  min-height: 170px;
  padding: var(--model-space-3);
  box-shadow: none;
  transition:
    border-color var(--el-transition-duration),
    box-shadow var(--el-transition-duration);
}

.model-card:hover {
  border-color: var(--el-border-color);
  box-shadow: var(--el-box-shadow-lighter);
}

.card-lines {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: var(--model-space-1) var(--model-space-3);
  font-size: 13px;
}

.card-lines span {
  color: var(--el-text-color-secondary);
}

.card-tags {
  flex-wrap: wrap;
}

.card-actions {
  justify-content: flex-end;
  padding-top: var(--model-space-1);
  margin-top: auto;
  border-top: 1px solid var(--el-border-color-lighter);
}

.empty-panel {
  flex: 1;
  margin: var(--model-space-3) var(--model-space-4) var(--model-space-4);
  background: var(--el-fill-color-extra-light);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--model-space-3);
}

.form-grid.compact {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.option-with-desc {
  display: grid;
  gap: var(--model-space-1);
}

.params-toolbar {
  justify-content: space-between;
  margin-bottom: var(--model-space-2);
}

.json-editor {
  margin-top: var(--model-space-3);
}

.field-help {
  margin-top: var(--model-space-1);
}

@media (max-width: 960px) {
  .model-page {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .provider-sidebar {
    min-height: 220px;
  }

  .model-content {
    min-height: 520px;
  }

  .form-grid,
  .form-grid.compact {
    grid-template-columns: 1fr;
  }
}
</style>
