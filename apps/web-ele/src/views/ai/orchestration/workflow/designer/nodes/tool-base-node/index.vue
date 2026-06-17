<script setup lang="ts">
import { computed, ref } from 'vue';

import { ElForm, ElFormItem, ElInput } from 'element-plus';
import { cloneDeep } from 'lodash-es';

import { syncNodeProperties } from '../../common/node-inline-update';
import NodeContainer from '../../common/NodeContainer.vue';
import ToolFieldTable from './component/ToolFieldTable.vue';

const props = defineProps<{ nodeModel: any; renderVersion?: number }>();
const nodeRenderVersion = ref(0);

const formData = computed({
  get: () => {
    trackRenderVersion(props.renderVersion, nodeRenderVersion.value);
    return props.nodeModel.properties.node_data || {};
  },
  set: (value) => {
    syncNodeProperties(props.nodeModel, { node_data: value }, ['node_data']);
    nodeRenderVersion.value += 1;
  },
});

const inputFields = computed(() => normalizeInputFields());
const outputFields = computed(() => normalizeOutputFields());

function normalizeInputFields() {
  if (Array.isArray(formData.value.input_field_list)) {
    return formData.value.input_field_list;
  }
  if (Array.isArray(formData.value.inputFields)) {
    return formData.value.inputFields;
  }
  return [];
}

function normalizeOutputFields() {
  if (Array.isArray(formData.value.output_field_list)) {
    return formData.value.output_field_list;
  }
  if (Array.isArray(formData.value.outputFields)) {
    return formData.value.outputFields;
  }
  return [];
}

function patchData(key: string, value: any) {
  formData.value = { ...formData.value, [key]: cloneDeep(value) };
}

function trackRenderVersion(..._versions: unknown[]) {}

function refreshToolStartNode() {
  props.nodeModel.graphModel?.eventCenter?.emit?.('refreshFieldList');
  props.nodeModel.graphModel
    ?.getNodeModelById?.('tool-start-node')
    ?.clear_next_node_field?.(true);
}

function syncInputFields(nextFields: any[]) {
  patchData('input_field_list', nextFields);
  refreshToolStartNode();
}

function syncOutputFields(nextFields: any[]) {
  patchData('output_field_list', nextFields);
  refreshToolStartNode();
}
</script>

<template>
  <NodeContainer
    :node-model="nodeModel"
    :render-version="nodeRenderVersion + (renderVersion || 0)"
  >
    <ElForm :model="formData" label-position="top" @submit.prevent>
      <div class="workflow-node-panel">
        <div class="workflow-node-panel__head">工具元数据</div>
        <ElFormItem label="工具名称" required>
          <ElInput
            :model-value="formData.tool_name || formData.name"
            placeholder="工具名称"
            @update:model-value="patchData('tool_name', $event)"
          />
        </ElFormItem>
        <ElFormItem label="工具描述">
          <ElInput
            :model-value="formData.tool_desc || formData.description"
            type="textarea"
            :rows="3"
            placeholder="说明工具用途和调用约束"
            @update:model-value="patchData('tool_desc', $event)"
          />
        </ElFormItem>
      </div>
      <div class="workflow-node-panel">
        <ToolFieldTable
          :fields="inputFields"
          kind="input"
          :node-model="nodeModel"
          @update="syncInputFields"
        />
      </div>
      <div class="workflow-node-panel">
        <ToolFieldTable
          :fields="outputFields"
          kind="output"
          :node-model="nodeModel"
          @update="syncOutputFields"
        />
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
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}
</style>
