<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue';

import {
  ElForm,
  ElFormItem,
  ElInput,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTooltip,
} from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

import { syncNodeProperties } from '../../common/node-inline-update';
import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';

const props = defineProps<{
  nodeModel: any;
  renderVersion?: number;
}>();
type WorkflowMode = 'application' | 'application-loop' | 'tool' | string;
const workflowMode = inject<WorkflowMode>('workflowMode', 'application');

const defaultNodeData = {
  content: '',
  fields: [],
  is_result: true,
  reply_type: 'content',
};

const nodeCascaderRef = ref<InstanceType<typeof NodeCascader>>();
const nodeRenderVersion = ref(0);

function getRenderDependencyKey() {
  return `${props.renderVersion ?? ''}:${nodeRenderVersion.value}`;
}

function createValidationError(errMessage: unknown) {
  return Object.assign(new Error(String(errMessage ?? '')), {
    errMessage,
    node: props.nodeModel,
  });
}

function hasField(data: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function refreshNode() {
  nodeRenderVersion.value += 1;
  syncNodeProperties(
    props.nodeModel,
    { node_data: props.nodeModel.properties.node_data || {} },
    ['node_data'],
  );
}

function ensureNodeData() {
  let changed = false;
  if (!props.nodeModel.properties.node_data) {
    set(props.nodeModel.properties, 'node_data', cloneDeep(defaultNodeData));
    changed = true;
  }

  const data = props.nodeModel.properties.node_data as Record<string, unknown>;
  Object.entries(defaultNodeData).forEach(([key, value]) => {
    if (!hasField(data, key)) {
      set(data, key, cloneDeep(value));
      changed = true;
    }
  });

  if (data.is_result === undefined) {
    set(data, 'is_result', true);
    changed = true;
  }

  if (changed) refreshNode();
}

ensureNodeData();

const formData = computed({
  get: () => {
    getRenderDependencyKey();
    return props.nodeModel.properties.node_data || {};
  },
  set: (value) => {
    set(props.nodeModel.properties, 'node_data', cloneDeep(value));
    refreshNode();
  },
});

const showWorkflowOutputControls = computed(
  () => !`${workflowMode || 'application'}`.includes('knowledge'),
);

function patchData(key: string, value: unknown) {
  set(props.nodeModel.properties.node_data, key, cloneDeep(value));
  refreshNode();
}

function validate() {
  const data = formData.value;
  if (data.reply_type === 'referencing') {
    if (!Array.isArray(data.fields) || data.fields.length < 2) {
      return Promise.reject(createValidationError('请选择引用内容'));
    }
    return (
      nodeCascaderRef.value?.validate?.().catch((error: unknown) => {
        throw createValidationError(error);
      }) || Promise.resolve()
    );
  }

  if (!hasField(data, 'content') || data.content === null) {
    return Promise.reject(createValidationError('请输入回复内容'));
  }
  return Promise.resolve();
}

onMounted(() => {
  ensureNodeData();
  set(props.nodeModel, 'validate', validate);
});
</script>

<template>
  <NodeContainer
    :node-model="nodeModel"
    :render-version="nodeRenderVersion + (renderVersion || 0)"
  >
    <ElForm
      :model="formData"
      class="workflow-reply-node"
      label-position="top"
      @submit.prevent
    >
      <section class="workflow-reply-node__panel">
        <ElFormItem label="回复内容">
          <template #label>
            <div class="workflow-reply-node__form-label">
              <span>回复内容</span>
              <ElSelect
                :model-value="formData.reply_type || 'content'"
                :teleported="false"
                size="small"
                @update:model-value="patchData('reply_type', $event)"
              >
                <ElOption label="引用" value="referencing" />
                <ElOption label="自定义" value="content" />
              </ElSelect>
            </div>
          </template>
          <ElInput
            v-if="(formData.reply_type || 'content') === 'content'"
            :model-value="formData.content"
            type="textarea"
            :rows="5"
            placeholder="支持 {{节点.字段}} 引用，例如 {{start-node.question}}"
            @update:model-value="patchData('content', $event)"
          />
          <NodeCascader
            v-else
            ref="nodeCascaderRef"
            :node-model="nodeModel"
            :model-value="formData.fields || []"
            class="w-full"
            placeholder="选择上游输出"
            @update:model-value="patchData('fields', $event)"
          />
        </ElFormItem>
      </section>

      <section
        v-if="showWorkflowOutputControls"
        class="workflow-reply-node__panel"
      >
        <div class="workflow-reply-node__switch-row">
          <div class="workflow-reply-node__label-with-tip">
            <div>
              <strong>返回内容</strong>
              <small>将本节点回复作为工作流输出内容</small>
            </div>
            <ElTooltip
              content="开启后，本节点回复会作为应用或工作流的最终返回内容。"
              placement="right"
            >
              <span class="workflow-reply-node__tip">?</span>
            </ElTooltip>
          </div>
          <ElSwitch
            :model-value="formData.is_result !== false"
            size="small"
            @update:model-value="patchData('is_result', $event)"
          />
        </div>
      </section>
    </ElForm>
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-reply-node,
.workflow-reply-node__panel {
  display: grid;
  gap: 6px;
}

.workflow-reply-node__panel {
  padding: 6px 8px;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-reply-node :deep(.el-form-item) {
  margin-bottom: 6px;
}

.workflow-reply-node :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.workflow-reply-node :deep(.el-form-item__label) {
  margin-bottom: 3px;
  font-size: 12px;
  line-height: 16px;
}

.workflow-reply-node :deep(.el-input__wrapper) {
  min-height: 28px;
}

.workflow-reply-node :deep(.el-textarea__inner) {
  min-height: 0 !important;
  padding-block: 4px;
  line-height: 18px;
}

.workflow-reply-node__form-label,
.workflow-reply-node__switch-row {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.workflow-reply-node__form-label {
  width: 100%;
}

.workflow-reply-node__form-label .el-select {
  width: 92px;
}

.workflow-reply-node__switch-row strong,
.workflow-reply-node__switch-row small {
  display: block;
}

.workflow-reply-node__switch-row small {
  margin-top: 1px;
  font-size: 11px;
  font-weight: 400;
  line-height: 14px;
  color: var(--el-text-color-placeholder);
}

.workflow-reply-node__label-with-tip {
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
}

.workflow-reply-node__tip {
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
</style>
