<script setup lang="ts">
import type {
  PromptGenerateMessage,
  PromptGenerateRequest,
} from '#/api/ai/models';

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import {
  Loading,
  MagicStick,
  Promotion,
  VideoPause,
} from '@element-plus/icons-vue';
import {
  ElAlert,
  ElButton,
  ElDialog,
  ElIcon,
  ElInput,
  ElMessage,
  ElScrollbar,
} from 'element-plus';

import { generatePromptStream } from '#/api/ai/models';

type CloseDone = () => void;

interface StreamPayload extends Record<string, unknown> {
  content?: string;
  error?: string;
  is_end?: boolean;
}

const props = withDefaults(
  defineProps<{
    applicationId?: number | string;
    modelId?: number | string;
    modelValue: boolean;
  }>(),
  {
    applicationId: '',
    modelId: '',
  },
);

const emit = defineEmits<{
  replace: [prompt: string];
  'update:modelValue': [value: boolean];
}>();

const initTemplate = `请根据用户描述生成一个完整的 AI 角色人设模板：

用户需求：{userInput}

重要说明：
1. 角色设定必须服务于用户需求所描述的核心功能；
2. 仅输出最终的角色设定内容，严禁输出解释、前言或额外说明；
3. 严格使用 Markdown 结构，包含「角色」「目标」「核心技能」「工作流」「限制」等小节。

请按以下格式生成：

# 角色
角色概述和主要职责的一句话描述

## 目标
角色的工作目标，建议聚焦 1-2 个目标

## 核心技能
### 技能 1：[技能名称]
1. [执行步骤 1]
2. [执行步骤 2]
3. [执行步骤 3]

## 工作流
1. 第一步
2. 第二步
3. 第三步

## 限制
1. 严格限制回答范围，仅回答与角色设定相关的问题。
2. 其它需要遵循的限制条件。`;

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const userInstruction = ref('');
const originalUserInput = ref('');
const generatedPrompt = ref('');
const streamError = ref('');
const streaming = ref(false);
const abortController = ref<AbortController>();
const chatMessages = ref<PromptGenerateMessage[]>([]);
const resultScrollRef = ref<InstanceType<typeof ElScrollbar>>();
const resultContentRef = ref<HTMLElement>();

const canSubmit = computed(
  () => !!props.modelId && !!userInstruction.value.trim() && !streaming.value,
);
const canUseResult = computed(
  () => generatedPrompt.value.trim().length > 0 && !streaming.value,
);
const generatedPromptDisplay = computed(
  () => generatedPrompt.value || '生成的角色设定会实时显示在这里。',
);
const generatedPromptClass = computed(() => ({
  'generate-prompt-dialog__content': true,
  'is-empty': !generatedPrompt.value,
}));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeModelId(value: number | string | undefined) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

function scrollResultToBottom() {
  nextTick(() => {
    resultScrollRef.value?.setScrollTop(
      resultContentRef.value?.scrollHeight || 0,
    );
  });
}

function resetDialogState() {
  generatedPrompt.value = '';
  streamError.value = '';
  userInstruction.value = '';
  originalUserInput.value = '';
  chatMessages.value = [];
}

function parseStreamPayload(rawData: string): StreamPayload | undefined {
  if (!rawData) return undefined;
  if (rawData === '[DONE]') return { is_end: true };
  try {
    const parsed = JSON.parse(rawData) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    generatedPrompt.value += rawData;
    scrollResultToBottom();
    return undefined;
  }
}

function handleSseEvent(eventChunk: string) {
  const rawData = eventChunk
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('\n')
    .trim();
  const payload = parseStreamPayload(rawData);
  if (!payload) return false;

  if (payload.error) throw new Error(payload.error);
  if (payload.content) {
    generatedPrompt.value += payload.content;
    scrollResultToBottom();
  }
  return payload.is_end === true;
}

async function readGenerateStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let streamEnded = false;

  try {
    while (!streamEnded) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        if (buffer.trim()) handleSseEvent(buffer);
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const eventChunks = buffer.split(/\r?\n\r?\n/);
      buffer = eventChunks.pop() || '';

      for (const eventChunk of eventChunks) {
        if (!eventChunk.trim()) continue;
        streamEnded = handleSseEvent(eventChunk);
        if (streamEnded) break;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function isAbortError(error: unknown) {
  return isRecord(error) && error.name === 'AbortError';
}

async function runGenerate(userContent: string) {
  if (!props.modelId) {
    ElMessage.warning('请先选择 AI 模型');
    return;
  }

  abortController.value?.abort();
  abortController.value = new AbortController();
  generatedPrompt.value = '';
  streamError.value = '';
  streaming.value = true;

  chatMessages.value.push({ content: userContent, role: 'user' });
  const normalizedModelId = normalizeModelId(props.modelId);
  const payload: PromptGenerateRequest = {
    applicationId: props.applicationId
      ? String(props.applicationId)
      : undefined,
    application_id: props.applicationId
      ? String(props.applicationId)
      : undefined,
    messages: [...chatMessages.value],
    modelId: normalizedModelId,
    model_id: normalizedModelId,
    prompt: initTemplate,
  };

  try {
    const stream = await generatePromptStream(
      normalizedModelId ?? '',
      payload,
      abortController.value.signal,
    );
    await readGenerateStream(stream);
    if (generatedPrompt.value.trim()) {
      chatMessages.value.push({
        content: generatedPrompt.value,
        role: 'assistant',
      });
      ElMessage.success('生成完成');
    }
  } catch (error) {
    if (isAbortError(error)) {
      ElMessage.info('已停止生成');
      return;
    }
    const message = error instanceof Error ? error.message : '提示词生成失败';
    streamError.value = message;
    ElMessage.error(message);
  } finally {
    streaming.value = false;
    abortController.value = undefined;
  }
}

function submitGenerate() {
  const value = userInstruction.value.trim();
  if (!value) {
    ElMessage.warning('请输入角色设定需求');
    return;
  }
  if (!originalUserInput.value) originalUserInput.value = value;
  runGenerate(value);
  userInstruction.value = '';
}

function reGenerate() {
  if (!originalUserInput.value) return;
  runGenerate(
    `上一次回答不满意。请针对原始需求“${originalUserInput.value}”并结合对话记录，严格按照格式规范重新生成。`,
  );
}

function stopGenerate() {
  if (!streaming.value) return;
  abortController.value?.abort();
}

function closeDialog() {
  stopGenerate();
  dialogVisible.value = false;
}

function handleBeforeClose(done: CloseDone) {
  stopGenerate();
  done();
}

function emitReplace() {
  if (!canUseResult.value) return;
  emit('replace', generatedPrompt.value.trim());
  dialogVisible.value = false;
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) resetDialogState();
    else stopGenerate();
  },
);

onBeforeUnmount(stopGenerate);
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    align-center
    append-to-body
    destroy-on-close
    title="AI 生成提示词"
    width="640px"
    :before-close="handleBeforeClose"
  >
    <div class="generate-prompt-dialog">
      <section class="generate-prompt-dialog__result-panel">
        <div class="generate-prompt-dialog__panel-title">
          <span>生成结果</span>
          <span v-if="streaming" class="generate-prompt-dialog__loading">
            <ElIcon class="is-loading"><Loading /></ElIcon>
            生成中...
          </span>
        </div>
        <ElScrollbar
          ref="resultScrollRef"
          class="generate-prompt-dialog__result-scroll"
        >
          <pre
            ref="resultContentRef"
            :class="generatedPromptClass"
            v-text="generatedPromptDisplay"
          ></pre>
        </ElScrollbar>
        <ElAlert
          v-if="streamError"
          class="generate-prompt-dialog__error"
          type="error"
          :closable="false"
          :title="streamError"
        />
      </section>

      <section class="generate-prompt-dialog__operate">
        <ElInput
          v-model="userInstruction"
          maxlength="100000"
          placeholder="描述你想要的 AI 角色，例如：一个擅长解答法律问题的智能助手"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 8 }"
          @keydown.enter.exact.prevent="submitGenerate"
        />
      </section>
    </div>

    <template #footer>
      <ElButton @click="closeDialog">取消</ElButton>
      <ElButton
        v-if="streaming"
        plain
        type="danger"
        :icon="VideoPause"
        @click="stopGenerate"
      >
        停止生成
      </ElButton>
      <ElButton :disabled="!originalUserInput || streaming" @click="reGenerate">
        重新生成
      </ElButton>
      <ElButton
        type="primary"
        :disabled="!canSubmit"
        :icon="MagicStick"
        :loading="streaming"
        @click="submitGenerate"
      >
        生成
      </ElButton>
      <ElButton
        type="success"
        :disabled="!canUseResult"
        :icon="Promotion"
        @click="emitReplace"
      >
        应用到角色设定
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped lang="scss">
.generate-prompt-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.generate-prompt-dialog__panel-title {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.generate-prompt-dialog__loading {
  display: flex;
  gap: 4px;
  align-items: center;
  font-size: calc(var(--font-size-base) * 0.8125);
  font-weight: 400;
  color: var(--el-color-primary);
}

.generate-prompt-dialog__result-scroll {
  height: min(44vh, 400px);
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius);
}

.generate-prompt-dialog__content {
  min-height: 100%;
  padding: 12px;
  margin: 0;
  font-family: inherit;
  font-size: calc(var(--font-size-base) * 0.875);
  line-height: 1.65;
  color: var(--el-text-color-primary);
  white-space: pre-wrap;
}

.generate-prompt-dialog__content.is-empty {
  color: var(--el-text-color-placeholder);
}

.generate-prompt-dialog__error {
  margin-top: 8px;
}
</style>
