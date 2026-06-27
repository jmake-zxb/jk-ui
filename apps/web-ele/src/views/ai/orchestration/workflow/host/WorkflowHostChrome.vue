<script setup lang="ts">
import type { PaletteMode, WorkflowFoundationMode } from '../designer/nodes';
import type { ValidationState } from '../designer/validation';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ArrowLeft,
  Connection,
  MoreFilled,
  VideoPlay,
} from '@element-plus/icons-vue';
import {
  ElButton,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElTag,
} from 'element-plus';

import WorkflowDesignerComponent from '../designer/WorkflowDesigner.vue';
import PublishHistorySidebar from './PublishHistorySidebar.vue';

const props = withDefaults(
  defineProps<{
    autoSaveEnabled: boolean;
    backListLabel: string;
    canAddComponent?: boolean;
    canDebug?: boolean;
    canLocalValidate?: boolean;
    canPublish?: boolean;
    canRawDebug?: boolean;
    canRestoreVersion: boolean;
    canSave?: boolean;
    canValidate?: boolean;
    canViewVersions?: boolean;
    debugDrawerTitle: string;
    /** 'drawer' = 内置事件抽屉（工具工作流）；'panel' = 外部浮动对话面板（高级智能体）。 */
    debugMode?: 'drawer' | 'panel';
    foundationMode: WorkflowFoundationMode;
    loading: boolean;
    localValidation: ValidationState;
    paletteMode: PaletteMode;
    subtitleText: string;
    title: string;
    validation?: any;
    versions: any[];
    versionsDrawerTitle: string;
    versionsLoading: boolean;
  }>(),
  {
    canAddComponent: true,
    canDebug: true,
    canLocalValidate: true,
    canPublish: true,
    canRawDebug: true,
    canSave: true,
    canValidate: true,
    canViewVersions: true,
    debugMode: 'drawer',
    validation: undefined,
  },
);

const emit = defineEmits<{
  back: [];
  debug: [];
  localValidationChange: [value: ValidationState];
  openVersions: [];
  publish: [];
  restoreVersion: [row: any];
  save: [];
  toggleAutoSave: [];
  toggleDebug: [];
  validate: [];
}>();

const graphData = defineModel<string>('graphData', { default: '{}' });

const workflowDesignerRef =
  ref<InstanceType<typeof WorkflowDesignerComponent>>();
const debugDrawerOpen = ref(false);
const versionsOpen = ref(false);
const rawDebugOpen = ref(false);

function runDebug() {
  if (props.debugMode === 'panel') {
    emit('toggleDebug');
    return;
  }
  debugDrawerOpen.value = true;
  emit('debug');
}

function openVersions() {
  versionsOpen.value = true;
  emit('openVersions');
}

defineExpose({
  applyRuntimeNodeStatus: (nodeId: string, status?: string) =>
    workflowDesignerRef.value?.applyRuntimeNodeStatus?.(nodeId, status),
  clearRuntimeNodeStatuses: () =>
    workflowDesignerRef.value?.clearRuntimeNodeStatuses?.(),
  fitView: () => workflowDesignerRef.value?.fitView?.(),
  getGraphData: () => workflowDesignerRef.value?.getGraphData?.(),
  openRawDebug: () => {
    rawDebugOpen.value = true;
  },
  refreshGraphData: () => workflowDesignerRef.value?.refreshGraphData?.(),
  renderGraphData: (data?: string, fit = true) =>
    workflowDesignerRef.value?.renderGraphData?.(data, fit),
  runLocalValidation: (showMessage = true) =>
    workflowDesignerRef.value?.runLocalValidation?.(showMessage) ?? true,
  runNodeValidation: (): Promise<string[]> =>
    workflowDesignerRef.value?.runNodeValidation?.() ?? Promise.resolve([]),
  syncGraphData: () => workflowDesignerRef.value?.syncGraphData?.(),
});
</script>

<template>
  <Page auto-content-height>
    <div class="workflow-host" v-loading="loading">
      <div class="toolbar editor-header">
        <div class="header-left">
          <ElButton :icon="ArrowLeft" @click="emit('back')">
            {{ backListLabel }}
          </ElButton>
          <div class="workflow-title-block">
            <div class="page-title">{{ title }}</div>
            <div class="page-subtitle">{{ subtitleText }}</div>
          </div>
          <ElTag v-if="validation" type="success">
            {{ validation.message || validation.result || '已校验' }}
          </ElTag>
          <ElTag v-if="localValidation.errors.length > 0" type="danger">
            {{ localValidation.errors.length }} 错误
          </ElTag>
          <ElTag v-else-if="localValidation.warnings.length > 0" type="warning">
            {{ localValidation.warnings.length }} 警告
          </ElTag>
        </div>
        <div class="header-actions">
          <ElButton
            v-if="canAddComponent"
            type="primary"
            @click="workflowDesignerRef?.toggleAddMenu()"
          >
            添加组件
          </ElButton>
          <ElButton v-if="canDebug" :icon="VideoPlay" @click="runDebug">
            调试
          </ElButton>
          <ElButton v-if="canSave" @click="emit('save')">保存</ElButton>
          <ElButton
            v-if="canPublish"
            :icon="Connection"
            @click="emit('publish')"
          >
            发布
          </ElButton>
          <ElDropdown trigger="click">
            <ElButton :icon="MoreFilled" />
            <template #dropdown>
              <ElDropdownMenu>
                <slot name="menu-before"></slot>
                <ElDropdownItem v-if="canValidate" @click="emit('validate')">
                  校验
                </ElDropdownItem>
                <ElDropdownItem v-if="canViewVersions" @click="openVersions">
                  版本 / 历史
                </ElDropdownItem>
                <ElDropdownItem @click="emit('toggleAutoSave')">
                  {{ autoSaveEnabled ? '关闭自动保存' : '开启自动保存' }}
                </ElDropdownItem>
                <ElDropdownItem
                  v-if="canRawDebug && debugMode === 'drawer'"
                  @click="rawDebugOpen = true"
                >
                  调试原始流
                </ElDropdownItem>
                <ElDropdownItem
                  v-if="canLocalValidate"
                  @click="workflowDesignerRef?.runLocalValidation(true)"
                >
                  本地校验
                </ElDropdownItem>
                <slot name="menu-after"></slot>
              </ElDropdownMenu>
            </template>
          </ElDropdown>
        </div>
      </div>

      <div class="workflow-body">
        <WorkflowDesignerComponent
          ref="workflowDesignerRef"
          v-model:graph-data="graphData"
          :foundation-mode="foundationMode"
          :palette-mode="paletteMode"
          @debug="runDebug"
          @local-validation-change="emit('localValidationChange', $event)"
          @raw-debug="rawDebugOpen = true"
        />

        <PublishHistorySidebar
          v-if="versionsOpen"
          :can-restore="canRestoreVersion"
          :loading="versionsLoading"
          :title="versionsDrawerTitle"
          :versions="versions"
          @close="versionsOpen = false"
          @restore="(row: any) => emit('restoreVersion', row)"
        />
      </div>

      <slot name="drawers"></slot>

      <!-- panel 模式：外部注入浮动对话面板（高级智能体工作流调试） -->
      <slot v-if="debugMode === 'panel'" name="debug-panel"></slot>
    </div>
  </Page>
</template>

<style scoped lang="scss">
.workflow-host {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.workflow-body {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.workflow-host :deep(.workflow-designer) {
  width: 100%;
  height: 100%;
}

.toolbar {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: center;
}

.editor-header {
  position: relative;
  z-index: 20;
  flex-shrink: 0;
  justify-content: space-between;
  padding: 8px 10px;
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.header-left,
.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.header-left {
  min-width: 0;
}

.page-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.debug-drawer {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 96px);
}

.panel-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.full-action {
  width: 100%;
  margin-top: 8px;
}

.mt8 {
  margin-top: 8px;
}

.run-events {
  flex: 1;
  min-height: 120px;
  margin-top: 8px;
  overflow: auto;
}

.run-event {
  display: grid;
  grid-template-columns: 82px 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 8px;
  margin-bottom: 6px;
  font-size: 12px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-left-width: 4px;
  border-radius: 6px;
}

.run-event strong {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.run-event small,
.run-event span,
.empty-state {
  color: var(--el-text-color-secondary);
}

.run-event.is-running {
  border-left-color: var(--el-color-primary);
}

.run-event.is-stream {
  border-left-color: var(--el-color-info);
}

.run-event.is-success {
  border-left-color: var(--el-color-success);
}

.run-event.is-warning {
  border-left-color: var(--el-color-warning);
}

.run-event.is-failed {
  border-left-color: var(--el-color-danger);
}

.empty-state {
  padding: 8px;
  font-size: 12px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.stream-box {
  height: 100%;
  padding: 8px;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.stream-box pre {
  margin: 0 0 8px;
  white-space: pre-wrap;
}

.raw-stream {
  height: calc(100vh - 110px);
}
</style>
