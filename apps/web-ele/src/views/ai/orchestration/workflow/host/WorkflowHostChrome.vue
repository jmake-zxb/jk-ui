<script setup lang="ts">
import type { PaletteMode, WorkflowFoundationMode } from '../designer/nodes';
import type { ValidationState } from '../designer/validation';
import type WorkflowDesigner from '../designer/WorkflowDesigner.vue';
import type { DebugRunEvent } from './workflow-host-shared';

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
  ElDrawer,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElInput,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
  ElTag,
} from 'element-plus';

import WorkflowDesignerComponent from '../designer/WorkflowDesigner.vue';

const props = withDefaults(
  defineProps<{
    autoSaveEnabled: boolean;
    backListLabel: string;
    canRestoreVersion: boolean;
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
  { debugMode: 'drawer', validation: undefined },
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
const debugMessage = defineModel<string>('debugMessage', { default: '' });
const debugInput = defineModel<string>('debugInput', { default: '{}' });

const debugRows = defineModel<DebugRunEvent[]>('debugRows', {
  default: () => [],
});
const debugEvents = defineModel<string[]>('debugEvents', { default: () => [] });

const workflowDesignerRef = ref<InstanceType<typeof WorkflowDesigner>>();
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
  fitView: (...args: any[]) =>
    (workflowDesignerRef.value as any)?.fitView?.(...args),
  getGraphData: () => (workflowDesignerRef.value as any)?.getGraphData?.(),
  openRawDebug: () => {
    rawDebugOpen.value = true;
  },
  refreshGraphData: (...args: any[]) =>
    (workflowDesignerRef.value as any)?.refreshGraphData?.(...args),
  renderGraphData: (...args: any[]) =>
    workflowDesignerRef.value?.renderGraphData?.(...args),
  runLocalValidation: (showMessage = true) =>
    workflowDesignerRef.value?.runLocalValidation?.(showMessage) ?? true,
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
            type="primary"
            @click="workflowDesignerRef?.toggleAddMenu()"
          >
            添加组件
          </ElButton>
          <ElButton :icon="VideoPlay" @click="runDebug"> 调试 </ElButton>
          <ElButton @click="emit('save')">保存</ElButton>
          <ElButton :icon="Connection" @click="emit('publish')">发布</ElButton>
          <ElDropdown trigger="click">
            <ElButton :icon="MoreFilled" />
            <template #dropdown>
              <ElDropdownMenu>
                <slot name="menu-before"></slot>
                <ElDropdownItem @click="emit('validate')">校验</ElDropdownItem>
                <ElDropdownItem @click="openVersions">
                  版本 / 历史
                </ElDropdownItem>
                <ElDropdownItem @click="emit('toggleAutoSave')">
                  {{ autoSaveEnabled ? '关闭自动保存' : '开启自动保存' }}
                </ElDropdownItem>
                <ElDropdownItem
                  v-if="debugMode === 'drawer'"
                  @click="rawDebugOpen = true"
                >
                  调试原始流
                </ElDropdownItem>
                <ElDropdownItem
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

      <WorkflowDesignerComponent
        ref="workflowDesignerRef"
        v-model:graph-data="graphData"
        :foundation-mode="foundationMode"
        :palette-mode="paletteMode"
        @debug="runDebug"
        @local-validation-change="emit('localValidationChange', $event)"
        @raw-debug="rawDebugOpen = true"
      />

      <slot name="drawers"></slot>

      <!-- panel 模式：外部注入浮动对话面板（高级智能体工作流调试） -->
      <slot v-if="debugMode === 'panel'" name="debug-panel"></slot>

      <ElDrawer
        v-if="debugMode === 'drawer'"
        v-model="debugDrawerOpen"
        :title="debugDrawerTitle"
        size="520px"
      >
        <div class="debug-drawer">
          <ElInput v-model="debugMessage" placeholder="消息" />
          <ElInput v-model="debugInput" type="textarea" :rows="6" class="mt8" />
          <ElButton
            type="primary"
            class="full-action"
            :icon="VideoPlay"
            @click="runDebug"
          >
            运行调试
          </ElButton>
          <div class="run-events drawer-events">
            <div
              v-for="(event, index) in debugRows"
              :key="`${event.event}-${index}`"
              class="run-event"
              :class="`is-${event.status.toLowerCase()}`"
            >
              <span>{{ event.event }}</span>
              <strong>{{
                event.nodeName || event.nodeType || event.title
              }}</strong>
              <small>{{ event.nodeType || event.status }}</small>
            </div>
            <div v-if="debugRows.length === 0" class="empty-state">
              暂无调试事件
            </div>
          </div>
        </div>
      </ElDrawer>

      <ElDrawer
        v-model="versionsOpen"
        :title="versionsDrawerTitle"
        size="680px"
      >
        <ElTabs model-value="versions">
          <ElTabPane label="版本" name="versions">
            <ElTable
              v-loading="versionsLoading"
              :data="versions"
              size="small"
              height="calc(100vh - 160px)"
            >
              <ElTableColumn prop="versionNo" label="版本" width="110" />
              <ElTableColumn prop="status" label="状态" width="110" />
              <ElTableColumn
                prop="createTime"
                label="发布时间"
                min-width="180"
              />
              <ElTableColumn label="操作" width="110">
                <template #default="{ row }">
                  <ElButton
                    v-if="canRestoreVersion"
                    link
                    type="primary"
                    @click="emit('restoreVersion', row)"
                  >
                    恢复
                  </ElButton>
                  <ElTag v-else size="small" type="info">仅查看</ElTag>
                </template>
              </ElTableColumn>
            </ElTable>
          </ElTabPane>
        </ElTabs>
      </ElDrawer>

      <ElDrawer
        v-if="debugMode === 'drawer'"
        v-model="rawDebugOpen"
        title="调试原始流"
        size="520px"
      >
        <div class="stream-box raw-stream">
          <pre v-for="(event, index) in debugEvents" :key="index">{{
            event
          }}</pre>
        </div>
      </ElDrawer>
    </div>
  </Page>
</template>

<style scoped lang="scss">
.workflow-host {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.workflow-host :deep(.workflow-designer) {
  flex: 1;
  width: 100%;
  min-height: 0;
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
