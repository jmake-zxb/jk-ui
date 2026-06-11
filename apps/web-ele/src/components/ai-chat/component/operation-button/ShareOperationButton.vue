<script setup lang="ts">
import type { ChatRecord } from '#/components/ai-chat/types/application';

import { CopyDocument } from '@element-plus/icons-vue';
import { ElButton, ElText, ElTooltip } from 'element-plus';

const props = withDefaults(
  defineProps<{
    data?: ChatRecord;
  }>(),
  {
    data: undefined,
  },
);

async function copyText() {
  await navigator.clipboard?.writeText(props.data?.answer_text || '');
}
</script>

<template>
  <div class="share-operation-button">
    <ElText type="info">
      <span v-if="data?.create_time">{{
        new Date(data.create_time).toLocaleString()
      }}</span>
    </ElText>
    <ElTooltip content="复制" placement="top">
      <ElButton text :icon="CopyDocument" @click="copyText" />
    </ElTooltip>
  </div>
</template>

<style scoped>
.share-operation-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}
</style>
