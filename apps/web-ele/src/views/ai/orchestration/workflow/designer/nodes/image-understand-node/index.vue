<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue';

import { EditPen, Operation } from '@element-plus/icons-vue';
import {
  ElButton,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTooltip,
} from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

import ModelParamSettingDialog from '../../../../applications/ModelParamSettingDialog.vue';
import FileTooltip from '../../common/FileTooltip.vue';
import { syncNodeProperties } from '../../common/node-inline-update';
import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';
import ReasoningParamSettingDialog from '../ai-chat-node/component/ReasoningParamSettingDialog.vue';
import TextMagnifyDialog from '../ai-chat-node/component/TextMagnifyDialog.vue';
import LocalModelSelect from '../base-node/component/LocalModelSelect.vue';

type ModelSource = 'custom' | 'reference';
type TextKey = 'prompt' | 'system';
type WorkflowMode = 'application' | 'application-loop' | 'tool' | string;
type ReasoningSetting = Record<string, unknown> & {
  reasoning_content_enable: boolean;
  reasoning_content_end: string;
  reasoning_content_start: string;
};
type NodeData = Record<string, unknown> & {
  dialogue_number: number;
  dialogue_type: string;
  image_list: unknown[];
  is_result: boolean;
  model_id: number | string;
  model_id_reference: unknown[];
  model_id_type: ModelSource;
  model_params_setting: Record<string, unknown>;
  model_setting: ReasoningSetting;
  prompt: string;
  system: string;
};
type WorkflowNodeModel = {
  graphModel?: {
    eventCenter?: {
      emit?: (name: string, payload: Record<string, unknown>) => void;
    };
  };
  id: string;
  properties: Record<string, unknown>;
  refreshVueComponent?: () => void;
  validate?: () => Promise<void>;
};

const props = defineProps<{
  nodeModel: WorkflowNodeModel;
  renderVersion?: number;
}>();
const defaultPrompt = '{{start-node.question}}';
const defaultReasoningSetting: ReasoningSetting = {
  reasoning_content_enable: false,
  reasoning_content_end: '</think>',
  reasoning_content_start: '<think>',
};

const nodeModel = props.nodeModel;
const workflowMode = inject<WorkflowMode>('workflowMode', 'application');
const modelCascaderRef = ref<InstanceType<typeof NodeCascader>>();
const imageCascaderRef = ref<InstanceType<typeof NodeCascader>>();
const modelParamOpen = ref(false);
const textMagnifyDialogRef = ref<InstanceType<typeof TextMagnifyDialog>>();
const reasoningParamDialogRef =
  ref<InstanceType<typeof ReasoningParamSettingDialog>>();
const nodeRenderVersion = ref(0);
const formData = ref<NodeData>(
  normalizeNodeData(nodeModel.properties?.node_data),
);

const showConversationControls = computed(
  () => !`${workflowMode || 'application'}`.includes('knowledge'),
);
const resolvedModelId = computed(() => {
  const value = formData.value.model_id;
  return typeof value === 'number' || typeof value === 'string' ? value : '';
});
const modelParamSetting = computed(() => formData.value.model_params_setting);
const modelParamsSummary = computed(() => {
  const keys = Object.keys(formData.value.model_params_setting || {});
  return keys.length > 0 ? `${keys.length} 项` : '默认参数';
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function modelIdValue(value: unknown) {
  return typeof value === 'number' || typeof value === 'string' ? value : '';
}

function textValue(value: unknown) {
  return `${value ?? ''}`.trim();
}

function hasReferenceValue(value: unknown) {
  return Array.isArray(value) && value.length >= 2;
}

function normalizeReasoningSetting(value: unknown): ReasoningSetting {
  const source = isRecord(value) ? value : {};
  return {
    ...cloneDeep(source),
    reasoning_content_enable:
      typeof source.reasoning_content_enable === 'boolean'
        ? source.reasoning_content_enable
        : defaultReasoningSetting.reasoning_content_enable,
    reasoning_content_end: stringValue(
      source.reasoning_content_end,
      defaultReasoningSetting.reasoning_content_end,
    ),
    reasoning_content_start: stringValue(
      source.reasoning_content_start,
      defaultReasoningSetting.reasoning_content_start,
    ),
  };
}

function normalizeNodeData(value: unknown): NodeData {
  const source = isRecord(value) ? cloneDeep(value) : {};
  const sourceModelId = source.model_id ?? source.modelId;
  return {
    ...source,
    dialogue_number:
      typeof source.dialogue_number === 'number' ? source.dialogue_number : 0,
    dialogue_type: stringValue(source.dialogue_type, 'NODE'),
    image_list: Array.isArray(source.image_list)
      ? cloneDeep(source.image_list)
      : ['start-node', 'image'],
    is_result: typeof source.is_result === 'boolean' ? source.is_result : true,
    model_id: modelIdValue(sourceModelId),
    model_id_reference: Array.isArray(source.model_id_reference)
      ? cloneDeep(source.model_id_reference)
      : [],
    model_id_type:
      source.model_id_type === 'reference' ? 'reference' : 'custom',
    model_params_setting: isRecord(source.model_params_setting)
      ? cloneDeep(source.model_params_setting)
      : {},
    model_setting: normalizeReasoningSetting(source.model_setting),
    prompt: stringValue(source.prompt, defaultPrompt),
    system: stringValue(source.system),
  };
}

function syncNodeData() {
  syncNodeProperties(nodeModel, { node_data: cloneDeep(formData.value) }, [
    'node_data',
  ]);
  nodeRenderVersion.value += 1;
}

function patchData(key: keyof NodeData, value: unknown) {
  set(formData.value, key, cloneDeep(value));
  syncNodeData();
}

function patchModelType(value: ModelSource) {
  set(formData.value, 'model_id_type', value);
  set(formData.value, 'model_id_reference', []);
  syncNodeData();
}

function patchModelId(value: number | string | undefined) {
  const previousModelId = formData.value.model_id;
  set(formData.value, 'model_id', value ?? '');
  if (!value || previousModelId !== value) {
    set(formData.value, 'model_params_setting', {});
  }
  syncNodeData();
}

function patchReasoning(key: keyof ReasoningSetting, value: unknown) {
  const setting = cloneDeep(formData.value.model_setting);
  set(setting, key, value);
  patchData('model_setting', setting);
}

function openModelParamDialog() {
  modelParamOpen.value = true;
}

function refreshModelParams(value: Record<string, unknown>) {
  patchData('model_params_setting', value);
}

function openTextMagnifyDialog(key: TextKey, title: string) {
  textMagnifyDialogRef.value?.open({
    key,
    title,
    value: formData.value[key],
  });
}

function submitTextMagnifyDialog(data: { key: TextKey; value: string }) {
  patchData(data.key, data.value);
}

function openReasoningParamSettingDialog() {
  reasoningParamDialogRef.value?.open(formData.value.model_setting);
}

function submitReasoningDialog(value: Record<string, unknown>) {
  const setting = cloneDeep(formData.value.model_setting);
  Object.entries(value).forEach(([key, item]) => set(setting, key, item));
  patchData('model_setting', setting);
}

function validationError(errMessage: string) {
  return Object.assign(new Error(errMessage), { errMessage, node: nodeModel });
}

async function validate() {
  try {
    if (formData.value.model_id_type === 'reference') {
      if (!hasReferenceValue(formData.value.model_id_reference)) {
        throw validationError('请选择模型变量');
      }
      await modelCascaderRef.value?.validate?.();
    } else if (!textValue(formData.value.model_id)) {
      throw validationError('请选择图片理解模型');
    }

    if (!hasReferenceValue(formData.value.image_list)) {
      throw validationError('请选择图片变量');
    }
    await imageCascaderRef.value?.validate?.();

    if (!textValue(formData.value.prompt)) {
      throw validationError('请输入用户提示词');
    }
  } catch (error) {
    if (error instanceof Error && 'node' in error) throw error;
    throw validationError(
      error instanceof Error ? error.message : `${error || ''}`,
    );
  }
}

onMounted(() => {
  syncNodeData();
  set(nodeModel, 'validate', validate);
});

onBeforeUnmount(() => {
  if (nodeModel.validate === validate) set(nodeModel, 'validate', undefined);
});
</script>

<template>
  <NodeContainer
    :node-model="nodeModel"
    :render-version="nodeRenderVersion + (renderVersion || 0)"
  >
    <ElForm
      :model="formData"
      class="workflow-image-understand-node"
      label-position="top"
      @submit.prevent
    >
      <section class="workflow-image-understand-node__panel">
        <ElFormItem label="图片理解模型" required>
          <template #label>
            <div class="workflow-image-understand-node__form-label">
              <span>图片理解模型</span>
              <ElSelect
                :model-value="formData.model_id_type"
                :teleported="false"
                size="small"
                @update:model-value="patchModelType"
              >
                <ElOption label="自定义" value="custom" />
                <ElOption label="变量引用" value="reference" />
              </ElSelect>
            </div>
          </template>
          <div class="workflow-image-understand-node__model-row">
            <LocalModelSelect
              v-if="formData.model_id_type === 'custom'"
              :model-value="formData.model_id"
              model-type="IMAGE"
              placeholder="请选择图片理解模型"
              show-footer
              @update:model-value="patchModelId"
            />
            <NodeCascader
              v-else
              ref="modelCascaderRef"
              :model-value="formData.model_id_reference"
              :node-model="nodeModel"
              class="w-full"
              placeholder="选择模型变量"
              @update:model-value="patchData('model_id_reference', $event)"
            />
            <ElButton
              :disabled="
                formData.model_id_type !== 'custom' || !formData.model_id
              "
              size="small"
              @click="openModelParamDialog"
            >
              <ElIcon><Operation /></ElIcon>
            </ElButton>
          </div>
        </ElFormItem>

        <ElFormItem label="模型参数">
          <ElInput :model-value="modelParamsSummary" disabled />
        </ElFormItem>

        <ElFormItem required>
          <template #label>
            <div class="workflow-image-understand-node__label-with-tip">
              <span>图片</span>
              <FileTooltip />
            </div>
          </template>
          <NodeCascader
            ref="imageCascaderRef"
            :model-value="formData.image_list"
            :node-model="nodeModel"
            class="w-full"
            placeholder="请选择图片变量"
            @update:model-value="patchData('image_list', $event)"
          />
        </ElFormItem>

        <ElFormItem label="系统提示词">
          <template #label>
            <div class="workflow-image-understand-node__form-label">
              <span class="workflow-image-understand-node__label-with-tip">
                系统提示词
                <ElTooltip
                  content="定义模型角色、回答边界和输出风格。"
                  placement="right"
                >
                  <span class="workflow-image-understand-node__tip">?</span>
                </ElTooltip>
              </span>
              <ElButton
                size="small"
                text
                type="primary"
                @click="openTextMagnifyDialog('system', '系统提示词')"
              >
                <ElIcon><EditPen /></ElIcon>
              </ElButton>
            </div>
          </template>
          <ElInput
            :model-value="formData.system"
            type="textarea"
            :rows="3"
            placeholder="定义图片理解模型的角色和输出要求"
            @update:model-value="patchData('system', $event)"
          />
        </ElFormItem>

        <ElFormItem label="用户提示词" required>
          <template #label>
            <div class="workflow-image-understand-node__form-label">
              <span class="workflow-image-understand-node__label-with-tip">
                用户提示词
                <ElTooltip
                  content="描述希望模型从图片中理解、提取或回答的内容，支持 {{节点.字段}} 引用。"
                  placement="right"
                >
                  <span class="workflow-image-understand-node__tip">?</span>
                </ElTooltip>
              </span>
              <ElButton
                size="small"
                text
                type="primary"
                @click="openTextMagnifyDialog('prompt', '用户提示词')"
              >
                <ElIcon><EditPen /></ElIcon>
              </ElButton>
            </div>
          </template>
          <ElInput
            :model-value="formData.prompt"
            type="textarea"
            :rows="5"
            placeholder="支持 {{节点.字段}} 引用，例如 {{start-node.question}}"
            @update:model-value="patchData('prompt', $event)"
          />
        </ElFormItem>
      </section>

      <section
        v-if="showConversationControls"
        class="workflow-image-understand-node__panel"
      >
        <ElFormItem>
          <template #label>
            <div class="workflow-image-understand-node__form-label">
              <span>历史记录</span>
              <ElSelect
                :model-value="formData.dialogue_type"
                :teleported="false"
                size="small"
                @update:model-value="patchData('dialogue_type', $event)"
              >
                <ElOption label="当前节点" value="NODE" />
                <ElOption label="工作流" value="WORKFLOW" />
              </ElSelect>
            </div>
          </template>
          <ElInputNumber
            :model-value="formData.dialogue_number"
            :min="0"
            :step="1"
            :step-strictly="true"
            :value-on-clear="0"
            controls-position="right"
            class="w-full"
            @update:model-value="patchData('dialogue_number', $event ?? 0)"
          />
        </ElFormItem>
      </section>

      <section class="workflow-image-understand-node__panel">
        <div class="workflow-image-understand-node__switch-row">
          <div>
            <strong>输出思考</strong>
            <small>开启后按标记提取模型思考过程</small>
          </div>
          <div class="workflow-image-understand-node__switch-actions">
            <ElTooltip
              v-if="formData.model_setting.reasoning_content_enable"
              content="设置输出思考开始和结束标记"
              placement="top"
            >
              <ElButton
                size="small"
                text
                type="primary"
                @click="openReasoningParamSettingDialog"
              >
                <ElIcon><Operation /></ElIcon>
              </ElButton>
            </ElTooltip>
            <ElSwitch
              :model-value="formData.model_setting.reasoning_content_enable"
              size="small"
              @update:model-value="
                patchReasoning('reasoning_content_enable', $event)
              "
            />
          </div>
        </div>
        <div
          v-if="showConversationControls"
          class="workflow-image-understand-node__switch-row"
        >
          <div>
            <strong>返回内容</strong>
            <small>将本节点回复作为工作流输出内容</small>
          </div>
          <ElSwitch
            :model-value="formData.is_result"
            size="small"
            @update:model-value="patchData('is_result', $event)"
          />
        </div>
      </section>
    </ElForm>

    <ModelParamSettingDialog
      v-model="modelParamOpen"
      :model-id="resolvedModelId"
      :setting="modelParamSetting"
      @refresh="refreshModelParams"
    />
    <TextMagnifyDialog
      ref="textMagnifyDialogRef"
      @refresh="submitTextMagnifyDialog"
    />
    <ReasoningParamSettingDialog
      ref="reasoningParamDialogRef"
      @refresh="submitReasoningDialog"
    />
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-image-understand-node {
  --image-understand-space-2xs: 2px;
  --image-understand-space-xs: 4px;
  --image-understand-space-sm: 6px;
  --image-understand-space-md: 8px;
  --image-understand-radius: 6px;

  display: grid;
  gap: var(--image-understand-space-sm);
}

.workflow-image-understand-node__panel {
  display: grid;
  gap: var(--image-understand-space-sm);
  padding: var(--image-understand-space-sm) var(--image-understand-space-md);
  overflow: visible;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--image-understand-radius);
}

.workflow-image-understand-node :deep(.el-form-item) {
  margin-bottom: var(--image-understand-space-sm);
}

.workflow-image-understand-node :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.workflow-image-understand-node :deep(.el-form-item__label) {
  margin-bottom: var(--image-understand-space-2xs);
  font-size: var(--el-font-size-extra-small);
  line-height: 16px;
}

.workflow-image-understand-node :deep(.el-input__wrapper) {
  min-height: 28px;
}

.workflow-image-understand-node :deep(.el-textarea__inner) {
  min-height: 0 !important;
  padding-block: var(--image-understand-space-xs);
  line-height: 18px;
}

.workflow-image-understand-node__form-label,
.workflow-image-understand-node__label-with-tip,
.workflow-image-understand-node__switch-row,
.workflow-image-understand-node__switch-actions {
  display: flex;
  gap: var(--image-understand-space-sm);
  align-items: center;
  min-width: 0;
}

.workflow-image-understand-node__form-label,
.workflow-image-understand-node__switch-row {
  justify-content: space-between;
}

.workflow-image-understand-node__form-label {
  width: 100%;
  font-size: var(--el-font-size-extra-small);
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.workflow-image-understand-node__form-label .el-select {
  width: 92px;
}

.workflow-image-understand-node__model-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--image-understand-space-sm);
  align-items: center;
  width: 100%;
}

.workflow-image-understand-node__model-row > * {
  min-width: 0;
}

.workflow-image-understand-node__tip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 50%;
}

.workflow-image-understand-node__switch-row strong,
.workflow-image-understand-node__switch-row small {
  display: block;
}

.workflow-image-understand-node__switch-row strong {
  font-size: var(--el-font-size-extra-small);
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.workflow-image-understand-node__switch-row small {
  margin-top: var(--image-understand-space-2xs);
  font-size: 11px;
  font-weight: 400;
  line-height: 14px;
  color: var(--el-text-color-placeholder);
}
</style>
