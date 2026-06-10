<script setup lang="ts">
/**
 * 工作流调试 — 单节点执行详情卡（决策 3A 完整版）。
 *
 * header：折叠箭头 + 节点图标 + 名称 + tokens + 耗时 + 状态图标。
 * body：按 nodeType 分派定制面板，未定制 type 走通用兜底（input/output JSON）。
 * 仅服务工作流调试面板。
 */
import type { NodeStep } from './types';

import { computed } from 'vue';

import {
  ArrowDown,
  ArrowRight,
  CircleCheck,
  CircleClose,
  Loading,
  WarningFilled,
} from '@element-plus/icons-vue';
import { ElACodeHighlight, ElAMarkdown } from 'element-ai-vue';
import { ElIcon, ElTag } from 'element-plus';

import { prettyJson, safeParseJson } from '../../../utils';
import { nodeTypeIcon } from '../../designer/common/node-type-icons';
import KnowledgeSources from './KnowledgeSources.vue';
import ReasoningCard from './ReasoningCard.vue';

const props = defineProps<{ step: NodeStep }>();

const emit = defineEmits<{ toggle: [] }>();

const icon = computed(() => nodeTypeIcon(props.step.nodeType));

/** node_end payload 解析结果（应用层 NodeOutput）。 */
const output = computed(() => props.step.output ?? {});

/** context/input 解析（补数据后才有）。 */
const inputObject = computed(() =>
  props.step.inputJson
    ? safeParseJson(props.step.inputJson, undefined)
    : undefined,
);

const totalTokens = computed(() => {
  const prompt = props.step.promptTokens ?? 0;
  const completion = props.step.completionTokens ?? 0;
  const sum = prompt + completion;
  return sum > 0 ? sum : undefined;
});

const runTimeText = computed(() => {
  const ms = props.step.runTime;
  if (typeof ms !== 'number' || ms <= 0) return undefined;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
});

/** 高频 type 的定制面板分派；其余走兜底。 */
const panelKind = computed<string>(() => {
  const type = props.step.nodeType;
  if (type === 'ai-chat-node' || type === 'question-node') return 'ai-chat';
  if (type === 'search-knowledge-node' || type === 'search-document-node') {
    return 'search';
  }
  if (type === 'reply-node') return 'reply';
  if (type === 'condition-node') return 'condition';
  if (type === 'intent-node') return 'intent';
  if (type === 'form-node') return 'form';
  if (type === 'start-node') return 'start';
  return 'fallback';
});

/** ai-chat 面板：问题。 */
const question = computed(() =>
  typeof output.value.question === 'string' ? output.value.question : '',
);

/** ai-chat 面板：回答（markdown）。 */
const answer = computed(() => {
  const a = output.value.answer ?? output.value.content;
  if (typeof a === 'string' && a.trim()) return a;
  return props.step.content || '';
});

const history = computed(() =>
  Array.isArray(output.value.history_message)
    ? output.value.history_message
    : [],
);

const knowledgeSources = computed(() =>
  Array.isArray(props.step.knowledgeSources) ? props.step.knowledgeSources : [],
);

/** condition/intent：命中分支。 */
const branchName = computed(() => {
  const o = output.value;
  return (
    (typeof o.branch_name === 'string' && o.branch_name) ||
    (typeof o.branchId === 'string' && o.branchId) ||
    (typeof o.branch === 'string' && o.branch) ||
    ''
  );
});

/** form：表单字段。 */
const formData = computed(() => {
  const f = output.value.form;
  return f === undefined ? undefined : f;
});

/** 通用兜底 JSON 文本。 */
const inputJsonPretty = computed(() =>
  props.step.inputJson ? prettyJson(props.step.inputJson, '') : '',
);

const outputJsonPretty = computed(() =>
  props.step.outputJson ? prettyJson(props.step.outputJson, '') : '',
);

function historyText(item: Record<string, any>): string {
  const role = `${item.role ?? ''}`;
  const content =
    typeof item.content === 'string'
      ? item.content
      : prettyJson(item.content, '');
  return role ? `${role}: ${content}` : content;
}
</script>

<template>
  <div class="exec-card" :class="`is-${step.status.toLowerCase()}`">
    <button type="button" class="exec-head" @click="emit('toggle')">
      <ElIcon class="exec-arrow">
        <ArrowDown v-if="step.expanded" />
        <ArrowRight v-else />
      </ElIcon>
      <ElIcon class="exec-node-icon">
        <component :is="icon" />
      </ElIcon>
      <span class="exec-name" :title="step.nodeName">{{ step.nodeName }}</span>
      <span class="exec-meta">
        <ElTag v-if="totalTokens" size="small" type="info">
          {{ totalTokens }} tokens
        </ElTag>
        <ElTag v-if="runTimeText" size="small" type="info">
          {{ runTimeText }}
        </ElTag>
      </span>
      <ElIcon class="exec-status">
        <CircleCheck v-if="step.status === 'SUCCESS'" class="is-success" />
        <Loading v-else-if="step.status === 'RUNNING'" class="is-running" />
        <WarningFilled
          v-else-if="step.status === 'WARNING'"
          class="is-warning"
        />
        <CircleClose v-else class="is-failed" />
      </ElIcon>
    </button>

    <div v-show="step.expanded" class="exec-body">
      <!-- AI 对话 / 用户问题 -->
      <template v-if="panelKind === 'ai-chat'">
        <section v-if="question" class="exec-section">
          <h5>问题</h5>
          <div class="exec-text">{{ question }}</div>
        </section>
        <section v-if="history.length > 0" class="exec-section">
          <h5>历史消息</h5>
          <div
            v-for="(item, idx) in history"
            :key="idx"
            class="exec-text exec-history-item"
          >
            {{ historyText(item) }}
          </div>
        </section>
        <section v-if="step.reasoningContent" class="exec-section">
          <h5>思考</h5>
          <ReasoningCard :content="step.reasoningContent" />
        </section>
        <section v-if="answer" class="exec-section">
          <h5>回答</h5>
          <div class="exec-markdown">
            <ElAMarkdown :content="answer">
              <template #code="codeProps">
                <ElACodeHighlight
                  :content="codeProps.content"
                  :language="codeProps.language"
                  :extend-themes="codeProps.extendThemes"
                  :show-line-numbers="false"
                />
              </template>
            </ElAMarkdown>
          </div>
        </section>
        <section v-if="knowledgeSources.length > 0" class="exec-section">
          <h5>知识来源</h5>
          <KnowledgeSources :sources="knowledgeSources" />
        </section>
      </template>

      <!-- 知识 / 文档检索 -->
      <template v-else-if="panelKind === 'search'">
        <section v-if="question" class="exec-section">
          <h5>检索内容</h5>
          <div class="exec-text">{{ question }}</div>
        </section>
        <section class="exec-section">
          <h5>检索结果</h5>
          <KnowledgeSources :sources="knowledgeSources" />
        </section>
      </template>

      <!-- 回复 -->
      <template v-else-if="panelKind === 'reply'">
        <section class="exec-section">
          <h5>回复内容</h5>
          <div class="exec-markdown">
            <ElAMarkdown :content="answer">
              <template #code="codeProps">
                <ElACodeHighlight
                  :content="codeProps.content"
                  :language="codeProps.language"
                  :extend-themes="codeProps.extendThemes"
                  :show-line-numbers="false"
                />
              </template>
            </ElAMarkdown>
          </div>
        </section>
      </template>

      <!-- 条件 / 意图：命中分支 -->
      <template v-else-if="panelKind === 'condition' || panelKind === 'intent'">
        <section class="exec-section">
          <h5>命中分支</h5>
          <div class="exec-text">{{ branchName || '（未命中/默认）' }}</div>
        </section>
        <section v-if="outputJsonPretty" class="exec-section">
          <h5>详情</h5>
          <pre class="exec-json">{{ outputJsonPretty }}</pre>
        </section>
      </template>

      <!-- 表单（node_interrupt） -->
      <template v-else-if="panelKind === 'form'">
        <section class="exec-section">
          <h5>表单字段</h5>
          <pre class="exec-json">{{
            prettyJson(formData, '（无表单数据）')
          }}</pre>
        </section>
      </template>

      <!-- 开始节点：输入参数 -->
      <template v-else-if="panelKind === 'start'">
        <section class="exec-section">
          <h5>输入参数</h5>
          <pre class="exec-json">{{
            prettyJson(inputObject ?? output, '（无输入）')
          }}</pre>
        </section>
      </template>

      <!-- 兜底：input + output JSON -->
      <template v-else>
        <section v-if="inputJsonPretty" class="exec-section">
          <h5>输入</h5>
          <pre class="exec-json">{{ inputJsonPretty }}</pre>
        </section>
        <section v-if="outputJsonPretty" class="exec-section">
          <h5>输出</h5>
          <pre class="exec-json">{{ outputJsonPretty }}</pre>
        </section>
        <section v-if="!inputJsonPretty && !outputJsonPretty && step.content">
          <div class="exec-text">{{ step.content }}</div>
        </section>
      </template>

      <!-- 错误信息（任意 type 通用） -->
      <section v-if="step.errorMessage" class="exec-section">
        <h5 class="exec-error-title">错误</h5>
        <div class="exec-error">{{ step.errorMessage }}</div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.exec-card {
  margin-bottom: 8px;
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-left-width: 3px;
  border-radius: 6px;
}

.exec-card.is-running {
  border-left-color: var(--el-color-primary);
}

.exec-card.is-success {
  border-left-color: var(--el-color-success);
}

.exec-card.is-warning {
  border-left-color: var(--el-color-warning);
}

.exec-card.is-failed {
  border-left-color: var(--el-color-danger);
}

.exec-head {
  display: flex;
  gap: 6px;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  cursor: pointer;
  background: transparent;
  border: none;
}

.exec-arrow,
.exec-node-icon {
  flex-shrink: 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.exec-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  text-align: left;
  white-space: nowrap;
}

.exec-meta {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
  align-items: center;
}

.exec-status {
  flex-shrink: 0;
  font-size: 16px;
}

.exec-status .is-success {
  color: var(--el-color-success);
}

.exec-status .is-running {
  color: var(--el-color-primary);
  animation: exec-spin 1s linear infinite;
}

.exec-status .is-warning {
  color: var(--el-color-warning);
}

.exec-status .is-failed {
  color: var(--el-color-danger);
}

@keyframes exec-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.exec-body {
  padding: 0 10px 10px;
}

.exec-section {
  margin-top: 8px;
}

.exec-section h5 {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.exec-text {
  padding: 6px 8px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

.exec-history-item {
  margin-bottom: 4px;
}

.exec-markdown {
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.exec-json {
  max-height: 240px;
  padding: 8px;
  margin: 0;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  white-space: pre-wrap;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

.exec-error-title {
  color: var(--el-color-danger) !important;
}

.exec-error {
  padding: 6px 8px;
  font-size: 12px;
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
  border-radius: 4px;
}
</style>
