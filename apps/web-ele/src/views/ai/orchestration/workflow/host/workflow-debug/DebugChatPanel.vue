<script setup lang="ts">
/**
 * 工作流调试 — 浮动对话面板（决策 2A）。
 *
 * 画布右下角浮层，可放大/缩小/关闭。仅服务高级智能体（WORK_FLOW）工作流调试，
 * 走 workflow/debug/stream（跑草稿、无会话）。不要与应用对话调试混淆。
 */
import { computed, nextTick, ref, watch } from 'vue';

import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import {
  Close,
  FullScreen,
  Promotion,
  ScaleToOriginal,
  VideoPause,
} from '@element-plus/icons-vue';
import { ElButton, ElIcon, ElInput } from 'element-plus';

import DebugMessage from './DebugMessage.vue';
import { useDebugChat } from './useDebugChat';

const props = defineProps<{
  appIcon?: string;
  applicationId: number | string;
  appName?: string;
  /** 发送前本地校验，返回 false 则中止。 */
  runLocalValidation?: (showMessage?: boolean) => boolean;
}>();

const visible = defineModel<boolean>('visible', { default: false });

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
const accessStore = useAccessStore();

const enlarge = ref(false);
const messageText = ref('');
const inputJson = ref('{\n  "message": "测试工作流"\n}');
const showInputJson = ref(false);
const listRef = ref<HTMLElement>();

const { messages, reset, sending, sendMessage, stop } = useDebugChat({
  apiURL,
  getAccessToken: () => accessStore.accessToken,
  getApplicationId: () => props.applicationId,
  runLocalValidation: props.runLocalValidation,
});

const appInitial = computed(
  () => `${props.appName || 'AI'}`.trim().slice(0, 1) || 'AI',
);

const hasIcon = computed(() => {
  const icon = `${props.appIcon || ''}`.trim();
  return icon.length > 0 && (icon.startsWith('http') || icon.startsWith('/'));
});

function scrollToBottom() {
  void nextTick(() => {
    const el = listRef.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

async function onSend() {
  const text = messageText.value;
  if (!text.trim() || sending.value) return;
  messageText.value = '';
  await sendMessage(text, inputJson.value);
  scrollToBottom();
}

function onClear() {
  reset();
}

function onClose() {
  visible.value = false;
}

watch(
  () => messages.value.length,
  () => scrollToBottom(),
);

watch(
  () => messages.value.at(-1)?.write_ed,
  () => scrollToBottom(),
);
</script>

<template>
  <div v-if="visible" class="debug-panel" :class="{ 'is-enlarge': enlarge }">
    <div class="dp-header">
      <div class="dp-title">
        <div class="dp-avatar">
          <img v-if="hasIcon" :src="appIcon" alt="" />
          <span v-else>{{ appInitial }}</span>
        </div>
        <span class="dp-name" :title="appName">{{
          appName || '工作流调试'
        }}</span>
      </div>
      <div class="dp-actions">
        <ElButton link @click="enlarge = !enlarge">
          <ElIcon :size="18">
            <ScaleToOriginal v-if="enlarge" />
            <FullScreen v-else />
          </ElIcon>
        </ElButton>
        <ElButton link @click="onClose">
          <ElIcon :size="18"><Close /></ElIcon>
        </ElButton>
      </div>
    </div>

    <div ref="listRef" class="dp-list">
      <div v-if="messages.length === 0" class="dp-placeholder">
        输入消息开始调试当前工作流草稿
      </div>
      <DebugMessage
        v-for="message in messages"
        :key="message.id"
        :message="message"
      />
    </div>

    <div class="dp-footer">
      <div class="dp-footer-bar">
        <ElButton link size="small" @click="showInputJson = !showInputJson">
          {{ showInputJson ? '隐藏输入参数' : '输入参数' }}
        </ElButton>
        <ElButton v-if="messages.length > 0" link size="small" @click="onClear">
          清空
        </ElButton>
      </div>
      <ElInput
        v-if="showInputJson"
        v-model="inputJson"
        type="textarea"
        :rows="4"
        class="dp-input-json"
        placeholder="inputJson"
      />
      <div class="dp-input-row">
        <ElInput
          v-model="messageText"
          type="textarea"
          :rows="2"
          resize="none"
          placeholder="输入消息，Enter 发送"
          @keydown.enter.exact.prevent="onSend"
        />
        <ElButton v-if="sending" type="danger" :icon="VideoPause" @click="stop">
          停止
        </ElButton>
        <ElButton
          v-else
          type="primary"
          :icon="Promotion"
          :disabled="!messageText.trim()"
          @click="onSend"
        >
          发送
        </ElButton>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.debug-panel {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 30;
  display: flex;
  flex-direction: column;
  width: 460px;
  height: 680px;
  max-height: calc(100% - 32px);
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  box-shadow: var(--el-box-shadow-light);
}

.debug-panel.is-enlarge {
  width: calc(100% - 32px);
  height: calc(100% - 32px);
}

.dp-header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.dp-title {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.dp-avatar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: var(--el-color-primary);
  border-radius: 6px;
}

.dp-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dp-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.dp-actions {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
  align-items: center;
}

.dp-list {
  flex: 1;
  min-height: 0;
  padding: 12px;
  overflow-y: auto;
}

.dp-placeholder {
  padding: 24px 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.dp-footer {
  flex-shrink: 0;
  padding: 8px 12px 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.dp-footer-bar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 4px;
}

.dp-input-json {
  margin-bottom: 8px;
}

.dp-input-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}
</style>
