<script setup lang="ts">
import { nextTick, ref } from 'vue';

import { ElButton, ElDialog, ElInput, ElMessage } from 'element-plus';

const emit = defineEmits<{
  refresh: [value: Record<string, any>];
}>();

const dialogVisible = ref(false);
const dialogTitle = ref('参数设置');
const jsonText = ref('{}');

function pretty(value: any) {
  try {
    return JSON.stringify(value || {}, null, 2);
  } catch {
    return '{}';
  }
}

function open(value?: Record<string, any>, title = '参数设置') {
  dialogTitle.value = title;
  jsonText.value = pretty(value);
  dialogVisible.value = true;
}

function close() {
  dialogVisible.value = false;
}

async function submit() {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText.value || '{}');
  } catch {
    ElMessage.warning('请输入合法 JSON');
    return;
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
    ElMessage.warning('参数必须是 JSON 对象');
    return;
  }
  dialogVisible.value = false;
  await nextTick();
  emit('refresh', parsed);
}

defineExpose({ open });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    :title="dialogTitle"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    append-to-body
    width="620"
  >
    <ElInput
      v-model="jsonText"
      type="textarea"
      :rows="12"
      placeholder="请输入 JSON 参数"
    />
    <template #footer>
      <ElButton @click="close">取消</ElButton>
      <ElButton type="primary" @click="submit">保存</ElButton>
    </template>
  </ElDialog>
</template>
