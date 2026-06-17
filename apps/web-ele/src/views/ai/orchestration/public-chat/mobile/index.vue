<script setup lang="ts">
import type { PublicChatTemplateProps } from '../types';

import { computed, onMounted, ref } from 'vue';

import { ChatRound, Menu, Plus } from '@element-plus/icons-vue';
import { ElButton, ElDrawer, ElIcon, ElScrollbar } from 'element-plus';

import { pagePublicTokenChats } from '#/api/ai/public';
import AiChat from '#/components/ai-chat/index.vue';

import {
  getPublicChatBackgroundStyle,
  getPublicChatHeaderStyle,
  getPublicChatThemeStyle,
} from '../utils';

const props = defineProps<PublicChatTemplateProps>();

const drawerVisible = ref(false);
const chatKey = ref(0);
const selectedChatId = ref('');
const chatHistoryList = ref<any[]>([]);
const historyLoading = ref(false);

const applicationDetail = computed(() => props.application_profile);
const shellStyle = computed(() =>
  applicationDetail.value
    ? getPublicChatThemeStyle(applicationDetail.value)
    : {},
);
const headerStyle = computed(() =>
  applicationDetail.value
    ? getPublicChatHeaderStyle(applicationDetail.value)
    : {},
);
const backgroundStyle = computed(() =>
  applicationDetail.value
    ? getPublicChatBackgroundStyle(applicationDetail.value)
    : {},
);
const showHistory = computed(
  () => applicationDetail.value?.show_history !== false,
);

function isValidUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const _url = new URL(url);
    return Boolean(_url);
  } catch {
    return url.startsWith('/') || url.startsWith('data:');
  }
}

function selectChat(chatId: string) {
  selectedChatId.value = chatId;
  chatKey.value += 1;
}

function startNewChat() {
  selectedChatId.value = '';
  chatKey.value += 1;
  drawerVisible.value = false;
}

async function loadChatHistory() {
  if (!props.publicToken) return;
  historyLoading.value = true;
  try {
    const res = await pagePublicTokenChats(props.publicToken, {
      current: 1,
      size: 50,
    });
    const data = res?.data ?? res;
    let records: unknown[] = [];
    if (Array.isArray(data?.records)) {
      records = data.records;
    } else if (Array.isArray(data)) {
      records = data;
    }
    chatHistoryList.value = records;
  } catch {
    chatHistoryList.value = [];
  } finally {
    historyLoading.value = false;
  }
}

function formatChatTime(time?: string) {
  if (!time) return '';
  const date = new Date(time);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

onMounted(() => {
  void loadChatHistory();
});
</script>

<template>
  <div
    v-if="applicationDetail"
    class="public-chat-mobile"
    :style="[shellStyle, backgroundStyle]"
  >
    <header class="public-chat-mobile__header" :style="headerStyle">
      <ElButton
        v-if="showHistory"
        class="public-chat-mobile__icon-button"
        text
        @click="drawerVisible = true"
      >
        <ElIcon><Menu /></ElIcon>
      </ElButton>
      <div class="public-chat-mobile__brand">
        <div class="public-chat-mobile__avatar">
          <img
            v-if="applicationDetail.icon && isValidUrl(applicationDetail.icon)"
            :src="applicationDetail.icon"
            alt=""
          />
          <ElIcon v-else :size="20"><ChatRound /></ElIcon>
        </div>
        <span :title="applicationDetail.name">{{
          applicationDetail.name
        }}</span>
      </div>
      <ElButton
        class="public-chat-mobile__icon-button"
        text
        @click="startNewChat"
      >
        <ElIcon><Plus /></ElIcon>
      </ElButton>
    </header>

    <main class="public-chat-mobile__main">
      <AiChat
        :key="chatKey"
        :app-id="applicationDetail.id"
        :application-details="applicationDetail"
        :available="applicationAvailable"
        :chat-id="selectedChatId || 'new'"
        :public-input-json="publicInputJson"
        :public-token="publicToken"
        :record="[]"
        type="ai-chat"
      />
    </main>

    <ElDrawer
      v-model="drawerVisible"
      direction="ltr"
      size="82%"
      :with-header="false"
      class="public-chat-mobile__drawer"
    >
      <div class="public-chat-drawer">
        <div class="public-chat-drawer__brand">
          <div class="public-chat-drawer__icon">
            <img
              v-if="
                applicationDetail.icon && isValidUrl(applicationDetail.icon)
              "
              :src="applicationDetail.icon"
              alt=""
            />
            <ElIcon v-else :size="20"><ChatRound /></ElIcon>
          </div>
          <span>{{ applicationDetail.name }}</span>
        </div>
        <ElButton type="primary" plain @click="startNewChat">新对话</ElButton>
        <div v-if="showHistory" class="public-chat-drawer__history">
          <div class="public-chat-drawer__title">历史记录</div>
          <ElScrollbar class="public-chat-drawer__list">
            <div v-if="historyLoading" class="public-chat-drawer__loading">
              加载中...
            </div>
            <div
              v-else-if="chatHistoryList.length === 0"
              class="public-chat-drawer__empty"
            >
              暂无历史记录
            </div>
            <template v-else>
              <div
                v-for="chat in chatHistoryList"
                :key="chat.id"
                class="public-chat-drawer__item"
                :class="{ 'is-active': selectedChatId === String(chat.id) }"
                @click="
                  selectChat(String(chat.id));
                  drawerVisible = false;
                "
              >
                <div class="public-chat-drawer__item-title">
                  {{ chat.abstract || chat.title || '新对话' }}
                </div>
                <div class="public-chat-drawer__item-time">
                  {{ formatChatTime(chat.updateTime || chat.createTime) }}
                </div>
              </div>
            </template>
          </ElScrollbar>
        </div>
        <div v-else class="public-chat-drawer__disabled">
          此应用未开启历史记录
        </div>
      </div>
    </ElDrawer>
  </div>
</template>

<style scoped lang="scss">
.public-chat-mobile {
  --public-chat-header-height: 56px;

  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background-color: var(--el-bg-color-page);
}

.public-chat-mobile__header {
  display: grid;
  flex: 0 0 var(--public-chat-header-height);
  grid-template-columns: 48px minmax(0, 1fr) 48px;
  align-items: center;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.public-chat-mobile__brand {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  min-width: 0;
  font-weight: 600;
}

.public-chat-mobile__brand span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.public-chat-mobile__avatar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  overflow: hidden;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

.public-chat-mobile__avatar img,
.public-chat-drawer__icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.public-chat-drawer__icon {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  overflow: hidden;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

.public-chat-mobile__icon-button {
  color: inherit;
}

.public-chat-mobile__main {
  flex: 1;
  min-height: 0;
}

.public-chat-drawer {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.public-chat-drawer__brand {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
  font-weight: 600;
}

.public-chat-drawer__brand span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.public-chat-drawer__title,
.public-chat-drawer__disabled {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.public-chat-drawer__title {
  margin-bottom: 8px;
}

.public-chat-drawer__history {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.public-chat-drawer__list {
  flex: 1;
  min-height: 0;
}

.public-chat-drawer__loading,
.public-chat-drawer__empty {
  padding: 16px 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.public-chat-drawer__item {
  padding: 10px 12px;
  margin-bottom: 4px;
  cursor: pointer;
  border-radius: 6px;
  transition: background-color var(--el-transition-duration);
}

.public-chat-drawer__item:hover {
  background: var(--el-fill-color-light);
}

.public-chat-drawer__item.is-active {
  background: var(--el-color-primary-light-9);
}

.public-chat-drawer__item-title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  white-space: nowrap;
}

.public-chat-drawer__item-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
