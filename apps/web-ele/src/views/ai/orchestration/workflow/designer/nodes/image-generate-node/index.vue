<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue';

import { EditPen, Operation } from '@element-plus/icons-vue';
import {
  ElButton,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTooltip,
} from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

import ModelParamSettingDialog from '../../../../applications/ModelParamSettingDialog.vue';
import { syncNodeProperties } from '../../common/node-inline-update';
import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';
import TextMagnifyDialog from '../ai-chat-node/component/TextMagnifyDialog.vue';
import LocalModelSelect from '../base-node/component/LocalModelSelect.vue';

type ModelSource = 'custom' | 'reference';
type TextKey = 'negative_prompt' | 'prompt';
type WorkflowMode = 'application' | 'application-loop' | 'tool' | string;
type NodeData = Record<string, unknown> & {
  dialogue_number: number;
  dialogue_type: string;
  is_result: boolean;
  model_id: number | string;
  model_id_reference: unknown[];
  model_id_type: ModelSource;
  model_params_setting: Record<string, unknown>;
  negative_prompt: string;
  prompt: string;
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

const defaultPrompt = '{{input}}';

const nodeModel = props.nodeModel;
const workflowMode = inject<WorkflowMode>('workflowMode', 'application');
const modelCascaderRef = ref<InstanceType<typeof NodeCascader>>();
const modelParamOpen = ref(false);
const textMagnifyDialogRef = ref<InstanceType<typeof TextMagnifyDialog>>();
const activeTextKey = ref<TextKey>('prompt');
const nodeRenderVersion = ref(0);
const formData = ref<NodeData>(
  normalizeNodeData(nodeModel.properties?.node_data),
);

const showReturnContent = computed(
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

function textValue(value: unknown) {
  return `${value ?? ''}`.trim();
}

function hasReferenceValue(value: unknown) {
  return Array.isArray(value) && value.length >= 2;
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function modelIdValue(value: unknown) {
  return typeof value === 'number' || typeof value === 'string' ? value : '';
}

function normalizeNodeData(value: unknown): NodeData {
  const source = isRecord(value) ? cloneDeep(value) : {};
  const sourceModelId = source.model_id ?? source.modelId;
  return {
    ...source,
    dialogue_number:
      typeof source.dialogue_number === 'number' ? source.dialogue_number : 0,
    dialogue_type: stringValue(source.dialogue_type, 'NODE_BASED'),
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
    negative_prompt: stringValue(source.negative_prompt),
    prompt: stringValue(source.prompt, defaultPrompt),
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

function openModelParamDialog() {
  modelParamOpen.value = true;
}

function refreshModelParams(value: Record<string, unknown>) {
  patchData('model_params_setting', value);
}

function openTextMagnifyDialog(key: TextKey, title: string) {
  activeTextKey.value = key;
  textMagnifyDialogRef.value?.open({
    key: 'prompt',
    title,
    value: `${formData.value[key] || ''}`,
  });
}

function submitTextMagnifyDialog(data: { value: string }) {
  patchData(activeTextKey.value, data.value);
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
      throw validationError('请选择图像生成模型');
    }

    if (!textValue(formData.value.prompt)) {
      throw validationError('请输入提示词');
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
      class="workflow-image-generate-node"
      label-position="top"
      @submit.prevent
    >
      <section class="workflow-image-generate-node__panel">
        <ElFormItem label="图像生成模型" required>
          <template #label>
            <div class="workflow-image-generate-node__form-label">
              <span>图像生成模型</span>
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
          <div class="workflow-image-generate-node__model-row">
            <LocalModelSelect
              v-if="formData.model_id_type === 'custom'"
              :model-value="formData.model_id"
              model-type="TTI"
              placeholder="请选择图像生成模型"
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

        <ElFormItem label="提示词" required>
          <template #label>
            <div class="workflow-image-generate-node__form-label">
              <span class="workflow-image-generate-node__label-with-tip">
                提示词
                <ElTooltip
                  content="描述要生成的图片内容，支持 {{节点.字段}} 引用。"
                  placement="right"
                >
                  <span class="workflow-image-generate-node__tip">?</span>
                </ElTooltip>
              </span>
              <ElButton
                size="small"
                text
                type="primary"
                @click="openTextMagnifyDialog('prompt', '提示词')"
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

        <ElFormItem label="反向提示词">
          <template #label>
            <div class="workflow-image-generate-node__form-label">
              <span class="workflow-image-generate-node__label-with-tip">
                反向提示词
                <ElTooltip
                  content="描述不希望图片中出现的内容。"
                  placement="right"
                >
                  <span class="workflow-image-generate-node__tip">?</span>
                </ElTooltip>
              </span>
              <ElButton
                size="small"
                text
                type="primary"
                @click="openTextMagnifyDialog('negative_prompt', '反向提示词')"
              >
                <ElIcon><EditPen /></ElIcon>
              </ElButton>
            </div>
          </template>
          <ElInput
            :model-value="formData.negative_prompt"
            type="textarea"
            :rows="4"
            placeholder="可选，描述不希望出现的内容"
            @update:model-value="patchData('negative_prompt', $event)"
          />
        </ElFormItem>
      </section>

      <section
        v-if="showReturnContent"
        class="workflow-image-generate-node__panel"
      >
        <div class="workflow-image-generate-node__switch-row">
          <div>
            <strong>返回内容</strong>
            <small>将生成图片作为工作流输出内容</small>
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
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-image-generate-node,
.workflow-image-generate-node__panel {
  display: grid;
  gap: 6px;
}

.workflow-image-generate-node__panel {
  padding: 6px 8px;
  overflow: visible;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-image-generate-node :deep(.el-form-item) {
  margin-bottom: 6px;
}

.workflow-image-generate-node :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.workflow-image-generate-node :deep(.el-form-item__label) {
  margin-bottom: 2px;
  font-size: var(--el-font-size-extra-small);
  line-height: 16px;
}

.workflow-image-generate-node :deep(.el-input__wrapper) {
  min-height: 28px;
}

.workflow-image-generate-node :deep(.el-textarea__inner) {
  min-height: 0 !important;
  padding-block: 4px;
  line-height: 18px;
}

.workflow-image-generate-node__form-label,
.workflow-image-generate-node__label-with-tip,
.workflow-image-generate-node__switch-row {
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
}

.workflow-image-generate-node__form-label,
.workflow-image-generate-node__switch-row {
  justify-content: space-between;
}

.workflow-image-generate-node__form-label {
  width: 100%;
  font-size: var(--el-font-size-extra-small);
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.workflow-image-generate-node__form-label .el-select {
  width: 92px;
}

.workflow-image-generate-node__model-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
  width: 100%;
}

.workflow-image-generate-node__model-row > * {
  min-width: 0;
}

.workflow-image-generate-node__tip {
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

.workflow-image-generate-node__switch-row strong,
.workflow-image-generate-node__switch-row small {
  display: block;
}

.workflow-image-generate-node__switch-row strong {
  font-size: var(--el-font-size-extra-small);
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.workflow-image-generate-node__switch-row small {
  margin-top: 1px;
  font-size: 11px;
  font-weight: 400;
  line-height: 14px;
  color: var(--el-text-color-placeholder);
}
</style>
