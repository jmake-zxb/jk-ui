<script setup lang="ts">
import type { Ref } from 'vue';

import type { Dict } from '#/api/ai/type/common';
import type { FormField } from '#/components/dynamics-form/type';

import { computed, onMounted, ref } from 'vue';

import { get } from 'lodash-es';

import bus from '#/utils/bus';

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
const componentFormRef = ref<any>();

const itemValue = computed({
  get: () => props.modelValue,
  set: (value: any) => {
    emit('change', value);
    if (props.parentField) {
      bus.emit(`${props.parentField}.${props.formfield.field}`, value);
    } else {
      bus.emit(props.formfield.field, value);
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
      bus.on(key, (v: any) => {
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
      class="align-center flex rounded-md border"
      style="padding: 4px 10px"
    >
      <span :title="switchLabel" class="lighter mr-1">{{ switchLabel }}</span>
      <component
        ref="componentFormRef"
        :view="view"
        v-model="itemValue"
        :is="formfield.input_type"
        :form-field="formfield"
        :other-params="otherParams"
        :field="formfield.field"
        v-bind="attrs"
        :formfield-list="formfieldList"
        size="small"
      />
    </div>
    <component
      v-else
      ref="componentFormRef"
      :view="view"
      v-model="itemValue"
      :is="formfield.input_type"
      :form-field="formfield"
      :other-params="otherParams"
      :field="formfield.field"
      v-bind="attrs"
      :formfield-list="formfieldList"
    />
  </div>
</template>
<style lang="scss" scoped>
.inline-form-item {
  flex-shrink: 0;
}
</style>
