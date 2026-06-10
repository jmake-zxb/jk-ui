/**
 * 工作流节点类型 → 图标映射。
 *
 * 当前设计器只有 status 两字母徽章，无 per-type 图标。
 * 这里用 Element Plus 图标按 nodeType 精确映射，兜底走 status 分类。
 * 复用于设计器与调试面板，避免双份。
 */
import type { Component } from 'vue';

import type { NodeStatus } from '../nodes';

import {
  Aim,
  ChatDotRound,
  ChatLineRound,
  Coin,
  Collection,
  Connection,
  Cpu,
  DataAnalysis,
  Document,
  Files,
  Filter,
  Grid,
  Guide,
  Headset,
  Histogram,
  InfoFilled,
  Link,
  MagicStick,
  Microphone,
  Operation,
  Picture,
  Position,
  Promotion,
  RefreshRight,
  Search,
  Setting,
  Share,
  Sort,
  Tickets,
  Tools,
  VideoCamera,
  VideoPlay,
} from '@element-plus/icons-vue';

import { nodeMeta } from '../nodes';

/** status 分类兜底图标。 */
const STATUS_ICONS: Record<NodeStatus, Component> = {
  ai: MagicStick,
  data: DataAnalysis,
  input: Position,
  logic: Share,
  output: Promotion,
  resource: Collection,
  tool: Tools,
};

/** 按 nodeType 精确映射的图标。未列出的走 status 兜底。 */
const NODE_TYPE_ICONS: Record<string, Component> = {
  'ai-chat-node': ChatDotRound,
  'application-node': Grid,
  'base-node': InfoFilled,
  'condition-node': Share,
  'data-source-local-node': Coin,
  'data-source-web-node': Link,
  'document-extract-node': Document,
  'document-split-node': Files,
  'form-node': Tickets,
  'function-lib-node': Cpu,
  'function-node': Cpu,
  'image-generate': Picture,
  'image-generate-node': Picture,
  'image-to-video-node': VideoCamera,
  'image-understand': Picture,
  'image-understand-node': Picture,
  'intent-node': Aim,
  'knowledge-base-node': Collection,
  'knowledge-write-node': Collection,
  'loop-body-node': RefreshRight,
  'loop-break-node': RefreshRight,
  'loop-continue-node': RefreshRight,
  'loop-node': RefreshRight,
  'loop-start-node': RefreshRight,
  'mcp-node': Connection,
  'parameter-extraction-node': Filter,
  'question-node': ChatLineRound,
  'reply-node': ChatDotRound,
  'reranker-node': Sort,
  'search-document-node': Document,
  'search-knowledge-node': Search,
  'speech-to-text-node': Microphone,
  'start-node': VideoPlay,
  'text-to-speech-node': Headset,
  'text-to-video-node': VideoCamera,
  'tool-base-node': Setting,
  'tool-lib-node': Tools,
  'tool-node': Tools,
  'tool-start-node': VideoPlay,
  'tool-workflow-lib-node': Operation,
  'variable-aggregation-node': Histogram,
  'variable-assign-node': Coin,
  'variable-splitting-node': DataAnalysis,
  'video-understand-node': VideoCamera,
};

/** 解析节点类型对应的图标组件，兜底走 status 分类，再兜底用 Guide。 */
export function nodeTypeIcon(nodeType?: string): Component {
  if (nodeType && NODE_TYPE_ICONS[nodeType]) {
    return NODE_TYPE_ICONS[nodeType] as Component;
  }
  const meta = nodeMeta(nodeType);
  return STATUS_ICONS[meta.status] ?? Guide;
}

/** 解析节点类型对应的中文名（复用 nodeMeta）。 */
export function nodeTypeName(nodeType?: string): string {
  return nodeMeta(nodeType).name;
}
