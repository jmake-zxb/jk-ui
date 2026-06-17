<script lang="ts" setup>
import type { FormField } from '../type';

import { computed, inject } from 'vue';

import { formItemContextKey, useFormDisabled } from 'element-plus';

const props = defineProps<{
  field: string;
  formField: FormField;
  formfieldList?: Array<FormField>;
  formValue?: any;
  // 选中的值
  modelValue?: any;
  otherParams: any;
  view?: boolean;
}>();
const emit = defineEmits(['update:modelValue']);
const inputDisabled = useFormDisabled();
const elFormItem = inject(formItemContextKey, void 0);
const selected = (activeValue: number | string) => {
  if (_value.value.includes(activeValue)) {
    emit(
      'update:modelValue',
      props.modelValue.filter((i: any) => i !== activeValue),
    );
  } else {
    emit('update:modelValue', reset(activeValue));
  }
  if (elFormItem?.validate) {
    elFormItem.validate('change');
  }
};
const reset = (activeValue: number | string) => {
  const _result = props.modelValue
    ? [...props.modelValue, activeValue]
    : [activeValue];
  return _result.filter((r) => option_value_list.value.includes(r));
};

const _value = computed(() => {
  return props.modelValue || [];
});
const textField = computed(() => {
  return props.formField.text_field || 'key';
});

const valueField = computed(() => {
  return props.formField.value_field || 'value';
});
const option_value_list = computed(() => {
  return option_list.value.map((item: any) => item[valueField.value]);
});
const option_list = computed(() => {
  return props.formField.option_list || [];
});
</script>
<template>
  <div class="multi-row">
    <div
      v-for="item in option_list"
      :key="item.value"
      class="item"
      :class="[
        inputDisabled ? 'is-disabled' : '',
        _value.includes(item[valueField]) ? 'active' : '',
      ]"
      @click="selected(item[valueField])"
    >
      {{ item[textField] }}
    </div>
  </div>
</template>
<style lang="scss" scoped>
.multi-row {
  box-sizing: border-box;
  display: inline-flex;
  padding: 3px 4px;
  font-size: 14px;
  font-weight: 400;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  border: 1px solid #bbbfc4;
  border-radius: 4px;

  .is-disabled {
    color: var(--el-text-color-placeholder);
    cursor: not-allowed;
    background-color: var(--el-fill-color-light);
    border: 1px solid var(--el-card-border-color);

    &:hover {
      cursor: not-allowed;
    }
  }

  .active {
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    border-radius: 4px;
  }

  .item {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 20px;
    padding: 2px 8px;
    margin: 0 2px;
    cursor: pointer;

    &:last-child {
      margin: 0 4px 0 2px;
    }

    &:first-child {
      margin: 0 2px 0 4px;
    }
  }
}
</style>
