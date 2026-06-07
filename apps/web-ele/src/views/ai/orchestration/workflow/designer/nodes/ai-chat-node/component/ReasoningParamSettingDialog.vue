<script setup lang="ts">
import { reactive, ref } from 'vue';

import { ElButton, ElDialog, ElForm, ElFormItem, ElInput } from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

const emit = defineEmits<{
  refresh: [value: Record<string, unknown>];
}>();

const dialogVisible = ref(false);
const form = reactive({
  reasoning_content_end: '</think>',
  reasoning_content_start: '<think>',
});

function open(value?: Record<string, unknown>) {
  const data = cloneDeep(value || {});
  set(
    form,
    'reasoning_content_start',
    `${data.reasoning_content_start || '<think>'}`,
  );
  set(
    form,
    'reasoning_content_end',
    `${data.reasoning_content_end || '</think>'}`,
  );
  dialogVisible.value = true;
}

function close() {
  dialogVisible.value = false;
}

function submit() {
  dialogVisible.value = false;
  emit('refresh', cloneDeep(form));
}

defineExpose({ open });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    title="推理内容设置"
    append-to-body
    :close-on-click-modal="false"
    width="420"
  >
    <ElForm :model="form" label-position="top" @submit.prevent>
      <ElFormItem label="开始标记">
        <ElInput v-model="form.reasoning_content_start" placeholder="<think>" />
      </ElFormItem>
      <ElFormItem label="结束标记">
        <ElInput v-model="form.reasoning_content_end" placeholder="</think>" />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="close">取消</ElButton>
      <ElButton type="primary" @click="submit">保存</ElButton>
    </template>
  </ElDialog>
</template>
