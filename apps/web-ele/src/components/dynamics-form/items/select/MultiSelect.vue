<script setup lang="ts">
import type { FormField } from '../../type';

import { computed } from 'vue';

import { ElOption, ElSelect } from 'element-plus';

import SelectHeader from '../common/SelectHeader.vue';

const props = defineProps<{
  field: string;
  formField: FormField;
  formfieldList?: Array<FormField>;
  formValue?: any;
  modelValue?: Array<any>;
  otherParams: any;
  view?: boolean;
}>();

const emit = defineEmits(['update:modelValue', 'change']);

const _modelValue = computed({
  get() {
    if (props.modelValue) {
      return props.modelValue;
    }
    return [];
  },
  set($event) {
    emit('update:modelValue', $event);
  },
});
const textField = computed(() => {
  return props.formField.text_field || 'key';
});

const valueField = computed(() => {
  return props.formField.value_field || 'value';
});

const option_list = computed(() => {
  return props.formField.option_list || [];
});

const label = (option: any) => {
  return option[textField.value];
};
</script>
<template>
  <ElSelect
    class="m-2"
    multiple
    filterable
    allow-create
    clearable
    default-first-option
    :reserve-keyword="false"
    v-bind="$attrs"
    v-model="_modelValue"
  >
    <template v-if="$attrs.popperHeader" #header>
      <SelectHeader :header="($attrs as any).popperHeader" />
    </template>
    <ElOption
      v-for="(item, index) in option_list"
      :key="index"
      :label="label(item)"
      :value="item[valueField]"
    />
  </ElSelect>
</template>
