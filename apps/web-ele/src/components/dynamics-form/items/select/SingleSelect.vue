<script setup lang="ts">
import type { FormField } from '../../type';

import { computed, useAttrs } from 'vue';

import { ElOption, ElSelect } from 'element-plus';

import SelectHeader from '../common/SelectHeader.vue';

const props = defineProps<{
  field: string;
  formField: FormField;
  formfieldList?: Array<FormField>;
  formValue?: any;
  modelValue?: string;
  otherParams: any;
  view?: boolean;
}>();

const emit = defineEmits(['change', 'update:modelValue']);

const attrs = useAttrs() as any;

const _modelValue = computed({
  get() {
    return props.modelValue;
  },
  set(value) {
    emit('update:modelValue', value);
    emit('change', props.formField);
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
  if (props.modelValue && option_list.value && !attrs['allow-create']) {
    const oldItem = option_list.value.find(
      (item: any) => item[valueField.value] === props.modelValue,
    );
    if (!oldItem) {
      emit('update:modelValue', undefined);
    }
  }
  return option[textField.value];
};
</script>

<template>
  <ElSelect
    v-model="_modelValue"
    v-bind="$attrs"
    clearable
    filterable
    :teleported="true"
    popper-class="dynamics-single-select"
  >
    <template v-if="$attrs.popperHeader" #header>
      <SelectHeader :header="$attrs.popperHeader" />
    </template>
    <ElOption
      v-for="(item, index) in option_list"
      :key="index"
      :label="label(item)"
      :value="item[valueField]"
      teleported
    />
  </ElSelect>
</template>

<style>
.dynamics-single-select .el-select-dropdown {
  max-width: 1px;
}
</style>
