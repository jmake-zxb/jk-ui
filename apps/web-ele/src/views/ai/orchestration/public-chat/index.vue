<script setup lang="ts">
import type { ApplicationPayload } from '#/api/ai/types';

import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';
import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import {
  ElButton,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
  ElTag,
} from 'element-plus';

import {
  listApplications,
  openApplicationChat,
  pageApplicationChatRecords,
} from '#/api/ai/applications';
import {
  createPublicShare,
  getApplicationProfile,
  getPublicShare,
  openAiChatCompletion,
  openPublicChat,
  publicChat,
  publicChatStream,
  votePublicRecord,
} from '#/api/ai/public';
import { adaptationUrl } from '#/utils/other';

import { prettyJson, recordsOf, safeParseJson } from '../utils';

interface ChatMessage {
  content: string;
  id: number;
  pending?: boolean;
  role: 'assistant' | 'user';
}

interface ApplicationProfile {
  applicationId?: number | string;
  avatar?: string;
  chatBackground?: string;
  customTheme?: string;
  description?: string;
  disclaimer?: boolean;
  disclaimerValue?: string;
  draggable?: boolean;
  floatIcon?: string;
  floatLocation?: string;
  icon?: string;
  name?: string;
  showAvatar?: boolean;
  showGuide?: boolean;
  showHistory?: boolean;
  showUserAvatar?: boolean;
  userAvatar?: string;
}

interface CustomThemeConfig {
  header_font_color?: string;
  theme_color?: string;
}

type ApplicationRecord = ApplicationPayload & { id: number | string };

const route = useRoute();
const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
const accessStore = useAccessStore();

const applications = ref<ApplicationRecord[]>([]);
const applicationId = ref<number | string | undefined>(routeApplicationId());
const activeTab = ref('chat');
const token = ref('');
const apiKey = ref('');
const chatId = ref<number | string>();
const recordId = ref<number | string>();
const message = ref('你好');
const inputJson = ref('{}');
const chatResult = ref<any>();
const records = ref<any[]>([]);
const shareToken = ref('');
const shareResult = ref<any>();
const openAiBody = reactive({
  model: 'application',
  messages: '[{"role":"user","content":"你好"}]',
});
const openAiResult = ref<any>();
const chatMessages = ref<ChatMessage[]>([]);
const streaming = ref(false);
const chatBodyRef = ref<HTMLElement>();
const profile = ref<ApplicationProfile>({});
let messageId = 0;

const debugMode = computed(() => route.query.mode === 'debug');
const embedMode = computed(() => route.query.mode === 'embed');
const embedToken = computed(() => {
  const t = route.query.token;
  return (Array.isArray(t) ? t[0] : t) || '';
});
const selectedApplication = computed(() =>
  applications.value.find((item) => `${item.id}` === `${applicationId.value}`),
);

const customTheme = computed<CustomThemeConfig>(() => {
  const raw = profile.value.customTheme;
  if (!raw) return {};
  const parsed = safeParseJson(raw, null) as CustomThemeConfig | null;
  return parsed || {};
});

const headerStyle = computed(() => {
  const theme = customTheme.value;
  const style: Record<string, string> = {};
  if (theme.theme_color) style.background = theme.theme_color;
  if (theme.header_font_color) style.color = theme.header_font_color;
  return style;
});

const chatBackgroundStyle = computed(() => {
  const url = profile.value.chatBackground;
  if (!url) return {};
  return {
    backgroundImage: `url(${url})`,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
  };
});

const showAiAvatar = computed(() => profile.value.showAvatar !== false);
const showUserAvatar = computed(() => profile.value.showUserAvatar === true);
const aiAvatarUrl = computed(() => profile.value.avatar || '');
const userAvatarUrl = computed(() => profile.value.userAvatar || '');
const disclaimerVisible = computed(() => profile.value.disclaimer === true);
const disclaimerText = computed(() => profile.value.disclaimerValue || '');

function routeApplicationId(): number | string | undefined {
  const value = route.query.applicationId;
  const firstValue = Array.isArray(value) ? value[0] : value;
  return firstValue === null ? undefined : firstValue;
}

async function loadApplications() {
  applications.value = recordsOf<ApplicationRecord>(
    await listApplications(),
  ).filter((item) => item.id !== undefined && item.id !== null);
  const routeId = routeApplicationId();
  if (routeId) applicationId.value = routeId;
  const firstApplication = applications.value[0];
  if (!applicationId.value && firstApplication) {
    applicationId.value = firstApplication.id;
  }
  await loadApplicationProfile();
}

async function loadApplicationProfile() {
  if (!applicationId.value) {
    profile.value = {};
    return;
  }
  try {
    const data = (await getApplicationProfile(
      applicationId.value,
    )) as ApplicationProfile;
    profile.value = data || {};
  } catch {
    profile.value = {};
  }
}

async function openChat() {
  if (debugMode.value) {
    await openDebugChat();
    return;
  }
  const chat = await openPublicChat(applicationId.value!, {
    token: token.value,
    title: '前端公开会话',
  });
  chatId.value = chat.id;
  ElMessage.success('会话已打开');
}

async function openDebugChat() {
  if (!applicationId.value) {
    ElMessage.warning('请选择应用');
    return;
  }
  const chat = await openApplicationChat(applicationId.value, {
    source: 'APPLICATION_DEBUG',
    title: '调试会话',
  });
  chatId.value = chat.id;
  chatMessages.value = [];
  records.value = [];
  ElMessage.success('调试会话已打开');
}

async function sendChat() {
  chatResult.value = await publicChat(applicationId.value!, {
    token: token.value,
    id: chatId.value,
    message: message.value,
  });
  if (chatId.value)
    records.value = recordsOf(
      await pageApplicationChatRecords(applicationId.value!, chatId.value, {
        current: 1,
        page: 1,
        size: 20,
      }),
    );
}

async function sendDebugChat() {
  if (streaming.value) return;
  const content = message.value.trim();
  if (!applicationId.value) {
    ElMessage.warning('请选择应用');
    return;
  }
  if (!content) {
    ElMessage.warning('请输入消息');
    return;
  }
  if (!chatId.value) await openDebugChat();
  if (!chatId.value) return;
  const userMessage = addChatMessage('user', content);
  const assistantMessage = addChatMessage('assistant', '', true);
  message.value = '';
  streaming.value = true;
  await scrollChatBottom();
  try {
    const response = await fetch(
      `${apiURL}${adaptationUrl(`/ai/api/applications/${applicationId.value}/chat/message/stream`)}`,
      {
        body: JSON.stringify({
          chatId: chatId.value,
          inputJson: JSON.stringify(safeParseJson(inputJson.value, {})),
          message: userMessage.content,
        }),
        headers: {
          Authorization: accessStore.accessToken
            ? `Bearer ${accessStore.accessToken}`
            : '',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
    if (!response.ok) {
      throw new Error(
        (await response.text()) || `请求失败：${response.status}`,
      );
    }
    if (!response.body) throw new Error('聊天接口未返回流数据');
    await readChatStream(response.body, assistantMessage);
    await loadChatRecords();
  } catch (error) {
    assistantMessage.content = getErrorMessage(error);
    ElMessage.error(assistantMessage.content);
  } finally {
    assistantMessage.pending = false;
    streaming.value = false;
    await scrollChatBottom();
  }
}

async function openEmbedChat() {
  if (!applicationId.value || !embedToken.value) return;
  const chat = await openPublicChat(applicationId.value, {
    token: embedToken.value,
    title: '嵌入会话',
  });
  chatId.value = chat.id;
}

async function sendEmbedChat() {
  if (streaming.value) return;
  const content = message.value.trim();
  if (!applicationId.value || !embedToken.value) return;
  if (!content) return;
  if (!chatId.value) await openEmbedChat();
  if (!chatId.value) return;
  const userMessage = addChatMessage('user', content);
  const assistantMessage = addChatMessage('assistant', '', true);
  message.value = '';
  streaming.value = true;
  await scrollChatBottom();
  try {
    const response = await publicChatStream(
      applicationId.value,
      { chatId: chatId.value, message: userMessage.content },
      embedToken.value,
    );
    if (!response.ok) {
      throw new Error(
        (await response.text()) || `请求失败：${response.status}`,
      );
    }
    if (!response.body) throw new Error('聊天接口未返回流数据');
    await readChatStream(response.body, assistantMessage);
  } catch (error) {
    assistantMessage.content = getErrorMessage(error);
  } finally {
    assistantMessage.pending = false;
    streaming.value = false;
    await scrollChatBottom();
  }
}

function startNewEmbedChat() {
  chatId.value = undefined;
  chatMessages.value = [];
}

function addChatMessage(
  role: ChatMessage['role'],
  content: string,
  pending = false,
) {
  const item: ChatMessage = {
    content,
    id: ++messageId,
    pending,
    role,
  };
  chatMessages.value.push(item);
  return item;
}

async function readChatStream(
  stream: ReadableStream<Uint8Array>,
  target: ChatMessage,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) handleChatStreamLine(line, target);
    await scrollChatBottom();
  }
  if (buffer.trim()) handleChatStreamLine(buffer, target);
}

function handleChatStreamLine(line: string, target: ChatMessage) {
  const raw = line.trim();
  if (!raw) return;
  const payloadText = raw.startsWith('data:') ? raw.slice(5).trim() : raw;
  if (!payloadText || payloadText === '[DONE]') return;
  const data = safeParseJson(payloadText, undefined);
  if (!data) {
    target.content += payloadText;
    return;
  }
  if (data.event === 'error' || data.event === 'canceled') {
    target.content = data.message || '调试失败';
    target.pending = false;
    return;
  }
  if (data.content) {
    target.content += data.content;
    return;
  }
  if (data.event === 'done' && data.payload) {
    const answer = extractAnswer(data.payload);
    if (answer) target.content = answer;
  }
}

function extractAnswer(payload: unknown) {
  const value =
    typeof payload === 'string' ? safeParseJson(payload, payload) : payload;
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  const answer =
    record.content || record.answer || record.result || record.output;
  return typeof answer === 'string' ? answer : prettyJson(answer, '');
}

async function loadChatRecords() {
  if (!applicationId.value || !chatId.value) return;
  records.value = recordsOf(
    await pageApplicationChatRecords(applicationId.value, chatId.value, {
      current: 1,
      page: 1,
      size: 20,
    }),
  );
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return '调试失败';
}

async function scrollChatBottom() {
  await nextTick();
  const el = chatBodyRef.value;
  if (el) el.scrollTop = el.scrollHeight;
}

async function vote(type: string) {
  if (!recordId.value) {
    ElMessage.warning('请输入记录 ID');
    return;
  }
  await votePublicRecord(applicationId.value!, recordId.value, {
    token: token.value,
    type,
    content: '前端反馈',
  });
  ElMessage.success('投票成功');
}

async function createShare() {
  if (!chatId.value) {
    ElMessage.warning('请先打开会话');
    return;
  }
  shareResult.value = await createPublicShare(
    applicationId.value!,
    chatId.value,
    { token: token.value, enabled: true },
  );
  shareToken.value =
    shareResult.value?.shareToken || shareResult.value?.token || '';
}

async function loadShare() {
  shareResult.value = await getPublicShare(shareToken.value);
}

async function sendOpenAi() {
  const messages = JSON.parse(openAiBody.messages);
  openAiResult.value = await openAiChatCompletion(
    applicationId.value!,
    { model: openAiBody.model, messages },
    apiKey.value,
  );
}

watch(
  () => route.query.applicationId,
  () => {
    const routeId = routeApplicationId();
    if (!routeId || `${routeId}` === `${applicationId.value}`) return;
    applicationId.value = routeId;
    chatId.value = undefined;
    chatMessages.value = [];
    records.value = [];
  },
);

watch(applicationId, () => {
  chatId.value = undefined;
  chatMessages.value = [];
  records.value = [];
  void loadApplicationProfile();
});

onMounted(async () => {
  if (embedMode.value) {
    await loadApplicationProfile();
  } else {
    await loadApplications();
    await loadApplicationProfile();
  }
});
</script>

<template>
  <!-- Embed mode: compact fullscreen layout -->
  <div v-if="embedMode" class="embed-page">
    <div class="embed-header" :style="headerStyle">
      <div class="embed-header__left">
        <div v-if="aiAvatarUrl" class="embed-header__icon">
          <img :src="aiAvatarUrl" alt="app" />
        </div>
        <span class="embed-header__name">{{ profile.name || '对话' }}</span>
      </div>
      <ElButton
        text
        size="small"
        class="embed-header__action"
        @click="startNewEmbedChat"
      >
        新对话
      </ElButton>
    </div>
    <div ref="chatBodyRef" class="embed-body" :style="chatBackgroundStyle">
      <div v-if="chatMessages.length === 0" class="empty-chat">
        {{ profile.description || '有什么可以帮您？' }}
      </div>
      <div
        v-for="item in chatMessages"
        :key="item.id"
        class="message-row"
        :class="`is-${item.role}`"
      >
        <div
          v-if="item.role === 'assistant' && showAiAvatar"
          class="message-avatar"
        >
          <img v-if="aiAvatarUrl" :src="aiAvatarUrl" alt="ai" />
          <span v-else class="message-avatar-fallback">AI</span>
        </div>
        <div class="message-content">
          <div class="message-bubble">
            <span v-if="item.content">{{ item.content }}</span>
            <span v-else class="muted">生成中...</span>
          </div>
        </div>
        <div
          v-if="item.role === 'user' && showUserAvatar"
          class="message-avatar"
        >
          <img v-if="userAvatarUrl" :src="userAvatarUrl" alt="user" />
          <span v-else class="message-avatar-fallback">U</span>
        </div>
      </div>
    </div>
    <div v-if="disclaimerVisible" class="embed-disclaimer">
      {{ disclaimerText }}
    </div>
    <div class="embed-composer">
      <ElInput
        v-model="message"
        type="textarea"
        :rows="2"
        resize="none"
        placeholder="输入消息..."
        @keydown.enter.exact.prevent="sendEmbedChat"
      />
      <ElButton type="primary" :loading="streaming" @click="sendEmbedChat">
        发送
      </ElButton>
    </div>
  </div>

  <!-- Normal and Debug modes -->
  <Page v-else auto-content-height>
    <div class="public-page">
      <div class="toolbar" :class="{ 'debug-toolbar': debugMode }">
        <ElSelect v-model="applicationId" filterable placeholder="应用">
          <ElOption
            v-for="item in applications"
            :key="item.id"
            :label="item.name || item.id"
            :value="item.id"
          />
        </ElSelect>
        <template v-if="debugMode">
          <ElTag size="large" type="success">
            {{ selectedApplication?.name || applicationId || '调试对话' }}
          </ElTag>
          <ElButton @click="openDebugChat">新会话</ElButton>
        </template>
        <template v-else>
          <ElInput v-model="token" placeholder="访问令牌 aat_..." />
          <ElInput v-model="apiKey" placeholder="API Key ak_..." />
        </template>
      </div>
      <section v-if="debugMode" class="agent-chat">
        <aside class="panel debug-side">
          <div class="panel-title">调试目标</div>
          <div class="debug-meta">
            <span>应用</span>
            <strong>{{
              selectedApplication?.name || applicationId || '-'
            }}</strong>
          </div>
          <div class="debug-meta">
            <span>类型</span>
            <strong>{{ selectedApplication?.type || '-' }}</strong>
          </div>
          <div class="debug-meta">
            <span>会话</span>
            <strong>{{ chatId || '-' }}</strong>
          </div>
          <div class="panel-title mt16">输入变量</div>
          <ElInput
            v-model="inputJson"
            type="textarea"
            :rows="10"
            placeholder="{}"
          />
          <div class="panel-title mt16">最近记录</div>
          <ElTable :data="records" class="record-table" size="small">
            <ElTableColumn prop="id" label="ID" width="80" />
            <ElTableColumn prop="question" label="问题" />
          </ElTable>
        </aside>
        <main class="chat-main">
          <div class="chat-profile-header" :style="headerStyle">
            <span>{{
              profile.name || selectedApplication?.name || '聊天'
            }}</span>
          </div>
          <div ref="chatBodyRef" class="chat-body" :style="chatBackgroundStyle">
            <div v-if="chatMessages.length === 0" class="empty-chat">
              暂无消息
            </div>
            <div
              v-for="item in chatMessages"
              :key="item.id"
              class="message-row"
              :class="`is-${item.role}`"
            >
              <div
                v-if="item.role === 'assistant' && showAiAvatar"
                class="message-avatar"
              >
                <img v-if="aiAvatarUrl" :src="aiAvatarUrl" alt="ai" />
                <span v-else class="message-avatar-fallback">AI</span>
              </div>
              <div class="message-content">
                <div class="message-author">
                  {{ item.role === 'user' ? '用户' : 'AI' }}
                </div>
                <div class="message-bubble">
                  <span v-if="item.content">{{ item.content }}</span>
                  <span v-else class="muted">生成中...</span>
                </div>
              </div>
              <div
                v-if="item.role === 'user' && showUserAvatar"
                class="message-avatar"
              >
                <img v-if="userAvatarUrl" :src="userAvatarUrl" alt="user" />
                <span v-else class="message-avatar-fallback">U</span>
              </div>
            </div>
            <div v-if="disclaimerVisible" class="chat-disclaimer">
              {{ disclaimerText }}
            </div>
          </div>
          <div class="chat-composer">
            <ElInput
              v-model="message"
              type="textarea"
              :rows="3"
              resize="none"
              placeholder="输入消息"
            />
            <ElButton
              type="primary"
              :loading="streaming"
              @click="sendDebugChat"
            >
              发送
            </ElButton>
          </div>
        </main>
      </section>
      <ElTabs v-else v-model="activeTab" class="fill-tabs">
        <ElTabPane label="公开聊天" name="chat">
          <div class="two-col">
            <section class="panel">
              <div class="panel-title">会话与消息</div>
              <ElButton type="primary" @click="openChat">打开会话</ElButton>
              <ElInput v-model="chatId" class="mt8" placeholder="Chat ID" />
              <ElInput
                v-model="message"
                class="mt8"
                type="textarea"
                :rows="7"
              />
              <ElButton class="mt8" type="primary" @click="sendChat">
                发送
              </ElButton>
              <pre class="result-box">{{
                prettyJson(chatResult, '暂无响应')
              }}</pre>
            </section>
            <section class="panel">
              <div class="panel-title">聊天记录</div>
              <ElTable :data="records" height="100%" size="small">
                <ElTableColumn prop="id" label="ID" width="100" />
                <ElTableColumn prop="messageType" label="类型" width="100" />
                <ElTableColumn prop="messageContent" label="内容" />
              </ElTable>
            </section>
          </div>
        </ElTabPane>
        <ElTabPane label="投票/分享" name="share">
          <div class="two-col">
            <section class="panel">
              <div class="panel-title">记录投票</div>
              <ElInput v-model="recordId" placeholder="Record ID" />
              <div class="mt8">
                <ElButton @click="vote('LIKE')">赞同</ElButton>
                <ElButton @click="vote('DISLIKE')">反对</ElButton>
              </div>
              <div class="panel-title mt16">分享</div>
              <ElInput v-model="shareToken" placeholder="分享 Token" />
              <div class="mt8">
                <ElButton type="primary" @click="createShare">
                  创建分享
                </ElButton>
                <ElButton @click="loadShare">查询分享</ElButton>
              </div>
            </section>
            <section class="panel">
              <pre class="result-box tall">{{
                prettyJson(shareResult, '暂无分享数据')
              }}</pre>
            </section>
          </div>
        </ElTabPane>
        <ElTabPane label="OpenAI 兼容" name="openai">
          <div class="two-col">
            <section class="panel">
              <div class="panel-title">Chat Completions</div>
              <ElInput v-model="openAiBody.model" placeholder="model" />
              <ElInput
                v-model="openAiBody.messages"
                class="mt8"
                type="textarea"
                :rows="8"
              />
              <ElButton class="mt8" type="primary" @click="sendOpenAi">
                发送兼容请求
              </ElButton>
            </section>
            <section class="panel">
              <pre class="result-box tall">{{
                prettyJson(openAiResult, '暂无 OpenAI 响应')
              }}</pre>
            </section>
          </div>
        </ElTabPane>
      </ElTabs>
    </div>
  </Page>
</template>

<style scoped lang="scss">
@media (max-width: 900px) {
  .toolbar,
  .debug-toolbar,
  .agent-chat,
  .two-col {
    grid-template-columns: 1fr;
  }

  .message-row {
    max-width: 100%;
  }

  .chat-composer {
    grid-template-columns: 1fr;
  }
}

.public-page {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  overflow: hidden;
}

.toolbar {
  display: grid;
  grid-template-columns: 260px 1fr 1fr;
  gap: 8px;
  align-items: center;
}

.debug-toolbar {
  grid-template-columns: 260px 1fr auto;
}

.fill-tabs,
.fill-tabs :deep(.el-tabs__content),
.fill-tabs :deep(.el-tab-pane) {
  height: 100%;
}

.two-col {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 12px;
  height: 100%;
}

.panel {
  padding: 12px;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.agent-chat {
  display: grid;
  flex: 1;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
}

.debug-side {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.debug-meta {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  font-size: 13px;
}

.debug-meta span {
  color: var(--el-text-color-secondary);
}

.debug-meta strong {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  white-space: nowrap;
}

.record-table {
  flex: 1;
  min-height: 0;
}

.chat-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.chat-header {
  display: flex;
  flex: 0 0 auto;
  gap: 10px;
  align-items: center;
  height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.chat-header__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  overflow: hidden;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.chat-header__icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chat-header__name {
  font-size: 14px;
  font-weight: 600;
}

.chat-avatar {
  display: inline-flex;
  flex: 0 0 28px;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  overflow: hidden;
  background: var(--el-fill-color-light);
  border-radius: 50%;
}

.chat-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chat-avatar--placeholder {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.chat-disclaimer {
  flex: 0 0 auto;
  padding: 8px 16px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
  border-top: 1px solid var(--el-border-color-lighter);
}

.chat-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  padding: 16px;
  overflow: auto;
  background: var(--el-fill-color-lighter);
}

.empty-chat {
  display: grid;
  flex: 1;
  place-items: center;
  color: var(--el-text-color-secondary);
}

.message-row {
  display: flex;
  flex-direction: row;
  gap: 8px;
  align-items: flex-start;
  max-width: 78%;
}

.message-row.is-user {
  flex-direction: row-reverse;
  align-self: flex-end;
}

.message-row.is-assistant {
  align-self: flex-start;
}

.message-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message-row.is-user .message-content {
  align-items: flex-end;
}

.message-avatar {
  display: inline-flex;
  flex: 0 0 32px;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  overflow: hidden;
  background: var(--el-fill-color-light);
  border-radius: 50%;
}

.message-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.message-author {
  padding: 0 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.message-bubble {
  padding: 10px 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.message-row.is-user .message-bubble {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-7);
}

.muted {
  color: var(--el-text-color-secondary);
}

.chat-composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px;
  gap: 10px;
  align-items: end;
  padding: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.panel-title {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
}

.mt8 {
  margin-top: 8px;
}

.mt16 {
  margin-top: 16px;
}

.result-box {
  max-height: 260px;
  padding: 8px;
  overflow: auto;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.tall {
  height: calc(100% - 16px);
  max-height: none;
}

/* Embed mode styles */
.embed-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: hsl(var(--card));
}

.embed-header {
  display: flex;
  flex: 0 0 auto;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 16px;
  color: #fff;
  background: var(--el-color-primary);
}

.embed-header__left {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.embed-header__icon {
  display: inline-flex;
  flex: 0 0 28px;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  overflow: hidden;
  background: rgb(255 255 255 / 20%);
  border-radius: 6px;
}

.embed-header__icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.embed-header__name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.embed-header__action {
  flex: 0 0 auto;
  color: inherit !important;
}

.embed-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  padding: 16px;
  overflow: auto;
  background: var(--el-fill-color-lighter);
}

.embed-disclaimer {
  flex: 0 0 auto;
  padding: 6px 16px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
  border-top: 1px solid var(--el-border-color-lighter);
}

.embed-composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 72px;
  gap: 8px;
  align-items: end;
  padding: 10px 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
