<script setup lang="ts">
import type { FormField } from '../../type';

import { computed, ref } from 'vue';

import { ElCard } from 'element-plus';

import DynamicsForm from '../../index.vue';

const props = defineProps<{
  formField: FormField;
  formfieldList?: Array<FormField>;
  formValue?: any;
  modelValue?: any;
  otherParams: any;
  view?: boolean;
}>();

const emit = defineEmits(['update:modelValue', 'change']);

const data = computed({
  get: () => {
    if (props.modelValue) {
      return props.modelValue;
    }
    return {};
  },
  set: ($event) => {
    emit('update:modelValue', $event);
  },
});

const other = computed(() => {
  return {
    ...props.formfieldList,
    ...props.otherParams,
  };
});
// 校验实例对象
const dynamicsFormRef = ref<InstanceType<typeof DynamicsForm>>();
/**
 * 组件样式
 */
const formStyle = computed(() => {
  return props_info.value.form_style || {};
});
const props_info = computed(() => {
  return props.formField.props_info || {};
});

const style = computed(() => {
  return props_info.value.style || {};
});
/**
 * 校验方法
 */
function validate() {
  if (dynamicsFormRef.value) {
    return dynamicsFormRef.value.validate();
  }
  return Promise.resolve();
}
defineExpose({
  validate,
});
</script>
<template>
  <ElCard :style="style">
    <DynamicsForm
      :read-only="view"
      :style="formStyle"
      ref="dynamicsFormRef"
      v-model="data"
      :other-params="other"
      :render-fields="formField.children ? formField.children : []"
      v-bind="$attrs"
      :parent-field="formField.field"
      label-position="top"
      require-asterisk-position="right"
    />
  </ElCard>
</template>
