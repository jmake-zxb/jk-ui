<script setup lang="ts">
import type { FormInstance, FormItemRule, FormRules } from 'element-plus';

import type {
  InitParamOptionValue,
  InitParamValue,
  InitParamValues,
  NormalizedInitField,
} from './init-param-utils';

import type { ToolFieldSchema } from '#/api/ai/tools';

import { computed, ref } from 'vue';

import {
  ElDatePicker,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElInput,
  ElOption,
  ElRadioButton,
  ElRadioGroup,
  ElSelect,
  ElSlider,
  ElSwitch,
  ElTag,
} from 'element-plus';

import {
  isEmptyInitParamValue,
  isInvalidJsonInputValue,
  normalizeInitFields,
} from './init-param-utils';

type DatePickerModelValue =
  | Date
  | Date[]
  | null
  | number
  | number[]
  | string
  | string[]
  | undefined;
type DatePickerType =
  | 'date'
  | 'daterange'
  | 'dates'
  | 'datetime'
  | 'datetimerange'
  | 'month'
  | 'monthrange'
  | 'months'
  | 'week'
  | 'year'
  | 'yearrange'
  | 'years';

const props = withDefaults(
  defineProps<{
    fields?: ToolFieldSchema[];
    labelPosition?: 'left' | 'right' | 'top';
    modelValue?: InitParamValues;
    showEmpty?: boolean;
  }>(),
  {
    fields: () => [],
    labelPosition: 'top',
    modelValue: () => ({}),
    showEmpty: true,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: InitParamValues];
}>();

const datePickerTypes = new Set<string>([
  'date',
  'daterange',
  'dates',
  'datetime',
  'datetimerange',
  'month',
  'monthrange',
  'months',
  'week',
  'year',
  'yearrange',
  'years',
]);

const formRef = ref<FormInstance>();
const normalizedFields = computed(() => normalizeInitFields(props.fields));
const hasFields = computed(() => normalizedFields.value.length > 0);

const rules = computed<FormRules>(() => {
  const nextRules: FormRules = {};
  normalizedFields.value.forEach((field) => {
    const validator: FormItemRule['validator'] = (_rule, value, callback) => {
      if (field.required && isEmptyInitParamValue(value)) {
        callback(new Error(`请配置${field.label}`));
        return;
      }
      if (field.inputType === 'JsonInput' && isInvalidJsonInputValue(value)) {
        callback(new Error('请输入合法 JSON'));
        return;
      }
      callback();
    };
    nextRules[field.key] = [{ trigger: ['blur', 'change'], validator }];
  });
  return nextRules;
});

function patchValue(key: string, value: InitParamValue) {
  emit('update:modelValue', {
    ...props.modelValue,
    [key]: value,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function patchUnknownValue(key: string, value: unknown) {
  if (
    value === undefined ||
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string' ||
    Array.isArray(value) ||
    isRecord(value)
  ) {
    patchValue(key, value);
  }
}

function currentValue(key: string) {
  return props.modelValue[key];
}

function textValue(key: string) {
  const value = currentValue(key);
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return `${value}`;
  return JSON.stringify(value, null, 2);
}

function switchValue(key: string) {
  const value = currentValue(key);
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return false;
  return ['1', 'on', 'true', 'y', 'yes'].includes(`${value}`.toLowerCase());
}

function numberValue(key: string, fallback = 0) {
  const value = currentValue(key);
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function selectValue(key: string) {
  const value = currentValue(key);
  if (
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return value;
  }
  return '';
}

function multiSelectValue(key: string): InitParamOptionValue[] {
  const value = currentValue(key);
  if (!Array.isArray(value)) return [];
  const values: InitParamOptionValue[] = [];
  value.forEach((item) => {
    if (
      typeof item === 'boolean' ||
      typeof item === 'number' ||
      typeof item === 'string'
    ) {
      values.push(item);
    }
  });
  return values;
}

function attrValue(
  field: NormalizedInitField,
  names: string[],
  fallback: unknown,
) {
  for (const name of names) {
    const value = field.attrs[name];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

function numberAttr(
  field: NormalizedInitField,
  names: string[],
  fallback: number,
) {
  const value = attrValue(field, names, fallback);
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function stringAttr(
  field: NormalizedInitField,
  names: string[],
  fallback = '',
) {
  const value = attrValue(field, names, fallback);
  return typeof value === 'string' || typeof value === 'number'
    ? `${value}`
    : fallback;
}

function booleanAttr(
  field: NormalizedInitField,
  names: string[],
  fallback = false,
) {
  const value = attrValue(field, names, fallback);
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'on', 'true', 'y', 'yes'].includes(`${value}`.toLowerCase());
}

function rowsForJson(field: NormalizedInitField) {
  return numberAttr(field, ['rows'], 4);
}

function dateType(field: NormalizedInitField): DatePickerType {
  const value = stringAttr(field, ['type'], 'datetime');
  return datePickerTypes.has(value) ? (value as DatePickerType) : 'datetime';
}

function dateFormat(field: NormalizedInitField) {
  return stringAttr(field, ['format'], 'YYYY-MM-DD HH:mm:ss');
}

function dateValueFormat(field: NormalizedInitField) {
  return stringAttr(field, ['value-format', 'valueFormat'], dateFormat(field));
}

function dateModelValue(key: string): DatePickerModelValue {
  const value = currentValue(key);
  if (
    value === undefined ||
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    value instanceof Date
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    const values: string[] = [];
    value.forEach((item) => {
      if (typeof item === 'string' || typeof item === 'number')
        values.push(`${item}`);
      if (item instanceof Date) values.push(item.toISOString());
    });
    return values;
  }
  return undefined;
}

function validate() {
  if (!formRef.value) return Promise.resolve(true);
  return formRef.value.validate().catch(() => false);
}

defineExpose({ validate });
</script>

<template>
  <ElForm
    ref="formRef"
    class="init-dynamic-form"
    :label-position="labelPosition"
    :model="modelValue"
    require-asterisk-position="right"
    :rules="rules"
    @submit.prevent
  >
    <template v-if="hasFields">
      <ElFormItem
        v-for="field in normalizedFields"
        :key="field.key"
        :label="field.label"
        :prop="field.key"
        :required="field.required"
      >
        <template #label>
          <span class="init-dynamic-form__label">
            <span>{{ field.label }}</span>
            <ElTag size="small" type="info">{{ field.inputType }}</ElTag>
          </span>
        </template>

        <ElSelect
          v-if="field.inputType === 'SingleSelect'"
          class="init-dynamic-form__control"
          clearable
          filterable
          :model-value="selectValue(field.key)"
          :placeholder="
            stringAttr(field, ['placeholder'], `请选择${field.label}`)
          "
          :teleported="false"
          @update:model-value="(value) => patchValue(field.key, value)"
        >
          <ElOption
            v-for="option in field.options"
            :key="option.key"
            :label="option.label"
            :value="option.value"
          />
        </ElSelect>

        <ElSelect
          v-else-if="field.inputType === 'MultiSelect'"
          class="init-dynamic-form__control"
          clearable
          collapse-tags
          collapse-tags-tooltip
          filterable
          multiple
          :model-value="multiSelectValue(field.key)"
          :placeholder="
            stringAttr(field, ['placeholder'], `请选择${field.label}`)
          "
          :teleported="false"
          @update:model-value="(value) => patchValue(field.key, value)"
        >
          <ElOption
            v-for="option in field.options"
            :key="option.key"
            :label="option.label"
            :value="option.value"
          />
        </ElSelect>

        <ElRadioGroup
          v-else-if="field.inputType === 'RadioCard'"
          class="init-dynamic-form__radio-card"
          :model-value="selectValue(field.key)"
          @update:model-value="(value) => patchValue(field.key, value)"
        >
          <ElRadioButton
            v-for="option in field.options"
            :key="option.key"
            :label="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </ElRadioButton>
        </ElRadioGroup>

        <ElSwitch
          v-else-if="field.inputType === 'SwitchInput'"
          :model-value="switchValue(field.key)"
          @update:model-value="(value) => patchValue(field.key, value)"
        />

        <ElSlider
          v-else-if="field.inputType === 'Slider'"
          class="init-dynamic-form__control"
          :max="numberAttr(field, ['max'], 100)"
          :min="numberAttr(field, ['min'], 0)"
          :model-value="numberValue(field.key, numberAttr(field, ['min'], 0))"
          :show-input="booleanAttr(field, ['show-input', 'showInput'], true)"
          :step="numberAttr(field, ['step'], 1)"
          @update:model-value="(value) => patchValue(field.key, value)"
        />

        <ElDatePicker
          v-else-if="field.inputType === 'DatePicker'"
          class="init-dynamic-form__control"
          :format="dateFormat(field)"
          :model-value="dateModelValue(field.key)"
          :placeholder="
            stringAttr(field, ['placeholder'], `请选择${field.label}`)
          "
          :type="dateType(field)"
          :value-format="dateValueFormat(field)"
          @update:model-value="(value) => patchUnknownValue(field.key, value)"
        />

        <ElInput
          v-else-if="field.inputType === 'JsonInput'"
          class="init-dynamic-form__control"
          :model-value="textValue(field.key)"
          :placeholder="stringAttr(field, ['placeholder'], '{}')"
          :rows="rowsForJson(field)"
          type="textarea"
          @update:model-value="(value) => patchValue(field.key, value)"
        />

        <ElInput
          v-else
          class="init-dynamic-form__control"
          clearable
          :maxlength="numberAttr(field, ['maxlength', 'maxLength'], 200)"
          :minlength="numberAttr(field, ['minlength', 'minLength'], 0)"
          :model-value="textValue(field.key)"
          :placeholder="
            stringAttr(field, ['placeholder'], `请输入${field.label}`)
          "
          :show-password="field.inputType === 'PasswordInput'"
          @update:model-value="(value) => patchValue(field.key, value)"
        />

        <div v-if="field.desc" class="init-dynamic-form__help">
          {{ field.desc }}
        </div>
      </ElFormItem>
    </template>
    <ElEmpty
      v-else-if="showEmpty"
      description="暂无初始化参数字段"
      :image-size="48"
    />
  </ElForm>
</template>

<style scoped lang="scss">
.init-dynamic-form {
  --init-form-space-1: 4px;
  --init-form-space-2: 8px;
  --init-form-space-3: 12px;
  --init-form-radius: 6px;
}

.init-dynamic-form__label {
  display: inline-flex;
  gap: var(--init-form-space-2);
  align-items: center;
}

.init-dynamic-form__control {
  width: 100%;
}

.init-dynamic-form__help {
  margin-top: var(--init-form-space-1);
  font-size: calc(var(--font-size-base) * 0.75);
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.init-dynamic-form__radio-card {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--init-form-space-2);
  width: 100%;
}

.init-dynamic-form__radio-card :deep(.el-radio-button__inner) {
  width: 100%;
  border-left: var(--el-border);
  border-radius: var(--init-form-radius);
}

.init-dynamic-form__radio-card
  :deep(.el-radio-button:first-child .el-radio-button__inner),
.init-dynamic-form__radio-card
  :deep(.el-radio-button:last-child .el-radio-button__inner) {
  border-radius: var(--init-form-radius);
}
</style>
