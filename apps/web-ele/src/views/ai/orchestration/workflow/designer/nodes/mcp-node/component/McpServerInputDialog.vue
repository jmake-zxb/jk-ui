<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import { ref } from 'vue';

import { ElButton, ElDialog, ElForm, ElFormItem, ElInput } from 'element-plus';
import { set } from 'lodash-es';

const emit = defineEmits<{
  refresh: [value: Record<string, string>];
}>();

const dialogVisible = ref(false);
const formRef = ref<FormInstance>();
const form = ref<Record<string, string>>({});
const inputFieldList = ref<string[]>([]);

function open(vars: string[]) {
  const uniqueVars = [...new Set(vars)];
  const nextForm: Record<string, string> = {};
  uniqueVars.forEach((item) => set(nextForm, item, form.value[item] || ''));
  inputFieldList.value = uniqueVars;
  form.value = nextForm;
  dialogVisible.value = true;
}

async function submit(formEl: FormInstance | undefined) {
  if (!formEl) return;
  const valid = await formEl.validate().catch(() => false);
  if (!valid) return;
  emit('refresh', form.value);
  dialogVisible.value = false;
}

defineExpose({ open });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    title="设置变量"
    append-to-body
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    width="600"
  >
    <ElForm
      ref="formRef"
      :model="form"
      label-position="top"
      require-asterisk-position="right"
    >
      <ElFormItem
        v-for="item in inputFieldList"
        :key="item"
        :label="item"
        :prop="item"
        :rules="{ message: '请输入变量值', required: true, trigger: 'blur' }"
      >
        <ElInput v-model="form[item]" />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="dialogVisible = false">取消</ElButton>
      <ElButton type="primary" @click="submit(formRef)">保存</ElButton>
    </template>
  </ElDialog>
</template>
