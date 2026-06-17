<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

import {
  ElEmpty,
  ElForm,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

import { syncNodeProperties } from '../../common/node-inline-update';
import NodeContainer from '../../common/NodeContainer.vue';

type ToolInputField = {
  field?: string;
  is_required?: boolean;
  label?: string;
  name?: string;
  type?: string;
  value?: unknown;
};

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

const inputFields = computed(() => reflectedInputFields());

function normalizeInputFields(source: any): ToolInputField[] {
  if (Array.isArray(source?.input_field_list)) {
    return source.input_field_list;
  }
  if (Array.isArray(source?.inputFields)) {
    return source.inputFields;
  }
  return [];
}

function toolBaseNodeData() {
  const toolBaseNode =
    props.nodeModel.graphModel?.getNodeModelById?.('tool-base-node');
  return toolBaseNode?.properties?.node_data || {};
}

function reflectedInputFields() {
  trackRenderVersion(nodeRenderVersion.value);
  const baseInputFields = normalizeInputFields(toolBaseNodeData());
  if (baseInputFields.length > 0) return baseInputFields;
  return normalizeInputFields(formData.value);
}

function fieldValue(field: ToolInputField) {
  return `${field.field || field.name || field.value || ''}`.trim();
}

function fieldLabel(field: ToolInputField) {
  return `${field.label || field.name || fieldValue(field)}`;
}

function globalFieldList() {
  return reflectedInputFields()
    .map((field) => ({
      label: fieldLabel(field),
      type: field.type || 'string',
      value: fieldValue(field),
    }))
    .filter((field) => field.value);
}

function ensureConfig() {
  if (!props.nodeModel.properties.config) {
    set(props.nodeModel.properties, 'config', {
      chatFields: [],
      fields: [],
      globalFields: [],
    });
  }
}

function refreshFieldList() {
  ensureConfig();
  set(
    props.nodeModel.properties.config,
    'globalFields',
    cloneDeep(globalFieldList()),
  );
  nodeRenderVersion.value += 1;
  props.nodeModel.refreshVueComponent?.();
  nextTick(() => props.nodeModel.queueNodeResize?.());
}

function trackRenderVersion(..._versions: unknown[]) {}

props.nodeModel.graphModel?.eventCenter?.on?.(
  'refreshFieldList',
  refreshFieldList,
);

onMounted(refreshFieldList);

onBeforeUnmount(() => {
  props.nodeModel.graphModel?.eventCenter?.off?.(
    'refreshFieldList',
    refreshFieldList,
  );
});
</script>

<template>
  <NodeContainer
    :node-model="nodeModel"
    :render-version="nodeRenderVersion + (renderVersion || 0)"
  >
    <ElForm :model="formData" label-position="top" @submit.prevent>
      <div class="workflow-node-panel">
        <div class="workflow-node-panel__head">
          <span>工具输入字段</span>
          <span class="workflow-node-panel__hint">由工具基础节点定义</span>
        </div>
        <ElTable
          v-if="inputFields.length > 0"
          :data="inputFields"
          class="workflow-tool-start-table"
          row-key="field"
          size="small"
        >
          <ElTableColumn label="字段" min-width="110">
            <template #default="{ row }">
              <span
                class="workflow-tool-start-table__cell"
                :title="fieldValue(row)"
              >
                {{ fieldValue(row) }}
              </span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="名称" min-width="110">
            <template #default="{ row }">
              <span
                class="workflow-tool-start-table__cell"
                :title="fieldLabel(row)"
              >
                {{ fieldLabel(row) }}
              </span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="类型" width="86">
            <template #default="{ row }">
              <ElTag size="small" type="info">{{ row.type || 'string' }}</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="必填" width="64">
            <template #default="{ row }">
              <ElSwitch
                :model-value="!!row.is_required"
                disabled
                size="small"
              />
            </template>
          </ElTableColumn>
        </ElTable>
        <ElEmpty v-else description="暂无工具输入字段" :image-size="42" />
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

.workflow-node-panel__hint {
  font-weight: 400;
  color: var(--el-text-color-placeholder);
}

.workflow-tool-start-table__cell {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-node-panel :deep(.el-table__cell) {
  padding: 2px 0;
}
</style>
