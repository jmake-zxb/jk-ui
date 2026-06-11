<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';

import type { InitParamValues } from './init-param-utils';

import type { AiToolType, ToolFieldSchema, ToolRequest } from '#/api/ai/tools';

import { computed, reactive, ref, watch } from 'vue';

import { confirm } from '@vben/common-ui';

import {
  Back,
  EditPen,
  MagicStick,
  Operation,
  Plus,
} from '@element-plus/icons-vue';
import {
  ElAlert,
  ElAvatar,
  ElButton,
  ElDialog,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';
import { cloneDeep } from 'lodash-es';

import { createTool, getTool, pylintTool, updateTool } from '#/api/ai/tools';
import { CodeEditor } from '#/component';

import DynamicInitForm from './DynamicInitForm.vue';
import EditAvatarDialog from './EditAvatarDialog.vue';
import GenerateCodeDialog from './GenerateCodeDialog.vue';
import {
  seedInitParams,
  stringifyInitParamsForPayload,
  validateInitParamValues,
} from './init-param-utils';
import { buildToolPayload, defaultCodeForToolType } from './tool-form-utils';
import ToolDebugDrawer from './ToolDebugDrawer.vue';

type Id = number | string;
type FieldMode = 'init' | 'input';

interface ToolRecord extends Record<string, unknown> {
  code?: string;
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
  toolType?: string;
  tool_type?: string;
  version?: string;
  workspaceId?: string;
  workspace_id?: string;
}

interface ToolFormState {
  code: string;
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

interface JsonSyntaxResult {
  message: string;
  valid: boolean;
}

interface PythonSyntaxDiagnostic {
  column?: number;
  line?: number;
  message: string;
  type: string;
}

const props = withDefaults(
  defineProps<{
    folderId?: Id;
    workspaceId?: string;
  }>(),
  {
    folderId: undefined,
    workspaceId: 'default',
  },
);

const emit = defineEmits<{
  refresh: [];
}>();

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

const formRef = ref<FormInstance>();
const fieldDialogOpen = ref(false);
const fieldMode = ref<FieldMode>('input');
const fieldIndex = ref<number>();
const visible = ref(false);
const loading = ref(false);
const showEditor = ref(false);
const showEditIcon = ref(false);
const editingId = ref<Id>();
const generateCodeDialogOpen = ref(false);
const pythonSyntaxLoading = ref(false);
const pythonSyntaxCheckedCode = ref('');
const pythonSyntaxDiagnostics = ref<PythonSyntaxDiagnostic[]>([]);
const pythonSyntaxError = ref('');

const toolDebugDrawerRef = ref<InstanceType<typeof ToolDebugDrawer>>();
const editAvatarDialogRef = ref<InstanceType<typeof EditAvatarDialog>>();
const formInitParamValues = reactive<InitParamValues>({});
const form = reactive<ToolFormState>(createEmptyForm());
const fieldForm = reactive<FieldFormState>(createEmptyFieldForm('input'));

const rules: FormRules<ToolFormState> = {
  name: [{ message: '请输入工具名称', required: true, trigger: 'blur' }],
};

const title = computed(
  () => `${editingId.value === undefined ? '创建' : '编辑'}工具`,
);
const hasInitFields = computed(() => form.init_field_list.length > 0);
const pythonSyntaxHasErrors = computed(() =>
  pythonSyntaxDiagnostics.value.some((item) => isPythonSyntaxError(item)),
);
const pythonSyntaxStatus = computed(() => {
  if (pythonSyntaxLoading.value) return 'checking';
  if (pythonSyntaxError.value || pythonSyntaxHasErrors.value) return 'error';
  if (pythonSyntaxDiagnostics.value.length > 0) return 'warning';
  if (pythonSyntaxCheckedCode.value === form.code && form.code.trim()) {
    return 'success';
  }
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
const initParamsJsonSyntax = computed(() => checkJsonSyntax(form.init_params));

function createEmptyForm(): ToolFormState {
  return {
    code: defaultCodeForToolType('DATA_SOURCE'),
    description: '',
    enabled: false,
    folder_id: props.folderId,
    icon: '',
    init_field_list: [],
    init_params: '{}',
    input_field_list: [],
    label: '',
    name: '',
    scope: 'WORKSPACE',
    tool_type: 'DATA_SOURCE',
    version: '',
    workspace_id: props.workspaceId || 'default',
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

function booleanValue(value: unknown, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return fallback;
  return `${value}` !== 'false';
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function parseObjectValue(value: unknown): Record<string, unknown> {
  const source = typeof value === 'string' ? safeParseJson(value) : value;
  return isRecord(source) ? cloneDeep(source) : {};
}

function parseArrayValue(value: unknown): ToolFieldSchema[] {
  const source = typeof value === 'string' ? safeParseJson(value) : value;
  if (!Array.isArray(source)) return [];
  return cloneDeep(source).filter((item): item is ToolFieldSchema =>
    isRecord(item),
  );
}

function parseOptionList(value: string): Record<string, unknown>[] {
  const source = safeParseJson(value);
  if (!Array.isArray(source)) return [];
  return source.map((item) => {
    if (isRecord(item)) return cloneDeep(item);
    return { label: stringValue(item), value: item };
  });
}

function normalizeJsonText(value: unknown, fallback = '{}') {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const parsed = safeParseJson(trimmed);
    return parsed === undefined ? trimmed : JSON.stringify(parsed, null, 2);
  }
  return JSON.stringify(value, null, 2);
}

function checkJsonSyntax(value: string): JsonSyntaxResult {
  const text = value.trim();
  if (!text) return { message: '空值将按 {} 保存', valid: true };
  const parsed = safeParseJson(text);
  if (!isRecord(parsed))
    return { message: '初始化参数值必须是 JSON 对象', valid: false };
  return { message: '初始化参数 JSON 语法正确', valid: true };
}

function detailToToolRecord(
  detail: unknown,
  fallback?: ToolRecord,
): ToolRecord {
  if (!isRecord(detail)) return fallback ? cloneDeep(fallback) : {};
  const tool = isRecord(detail.tool) ? detail.tool : detail;
  return { ...fallback, ...tool };
}

function toolFolderId(row?: ToolRecord) {
  return idValue(row?.folder_id ?? row?.folderId) ?? props.folderId;
}

function toolWorkspaceId(row?: ToolRecord) {
  return stringValue(
    row?.workspace_id ?? row?.workspaceId,
    props.workspaceId || 'default',
  );
}

function isImageIcon(icon?: unknown) {
  const value = stringValue(icon).trim();
  return /^(?:https?:|data:image|blob:|\/|\.\/)/i.test(value);
}

function resetPythonSyntaxState() {
  pythonSyntaxCheckedCode.value = '';
  pythonSyntaxDiagnostics.value = [];
  pythonSyntaxError.value = '';
}

function markPythonSyntaxStale(value = form.code) {
  if (value === pythonSyntaxCheckedCode.value) return;
  resetPythonSyntaxState();
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

function resetToolInitParamsFromRaw() {
  replaceInitParamValues(
    formInitParamValues,
    seedInitParams(form.init_field_list, form.init_params),
  );
  syncToolInitRawFromForm();
}

function syncToolInitRawFromForm() {
  form.init_params = stringifyInitParamsForPayload(
    form.init_field_list,
    formInitParamValues,
  );
}

function handleToolInitParamsUpdate(values: InitParamValues) {
  replaceInitParamValues(formInitParamValues, values);
  syncToolInitRawFromForm();
}

function setFormFromRecord(record: ToolRecord) {
  Object.assign(form, {
    code: stringValue(record.code, defaultCodeForToolType('DATA_SOURCE')),
    description: stringValue(record.description ?? record.desc),
    enabled: booleanValue(
      record.enabled ?? record.isActive ?? record.is_active,
      false,
    ),
    folder_id: toolFolderId(record),
    icon: stringValue(record.icon),
    id: idValue(record.id),
    init_field_list: parseArrayValue(
      record.init_field_list ?? record.initFieldList,
    ),
    init_params: normalizeJsonText(
      record.init_params ?? record.initParams,
      '{}',
    ),
    input_field_list: parseArrayValue(
      record.input_field_list ?? record.inputFieldList,
    ),
    label: stringValue(record.label),
    name: stringValue(record.name, '未命名工具'),
    scope: stringValue(record.scope, 'WORKSPACE'),
    tool_type: 'DATA_SOURCE' as AiToolType,
    version: stringValue(record.version),
    workspace_id: toolWorkspaceId(record),
  });
  resetPythonSyntaxState();
  resetToolInitParamsFromRaw();
}

function buildPayload(isEdit = editingId.value !== undefined): ToolRequest {
  return buildToolPayload(form as any, { enabled: form.enabled, isEdit });
}

function fieldOptionLabel(row: ToolFieldSchema) {
  return stringValue(row.label ?? row.field ?? row.name, '-');
}

function inputFieldRequired(row: ToolFieldSchema) {
  return booleanValue(row.is_required, true);
}

function initFieldRequired(row: ToolFieldSchema) {
  return booleanValue(row.required, false);
}

function setInputFieldRequired(row: ToolFieldSchema, value: boolean) {
  row.is_required = value;
}

function setInitFieldRequired(row: ToolFieldSchema, value: boolean) {
  row.required = value;
  resetToolInitParamsFromRaw();
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
      option_list: parseOptionList(fieldForm.option_list_json),
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
  if (mode === 'init') resetToolInitParamsFromRaw();
}

function normalizePythonSyntaxDiagnostic(
  value: unknown,
): PythonSyntaxDiagnostic | undefined {
  if (typeof value === 'string' && value.trim())
    return { message: value, type: 'error' };
  if (!isRecord(value)) return undefined;
  const line = Number(value.line ?? value.lineno);
  const column = Number(value.column ?? value.col);
  return {
    column: Number.isFinite(column) ? column : undefined,
    line: Number.isFinite(line) ? line : undefined,
    message: stringValue(
      value.message ?? value.msg ?? value.detail,
      'Python 语法错误',
    ),
    type: stringValue(value.type ?? value.severity, 'error'),
  };
}

function normalizePythonSyntaxDiagnostics(value: unknown) {
  const source =
    isRecord(value) && Array.isArray(value.data) ? value.data : value;
  if (!Array.isArray(source)) return [];
  return source
    .map((item) => normalizePythonSyntaxDiagnostic(item))
    .filter((item): item is PythonSyntaxDiagnostic => item !== undefined);
}

function isPythonSyntaxError(item: PythonSyntaxDiagnostic) {
  return stringValue(item.type, 'error').toLowerCase() === 'error';
}

function pythonDiagnosticLocation(item: PythonSyntaxDiagnostic) {
  if (!item.line) return 'Python';
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

async function runPythonSyntaxCheck(showSuccessMessage = true) {
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
    if (pythonSyntaxHasErrors.value) {
      ElMessage.warning('Python 语法检查未通过，请修复错误后再保存');
      return false;
    }
    if (showSuccessMessage) ElMessage.success('Python 语法检查通过');
    return true;
  } catch {
    pythonSyntaxError.value = 'Python 语法检查失败，请稍后重试';
    ElMessage.error(pythonSyntaxError.value);
    return false;
  } finally {
    pythonSyntaxLoading.value = false;
  }
}

function openGenerateCodeDialog() {
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

function openEditAvatar() {
  editAvatarDialogRef.value?.open(form.icon);
}

function saveAvatar(icon: string) {
  form.icon = icon;
}

function openDebug() {
  toolDebugDrawerRef.value?.open({
    code: form.code,
    init_field_list: form.init_field_list,
    input_field_list: form.input_field_list,
  });
}

function hasFormData() {
  return (
    [form.name, form.description, form.code, form.icon].some((item) =>
      item.trim(),
    ) ||
    form.init_field_list.length > 0 ||
    form.input_field_list.length > 0
  );
}

function closeDrawer() {
  if (!hasFormData()) {
    visible.value = false;
    return;
  }
  confirm('当前编辑内容未保存，确认关闭？').then(() => {
    visible.value = false;
  });
}

async function prepareInitParamsForPayload() {
  if (!initParamsJsonSyntax.value.valid) {
    ElMessage.warning(initParamsJsonSyntax.value.message);
    return false;
  }
  if (form.enabled) {
    const errors = validateInitParamValues(
      form.init_field_list,
      formInitParamValues,
    );
    if (errors.length > 0) {
      ElMessage.warning(errors[0]);
      return false;
    }
  }
  syncToolInitRawFromForm();
  return true;
}

async function saveTool() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (valid === false) return;
  if (!form.code.trim()) {
    ElMessage.warning('请输入 Python 代码');
    return;
  }
  if (!(await runPythonSyntaxCheck(false))) return;
  if (!(await prepareInitParamsForPayload())) return;

  loading.value = true;
  try {
    await (editingId.value === undefined
      ? createTool(buildPayload(false))
      : updateTool(editingId.value, buildPayload(true)));
    ElMessage.success(editingId.value === undefined ? '创建成功' : '保存成功');
    visible.value = false;
    emit('refresh');
  } finally {
    loading.value = false;
  }
}

async function open(row?: ToolRecord) {
  loading.value = true;
  Object.assign(form, createEmptyForm());
  resetPythonSyntaxState();
  resetToolInitParamsFromRaw();
  try {
    editingId.value = idValue(row?.id);
    if (row?.id) {
      const detail = await getTool(row.id);
      setFormFromRecord(detailToToolRecord(detail, row));
    } else if (row) {
      setFormFromRecord(row);
    }
    visible.value = true;
    window.setTimeout(() => {
      showEditor.value = true;
    }, 100);
  } finally {
    loading.value = false;
  }
}

watch(visible, (value) => {
  if (value) return;
  showEditor.value = false;
  showEditIcon.value = false;
  editingId.value = undefined;
  Object.assign(form, createEmptyForm());
  Object.assign(fieldForm, createEmptyFieldForm('input'));
  fieldIndex.value = undefined;
  resetPythonSyntaxState();
  resetToolInitParamsFromRaw();
  formRef.value?.clearValidate();
});

defineExpose({ open });
</script>

<template>
  <ElDrawer
    v-model="visible"
    append-to-body
    size="60%"
    :before-close="closeDrawer"
    :show-close="false"
  >
    <template #header>
      <div class="tool-form-drawer__header">
        <ElButton
          class="tool-form-drawer__back"
          link
          @click.prevent="closeDrawer"
        >
          <Back />
        </ElButton>
        <h4>{{ title }}</h4>
      </div>
    </template>

    <div v-loading="loading" class="tool-form-drawer">
      <section class="tool-form-section">
        <h4 class="tool-form-section__title">基础信息</h4>
        <ElForm
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          require-asterisk-position="right"
          @submit.prevent
        >
          <ElFormItem label="名称" prop="name">
            <div class="tool-name-row">
              <div
                class="edit-avatar"
                @mouseenter="showEditIcon = true"
                @mouseleave="showEditIcon = false"
              >
                <ElAvatar class="tool-avatar" shape="square" :size="36">
                  <img v-if="isImageIcon(form.icon)" :src="form.icon" alt="" />
                  <Operation v-else />
                </ElAvatar>
                <ElButton
                  v-if="showEditIcon"
                  class="edit-avatar__mask"
                  text
                  @click="openEditAvatar"
                >
                  <EditPen />
                </ElButton>
              </div>
              <ElInput
                v-model="form.name"
                maxlength="64"
                placeholder="请输入工具名称"
                show-word-limit
                @blur="form.name = form.name.trim()"
              />
            </div>
          </ElFormItem>
          <ElFormItem label="描述">
            <ElInput
              v-model="form.description"
              maxlength="128"
              placeholder="请输入描述"
              show-word-limit
              type="textarea"
              :autosize="{ minRows: 3 }"
              @blur="form.description = form.description.trim()"
            />
          </ElFormItem>
        </ElForm>
      </section>

      <section class="tool-form-section">
        <div class="tool-form-section__bar">
          <h4 class="tool-form-section__title">启动参数</h4>
          <ElButton link type="primary" @click="openFieldDialog('init')">
            <Plus />
            添加
          </ElButton>
        </div>
        <ElTable :data="form.init_field_list" class="mb-16" size="small">
          <ElTableColumn label="字段" min-width="140">
            <template #default="{ row }">
              <span :title="row.field || row.name">{{
                row.field || row.name || '-'
              }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="显示名称" min-width="140">
            <template #default="{ row }">{{ fieldOptionLabel(row) }}</template>
          </ElTableColumn>
          <ElTableColumn label="组件" width="140">
            <template #default="{ row }">
              <ElTag size="small" type="info">
                {{ row.input_type || '-' }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="必填" width="90">
            <template #default="{ row }">
              <ElSwitch
                size="small"
                :model-value="initFieldRequired(row)"
                @update:model-value="
                  (value) => setInitFieldRequired(row, Boolean(value))
                "
              />
            </template>
          </ElTableColumn>
          <ElTableColumn label="操作" width="110">
            <template #default="{ row, $index }">
              <ElButton
                link
                type="primary"
                @click="openFieldDialog('init', row, $index)"
              >
                编辑
              </ElButton>
              <ElButton link type="danger" @click="removeField('init', $index)">
                删
              </ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
        <div v-if="hasInitFields" class="init-defaults">
          <div class="tool-form-section__subbar">
            <span>启动参数默认值</span>
            <ElTag
              effect="plain"
              size="small"
              :type="initParamsJsonSyntax.valid ? 'success' : 'danger'"
            >
              JSON
            </ElTag>
          </div>
          <DynamicInitForm
            :fields="form.init_field_list"
            :model-value="formInitParamValues"
            :show-empty="false"
            @update:model-value="handleToolInitParamsUpdate"
          />
        </div>
      </section>

      <section class="tool-form-section">
        <div class="tool-form-section__bar">
          <h4 class="tool-form-section__title">
            输入参数
            <span class="tool-form-muted">运行工具时由调用方传入</span>
          </h4>
          <ElButton link type="primary" @click="openFieldDialog('input')">
            <Plus />
            添加
          </ElButton>
        </div>
        <ElTable :data="form.input_field_list" size="small">
          <ElTableColumn label="参数名" min-width="140">
            <template #default="{ row }">{{ row.name || '-' }}</template>
          </ElTableColumn>
          <ElTableColumn label="数据类型" width="120">
            <template #default="{ row }">
              <ElTag size="small" type="info">{{ row.type || '-' }}</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="必填" width="90">
            <template #default="{ row }">
              <ElSwitch
                size="small"
                :model-value="inputFieldRequired(row)"
                @update:model-value="
                  (value) => setInputFieldRequired(row, Boolean(value))
                "
              />
            </template>
          </ElTableColumn>
          <ElTableColumn label="来源" width="100">
            <template #default="{ row }">
              {{ row.source === 'custom' ? '自定义' : '引用' }}
            </template>
          </ElTableColumn>
          <ElTableColumn label="操作" width="110">
            <template #default="{ row, $index }">
              <ElButton
                link
                type="primary"
                @click="openFieldDialog('input', row, $index)"
              >
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

      <section class="tool-form-section">
        <div class="tool-form-section__bar">
          <h4 class="tool-form-section__title">
            Python代码
            <span class="required-mark">*</span>
            <span class="tool-form-muted">函数返回值将写入结果字段</span>
          </h4>
          <div class="tool-form-actions">
            <ElButton
              link
              type="primary"
              :icon="MagicStick"
              @click="openGenerateCodeDialog"
            >
              AI 生成代码
            </ElButton>
            <ElButton
              link
              type="primary"
              :loading="pythonSyntaxLoading"
              @click="runPythonSyntaxCheck()"
            >
              语法检查
            </ElButton>
          </div>
        </div>
        <CodeEditor
          v-if="showEditor"
          v-model="form.code"
          class="tool-code-editor"
          height="460px"
          mode="python"
          @change="markPythonSyntaxStale"
        />
        <div class="syntax-status" :class="`is-${pythonSyntaxStatus}`">
          <ElTag effect="plain" size="small" :type="pythonSyntaxTagType()">
            {{ pythonSyntaxTagText() }}
          </ElTag>
          <span>{{ pythonSyntaxStatusText }}</span>
        </div>
        <ul
          v-if="pythonSyntaxDiagnostics.length > 0"
          class="syntax-diagnostic-list"
        >
          <li
            v-for="(item, index) in pythonSyntaxDiagnostics"
            :key="`${item.line || 0}-${item.column || 0}-${index}`"
            :class="isPythonSyntaxError(item) ? 'is-error' : 'is-warning'"
          >
            <span>{{ pythonDiagnosticLocation(item) }}</span>
            <span>{{ item.message }}</span>
          </li>
        </ul>
      </section>

      <section class="tool-form-section">
        <h4 class="tool-form-section__title">
          输出参数
          <span class="tool-form-muted">MaxKB 工具默认输出结果字段</span>
        </h4>
        <div class="output-hint">结果 {result}</div>
      </section>
    </div>

    <template #footer>
      <ElButton :loading="loading" @click="closeDrawer">取消</ElButton>
      <ElButton :loading="loading" @click="openDebug">调试</ElButton>
      <ElButton type="primary" :loading="loading" @click="saveTool">
        保存
      </ElButton>
    </template>

    <ToolDebugDrawer ref="toolDebugDrawerRef" :tool-id="editingId" />
    <EditAvatarDialog ref="editAvatarDialogRef" @save="saveAvatar" />
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

    <ElDialog
      v-model="fieldDialogOpen"
      append-to-body
      :title="fieldMode === 'init' ? '启动参数' : '输入参数'"
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
            <ElInput v-model="fieldForm.attrs_json" type="textarea" :rows="4" />
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
              <ElOption label="引用" value="reference" />
              <ElOption label="自定义" value="custom" />
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
      <ElAlert
        v-if="fieldMode === 'init'"
        class="field-dialog-tip"
        title="Attrs 与选项字段兼容 MaxKB JSON 结构，保存时会写入启动参数 schema。"
        type="info"
        :closable="false"
      />
      <template #footer>
        <ElButton @click="fieldDialogOpen = false">取消</ElButton>
        <ElButton type="primary" @click="saveField">保存</ElButton>
      </template>
    </ElDialog>
  </ElDrawer>
</template>

<style scoped lang="scss">
.tool-form-drawer {
  --tool-form-space-1: 4px;
  --tool-form-space-2: 8px;
  --tool-form-space-3: 12px;
  --tool-form-space-4: 16px;
  --tool-form-radius: 6px;

  display: flex;
  flex-direction: column;
  gap: var(--tool-form-space-3);
}

.tool-form-drawer__header,
.tool-form-section__bar,
.tool-form-section__subbar,
.tool-name-row,
.tool-form-actions {
  display: flex;
  gap: var(--tool-form-space-2);
  align-items: center;
}

.tool-form-drawer__header {
  margin-left: calc(var(--tool-form-space-2) * -1);
}

.tool-form-drawer__header h4,
.tool-form-section__title {
  margin: 0;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.tool-form-drawer__back svg {
  width: 20px;
  height: 20px;
}

.tool-form-section {
  padding: var(--tool-form-space-3);
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--tool-form-radius);
}

.tool-form-section__bar {
  justify-content: space-between;
  margin-bottom: var(--tool-form-space-3);
}

.tool-form-section__subbar {
  justify-content: space-between;
  margin-bottom: var(--tool-form-space-2);
  font-size: 13px;
  font-weight: 600;
}

.tool-form-muted {
  margin-left: var(--tool-form-space-2);
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.tool-name-row .el-input {
  flex: 1;
}

.edit-avatar {
  position: relative;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
}

.tool-avatar {
  width: 36px;
  height: 36px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.tool-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.edit-avatar__mask {
  position: absolute;
  inset: 0;
  width: 36px;
  height: 36px;
  padding: 0;
  color: #fff;
  background: rgb(0 0 0 / 45%);
  border-radius: var(--tool-form-radius);
}

.init-defaults {
  padding: var(--tool-form-space-3);
  margin-top: var(--tool-form-space-3);
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--tool-form-radius);
}

.tool-code-editor {
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--tool-form-radius);
}

.syntax-status {
  display: flex;
  gap: var(--tool-form-space-2);
  align-items: flex-start;
  padding-top: var(--tool-form-space-2);
  font-size: 12px;
  color: var(--el-text-color-secondary);
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

.syntax-diagnostic-list {
  display: grid;
  gap: var(--tool-form-space-1);
  padding: var(--tool-form-space-2) var(--tool-form-space-3);
  margin: var(--tool-form-space-2) 0 0;
  font-size: 12px;
  line-height: 1.55;
  list-style: none;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--tool-form-radius);
}

.syntax-diagnostic-list li {
  display: flex;
  gap: var(--tool-form-space-2);
}

.output-hint {
  padding: var(--tool-form-space-3);
  margin-top: var(--tool-form-space-2);
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--tool-form-radius);
}

.required-mark {
  color: var(--el-color-danger);
}

.field-dialog-tip {
  margin-top: var(--tool-form-space-3);
}

.mb-16 {
  margin-bottom: var(--tool-form-space-4);
}
</style>
