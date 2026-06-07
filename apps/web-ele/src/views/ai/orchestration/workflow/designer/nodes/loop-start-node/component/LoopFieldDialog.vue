<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';

import { reactive, ref } from 'vue';

import { ElButton, ElDialog, ElForm, ElFormItem, ElInput } from 'element-plus';
import { cloneDeep } from 'lodash-es';

type LoopFieldForm = {
  field: string;
  label: string;
};

const emit = defineEmits<{
  refresh: [data: LoopFieldForm, index?: number];
}>();

const fieldFormRef = ref<FormInstance>();
const dialogVisible = ref(false);
const isEdit = ref(false);
const currentIndex = ref<number>();
const form = ref<LoopFieldForm>({ field: '', label: '' });
const rules = reactive<FormRules<LoopFieldForm>>({
  field: [
    { required: true, message: '请输入字段', trigger: 'blur' },
    {
      pattern: /^\w+$/,
      message: '字段只能包含字母、数字和下划线',
      trigger: 'blur',
    },
  ],
  label: [{ required: true, message: '请输入名称', trigger: 'blur' }],
});

function open(row?: LoopFieldForm, index?: number) {
  if (row) {
    form.value = cloneDeep(row);
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
  fieldFormRef.value?.clearValidate?.();
}

async function submit(formEl: FormInstance | undefined) {
  if (!formEl) return;
  await formEl.validate((valid) => {
    if (!valid) return;
    emit('refresh', cloneDeep(form.value), currentIndex.value);
  });
}

defineExpose({ close, open });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    :before-close="close"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :destroy-on-close="true"
    :title="isEdit ? '编辑参数' : '添加参数'"
    append-to-body
  >
    <ElForm
      ref="fieldFormRef"
      :model="form"
      :rules="rules"
      label-position="top"
      require-asterisk-position="right"
      @submit.prevent
    >
      <ElFormItem label="字段" prop="field" :required="true">
        <ElInput
          v-model="form.field"
          :maxlength="64"
          placeholder="请输入字段"
          show-word-limit
        />
      </ElFormItem>
      <ElFormItem label="名称" prop="label" :required="true">
        <ElInput
          v-model="form.label"
          :maxlength="64"
          placeholder="请输入名称"
          show-word-limit
        />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <span class="dialog-footer">
        <ElButton @click.prevent="close">取消</ElButton>
        <ElButton type="primary" @click="submit(fieldFormRef)">{{
          isEdit ? '保存' : '添加'
        }}</ElButton>
      </span>
    </template>
  </ElDialog>
</template>
