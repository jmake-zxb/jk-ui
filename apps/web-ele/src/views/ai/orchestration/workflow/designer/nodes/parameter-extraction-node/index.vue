<script setup lang="ts">
import { computed, ref } from 'vue';

import { Operation } from '@element-plus/icons-vue';
import {
  ElButton,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElOption,
  ElSelect,
} from 'element-plus';

import ModelParamSettingDialog from '../../../../applications/ModelParamSettingDialog.vue';
import { syncNodeProperties } from '../../common/node-inline-update';
import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';
import LocalModelSelect from '../base-node/component/LocalModelSelect.vue';

const props = defineProps<{ nodeModel: any; renderVersion?: number }>();
const nodeModelForValidation = props.nodeModel;
const nodeRenderVersion = ref(0);
const modelParamOpen = ref(false);
const formData = computed({
  get: () => {
    trackRenderVersion(props.renderVersion, nodeRenderVersion.value);
    return props.nodeModel.properties.node_data || {};
  },
  set: (value) => syncNodeData(value),
});
const fields = computed(() => normalizeFields());
const resolvedModelId = computed(() => {
  const value = formData.value.model_id;
  return typeof value === 'number' || typeof value === 'string' ? value : '';
});
const modelParamSetting = computed(() =>
  formData.value.model_params_setting &&
  typeof formData.value.model_params_setting === 'object'
    ? formData.value.model_params_setting
    : {},
);
const modelParamsSummary = computed(() => {
  const count = Object.keys(modelParamSetting.value).length;
  return count ? `${count} 项` : '默认参数';
});

function normalizeFields() {
  if (Array.isArray(formData.value.variable_list)) {
    return formData.value.variable_list;
  }
  if (Array.isArray(formData.value.fields)) return formData.value.fields;
  return [];
}

function patchData(key: string, value: any) {
  formData.value = { ...formData.value, [key]: value };
}
function patchModelType(value: string) {
  formData.value = {
    ...formData.value,
    model_id_reference: [],
    model_id_type: value,
  };
}
function patchModelId(value: number | string | undefined) {
  const previousModelId = formData.value.model_id;
  const nextData = { ...formData.value, model_id: value || '' };
  if (!value || previousModelId !== value) nextData.model_params_setting = {};
  formData.value = nextData;
}
function syncNodeData(
  nodeData: Record<string, unknown>,
  patch: Record<string, unknown> = {},
  fields = ['node_data'],
) {
  syncNodeProperties(
    props.nodeModel,
    { node_data: nodeData, ...patch },
    fields,
  );
  nodeRenderVersion.value += 1;
}
function trackRenderVersion(..._versions: unknown[]) {}
function syncFields(next: any[]) {
  const normalized = next.map((item) => ({
    desc: item.desc || '',
    field: item.field,
    label: item.label,
    parameter_type: item.parameter_type || item.type || 'string',
  }));
  const nodeData = { ...formData.value, variable_list: normalized };
  syncNodeData(
    nodeData,
    {
      config: {
        ...props.nodeModel.properties.config,
        fields: [
          { label: '结果', type: 'object', value: 'result' },
          ...normalized.map((item) => ({
            label: item.label || item.field,
            type: item.parameter_type || 'string',
            value: item.field,
          })),
        ],
      },
    },
    ['node_data', 'config'],
  );
}
function addField() {
  syncFields([
    ...fields.value,
    {
      desc: '',
      field: `param_${fields.value.length + 1}`,
      label: `参数 ${fields.value.length + 1}`,
      parameter_type: 'string',
    },
  ]);
}
function patchField(index: number, patch: Record<string, any>) {
  syncFields(
    fields.value.map((item: any, itemIndex: number) =>
      itemIndex === index ? { ...item, ...patch } : item,
    ),
  );
}
function removeField(index: number) {
  syncFields(
    fields.value.filter((_: any, itemIndex: number) => itemIndex !== index),
  );
}

function openModelParamDialog() {
  modelParamOpen.value = true;
}

function refreshModelParams(value: Record<string, unknown>) {
  patchData('model_params_setting', value);
}

function validateFields() {
  const names = fields.value.map((item: any) => `${item.field || ''}`.trim());
  if (names.some((name: string) => !name)) throw new Error('字段不能为空');
  if (names.some((name: string) => !/^\w+$/.test(name))) {
    throw new Error('字段只能包含字母、数字和下划线');
  }
  if (new Set(names).size !== names.length) throw new Error('字段不能重复');
  if (fields.value.some((item: any) => !`${item.label || ''}`.trim())) {
    throw new Error('名称不能为空');
  }
}

async function validate() {
  validateFields();
  return true;
}

nodeModelForValidation.validate = validate;
</script>

<template>
  <NodeContainer
    :node-model="nodeModel"
    :render-version="nodeRenderVersion + (renderVersion || 0)"
  >
    <ElForm :model="formData" label-position="top" @submit.prevent>
      <ElFormItem label="模型">
        <div class="workflow-node-row is-model">
          <ElSelect
            :model-value="formData.model_id_type || 'custom'"
            :teleported="false"
            @update:model-value="patchModelType(`${$event}`)"
          >
            <ElOption label="自定义" value="custom" /><ElOption
              label="引用"
              value="reference"
            />
          </ElSelect>
          <LocalModelSelect
            v-if="(formData.model_id_type || 'custom') === 'custom'"
            :model-value="formData.model_id"
            model-type="LLM"
            placeholder="请选择模型"
            show-footer
            @update:model-value="patchModelId"
          />
          <NodeCascader
            v-else
            :node-model="nodeModel"
            :model-value="formData.model_id_reference || []"
            placeholder="选择模型变量"
            @update:model-value="patchData('model_id_reference', $event)"
          />
          <ElButton
            :disabled="
              (formData.model_id_type || 'custom') !== 'custom' ||
              !resolvedModelId
            "
            size="small"
            @click="openModelParamDialog"
          >
            <ElIcon><Operation /></ElIcon>
          </ElButton>
        </div>
      </ElFormItem>
      <ElFormItem label="模型参数">
        <ElInput :model-value="modelParamsSummary" disabled />
      </ElFormItem>
      <ElFormItem label="输入文本">
        <NodeCascader
          :node-model="nodeModel"
          :model-value="formData.input_variable || formData.textRef || []"
          class="w-full"
          placeholder="选择文本变量"
          @update:model-value="patchData('input_variable', $event)"
        />
      </ElFormItem>
      <div class="workflow-node-panel">
        <div class="workflow-node-panel__head">
          <span>提取字段</span>
          <ElButton link type="primary" @click="addField">添加</ElButton>
        </div>
        <div
          v-for="(field, index) in fields"
          :key="index"
          class="workflow-node-row"
        >
          <ElInput
            :model-value="field.field"
            placeholder="字段名"
            @update:model-value="patchField(Number(index), { field: $event })"
          />
          <ElInput
            :model-value="field.label"
            placeholder="显示名"
            @update:model-value="patchField(Number(index), { label: $event })"
          />
          <ElSelect
            :model-value="field.parameter_type || field.type || 'string'"
            :teleported="false"
            @update:model-value="
              patchField(Number(index), { parameter_type: $event })
            "
          >
            <ElOption label="string" value="string" />
            <ElOption label="number" value="number" />
            <ElOption label="boolean" value="boolean" />
            <ElOption label="array" value="array" />
            <ElOption label="object" value="object" />
          </ElSelect>
          <ElInput
            :model-value="field.desc"
            placeholder="描述"
            @update:model-value="patchField(Number(index), { desc: $event })"
          />
          <ElButton link type="danger" @click="removeField(Number(index))">
            删
          </ElButton>
        </div>
      </div>
    </ElForm>
    <ModelParamSettingDialog
      v-model="modelParamOpen"
      :model-id="resolvedModelId"
      :setting="modelParamSetting"
      @refresh="refreshModelParams"
    />
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-node-panel {
  display: grid;
  gap: 8px;
  padding: 8px;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-node-panel__head {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.workflow-node-row {
  display: grid;
  grid-template-columns: 76px 1fr 82px 1fr auto;
  gap: 6px;
  align-items: center;
}

.workflow-node-row.is-model {
  grid-template-columns: 86px 1fr auto;
}
</style>
