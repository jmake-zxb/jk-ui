<script setup lang="ts">
import type { ResourceRecord } from '../../common/tool-resource-utils';

import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue';

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
} from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

import { getToolWorkflow } from '#/api/ai/tool-workflow';
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
  outputConfigFields,
  recordOf,
  recordsOf,
  toolInputFields,
  typeOf,
  workflowGraphOf,
  workflowToolShape,
} from '../../common/tool-resource-utils';

type FieldSource = 'custom' | 'reference';
type WorkflowMode = 'application' | 'application-loop' | 'tool' | string;
type InputField = Record<string, unknown> & {
  field?: string;
  is_required?: boolean;
  label?: string;
  name?: string;
  source: FieldSource;
  type?: string;
  value: unknown;
};
type NodeData = Record<string, unknown> & {
  input_field_list: InputField[];
  input_title?: string;
  is_result: boolean;
  tool_id?: number | string;
  tool_lib_id?: number | string;
  toolId?: number | string;
  toolLibId?: number | string;
  workflow_id?: number | string;
  workflowId?: number | string;
};
type WorkflowNodeModel = {
  clear_next_node_field?: (containSelf?: boolean) => void;
  graphModel?: {
    eventCenter?: {
      emit?: (name: string, payload: Record<string, unknown>) => void;
    };
  };
  id: string;
  properties: Record<string, unknown>;
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
const workflowMode = inject<WorkflowMode>('workflowMode', 'application');
const fieldCascaderRefs = ref<Array<InstanceType<typeof NodeCascader>>>([]);
const tools = ref<ResourceRecord[]>([]);
const toolLoading = ref(false);
const nodeRenderVersion = ref(0);

const formData = ref<NodeData>(
  normalizeNodeData(nodeModel.properties?.node_data),
);
const toolOptions = ref<ResourceRecord[]>([]);
const showWorkflowOutputControls = computed(
  () => !`${workflowMode || 'application'}`.includes('knowledge'),
);

function refreshToolOptions() {
  toolOptions.value = filterTools(tools.value, ['WORKFLOW']);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
function defaultValueForType(type: unknown, source: FieldSource) {
  if (source === 'reference') return [];
  if (`${type}` === 'boolean') return false;
  if (['array', 'dict', 'json', 'object'].includes(`${type}`)) return '';
  return '';
}
function normalizeField(value: unknown, index: number): InputField {
  const source = isRecord(value) ? cloneDeep(value) : {};
  const fieldSource = source.source === 'reference' ? 'reference' : 'custom';
  const type = textValue(source.type) || 'string';
  let fieldValue = cloneDeep(source.value);
  if (source.value === undefined) {
    fieldValue = defaultValueForType(type, fieldSource);
  } else if (fieldSource === 'reference' && !Array.isArray(source.value)) {
    fieldValue = [];
  }

  return {
    ...source,
    field: textValue(source.field || source.name) || `input_${index + 1}`,
    is_required: source.is_required === true || source.required === true,
    label:
      textValue(source.label || source.name || source.field) ||
      `输入 ${index + 1}`,
    name: textValue(source.name || source.field) || `input_${index + 1}`,
    source: fieldSource,
    type,
    value: fieldValue,
  };
}
function normalizeNodeData(value: unknown): NodeData {
  const source = isRecord(value) ? cloneDeep(value) : {};
  return {
    ...source,
    input_field_list: Array.isArray(source.input_field_list)
      ? source.input_field_list.map((item, index) =>
          normalizeField(item, index),
        )
      : [],
    input_title: textValue(source.input_title) || '输入参数',
    is_result: typeof source.is_result === 'boolean' ? source.is_result : true,
    toolId: idValue(source.toolId ?? source.tool_id),
    toolLibId: idValue(source.toolLibId ?? source.tool_lib_id),
    tool_id: idValue(source.tool_id ?? source.toolId),
    tool_lib_id: idValue(source.tool_lib_id ?? source.toolLibId),
    workflowId: idValue(source.workflowId ?? source.workflow_id),
    workflow_id: idValue(source.workflow_id ?? source.workflowId),
  };
}
function validationError(errMessage: string) {
  return Object.assign(new Error(errMessage), { errMessage, node: nodeModel });
}
function syncNodeData(
  patch: Record<string, unknown> = {},
  fields = ['node_data'],
) {
  const nodeData = cloneDeep(formData.value);
  syncNodeProperties(nodeModel, { node_data: nodeData, ...patch }, fields);
  nodeRenderVersion.value += 1;
}
function patchData(key: keyof NodeData, value: unknown) {
  set(formData.value, key, cloneDeep(value));
  if (key === 'toolLibId') set(formData.value, 'tool_lib_id', cloneDeep(value));
  if (key === 'tool_lib_id') set(formData.value, 'toolLibId', cloneDeep(value));
  if (key === 'toolId') set(formData.value, 'tool_id', cloneDeep(value));
  if (key === 'tool_id') set(formData.value, 'toolId', cloneDeep(value));
  if (key === 'workflowId')
    set(formData.value, 'workflow_id', cloneDeep(value));
  if (key === 'workflow_id')
    set(formData.value, 'workflowId', cloneDeep(value));
  syncNodeData();
}
function patchNodeData(
  patch: Partial<NodeData>,
  propertyPatch: Record<string, unknown> = {},
  fields = ['node_data'],
) {
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
  if (patch.workflowId !== undefined)
    set(formData.value, 'workflow_id', cloneDeep(patch.workflowId));
  if (patch.workflow_id !== undefined)
    set(formData.value, 'workflowId', cloneDeep(patch.workflow_id));
  syncNodeData(propertyPatch, fields);
}
function syncFields(nextFields: InputField[]) {
  patchData('input_field_list', nextFields);
}
function addField() {
  syncFields([
    ...formData.value.input_field_list,
    normalizeField({}, formData.value.input_field_list.length),
  ]);
}
function patchField(index: number, patch: Partial<InputField>) {
  syncFields(
    formData.value.input_field_list.map((field, fieldIndex) => {
      if (fieldIndex !== index) return field;
      const source = patch.source || field.source;
      const changedSource = patch.source && patch.source !== field.source;
      let value = patch.value === undefined ? field.value : patch.value;
      if (changedSource) {
        value = defaultValueForType(field.type, source);
      }
      return normalizeField(
        {
          ...field,
          ...patch,
          source,
          value,
        },
        index,
      );
    }),
  );
}
function removeField(index: number) {
  syncFields(
    formData.value.input_field_list.filter(
      (_, fieldIndex) => fieldIndex !== index,
    ),
  );
}
function patchRequired(index: number, value: boolean | number | string) {
  patchField(index, { is_required: value === true });
}
function fieldLabel(field: InputField) {
  return textValue(field.label || field.name || field.field) || '输入参数';
}
function selectedToolId() {
  return (
    formData.value.tool_lib_id ||
    formData.value.toolLibId ||
    formData.value.tool_id ||
    formData.value.toolId ||
    ''
  );
}
async function loadToolOptions() {
  toolLoading.value = true;
  try {
    tools.value = recordsOf(await listTools());
    refreshToolOptions();
  } catch {
    ElMessage.warning('工作流工具列表加载失败');
  } finally {
    toolLoading.value = false;
  }
}
async function loadToolDetail(id: number | string) {
  const fallback = toolOptions.value.find(
    (record) => `${idOf(record)}` === `${id}`,
  );
  try {
    const detail = recordOf(await getTool(id)) || fallback;
    if (detail && workflowGraphOf(detail)) return detail;
    try {
      const workflow = recordOf(await getToolWorkflow(id)) || {};
      return { ...(detail || fallback), work_flow: workflow };
    } catch {
      ElMessage.warning('工作流配置加载失败，已保留当前参数');
      return fallback && workflowGraphOf(fallback) ? fallback : undefined;
    }
  } catch {
    ElMessage.warning('工作流工具详情加载失败，已保留当前参数');
    return fallback && workflowGraphOf(fallback) ? fallback : undefined;
  }
}
async function selectTool(id?: number | string) {
  if (!id) {
    patchNodeData({
      input_field_list: [],
      toolId: '',
      toolLibId: '',
      tool_id: '',
      tool_lib_id: '',
      workflowId: '',
      workflow_id: '',
    });
    return;
  }
  const detail = await loadToolDetail(id);
  if (!detail) {
    patchNodeData({
      toolId: id,
      toolLibId: id,
      tool_id: id,
      tool_lib_id: id,
      workflowId: '',
      workflow_id: '',
    });
    return;
  }
  const shape = detail
    ? workflowToolShape(detail)
    : {
        inputFields: [],
        inputTitle: '输入参数',
        outputFields: [],
        outputTitle: '输出参数',
      };
  let sourceInputFields: ResourceRecord[] = [];
  if (shape.inputFields.length > 0 && detail) {
    sourceInputFields = shape.inputFields;
  } else if (detail) {
    sourceInputFields = toolInputFields(detail);
  }
  const config = {
    ...(isRecord(nodeModel.properties?.config)
      ? nodeModel.properties.config
      : {}),
    fields: outputConfigFields(shape.outputFields),
    output_title: shape.outputTitle,
  };
  patchNodeData(
    {
      input_field_list: mergeToolInputFields(
        sourceInputFields,
        formData.value.input_field_list,
        'custom',
      ) as InputField[],
      input_title: shape.inputTitle,
      toolId: id,
      toolLibId: id,
      tool_id: id,
      tool_lib_id: id,
      tool_type: detail ? typeOf(detail) : formData.value.tool_type,
      workflowId: '',
      workflow_id: '',
    },
    { config },
    ['node_data', 'config'],
  );
  nodeModel.clear_next_node_field?.(true);
}
async function validate() {
  try {
    if (!textValue(selectedToolId())) throw validationError('请选择工作流工具');
    for (const [index, field] of formData.value.input_field_list.entries()) {
      if (!field.is_required) continue;
      if (!hasReferenceValue(field.value))
        throw validationError(`请填写必填参数：${fieldLabel(field)}`);
      if (field.source === 'reference')
        await fieldCascaderRefs.value[index]?.validate?.();
    }
  } catch (error) {
    if (error instanceof Error && 'node' in error) throw error;
    throw validationError(
      error instanceof Error ? error.message : `${error || ''}`,
    );
  }
}
onMounted(() => {
  refreshToolOptions();
  syncNodeData();
  set(nodeModel, 'validate', validate);
  void loadToolOptions();
});
onBeforeUnmount(() => {
  if (nodeModel.validate === validate) set(nodeModel, 'validate', undefined);
});
</script>

<template>
  <NodeContainer
    :node-model="nodeModel"
    :render-version="nodeRenderVersion + (renderVersion || 0)"
  >
    <ElForm
      :model="formData"
      class="workflow-tool-workflow-lib-node"
      label-position="top"
      @submit.prevent
    >
      <section class="workflow-tool-workflow-lib-node__panel">
        <div class="workflow-tool-workflow-lib-node__panel-head">
          工作流工具设置
        </div>
        <ElFormItem label="工作流工具" required>
          <ElSelect
            :model-value="selectedToolId()"
            clearable
            filterable
            :loading="toolLoading"
            placeholder="请选择工作流工具"
            :teleported="false"
            @update:model-value="selectTool"
          >
            <ElOption
              v-for="record in toolOptions"
              :key="`${idOf(record)}`"
              :label="nameOf(record)"
              :value="idOf(record)"
            >
              <div class="workflow-tool-workflow-lib-node__option">
                <span>{{ nameOf(record) }}</span>
                <small>{{
                  descriptionOf(record) || typeOf(record) || idOf(record)
                }}</small>
              </div>
            </ElOption>
          </ElSelect>
        </ElFormItem>
      </section>

      <section class="workflow-tool-workflow-lib-node__panel">
        <div class="workflow-tool-workflow-lib-node__panel-head">
          <span>{{ formData.input_title || '输入参数' }}</span>
          <ElButton link type="primary" @click="addField">添加</ElButton>
        </div>
        <div
          v-if="formData.input_field_list.length > 0"
          class="workflow-tool-workflow-lib-node__list"
        >
          <div
            v-for="(field, index) in formData.input_field_list"
            :key="`${field.field || field.name || index}`"
            class="workflow-tool-workflow-lib-node__field"
          >
            <div class="workflow-tool-workflow-lib-node__field-meta">
              <ElInput
                :model-value="field.field || field.name"
                placeholder="字段名"
                @update:model-value="patchField(index, { field: $event })"
              />
              <ElInput
                :model-value="field.label"
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
            <div class="workflow-tool-workflow-lib-node__field-value">
              <ElSelect
                :model-value="field.source || 'custom'"
                :teleported="false"
                @update:model-value="patchField(index, { source: $event })"
              >
                <ElOption label="引用" value="reference" />
                <ElOption label="自定义" value="custom" />
              </ElSelect>
              <NodeCascader
                v-if="field.source === 'reference'"
                :ref="
                  (el) => {
                    if (el)
                      fieldCascaderRefs[index] = el as InstanceType<
                        typeof NodeCascader
                      >;
                  }
                "
                :model-value="Array.isArray(field.value) ? field.value : []"
                :node-model="nodeModel"
                class="w-full"
                placeholder="选择变量"
                @update:model-value="patchField(index, { value: $event })"
              />
              <ElSwitch
                v-else-if="field.type === 'boolean'"
                :model-value="field.value === true"
                size="small"
                @update:model-value="patchField(index, { value: $event })"
              />
              <ElInput
                v-else
                :model-value="textValue(field.value)"
                :type="
                  ['array', 'dict'].includes(`${field.type}`)
                    ? 'textarea'
                    : 'text'
                "
                :rows="2"
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

      <section
        v-if="showWorkflowOutputControls"
        class="workflow-tool-workflow-lib-node__panel"
      >
        <div class="workflow-tool-workflow-lib-node__switch-row">
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
.workflow-tool-workflow-lib-node,
.workflow-tool-workflow-lib-node__panel,
.workflow-tool-workflow-lib-node__list,
.workflow-tool-workflow-lib-node__field {
  display: grid;
  gap: 6px;
}

.workflow-tool-workflow-lib-node__panel {
  padding: 6px 8px;
  overflow: visible;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-tool-workflow-lib-node :deep(.el-form-item) {
  margin-bottom: 6px;
}

.workflow-tool-workflow-lib-node :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.workflow-tool-workflow-lib-node__panel-head,
.workflow-tool-workflow-lib-node__switch-row,
.workflow-tool-workflow-lib-node__option {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.workflow-tool-workflow-lib-node__switch-row strong,
.workflow-tool-workflow-lib-node__switch-row small {
  display: block;
}

.workflow-tool-workflow-lib-node__switch-row small {
  margin-top: 1px;
  font-size: 11px;
  font-weight: 400;
  line-height: 14px;
  color: var(--el-text-color-placeholder);
}

.workflow-tool-workflow-lib-node__field {
  padding: 8px;
  overflow: visible;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-tool-workflow-lib-node__field-meta {
  display: grid;
  grid-template-columns: 1fr 1fr 86px auto auto;
  gap: 6px;
  align-items: center;
}

.workflow-tool-workflow-lib-node__field-value {
  display: grid;
  grid-template-columns: 86px 1fr;
  gap: 6px;
}

.workflow-tool-workflow-lib-node__option {
  justify-content: flex-start;
}

.workflow-tool-workflow-lib-node__option span,
.workflow-tool-workflow-lib-node__option small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-tool-workflow-lib-node__option small {
  color: var(--el-text-color-placeholder);
}
</style>
