<script setup lang="ts">
import { nextTick, ref } from 'vue';

import { ElButton, ElDialog, ElInput } from 'element-plus';

const emit = defineEmits<{
  refresh: [value: string];
}>();

const dialogVisible = ref(false);
const value = ref('');

function open(text = '') {
  value.value = text;
  dialogVisible.value = true;
}

function close() {
  dialogVisible.value = false;
}

async function submit() {
  const text = value.value;
  dialogVisible.value = false;
  await nextTick();
  emit('refresh', text);
}

defineExpose({ open });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    title="开场白"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    append-to-body
    width="720"
  >
    <ElInput
      v-model="value"
      type="textarea"
      :rows="14"
      placeholder="请输入对话开场白"
    />
    <template #footer>
      <ElButton @click="close">取消</ElButton>
      <ElButton type="primary" @click="submit">保存</ElButton>
    </template>
  </ElDialog>
</template>
