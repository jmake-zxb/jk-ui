<script setup lang="ts">
import type { ChatRecord } from '#/components/ai-chat/types/application';

import { computed, onMounted, onUnmounted, ref } from 'vue';

import {
  CopyDocument,
  StarFilled,
  VideoPause,
  VideoPlay,
} from '@element-plus/icons-vue';
import { ElButton, ElText, ElTooltip } from 'element-plus';

import { aiChatBus } from '../../utils/bus';

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

// --- TTS 辅助函数 ---
function markdownToPlainText(md: string): string {
  return md
    .replaceAll(/!\[.*?\]\(.*?\)/g, '')
    .replaceAll(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replaceAll(/^#{1,6}\s+/gm, '')
    .replaceAll(/\*\*(.*?)\*\*/g, '$1')
    .replaceAll(/__(.*?)__/g, '$1')
    .replaceAll(/\*(.*?)\*/g, '$1')
    .replaceAll(/_(.*?)_/g, '$1')
    .replaceAll(/`(.*?)`/g, '$1')
    .replaceAll(/```.*?```/gs, '')
    .replaceAll(/<video>.*?<\/video>/gs, '')
    .replaceAll(/<[^>]+>/g, '')
    .replaceAll(/\n{2,}/g, '\n')
    .trim();
}

function removeFormRander(text: string): string {
  return text.replaceAll(/<form_rander>.*?<\/form_rander>/gs, '').trim();
}

// --- TTS 功能 ---
const isPlaying = ref(false);
let speechSynthesis: null | SpeechSynthesis = null;

function initSpeechSynthesis() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    speechSynthesis = window.speechSynthesis;
  }
}

function playTTS() {
  if (!speechSynthesis || !props.data?.answer_text) return;

  stopTTS();

  // 处理文本
  let text = removeFormRander(props.data.answer_text);
  text = markdownToPlainText(text);

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.onend = () => {
    isPlaying.value = false;
  };

  utterance.addEventListener('error', () => {
    isPlaying.value = false;
  });

  speechSynthesis.speak(utterance);
  isPlaying.value = true;
}

function pauseTTS() {
  if (speechSynthesis) {
    speechSynthesis.pause();
    isPlaying.value = false;
  }
}

function resumeTTS() {
  if (speechSynthesis) {
    speechSynthesis.resume();
    isPlaying.value = true;
  }
}

function stopTTS() {
  if (speechSynthesis) {
    speechSynthesis.cancel();
    isPlaying.value = false;
  }
}

function toggleTTS() {
  if (isPlaying.value) {
    pauseTTS();
  } else if (speechSynthesis?.paused) {
    resumeTTS();
  } else {
    playTTS();
  }
}

initSpeechSynthesis();

onMounted(() => {
  aiChatBus.on('play:pause', handlePlayPause);
});

onUnmounted(() => {
  stopTTS();
  aiChatBus.off('play:pause', handlePlayPause);
});

// 监听播放暂停事件
function handlePlayPause(recordId: string) {
  if (recordId !== props.data?.record_id) {
    stopTTS();
  }
}

// --- 复制功能 ---
async function copyText() {
  const text = props.data?.answer_text_list
    ?.map((item) => item.map((answer) => answer.content).join('\n'))
    .join('\n\n');
  await navigator.clipboard?.writeText(text || props.data?.answer_text || '');
}

// --- 投票状态 ---
const voteStatus = computed(() => props.data?.vote_status || '-1');
</script>

<template>
  <div class="log-operation-button">
    <ElText type="info">
      <span v-if="data?.create_time">{{
        new Date(data.create_time).toLocaleString()
      }}</span>
    </ElText>
    <div class="operation-actions">
      <!-- 语音播放 -->
      <template v-if="tts">
        <ElTooltip v-if="isPlaying" content="暂停" placement="top">
          <ElButton
            text
            :disabled="!data?.write_ed"
            :icon="VideoPause"
            @click="toggleTTS"
          />
        </ElTooltip>
        <ElTooltip v-else content="播放" placement="top">
          <ElButton
            text
            :disabled="!data?.write_ed"
            :icon="VideoPlay"
            @click="toggleTTS"
          />
        </ElTooltip>
      </template>
      <ElTooltip content="复制" placement="top">
        <ElButton text :icon="CopyDocument" @click="copyText" />
      </ElTooltip>

      <!-- 投票状态显示 -->
      <ElTooltip v-if="voteStatus === '0'" content="已点赞" placement="top">
        <ElButton text disabled :icon="StarFilled" />
      </ElTooltip>
      <ElTooltip v-if="voteStatus === '1'" content="已反对" placement="top">
        <ElButton text disabled :icon="StarFilled" />
      </ElTooltip>
    </div>
  </div>
</template>

<style scoped>
.log-operation-button {
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
</style>
