<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import { nextTick, reactive, ref, watch } from 'vue';

import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElSwitch,
} from 'element-plus';

import { cloneValue } from './base-node-utils';

const emit = defineEmits<{
  refresh: [data: Record<string, any>];
}>();

const dialogVisible = ref(false);
const fieldFormRef = ref<FormInstance>();
const isEdit = ref(false);
const form = ref(defaultForm());
const rules = reactive({
  variable: [
    { message: '请输入字段名', required: true, trigger: 'blur' },
    {
      message: '仅支持字母、数字、下划线',
      pattern: /^\w+$/,
      trigger: 'blur',
    },
  ],
});

function defaultForm() {
  return {
    assignment_method: 'api_input',
    default_value: '',
    desc: '',
    is_required: true,
    name: '',
    optionList: [''],
    type: 'input',
    variable: '',
  };
}

watch(dialogVisible, (visible) => {
  if (visible) return;
  form.value = defaultForm();
  isEdit.value = false;
});

function open(row?: any) {
  if (row) {
    form.value = cloneValue(row);
    isEdit.value = true;
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
  const data = {
    ...form.value,
    assignment_method: 'api_input',
    variable: form.value.variable.trim(),
  };
  dialogVisible.value = false;
  await nextTick();
  emit('refresh', data);
}

defineExpose({ close, open });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑参数' : '添加参数'"
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
      <ElFormItem label="字段" prop="variable">
        <ElInput
          v-model="form.variable"
          maxlength="64"
          placeholder="请输入字段名"
          show-word-limit
          @blur="form.variable = form.variable.trim()"
        />
      </ElFormItem>
      <ElFormItem label="描述">
        <ElInput
          v-model="form.desc"
          maxlength="64"
          placeholder="请输入描述"
          show-word-limit
        />
      </ElFormItem>
      <ElFormItem label="必填">
        <ElSwitch v-model="form.is_required" size="small" />
      </ElFormItem>
      <ElFormItem
        label="默认值"
        prop="default_value"
        :rules="{
          message: '请输入默认值',
          required: form.is_required,
          trigger: 'blur',
        }"
      >
        <ElInput v-model="form.default_value" placeholder="请输入默认值" />
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
