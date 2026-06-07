<script setup lang="ts">
import type { ToolFieldSchema, ToolGenerateCodeRequest } from '#/api/ai/tools';

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { MagicStick, VideoPause } from '@element-plus/icons-vue';
import {
  ElAlert,
  ElButton,
  ElDialog,
  ElInput,
  ElMessage,
  ElScrollbar,
  ElTag,
} from 'element-plus';

import { generateToolCodeStream } from '#/api/ai/tools';

import LocalModelSelect from '../../workflow/designer/nodes/base-node/component/LocalModelSelect.vue';

type CloseDone = () => void;

interface StreamPayload extends Record<string, unknown> {
  content?: string;
  error?: string;
  is_end?: boolean;
}

const props = withDefaults(
  defineProps<{
    currentCode?: string;
    initFieldList?: ToolFieldSchema[];
    inputFieldList?: ToolFieldSchema[];
    modelValue: boolean;
    toolDescription?: string;
    toolName?: string;
  }>(),
  {
    currentCode: '',
    initFieldList: () => [],
    inputFieldList: () => [],
    toolDescription: '',
    toolName: '',
  },
);

const emit = defineEmits<{
  insert: [code: string];
  replace: [code: string];
  'update:modelValue': [value: boolean];
}>();

const defaultPromptTemplate = `你是资深的 Python 工程师，专注于为 MaxKB 平台的工具 / 数据源场景生成可直接运行的 Python 代码。严格遵守以下规则：

- 仅输出纯 Python 代码，不输出 Markdown 围栏或额外解释；
- 代码兼容 Python 3.8 及以上版本，符合 PEP8 编码规范，关键逻辑添加简洁中文注释；
- 仅使用 MaxKB 内置依赖（如 requests、pymysql、pandas、json 等），不引入未声明的第三方库；
- 函数参数必须覆盖已声明的启动参数和输入参数，返回值使用 dict 格式。

{userInput}

请为 MaxKB 工具生成 Python 代码，需求如下：

- 启动参数：平台配置的启动参数，如 API 密钥、数据库地址、账号密码等，已声明参数：{initFieldList}
- 输入参数：平台运行时传入的输入参数，已声明参数：{inputFieldList}
- 输出要求：仅输出完整函数定义和必要的辅助函数。`;

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});
const modelId = ref<number | string>();
const userInstruction = ref('');
const promptTemplate = ref(defaultPromptTemplate);
const generatedCode = ref('');
const streamError = ref('');
const streaming = ref(false);
const abortController = ref<AbortController>();
const resultScrollRef = ref<InstanceType<typeof ElScrollbar>>();
const resultContentRef = ref<HTMLElement>();

const initFieldCount = computed(() => props.initFieldList.length);
const inputFieldCount = computed(() => props.inputFieldList.length);
const hasExistingCode = computed(() => props.currentCode.trim().length > 0);
const usableGeneratedCode = computed(() =>
  cleanGeneratedCode(generatedCode.value),
);
const generatedCodeClass = computed(() => ({
  'generate-code-dialog__code': true,
  'is-empty': !generatedCode.value,
}));
const generatedCodeDisplay = computed(
  () => generatedCode.value || '生成的代码会实时显示在这里。',
);
const canUseResult = computed(() => usableGeneratedCode.value.length > 0);
const canSubmit = computed(
  () => !!modelId.value && !!userInstruction.value.trim() && !streaming.value,
);
const generatedLineCount = computed(() => {
  if (!usableGeneratedCode.value) return 0;
  return usableGeneratedCode.value.split(/\r?\n/).length;
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeModelId(value: number | string | undefined) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

function buildUserInputContext() {
  const parts = [
    `用户需求：\n${userInstruction.value.trim()}`,
    `工具名称：${props.toolName || '未命名工具'}`,
    `工具描述：${props.toolDescription || '暂无描述'}`,
  ];
  if (hasExistingCode.value) {
    parts.push(
      `当前代码（可参考、重构或按需求替换）：\n\`\`\`python\n${props.currentCode.trim()}\n\`\`\``,
    );
  }
  return parts.join('\n\n');
}

function resetDialogState() {
  generatedCode.value = '';
  streamError.value = '';
  userInstruction.value = hasExistingCode.value
    ? '请结合当前代码、工具描述和参数结构，生成一版可直接替换的完整 Python 工具函数。'
    : '请根据工具描述和参数结构，生成可直接运行的完整 Python 工具函数。';
  if (!promptTemplate.value.trim())
    promptTemplate.value = defaultPromptTemplate;
}

function resetPromptTemplate() {
  promptTemplate.value = defaultPromptTemplate;
}

function scrollResultToBottom() {
  nextTick(() => {
    resultScrollRef.value?.setScrollTop(
      resultContentRef.value?.scrollHeight || 0,
    );
  });
}

function cleanGeneratedCode(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return '';
  const openingFence = /^```(?:python|py)?\s*/i.exec(trimmed);
  if (openingFence) {
    const fencedContent = trimmed.slice(openingFence[0].length);
    const closingFenceIndex = fencedContent.indexOf('```');
    if (closingFenceIndex !== -1) {
      return fencedContent.slice(0, closingFenceIndex).trim();
    }
  }
  return trimmed;
}

function parseStreamPayload(rawData: string): StreamPayload | undefined {
  if (!rawData) return undefined;
  if (rawData === '[DONE]') return { is_end: true };
  try {
    const parsed = JSON.parse(rawData) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    generatedCode.value += rawData;
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
    generatedCode.value += payload.content;
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

async function submitGenerate() {
  if (!modelId.value) {
    ElMessage.warning('请选择 LLM 模型');
    return;
  }
  if (!userInstruction.value.trim()) {
    ElMessage.warning('请输入代码生成需求');
    return;
  }

  abortController.value?.abort();
  abortController.value = new AbortController();
  generatedCode.value = '';
  streamError.value = '';
  streaming.value = true;

  const normalizedModelId = normalizeModelId(modelId.value);
  const payload: ToolGenerateCodeRequest = {
    initFieldList: props.initFieldList,
    init_field_list: props.initFieldList,
    inputFieldList: props.inputFieldList,
    input_field_list: props.inputFieldList,
    modelId: normalizedModelId,
    model_id: normalizedModelId,
    prompt: promptTemplate.value,
    userInput: buildUserInputContext(),
    user_input: buildUserInputContext(),
  };

  try {
    const stream = await generateToolCodeStream(
      payload,
      abortController.value.signal,
    );
    await readGenerateStream(stream);
    if (generatedCode.value.trim()) ElMessage.success('代码生成完成');
  } catch (error) {
    if (isAbortError(error)) {
      ElMessage.info('已停止生成');
      return;
    }
    const message = error instanceof Error ? error.message : '代码生成失败';
    streamError.value = message;
    ElMessage.error(message);
  } finally {
    streaming.value = false;
    abortController.value = undefined;
  }
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

function emitInsert() {
  if (!canUseResult.value) return;
  emit('insert', usableGeneratedCode.value);
  dialogVisible.value = false;
}

function emitReplace() {
  if (!canUseResult.value) return;
  emit('replace', usableGeneratedCode.value);
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
    append-to-body
    destroy-on-close
    title="AI 生成代码"
    width="920px"
    :before-close="handleBeforeClose"
  >
    <div class="generate-code-dialog">
      <section class="generate-code-dialog__topbar">
        <div class="generate-code-dialog__copy">
          <div class="generate-code-dialog__eyebrow">MAXKB CODE PILOT</div>
          <h3>用当前参数结构生成工具代码</h3>
          <p>
            选择 LLM 模型，补充需求后流式生成 Python
            代码，可插入到末尾或直接替换当前代码。
          </p>
        </div>
        <div class="generate-code-dialog__model">
          <span>LLM 模型</span>
          <LocalModelSelect
            v-model="modelId"
            class="generate-code-dialog__model-select"
            model-type="LLM"
            placeholder="请选择生成模型"
          />
        </div>
      </section>

      <div class="generate-code-dialog__grid">
        <section class="generate-code-dialog__panel">
          <div class="generate-code-dialog__panel-title">
            <span>生成需求</span>
            <span class="generate-code-dialog__muted">
              Ctrl + Enter 快速生成
            </span>
          </div>
          <ElInput
            v-model="userInstruction"
            maxlength="2000"
            placeholder="描述工具要完成的业务逻辑、接口、返回格式或异常处理要求"
            show-word-limit
            type="textarea"
            :autosize="{ minRows: 5, maxRows: 8 }"
            @keydown.ctrl.enter.prevent="submitGenerate"
          />

          <div class="generate-code-dialog__summary">
            <ElTag size="small" type="info">
              启动参数 {{ initFieldCount }}
            </ElTag>
            <ElTag size="small" type="info">
              输入参数 {{ inputFieldCount }}
            </ElTag>
            <ElTag v-if="hasExistingCode" size="small" type="warning">
              包含当前代码上下文
            </ElTag>
          </div>

          <div
            class="generate-code-dialog__panel-title generate-code-dialog__prompt-title"
          >
            <span>Prompt 模板</span>
            <ElButton
              link
              size="small"
              type="primary"
              :disabled="streaming"
              @click="resetPromptTemplate"
            >
              重置
            </ElButton>
          </div>
          <ElInput
            v-model="promptTemplate"
            type="textarea"
            :autosize="{ minRows: 8, maxRows: 12 }"
          />
          <p class="generate-code-dialog__hint">
            <span>模板会由后端替换</span>
            <code>{userInput}</code>
            <span>、</span>
            <code>{initFieldList}</code>
            <span>、</span>
            <code>{inputFieldList}</code>
            <span>。</span>
          </p>
        </section>

        <section
          class="generate-code-dialog__panel generate-code-dialog__result-panel"
        >
          <div class="generate-code-dialog__panel-title">
            <span>生成结果</span>
            <div class="generate-code-dialog__status">
              <ElTag v-if="streaming" size="small" type="success">生成中</ElTag>
              <ElTag v-else-if="generatedLineCount" size="small" type="info">
                {{ generatedLineCount }} 行
              </ElTag>
            </div>
          </div>
          <ElScrollbar
            ref="resultScrollRef"
            class="generate-code-dialog__result-scroll"
          >
            <pre
              ref="resultContentRef"
              :class="generatedCodeClass"
              v-text="generatedCodeDisplay"
            ></pre>
          </ElScrollbar>
          <ElAlert
            v-if="streamError"
            class="generate-code-dialog__error"
            type="error"
            :closable="false"
            :title="streamError"
          />
        </section>
      </div>
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
      <ElButton
        type="primary"
        :disabled="!canSubmit"
        :icon="MagicStick"
        :loading="streaming"
        @click="submitGenerate"
      >
        生成代码
      </ElButton>
      <ElButton :disabled="streaming || !canUseResult" @click="emitInsert">
        插入到末尾
      </ElButton>
      <ElButton
        type="success"
        :disabled="streaming || !canUseResult"
        @click="emitReplace"
      >
        替换当前代码
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped lang="scss">
.generate-code-dialog {
  --code-gen-space-1: 4px;
  --code-gen-space-2: 8px;
  --code-gen-space-3: 12px;
  --code-gen-space-4: 16px;
  --code-gen-space-5: 20px;

  display: flex;
  flex-direction: column;
  gap: var(--code-gen-space-3);
}

.generate-code-dialog__topbar,
.generate-code-dialog__panel {
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius);
}

.generate-code-dialog__topbar {
  display: flex;
  gap: var(--code-gen-space-4);
  align-items: center;
  justify-content: space-between;
  padding: var(--code-gen-space-4);
  background:
    radial-gradient(
      circle at 0% 18%,
      var(--el-color-primary-light-9),
      hsl(var(--card) / 0%) 38%
    ),
    hsl(var(--card));
}

.generate-code-dialog__copy {
  min-width: 0;
}

.generate-code-dialog__eyebrow,
.generate-code-dialog__muted,
.generate-code-dialog__hint,
.generate-code-dialog__model span {
  font-size: calc(var(--font-size-base) * 0.75);
  color: var(--el-text-color-secondary);
}

.generate-code-dialog__eyebrow {
  font-weight: 700;
  color: var(--el-color-primary);
  letter-spacing: 0.08em;
}

.generate-code-dialog__copy h3 {
  margin: var(--code-gen-space-1) 0;
  font-size: calc(var(--font-size-base) * 1.125);
  color: var(--el-text-color-primary);
}

.generate-code-dialog__copy p,
.generate-code-dialog__hint {
  margin: 0;
}

.generate-code-dialog__model {
  display: flex;
  flex: 0 0 260px;
  flex-direction: column;
  gap: var(--code-gen-space-2);
}

.generate-code-dialog__model-select {
  width: 100%;
}

.generate-code-dialog__grid {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  gap: var(--code-gen-space-3);
}

.generate-code-dialog__panel {
  min-width: 0;
  padding: var(--code-gen-space-4);
}

.generate-code-dialog__panel-title,
.generate-code-dialog__status,
.generate-code-dialog__summary {
  display: flex;
  gap: var(--code-gen-space-2);
  align-items: center;
}

.generate-code-dialog__panel-title {
  justify-content: space-between;
  margin-bottom: var(--code-gen-space-2);
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.generate-code-dialog__prompt-title,
.generate-code-dialog__summary,
.generate-code-dialog__hint,
.generate-code-dialog__error {
  margin-top: var(--code-gen-space-3);
}

.generate-code-dialog__summary {
  flex-wrap: wrap;
}

.generate-code-dialog__hint code {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: calc(var(--radius) - 4px);
}

.generate-code-dialog__result-panel {
  display: flex;
  flex-direction: column;
}

.generate-code-dialog__result-scroll {
  height: min(46vh, 420px);
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius);
}

.generate-code-dialog__code {
  min-height: 100%;
  padding: var(--code-gen-space-3);
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: calc(var(--font-size-base) * 0.8125);
  line-height: 1.65;
  color: var(--el-text-color-primary);
  white-space: pre-wrap;
}

.generate-code-dialog__code.is-empty {
  color: var(--el-text-color-placeholder);
}
</style>
