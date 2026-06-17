<script setup lang="ts">
import type { SimpleApplicationSettings } from '#/views/ai/orchestration/applications/simple-application-settings';

import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useAppConfig } from '@vben/hooks';
import { usePreferences } from '@vben/preferences';
import { useAccessStore } from '@vben/stores';

import {
  Avatar,
  ChatDotRound,
  CopyDocument,
  Delete,
  Document,
  MagicStick,
  Microphone,
  Refresh,
  VideoPause,
  VideoPlay,
} from '@element-plus/icons-vue';
import {
  ElABubble,
  ElABubbleList,
  ElACodeHighlight,
  ElAMarkdown,
  ElASender,
} from 'element-ai-vue';
import { ElButton, ElIcon, ElMessage, ElTag, ElTooltip } from 'element-plus';

import {
  getApplication,
  getWorkflowDraft,
  speechToText,
  textToSpeech,
} from '#/api/ai/applications';
import { getChatHistory } from '#/api/ai/chat';
import { adaptationUrl } from '#/utils/other';
import { parseSimpleApplicationSettings } from '#/views/ai/orchestration/applications/simple-application-settings';

// --- 类型定义 ---
interface SourceItem {
  id: string;
  score: number;
  metadata?: {
    filename?: string;
    title?: string;
  };
  content?: string;
}

interface ChatItem {
  id: string;
  content: string;
  placement: 'end' | 'start';
  variant: 'borderless' | 'filled' | 'outlined' | 'shadow';
  isMarkdown: boolean;
  typing: boolean;
  loading: boolean;
  sources?: Array<SourceItem>;
  error?: boolean;
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getHistoryItems(response: unknown): Array<Record<string, unknown>> {
  const candidates: unknown[] = [response];
  if (isRecordObject(response)) {
    candidates.push(
      response.records,
      response.rows,
      response.list,
      response.data,
    );
    if (isRecordObject(response.data)) {
      candidates.push(
        response.data.records,
        response.data.rows,
        response.data.list,
      );
    }
  }

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item) => isRecordObject(item));
    }
  }
  return [];
}

function toText(value: unknown) {
  return value === undefined || value === null ? '' : String(value);
}

// --- 状态 ---
const isReady = ref(false);
const senderRef = ref<InstanceType<typeof ElASender> | null>(null);
const chatListRef = ref<InstanceType<typeof ElABubbleList> | null>(null);

const inputContent = ref('');
const loading = ref(false);
const messageList = ref<ChatItem[]>([]);
const abortController = ref<AbortController | null>(null);

// [核心优化] 字符缓冲队列 & 动画ID
let charQueue: string[] = [];
let animationFrameId: null | number = null;

const { isDark } = usePreferences();
const accessStore = useAccessStore();
const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

// --- 音频能力（TTS / STT）---
// TODO: 当前会话固定指向 `/ai/api/chat/stream` 这个无应用上下文的端点，
// 没有 applicationId 来源。如果要让此页面对接具体应用的 TTS/STT 配置，
// 需要从路由 query / props / 全局 store 注入 applicationId 并调用
// `getApplication` + `getWorkflowDraft` -> `parseSimpleApplicationSettings`
// 来获取真实的 8 个 TTS/STT 字段。在未提供 applicationId 时，音频 UI 默认禁用。
const chatApplicationId = ref<number | string | undefined>(undefined);
const audioConfig = ref<null | Pick<
  SimpleApplicationSettings,
  | 'stt_autosend'
  | 'stt_model_enable'
  | 'stt_model_id'
  | 'tts_autoplay'
  | 'tts_model_enable'
  | 'tts_model_id'
  | 'tts_type'
>>(null);

const ttsEnabled = computed(() => Boolean(audioConfig.value?.tts_model_enable));
const sttEnabled = computed(() => Boolean(audioConfig.value?.stt_model_enable));
const ttsAutoplay = computed(() => Boolean(audioConfig.value?.tts_autoplay));
const sttAutosend = computed(() => Boolean(audioConfig.value?.stt_autosend));
const ttsType = computed<'BROWSER' | 'TTS'>(() =>
  audioConfig.value?.tts_type === 'TTS' ? 'TTS' : 'BROWSER',
);

// 音频播放状态
const playingMessageId = ref<null | string>(null);
let currentAudio: HTMLAudioElement | null = null;
let currentAudioUrl: null | string = null;
let currentUtterance: null | SpeechSynthesisUtterance = null;

// 录音状态
const recording = ref(false);
const transcribing = ref(false);
let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let recordedChunks: Blob[] = [];
let recordingTimer: null | ReturnType<typeof setTimeout> = null;
const RECORD_MAX_MS = 60_000;

const suggestions = [
  '维修资金的使用流程是什么？',
  '如何查询维修资金余额？',
  '紧急情况下如何使用维修资金？',
  '新房维修资金的缴纳标准是多少？',
];

const setChatListRef = (el: any) => {
  chatListRef.value = el;
};

// --- 逻辑方法 ---

function formatToken(token: null | string) {
  return token ? `Bearer ${token}` : '';
}

/**
 * 停止生成
 */
function stopGenerate() {
  // 1. 中断网络
  if (abortController.value) {
    abortController.value.abort();
    abortController.value = null;
  }

  // 2. [关键] 停止动画并清空队列，防止停止后还在继续打字
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  charQueue = [];

  loading.value = false;

  // 3. 更新 UI
  const lastMsg = messageList.value[messageList.value.length - 1];
  if (lastMsg && (lastMsg.loading || lastMsg.typing)) {
    lastMsg.loading = false;
    lastMsg.typing = false;
    lastMsg.content += '\n\n*(用户已停止生成)*';
  }
}

/**
 * 发送消息处理
 */
async function handleSend(content: string) {
  let question = content.trim();
  if (!question) return;

  if (loading.value) stopGenerate();

  loading.value = true;
  question = question.replaceAll('\n', '\n\n');

  // 用户消息
  messageList.value.push({
    id: `user_${Date.now()}`,
    content: question,
    placement: 'end',
    variant: 'filled',
    isMarkdown: true,
    typing: false,
    loading: false,
  });

  inputContent.value = '';
  scrollToBottom();

  await requestAI(question);
}

/**
 * 封装请求逻辑
 */
async function requestAI(question: string) {
  // AI 占位消息
  messageList.value.push({
    id: `ai_${Date.now()}`,
    content: '', // 初始为空，全靠动画填充
    placement: 'start',
    variant: 'filled',
    isMarkdown: true,
    typing: true,
    loading: true,
  });

  const aiMsgIndex = messageList.value.length - 1;
  scrollToBottom();

  abortController.value = new AbortController();

  try {
    const response = await fetch(
      `${apiURL}${adaptationUrl('/ai/api/chat/stream')}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: formatToken(accessStore.accessToken),
        },
        body: JSON.stringify({ content: question }),
        signal: abortController.value.signal,
      },
    );

    if (messageList.value[aiMsgIndex]) {
      messageList.value[aiMsgIndex].loading = false;
      if (!response.body) throw new Error('No body');

      // 开始流式处理
      await processStream(response.body, aiMsgIndex);
    }
  } catch (error: any) {
    if (error.name === 'AbortError') return;
    console.error(error);
    if (messageList.value[aiMsgIndex]) {
      messageList.value[aiMsgIndex].content +=
        '\n\n**请求失败**：请检查网络或稍后重试。';
      messageList.value[aiMsgIndex].error = true;
    }
  } finally {
    // 这里只设置 loading，不要关 typing，因为可能队列里还有字没打完
    // typing 的关闭交给 renderLoop
    loading.value = false;
    abortController.value = null;
  }
}

/**
 * [核心] 流处理 + 强制逐字动画 + 性能优化
 */
async function processStream(body: ReadableStream<Uint8Array>, index: number) {
  const reader = body.getReader();
  const decoder = new TextDecoder();

  // 1. 初始化队列
  charQueue = [];
  let isStreamDone = false;
  let frameCount = 0; // 用于滚动节流计数

  // 2. 定义消费者：打字机动画循环
  const renderLoop = () => {
    // 只要队列里有字，或者网络还没结束，就一直循环
    if (charQueue.length > 0 || !isStreamDone) {
      frameCount++;

      if (charQueue.length > 0) {
        // [动态速度控制 & ESLint 修复]
        // 浏览器 requestAnimationFrame 约 16ms 执行一次
        // 积压越多，每一帧吐字越多
        let speed = 1;
        if (charQueue.length > 100) {
          speed = 5;
        } else if (charQueue.length > 50) {
          speed = 3;
        }

        // 从队列头部取出 speed 个字符
        const chars = charQueue.splice(0, speed).join('');

        if (messageList.value[index]) {
          messageList.value[index].content += chars;

          // [性能优化] 滚动节流：每 3 帧 (约50ms) 滚动一次，减少 Layout Thrashing
          if (frameCount % 3 === 0) {
            chatListRef.value?.scrollToBottom();
          }
        }
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    } else {
      // 结束时确保滚到底部
      chatListRef.value?.scrollToBottom();

      // 队列空了且网络断了 -> 结束
      animationFrameId = null;
      const finishedMsg = messageList.value[index];
      if (finishedMsg) {
        finishedMsg.typing = false; // 隐藏光标
        // TTS 自动播放
        if (
          ttsEnabled.value &&
          ttsAutoplay.value &&
          !finishedMsg.error &&
          finishedMsg.content.trim().length > 0
        ) {
          void playMessageAudio(finishedMsg);
        }
      }
    }
  };

  // 启动动画
  animationFrameId = requestAnimationFrame(renderLoop);

  // 3. 定义生产者：读取网络流并填充队列
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      isStreamDone = true; // 告诉动画：货源断了，你把库存清完就休息吧
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const eventChunk of events) {
      if (!eventChunk.trim()) continue;

      const lines = eventChunk.split('\n');
      const dataLines = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5));

      if (dataLines.length === 0) continue;
      const rawData = dataLines.join('\n').trim();
      if (rawData === '[DONE]') continue;

      try {
        const payload = JSON.parse(rawData);

        switch (payload.type) {
          case 'content': {
            // [Unicode 修复] 使用 spread operator 处理 Emoji 和代理对
            if (payload.data) {
              charQueue.push(...payload.data);
            }
            break;
          }
          case 'error': {
            if (messageList.value[index]) {
              messageList.value[index].content += `\n\n> ⚠️ ${payload.data}`;
              messageList.value[index].error = true;
            }
            break;
          }
          case 'sources': {
            // 引用源直接显示，不走打字机
            if (messageList.value[index]) {
              messageList.value[index].sources = payload.data;
            }
            break;
          }
          // No default
        }
      } catch {
        // 容错：非 JSON 文本拆散进队
        charQueue.push(...rawData);
      }
    }
  }
  reader.releaseLock();
}

// --- 音频：TTS 播放 ---
function stopAudio() {
  if (currentAudio) {
    try {
      currentAudio.pause();
    } catch {
      // ignore
    }
    currentAudio.src = '';
    currentAudio = null;
  }
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  currentUtterance = null;
  playingMessageId.value = null;
}

async function playMessageAudio(item: ChatItem) {
  if (!ttsEnabled.value) return;
  // 如果正在播放同一条消息 -> 停止
  if (playingMessageId.value === item.id) {
    stopAudio();
    return;
  }
  // 切换到新消息：先停止上一段
  stopAudio();
  const text = stripMarkdown(item.content);
  if (!text) return;
  playingMessageId.value = item.id;

  if (ttsType.value === 'BROWSER') {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      ElMessage.error('当前浏览器不支持语音合成');
      playingMessageId.value = null;
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    currentUtterance = utterance;
    const handleUtteranceDone = () => {
      if (currentUtterance === utterance) {
        currentUtterance = null;
        playingMessageId.value = null;
      }
    };
    utterance.addEventListener('end', handleUtteranceDone);
    utterance.addEventListener('error', handleUtteranceDone);
    window.speechSynthesis.speak(utterance);
    return;
  }

  // TTS 模型：调用后端
  if (!chatApplicationId.value) {
    ElMessage.error('未配置应用 ID，无法调用 TTS 模型');
    playingMessageId.value = null;
    return;
  }
  try {
    const blob = await textToSpeech(chatApplicationId.value, { text });
    if (playingMessageId.value !== item.id) {
      // 用户已切换 / 停止
      return;
    }
    const url = URL.createObjectURL(blob);
    currentAudioUrl = url;
    const audio = new Audio(url);
    currentAudio = audio;
    const cleanup = () => {
      if (currentAudio === audio) {
        currentAudio = null;
        if (currentAudioUrl === url) {
          URL.revokeObjectURL(url);
          currentAudioUrl = null;
        }
        playingMessageId.value = null;
      }
    };
    audio.addEventListener('ended', cleanup);
    audio.addEventListener('error', cleanup);
    await audio.play();
  } catch (error) {
    console.error('TTS 播放失败', error);
    ElMessage.error('语音合成失败');
    playingMessageId.value = null;
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      currentAudioUrl = null;
    }
    currentAudio = null;
  }
}

function stripMarkdown(input: string) {
  return input
    .replaceAll(/```[\s\S]*?```/g, '')
    .replaceAll(/`[^`]*`/g, '')
    .replaceAll(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replaceAll(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replaceAll(/[#*_>~]/g, '')
    .trim();
}

// --- 音频：STT 录音 ---
async function toggleRecord() {
  if (!sttEnabled.value) return;
  if (recording.value) {
    stopRecord();
    return;
  }
  await startRecord();
}

async function startRecord() {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices?.getUserMedia ||
    typeof MediaRecorder === 'undefined'
  ) {
    ElMessage.error('当前浏览器不支持语音录制');
    return;
  }
  if (!chatApplicationId.value) {
    ElMessage.error('未配置应用 ID，无法调用 STT 模型');
    return;
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    console.error('麦克风权限被拒绝', error);
    ElMessage.error('麦克风权限被拒绝或不可用');
    return;
  }
  recordedChunks = [];
  try {
    mediaRecorder = new MediaRecorder(mediaStream);
  } catch (error) {
    console.error('MediaRecorder 初始化失败', error);
    ElMessage.error('无法启动录音');
    releaseStream();
    return;
  }
  mediaRecorder.addEventListener('dataavailable', (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  });
  mediaRecorder.addEventListener('stop', () => {
    void handleRecordStop();
  });
  mediaRecorder.start();
  recording.value = true;
  recordingTimer = setTimeout(() => {
    if (recording.value) stopRecord();
  }, RECORD_MAX_MS);
}

function stopRecord() {
  if (recordingTimer) {
    clearTimeout(recordingTimer);
    recordingTimer = null;
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop();
    } catch {
      // ignore
    }
  }
  recording.value = false;
}

function releaseStream() {
  if (mediaStream) {
    for (const track of mediaStream.getTracks()) track.stop();
    mediaStream = null;
  }
  mediaRecorder = null;
  recordedChunks = [];
}

async function handleRecordStop() {
  const chunks = recordedChunks;
  const mimeType = mediaRecorder?.mimeType || 'audio/webm';
  releaseStream();
  if (chunks.length === 0) return;
  const appId = chatApplicationId.value;
  if (!appId) return;
  const blob = new Blob(chunks, { type: mimeType });
  transcribing.value = true;
  try {
    const text = await speechToText(appId, blob);
    const transcript = (text || '').trim();
    if (!transcript) {
      ElMessage.warning('未识别到有效语音');
      return;
    }
    if (sttAutosend.value) {
      await handleSend(transcript);
    } else {
      inputContent.value = inputContent.value
        ? `${inputContent.value} ${transcript}`
        : transcript;
    }
  } catch (error) {
    console.error('语音识别失败', error);
    ElMessage.error('语音识别失败');
  } finally {
    transcribing.value = false;
  }
}

// --- 应用配置加载 ---
async function loadAudioConfig() {
  const id = chatApplicationId.value;
  if (!id) return;
  try {
    const [application, draft] = await Promise.all([
      getApplication(id),
      getWorkflowDraft(id),
    ]);
    const graphData =
      draft && typeof draft === 'object'
        ? ((draft as Record<string, unknown>).graphData ??
          (draft as Record<string, unknown>).graph_data)
        : draft;
    const settings = parseSimpleApplicationSettings(
      graphData,
      (application || {}) as Record<string, unknown>,
    );
    audioConfig.value = {
      stt_autosend: settings.stt_autosend,
      stt_model_enable: settings.stt_model_enable,
      stt_model_id: settings.stt_model_id,
      tts_autoplay: settings.tts_autoplay,
      tts_model_enable: settings.tts_model_enable,
      tts_model_id: settings.tts_model_id,
      tts_type: settings.tts_type,
    };
  } catch (error) {
    console.warn('加载音频配置失败', error);
  }
}

// --- 辅助功能 ---
const clearChat = () => {
  if (loading.value) stopGenerate();
  messageList.value = [];
  ElMessage.success('对话已清空');
};

const copyText = (text: string) => {
  navigator.clipboard.writeText(text);
  ElMessage.success('已复制');
};

const regenerate = async (index: number) => {
  if (loading.value) return;
  const aiMsg = messageList.value[index];
  if (aiMsg?.placement !== 'start') return;

  const prevUserMsg = messageList.value[index - 1];
  if (!prevUserMsg || prevUserMsg.placement !== 'end') {
    ElMessage.warning('无法找到上下文');
    return;
  }

  messageList.value.splice(index, 1);
  loading.value = true;
  await requestAI(prevUserMsg.content);
};

const scrollToBottom = () => {
  nextTick(() => chatListRef.value?.scrollToBottom('smooth'));
};

const getMessageList = async () => {
  try {
    loading.value = true;
    const resData = getHistoryItems(await getChatHistory('1234567890'));
    messageList.value = resData.map((item, index) => ({
      id: toText(item.id) || `history_${index}`,
      content: toText(
        item.messageContent ??
          item.message_content ??
          item.content ??
          item.message,
      ),
      placement:
        toText(
          item.messageType ?? item.message_type ?? item.role,
        ).toUpperCase() === 'USER'
          ? 'end'
          : 'start',
      variant: 'filled',
      isMarkdown: true,
      typing: false,
      loading: false,
    }));
    scrollToBottom();
  } catch (error) {
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const handleSuggestionClick = (text: string) => {
  inputContent.value = text;
  handleSend(text);
};

onMounted(() => {
  isReady.value = true;
  getMessageList();
  senderRef.value?.focus();
  if (chatApplicationId.value) {
    void loadAudioConfig();
  }
});

onUnmounted(() => {
  stopGenerate(); // 销毁组件时确保停止所有任务
  stopAudio();
  if (recording.value) stopRecord();
  releaseStream();
});
</script>

<template>
  <Page auto-content-height>
    <div class="chat-wrapper">
      <header class="header">
        <div class="title-area">
          <span class="title">维修资金 AI 助手</span>
          <ElTag
            v-if="loading"
            size="small"
            type="success"
            effect="plain"
            class="ml-2"
          >
            生成中...
          </ElTag>
        </div>
        <div class="controls">
          <ElTooltip content="清空对话" placement="bottom">
            <ElButton link :icon="Delete" @click="clearChat" />
          </ElTooltip>
        </div>
      </header>

      <div class="message-container">
        <div v-if="messageList.length === 0 && !loading" class="empty-state">
          <div class="empty-icon">
            <ElIcon :size="48"><MagicStick /></ElIcon>
          </div>
          <h3 class="empty-title">你好，我是维修资金 AI 助手</h3>
          <p class="empty-desc">
            我可以帮您解答关于维修资金的使用、查询、补交等问题。
          </p>

          <div class="suggestions">
            <div
              v-for="(text, idx) in suggestions"
              :key="idx"
              class="suggestion-item"
              @click="handleSuggestionClick(text)"
            >
              {{ text }}
            </div>
          </div>
        </div>

        <ElABubbleList
          v-else
          :ref="setChatListRef"
          :key="messageList.length"
          class="message-list"
        >
          <ElABubble
            v-for="(item, index) in messageList"
            :key="item.id"
            :placement="item.placement"
            :variant="item.variant"
            :typing="item.typing"
            :loading="item.loading"
            footer-trigger="hover"
          >
            <template #avatar>
              <div
                class="avatar"
                :class="item.placement === 'end' ? 'user' : 'ai'"
              >
                <ElIcon v-if="item.placement === 'end'"><Avatar /></ElIcon>
                <ElIcon v-else><ChatDotRound /></ElIcon>
              </div>
            </template>

            <ElAMarkdown :content="item.content">
              <template #code="props">
                <ElACodeHighlight
                  :content="props.content"
                  :language="props.language"
                  :extend-themes="props.extendThemes"
                  :show-line-numbers="true"
                  :theme="isDark ? 'dark' : 'light'"
                />
              </template>
            </ElAMarkdown>

            <template #footer v-if="item.placement === 'start'">
              <div class="footer-wrapper">
                <div
                  v-if="item.sources && item.sources.length > 0"
                  class="sources-container"
                >
                  <p class="sources-title">
                    <ElIcon class="mr-1"><Document /></ElIcon> 参考知识库
                  </p>
                  <div class="sources-grid">
                    <div
                      v-for="(source, sIndex) in item.sources"
                      :key="sIndex"
                      class="source-card"
                    >
                      <div class="source-header">
                        <span class="filename" :title="source.metadata?.title">
                          {{
                            source.metadata?.filename ||
                            source.metadata?.title ||
                            '未命名文档'
                          }}
                        </span>
                        <span class="score" v-if="source.score">
                          {{ (source.score * 100).toFixed(0) }}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="bubble-actions">
                  <span class="action-btn" @click="copyText(item.content)">
                    <ElTooltip content="复制内容" placement="top">
                      <ElIcon><CopyDocument /></ElIcon>
                    </ElTooltip>
                  </span>
                  <span
                    v-if="ttsEnabled && item.content"
                    class="action-btn"
                    :class="{ 'is-active': playingMessageId === item.id }"
                    @click="playMessageAudio(item)"
                  >
                    <ElTooltip
                      :content="
                        playingMessageId === item.id ? '停止播放' : '播放'
                      "
                      placement="top"
                    >
                      <ElIcon>
                        <VideoPause v-if="playingMessageId === item.id" />
                        <VideoPlay v-else />
                      </ElIcon>
                    </ElTooltip>
                  </span>
                  <span
                    class="action-btn"
                    @click="regenerate(index)"
                    v-if="!loading"
                  >
                    <ElTooltip content="重新生成" placement="top">
                      <ElIcon><Refresh /></ElIcon>
                    </ElTooltip>
                  </span>
                </div>
              </div>
            </template>
          </ElABubble>
        </ElABubbleList>
      </div>

      <div class="input-area">
        <div v-if="loading" class="stop-btn-wrapper">
          <ElButton round size="small" :icon="VideoPause" @click="stopGenerate">
            停止生成
          </ElButton>
        </div>

        <div class="sender-row">
          <ElASender
            ref="senderRef"
            v-model="inputContent"
            :loading="loading"
            placeholder="请输入您的问题，Shift + Enter 换行..."
            variant="default"
            :enter-break="false"
            @send="handleSend"
            class="sender"
          />
          <ElTooltip
            v-if="sttEnabled"
            :content="recording ? '停止录音' : '语音输入'"
            placement="top"
          >
            <ElButton
              circle
              :type="recording ? 'danger' : 'primary'"
              :icon="Microphone"
              :loading="transcribing"
              :disabled="loading || transcribing"
              class="mic-btn"
              :class="{ 'is-recording': recording }"
              @click="toggleRecord"
            />
          </ElTooltip>
        </div>
        <div v-if="recording" class="recording-tip">
          <span class="recording-dot"></span>
          正在录音...（最长 60 秒，再次点击结束）
        </div>
      </div>
    </div>
  </Page>
</template>

<style scoped lang="scss">
@keyframes mic-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.4;
  }
}

.chat-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background-color: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 20px;
  background-color: var(--el-bg-color-overlay);
  border-bottom: 1px solid var(--el-border-color-lighter);

  .title {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}

.message-container {
  position: relative;
  flex: 1;
  overflow: hidden;
  line-height: 28px;
}

.message-list {
  height: 100%;
  padding: 20px 16px;
}

:deep(.el-ai-bubble.el-ai-bubble-end) {
  margin-top: 25px;
  margin-bottom: 25px;
}

/* --- 空状态样式 --- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 20px;
  color: var(--el-text-color-regular);
  text-align: center;

  .empty-icon {
    padding: 20px;
    margin-bottom: 16px;
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    border-radius: 50%;
  }

  .empty-title {
    margin-bottom: 8px;
    font-size: 18px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .empty-desc {
    max-width: 400px;
    margin-bottom: 32px;
    font-size: 14px;
    color: var(--el-text-color-secondary);
  }

  .suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
    max-width: 600px;
  }

  .suggestion-item {
    padding: 8px 16px;
    font-size: 13px;
    cursor: pointer;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 20px;
    transition: all 0.3s;

    &:hover {
      color: var(--el-color-primary);
      background-color: var(--el-color-primary-light-9);
      border-color: var(--el-color-primary);
    }
  }
}

/* --- 输入区域样式 --- */
.input-area {
  position: relative;
  flex-shrink: 0;
  padding: 16px 20px;
  background-color: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color-lighter);
}

.stop-btn-wrapper {
  position: absolute;
  top: -40px;
  left: 50%;
  z-index: 10;
  transform: translateX(-50%);
}

.sender-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.sender {
  flex: 1;
  min-width: 0;

  :deep(.el-ai-sender__content) {
    max-height: 150px;
    overflow-y: auto;
    // 统一 Element Plus 输入框风格
    border-radius: 8px;
  }
}

.mic-btn {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  font-size: 18px;
  color: var(--el-text-color-secondary);
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  transition: all 0.18s ease;

  &:hover:not(:disabled) {
    color: var(--el-color-primary);
    border-color: var(--el-color-primary);
  }

  &.is-recording {
    color: #fff;
    background: var(--el-color-danger);
    border-color: var(--el-color-danger);
    animation: mic-pulse 1.2s ease-in-out infinite;
  }

  &.is-transcribing {
    color: var(--el-color-primary);
    border-color: var(--el-color-primary);
  }
}

.recording-indicator {
  position: absolute;
  top: -40px;
  right: 24px;
  z-index: 10;
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 4px 12px;
  font-size: 12px;
  color: var(--el-color-danger);
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-color-danger-light-5);
  border-radius: 999px;

  .recording-dot {
    width: 8px;
    height: 8px;
    background: var(--el-color-danger);
    border-radius: 50%;
    animation: mic-pulse 1.2s ease-in-out infinite;
  }
}

/* --- 气泡内部样式优化 --- */

/* 头像 */
.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;

  &.user {
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-8);
  }

  &.ai {
    color: var(--el-color-success);
    background: var(--el-color-success-light-8);
  }
}

/* 底部操作栏 */
.footer-wrapper {
  width: 100%;
}

/* 引用源卡片 */
.sources-container {
  padding: 10px;
  margin-top: 12px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.sources-title {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.sources-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.source-card {
  max-width: 200px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: default;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;

  &:hover {
    border-color: var(--el-color-primary-light-5);
  }
}

.source-header {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: space-between;

  .filename {
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--el-text-color-regular);
    white-space: nowrap;
  }

  .score {
    padding: 1px 3px;
    font-size: 10px;
    color: var(--el-color-success);
    background: var(--el-color-success-light-9);
    border-radius: 2px;
  }
}

/* 工具栏按钮 */
.bubble-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 8px;
  opacity: 0; // 默认隐藏，hover 时显示
  transition: opacity 0.2s;

  .action-btn {
    padding: 2px;
    font-size: 14px;
    color: var(--el-text-color-secondary);
    cursor: pointer;

    &:hover {
      color: var(--el-color-primary);
    }
  }
}

// hover 整个气泡时显示操作栏
:deep(.el-ai-bubble):hover .bubble-actions {
  opacity: 1;
}
</style>
