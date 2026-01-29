<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import {
  Avatar,
  ChatDotRound,
  CopyDocument,
  Document,
  Refresh,
} from '@element-plus/icons-vue';
import {
  ElABubble,
  ElABubbleList,
  ElACodeHighlight,
  ElAMarkdown,
  ElASender,
} from 'element-ai-vue';
import { ElIcon, ElMessage, ElTooltip } from 'element-plus';

import { fetchList } from '#/api/ai/chat';
import { adaptationUrl } from '#/utils/other';

// --- 类型定义 ---
interface ChatItem {
  id: string;
  content: string;
  placement: 'end' | 'start';
  // 根据文档优化 variant 类型
  variant: 'borderless' | 'filled' | 'outlined' | 'shadow';
  isMarkdown: boolean;
  typing: boolean;
  loading: boolean;
  sources?: Array<{
    id: string;
    score: number;
  }>;
}

// --- 状态 ---
const isReady = ref(false);
const senderRef = ref<InstanceType<typeof ElASender> | null>(null);

const chatListRef = ref<InstanceType<typeof ElABubbleList> | null>(null);
const inputContent = ref('');
const loading = ref(false); // 全局 loading 控制输入框
const messageList = ref<ChatItem[]>([]);

const setChatListRef = (el: any) => {
  chatListRef.value = el;
};

// --- 逻辑方法 ---

function formatToken(token: null | string) {
  return token ? `Bearer ${token}` : null;
}

/**
 * 发送消息处理
 * ElASender 的 @send 事件会直接把输入内容作为参数传出来
 */
async function handleSend(content: string) {
  let question = content.trim();
  if (!question || loading.value) return;

  loading.value = true;

  question = question.replaceAll('\n', '\n\n');

  // 1. 添加用户消息
  messageList.value.push({
    id: `user_${Date.now()}`,
    content: question,
    placement: 'end',
    variant: 'filled', // 用户消息通常用填充色
    isMarkdown: true,
    typing: false,
    loading: false,
  });

  // 清空输入框 (v-model)
  inputContent.value = '';

  // 2. 添加 AI 占位消息
  messageList.value.push({
    id: `ai_${Date.now()}`,
    content: '',
    placement: 'start',
    variant: 'filled', // AI 消息推荐无边框或 shadow，更像文档流
    isMarkdown: true,
    typing: false, // 开启打字机效果
    loading: true, // 初始显示 Loading 状态
  });

  const aiMsgIndex = messageList.value.length - 1;

  try {
    const accessStore = useAccessStore();
    const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
    const response = await fetch(
      `${apiURL}${adaptationUrl('/ai/api/chat/stream')}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: formatToken(accessStore.accessToken) as string,
        },
        body: JSON.stringify({ content: question }),
      },
    );

    if (messageList.value[aiMsgIndex]) {
      messageList.value[aiMsgIndex].loading = false;
      if (!response.body) throw new Error('No body');
      await processStream(response.body, aiMsgIndex);
    }
  } catch (error) {
    console.error(error);
    if (messageList.value[aiMsgIndex]) {
      messageList.value[aiMsgIndex].content =
        '**出错啦**：请求失败，请稍后重试。';
    }
  } finally {
    loading.value = false; // 恢复输入框输入
    // 结束 AI 气泡的打字机状态
    if (messageList.value[aiMsgIndex]) {
      messageList.value[aiMsgIndex].loading = false;
    }
  }
}

/**
 * 流处理通用方法 (适配 JSON 协议)
 */
async function processStream(body: ReadableStream<Uint8Array>, index: number) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    // SSE 通常以 \n\n 分隔每个 event
    const events = buffer.split('\n\n');
    // 保留最后一个可能不完整的 chunk
    buffer = events.pop() || '';

    for (const eventChunk of events) {
      if (!eventChunk.trim()) continue;

      // 提取 data: 后的内容
      const lines = eventChunk.split('\n');
      // 过滤出以 data: 开头的行并去掉前缀
      const dataLines = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5));

      if (dataLines.length === 0) continue;

      const rawData = dataLines.join('\n').trim();

      // 处理结束标志
      if (rawData === '[DONE]') continue;

      try {
        // [修改核心] 解析 JSON 协议
        // 后端返回格式: { "type": "sources"|"content"|"error", "data": ... }
        const payload = JSON.parse(rawData);

        switch (payload.type) {
          case 'content': {
            if (messageList.value[index]) {
              messageList.value[index].content += payload.data;
            }

            break;
          }
          case 'error': {
            if (messageList.value[index]) {
              messageList.value[index].content += `\n\n> ${payload.data}`;
            }

            break;
          }
          case 'sources': {
            if (messageList.value[index]) {
              messageList.value[index].sources = payload.data;
            }

            break;
          }
          // No default
        }
      } catch (error) {
        // 容错：如果后端返回的不是JSON（比如直接返回纯文本），则直接拼接到内容
        // 这段逻辑用于兼容旧接口或非结构化错误
        console.warn('JSON parse error, treating as text:', error);
        accumulated += rawData;
        if (messageList.value[index]) {
          messageList.value[index].content = accumulated;
        }
      }
    }
  }
  reader.releaseLock();
}

/**
 * 辅助功能
 */
const clearChat = () => {
  messageList.value = [];
};

const copyText = (text: string) => {
  navigator.clipboard.writeText(text);
  ElMessage.success('已复制');
};

const regenerate = (index: number) => {
  // 简单示例：找到最近的一条用户消息重新发送
  // 实际场景可能需要更复杂的上下文处理
  console.log('重新生成', index);
};

const getMessageList = async () => {
  loading.value = true;
  const resData = await fetchList({ sessionId: '1234567890' });
  messageList.value = resData.map(
    (item: { id: any; messageContent: any; messageType: string }) => ({
      id: item.id,
      content: item.messageContent,
      placement: item.messageType === 'USER' ? 'end' : 'start',
      variant: 'filled',
      isMarkdown: true,
      typing: false,
      loading: false,
    }),
  );
  setTimeout(() => {
    chatListRef?.value?.scrollToBottom('smooth');
  }, 500);
  loading.value = false;
};

onMounted(() => {
  isReady.value = true;
  getMessageList();
  senderRef.value?.focus();
});
</script>

<template>
  <Page auto-content-height>
    <div class="chat-wrapper">
      <!-- 头部 -->
      <header class="header">
        <span class="title">维修资金AI 助手</span>
        <div class="controls">
          <button @click="clearChat" class="text-btn">清空</button>
        </div>
      </header>

      <!-- 消息列表区域 -->
      <ElABubbleList
        v-if="isReady"
        :ref="setChatListRef"
        :key="messageList.length"
        class="message-area"
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
          <!-- 头像插槽 -->
          <template #avatar>
            <div
              class="avatar"
              :class="item.placement === 'end' ? 'user' : 'ai'"
            >
              <!-- 用户头像 Icon -->
              <ElIcon v-if="item.placement === 'end'"><Avatar /></ElIcon>
              <!-- AI 头像 Icon -->
              <ElIcon v-else><ChatDotRound /></ElIcon>
            </div>
          </template>

          <!-- AI回答内容插槽 -->
          <ElAMarkdown :content="item.content">
            <template #code="props">
              <!-- <div v-if="props.language === 'echarts'">
              <echartsTest
                :content="props.content"
                :theme="props.theme"
              ></echartsTest>
            </div> -->
              <ElACodeHighlight v-bind="props" />
            </template>
          </ElAMarkdown>
          <!-- 底部操作栏插槽 (仅 AI 消息且打字结束后显示) -->
          <template #footer v-if="item.placement === 'start'">
            <div class="footer-wrapper">
              <!-- [新增] 知识库引用来源卡片 -->
              <div
                v-if="item.sources && item.sources.length > 0"
                class="sources-container"
              >
                <p class="sources-title">📚 参考知识：</p>
                <div class="sources-list">
                  <div
                    v-for="(source, sIndex) in item.sources"
                    :key="sIndex"
                    class="source-card"
                  >
                    <!-- 显示文件名或标题 -->
                    <div class="source-header">
                      <ElIcon><Document /></ElIcon>
                      <!-- <span class="filename">{{ source.metadata?.filename || source.metadata?.title || '未知文档' }}</span> -->
                      <span class="score" v-if="source.score">
                        匹配度: {{ (source.score * 100).toFixed(0) }}%
                      </span>
                    </div>
                    <!-- 显示摘要片段 -->
                    <!-- <div class="source-text" :title="source.content">{{ source.content.slice(0, 60) }}...</div> -->
                  </div>
                </div>
              </div>

              <!--原有操作按钮 -->
              <div class="bubble-actions">
                <span class="action-btn" @click="copyText(item.content)">
                  <ElTooltip content="复制" placement="bottom">
                    <ElIcon><CopyDocument /></ElIcon>
                  </ElTooltip>
                </span>
                <span class="action-btn" @click="regenerate(index)">
                  <ElTooltip content="重新生成" placement="bottom">
                    <ElIcon><Refresh /></ElIcon>
                  </ElTooltip>
                </span>
              </div>
            </div>
          </template>
        </ElABubble>
      </ElABubbleList>

      <!-- 底部输入框 -->
      <div class="input-area">
        <!-- 
        1. 使用 @send 事件直接获取内容，无需 ref 操作 DOM
        2. enter-break: false 表示回车发送，Shift+回车换行 (符合大多数 IM 习惯)
        3. 绑定 loading 控制输入框禁用状态
      -->
        <ElASender
          ref="senderRef"
          v-model="inputContent"
          v-model:loading="loading"
          placeholder="请输入您的问题..."
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
  background-color: #f7f8fa; /* 稍微给点背景色，区分气泡 */
}

.header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  height: 50px;
  padding: 0 20px;
  background: #fff;
  border-bottom: 1px solid #e5e6eb;

  .title {
    font-weight: 600;
    color: #1d2129;
  }

  .text-btn {
    color: #86909c;
    cursor: pointer;
    background: none;
    border: none;

    &:hover {
      color: #409eff;
    }
  }
}

.message-area {
  flex: 1;
  padding: 20px 16px;

  /* ElABubbleList 会自动处理滚动，这里不需要 overflow */
}

.input-area {
  flex-shrink: 0;
  padding: 16px 20px;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 4px;
}

.sender {
  :deep(.el-ai-sender__content) {
    max-height: 200px;
    overflow-y: auto;

    &::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }

    &::-webkit-scrollbar-thumb {
      background-color: rgb(144 147 153 / 30%);
      border-radius: 6px;

      &:hover {
        background-color: rgb(144 147 153 / 50%);
      }
    }

    &::-webkit-scrollbar-track {
      background-color: transparent;
    }
  }
}

/* 头像微调 */
.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin-top: 2px;
  color: #fff;
  border-radius: 50%;

  &.user {
    background: #409eff;
  }

  &.ai {
    background: #00b42a;
  }

  svg {
    width: 18px;
    height: 18px;
  }
}

/* 操作栏微调 */
.bubble-actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
  opacity: 0.6;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }

  .action-btn {
    font-size: 14px;
    cursor: pointer;

    &:hover {
      transform: scale(1.1);
    }
  }
}

:deep(.el-ai-bubble.el-ai-bubble-end .el-ai-bubble__content) {
  margin-top: 25px;
  margin-bottom: 25px;
}

.footer-wrapper {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

/* 引用区域容器 */
.sources-container {
  padding-top: 8px;
  margin-top: 8px;
  font-size: 12px;
  border-top: 1px dashed #e5e6eb;
}

.sources-title {
  margin: 0 0 6px;
  font-weight: 500;
  color: #86909c;
}

.sources-list {
  display: flex;
  flex-direction: column; /* 或者 row wrap 做横向卡片 */
  gap: 6px;
}

/* 单个引用卡片 */
.source-card {
  padding: 6px 10px;
  cursor: pointer;
  background: #f7f8fa;
  border: 1px solid #eee;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    background: #f2f3f5;
    border-color: #dcdfe6;
  }
}

.source-header {
  display: flex;
  gap: 4px;
  align-items: center;
  margin-bottom: 2px;
  font-weight: 500;
  color: #1d2129;

  .filename {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .score {
    padding: 1px 4px;
    font-size: 10px;
    color: #00b42a;
    background: rgb(0 180 42 / 10%);
    border-radius: 2px;
  }
}

.source-text {
  /* 限制行数 */
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 11px;
  line-height: 1.4;
  color: #4e5969;
  -webkit-box-orient: vertical;
}

/* 调整原有按钮位置 */
.bubble-actions {
  justify-content: flex-end; /* 让按钮靠右，或者 flex-start 靠左 */
  margin-top: 0;
}
</style>
