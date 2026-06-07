<script setup lang="ts">
import { ref } from 'vue';

import { ElButton, ElDialog, ElInput } from 'element-plus';

const emit = defineEmits<{
  refresh: [value: { key: 'prompt' | 'system'; value: string }];
}>();

const dialogVisible = ref(false);
const dialogTitle = ref('编辑文本');
const fieldKey = ref<'prompt' | 'system'>('prompt');
const content = ref('');

function open(data: {
  key: 'prompt' | 'system';
  title: string;
  value: string;
}) {
  fieldKey.value = data.key;
  dialogTitle.value = data.title;
  content.value = data.value;
  dialogVisible.value = true;
}

function close() {
  dialogVisible.value = false;
}

function submit() {
  dialogVisible.value = false;
  emit('refresh', { key: fieldKey.value, value: content.value });
}

defineExpose({ open });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    :title="dialogTitle"
    append-to-body
    :close-on-click-modal="false"
    width="760"
  >
    <ElInput
      v-model="content"
      type="textarea"
      :rows="18"
      placeholder="支持 {{节点.字段}} 引用"
    />
    <template #footer>
      <ElButton @click="close">取消</ElButton>
      <ElButton type="primary" @click="submit">保存</ElButton>
    </template>
  </ElDialog>
</template>
