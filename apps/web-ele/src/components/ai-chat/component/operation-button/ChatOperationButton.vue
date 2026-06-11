<script setup lang="ts">
import type { ChatRecord } from '#/components/ai-chat/types/application';

import { computed } from 'vue';

import { CopyDocument, Refresh, Share } from '@element-plus/icons-vue';
import { ElButton, ElText, ElTooltip } from 'element-plus';

import { aiChatBus } from '../../utils/bus';

const props = withDefaults(
  defineProps<{
    applicationId?: string;
    chatId?: string;
    chatLoading?: boolean;
    data?: ChatRecord;
    tts?: boolean;
    ttsAutoplay?: boolean;
    ttsType?: string;
    type?: 'ai-chat' | 'debug-ai-chat' | 'log' | 'share';
  }>(),
  {
    applicationId: '',
    chatId: '',
    chatLoading: false,
    data: undefined,
    tts: false,
    ttsAutoplay: false,
    ttsType: '',
    type: 'ai-chat',
  },
);

const emit = defineEmits<{
  clickShare: [recordId: string];
  regeneration: [];
  'update:data': [value: ChatRecord];
}>();

const showActions = computed(
  () => props.type === 'ai-chat' || props.type === 'log',
);

async function copy() {
  const text = props.data?.answer_text_list
    ?.map((item) => item.map((answer) => answer.content).join('\n'))
    .join('\n\n');
  await navigator.clipboard?.writeText(text || props.data?.answer_text || '');
}

function share() {
  const id = props.data?.record_id || '';
  aiChatBus.emit('click:share', id);
  emit('clickShare', id);
}
</script>

<template>
  <div class="chat-operation-button">
    <ElText type="info">
      <span v-if="data?.create_time">{{
        new Date(data.create_time).toLocaleString()
      }}</span>
    </ElText>

    <div v-if="showActions" class="operation-actions">
      <ElTooltip content="复制" placement="top">
        <ElButton text :icon="CopyDocument" @click="copy" />
      </ElTooltip>
      <ElTooltip content="重新生成" placement="top">
        <ElButton
          text
          :disabled="chatLoading"
          :icon="Refresh"
          @click="emit('regeneration')"
        />
      </ElTooltip>
      <ElTooltip content="分享" placement="top">
        <ElButton text :disabled="chatLoading" :icon="Share" @click="share" />
      </ElTooltip>
    </div>
  </div>
</template>

<style scoped>
.chat-operation-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.operation-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}

@media only screen and (max-width: 430px) {
  .chat-operation-button {
    display: block;
    text-align: right;
  }
}
</style>
