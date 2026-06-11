<script setup lang="ts">
/**
 * 工具工作流调试 — 单节点执行详情卡。
 *
 * 支持工具工作流特有节点类型：
 * - tool-start-node（工具入口）
 * - tool-lib-node（工具调用）
 * - tool-workflow-lib-node（子工具工作流）
 * - ai-chat-node（AI 对话）
 * - condition-node（条件分支）
 * - reply-node（回复）
 * - variable-assign-node（变量赋值）
 * - 通用节点（兜底 JSON 展示）
 */
import { computed } from 'vue';

import {
  ArrowDown,
  ArrowRight,
  CircleCheck,
  CircleClose,
  Loading,
  WarningFilled,
} from '@element-plus/icons-vue';
import { ElIcon, ElTag } from 'element-plus';

import { prettyJson, safeParseJson } from '../../utils';
import { nodeTypeIcon } from '../../workflow/designer/common/node-type-icons';

export interface ToolNodeStep {
  nodeId?: string;
  nodeType: string;
  nodeName: string;
  status: 'FAILED' | 'RUNNING' | 'SUCCESS' | 'WARNING';
  runTime?: number;
  inputJson?: string;
  outputJson?: string;
  content?: string;
  errorMessage?: string;
  promptTokens?: number;
  completionTokens?: number;
  expanded?: boolean;
  output?: Record<string, any>;
}

const props = defineProps<{ data: ToolNodeStep }>();

const emit = defineEmits<{ toggle: [] }>();

const icon = computed(() => nodeTypeIcon(props.data.nodeType));

const output = computed(() => props.data.output ?? {});

const inputObject = computed(() =>
  props.data.inputJson
    ? safeParseJson(props.data.inputJson, undefined)
    : undefined,
);

const totalTokens = computed(() => {
  const prompt = props.data.promptTokens ?? 0;
  const completion = props.data.completionTokens ?? 0;
  const sum = prompt + completion;
  return sum > 0 ? sum : undefined;
});

const runTimeText = computed(() => {
  const ms = props.data.runTime;
  if (typeof ms !== 'number' || ms <= 0) return undefined;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
});

const panelKind = computed<string>(() => {
  const type = props.data.nodeType;
  if (type === 'tool-start-node') return 'tool-start';
  if (type === 'tool-lib-node') return 'tool-lib';
  if (type === 'tool-workflow-lib-node') return 'tool-workflow-lib';
  if (type === 'ai-chat-node') return 'ai-chat';
  if (type === 'condition-node') return 'condition';
  if (type === 'reply-node') return 'reply';
  if (type === 'variable-assign-node') return 'variable-assign';
  if (type === 'start-node' || type === 'application-node') return 'start';
  if (type === 'search-knowledge-node') return 'search-knowledge';
  if (type === 'document-extract-node') return 'document-extract';
  if (type === 'speech-to-text-node') return 'speech-to-text';
  if (type === 'text-to-speech-node') return 'text-to-speech';
  if (type === 'form-node') return 'form';
  if (type === 'image-understand-node') return 'image-understand';
  if (type === 'image-generate-node') return 'image-generate';
  if (type === 'video-understand-node') return 'video-understand';
  if (type === 'intent-node') return 'intent';
  if (type === 'variable-splitting-node') return 'variable-splitting';
  if (type === 'variable-aggregation-node') return 'variable-aggregation';
  if (type === 'mcp-node') return 'mcp';
  if (type === 'loop-node') return 'loop';
  if (type === 'loop-start-node') return 'loop-start';
  if (type === 'loop-continue-node') return 'loop-continue';
  if (type === 'loop-break-node') return 'loop-break';
  if (type === 'search-document-node') return 'search-document';
  if (type === 'data-source-local-node') return 'data-source-local';
  if (type === 'document-split-node') return 'document-split';
  if (type === 'knowledge-write-node') return 'knowledge-write';
  if (type === 'data-source-web-node') return 'data-source-web';
  return 'fallback';
});

const question = computed(() =>
  typeof output.value.question === 'string' ? output.value.question : '',
);

const answer = computed(() => {
  const a = output.value.answer ?? output.value.content;
  if (typeof a === 'string' && a.trim()) return a;
  return props.data.content || '';
});

const branchName = computed(() => {
  const o = output.value;
  return (
    (typeof o.branch_name === 'string' && o.branch_name) ||
    (typeof o.branchId === 'string' && o.branchId) ||
    (typeof o.branch === 'string' && o.branch) ||
    ''
  );
});

const inputJsonPretty = computed(() =>
  props.data.inputJson ? prettyJson(props.data.inputJson, '') : '',
);

const outputJsonPretty = computed(() =>
  props.data.outputJson ? prettyJson(props.data.outputJson, '') : '',
);

const paragraphList = computed(() => output.value.paragraph_list ?? []);
const documentList = computed(() => output.value.document_list ?? []);
const imageList = computed(() => output.value.image_list ?? []);
const videoList = computed(() => output.value.video_list ?? []);
const audioList = computed(() => output.value.audio_list ?? []);
const formData = computed(() => output.value.form_data ?? {});
const historyMessage = computed(() => output.value.history_message ?? []);
const system = computed(() => output.value.system ?? '');
const reasoningContent = computed(() => output.value.reasoning_content ?? '');
</script>

<template>
  <div class="exec-card" :class="`is-${data.status.toLowerCase()}`">
    <button type="button" class="exec-head" @click="emit('toggle')">
      <ElIcon class="exec-arrow">
        <ArrowDown v-if="data.expanded" />
        <ArrowRight v-else />
      </ElIcon>
      <ElIcon class="exec-node-icon">
        <component :is="icon" />
      </ElIcon>
      <span class="exec-name" :title="data.nodeName">{{ data.nodeName }}</span>
      <span class="exec-meta">
        <ElTag v-if="totalTokens" size="small" type="info">
          {{ totalTokens }} tokens
        </ElTag>
        <ElTag v-if="runTimeText" size="small" type="info">
          {{ runTimeText }}
        </ElTag>
      </span>
      <ElIcon class="exec-status">
        <CircleCheck v-if="data.status === 'SUCCESS'" class="is-success" />
        <Loading v-else-if="data.status === 'RUNNING'" class="is-running" />
        <WarningFilled
          v-else-if="data.status === 'WARNING'"
          class="is-warning"
        />
        <CircleClose v-else class="is-failed" />
      </ElIcon>
    </button>

    <div v-show="data.expanded" class="exec-body">
      <!-- 工具入口 -->
      <template v-if="panelKind === 'tool-start'">
        <section class="exec-section">
          <h5>输入参数</h5>
          <pre class="exec-json">{{
            prettyJson(inputObject ?? output, '（无输入）')
          }}</pre>
        </section>
      </template>

      <!-- 工具调用 -->
      <template v-else-if="panelKind === 'tool-lib'">
        <section v-if="inputJsonPretty" class="exec-section">
          <h5>输入</h5>
          <pre class="exec-json">{{ inputJsonPretty }}</pre>
        </section>
        <section v-if="outputJsonPretty" class="exec-section">
          <h5>输出</h5>
          <pre class="exec-json">{{ outputJsonPretty }}</pre>
        </section>
      </template>

      <!-- 子工具工作流 -->
      <template v-else-if="panelKind === 'tool-workflow-lib'">
        <section v-if="inputJsonPretty" class="exec-section">
          <h5>输入</h5>
          <pre class="exec-json">{{ inputJsonPretty }}</pre>
        </section>
        <section v-if="outputJsonPretty" class="exec-section">
          <h5>输出</h5>
          <pre class="exec-json">{{ outputJsonPretty }}</pre>
        </section>
      </template>

      <!-- AI 对话 -->
      <template v-else-if="panelKind === 'ai-chat'">
        <section v-if="question" class="exec-section">
          <h5>问题</h5>
          <div class="exec-text">{{ question }}</div>
        </section>
        <section v-if="answer" class="exec-section">
          <h5>回答</h5>
          <div class="exec-text">{{ answer }}</div>
        </section>
      </template>

      <!-- 条件分支 -->
      <template v-else-if="panelKind === 'condition'">
        <section class="exec-section">
          <h5>命中分支</h5>
          <div class="exec-text">{{ branchName || '（未命中/默认）' }}</div>
        </section>
        <section v-if="outputJsonPretty" class="exec-section">
          <h5>详情</h5>
          <pre class="exec-json">{{ outputJsonPretty }}</pre>
        </section>
      </template>

      <!-- 回复 -->
      <template v-else-if="panelKind === 'reply'">
        <section class="exec-section">
          <h5>回复内容</h5>
          <div class="exec-text">{{ answer }}</div>
        </section>
      </template>

      <!-- 变量赋值 -->
      <template v-else-if="panelKind === 'variable-assign'">
        <section v-if="inputJsonPretty" class="exec-section">
          <h5>输入</h5>
          <pre class="exec-json">{{ inputJsonPretty }}</pre>
        </section>
        <section v-if="outputJsonPretty" class="exec-section">
          <h5>输出</h5>
          <pre class="exec-json">{{ outputJsonPretty }}</pre>
        </section>
      </template>

      <!-- 开始节点 / Application -->
      <template v-else-if="panelKind === 'start'">
        <section class="exec-section">
          <h5>输入参数</h5>
          <div v-if="question" class="exec-text mb-8">
            <span class="label">问题:</span> {{ question }}
          </div>
          <div v-if="documentList.length > 0" class="exec-text">
            <span class="label">文档:</span>
            <div v-for="(doc, i) in documentList" :key="i" class="mb-4">
              {{ doc.name }}
            </div>
          </div>
          <div v-if="imageList.length > 0" class="exec-text">
            <span class="label">图片:</span> {{ imageList.length }} 张
          </div>
          <pre
            v-if="
              !question && documentList.length === 0 && imageList.length === 0
            "
            class="exec-json"
            >{{ prettyJson(inputObject ?? output, '（无输入）') }}</pre
          >
        </section>
      </template>

      <!-- 知识库检索 -->
      <template v-else-if="panelKind === 'search-knowledge'">
        <section class="exec-section">
          <h5>检索内容</h5>
          <div class="exec-text">{{ question || '（无）' }}</div>
        </section>
        <section v-if="paragraphList.length > 0" class="exec-section">
          <h5>检索结果</h5>
          <div class="exec-text">
            找到 {{ paragraphList.length }} 条相关段落
          </div>
        </section>
      </template>

      <!-- 文档内容提取 -->
      <template v-else-if="panelKind === 'document-extract'">
        <section class="exec-section">
          <h5>输出参数</h5>
          <div v-if="Array.isArray(props.data.content)" class="exec-text">
            <div v-for="(item, i) in props.data.content" :key="i" class="mb-8">
              {{ item }}
            </div>
          </div>
          <div v-else class="exec-text">
            {{ props.data.content || '（无）' }}
          </div>
        </section>
      </template>

      <!-- 语音转文字 -->
      <template v-else-if="panelKind === 'speech-to-text'">
        <section v-if="audioList.length > 0" class="exec-section">
          <h5>输入参数</h5>
          <div class="exec-text">音频文件: {{ audioList.length }} 个</div>
        </section>
        <section class="exec-section">
          <h5>输出参数</h5>
          <div v-if="Array.isArray(props.data.content)" class="exec-text">
            <div v-for="(item, i) in props.data.content" :key="i" class="mb-8">
              {{ item }}
            </div>
          </div>
          <div v-else class="exec-text">
            {{ props.data.content || '（无）' }}
          </div>
        </section>
      </template>

      <!-- 文字转语音 -->
      <template v-else-if="panelKind === 'text-to-speech'">
        <section class="exec-section">
          <h5>输入参数</h5>
          <div class="exec-text">{{ props.data.content || '（无）' }}</div>
        </section>
        <section v-if="answer" class="exec-section">
          <h5>输出参数</h5>
          <div class="exec-text">音频文件已生成</div>
        </section>
      </template>

      <!-- 表单收集 -->
      <template v-else-if="panelKind === 'form'">
        <section class="exec-section">
          <h5>输出参数</h5>
          <div v-if="Object.keys(formData).length > 0" class="exec-text">
            <div v-for="(val, key) in formData" :key="key" class="mb-4">
              <span class="label">{{ key }}:</span> {{ val }}
            </div>
          </div>
          <div v-else class="exec-text">（无表单数据）</div>
        </section>
      </template>

      <!-- 图片理解 -->
      <template v-else-if="panelKind === 'image-understand'">
        <section v-if="system" class="exec-section">
          <h5>角色设定</h5>
          <div class="exec-text">{{ system }}</div>
        </section>
        <section v-if="historyMessage.length > 0" class="exec-section">
          <h5>历史消息</h5>
          <div
            v-for="(msg, i) in historyMessage"
            :key="i"
            class="exec-text mb-4"
          >
            <span class="label">{{ msg.role }}:</span> {{ msg.content }}
          </div>
        </section>
        <section class="exec-section">
          <h5>当前对话</h5>
          <div v-if="imageList.length > 0" class="exec-text mb-4">
            图片: {{ imageList.length }} 张
          </div>
          <div class="exec-text">{{ question || '（无）' }}</div>
        </section>
        <section v-if="reasoningContent" class="exec-section">
          <h5>思考过程</h5>
          <div class="exec-text">{{ reasoningContent }}</div>
        </section>
        <section v-if="answer" class="exec-section">
          <h5>回答</h5>
          <div class="exec-text">{{ answer }}</div>
        </section>
      </template>

      <!-- 视频理解 -->
      <template v-else-if="panelKind === 'video-understand'">
        <section v-if="system" class="exec-section">
          <h5>角色设定</h5>
          <div class="exec-text">{{ system }}</div>
        </section>
        <section class="exec-section">
          <h5>当前对话</h5>
          <div v-if="videoList.length > 0" class="exec-text mb-4">
            视频: {{ videoList.length }} 个
          </div>
          <div class="exec-text">{{ question || '（无）' }}</div>
        </section>
        <section v-if="reasoningContent" class="exec-section">
          <h5>思考过程</h5>
          <div class="exec-text">{{ reasoningContent }}</div>
        </section>
        <section v-if="answer" class="exec-section">
          <h5>回答</h5>
          <div class="exec-text">{{ answer }}</div>
        </section>
      </template>

      <!-- 图片生成 -->
      <template v-else-if="panelKind === 'image-generate'">
        <section class="exec-section">
          <h5>当前对话</h5>
          <div class="exec-text">{{ question || '（无）' }}</div>
        </section>
        <section v-if="answer" class="exec-section">
          <h5>回答</h5>
          <div class="exec-text">{{ answer }}</div>
        </section>
      </template>

      <!-- 意图识别 -->
      <template v-else-if="panelKind === 'intent'">
        <section v-if="system" class="exec-section">
          <h5>角色设定</h5>
          <div class="exec-text">{{ system }}</div>
        </section>
        <section class="exec-section">
          <h5>当前对话</h5>
          <div class="exec-text">{{ question || '（无）' }}</div>
        </section>
        <section v-if="answer" class="exec-section">
          <h5>回答</h5>
          <div class="exec-text">{{ answer }}</div>
        </section>
      </template>

      <!-- 变量拆分 -->
      <template v-else-if="panelKind === 'variable-splitting'">
        <section v-if="output.request" class="exec-section">
          <h5>输入参数</h5>
          <div class="exec-text">{{ output.request }}</div>
        </section>
        <section
          v-if="output.result && Object.keys(output.result).length > 0"
          class="exec-section"
        >
          <h5>输出参数</h5>
          <div
            v-for="(val, key) in output.result"
            :key="key"
            class="exec-text mb-4"
          >
            <span class="label">{{ key }}:</span> {{ val }}
          </div>
        </section>
      </template>

      <!-- 变量聚合 -->
      <template v-else-if="panelKind === 'variable-aggregation'">
        <section v-if="output.strategy" class="exec-section">
          <h5>聚合策略</h5>
          <div class="exec-text">{{ output.strategy }}</div>
        </section>
        <section
          v-if="output.result && Object.keys(output.result).length > 0"
          class="exec-section"
        >
          <h5>输出参数</h5>
          <div
            v-for="(val, key) in output.result"
            :key="key"
            class="exec-text mb-4"
          >
            <span class="label">{{ key }}:</span> {{ val }}
          </div>
        </section>
      </template>

      <!-- MCP 节点 -->
      <template v-else-if="panelKind === 'mcp'">
        <section v-if="output.mcp_tool" class="exec-section">
          <h5>工具</h5>
          <div class="exec-text">{{ output.mcp_tool }}</div>
        </section>
        <section v-if="output.tool_params" class="exec-section">
          <h5>工具参数</h5>
          <div
            v-for="(val, key) in output.tool_params"
            :key="key"
            class="exec-text mb-4"
          >
            <span class="label">{{ key }}:</span> {{ val }}
          </div>
        </section>
        <section v-if="output.result" class="exec-section">
          <h5>输出参数</h5>
          <pre class="exec-json">{{ prettyJson(output.result, '（无）') }}</pre>
        </section>
      </template>

      <!-- 循环节点 -->
      <template v-else-if="panelKind === 'loop'">
        <section class="exec-section">
          <h5>循环设置</h5>
          <div class="exec-text mb-4">
            <span class="label">循环类型:</span>
            {{ output.loop_type || '（无）' }}
          </div>
          <div class="exec-text">
            <span class="label">循环数组:</span>
            {{ output.number || output.loop_node_data ? '已配置' : '（无）' }}
          </div>
        </section>
      </template>

      <!-- 循环开始 -->
      <template v-else-if="panelKind === 'loop-start'">
        <section class="exec-section">
          <h5>输入参数</h5>
          <div class="exec-text mb-4">
            <span class="label">循环项:</span>
            {{ output.current_item ?? '（无）' }}
          </div>
          <div class="exec-text">
            <span class="label">循环索引:</span>
            {{ output.current_index ?? '（无）' }}
          </div>
        </section>
      </template>

      <!-- 循环跳过 -->
      <template v-else-if="panelKind === 'loop-continue'">
        <section class="exec-section">
          <h5>输出参数</h5>
          <div class="exec-text">
            <span class="label">是否跳过:</span>
            {{ output.is_continue ? '是' : '否' }}
          </div>
        </section>
      </template>

      <!-- 循环退出 -->
      <template v-else-if="panelKind === 'loop-break'">
        <section class="exec-section">
          <h5>输出参数</h5>
          <div class="exec-text">
            <span class="label">是否退出:</span>
            {{ output.is_break ? '是' : '否' }}
          </div>
        </section>
      </template>

      <!-- 文档检索 -->
      <template v-else-if="panelKind === 'search-document'">
        <section class="exec-section">
          <h5>输出参数</h5>
          <div v-if="output.knowledge_items" class="exec-text mb-4">
            <span class="label">知识库列表:</span>
            {{
              Array.isArray(output.knowledge_items)
                ? output.knowledge_items.map((v: any) => v.name).join(', ')
                : '（无）'
            }}
          </div>
          <div v-if="output.document_items" class="exec-text">
            <span class="label">文档列表:</span>
            {{
              Array.isArray(output.document_items)
                ? output.document_items.map((v: any) => v.name).join(', ')
                : '（无）'
            }}
          </div>
        </section>
      </template>

      <!-- 本地数据源 -->
      <template v-else-if="panelKind === 'data-source-local'">
        <section class="exec-section">
          <h5>输出参数</h5>
          <div class="exec-text">{{ output.file_list || '（无文件）' }}</div>
        </section>
      </template>

      <!-- 文档分割 -->
      <template v-else-if="panelKind === 'document-split'">
        <section class="exec-section">
          <h5>输入参数</h5>
          <div class="exec-text mb-4">
            <span class="label">分段规则:</span>
            {{ output.split_strategy || '（无）' }}
          </div>
          <div class="exec-text mb-4">
            <span class="label">分段长度:</span>
            {{ output.chunk_size || '（无）' }}
          </div>
          <div v-if="documentList.length > 0" class="exec-text">
            <span class="label">输入内容:</span>
            {{ documentList.map((v: any) => v.name).join(', ') }}
          </div>
        </section>
        <section v-if="paragraphList.length > 0" class="exec-section">
          <h5>输出参数</h5>
          <div class="exec-text">
            已分割为 {{ paragraphList.length }} 个段落
          </div>
        </section>
      </template>

      <!-- 知识库写入 -->
      <template v-else-if="panelKind === 'knowledge-write'">
        <section v-if="output.write_content" class="exec-section">
          <h5>写入内容</h5>
          <div class="exec-text">
            {{
              Array.isArray(output.write_content)
                ? `${output.write_content.length} 项`
                : '（无）'
            }}
          </div>
        </section>
      </template>

      <!-- Web 数据源 -->
      <template v-else-if="panelKind === 'data-source-web'">
        <section v-if="output.input_params" class="exec-section">
          <h5>输入参数</h5>
          <div class="exec-text mb-4">
            <span class="label">选择器:</span>
            {{ output.input_params.selector || '（无）' }}
          </div>
          <div class="exec-text">
            <span class="label">来源URL:</span>
            {{ output.input_params.source_url || '（无）' }}
          </div>
        </section>
        <section v-if="output.output_params" class="exec-section">
          <h5>输出参数</h5>
          <div class="exec-text">
            {{
              Array.isArray(output.output_params)
                ? `${output.output_params.length} 项`
                : '（无）'
            }}
          </div>
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
        <section v-if="!inputJsonPretty && !outputJsonPretty && data.content">
          <div class="exec-text">{{ data.content }}</div>
        </section>
      </template>

      <!-- 错误信息 -->
      <section v-if="data.errorMessage" class="exec-section">
        <h5 class="exec-error-title">错误</h5>
        <div class="exec-error">{{ data.errorMessage }}</div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.exec-card {
  margin-bottom: 8px;
  background: var(--el-bg-color);
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

.label {
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.mb-4 {
  margin-bottom: 4px;
}

.mb-8 {
  margin-bottom: 8px;
}
</style>
