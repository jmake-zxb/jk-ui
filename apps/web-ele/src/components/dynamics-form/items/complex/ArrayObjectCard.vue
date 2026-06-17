<script setup lang="ts">
import type { FormField } from '../../type';

import { computed, ref } from 'vue';

import { Delete, Plus } from '@element-plus/icons-vue';
import { ElButton, ElCard, ElIcon, ElTooltip } from 'element-plus';

import DynamicsForm from '../../index.vue';

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
const render_data = () => {
  return Promise.resolve({
    data: props.formField.children as Array<FormField>,
  });
};
const deleteKnowledge = (item: any) => {
  _data.value = _data.value.filter((row) => row !== item);
};
// 校验实例对象
const dynamicsFormRef = ref<Array<InstanceType<typeof DynamicsForm>>>([]);

const _data = computed<Array<any>>({
  get() {
    if (props.modelValue) {
      return props.modelValue;
    } else {
      emit('update:modelValue', [{}]);
      return [];
    }
  },
  set(value) {
    emit('update:modelValue', value);
  },
});

const props_info = computed(() => {
  return props.formField.props_info || {};
});
const add_msg = computed(() => {
  return props_info.value.add_msg || '添加';
});
/**
 * 添加一个card
 */
const add_card = () => {
  _data.value = [..._data.value, {}];
};

/**
 * 组件样式
 */
const formStyle = computed(() => {
  return props_info.value.form_style || {};
});
const style = computed(() => {
  return props_info.value.style || {};
});
const attr = computed(() => {
  if (props.formField.attrs) {
    return props.formField.attrs;
  }
  return {};
});

/**
 * 校验方法
 */
function validate() {
  return Promise.all(dynamicsFormRef.value.map((item) => item.validate()));
}
const other = computed(() => {
  return { ...props.formValue, ...props.otherParams };
});

defineExpose({
  validate,
  field: props.field,
});
</script>
<template>
  <div class="arrt-object-card flex w-full">
    <ElCard
      class="box-card"
      :style="style"
      v-for="(item, index) in _data"
      :key="index"
    >
      <DynamicsForm
        :style="formStyle"
        :view="view"
        ref="dynamicsFormRef"
        v-model="_data[index]"
        :model="_data[index]"
        :other-params="other"
        :render-fields="render_data()"
        v-bind="attr"
        :parent-field="`${formField.field}.${index}`"
        label-position="top"
        require-asterisk-position="right"
      />
      <ElTooltip effect="dark" content="删除" placement="top">
        <ElButton
          text
          @click.stop="deleteKnowledge(item)"
          class="delete-button"
        >
          <ElIcon><Delete /></ElIcon>
        </ElButton>
      </ElTooltip>
    </ElCard>
    <ElCard shadow="never" class="card-add box-card" @click="add_card">
      <div class="flex-center">
        <ElIcon class="add-icon layout-bg border-r-6 p-8"><Plus /></ElIcon>
        <span>{{ add_msg }}</span>
      </div>
    </ElCard>
  </div>
</template>
<style lang="scss" scoped>
.arrt-object-card {
  .box-card {
    position: relative;
    width: 30%;
    padding-top: 20px;
    margin: 10px;
  }

  .card-add {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--card-min-height);
    padding-bottom: 20px;
    font-size: 16px;
    cursor: pointer;
    background: var(--el-disabled-bg-color);
    border: 1px dashed var(--el-color-primary);

    .add-icon {
      margin-right: 12px;
      font-size: 14px;
      border: 1px solid var(--app-border-color-dark);
    }

    &:hover {
      color: var(--el-color-primary);
      background: #fff;

      .add-icon {
        background: #fff;
        border-color: var(--el-color-primary);
      }
    }
  }

  .delete-button {
    position: absolute;
    top: 10px;
    right: 12px;
    height: auto;
  }
}
</style>
