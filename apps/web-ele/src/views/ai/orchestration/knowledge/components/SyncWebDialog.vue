<script setup lang="ts">
import { ref, watch } from 'vue';

import {
  ElButton,
  ElCard,
  ElDialog,
  ElMessage,
  ElRadio,
  ElRadioGroup,
  ElText,
} from 'element-plus';

import { requestClient } from '#/api/request';

const emit = defineEmits<{ refresh: [data?: unknown] }>();

const dialogVisible = ref(false);
const method = ref('replace');
const knowledgeId = ref('');
const loading = ref(false);

watch(dialogVisible, (visible) => {
  if (!visible) {
    method.value = 'replace';
  }
});

const open = (id: string) => {
  knowledgeId.value = id;
  dialogVisible.value = true;
};

const submit = async () => {
  loading.value = true;
  try {
    const res = await requestClient.put(
      `/ai/api/knowledge/${knowledgeId.value}/sync`,
      { method: method.value },
    );
    emit('refresh', res.data);
    ElMessage.success('同步成功');
    dialogVisible.value = false;
  } finally {
    loading.value = false;
  }
};

defineExpose({ open });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    title="同步 Web 知识库"
    width="600px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :destroy-on-close="true"
  >
    <p class="mb-8">同步方式</p>
    <ElRadioGroup v-model="method" class="card__radio">
      <ElCard
        shadow="never"
        class="mb-16"
        :class="method === 'replace' ? 'border-active' : ''"
      >
        <ElRadio value="replace" size="large">
          <p class="mb-4">替换同步</p>
          <ElText type="info">
            替换同步会删除所有已有文档，并重新获取网站内容。
          </ElText>
        </ElRadio>
      </ElCard>

      <ElCard
        shadow="never"
        class="mb-16"
        :class="method === 'complete' ? 'border-active' : ''"
      >
        <ElRadio value="complete" size="large">
          <p class="mb-4">整体同步</p>
          <ElText type="info">
            整体同步会保留已有文档，仅同步新增或更新的内容。
          </ElText>
        </ElRadio>
      </ElCard>
    </ElRadioGroup>
    <p class="color-danger">同步会删除已有文档并重新获取，请谨慎操作。</p>
    <template #footer>
      <span class="dialog-footer">
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="loading" @click="submit">
          确定
        </ElButton>
      </span>
    </template>
  </ElDialog>
</template>

<style lang="scss" scoped>
.mb-4 {
  margin-bottom: 4px;
}

.mb-8 {
  margin-bottom: 8px;
}

.mb-16 {
  margin-bottom: 16px;
}

.border-active {
  border-color: var(--el-color-primary);
}

.color-danger {
  color: var(--el-color-danger);
}

.card__radio {
  width: 100%;
}

.dialog-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
