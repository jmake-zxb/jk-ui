<script setup lang="ts">
import type { chatType } from '#/api/ai/types';

import { ElButton } from 'element-plus';

import ChatOperationButton from '#/components/ai-chat/component/operation-button/ChatOperationButton.vue';
import LogOperationButton from '#/components/ai-chat/component/operation-button/LogOperationButton.vue';
import ShareOperationButton from '#/components/ai-chat/component/operation-button/ShareOperationButton.vue';

defineProps<{
  application: any;
  chatRecord: chatType;
  loading: boolean;
  regenerationChart: (chat_record: any) => void;
  startChat: (chat_record: any) => void;
  stopChat: (chat_record: any) => void;
  type: 'ai-chat' | 'debug-ai-chat' | 'log' | 'share';
}>();
const emit = defineEmits(['update:chatRecord']);
</script>
<template>
  <div class="operation-button-container">
    <ShareOperationButton v-if="type === 'share'" :data="chatRecord" />

    <LogOperationButton
      v-else-if="type === 'log'"
      :data="chatRecord"
      @update:data="(event: any) => emit('update:chatRecord', event)"
      :application-id="application.id"
      :tts="application.tts_model_enable ?? false"
      :tts-type="application.tts_type ?? 'BROWSER'"
      :type="type"
    />

    <div class="mt-2" v-else>
      <ElButton
        type="primary"
        v-if="chatRecord.is_stop && !chatRecord.write_ed"
        @click="startChat(chatRecord)"
        link
      >
        {{ $$t('aiChat.operation.continue') }}
      </ElButton>
      <!-- <el-button type="primary" v-else-if="!chatRecord.write_ed" @click="stopChat(chatRecord)" link
        >{{ $$t('aiChat.operation.stopChat') }}
      </el-button> -->
    </div>

    <ChatOperationButton
      v-show="chatRecord.write_ed && 500 !== chatRecord.status"
      :tts="application.tts_model_enable ?? false"
      :tts-type="application.tts_type ?? 'BROWSER'"
      :tts-autoplay="application.tts_autoplay ?? false"
      :data="chatRecord"
      :type="type"
      :application-id="application.id"
      :chat-id="chatRecord.chat_id"
      :chat-loading="loading"
      @regeneration="regenerationChart(chatRecord)"
    />
  </div>
</template>
<style lang="scss" scoped></style>
