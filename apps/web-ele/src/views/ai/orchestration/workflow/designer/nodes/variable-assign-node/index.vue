<script setup lang="ts">
import { computed, ref } from 'vue';

import {
  ElButton,
  ElForm,
  ElFormItem,
  ElInput,
  ElOption,
  ElSelect,
  ElTag,
} from 'element-plus';

import { syncNodeProperties } from '../../common/node-inline-update';
import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';

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
const variables = computed(() => normalizeVariables());

function normalizeVariables() {
  if (Array.isArray(formData.value.variable_list)) {
    return formData.value.variable_list;
  }
  if (Array.isArray(formData.value.variables)) return formData.value.variables;
  return [];
}

function syncVariables(next: any[]) {
  formData.value = { ...formData.value, variable_list: next, variables: next };
}
function trackRenderVersion(..._versions: unknown[]) {}
function addVariable() {
  syncVariables([
    ...variables.value,
    {
      fields: [],
      id: `var_${Date.now()}`,
      name: '',
      reference: [],
      source: 'custom',
      type: 'string',
      value: '',
    },
  ]);
}
function candidateVariableNodes() {
  const nodes = props.nodeModel.graphModel?.nodes || [];
  const parentNodes = props.nodeModel.graphModel?.get_parent_nodes?.() || [];
  return [...nodes, ...parentNodes];
}
function fieldValue(field: any) {
  return `${field?.value || field?.field || field?.name || ''}`;
}
function fieldLabel(field: any) {
  if (
    typeof field?.label === 'object' &&
    field.label?.input_type === 'TooltipLabel'
  )
    return `${field.label.label || ''}`;
  return `${field?.label || field?.name || fieldValue(field)}`;
}
function resolveVariableName(fields: any[]) {
  const [group, value] = fields || [];
  if (!group || !value) return '';
  for (const node of candidateVariableNodes()) {
    if (node.id === 'start-node') {
      const config = node.properties?.config || {};
      const field = [
        ...(config.globalFields || []),
        ...(config.chatFields || []),
      ].find((item: any) => fieldValue(item) === value);
      if (field) return fieldLabel(field);
    }
    if (node.id === 'loop-start-node') {
      const loopFields =
        node.properties?.loop_input_field_list ||
        node.properties?.node_data?.loop_input_field_list ||
        [];
      const field = loopFields.find((item: any) => fieldValue(item) === value);
      if (field) return fieldLabel(field);
    }
    if (node.id === group) {
      const field = (node.properties?.config?.fields || []).find(
        (item: any) => fieldValue(item) === value,
      );
      if (field) return fieldLabel(field);
    }
  }
  return '';
}
function patchVariable(index: number, patch: Record<string, any>) {
  const normalizedPatch = Array.isArray(patch.fields)
    ? { ...patch, name: resolveVariableName(patch.fields) }
    : patch;
  syncVariables(
    variables.value.map((item: any, itemIndex: number) =>
      itemIndex === index ? { ...item, ...normalizedPatch } : item,
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
  <NodeContainer
    :node-model="nodeModel"
    :render-version="nodeRenderVersion + (renderVersion || 0)"
  >
    <ElForm :model="formData" label-position="top" @submit.prevent>
      <div class="workflow-node-panel">
        <div class="workflow-node-panel__head">
          <span>变量赋值</span>
          <ElButton link type="primary" @click="addVariable">添加</ElButton>
        </div>
        <div
          v-for="(item, index) in variables"
          :key="item.id || index"
          class="workflow-node-card"
        >
          <ElFormItem label="目标变量">
            <NodeCascader
              :node-model="nodeModel"
              :model-value="item.fields || []"
              class="w-full"
              global
              placeholder="选择全局/会话变量"
              @update:model-value="
                patchVariable(Number(index), { fields: $event })
              "
            />
          </ElFormItem>
          <div class="workflow-node-row">
            <ElSelect
              :model-value="item.source || 'custom'"
              :teleported="false"
              @update:model-value="
                patchVariable(Number(index), {
                  source: $event,
                  value: $event === 'referencing' ? [] : '',
                })
              "
            >
              <ElOption label="自定义" value="custom" />
              <ElOption label="引用" value="referencing" />
              <ElOption label="null" value="null" />
            </ElSelect>
            <ElSelect
              v-if="(item.source || 'custom') === 'custom'"
              :model-value="item.type || 'string'"
              :teleported="false"
              @update:model-value="
                patchVariable(Number(index), { type: $event })
              "
            >
              <ElOption label="string" value="string" />
              <ElOption label="num" value="num" />
              <ElOption label="json" value="json" />
              <ElOption label="bool" value="bool" />
            </ElSelect>
            <NodeCascader
              v-if="item.source === 'referencing'"
              :node-model="nodeModel"
              :model-value="item.reference || []"
              placeholder="选择来源变量"
              @update:model-value="
                patchVariable(Number(index), { reference: $event })
              "
            />
            <ElInput
              v-else-if="item.source !== 'null'"
              :model-value="item.value"
              placeholder="赋值内容"
              @update:model-value="
                patchVariable(Number(index), { value: $event })
              "
            />
            <ElTag v-else type="info">null</ElTag>
            <ElButton
              link
              type="danger"
              :disabled="variables.length <= 1"
              @click="removeVariable(Number(index))"
            >
              删
            </ElButton>
          </div>
        </div>
      </div>
      <ElButton
        v-if="variables.length === 0"
        type="primary"
        plain
        @click="addVariable"
      >
        添加变量
      </ElButton>
    </ElForm>
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-node-panel,
.workflow-node-card {
  display: grid;
  gap: 8px;
}

.workflow-node-panel {
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

.workflow-node-card {
  padding: 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-node-row {
  display: grid;
  grid-template-columns: 82px 72px 1fr auto;
  gap: 6px;
  align-items: center;
}
</style>
