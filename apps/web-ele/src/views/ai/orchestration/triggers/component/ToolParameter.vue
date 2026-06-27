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
  modelValue?: JsonRecord;
  tool?: JsonRecord | SourceOption;
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
    (props.tool as JsonRecord | undefined)?.work_flow?.nodes,
  ).find((node) =>
    ['base-node', 'start-node', 'tool-base-node'].includes(String(node.type)),
  ),
);
const inputFields = computed<ParameterField[]>(() =>
  fieldList((props.tool as JsonRecord | undefined)?.input_field_list, 'name'),
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
  for (const field of inputFields.value) {
    changed = ensureField(next, field, forceCustom) || changed;
  }
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
  () => [props.tool, props.modelValue, showSource.value],
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
    <template v-for="field in inputFields" :key="field.key">
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
