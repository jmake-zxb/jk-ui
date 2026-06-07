<script setup lang="ts">
import { computed } from 'vue';

import { ElButton, ElForm, ElFormItem, ElInput } from 'element-plus';

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
const variables = computed(() =>
  Array.isArray(formData.value.variable_list)
    ? formData.value.variable_list
    : [],
);
function patchData(key: string, value: any) {
  formData.value = { ...formData.value, [key]: value };
}
function syncVariables(next: any[]) {
  formData.value = { ...formData.value, variable_list: next };
  props.nodeModel.updateWorkflowProperties?.(
    {
      config: {
        ...props.nodeModel.properties.config,
        fields: next.map((item) => ({
          label: item.label || item.field,
          value: item.field,
        })),
      },
      node_data: formData.value,
    },
    ['node_data', 'config'],
  );
}
function addVariable() {
  syncVariables([
    ...variables.value,
    {
      field: `item_${variables.value.length + 1}`,
      label: `拆分项 ${variables.value.length + 1}`,
    },
  ]);
}
function patchVariable(index: number, patch: Record<string, any>) {
  syncVariables(
    variables.value.map((item: any, itemIndex: number) =>
      itemIndex === index ? { ...item, ...patch } : item,
    ),
  );
}
function removeVariable(index: number) {
  syncVariables(
    variables.value.filter((_: any, itemIndex: number) => itemIndex !== index),
  );
}
</script>

<template>
  <NodeContainer :node-model="nodeModel">
    <ElForm :model="formData" label-position="top" @submit.prevent>
      <ElFormItem label="输入变量">
        <NodeCascader
          :node-model="nodeModel"
          :model-value="formData.input_variable || formData.variable || []"
          class="w-full"
          placeholder="选择待拆分变量"
          @update:model-value="patchData('input_variable', $event)"
        />
      </ElFormItem>
      <ElFormItem label="分隔符">
        <ElInput
          :model-value="formData.separator || '\n'"
          placeholder="例如：换行、逗号"
          @update:model-value="patchData('separator', $event)"
        />
      </ElFormItem>
      <div class="workflow-node-panel">
        <div class="workflow-node-panel__head">
          <span>输出字段</span>
          <ElButton link type="primary" @click="addVariable">添加</ElButton>
        </div>
        <div
          v-for="(item, index) in variables"
          :key="index"
          class="workflow-node-row"
        >
          <ElInput
            :model-value="item.field"
            placeholder="字段名"
            @update:model-value="
              patchVariable(Number(index), { field: $event })
            "
          />
          <ElInput
            :model-value="item.label"
            placeholder="显示名"
            @update:model-value="
              patchVariable(Number(index), { label: $event })
            "
          />
          <ElButton link type="danger" @click="removeVariable(Number(index))">
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
  grid-template-columns: 1fr 1fr auto;
  gap: 6px;
  align-items: center;
}
</style>
