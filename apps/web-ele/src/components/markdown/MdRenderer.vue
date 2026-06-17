<script setup lang="ts">
import { computed } from 'vue';

import { EditPen } from '@element-plus/icons-vue';
import { ElIcon, ElSpace } from 'element-plus';

import EchartsRander from './EchartsRander.vue';
import FormRander from './FormRander.vue';
import HtmlRander from './HtmlRander.vue';
import IframeRender from './IframeRender.vue';
import MarkdownBlock from './MarkdownBlock.vue';
import ReasoningRander from './ReasoningRander.vue';
import ToolCallsRender from './tool-calls-render/index.vue';

interface RenderNode {
  content: string;
  type: string;
}

interface TagPlugin {
  nested?: boolean;
  tag: string;
  transform?: (content: string) => string;
  type: string;
}

const props = withDefaults(
  defineProps<{
    chatRecordId?: string;
    childNode?: unknown;
    disabled?: boolean;
    reasoningContent?: string;
    runtimeNodeId?: string;
    sendMessage?: (
      question: string,
      type: 'new' | 'old',
      otherParamsData?: unknown,
    ) => void;
    source?: string;
    type?: 'ai-chat' | 'debug-ai-chat' | 'log' | 'share';
  }>(),
  {
    chatRecordId: '',
    childNode: undefined,
    disabled: false,
    reasoningContent: '',
    runtimeNodeId: '',
    sendMessage: undefined,
    source: '',
    type: 'ai-chat',
  },
);

const tagPlugins: TagPlugin[] = [
  { tag: 'quick_question', type: 'question' },
  { tag: 'html_rander', type: 'html_rander' },
  { tag: 'iframe_render', type: 'iframe_render' },
  { tag: 'tool_calls_render', type: 'tool_calls_render' },
  {
    tag: 'echarts_rander',
    transform: (content) => content,
    type: 'echarts_rander',
  },
  { nested: true, tag: 'form_rander', type: 'form_rander' },
];

const componentMap: Record<string, unknown> = {
  echarts_rander: EchartsRander,
  form_rander: FormRander,
  html_rander: HtmlRander,
  iframe_render: IframeRender,
  tool_calls_render: ToolCallsRender,
};

function parseByPlugin(source: string, plugin: TagPlugin): RenderNode[] {
  const startTag = `<${plugin.tag}>`;
  const endTag = `</${plugin.tag}>`;
  if (!source.includes(startTag)) return [{ content: source, type: 'md' }];

  const result: RenderNode[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    const start = source.indexOf(startTag, cursor);
    if (start === -1) {
      result.push({ content: source.slice(cursor), type: 'md' });
      break;
    }

    if (start > cursor)
      result.push({ content: source.slice(cursor, start), type: 'md' });

    let end = source.indexOf(endTag, start);
    if (end === -1) {
      result.push({ content: source.slice(start), type: 'md' });
      break;
    }

    if (plugin.nested) {
      let depth = 1;
      let tempIndex = start + startTag.length;
      while (depth > 0) {
        const nextStart = source.indexOf(startTag, tempIndex);
        const nextEnd = source.indexOf(endTag, tempIndex);
        if (nextEnd === -1) break;
        if (nextStart !== -1 && nextStart < nextEnd) {
          depth += 1;
          tempIndex = nextStart + startTag.length;
        } else {
          depth -= 1;
          tempIndex = nextEnd + endTag.length;
          end = nextEnd;
        }
      }
    }

    const content = source.slice(start + startTag.length, end);
    result.push({
      content: plugin.transform ? plugin.transform(content) : content,
      type: plugin.type,
    });
    cursor = end + endTag.length;
  }

  return result;
}

function parseContent(source: string): RenderNode[] {
  let nodes: RenderNode[] = [{ content: source, type: 'md' }];
  tagPlugins.forEach((plugin) => {
    nodes = nodes.flatMap((node) =>
      node.type === 'md' ? parseByPlugin(node.content, plugin) : node,
    );
  });
  return nodes;
}

const mdViewList = computed(() => parseContent(props.source || ''));

function getComponentProps(item: RenderNode) {
  switch (item.type) {
    case 'echarts_rander': {
      return { option: item.content };
    }
    case 'form_rander': {
      return {
        chatRecordId: props.chatRecordId,
        childNode: props.childNode,
        disabled: props.disabled,
        formSetting: item.content,
        runtimeNodeId: props.runtimeNodeId,
        sendMessage: props.sendMessage,
      };
    }
    case 'html_rander':
    case 'iframe_render': {
      return { sendMessage: props.sendMessage, source: item.content };
    }
    case 'tool_calls_render': {
      return { content: item.content };
    }
    default: {
      return {};
    }
  }
}

function handleQuestionClick(content: string) {
  if (!props.sendMessage || props.type === 'log' || props.disabled) return;
  props.sendMessage(content, 'new');
}
</script>

<template>
  <div>
    <ReasoningRander
      v-if="reasoningContent?.trim()"
      :content="reasoningContent"
    />

    <template
      v-for="(item, index) in mdViewList"
      :key="`${item.type}-${index}`"
    >
      <component
        :is="componentMap[item.type]"
        v-if="componentMap[item.type]"
        v-bind="getComponentProps(item)"
      />

      <div
        v-else-if="item.type === 'question'"
        class="problem-button"
        :class="
          sendMessage && type !== 'log' && !disabled
            ? 'is-clickable'
            : 'is-disabled'
        "
        @click="handleQuestionClick(item.content)"
      >
        <ElSpace :size="8" alignment="flex-start">
          <ElIcon class="question-icon"><EditPen /></ElIcon>
          <span>{{ item.content }}</span>
        </ElSpace>
      </div>

      <MarkdownBlock v-else :source="item.content" />
    </template>
  </div>
</template>

<style scoped lang="scss">
.problem-button {
  box-sizing: border-box;
  width: 100%;
  padding: 12px;
  margin: 4px 0;
  overflow-wrap: anywhere;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
}

.problem-button.is-clickable {
  cursor: pointer;
}

.problem-button.is-clickable:hover {
  background: var(--el-color-primary-light-9);
}

.problem-button.is-disabled {
  color: var(--el-text-color-secondary);
}

.question-icon {
  margin-top: 3px;
  color: var(--el-color-primary);
}
</style>
