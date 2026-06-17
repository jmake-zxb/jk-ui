<script setup lang="ts">
import type { ChatRecord } from '#/components/ai-chat/types/application';

import { ElButton } from 'element-plus';

import ChatOperationButton from './ChatOperationButton.vue';
import LogOperationButton from './LogOperationButton.vue';
import ShareOperationButton from './ShareOperationButton.vue';

const props = defineProps<{
  application: Record<string, any>;
  chatRecord: ChatRecord;
  loading: boolean;
  regenerationChart: (chatRecord: ChatRecord) => void;
  shareAvailable?: boolean;
  startChat: (chatRecord: ChatRecord) => void;
  stopChat: (chatRecord: ChatRecord) => void;
  type: 'ai-chat' | 'debug-ai-chat' | 'log' | 'share';
}>();

const emit = defineEmits<{
  'update:chatRecord': [value: ChatRecord];
}>();
</script>

<template>
  <div class="operation-button-container">
    <ShareOperationButton v-if="type === 'share'" :data="chatRecord" />

    <LogOperationButton
      v-else-if="type === 'log'"
      :application-id="application.id"
      :data="chatRecord"
      :tts="application.tts_model_enable"
      :tts_type="application.tts_type"
      @update:data="(event) => emit('update:chatRecord', event)"
    />

    <div v-else class="continue-row">
      <ElButton
        v-if="chatRecord.is_stop && !chatRecord.write_ed"
        type="primary"
        link
        @click="props.startChat(chatRecord)"
      >
        继续
      </ElButton>
    </div>

    <ChatOperationButton
      v-show="chatRecord.write_ed && 500 !== chatRecord.status"
      :application-id="application.id"
      :chat-id="chatRecord.chat_id"
      :chat_loading="loading"
      :data="chatRecord"
      :share-available="shareAvailable"
      :tts="application.tts_model_enable"
      :tts_autoplay="application.tts_autoplay"
      :tts_type="application.tts_type"
      :type="type"
      @regeneration="regenerationChart(chatRecord)"
      @update:data="(event) => emit('update:chatRecord', event)"
    />
  </div>
</template>

<style scoped>
.continue-row {
  margin-top: 8px;
}
</style>
