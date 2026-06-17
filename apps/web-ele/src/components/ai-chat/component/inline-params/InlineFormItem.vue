<script setup lang="ts">
import type { Ref } from 'vue';

import type { FormField } from '#/components/dynamics-form/type';

import { computed, onMounted, ref } from 'vue';

import { get } from 'lodash-es';

import { aiChatBus } from '../../utils/bus';

export type { FormField };

export type Dict<T> = Record<string, T>;

const props = defineProps<{
  defaultItemWidth: string;
  formfield: FormField;
  formfieldList: Array<FormField>;
  formValue: Dict<any>;
  initDefaultData: (formItem: FormField) => void;
  modelValue: any;
  otherParams: any;
  parentField?: string;
  trigger: (
    trigger_field: string,
    trigger_value: any,
    trigger_setting: any,
    self: any,
    loading: Ref<boolean>,
  ) => void;
  view: boolean;
}>();

const emit = defineEmits(['change', 'changeLabel']);
const loading = ref<boolean>(false);
const componentFormRef = ref<any>(null);

const itemValue = computed({
  get: () => props.modelValue,
  set: (value: any) => {
    emit('change', value);
    if (props.parentField) {
      aiChatBus.emit(`${props.parentField}.${props.formfield.field}`, value);
    } else {
      aiChatBus.emit(props.formfield.field, value);
    }
  },
});

const attrs = computed(() => {
  const base = props.formfield.attrs || {};
  if (
    props.formfield.input_type === 'MultiSelect' ||
    props.formfield.input_type === 'Knowledge'
  ) {
    return {
      ...base,
      'collapse-tags': true,
      'collapse-tags-tooltip': true,
      'max-collapse-tags': 1,
    };
  }
  return base;
});

const switchLabel = computed(() => {
  const label =
    typeof props.formfield.label === 'string'
      ? props.formfield.label
      : props.formfield.label?.label || props.formfield.field;
  return label.length > 5 ? `${label.slice(0, 5)}…` : label;
});

const initTrigger = (self: any, trigger_field_dict?: Dict<any>) => {
  if (trigger_field_dict) {
    Object.keys(trigger_field_dict).forEach((key) => {
      const setting = trigger_field_dict[key];
      const triggerValues = setting.values;
      const value = get(props.formValue, key);
      if (triggerValues && triggerValues.length > 0) {
        if (triggerValues.includes(value)) {
          props.trigger(key, value, setting, self, loading);
        }
      } else {
        props.trigger(key, value, setting, self, loading);
      }
    });
  }
};

const onTrigger = (self: any, trigger_field_dict?: Dict<any>) => {
  if (trigger_field_dict) {
    Object.keys(trigger_field_dict).forEach((key) => {
      const setting = trigger_field_dict[key];
      const values: Array<any> = setting.values;
      aiChatBus.on(key, (v: any) => {
        if (values && values.length > 0) {
          if (values.includes(v)) {
            props.trigger(key, v, setting, self, loading);
          }
        } else {
          props.trigger(key, v, setting, self, loading);
        }
      });
    });
  }
};

onMounted(() => {
  props.initDefaultData(props.formfield);
  initTrigger(props.formfield, props.formfield.relation_trigger_field_dict);
  onTrigger(props.formfield, props.formfield.relation_trigger_field_dict);
});

defineExpose({
  validate: () => {
    if (
      props.formfield.trigger_type === 'CHILD_FORMS' &&
      componentFormRef.value
    ) {
      return componentFormRef.value.validate();
    }
    return Promise.resolve();
  },
});
</script>

<template>
  <div
    class="inline-form-item"
    v-loading="loading"
    :style="{
      width:
        formfield.input_type === 'SwitchInput' ||
        formfield.input_type === 'DatePicker'
          ? 'auto'
          : '150px',
    }"
  >
    <div
      v-if="formfield.input_type === 'SwitchInput'"
      class="align-center border-r-6 flex border"
      style="padding: 4px 10px"
    >
      <span :title="switchLabel" class="lighter g-mr-4">{{ switchLabel }}</span>
      <el-switch v-model="itemValue" size="small" />
    </div>
    <el-input
      v-else-if="formfield.input_type === 'TextInput'"
      v-model="itemValue"
      v-bind="attrs"
      :placeholder="
        typeof formfield.label === 'string'
          ? formfield.label
          : formfield.label?.label || formfield.field
      "
      size="small"
    />
    <el-input
      v-else-if="formfield.input_type === 'TextareaInput'"
      v-model="itemValue"
      type="textarea"
      :rows="2"
      v-bind="attrs"
      :placeholder="
        typeof formfield.label === 'string'
          ? formfield.label
          : formfield.label?.label || formfield.field
      "
      size="small"
    />
    <el-select
      v-else-if="formfield.input_type === 'SingleSelect'"
      v-model="itemValue"
      v-bind="attrs"
      :placeholder="
        typeof formfield.label === 'string'
          ? formfield.label
          : formfield.label?.label || formfield.field
      "
      size="small"
    >
      <el-option
        v-for="option in formfield.option_list"
        :key="option.value"
        :label="option.key"
        :value="option.value"
      />
    </el-select>
    <el-select
      v-else-if="formfield.input_type === 'MultiSelect'"
      v-model="itemValue"
      v-bind="attrs"
      collapse-tags
      collapse-tags-tooltip
      :max-collapse-tags="1"
      :placeholder="
        typeof formfield.label === 'string'
          ? formfield.label
          : formfield.label?.label || formfield.field
      "
      multiple
      size="small"
    >
      <el-option
        v-for="option in formfield.option_list"
        :key="option.value"
        :label="option.key"
        :value="option.value"
      />
    </el-select>
    <el-date-picker
      v-else-if="formfield.input_type === 'DatePicker'"
      v-model="itemValue"
      v-bind="attrs"
      :placeholder="
        typeof formfield.label === 'string'
          ? formfield.label
          : formfield.label?.label || formfield.field
      "
      size="small"
    />
    <el-input
      v-else
      v-model="itemValue"
      v-bind="attrs"
      :placeholder="
        typeof formfield.label === 'string'
          ? formfield.label
          : formfield.label?.label || formfield.field
      "
      size="small"
    />
  </div>
</template>

<style lang="scss" scoped>
.inline-form-item {
  flex-shrink: 0;
}

.g-mr-4 {
  margin-right: 4px;
}
</style>
