<script setup lang="ts">
import type { FormField } from '../../type';

import { computed } from 'vue';

import { ElRadio, ElRadioGroup } from 'element-plus';

const props = defineProps<{
  field: string;
  formField: FormField;
  formfieldList?: Array<FormField>;
  formValue?: any;
  otherParams: any;
  view?: boolean;
}>();

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
  <ElRadioGroup v-bind="$attrs">
    <ElRadio
      v-for="(item, index) in option_list"
      :key="index"
      :label="item[valueField]"
    >
      <div v-safe-html="label(item)"></div>
    </ElRadio>
  </ElRadioGroup>
</template>
