<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import type { ResourceRecord } from '../../common/tool-resource-utils';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import {
  ElButton,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTag,
  ElTooltip,
} from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

import { getTool, listTools } from '#/api/ai/tools';

import { syncNodeProperties } from '../../common/node-inline-update';
import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';
import {
  descriptionOf,
  filterTools,
  idOf,
  mergeToolInputFields,
  nameOf,
  recordOf,
  recordsOf,
  toolInputFields,
  typeOf,
} from '../../common/tool-resource-utils';

type FieldSource = 'custom' | 'reference';

type ToolInputField = Record<string, unknown> & {
  desc?: string;
  field?: string;
  is_required?: boolean;
  label?: unknown;
  name?: string;
  required?: boolean;
  source?: FieldSource;
  type?: string;
  value?: unknown;
};

type ToolLibNodeData = Record<string, unknown> & {
  input?: string;
  input_field_list: ToolInputField[];
  is_result: boolean;
  tool_id?: number | string;
  tool_lib_id?: number | string;
  toolId?: number | string;
  toolLibId?: number | string;
};

type WorkflowNodeModel = {
  graphModel?: {
    eventCenter?: {
      emit?: (eventName: string, payload: Record<string, unknown>) => void;
    };
  };
  id: string;
  properties: Record<string, unknown>;
  refreshVueComponent?: () => void;
  updateWorkflowProperties?: (
    patch: Record<string, unknown>,
    fields?: string[],
  ) => void;
  validate?: () => Promise<void>;
};

const props = defineProps<{
  nodeModel: WorkflowNodeModel;
  renderVersion?: number;
}>();
const nodeModel = props.nodeModel;
const toolTypes = [
  'CUSTOM',
  'DATA_SOURCE',
  'HTTP',
  'INTERNAL',
  'MOCK',
  'SKILL',
];

const defaultNodeData: ToolLibNodeData = {
  input: '{{input}}',
  input_field_list: [],
  is_result: true,
  toolId: '',
  toolLibId: '',
  tool_lib_id: '',
};

const sourceNodeData = nodeModel.properties?.node_data;
const validationShape = {
  hasToolId: isRecord(sourceNodeData) && hasOwn(sourceNodeData, 'toolId'),
  hasToolLibId:
    isRecord(sourceNodeData) &&
    (hasOwn(sourceNodeData, 'toolLibId') ||
      hasOwn(sourceNodeData, 'tool_lib_id')),
};

const formRef = ref<FormInstance>();
const formData = ref<ToolLibNodeData>(
  normalizeNodeData(nodeModel.properties?.node_data),
);
const nodeRenderVersion = ref(0);
const tools = ref<ResourceRecord[]>([]);
const toolLoading = ref(false);

const inputFields = computed(() => formData.value.input_field_list);
const selectedToolId = computed(
  () =>
    formData.value.toolId ||
    formData.value.tool_id ||
    formData.value.toolLibId ||
    formData.value.tool_lib_id ||
    '',
);
const toolOptions = computed(() => filterTools(tools.value, toolTypes));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(data: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function textValue(value: unknown) {
  return `${value ?? ''}`.trim();
}

function idValue(value: unknown): number | string {
  return typeof value === 'number' || typeof value === 'string' ? value : '';
}

function hasReferenceValue(value: unknown) {
  return Array.isArray(value) ? value.length >= 2 : !!textValue(value);
}

function normalizeField(value: unknown, index: number): ToolInputField {
  const source = isRecord(value) ? cloneDeep(value) : {};
  const fieldSource = source.source === 'custom' ? 'custom' : 'reference';
  let fieldValue: unknown;
  if (fieldSource === 'reference') {
    fieldValue = Array.isArray(source.value) ? cloneDeep(source.value) : [];
  } else {
    fieldValue = source.value === undefined ? '' : cloneDeep(source.value);
  }

  return {
    ...source,
    is_required: source.is_required === true || source.required === true,
    name: textValue(source.name || source.field) || `param_${index + 1}`,
    source: fieldSource,
    type: textValue(source.type) || 'string',
    value: fieldValue,
  };
}

function normalizeNodeData(value: unknown): ToolLibNodeData {
  const source = isRecord(value) ? cloneDeep(value) : {};
  return {
    ...source,
    input: hasOwn(source, 'input')
      ? `${source.input ?? ''}`
      : defaultNodeData.input,
    input_field_list: Array.isArray(source.input_field_list)
      ? source.input_field_list.map((item, index) =>
          normalizeField(item, index),
        )
      : [],
    is_result:
      typeof source.is_result === 'boolean'
        ? source.is_result
        : defaultNodeData.is_result,
    toolId: idValue(source.toolId),
    toolLibId: idValue(source.toolLibId ?? source.tool_lib_id),
    tool_lib_id: idValue(source.tool_lib_id ?? source.toolLibId),
  };
}

function validationError(errMessage: string) {
  return Object.assign(new Error(errMessage), {
    errMessage,
    node: nodeModel,
  });
}

function syncNodeData() {
  const nodeData = cloneDeep(formData.value);
  syncNodeProperties(nodeModel, { node_data: nodeData }, ['node_data']);
  nodeRenderVersion.value += 1;
}

function patchData(key: keyof ToolLibNodeData, value: unknown) {
  set(formData.value, key, cloneDeep(value));
  if (key === 'toolLibId') set(formData.value, 'tool_lib_id', cloneDeep(value));
  if (key === 'tool_lib_id') set(formData.value, 'toolLibId', cloneDeep(value));
  if (key === 'toolId') set(formData.value, 'tool_id', cloneDeep(value));
  if (key === 'tool_id') set(formData.value, 'toolId', cloneDeep(value));
  syncNodeData();
}

function patchNodeData(patch: Partial<ToolLibNodeData>) {
  Object.entries(patch).forEach(([key, value]) => {
    set(formData.value, key, cloneDeep(value));
  });
  if (patch.toolLibId !== undefined)
    set(formData.value, 'tool_lib_id', cloneDeep(patch.toolLibId));
  if (patch.tool_lib_id !== undefined)
    set(formData.value, 'toolLibId', cloneDeep(patch.tool_lib_id));
  if (patch.toolId !== undefined)
    set(formData.value, 'tool_id', cloneDeep(patch.toolId));
  if (patch.tool_id !== undefined)
    set(formData.value, 'toolId', cloneDeep(patch.tool_id));
  syncNodeData();
}

function syncFields(nextFields: ToolInputField[]) {
  patchData('input_field_list', nextFields);
}

function addField() {
  syncFields([
    ...inputFields.value,
    normalizeField(
      {
        field: `param_${inputFields.value.length + 1}`,
        is_required: false,
        name: `param_${inputFields.value.length + 1}`,
        source: 'reference',
        type: 'string',
        value: [],
      },
      inputFields.value.length,
    ),
  ]);
}

function patchField(index: number, patch: Partial<ToolInputField>) {
  syncFields(
    inputFields.value.map((field, fieldIndex) => {
      if (fieldIndex !== index) return field;
      const source = patch.source || field.source;
      let value = patch.value === undefined ? field.value : patch.value;
      if (patch.source && patch.source !== field.source) {
        value = patch.source === 'reference' ? [] : '';
      }
      return normalizeField({ ...field, ...patch, source, value }, index);
    }),
  );
}

function removeField(index: number) {
  syncFields(inputFields.value.filter((_, fieldIndex) => fieldIndex !== index));
}

function patchRequired(index: number, value: boolean | number | string) {
  patchField(index, { is_required: value === true });
}

function labelText(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') return `${value}`;
  if (isRecord(value) && typeof value.label === 'string') return value.label;
  return '';
}

function fieldLabel(field: ToolInputField) {
  return (
    textValue(field.name || field.field) || labelText(field.label) || '参数'
  );
}

async function loadToolOptions() {
  toolLoading.value = true;
  try {
    tools.value = recordsOf(await listTools());
  } catch {
    ElMessage.warning('工具列表加载失败');
  } finally {
    toolLoading.value = false;
  }
}

async function loadToolDetail(id: number | string) {
  const fallback = toolOptions.value.find(
    (record) => `${idOf(record)}` === `${id}`,
  );
  try {
    return recordOf(await getTool(id)) || fallback;
  } catch {
    ElMessage.warning('工具详情加载失败，已保留当前参数');
    return fallback && toolInputFields(fallback).length > 0
      ? fallback
      : undefined;
  }
}

async function selectTool(id?: number | string) {
  if (!id) {
    patchNodeData({
      toolId: '',
      toolLibId: '',
      tool_id: '',
      tool_lib_id: '',
    });
    return;
  }
  const detail = await loadToolDetail(id);
  patchNodeData({
    input_field_list: detail
      ? mergeToolInputFields(
          toolInputFields(detail),
          inputFields.value,
          'reference',
        )
      : inputFields.value,
    toolId: validationShape.hasToolId ? id : formData.value.toolId,
    toolLibId: id,
    tool_id: validationShape.hasToolId ? id : formData.value.tool_id,
    tool_lib_id: id,
    tool_type: detail ? typeOf(detail) : formData.value.tool_type,
  });
}

async function validate() {
  try {
    if (
      (validationShape.hasToolLibId || validationShape.hasToolId) &&
      !textValue(selectedToolId.value)
    ) {
      throw validationError('请选择工具');
    }
    for (const field of inputFields.value) {
      if (!field.is_required || field.source !== 'reference') continue;
      if (!hasReferenceValue(field.value)) {
        throw validationError(`请填写必填参数：${fieldLabel(field)}`);
      }
    }
    await formRef.value?.validate();
  } catch (error) {
    if (error instanceof Error && 'node' in error) throw error;
    throw validationError(
      error instanceof Error ? error.message : `${error || ''}`,
    );
  }
}

onMounted(() => {
  syncNodeData();
  set(nodeModel, 'validate', validate);
  void loadToolOptions();
});

onBeforeUnmount(() => {
  if (nodeModel.validate === validate) {
    set(nodeModel, 'validate', undefined);
  }
});
</script>

<template>
  <NodeContainer
    :node-model="nodeModel"
    :render-version="nodeRenderVersion + (renderVersion || 0)"
  >
    <ElForm
      ref="formRef"
      :model="formData"
      class="workflow-tool-lib-node"
      label-position="top"
      @submit.prevent
    >
      <section class="workflow-tool-lib-node__panel">
        <div class="workflow-tool-lib-node__panel-head">工具设置</div>
        <ElFormItem label="工具" required>
          <ElSelect
            :model-value="selectedToolId"
            clearable
            filterable
            :loading="toolLoading"
            placeholder="请选择工具"
            :teleported="false"
            @update:model-value="selectTool"
          >
            <ElOption
              v-for="record in toolOptions"
              :key="`${idOf(record)}`"
              :label="nameOf(record)"
              :value="idOf(record)"
            >
              <div class="workflow-tool-lib-node__option">
                <span>{{ nameOf(record) }}</span>
                <small>{{
                  descriptionOf(record) || typeOf(record) || idOf(record)
                }}</small>
              </div>
            </ElOption>
          </ElSelect>
        </ElFormItem>
      </section>

      <section class="workflow-tool-lib-node__panel">
        <div class="workflow-tool-lib-node__panel-head">
          <span>输入参数</span>
          <ElButton link type="primary" @click="addField">添加</ElButton>
        </div>
        <div v-if="inputFields.length > 0" class="workflow-tool-lib-node__list">
          <div
            v-for="(field, index) in inputFields"
            :key="`${field.field || field.name || index}`"
            class="workflow-tool-lib-node__field"
          >
            <div class="workflow-tool-lib-node__field-meta">
              <ElInput
                :model-value="field.name || field.field"
                placeholder="参数名"
                @update:model-value="patchField(index, { name: $event })"
              />
              <ElInput
                :model-value="labelText(field.label)"
                placeholder="显示名"
                @update:model-value="patchField(index, { label: $event })"
              />
              <ElSelect
                :model-value="field.type || 'string'"
                :teleported="false"
                @update:model-value="patchField(index, { type: $event })"
              >
                <ElOption label="string" value="string" />
                <ElOption label="int" value="int" />
                <ElOption label="float" value="float" />
                <ElOption label="boolean" value="boolean" />
                <ElOption label="array" value="array" />
                <ElOption label="dict" value="dict" />
              </ElSelect>
              <ElSwitch
                :model-value="!!field.is_required"
                active-text="必填"
                size="small"
                @update:model-value="patchRequired(index, $event)"
              />
              <ElButton link type="danger" @click="removeField(index)">
                删
              </ElButton>
            </div>
            <div class="workflow-tool-lib-node__label-row">
              <span>{{ fieldLabel(field) }}</span>
              <ElTooltip
                v-if="field.desc"
                :content="field.desc"
                placement="right"
              >
                <span class="workflow-tool-lib-node__tip">?</span>
              </ElTooltip>
              <span
                v-if="field.is_required"
                class="workflow-tool-lib-node__required"
              >
                *
              </span>
              <ElTag size="small" type="info">
                {{ field.type || 'string' }}
              </ElTag>
            </div>
            <div class="workflow-tool-lib-node__field-value">
              <ElSelect
                :model-value="field.source || 'reference'"
                :teleported="false"
                @update:model-value="patchField(index, { source: $event })"
              >
                <ElOption label="引用" value="reference" />
                <ElOption label="自定义" value="custom" />
              </ElSelect>
              <NodeCascader
                v-if="(field.source || 'reference') === 'reference'"
                :model-value="Array.isArray(field.value) ? field.value : []"
                :node-model="nodeModel"
                class="w-full"
                placeholder="选择变量"
                @update:model-value="patchField(index, { value: $event })"
              />
              <ElInput
                v-else
                :model-value="textValue(field.value)"
                placeholder="请输入固定值"
                @update:model-value="patchField(index, { value: $event })"
              />
            </div>
          </div>
        </div>
        <ElEmpty
          v-else
          description="暂无输入参数，可手动添加映射"
          :image-size="42"
        />
      </section>

      <section class="workflow-tool-lib-node__panel">
        <div class="workflow-tool-lib-node__switch-row">
          <div>
            <strong>返回内容</strong>
            <small>将本节点结果作为工作流输出内容</small>
          </div>
          <ElSwitch
            :model-value="formData.is_result"
            size="small"
            @update:model-value="patchData('is_result', $event)"
          />
        </div>
      </section>
    </ElForm>
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-tool-lib-node,
.workflow-tool-lib-node__panel,
.workflow-tool-lib-node__list,
.workflow-tool-lib-node__field {
  display: grid;
  gap: 6px;
}

.workflow-tool-lib-node__panel {
  padding: 6px 8px;
  overflow: visible;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-tool-lib-node :deep(.el-form-item) {
  margin-bottom: 6px;
}

.workflow-tool-lib-node :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.workflow-tool-lib-node__panel-head,
.workflow-tool-lib-node__switch-row,
.workflow-tool-lib-node__label-row,
.workflow-tool-lib-node__option {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.workflow-tool-lib-node__switch-row strong,
.workflow-tool-lib-node__switch-row small {
  display: block;
}

.workflow-tool-lib-node__switch-row small {
  margin-top: 1px;
  font-size: 11px;
  font-weight: 400;
  line-height: 14px;
  color: var(--el-text-color-placeholder);
}

.workflow-tool-lib-node__field {
  padding: 8px;
  overflow: visible;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-tool-lib-node__field-meta {
  display: grid;
  grid-template-columns: 1fr 1fr 86px auto auto;
  gap: 6px;
  align-items: center;
}

.workflow-tool-lib-node__field-value {
  display: grid;
  grid-template-columns: 86px 1fr;
  gap: 6px;
}

.workflow-tool-lib-node__label-row {
  justify-content: flex-start;
}

.workflow-tool-lib-node__required {
  color: var(--el-color-danger);
}

.workflow-tool-lib-node__tip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  font-size: 10px;
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 50%;
}

.workflow-tool-lib-node__option {
  min-width: 0;
}

.workflow-tool-lib-node__option span,
.workflow-tool-lib-node__option small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-tool-lib-node__option small {
  color: var(--el-text-color-placeholder);
}
</style>
