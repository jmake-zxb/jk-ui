<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { Operation } from '@element-plus/icons-vue';
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

import { syncNodeProperties } from '../../common/node-inline-update';
import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';
import JsonParamSettingDialog from '../base-node/component/JsonParamSettingDialog.vue';
import LocalModelSelect from '../base-node/component/LocalModelSelect.vue';

type ModelSource = 'custom' | 'reference';
type NodeData = Record<string, unknown> & {
  audio_list: unknown[];
  is_result: boolean;
  model_params_setting: Record<string, unknown>;
  stt_model_id: number | string;
  stt_model_id_reference: unknown[];
  stt_model_id_type: ModelSource;
};
type WorkflowNodeModel = {
  graphModel?: {
    eventCenter?: {
      emit?: (name: string, payload: Record<string, unknown>) => void;
    };
  };
  id: string;
  properties: Record<string, unknown>;
  updateWorkflowProperties?: (
    patch: Record<string, unknown>,
    fields?: string[],
  ) => void;
  validate?: () => Promise<void>;
};

const props = defineProps<{ nodeModel: WorkflowNodeModel }>();
const nodeModel = props.nodeModel;
const modelCascaderRef = ref<InstanceType<typeof NodeCascader>>();
const audioCascaderRef = ref<InstanceType<typeof NodeCascader>>();
const paramDialogRef = ref<InstanceType<typeof JsonParamSettingDialog>>();
const formData = ref<NodeData>(
  normalizeNodeData(nodeModel.properties?.node_data),
);

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
function normalizeNodeData(value: unknown): NodeData {
  const source = isRecord(value) ? cloneDeep(value) : {};
  return {
    ...source,
    audio_list: Array.isArray(source.audio_list)
      ? cloneDeep(source.audio_list)
      : [],
    is_result: typeof source.is_result === 'boolean' ? source.is_result : true,
    model_params_setting: isRecord(source.model_params_setting)
      ? cloneDeep(source.model_params_setting)
      : {},
    stt_model_id:
      typeof source.stt_model_id === 'number' ||
      typeof source.stt_model_id === 'string'
        ? source.stt_model_id
        : '',
    stt_model_id_reference: Array.isArray(source.stt_model_id_reference)
      ? cloneDeep(source.stt_model_id_reference)
      : [],
    stt_model_id_type:
      source.stt_model_id_type === 'reference' ? 'reference' : 'custom',
  };
}
function validationError(errMessage: string) {
  return Object.assign(new Error(errMessage), { errMessage, node: nodeModel });
}
function syncNodeData() {
  const nodeData = cloneDeep(formData.value);
  syncNodeProperties(nodeModel, { node_data: nodeData }, ['node_data']);
}
function patchData(key: keyof NodeData, value: unknown) {
  set(formData.value, key, cloneDeep(value));
  syncNodeData();
}
function patchModelType(value: ModelSource) {
  set(formData.value, 'stt_model_id_type', value);
  set(formData.value, 'stt_model_id_reference', []);
  syncNodeData();
}
function patchModelId(value: number | string | undefined) {
  set(formData.value, 'stt_model_id', value ?? '');
  if (!value) set(formData.value, 'model_params_setting', {});
  syncNodeData();
}
function openParamDialog() {
  paramDialogRef.value?.open(
    formData.value.model_params_setting,
    '语音转文本模型参数',
  );
}
function refreshParams(value: Record<string, unknown>) {
  patchData('model_params_setting', value);
}
async function validate() {
  try {
    if (formData.value.stt_model_id_type === 'reference') {
      if (!hasReferenceValue(formData.value.stt_model_id_reference))
        throw validationError('请选择语音模型变量');
      await modelCascaderRef.value?.validate?.();
    } else if (!textValue(formData.value.stt_model_id)) {
      throw validationError('请选择语音转文本模型');
    }
    if (!hasReferenceValue(formData.value.audio_list))
      throw validationError('请选择音频变量');
    await audioCascaderRef.value?.validate?.();
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
  <NodeContainer :node-model="nodeModel">
    <ElForm
      :model="formData"
      class="workflow-speech-node"
      label-position="top"
      @submit.prevent
    >
      <section class="workflow-speech-node__panel">
        <ElFormItem label="语音转文本模型" required>
          <template #label>
            <div class="workflow-speech-node__form-label">
              <span>语音转文本模型</span>
              <ElSelect
                :model-value="formData.stt_model_id_type"
                :teleported="false"
                size="small"
                @update:model-value="patchModelType"
              >
                <ElOption label="自定义" value="custom" />
                <ElOption label="变量引用" value="reference" />
              </ElSelect>
            </div>
          </template>
          <div class="workflow-speech-node__model-row">
            <LocalModelSelect
              v-if="formData.stt_model_id_type === 'custom'"
              :model-value="formData.stt_model_id"
              model-type="STT"
              placeholder="请选择语音转文本模型"
              @update:model-value="patchModelId"
            />
            <NodeCascader
              v-else
              ref="modelCascaderRef"
              :model-value="formData.stt_model_id_reference"
              :node-model="nodeModel"
              class="w-full"
              placeholder="选择模型变量"
              @update:model-value="patchData('stt_model_id_reference', $event)"
            />
            <ElButton
              :disabled="
                formData.stt_model_id_type !== 'custom' ||
                !formData.stt_model_id
              "
              size="small"
              @click="openParamDialog"
            >
              <ElIcon><Operation /></ElIcon>
            </ElButton>
          </div>
        </ElFormItem>
        <ElFormItem label="模型参数">
          <ElInput :model-value="modelParamsSummary" disabled />
        </ElFormItem>
        <ElFormItem label="音频" required>
          <template #label>
            <div class="workflow-speech-node__label-with-tip">
              <span>音频</span>
              <ElTooltip
                content="请选择上游节点输出的音频文件变量。"
                placement="right"
              >
                <span class="workflow-speech-node__tip">?</span>
              </ElTooltip>
            </div>
          </template>
          <NodeCascader
            ref="audioCascaderRef"
            :model-value="formData.audio_list"
            :node-model="nodeModel"
            class="w-full"
            placeholder="选择音频变量"
            @update:model-value="patchData('audio_list', $event)"
          />
        </ElFormItem>
      </section>
      <section class="workflow-speech-node__panel">
        <div class="workflow-speech-node__switch-row">
          <div>
            <strong>返回内容</strong><small>将识别文本作为工作流输出内容</small>
          </div>
          <ElSwitch
            :model-value="formData.is_result"
            size="small"
            @update:model-value="patchData('is_result', $event)"
          />
        </div>
      </section>
    </ElForm>
    <JsonParamSettingDialog ref="paramDialogRef" @refresh="refreshParams" />
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-speech-node,
.workflow-speech-node__panel {
  display: grid;
  gap: 6px;
}

.workflow-speech-node__panel {
  padding: 6px 8px;
  overflow: visible;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-speech-node :deep(.el-form-item) {
  margin-bottom: 6px;
}

.workflow-speech-node :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.workflow-speech-node__form-label,
.workflow-speech-node__switch-row,
.workflow-speech-node__label-with-tip {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.workflow-speech-node__model-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px;
  width: 100%;
}

.workflow-speech-node__switch-row strong,
.workflow-speech-node__switch-row small {
  display: block;
}

.workflow-speech-node__switch-row small {
  margin-top: 1px;
  font-size: 11px;
  font-weight: 400;
  line-height: 14px;
  color: var(--el-text-color-placeholder);
}

.workflow-speech-node__label-with-tip {
  justify-content: flex-start;
}

.workflow-speech-node__tip {
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
