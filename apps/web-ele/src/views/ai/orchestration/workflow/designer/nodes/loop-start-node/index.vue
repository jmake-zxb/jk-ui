<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';

import { CopyDocument } from '@element-plus/icons-vue';
import { ElIcon, ElTooltip } from 'element-plus';
import { cloneDeep } from 'lodash-es';

import NodeContainer from '../../common/NodeContainer.vue';
import LoopFieldTable from './component/LoopFieldTable.vue';

type LoopField = {
  field?: string;
  label?: string | { input_type?: string; label?: string };
  name?: string;
  type?: string;
  value?: string;
  variable?: string;
};

const props = defineProps<{
  nodeModel: any;
  renderVersion?: number;
}>();

function trackRenderVersion() {
  return props.renderVersion;
}

const loopInputFields = computed(() => {
  trackRenderVersion();
  const nodeData = props.nodeModel.properties?.node_data || {};
  const fields = resolveLoopInputFields(nodeData);
  return fields
    .map((field: LoopField) => {
      const value =
        `${field.field || field.variable || field.value || field.name || ''}`.trim();
      const label = resolveLoopFieldLabel(field);
      return {
        label: `${label || field.name || value}`,
        type: field.type || 'string',
        value,
      };
    })
    .filter((field: { value: string }) => field.value);
});

function resolveLoopInputFields(nodeData: Record<string, any>) {
  if (Array.isArray(props.nodeModel.properties?.loop_input_field_list)) {
    return props.nodeModel.properties.loop_input_field_list;
  }
  if (Array.isArray(nodeData.loop_input_field_list)) {
    return nodeData.loop_input_field_list;
  }
  return [];
}

function resolveLoopFieldLabel(field: LoopField) {
  if (
    typeof field.label === 'object' &&
    field.label?.input_type === 'TooltipLabel'
  ) {
    return field.label.label;
  }
  return field.label;
}

function syncLoopFields() {
  props.nodeModel.graphModel?.refresh_loop_fields?.(
    cloneDeep(loopInputFields.value),
  );
}

function copyLoopField(field: { value: string }) {
  navigator.clipboard?.writeText(`{{loop.${field.value}}}`);
}

function fieldToken(value: string) {
  return `{${value}}`;
}

watch(loopInputFields, syncLoopFields, { deep: true });

onMounted(syncLoopFields);
</script>

<template>
  <NodeContainer :node-model="nodeModel" :render-version="renderVersion">
    <h5 class="loop-start-title">节点设置</h5>
    <LoopFieldTable :node-model="nodeModel" />
    <template v-if="loopInputFields.length > 0">
      <h5 class="loop-start-title">循环变量</h5>
      <div class="loop-start-fields">
        <button
          v-for="field in loopInputFields"
          :key="field.value"
          class="loop-start-field"
          type="button"
          @click="copyLoopField(field)"
        >
          <span>{{ field.label }} {{ fieldToken(field.value) }}</span>
          <ElTooltip content="复制参数" placement="top">
            <ElIcon><CopyDocument /></ElIcon>
          </ElTooltip>
        </button>
      </div>
    </template>
  </NodeContainer>
</template>

<style scoped lang="scss">
.loop-start-title {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.loop-start-fields {
  display: grid;
  gap: 8px;
}

.loop-start-field {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: left;
  cursor: pointer;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.loop-start-field span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loop-start-field .el-icon {
  flex-shrink: 0;
  color: var(--el-color-primary);
}
</style>
