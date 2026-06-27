<script setup lang="ts">
import type { JsonRecord, SourceOption } from '../trigger-utils';

import { computed, watch } from 'vue';

import {
  ElCascader,
  ElForm,
  ElFormItem,
  ElInput,
  ElOption,
  ElSelect,
} from 'element-plus';

import {
  arrayValue,
  eventBodyFields,
  objectValue,
  textValue,
} from '../trigger-utils';

interface ParameterField {
  defaultValue?: unknown;
  key: string;
  label: string;
  required?: boolean;
}

const props = defineProps<{
  application?: JsonRecord | SourceOption;
  modelValue?: JsonRecord;
  trigger: JsonRecord;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: JsonRecord];
}>();

const parameter = computed(() => objectValue(props.modelValue));
const showSource = computed(
  () =>
    props.trigger.trigger_type === 'EVENT' &&
    eventBodyFields(props.trigger.trigger_setting).length > 0,
);
const referenceOptions = computed(() => [
  {
    children: eventBodyFields(props.trigger.trigger_setting).map((item) => ({
      label: item.field,
      value: item.field,
    })),
    label: 'body',
    value: 'body',
  },
]);
const baseNode = computed(() =>
  arrayValue<JsonRecord>(
    (props.application as JsonRecord | undefined)?.work_flow?.nodes,
  ).find((node) => ['base-node', 'start-node'].includes(String(node.type))),
);
const baseFields = computed<ParameterField[]>(() => {
  const result: ParameterField[] = [
    { defaultValue: '', key: 'question', label: 'Question', required: true },
  ];
  const nodeData = objectValue(baseNode.value?.properties?.node_data);
  const fileSetting = objectValue(nodeData.file_upload_setting);
  const uploadFields: Array<[string, string]> = [
    ['document_list', '文档'],
    ['image_list', '图片'],
    ['audio_list', '音频'],
    ['video_list', '视频'],
    ['other_list', '其他文件'],
  ];
  if (nodeData.file_upload_enable) {
    for (const [key, label] of uploadFields) {
      if (fileSetting[key]) {
        result.push({
          defaultValue: '[]',
          key,
          label,
          required: true,
        });
      }
    }
  }
  return result;
});
const apiFields = computed<ParameterField[]>(() =>
  fieldList(baseNode.value?.properties?.api_input_field_list, 'variable'),
);
const userFields = computed<ParameterField[]>(() =>
  fieldList(baseNode.value?.properties?.user_input_field_list, 'field'),
);

function fieldList(value: unknown, primaryKey: string): ParameterField[] {
  return arrayValue<JsonRecord>(value)
    .map((item) => {
      const key = textValue(
        item[primaryKey] || item.field || item.variable || item.name,
      );
      return key
        ? {
            defaultValue: item.default_value ?? item.defaultValue ?? '',
            key,
            label: fieldLabel(item, key),
            required: Boolean(item.is_required ?? item.required),
          }
        : undefined;
    })
    .filter(Boolean) as ParameterField[];
}

function fieldLabel(field: JsonRecord, fallback: string) {
  const label = field.label;
  if (typeof label === 'string') return label;
  if (label && typeof label === 'object') {
    return textValue(
      (label as JsonRecord).label || (label as JsonRecord).value,
      fallback,
    );
  }
  return textValue(field.name || field.variable || field.field, fallback);
}

function ensureFields(forceCustom = false) {
  const next = { ...parameter.value };
  let changed = false;
  for (const field of baseFields.value) {
    changed = ensureField(next, field, forceCustom) || changed;
  }
  changed =
    ensureContainerFields(
      next,
      'api_input_field_list',
      apiFields.value,
      forceCustom,
    ) || changed;
  changed =
    ensureContainerFields(
      next,
      'user_input_field_list',
      userFields.value,
      forceCustom,
    ) || changed;
  if (changed) emit('update:modelValue', next);
}

function ensureContainerFields(
  target: JsonRecord,
  containerKey: string,
  fields: ParameterField[],
  forceCustom: boolean,
) {
  if (fields.length === 0) return false;
  const container = objectValue(target[containerKey]);
  let changed = target[containerKey] !== container;
  for (const field of fields) {
    changed = ensureField(container, field, forceCustom) || changed;
  }
  target[containerKey] = container;
  return changed;
}

function ensureField(
  target: JsonRecord,
  field: ParameterField,
  forceCustom: boolean,
) {
  const current = objectValue(target[field.key]);
  if (Object.keys(current).length === 0) {
    target[field.key] = { source: 'custom', value: field.defaultValue ?? '' };
    return true;
  }
  if (forceCustom && current.source !== 'custom') {
    target[field.key] = { ...current, source: 'custom' };
    return true;
  }
  return false;
}

watch(
  () => [props.application, props.modelValue, showSource.value],
  () => ensureFields(!showSource.value),
  { immediate: true },
);
</script>

<template>
  <ElForm
    :model="parameter"
    class="parameter-form"
    label-position="top"
    @submit.prevent
  >
    <template v-for="field in baseFields" :key="field.key">
      <ElFormItem
        v-if="parameter[field.key]"
        :label="field.label"
        :required="field.required"
      >
        <template #label>
          <div class="parameter-label">
            <span>{{ field.label }}</span>
            <ElSelect
              v-if="showSource"
              v-model="parameter[field.key].source"
              size="small"
              class="source-select"
            >
              <ElOption label="引用" value="reference" />
              <ElOption label="自定义" value="custom" />
            </ElSelect>
          </div>
        </template>
        <ElCascader
          v-if="parameter[field.key].source === 'reference'"
          v-model="parameter[field.key].value"
          :options="referenceOptions"
          class="full"
        />
        <ElInput v-else v-model="parameter[field.key].value" />
      </ElFormItem>
    </template>

    <template v-for="field in apiFields" :key="`api-${field.key}`">
      <ElFormItem
        v-if="parameter.api_input_field_list?.[field.key]"
        :label="field.label"
        :required="field.required"
      >
        <template #label>
          <div class="parameter-label">
            <span>{{ field.label }}</span>
            <ElSelect
              v-if="showSource"
              v-model="parameter.api_input_field_list[field.key].source"
              size="small"
              class="source-select"
            >
              <ElOption label="引用" value="reference" />
              <ElOption label="自定义" value="custom" />
            </ElSelect>
          </div>
        </template>
        <ElCascader
          v-if="
            parameter.api_input_field_list[field.key].source === 'reference'
          "
          v-model="parameter.api_input_field_list[field.key].value"
          :options="referenceOptions"
          class="full"
        />
        <ElInput
          v-else
          v-model="parameter.api_input_field_list[field.key].value"
        />
      </ElFormItem>
    </template>

    <template v-for="field in userFields" :key="`user-${field.key}`">
      <ElFormItem
        v-if="parameter.user_input_field_list?.[field.key]"
        :label="field.label"
        :required="field.required"
      >
        <template #label>
          <div class="parameter-label">
            <span>{{ field.label }}</span>
            <ElSelect
              v-if="showSource"
              v-model="parameter.user_input_field_list[field.key].source"
              size="small"
              class="source-select"
            >
              <ElOption label="引用" value="reference" />
              <ElOption label="自定义" value="custom" />
            </ElSelect>
          </div>
        </template>
        <ElCascader
          v-if="
            parameter.user_input_field_list[field.key].source === 'reference'
          "
          v-model="parameter.user_input_field_list[field.key].value"
          :options="referenceOptions"
          class="full"
        />
        <ElInput
          v-else
          v-model="parameter.user_input_field_list[field.key].value"
        />
      </ElFormItem>
    </template>
  </ElForm>
</template>

<style scoped lang="scss">
.parameter-form {
  width: 100%;
}

.parameter-label {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.source-select {
  width: 92px;
}

.full {
  width: 100%;
}
</style>
