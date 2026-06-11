/**
 * 工作流调试对话面板 — 数据契约。
 *
 * 与后端 `workflow/debug/stream` SSE 事件、`listWorkflowNodeRuns` 持久化记录逐字对应。
 * 详见 .omo/plans/workflow-debug-maxkb-parity.md「数据契约」。
 */

/** SSE 事件名（来自 WorkflowExecutor.java）。 */
export type DebugSseEventName =
  | 'canceled'
  | 'done'
  | 'error'
  | 'node_chunk'
  | 'node_end'
  | 'node_interrupt'
  | 'node_reasoning_chunk'
  | 'node_start'
  | 'run_start';

/** 所有事件共享的 base 字段。error/canceled 只有 event/runId/message/isEnd。 */
export interface DebugSseEvent {
  applicationId?: number | string;
  /** node_chunk 携带的节点级文本（非逐 token）。 */
  content?: string;
  event: DebugSseEventName | string;
  isEnd?: boolean;
  /** error/canceled 携带的错误/取消文本。 */
  message?: string;
  nodeId?: null | string;
  nodeName?: null | string;
  nodeType?: null | string;
  /** node_end/node_interrupt/done 携带的 outputJson（JSON 字符串）。 */
  payload?: string;
  /** node_reasoning_chunk 携带的思考内容增量。 */
  reasoningContent?: string;
  runId?: number | string;
  versionId?: number | string;
}

/** AI 类节点 outputJson 内的知识来源条目。 */
export interface KnowledgeSource {
  content?: string;
  documentId?: number | string;
  id?: number | string;
  knowledgeId?: number | string;
  metadata?: Record<string, any>;
  paragraphId?: number | string;
  position?: number;
  score?: number;
  title?: string;
}

/** node_end payload 的解析结果（AI 类节点字段最全，其余节点字段按需出现）。 */
export interface NodeOutput {
  answer?: string;
  content?: string;
  history_message?: Array<Record<string, any>>;
  knowledgeContextUsed?: boolean;
  knowledgeSources?: KnowledgeSource[];
  modelId?: number | string;
  question?: string;
  reasoning_content?: string;
  [key: string]: any;
}

/** 持久化的节点运行记录（GET workflow/runs/{runId}/nodes 原始实体，无 VO 转换）。 */
export interface WorkflowNodeRunVO {
  completionTokens?: number;
  contextJson?: string;
  endTime?: string;
  errorMessage?: null | string;
  id: number | string;
  inputJson?: string;
  nodeId: string;
  nodeName?: string;
  nodeType: string;
  outputJson?: string;
  promptTokens?: number;
  runId: number | string;
  /** 毫秒。 */
  runTime?: number;
  runtimeNodeId?: string;
  startTime?: string;
  status?: 'CANCELED' | 'FAILED' | 'RUNNING' | 'SUCCESS' | string;
  upNodeIdList?: null | string;
}

/** 节点步骤前端状态（SSE 实时态 + 流结束后补齐的持久化态）。 */
export type NodeStepStatus = 'FAILED' | 'RUNNING' | 'SUCCESS' | 'WARNING';

/** 单个节点步骤的前端聚合态。 */
export interface NodeStep {
  /** node_chunk 累加的文本。 */
  content: string;
  contextJson?: string;
  errorMessage?: string;
  /** UI 折叠态（默认：RUNNING 展开，SUCCESS 折叠）。 */
  expanded: boolean;
  inputJson?: string;
  knowledgeSources?: KnowledgeSource[];
  nodeId: string;
  nodeName: string;
  nodeType: string;
  /** node_end payload 解析结果。 */
  output?: NodeOutput;
  /** 原始 outputJson 字符串（兜底面板展示）。 */
  outputJson?: string;
  promptTokens?: number;
  completionTokens?: number;
  reasoningContent?: string;
  /** 毫秒。 */
  runTime?: number;
  runtimeNodeId?: string;
  status: NodeStepStatus;
}

/** 调试对话中的一条消息。 */
export interface DebugChatMessage {
  /** 流结束后从 listWorkflowNodeRuns 合计。 */
  completionTokens?: number;
  /** run_start 捕获的 runId，流结束后补数据用。 */
  currentRunId?: number | string;
  error?: boolean;
  errorMessage?: string;
  finalAnswer?: string;
  id: number;
  nodeSteps: NodeStep[];
  problemText?: string;
  promptTokens?: number;
  role: 'assistant' | 'user';
  totalRunTime?: number;
  totalTokens?: number;
  /** 流结束且补数据完成。 */
  write_ed: boolean;
}
