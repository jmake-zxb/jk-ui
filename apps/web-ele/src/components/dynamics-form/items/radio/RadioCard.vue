<script lang="ts" setup>
import type { FormField } from '../../type';

import { computed, inject, ref } from 'vue';

import {
  ElCard,
  ElCol,
  ElRow,
  formItemContextKey,
  useFormDisabled,
} from 'element-plus';

const props = defineProps<{
  disabled?: boolean;
  field: string;
  formField: FormField;
  formfieldList?: Array<FormField>;
  formValue?: any;
  // 选中的值
  modelValue?: any;
  otherParams: any;
  view?: boolean;
}>();

const emit = defineEmits(['update:modelValue', 'change']);

const inputDisabled = useFormDisabled();

const elFormItem = inject(formItemContextKey, void 0);
const selected = (activeValue: number | string) => {
  emit('update:modelValue', activeValue);
  if (elFormItem?.validate) {
    elFormItem.validate('change');
  }
};
const width = ref<number>();
const radioContentStyle = computed(() => {
  if (width.value) {
    if (width.value < 350) {
      return { '--maxkb-radio-card-width': '316px' };
    } else if (width.value > 770) {
      return { '--maxkb-radio-card-width': '378px' };
    } else {
      return { '--maxkb-radio-card-width': '100%' };
    }
  }
  return {};
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
</script>
<template>
  <div class="radio-card" :style="radioContentStyle">
    <ElRow :gutter="12" class="w-full">
      <template v-for="(item, index) in option_list" :key="index">
        <ElCol :xs="24" :sm="24" :md="24" :lg="12" :xl="12">
          <ElCard
            :key="item.value"
            class="item break-all"
            shadow="never"
            style="

--el-card-padding: 12px 16px"
            :class="[
              inputDisabled ? 'is-disabled' : '',
              modelValue === item[valueField] ? 'active' : '',
            ]"
            @click="inputDisabled ? () => {} : selected(item[valueField])"
            :inner-h-t-m-l="item[textField] ? item[textField] : '\u200D'"
          />
        </ElCol>
      </template>
    </ElRow>
  </div>
</template>
<style lang="scss" scoped>
.radio-card {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  width: 100%;

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
    border: 1px solid var(--el-color-primary);
  }

  .item {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--maxkb-radio-card-width, 100%);
    margin: 4px;
    cursor: pointer;
  }
}
</style>
