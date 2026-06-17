<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { ElForm, ElFormItem, ElInput, ElSwitch } from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

import { syncNodeProperties } from '../../common/node-inline-update';
import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';

type ApplicationInputField = Record<string, unknown> & {
  field?: unknown;
  is_required?: boolean;
  label?: unknown;
  required?: boolean;
  value?: unknown;
  variable?: unknown;
};

type ApplicationNodeData = Record<string, unknown> & {
  api_input_field_list?: ApplicationInputField[];
  appId?: number | string;
  application_id?: number | string;
  applicationId?: number | string;
  audio_list?: unknown;
  document_list?: unknown;
  image_list?: unknown;
  is_result?: boolean;
  message?: unknown;
  messageRef?: unknown[];
  question?: unknown;
  question_reference_address?: unknown[];
  targetApplicationId?: number | string;
  user_input_field_list?: ApplicationInputField[];
  video_list?: unknown;
};

type FieldListKey = 'api_input_field_list' | 'user_input_field_list';

const props = defineProps<{ nodeModel: any; renderVersion?: number }>();
const nodeRenderVersion = ref(0);
const formData = ref<ApplicationNodeData>(
  normalizeNodeData(props.nodeModel.properties?.node_data),
);

const mediaFields = [
  {
    camelKey: 'documentList',
    key: 'document_list',
    label: '文档',
    placeholder: '选择文档变量',
  },
  {
    camelKey: 'imageList',
    key: 'image_list',
    label: '图片',
    placeholder: '选择图片变量',
  },
  {
    camelKey: 'audioList',
    key: 'audio_list',
    label: '音频',
    placeholder: '选择音频变量',
  },
  {
    camelKey: 'videoList',
    key: 'video_list',
    label: '视频',
    placeholder: '选择视频变量',
  },
];

const inputFields = computed(() => [
  ...fieldRows('api_input_field_list'),
  ...fieldRows('user_input_field_list'),
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(data: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function textValue(value: unknown) {
  return `${value ?? ''}`.trim();
}

function hasReferenceValue(value: unknown) {
  return Array.isArray(value) ? value.length >= 2 : !!textValue(value);
}

function normalizeField(value: unknown): ApplicationInputField {
  return isRecord(value) ? cloneDeep(value) : {};
}

function normalizeNodeData(value: unknown): ApplicationNodeData {
  const source = isRecord(value) ? cloneDeep(value) : {};
  const next: ApplicationNodeData = {
    ...source,
    api_input_field_list: Array.isArray(source.api_input_field_list)
      ? source.api_input_field_list.map((item) => normalizeField(item))
      : [],
    user_input_field_list: Array.isArray(source.user_input_field_list)
      ? source.user_input_field_list.map((item) => normalizeField(item))
      : [],
  };
  const applicationId =
    source.applicationId ??
    source.application_id ??
    source.appId ??
    source.targetApplicationId;
  if (!hasOwn(next, 'applicationId') && applicationId !== undefined) {
    next.applicationId =
      typeof applicationId === 'number' || typeof applicationId === 'string'
        ? applicationId
        : `${applicationId || ''}`;
  }
  if (
    !hasOwn(next, 'question_reference_address') &&
    Array.isArray(source.messageRef)
  ) {
    next.question_reference_address = cloneDeep(source.messageRef);
  }
  return next;
}

function syncNodeData() {
  syncNodeProperties(
    props.nodeModel,
    { node_data: cloneDeep(formData.value) },
    ['node_data'],
  );
  nodeRenderVersion.value += 1;
}

function patchNodeData(patch: Partial<ApplicationNodeData>) {
  Object.entries(patch).forEach(([key, value]) => {
    set(formData.value, key, cloneDeep(value));
  });
  syncNodeData();
}

function patchData(key: keyof ApplicationNodeData, value: unknown) {
  patchNodeData({ [key]: value });
}

function patchApplicationId(value: number | string) {
  const patch: Partial<ApplicationNodeData> = { applicationId: value };
  if (hasOwn(formData.value, 'application_id')) patch.application_id = value;
  if (hasOwn(formData.value, 'appId')) patch.appId = value;
  if (hasOwn(formData.value, 'targetApplicationId')) {
    patch.targetApplicationId = value;
  }
  patchNodeData(patch);
}

function selectedApplicationId() {
  return (
    formData.value.applicationId ||
    formData.value.application_id ||
    formData.value.appId ||
    formData.value.targetApplicationId ||
    ''
  );
}

function selectedQuestionReference() {
  if (Array.isArray(formData.value.question_reference_address)) {
    return formData.value.question_reference_address;
  }
  if (Array.isArray(formData.value.messageRef))
    return formData.value.messageRef;
  return [];
}

function patchQuestionReference(value: unknown[]) {
  const patch: Partial<ApplicationNodeData> = {
    question_reference_address: value,
  };
  if (hasOwn(formData.value, 'messageRef')) patch.messageRef = value;
  patchNodeData(patch);
}

function mediaValue(key: string, camelKey: string) {
  const value = formData.value[key] ?? formData.value[camelKey];
  return Array.isArray(value) ? value : [];
}

function patchMedia(key: string, camelKey: string, value: unknown[]) {
  const patch: Partial<ApplicationNodeData> = { [key]: value };
  if (hasOwn(formData.value, camelKey)) patch[camelKey] = value;
  patchNodeData(patch);
}

function validationError(errMessage: string) {
  return Object.assign(new Error(errMessage), {
    errMessage,
    node: props.nodeModel,
  });
}

function validate() {
  const data = formData.value;
  if (!textValue(selectedApplicationId())) {
    return Promise.reject(validationError('请输入应用 ID'));
  }
  if (
    !hasReferenceValue(data.question_reference_address || data.messageRef) &&
    !textValue(data.message || data.question || data.input || data.content)
  ) {
    return Promise.reject(validationError('请选择消息变量'));
  }
  for (const row of inputFields.value) {
    if (!isRequired(row.field)) continue;
    if (!hasReferenceValue(row.field.value)) {
      return Promise.reject(
        validationError(`请选择必填输入：${fieldLabel(row.field)}`),
      );
    }
  }
  return Promise.resolve();
}

function fieldsOf(key: FieldListKey) {
  return Array.isArray(formData.value[key]) ? formData.value[key] : [];
}

function fieldRows(key: FieldListKey) {
  return fieldsOf(key).map((field, index) => ({ field, index, key }));
}

function patchInput(key: FieldListKey, index: number, value: unknown[]) {
  patchData(
    key,
    fieldsOf(key).map((field, fieldIndex) =>
      fieldIndex === index ? { ...field, value } : field,
    ),
  );
}

function labelText(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') return `${value}`;
  if (isRecord(value) && typeof value.label === 'string') return value.label;
  return '';
}

function fieldLabel(field: ApplicationInputField) {
  return (
    labelText(field.label) ||
    labelText(field.variable) ||
    textValue(field.field) ||
    '输入字段'
  );
}

function isRequired(field: ApplicationInputField) {
  return field.is_required === true || field.required === true;
}

onMounted(() => {
  syncNodeData();
  set(props.nodeModel, 'validate', validate);
});

onBeforeUnmount(() => {
  if (props.nodeModel.validate === validate) {
    set(props.nodeModel, 'validate', undefined);
  }
});
</script>

<template>
  <NodeContainer
    :node-model="nodeModel"
    :render-version="nodeRenderVersion + (renderVersion || 0)"
  >
    <ElForm :model="formData" label-position="top" @submit.prevent>
      <ElFormItem label="应用 ID" required>
        <ElInput
          :model-value="selectedApplicationId()"
          placeholder="目标应用标识"
          @update:model-value="patchApplicationId"
        />
      </ElFormItem>
      <ElFormItem label="用户消息" required>
        <NodeCascader
          :node-model="nodeModel"
          :model-value="selectedQuestionReference()"
          class="w-full"
          placeholder="选择消息变量"
          @update:model-value="patchQuestionReference"
        />
      </ElFormItem>
      <div class="workflow-node-panel">
        <div class="workflow-node-panel__title">多媒体输入（可选）</div>
        <ElFormItem
          v-for="field in mediaFields"
          :key="field.key"
          :label="field.label"
        >
          <NodeCascader
            :node-model="nodeModel"
            :model-value="mediaValue(field.key, field.camelKey)"
            class="w-full"
            :placeholder="field.placeholder"
            @update:model-value="patchMedia(field.key, field.camelKey, $event)"
          />
        </ElFormItem>
      </div>
      <div v-if="inputFields.length > 0" class="workflow-node-panel">
        <div class="workflow-node-panel__title">应用输入</div>
        <ElFormItem
          v-for="row in inputFields"
          :key="`${row.key}-${row.index}`"
          :label="fieldLabel(row.field)"
          :required="isRequired(row.field)"
        >
          <NodeCascader
            :node-model="nodeModel"
            :model-value="Array.isArray(row.field.value) ? row.field.value : []"
            class="w-full"
            placeholder="选择变量"
            @update:model-value="patchInput(row.key, row.index, $event)"
          />
        </ElFormItem>
      </div>
      <ElFormItem label="作为结果返回">
        <ElSwitch
          :model-value="!!formData.is_result"
          size="small"
          @update:model-value="patchData('is_result', $event)"
        />
      </ElFormItem>
    </ElForm>
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-node-panel {
  display: grid;
  gap: 8px;
  padding: 8px;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-node-panel__title {
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}
</style>
