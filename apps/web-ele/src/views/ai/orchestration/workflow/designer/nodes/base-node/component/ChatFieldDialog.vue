<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import { nextTick, reactive, ref, watch } from 'vue';

import { ElButton, ElDialog, ElForm, ElFormItem, ElInput } from 'element-plus';

import { cloneValue } from './base-node-utils';

const emit = defineEmits<{
  refresh: [data: Record<string, any>, index: null | number];
}>();

const dialogVisible = ref(false);
const fieldFormRef = ref<FormInstance>();
const isEdit = ref(false);
const currentIndex = ref<null | number>(null);
const form = ref(defaultForm());
const rules = reactive({
  field: [
    { message: '请输入变量名', required: true, trigger: 'blur' },
    {
      message: '仅支持字母、数字、下划线',
      pattern: /^\w+$/,
      trigger: 'blur',
    },
  ],
  label: [{ message: '请输入名称', required: true, trigger: 'blur' }],
});

function defaultForm() {
  return { field: '', label: '' };
}

watch(dialogVisible, (visible) => {
  if (visible) return;
  form.value = defaultForm();
  isEdit.value = false;
  currentIndex.value = null;
});

function open(row?: any, index?: number) {
  if (row) {
    form.value = cloneValue(row);
    isEdit.value = true;
    currentIndex.value = index ?? null;
  }
  dialogVisible.value = true;
}

function close() {
  dialogVisible.value = false;
}

async function submit(formEl?: FormInstance) {
  if (!formEl) return;
  try {
    await formEl.validate();
  } catch {
    return;
  }
  const data = { ...form.value, field: form.value.field.trim() };
  const index = currentIndex.value;
  dialogVisible.value = false;
  await nextTick();
  emit('refresh', data, index);
}

defineExpose({ close, open });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑变量' : '添加变量'"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    append-to-body
  >
    <ElForm
      ref="fieldFormRef"
      :model="form"
      :rules="rules"
      label-position="top"
      @submit.prevent
    >
      <ElFormItem label="字段" prop="field">
        <ElInput
          v-model="form.field"
          maxlength="64"
          placeholder="请输入字段名"
          show-word-limit
          @blur="form.field = form.field.trim()"
        />
      </ElFormItem>
      <ElFormItem label="名称" prop="label">
        <ElInput
          v-model="form.label"
          maxlength="64"
          placeholder="请输入名称"
          show-word-limit
        />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="close">取消</ElButton>
      <ElButton type="primary" @click="submit(fieldFormRef)">
        {{ isEdit ? '保存' : '添加' }}
      </ElButton>
    </template>
  </ElDialog>
</template>
