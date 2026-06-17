<script setup lang="ts">
import type { DrawerProps } from 'element-plus';

import { ref } from 'vue';

import { ElButton, ElDrawer } from 'element-plus';
import { cloneDeep } from 'lodash-es';

import DynamicsFormConstructor from '#/components/dynamics-form/constructor/index.vue';

defineOptions({ name: 'AddParamDrawer' });

const emit = defineEmits<{
  refresh: [data: any, index: null | number];
}>();
const drawer = ref(false);
const direction = ref<DrawerProps['direction']>('rtl');
const isEdit = ref(false);
const constructorRef = ref<InstanceType<typeof DynamicsFormConstructor>>();

const currentItem = ref<any>(null);
const currentIndex = ref<null | number>(null);

function open(row?: any, index?: number) {
  if (row) {
    currentItem.value = cloneDeep(row);
    currentIndex.value = index ?? null;
    isEdit.value = true;
  } else {
    currentItem.value = null;
    currentIndex.value = null;
    isEdit.value = false;
  }
  drawer.value = true;
}

function cancelClick() {
  drawer.value = false;
  isEdit.value = false;
  currentItem.value = null;
  currentIndex.value = null;
}

function confirmClick() {
  const formEl = constructorRef.value;
  formEl
    ?.validate()
    .then(() => {
      emit('refresh', formEl.getData(), currentIndex.value);
      drawer.value = false;
      isEdit.value = false;
      currentItem.value = null;
      currentIndex.value = null;
    })
    .catch(() => {});
}

defineExpose({ open });
</script>

<template>
  <ElDrawer
    v-model="drawer"
    :direction="direction"
    size="600"
    append-to-body
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :before-close="cancelClick"
    destroy-on-close
  >
    <template #header>
      <h4>{{ isEdit ? '编辑参数' : '新增参数' }}</h4>
    </template>
    <template #default>
      <DynamicsFormConstructor
        ref="constructorRef"
        :model-value="currentItem"
        label-position="top"
        require-asterisk-position="right"
      />
    </template>
    <template #footer>
      <div style="flex: auto">
        <ElButton @click="cancelClick">取消</ElButton>
        <ElButton type="primary" @click="confirmClick">
          {{ isEdit ? '保存' : '添加' }}
        </ElButton>
      </div>
    </template>
  </ElDrawer>
</template>

<style scoped lang="scss"></style>
