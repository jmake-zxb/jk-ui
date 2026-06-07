import type { Component } from 'vue';

import { AppNode, AppNodeModel } from './common/app-node';
import AppEdge from './common/edge';
import LoopEdge from './common/loop-edge';
import { nodeTemplates } from './nodes';
import AiChatNode from './nodes/ai-chat-node';
import ApplicationNode from './nodes/application-node';
import BaseNode from './nodes/base-node';
import FallbackNode from './nodes/base-node/index.vue';
import ConditionNode from './nodes/condition-node';
import DataSourceLocalNode from './nodes/data-source-local-node';
import DataSourceWebNode from './nodes/data-source-web-node';
import DocumentExtractNode from './nodes/document-extract-node';
import DocumentSplitNode from './nodes/document-split-node';
import FormNode from './nodes/form-node';
import ImageGenerateNode from './nodes/image-generate-node';
import ImageToVideoNode from './nodes/image-to-video-node';
import ImageUnderstandNode from './nodes/image-understand-node';
import IntentClassifyNode from './nodes/intent-classify-node';
import KnowledgeBaseNode from './nodes/knowledge-base-node';
import KnowledgeWriteNode from './nodes/knowledge-write-node';
import LoopBodyNode from './nodes/loop-body-node';
import LoopBreakNode from './nodes/loop-break-node';
import LoopContinueNode from './nodes/loop-continue-node';
import LoopNode from './nodes/loop-node';
import LoopStartNode from './nodes/loop-start-node';
import McpNode from './nodes/mcp-node';
import ParameterExtractionNode from './nodes/parameter-extraction-node';
import QuestionNode from './nodes/question-node';
import ReplyNode from './nodes/reply-node';
import RerankerNode from './nodes/reranker-node';
import SearchDocumentNode from './nodes/search-document-node';
import SearchKnowledgeNode from './nodes/search-knowledge-node';
import SpeechToTextNode from './nodes/speech-to-text-node';
import StartNode from './nodes/start-node';
import TextToSpeechNode from './nodes/text-to-speech-node';
import TextToVideoNode from './nodes/text-to-video-node';
import ToolBaseNode from './nodes/tool-base-node';
import ToolLibNode from './nodes/tool-lib-node';
import ToolNode from './nodes/tool-node';
import ToolStartNode from './nodes/tool-start-node';
import ToolWorkflowLibNode from './nodes/tool-workflow-lib-node';
import VariableAggregationNode from './nodes/variable-aggregation-node';
import VariableAssignNode from './nodes/variable-assign-node';
import VariableSplittingNode from './nodes/variable-splitting-node';
import VideoUnderstandNode from './nodes/video-understand-node';

const seededNodes = [
  StartNode,
  QuestionNode,
  BaseNode,
  AiChatNode,
  IntentClassifyNode,
  ConditionNode,
  ReplyNode,
  LoopNode,
  LoopStartNode,
  SearchKnowledgeNode,
  KnowledgeBaseNode,
  RerankerNode,
  ToolNode,
  ToolBaseNode,
  ToolStartNode,
  McpNode,
  ApplicationNode,
  FormNode,
  VariableAssignNode,
  VariableAggregationNode,
  VariableSplittingNode,
  ParameterExtractionNode,
  LoopBodyNode,
  SearchDocumentNode,
  DocumentExtractNode,
  DocumentSplitNode,
  KnowledgeWriteNode,
  DataSourceLocalNode,
  DataSourceWebNode,
  ImageUnderstandNode,
  ImageGenerateNode,
  VideoUnderstandNode,
  SpeechToTextNode,
  TextToSpeechNode,
  TextToVideoNode,
  ImageToVideoNode,
  ToolLibNode,
  ToolWorkflowLibNode,
  LoopBreakNode,
  LoopContinueNode,
];

function createFallbackRegistration(type: string) {
  class FallbackNodeView extends AppNode {
    constructor(props: any) {
      super(props, FallbackNode as Component);
    }
  }

  return {
    model: AppNodeModel,
    type,
    view: FallbackNodeView,
  };
}

function registerWorkflowNodesInternal(
  lf: any,
  excludedTypes = new Set<string>(),
) {
  const registeredTypes = new Set<string>();

  lf.register?.(AppEdge);
  lf.register?.(LoopEdge);

  seededNodes.forEach((node) => {
    if (excludedTypes.has(node.type)) return;
    lf.register?.(node);
    registeredTypes.add(node.type);
  });

  nodeTemplates.forEach((template) => {
    if (excludedTypes.has(template.type)) return;
    if (registeredTypes.has(template.type)) return;
    lf.register?.(createFallbackRegistration(template.type));
    registeredTypes.add(template.type);
  });

  lf.setTheme?.({
    anchor: {
      fill: 'var(--el-bg-color)',
      r: 4,
      stroke: 'var(--el-color-primary)',
      strokeWidth: 2,
    },
    anchorHover: {
      fill: 'var(--el-color-primary-light-9)',
      r: 6,
      stroke: 'var(--el-color-primary)',
      strokeWidth: 2,
    },
    edgeText: {
      background: { fill: 'var(--el-bg-color)' },
      color: 'var(--el-text-color-secondary)',
      fontSize: 12,
    },
    bezier: { stroke: 'var(--el-border-color-darker)', strokeWidth: 1 },
    polyline: { stroke: 'var(--el-border-color-darker)', strokeWidth: 1 },
  });
}

export function registerWorkflowNodes(lf: any) {
  registerWorkflowNodesInternal(lf);
}

export function registerLoopWorkflowNodes(lf: any) {
  registerWorkflowNodesInternal(lf, new Set(['loop-body-node', 'loop-node']));
}
