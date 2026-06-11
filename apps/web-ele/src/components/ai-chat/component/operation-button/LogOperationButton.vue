<script setup lang="ts">
import type { ChatRecord } from '#/components/ai-chat/types/application';

import { CopyDocument } from '@element-plus/icons-vue';
import { ElButton, ElText, ElTooltip } from 'element-plus';

const props = withDefaults(
  defineProps<{
    applicationId?: string;
    data?: ChatRecord;
    tts?: boolean;
    ttsType?: string;
  }>(),
  {
    applicationId: '',
    data: undefined,
    tts: false,
    ttsType: '',
  },
);

defineEmits<{
  'update:data': [value: ChatRecord];
}>();

async function copyText() {
  await navigator.clipboard?.writeText(props.data?.answer_text || '');
}
</script>

<template>
  <div class="log-operation-button">
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
.log-operation-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}
</style>
