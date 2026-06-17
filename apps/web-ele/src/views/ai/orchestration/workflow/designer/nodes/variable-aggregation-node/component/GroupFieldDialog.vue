<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';

import { ref } from 'vue';

import { ElButton, ElDialog, ElForm, ElFormItem, ElInput } from 'element-plus';
import { cloneDeep } from 'lodash-es';

type GroupField = {
  field: string;
  label: string;
};

const emit = defineEmits<{
  refresh: [field: GroupField, index?: number];
}>();

const dialogVisible = ref(false);
const isEdit = ref(false);
const currentIndex = ref<number>();
const formRef = ref<FormInstance>();
const form = ref<GroupField>({ field: '', label: '' });
const rules: FormRules<GroupField> = {
  field: [
    { message: '请输入输出字段', required: true, trigger: 'blur' },
    {
      message: '字段只能包含字母、数字和下划线',
      pattern: /^\w+$/,
      trigger: 'blur',
    },
  ],
  label: [{ message: '请输入显示名', required: true, trigger: 'blur' }],
};

function open(data?: GroupField, index?: number) {
  if (data) {
    form.value = cloneDeep(data);
    isEdit.value = true;
    currentIndex.value = index;
  }
  dialogVisible.value = true;
}

function close() {
  dialogVisible.value = false;
  isEdit.value = false;
  currentIndex.value = undefined;
  form.value = { field: '', label: '' };
}

async function submit() {
  if (!formRef.value) return;
  await formRef.value.validate();
  emit('refresh', cloneDeep(form.value), currentIndex.value);
}

defineExpose({ close, open });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    append-to-body
    :close-on-click-modal="false"
    destroy-on-close
    :title="isEdit ? '编辑分组' : '添加分组'"
    width="420px"
    @close="close"
  >
    <ElForm ref="formRef" :model="form" :rules="rules" label-position="top">
      <ElFormItem label="输出字段" prop="field">
        <ElInput
          v-model="form.field"
          maxlength="64"
          placeholder="例如 Group1"
          show-word-limit
        />
      </ElFormItem>
      <ElFormItem label="显示名" prop="label">
        <ElInput
          v-model="form.label"
          maxlength="64"
          placeholder="例如 Group1"
          show-word-limit
        />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="close">取消</ElButton>
      <ElButton type="primary" @click="submit">
        {{ isEdit ? '保存' : '添加' }}
      </ElButton>
    </template>
  </ElDialog>
</template>
