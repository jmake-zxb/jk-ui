<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue';

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
  Refresh,
  VideoPause,
} from '@element-plus/icons-vue';
import {
  ElABubble,
  ElABubbleList,
  ElACodeHighlight,
  ElAMarkdown,
  ElASender,
} from 'element-ai-vue';
import { ElButton, ElIcon, ElMessage, ElTag, ElTooltip } from 'element-plus';

import { fetchList } from '#/api/ai/chat';
import { adaptationUrl } from '#/utils/other';

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
      if (messageList.value[index]) {
        messageList.value[index].typing = false; // 隐藏光标
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
    const resData = await fetchList({ sessionId: '1234567890' });
    messageList.value = resData.map((item: any) => ({
      id: item.id,
      content: item.messageContent,
      placement: item.messageType === 'USER' ? 'end' : 'start',
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
});

onUnmounted(() => {
  stopGenerate(); // 销毁组件时确保停止所有任务
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
      </div>
    </div>
  </Page>
</template>

<style scoped lang="scss">
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

.sender {
  :deep(.el-ai-sender__content) {
    max-height: 150px;
    overflow-y: auto;
    // 统一 Element Plus 输入框风格
    border-radius: 8px;
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
