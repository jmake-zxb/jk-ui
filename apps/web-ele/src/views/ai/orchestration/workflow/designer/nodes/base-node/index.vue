<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { EditPen, Operation } from '@element-plus/icons-vue';
import {
  ElButton,
  ElCheckbox,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElRadio,
  ElRadioGroup,
  ElSwitch,
  ElTooltip,
} from 'element-plus';

import NodeContainer from '../../common/NodeContainer.vue';
import ApiInputFieldTable from './component/ApiInputFieldTable.vue';
import {
  defaultUploadSetting,
  emitGraphEvent,
  ensureBaseNodeProperties,
  updateProperties,
} from './component/base-node-utils';
import ChatFieldTable from './component/ChatFieldTable.vue';
import FileUploadSettingDialog from './component/FileUploadSettingDialog.vue';
import LocalModelSelect from './component/LocalModelSelect.vue';
import LongTermSettingDialog from './component/LongTermSettingDialog.vue';
import ModelParamSettingDialog from './component/ModelParamSettingDialog.vue';
import PrologueMagnifyDialog from './component/PrologueMagnifyDialog.vue';
import UserInputFieldTable from './component/UserInputFieldTable.vue';

const props = defineProps<{ nodeModel: any; renderVersion?: number }>();
const nodeModel = computed(
  () =>
    props.nodeModel?.graphModel?.getNodeModelById?.(props.nodeModel.id) ||
    props.nodeModel,
);

const fileUploadSettingDialogRef =
  ref<InstanceType<typeof FileUploadSettingDialog>>();
const longTermParamDialogRef =
  ref<InstanceType<typeof ModelParamSettingDialog>>();
const longTermSettingDialogRef =
  ref<InstanceType<typeof LongTermSettingDialog>>();
const prologueMagnifyDialogRef =
  ref<InstanceType<typeof PrologueMagnifyDialog>>();
const ttsParamDialogRef = ref<InstanceType<typeof ModelParamSettingDialog>>();
ensureBaseNodeProperties(nodeModel.value);

const formData = ref<Record<string, any>>({
  ...nodeModel.value.properties.node_data,
});

function syncFormDataFromModel() {
  ensureBaseNodeProperties(nodeModel.value);
  formData.value = { ...nodeModel.value.properties.node_data };
}

function saveNodeData(nextData: Record<string, any>) {
  formData.value = nextData;
  updateProperties(nodeModel.value, { node_data: nextData }, ['node_data']);
}

function patchData(key: string, value: any) {
  const nextData = { ...formData.value, [key]: value };
  if (key === 'file_upload_enable' && value && !nextData.file_upload_setting) {
    nextData.file_upload_setting = { ...defaultUploadSetting };
  }
  if (key === 'tts_model_enable' && !value) {
    nextData.tts_autoplay = false;
    nextData.tts_model_id = '';
    nextData.tts_type = 'BROWSER';
  }
  if (key === 'stt_model_enable' && !value) {
    nextData.stt_autosend = false;
    nextData.stt_model_id = '';
  }
  saveNodeData(nextData);
  if (key === 'file_upload_enable')
    emitGraphEvent(nodeModel.value, 'refreshFileUploadConfig');
  if (key === 'long_term_enable')
    emitGraphEvent(nodeModel.value, 'refreshLongTermConfig');
  if (key === 'long_term_enable')
    emitGraphEvent(nodeModel.value, 'chatFieldList');
}

function openFileUploadSettingDialog() {
  fileUploadSettingDialogRef.value?.open(
    formData.value.file_upload_setting || defaultUploadSetting,
  );
}

function refreshFileUploadForm(data: any) {
  saveNodeData({ ...formData.value, file_upload_setting: data });
  emitGraphEvent(nodeModel.value, 'refreshFileUploadConfig');
}

function openPrologueDialog() {
  prologueMagnifyDialogRef.value?.open(formData.value.prologue || '');
}

function refreshPrologue(value: string) {
  patchData('prologue', value);
}

function openLongTermSettingDialog() {
  longTermSettingDialogRef.value?.open(
    formData.value.long_term_trigger_type,
    formData.value.long_term_trigger_setting,
  );
}

function refreshLongTermSetting(data: {
  trigger_setting: Record<string, any>;
  trigger_type: string;
}) {
  saveNodeData({
    ...formData.value,
    long_term_trigger_setting: data.trigger_setting,
    long_term_trigger_type: data.trigger_type,
  });
}

function openLongTermParamDialog() {
  if (!formData.value.long_term_model_id) return;
  longTermParamDialogRef.value?.open(
    formData.value.long_term_model_id,
    formData.value.long_term_model_params_setting,
  );
}

function refreshLongTermParams(data: Record<string, any>) {
  saveNodeData({ ...formData.value, long_term_model_params_setting: data });
}

function openTtsParamDialog() {
  if (!formData.value.tts_model_id || formData.value.tts_type !== 'TTS') return;
  ttsParamDialogRef.value?.open(
    formData.value.tts_model_id,
    formData.value.tts_model_params_setting,
  );
}

function refreshTtsParams(data: Record<string, any>) {
  saveNodeData({ ...formData.value, tts_model_params_setting: data });
}

function onLongTermModelChange(modelId: number | string | undefined) {
  patchData('long_term_model_id', modelId);
  if (modelId) {
    longTermParamDialogRef.value?.reset_default(String(modelId));
  } else {
    refreshLongTermParams({});
  }
}

function onTtsModelChange(modelId: number | string | undefined) {
  patchData('tts_model_id', modelId);
  if (modelId && formData.value.tts_type === 'TTS') {
    ttsParamDialogRef.value?.reset_default(String(modelId));
  } else {
    refreshTtsParams({});
  }
}

function validationError(errMessage: string) {
  return Object.assign(new Error(errMessage), {
    errMessage,
    node: nodeModel.value,
  });
}

function validate() {
  if (!`${formData.value.name || ''}`.trim()) {
    return Promise.reject(validationError('应用名称不能为空'));
  }
  if (formData.value.long_term_enable && !formData.value.long_term_model_id) {
    return Promise.reject(validationError('请选择长期记忆模型'));
  }
  if (formData.value.stt_model_enable && !formData.value.stt_model_id) {
    return Promise.reject(validationError('请选择语音输入模型'));
  }
  if (
    formData.value.tts_model_enable &&
    formData.value.tts_type === 'TTS' &&
    !formData.value.tts_model_id
  ) {
    return Promise.reject(validationError('请选择语音播放模型'));
  }
  const fieldList = nodeModel.value.properties?.user_input_field_list || [];
  for (const field of fieldList) {
    for (const condition of field.visibility_rules?.conditions || []) {
      if (!Array.isArray(condition.field) || condition.field.length < 2)
        continue;
      const isBaseField =
        condition.field[0] === nodeModel.value.id ||
        condition.field[0] === 'base-node';
      if (
        isBaseField &&
        !fieldList.some((item: any) => item.field === condition.field[1])
      ) {
        return Promise.reject(
          validationError('用户输入显示条件引用了不存在的字段'),
        );
      }
    }
  }
  return Promise.resolve();
}

onMounted(() => {
  nodeModel.value.validate = validate;
});

watch(() => props.renderVersion, syncFormDataFromModel);
</script>

<template>
  <NodeContainer :node-model="nodeModel" :render-version="renderVersion">
    <ElForm
      :model="formData"
      class="workflow-base-node"
      label-position="top"
      @submit.prevent
    >
      <section class="workflow-base-node__panel">
        <div class="workflow-base-node__panel-head">基本信息</div>
        <ElFormItem label="名称" required>
          <ElInput
            :model-value="formData.name"
            maxlength="64"
            placeholder="请输入应用名称"
            show-word-limit
            @blur="patchData('name', `${formData.name || ''}`.trim())"
            @update:model-value="patchData('name', $event)"
          />
        </ElFormItem>
        <ElFormItem label="描述">
          <ElInput
            :model-value="formData.desc"
            maxlength="256"
            placeholder="请输入应用描述"
            show-word-limit
            type="textarea"
            :rows="2"
            @update:model-value="patchData('desc', $event)"
          />
        </ElFormItem>
        <ElFormItem label="开场白">
          <template #label>
            <div class="workflow-base-node__form-label">
              <span>开场白</span>
              <ElButton
                size="small"
                text
                type="primary"
                @click="openPrologueDialog"
              >
                <ElIcon><EditPen /></ElIcon>
              </ElButton>
            </div>
          </template>
          <ElInput
            :model-value="formData.prologue"
            placeholder="请输入对话开场白"
            type="textarea"
            :rows="3"
            @update:model-value="patchData('prologue', $event)"
          />
        </ElFormItem>
      </section>

      <section class="workflow-base-node__panel">
        <div class="workflow-base-node__switch-row">
          <div>
            <strong>长期记忆</strong>
            <small>开启后开始节点会输出 memory 字段</small>
            <ElTooltip
              content="此处输出的字段为 {{开始节点.memory}}"
              placement="right"
            >
              <span class="workflow-base-node__tip">?</span>
            </ElTooltip>
          </div>
          <div class="workflow-base-node__switch-actions">
            <ElButton
              v-if="formData.long_term_enable"
              size="small"
              text
              type="primary"
              @click="openLongTermSettingDialog"
            >
              <ElIcon><Operation /></ElIcon>
            </ElButton>
            <ElSwitch
              :model-value="!!formData.long_term_enable"
              size="small"
              @update:model-value="patchData('long_term_enable', $event)"
            />
          </div>
        </div>
        <div
          v-if="formData.long_term_enable"
          class="workflow-base-node__model-row"
        >
          <LocalModelSelect
            :model-value="formData.long_term_model_id"
            model-type='LLM'
            placeholder="请选择长期记忆模型"
            @update:model-value="onLongTermModelChange"
          />
          <ElButton
            size="small"
            :disabled="!formData.long_term_model_id"
            @click="openLongTermParamDialog"
          >
            <ElIcon><Operation /></ElIcon>
          </ElButton>
        </div>
        <div class="workflow-base-node__switch-row">
          <div class="workflow-base-node__label-with-tip">
            <div>
              <strong>文件上传</strong>
              <small>允许对话入口上传文档、图片、音频或视频</small>
            </div>
            <ElTooltip
              content="开启后可配置文件类型、大小、数量和上传方式。"
              placement="right"
            >
              <span class="workflow-base-node__tip">?</span>
            </ElTooltip>
          </div>
          <div class="workflow-base-node__switch-actions">
            <ElButton
              v-if="formData.file_upload_enable"
              text
              type="primary"
              @click="openFileUploadSettingDialog"
            >
              <ElIcon><Operation /></ElIcon>
            </ElButton>
            <ElSwitch
              :model-value="!!formData.file_upload_enable"
              size="small"
              @update:model-value="patchData('file_upload_enable', $event)"
            />
          </div>
        </div>
      </section>

      <section class="workflow-base-node__panel">
        <UserInputFieldTable
          :node-model="nodeModel"
          :render-version="renderVersion"
        />
      </section>
      <section class="workflow-base-node__panel">
        <ApiInputFieldTable
          :node-model="nodeModel"
          :render-version="renderVersion"
        />
      </section>
      <section class="workflow-base-node__panel">
        <ChatFieldTable
          :node-model="nodeModel"
          :render-version="renderVersion"
        />
      </section>

      <section class="workflow-base-node__panel">
        <div class="workflow-base-node__switch-row">
          <div>
            <strong>语音输入</strong>
            <small>开启语音转文字入口</small>
          </div>
          <div class="workflow-base-node__switch-actions">
            <ElCheckbox
              v-if="formData.stt_model_enable"
              :model-value="!!formData.stt_autosend"
              @update:model-value="patchData('stt_autosend', $event)"
            >
              自动发送
            </ElCheckbox>
            <ElSwitch
              :model-value="!!formData.stt_model_enable"
              size="small"
              @update:model-value="patchData('stt_model_enable', $event)"
            />
          </div>
        </div>
        <div
          v-if="formData.stt_model_enable"
          class="workflow-base-node__model-row"
        >
          <LocalModelSelect
            :model-value="formData.stt_model_id"
            model-type="STT"
            placeholder="请选择语音输入模型"
            @update:model-value="patchData('stt_model_id', $event)"
          />
        </div>
        <div class="workflow-base-node__switch-row">
          <div>
            <strong>语音播放</strong>
            <small>开启回复朗读能力</small>
          </div>
          <div class="workflow-base-node__switch-actions">
            <ElCheckbox
              v-if="formData.tts_model_enable"
              :model-value="!!formData.tts_autoplay"
              @update:model-value="patchData('tts_autoplay', $event)"
            >
              自动播放
            </ElCheckbox>
            <ElSwitch
              :model-value="!!formData.tts_model_enable"
              size="small"
              @update:model-value="patchData('tts_model_enable', $event)"
            />
          </div>
        </div>
        <div
          v-if="formData.tts_model_enable"
          class="workflow-base-node__voice-play"
        >
          <ElRadioGroup
            :model-value="formData.tts_type || 'BROWSER'"
            @update:model-value="patchData('tts_type', $event)"
          >
            <ElRadio value="BROWSER">浏览器播放</ElRadio>
            <ElRadio value="TTS">TTS 模型</ElRadio>
          </ElRadioGroup>
          <div
            v-if="formData.tts_type === 'TTS'"
            class="workflow-base-node__model-row"
          >
            <LocalModelSelect
              :model-value="formData.tts_model_id"
              model-type="TTS"
              placeholder="请选择语音播放模型"
              @update:model-value="onTtsModelChange"
            />
            <ElButton
              size="small"
              :disabled="!formData.tts_model_id"
              @click="openTtsParamDialog"
            >
              <ElIcon><Operation /></ElIcon>
            </ElButton>
          </div>
        </div>
      </section>
    </ElForm>
    <FileUploadSettingDialog
      ref="fileUploadSettingDialogRef"
      :node-model="nodeModel"
      @refresh="refreshFileUploadForm"
    />
    <PrologueMagnifyDialog
      ref="prologueMagnifyDialogRef"
      @refresh="refreshPrologue"
    />
    <ModelParamSettingDialog
      ref="longTermParamDialogRef"
      @refresh="refreshLongTermParams"
    />
    <ModelParamSettingDialog
      ref="ttsParamDialogRef"
      @refresh="refreshTtsParams"
    />
    <LongTermSettingDialog
      ref="longTermSettingDialogRef"
      @refresh="refreshLongTermSetting"
    />
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-base-node,
.workflow-base-node__panel,
.workflow-base-node__voice-play {
  display: grid;
  gap: 6px;
}

.workflow-base-node__panel {
  padding: 6px 8px;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-base-node :deep(.el-form-item) {
  margin-bottom: 6px;
}

.workflow-base-node :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.workflow-base-node :deep(.el-form-item__label) {
  margin-bottom: 3px;
  font-size: 12px;
  line-height: 16px;
}

.workflow-base-node :deep(.el-input__wrapper) {
  min-height: 28px;
}

.workflow-base-node :deep(.el-textarea__inner) {
  min-height: 0 !important;
  padding-block: 4px;
  line-height: 18px;
}

.workflow-base-node__panel-head,
.workflow-base-node__switch-row,
.workflow-base-node__form-label {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.workflow-base-node__form-label {
  width: 100%;
}

.workflow-base-node__model-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
}

.workflow-base-node__switch-row strong,
.workflow-base-node__switch-row small {
  display: block;
}

.workflow-base-node__switch-row small {
  margin-top: 1px;
  font-size: 11px;
  font-weight: 400;
  line-height: 14px;
  color: var(--el-text-color-placeholder);
}

.workflow-base-node__label-with-tip,
.workflow-base-node__switch-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.workflow-base-node__switch-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.workflow-base-node__tip {
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
