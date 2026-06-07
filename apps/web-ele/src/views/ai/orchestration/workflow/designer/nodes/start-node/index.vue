<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted } from 'vue';

import { CopyDocument } from '@element-plus/icons-vue';
import { ElIcon, ElMessage, ElTooltip } from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

import NodeContainer from '../../common/NodeContainer.vue';
import {
  clearStartNodeDerivedFieldCaches,
  ensureStartNodeProperties,
  fieldValue,
  getChatFieldList,
  getGlobalFieldList,
  getStartNodeFields,
} from './start-node-utils';

const props = defineProps<{ nodeModel: any; renderVersion?: number }>();

async function copyVariable(text: string) {
  await navigator.clipboard?.writeText(text);
  ElMessage.success('已复制变量');
}

function displayVariable(field: Parameters<typeof fieldValue>[0]) {
  return `{${fieldValue(field)}}`;
}

function refreshStartNodeView() {
  clearStartNodeDerivedFieldCaches(props.nodeModel);
  props.nodeModel.refreshAnchors?.();
  props.nodeModel.refreshConnectedEdges?.();
  props.nodeModel.refreshVueComponent?.();
  nextTick(() => props.nodeModel.queueNodeResize?.());
}

function refreshFieldList() {
  ensureStartNodeProperties(props.nodeModel);
  set(
    props.nodeModel.properties.config,
    'globalFields',
    cloneDeep(getGlobalFieldList(props.nodeModel)),
  );
  set(
    props.nodeModel.properties.config,
    'fields',
    cloneDeep(getStartNodeFields(props.nodeModel)),
  );
  refreshStartNodeView();
}

function refreshChatFieldList() {
  ensureStartNodeProperties(props.nodeModel);
  set(
    props.nodeModel.properties.config,
    'chatFields',
    cloneDeep(getChatFieldList(props.nodeModel)),
  );
  set(
    props.nodeModel.properties.config,
    'fields',
    cloneDeep(getStartNodeFields(props.nodeModel)),
  );
  refreshStartNodeView();
}

function refreshFileUploadConfig() {
  ensureStartNodeProperties(props.nodeModel);
  set(
    props.nodeModel.properties.config,
    'fields',
    cloneDeep(getStartNodeFields(props.nodeModel)),
  );
  refreshStartNodeView();
}

function refreshLongTermConfig() {
  ensureStartNodeProperties(props.nodeModel);
  set(
    props.nodeModel.properties.config,
    'fields',
    cloneDeep(getStartNodeFields(props.nodeModel)),
  );
  refreshStartNodeView();
}

props.nodeModel.graphModel?.eventCenter?.on?.(
  'refreshFieldList',
  refreshFieldList,
);
props.nodeModel.graphModel?.eventCenter?.on?.(
  'chatFieldList',
  refreshChatFieldList,
);
props.nodeModel.graphModel?.eventCenter?.on?.(
  'refreshFileUploadConfig',
  refreshFileUploadConfig,
);
props.nodeModel.graphModel?.eventCenter?.on?.(
  'refreshLongTermConfig',
  refreshLongTermConfig,
);

onMounted(() => {
  refreshChatFieldList();
  refreshFieldList();
  refreshFileUploadConfig();
  refreshLongTermConfig();
});

onBeforeUnmount(() => {
  props.nodeModel.graphModel?.eventCenter?.off?.(
    'refreshFieldList',
    refreshFieldList,
  );
  props.nodeModel.graphModel?.eventCenter?.off?.(
    'chatFieldList',
    refreshChatFieldList,
  );
  props.nodeModel.graphModel?.eventCenter?.off?.(
    'refreshFileUploadConfig',
    refreshFileUploadConfig,
  );
  props.nodeModel.graphModel?.eventCenter?.off?.(
    'refreshLongTermConfig',
    refreshLongTermConfig,
  );
});
</script>

<template>
  <NodeContainer :node-model="nodeModel" :render-version="renderVersion">
    <div class="workflow-start-node">
      <h5
        v-if="nodeModel.properties.config.globalFields.length > 0"
        class="workflow-start-node__title"
      >
        全局变量
      </h5>
      <div
        v-for="field in nodeModel.properties.config.globalFields"
        :key="fieldValue(field)"
        class="workflow-start-node__row"
        @click="copyVariable(`{{global.${fieldValue(field)}}}`)"
      >
        <span class="workflow-start-node__text">
          {{ field.label }} {{ displayVariable(field) }}
        </span>
        <ElTooltip content="复制参数" placement="top">
          <span class="workflow-start-node__copy">
            <ElIcon><CopyDocument /></ElIcon>
          </span>
        </ElTooltip>
      </div>

      <template v-if="nodeModel.properties.config.chatFields.length > 0">
        <h5 class="workflow-start-node__title">会话变量</h5>
        <div
          v-for="field in nodeModel.properties.config.chatFields"
          :key="fieldValue(field)"
          class="workflow-start-node__row"
          @click="copyVariable(`{{chat.${fieldValue(field)}}}`)"
        >
          <span class="workflow-start-node__text">
            {{ field.label }} {{ displayVariable(field) }}
          </span>
          <ElTooltip content="复制参数" placement="top">
            <span class="workflow-start-node__copy">
              <ElIcon><CopyDocument /></ElIcon>
            </span>
          </ElTooltip>
        </div>
      </template>
    </div>
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-start-node {
  display: grid;
  gap: 8px;
}

.workflow-start-node__title {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.workflow-start-node__row {
  --copy-width: 20px;

  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-width: 0;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  transition:
    background-color var(--el-transition-duration),
    border-color var(--el-transition-duration);
}

.workflow-start-node__row:hover {
  background: var(--el-fill-color-blank);
  border-color: var(--el-color-primary-light-5);
}

.workflow-start-node__text {
  min-width: 0;
  overflow: hidden;
  word-break: break-all;
}

.workflow-start-node__copy {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: var(--copy-width);
  height: 20px;
  color: var(--el-color-primary);
  opacity: 0;
  transition: opacity var(--el-transition-duration);
}

.workflow-start-node__row:hover .workflow-start-node__copy,
.workflow-start-node__row:focus-within .workflow-start-node__copy {
  opacity: 1;
}

.workflow-start-node__text:only-child {
  margin-right: var(--copy-width);
}
</style>
