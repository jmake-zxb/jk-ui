<script setup lang="ts">
import type { TabPaneName } from 'element-plus';

import type { FormField } from '../../type';

import { computed, ref } from 'vue';

import { ElCard, ElTabPane, ElTabs } from 'element-plus';

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

const tabs_label = computed(() => {
  return props_info.value.tabs_label || 'label';
});
/**
 * 组件样式
 */
const formStyle = computed(() => {
  return props_info.value.form_style || {};
});

const attr = computed(() => {
  if (props.formField.attrs) {
    return props.formField.attrs;
  }
  return {};
});
const activeTab = ref(0);

/**
 * 校验方法
 */
function validate() {
  return Promise.all(dynamicsFormRef.value.map((item) => item.validate()));
}
const other = computed(() => {
  return { ...props.formValue, ...props.otherParams };
});
const style = computed(() => {
  return props_info.value.style || {};
});

const handleTabsEdit = (
  targetName: TabPaneName | undefined,
  action: 'add' | 'remove',
) => {
  if (action === 'add') {
    _data.value = [..._data.value, {}];
    activeTab.value = _data.value.length;
  } else if (action === 'remove') {
    const update_value = _data.value.filter(
      (_item, index) => index !== targetName,
    );
    _data.value = update_value;
    activeTab.value = update_value.length - 1;
  }
};

defineExpose({
  validate,
  field: props.field,
});
</script>
<template>
  <div style="width: 100%">
    <ElTabs v-model="activeTab" editable @edit="handleTabsEdit" type="card">
      <ElTabPane
        v-for="(_item, index) in _data"
        :key="index"
        :label="tabs_label + (index + 1)"
        :name="index"
      >
        <template v-if="formField.children">
          <ElCard :style="style">
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
          </ElCard>
        </template>
      </ElTabPane>
    </ElTabs>
  </div>
</template>
