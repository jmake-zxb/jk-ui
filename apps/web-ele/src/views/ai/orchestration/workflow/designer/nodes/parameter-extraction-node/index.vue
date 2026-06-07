<script setup lang="ts">
import { computed } from 'vue';

import {
  ElButton,
  ElForm,
  ElFormItem,
  ElInput,
  ElOption,
  ElSelect,
  ElSwitch,
} from 'element-plus';

import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';

const props = defineProps<{ nodeModel: any }>();
const formData = computed({
  get: () => props.nodeModel.properties.node_data || {},
  set: (value) =>
    props.nodeModel.updateWorkflowProperties?.({ node_data: value }, [
      'node_data',
    ]),
});
const fields = computed(() => normalizeFields());

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
function syncFields(next: any[]) {
  formData.value = { ...formData.value, fields: next, variable_list: next };
  props.nodeModel.updateWorkflowProperties?.(
    {
      config: {
        ...props.nodeModel.properties.config,
        fields: next.map((item) => ({
          label: item.label || item.field,
          type: item.type || 'string',
          value: item.field,
        })),
      },
      node_data: formData.value,
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
      required: false,
      type: 'string',
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
</script>

<template>
  <NodeContainer :node-model="nodeModel">
    <ElForm :model="formData" label-position="top" @submit.prevent>
      <ElFormItem label="模型">
        <div class="workflow-node-row is-model">
          <ElSelect
            :model-value="formData.model_id_type || 'custom'"
            :teleported="false"
            @update:model-value="patchData('model_id_type', $event)"
          >
            <ElOption label="自定义" value="custom" /><ElOption
              label="引用"
              value="reference"
            />
          </ElSelect>
          <ElInput
            v-if="(formData.model_id_type || 'custom') === 'custom'"
            :model-value="formData.model_id"
            placeholder="LLM 模型 ID"
            @update:model-value="patchData('model_id', $event)"
          />
          <NodeCascader
            v-else
            :node-model="nodeModel"
            :model-value="formData.model_id_reference || []"
            placeholder="选择模型变量"
            @update:model-value="patchData('model_id_reference', $event)"
          />
        </div>
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
            :model-value="field.type || 'string'"
            :teleported="false"
            @update:model-value="patchField(Number(index), { type: $event })"
          >
            <ElOption label="string" value="string" />
            <ElOption label="number" value="number" />
            <ElOption label="boolean" value="boolean" />
            <ElOption label="array" value="array" />
            <ElOption label="object" value="object" />
          </ElSelect>
          <ElSwitch
            :model-value="!!field.required"
            size="small"
            active-text="必填"
            @update:model-value="
              patchField(Number(index), { required: $event })
            "
          />
          <ElButton link type="danger" @click="removeField(Number(index))">
            删
          </ElButton>
        </div>
      </div>
    </ElForm>
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
  grid-template-columns: 76px 1fr 82px auto auto;
  gap: 6px;
  align-items: center;
}

.workflow-node-row.is-model {
  grid-template-columns: 86px 1fr;
}
</style>
