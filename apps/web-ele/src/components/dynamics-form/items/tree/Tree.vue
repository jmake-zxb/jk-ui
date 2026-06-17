<script setup lang="ts">
import type { LoadFunction } from 'element-plus';

import type { FormField } from '../../type';

import { computed, inject, nextTick, ref, useAttrs } from 'vue';

import { Folder } from '@element-plus/icons-vue';
import {
  ElCheckbox,
  ElIcon,
  ElScrollbar,
  ElTree,
  formItemContextKey,
} from 'element-plus';
import { cloneDeep } from 'lodash-es';

const props = withDefaults(
  defineProps<{ formField: FormField; modelValue?: any; otherParams: any }>(),
  {
    modelValue: () => [],
  },
);

const emit = defineEmits(['update:modelValue', 'change']);

const elFormItem = inject(formItemContextKey, void 0);

const allCheck = ref<boolean>(false);

const handleAllCheckChange = (checked: boolean) => {
  if (checked) {
    const nodes = Object.values(treeRef.value?.store.nodesMap || {}) as any[];
    nodes.forEach((node) => {
      if (!node.disabled) {
        treeRef.value?.setChecked(node.data, true, false);
      }
    });
  } else {
    treeRef.value?.setCheckedKeys([]);
  }
};

const textField = computed(() => {
  return props.formField.text_field || 'label';
});

const valueField = computed(() => {
  return props.formField.value_field || 'value';
});
const childrenField = computed(() => {
  return (props.formField as any).childrenField || 'children';
});
const option_list = computed(() => {
  return props.formField.option_list || [];
});
const propsData = computed(() => {
  return {
    label: textField.value,
    children: childrenField.value,
    isLeaf: (data: any) => data.leaf,
    disabled: (data: any) => data.disabled,
  };
});

const attrs = useAttrs();
const treeRef = ref<any>(null);

// Lazy load function - requires inject('upload') and request to be provided
// TODO: Integrate with jk-cloud request API when available
const loadNode: LoadFunction = (_node, resolve) => {
  // Default: resolve empty if no fetch_list_function provided
  if (!(attrs as any).fetch_list_function) {
    resolve([]);
    return;
  }
  // Placeholder: will be integrated when request module is available
  resolve([]);
};

const model_value = computed({
  get: () => {
    if (!props.modelValue) {
      emit('update:modelValue', []);
    }
    return props.modelValue;
  },
  set: (v: Array<any>) => {
    emit('update:modelValue', v);
  },
});
const change = () => {
  model_value.value = cloneDeep(treeRef.value?.getCheckedNodes() || []);
  nextTick(() => {
    if (elFormItem?.validate) {
      elFormItem.validate('change');
    }
  });
};

const loading = ref<boolean>(false);
</script>
<template>
  <div v-loading="loading" class="w-full">
    <div class="card-never border-r-6 mb-16">
      <ElCheckbox
        v-model="allCheck"
        label="全选"
        size="large"
        class="ml-24"
        @change="handleAllCheckChange as any"
      />
    </div>
    <div style="height: calc(100vh - 450px)">
      <ElScrollbar>
        <ElTree
          :data="option_list"
          @check-change="change"
          v-loading="loading"
          style="width: 100%"
          :props="propsData"
          :load="loadNode"
          :lazy="(attrs as any).lazy"
          show-checkbox
          :node-key="valueField"
          ref="treeRef"
        >
          <template #default="{ node, data }">
            <div class="align-center lighter flex">
              <img :src="data.icon" alt="" height="20" v-if="data.icon" />
              <ElIcon v-else :size="20"><Folder /></ElIcon>
              <span class="ml-4">{{ (node as any).label }}</span>
            </div>
          </template>
        </ElTree>
      </ElScrollbar>
    </div>
  </div>
</template>
