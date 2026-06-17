<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import { computed, onMounted, ref } from 'vue';

import { CopyDocument, FullScreen } from '@element-plus/icons-vue';
import {
  ElAlert,
  ElButton,
  ElCollapseTransition,
  ElDialog,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElMessage,
  ElTooltip,
} from 'element-plus';
import { set } from 'lodash-es';

import { outputFields } from '../../nodes';

const props = defineProps<{
  nodeModel: any;
}>();

const DEFAULT_SLOT_HEIGHT = 600;
const DEFAULT_WIDTH = 1920;
const DEFAULT_NODE_HEIGHT = 1080;
const GENERIC_NODE_HEIGHT = 220;
const GENERIC_NODE_WIDTH = 340;

const height = ref(DEFAULT_SLOT_HEIGHT);
const enlarge = ref(false);
const nodeWidthValue = ref(resolveInitialWidth());
const hoveredFieldIndex = ref<null | number>(null);

// 节点名称编辑对话框
const nodeNameDialogVisible = ref(false);
const nodeNameFormRef = ref<FormInstance>();
const nodeNameForm = ref({ title: '' });

const nodeWidth = computed(() => `${nodeWidthValue.value}px`);
const showNode = computed({
  get: () => {
    if (props.nodeModel.properties?.showNode !== undefined) {
      return props.nodeModel.properties.showNode;
    }
    set(props.nodeModel.properties, 'showNode', true);
    return true;
  },
  set: (value: boolean) => set(props.nodeModel.properties, 'showNode', value),
});
const nodeStatus = computed(() =>
  Number(props.nodeModel.properties?.status || 200),
);
const nodeFields = computed(() =>
  outputFields(props.nodeModel.properties).map((field) => ({
    globeLabel: `{{${props.nodeModel.properties?.stepName || ''}.${field.value || field.name || ''}}}`,
    label: field.label || field.name || field.value,
    value: field.value || field.name,
  })),
);

function mousedown() {
  props.nodeModel.graphModel?.clearSelectElements?.();
  set(props.nodeModel, 'isSelected', true);
  set(props.nodeModel, 'isHovered', true);
  props.nodeModel.graphModel?.toFront?.(props.nodeModel.id);
  props.nodeModel.refreshVueComponent?.();
}

function parentScaleX() {
  return Number(props.nodeModel.graphModel?.transformModel?.SCALE_X || 1) || 1;
}

function parentScaleY() {
  return Number(props.nodeModel.graphModel?.transformModel?.SCALE_Y || 1) || 1;
}

function positiveNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
}

function resolveInitialWidth() {
  const propertyWidth = positiveNumber(props.nodeModel.properties?.width);
  if (propertyWidth && propertyWidth !== GENERIC_NODE_WIDTH)
    return propertyWidth;
  const modelWidth = positiveNumber(props.nodeModel.width);
  if (modelWidth && modelWidth !== GENERIC_NODE_WIDTH) return modelWidth;
  return DEFAULT_WIDTH;
}

function resolveInitialHeight() {
  const propertyHeight = positiveNumber(props.nodeModel.properties?.height);
  if (propertyHeight && propertyHeight !== GENERIC_NODE_HEIGHT)
    return propertyHeight;
  const modelHeight = positiveNumber(props.nodeModel.height);
  if (modelHeight && modelHeight !== GENERIC_NODE_HEIGHT) return modelHeight;
  return DEFAULT_NODE_HEIGHT;
}

function mutableNodeModel() {
  return props.nodeModel;
}

function fieldToken(value: string) {
  return `{${value}}`;
}

/** 复制字段引用到剪贴板 */
function copyFieldRef(globeLabel: string) {
  navigator.clipboard?.writeText?.(globeLabel);
}

function syncInitialModelSize() {
  const width = resolveInitialWidth();
  const modelHeight = resolveInitialHeight();
  const nodeModel = mutableNodeModel();
  nodeWidthValue.value = width;
  nodeModel.width = width;
  nodeModel.height = modelHeight;
  set(nodeModel.properties, 'width', width);
  set(nodeModel.properties, 'height', modelHeight);
  nodeModel.refreshBranch?.();
}

function applySize(width: number, slotHeight: number) {
  const nodeModel = mutableNodeModel();
  nodeWidthValue.value = width;
  nodeModel.width = width;
  set(nodeModel.properties, 'width', width);
  height.value = slotHeight;
  if (typeof nodeModel.setHeight === 'function')
    nodeModel.setHeight(slotHeight);
  else {
    nodeModel.height = slotHeight;
    set(nodeModel.properties, 'height', slotHeight);
    nodeModel.refreshBranch?.();
  }
}

function enlargeHandle() {
  enlarge.value = !enlarge.value;
  if (enlarge.value) {
    props.nodeModel.graphModel?.transformModel?.focusOn?.(
      props.nodeModel.x,
      props.nodeModel.y,
      props.nodeModel.width + window.innerWidth - props.nodeModel.width,
      props.nodeModel.height - 30,
    );
    const slotHeight =
      (Number(props.nodeModel.graphModel?.height || window.innerHeight) - 100) /
      parentScaleY();
    const width = window.innerWidth / parentScaleX();
    applySize(width, slotHeight);
    return;
  }
  applySize(DEFAULT_WIDTH, DEFAULT_SLOT_HEIGHT);
}

function zoom() {
  if (enlarge.value) enlargeHandle();
}

/** 节点名称编辑（对齐 MaxKB LoopBodyContainer） */
function openNodeNameDialog() {
  nodeNameForm.value.title = props.nodeModel.properties?.stepName || '';
  nodeNameDialogVisible.value = true;
}

function submitNodeName() {
  if (!nodeNameFormRef.value) return;
  nodeNameFormRef.value.validate((valid) => {
    if (!valid) return;
    const newTitle = nodeNameForm.value.title.trim();
    if (!newTitle) return;
    const duplicate = props.nodeModel.graphModel?.nodes?.some(
      (node: any) => node.properties?.stepName === newTitle,
    );
    if (duplicate) {
      ElMessage.error('节点名称重复');
      return;
    }
    set(props.nodeModel.properties, 'stepName', newTitle);
    nodeNameDialogVisible.value = false;
  });
}

onMounted(() => {
  syncInitialModelSize();
});

defineExpose({ zoom });
</script>

<template>
  <div
    class="workflow-node-container"
    :style="{ width: nodeWidth }"
    @mousedown="mousedown"
  >
    <div
      class="step-container"
      :class="{
        error: nodeStatus !== 200,
        isSelected: nodeModel.isSelected,
      }"
    >
      <div>
        <div class="flex-between">
          <div class="align-center flex">
            <span class="loop-body-icon">循</span>
            <h4
              class="ellipsis-1 cursor-pointer break-all"
              @dblclick.stop="openNodeNameDialog"
            >
              {{ nodeModel.properties.stepName }}
            </h4>
          </div>

          <ElButton link @click.stop="enlargeHandle">
            <ElIcon class="color-secondary loop-body-action-icon">
              <FullScreen />
            </ElIcon>
          </ElButton>
        </div>
        <ElCollapseTransition>
          <div
            v-show="showNode"
            class="mt-16"
            @click.stop
            @keydown.stop
            @mousedown.stop
            @wheel.stop
          >
            <ElAlert
              v-if="nodeStatus !== 200"
              class="mb-16"
              title="节点状态异常"
              type="error"
              show-icon
              :closable="false"
            />
            <div class="loop-body-slot" :style="{ height: `${height}px` }">
              <slot></slot>
            </div>

            <template v-if="nodeFields.length > 0">
              <h5 class="title-decoration-1 mb-8 mt-8">输出字段</h5>
              <div
                v-for="(item, index) in nodeFields"
                :key="item.value"
                class="flex-between p-8-12 layout-bg lighter mb-8 border-r-4"
                @mouseenter="hoveredFieldIndex = index"
                @mouseleave="hoveredFieldIndex = null"
              >
                <span class="break-all">
                  {{ item.label }} {{ fieldToken(item.value) }}
                </span>
                <ElTooltip
                  v-if="hoveredFieldIndex === index"
                  content="复制参数"
                  placement="top"
                >
                  <ElButton
                    link
                    style="padding: 0"
                    @click.stop="copyFieldRef(item.globeLabel)"
                  >
                    <ElIcon><CopyDocument /></ElIcon>
                  </ElButton>
                </ElTooltip>
              </div>
            </template>
          </div>
        </ElCollapseTransition>
      </div>
    </div>
  </div>

  <!-- 节点名称编辑对话框（对齐 MaxKB） -->
  <ElDialog
    v-model="nodeNameDialogVisible"
    title="节点名称"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    append-to-body
    destroy-on-close
    @submit.prevent
  >
    <ElForm ref="nodeNameFormRef" label-position="top" :model="nodeNameForm">
      <ElFormItem
        prop="title"
        :rules="[
          { required: true, message: '请输入节点名称', trigger: 'blur' },
        ]"
      >
        <ElInput
          v-model="nodeNameForm.title"
          @blur="nodeNameForm.title = nodeNameForm.title.trim()"
        />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click.prevent="nodeNameDialogVisible = false">取消</ElButton>
      <ElButton type="primary" @click="submitNodeName">保存</ElButton>
    </template>
  </ElDialog>
</template>

<style scoped lang="scss">
.workflow-node-container {
  box-sizing: border-box;
  padding: 16px;
  overflow: visible;
  color: var(--el-text-color-primary);
  pointer-events: auto;
}

.step-container {
  box-sizing: border-box;
  padding: 16px;
  overflow: visible;
  background: var(--el-bg-color);
  border: 2px solid var(--el-bg-color);
  border-radius: 8px;
  box-shadow: 0 2px 4px 0 rgb(var(--el-text-color-primary-rgb), 0.12);
  transition:
    box-shadow var(--el-transition-duration),
    border-color var(--el-transition-duration);
}

.step-container:hover {
  box-shadow: 0 6px 24px 0 rgb(var(--el-text-color-primary-rgb), 0.08);
}

.step-container.isSelected {
  border-color: var(--el-color-primary);
}

.step-container.error {
  border-color: var(--el-color-danger);
}

.flex-between,
.flex {
  display: flex;
  gap: 8px;
  align-items: center;
}

.flex-between {
  justify-content: space-between;
}

.align-center {
  align-items: center;
}

.loop-body-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: 6px;
}

.loop-body-action-icon {
  font-size: 20px;
}

.color-secondary {
  color: var(--el-text-color-secondary);
}

h4,
h5 {
  margin: 0;
}

h4 {
  font-size: 15px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.ellipsis-1 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.break-all {
  word-break: break-all;
}

.mt-16 {
  margin-top: 16px;
}

.mb-16 {
  margin-bottom: 16px;
}

.mb-8 {
  margin-bottom: 8px;
}

.mt-8 {
  margin-top: 8px;
}

.cursor-pointer {
  cursor: pointer;
}

.loop-body-slot {
  width: 100%;
  overflow: visible;
}

.title-decoration-1 {
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.border-r-4 {
  border-radius: 4px;
}

.p-8-12 {
  padding: 8px 12px;
}

.layout-bg {
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
}

.lighter {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
