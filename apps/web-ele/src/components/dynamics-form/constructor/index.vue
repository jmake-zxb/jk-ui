<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import { onMounted, ref } from 'vue';

import {
  ElForm,
  ElFormItem,
  ElInput,
  ElOption,
  ElSelect,
  ElSwitch,
} from 'element-plus';
import { cloneDeep } from 'lodash-es';

import { input_type_list } from './data';

defineOptions({ name: 'DynamicsFormConstructor' });

const props = withDefaults(
  defineProps<{
    labelPosition?: 'left' | 'right' | 'top';
    modelValue?: any;
    requireAsteriskPosition?: 'left' | 'right';
  }>(),
  {
    modelValue: undefined,
    requireAsteriskPosition: 'right',
    labelPosition: 'top',
  },
);

const emit = defineEmits(['update:modelValue']);

const ruleFormRef = ref<FormInstance>();

const formData = ref<any>({
  label: '',
  field: '',
  tooltip: '',
  required: false,
  input_type: '',
  default_value: undefined,
  show_default_value: true,
});

const rules = {
  label: [{ required: true, message: '请输入参数名称' }],
  field: [{ required: true, message: '请输入参数字段' }],
  required: [{ required: true, message: '请选择是否必填' }],
  input_type: [{ required: true, message: '请选择控件类型' }],
};

const getData = () => {
  let label: any | string = formData.value.label;
  if (formData.value.tooltip) {
    label = {
      input_type: 'TooltipLabel',
      label: formData.value.label,
      attrs: { tooltip: formData.value.tooltip },
      props_info: {},
    };
  }
  return {
    label,
    required: formData.value.required,
    field: formData.value.field,
    default_value: formData.value.default_value,
    show_default_value: formData.value.show_default_value,
    input_type: formData.value.input_type,
  };
};

const validate = () => {
  if (ruleFormRef.value) {
    return ruleFormRef.value.validate();
  }
  return Promise.resolve();
};

function rander(data: any) {
  if (!data) return;
  formData.value = cloneDeep({
    label: '',
    field: '',
    tooltip: '',
    required: false,
    input_type: '',
    default_value: undefined,
    show_default_value: true,
  });
  formData.value.required = data.required ?? false;
  formData.value.field = data.field ?? '';
  if (data.show_default_value !== undefined) {
    formData.value.show_default_value = data.show_default_value;
  }
  if (data.default_value !== undefined) {
    formData.value.default_value = data.default_value;
  }
  if (data.input_type) {
    formData.value.input_type = data.input_type;
  }
  if (
    data.label &&
    typeof data.label === 'object' &&
    data.label.input_type === 'TooltipLabel'
  ) {
    formData.value.tooltip = data.label.attrs?.tooltip ?? '';
    formData.value.label = data.label.label ?? '';
  } else {
    formData.value.label = data.label ?? '';
  }
  emit('update:modelValue', formData.value);
}

onMounted(() => {
  if (props.modelValue) {
    rander(props.modelValue);
  }
});

defineExpose({ getData, validate, rander });
</script>

<template>
  <ElForm
    ref="ruleFormRef"
    class="mb-24"
    :label-position="labelPosition"
    label-width="auto"
    :model="formData"
    :require-asterisk-position="requireAsteriskPosition"
    @submit.prevent
  >
    <ElFormItem label="参数字段" prop="field" required :rules="rules.field">
      <ElInput
        v-model="formData.field"
        :maxlength="64"
        placeholder="请输入参数字段（英文）"
        show-word-limit
      />
    </ElFormItem>
    <ElFormItem label="参数名称" prop="label" required :rules="rules.label">
      <ElInput
        v-model="formData.label"
        :maxlength="64"
        placeholder="请输入参数名称"
        show-word-limit
      />
    </ElFormItem>
    <ElFormItem label="参数提示">
      <ElInput
        v-model="formData.tooltip"
        :maxlength="128"
        placeholder="请输入参数提示（可选）"
        show-word-limit
      />
    </ElFormItem>
    <ElFormItem
      label="是否必填"
      prop="required"
      required
      :rules="rules.required"
      @click.prevent
    >
      <ElSwitch
        v-model="formData.required"
        :active-value="true"
        :inactive-value="false"
      />
    </ElFormItem>
    <ElFormItem
      label="控件类型"
      prop="input_type"
      required
      :rules="rules.input_type"
    >
      <ElSelect v-model="formData.input_type" placeholder="请选择控件类型">
        <ElOption
          v-for="item in input_type_list"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </ElSelect>
    </ElFormItem>
  </ElForm>
</template>

<style lang="scss" scoped>
.mb-24 {
  margin-bottom: 24px;
}
</style>
