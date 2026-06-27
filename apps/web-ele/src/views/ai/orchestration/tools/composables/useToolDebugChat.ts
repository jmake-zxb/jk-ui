/**
 * 工具工作流调试 composable（SSE 流式）。
 *
 * 调用 `/ai/api/tools/{id}/workflow/debug/stream`，解析 SSE 事件，
 * 流结束后调用 `listToolRunNodes` 补齐完整数据。
 */
import type { ToolNodeStep } from '../component/ExecutionDetailCard.vue';

import type { ChatRecord } from '#/components/ai-chat/types/application';

import { ref } from 'vue';

import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import {
  debugToolWorkflowStream,
  listToolRunNodes,
  resumeToolWorkflowStream,
} from '#/api/ai/tool-workflow';
import { ChatManagement } from '#/components/ai-chat/types/application';
import {
  applyDebugEventToChat,
  bindChatManagement,
  hydrateChatRecordFromDebugResult,
  resetDebugChatRecord,
} from '#/components/ai-chat/utils/chat';
import { adaptationUrl } from '#/utils/other';

import { safeParseJson } from '../../utils';
import { parseDebugSseLine } from '../../workflow/host/workflow-host-shared';

type JsonRecord = Record<string, unknown>;

type NodeRunRecord = JsonRecord & {
  completion_tokens?: unknown;
  completionTokens?: unknown;
  error_message?: unknown;
  errorMessage?: unknown;
  input_json?: unknown;
  inputJson?: unknown;
  node_id?: unknown;
  nodeId?: unknown;
  output_json?: unknown;
  outputJson?: unknown;
  prompt_tokens?: unknown;
  promptTokens?: unknown;
  run_time?: unknown;
  runTime?: unknown;
  runtime_node_id?: unknown;
  runtimeNodeId?: unknown;
};

export interface ToolDebugResult {
  chatRecordId?: number | string;
  error: boolean;
  errorMessage?: string;
  finalOutput?: string;
  nodeSteps: ToolNodeStep[];
  runId?: number | string;
}

export interface UseToolDebugChatOptions {
  getChatRecord?: () => ChatRecord | undefined;
  getToolId: () => number | string;
  onNodeStatus?: (
    nodeId: string,
    status: ToolNodeStep['status'] | undefined,
  ) => void;
}

function nodeStepFromStart(
  nodeId: string,
  nodeType: string,
  nodeName: string,
): ToolNodeStep {
  return {
    content: '',
    expanded: true,
    nodeId,
    nodeName,
    nodeType,
    status: 'RUNNING',
  };
}

function findActiveStep(
  result: ToolDebugResult,
  nodeId?: null | string,
): ToolNodeStep | undefined {
  if (!nodeId) {
    return [...result.nodeSteps]
      .toReversed()
      .find((step) => step.status === 'RUNNING');
  }
  return [...result.nodeSteps]
    .toReversed()
    .find((step) => step.status === 'RUNNING' && step.nodeId === nodeId);
}

function normalizedEventName(event: string) {
  if (event === 'chunk') return 'node_chunk';
  if (event === 'end') return 'node_end';
  if (event === 'interrupt') return 'node_interrupt';
  if (event === 'reasoning_chunk') return 'node_reasoning_chunk';
  return event;
}

function applyNodeOutput(step: ToolNodeStep, payload?: string) {
  if (!payload) return;
  step.outputJson = payload;
  const output = safeParseJson(payload, undefined);
  if (!output || typeof output !== 'object') return;
  step.output = output;
  let answer = '';
  if (typeof output.answer === 'string') {
    answer = output.answer;
  } else if (typeof output.content === 'string') {
    answer = output.content;
  }
  if (answer && !step.content) step.content = answer;
}

function notifyNodeStatus(
  options: UseToolDebugChatOptions,
  nodeId: unknown,
  status: ToolNodeStep['status'] | undefined,
) {
  const id = idText(nodeId);
  if (id) options.onNodeStatus?.(id, status);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nodeRunsFrom(data: unknown): NodeRunRecord[] {
  let rows: unknown[] = [];
  if (Array.isArray(data)) {
    rows = data;
  } else if (isRecord(data) && Array.isArray(data.records)) {
    rows = data.records;
  } else if (isRecord(data) && Array.isArray(data.data)) {
    rows = data.data;
  }
  return rows.filter((item) => isRecord(item));
}

function idText(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const text = `${value}`.trim();
  return text || undefined;
}

function textPayload(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return `${value}`;
  if (isRecord(value) || Array.isArray(value)) {
    return JSON.stringify(value, null, 2);
  }
  return undefined;
}

function numericPayload(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function runMatchesStep(run: NodeRunRecord, step: ToolNodeStep) {
  const stepId = idText(step.nodeId);
  if (!stepId) return false;
  const runIds = [
    idText(run.nodeId ?? run.node_id),
    idText(run.runtimeNodeId ?? run.runtime_node_id),
  ];
  return runIds.includes(stepId);
}

function mergeNodeRuns(result: ToolDebugResult, runs: NodeRunRecord[]) {
  const consumed = new Set<number>();
  for (const step of result.nodeSteps) {
    const matchIndex = runs.findIndex(
      (run, index) => !consumed.has(index) && runMatchesStep(run, step),
    );
    if (matchIndex === -1) continue;
    consumed.add(matchIndex);
    const run = runs[matchIndex];
    if (!run) continue;
    step.inputJson =
      textPayload(run.inputJson ?? run.input_json) ?? step.inputJson;
    step.promptTokens =
      numericPayload(run.promptTokens ?? run.prompt_tokens) ??
      step.promptTokens;
    step.completionTokens =
      numericPayload(run.completionTokens ?? run.completion_tokens) ??
      step.completionTokens;
    step.runTime = numericPayload(run.runTime ?? run.run_time) ?? step.runTime;
    const errorMessage = textPayload(run.errorMessage ?? run.error_message);
    if (errorMessage) step.errorMessage = errorMessage;
    const outputJson = textPayload(run.outputJson ?? run.output_json);
    if (!step.outputJson && outputJson) {
      applyNodeOutput(step, outputJson);
    }
  }
}

function debugRequestBody(inputParams?: JsonRecord): JsonRecord {
  const inputJson = JSON.stringify(inputParams ?? {});
  return {
    inputJson,
    input_json: inputJson,
  };
}

export function useToolDebugChat(options: UseToolDebugChatOptions) {
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
  const accessStore = useAccessStore();

  const result = ref<ToolDebugResult>({
    error: false,
    nodeSteps: [],
  });
  const running = ref(false);
  let abortController: AbortController | undefined;

  function reset() {
    result.value = {
      error: false,
      nodeSteps: [],
    };
  }

  function stop() {
    const chatRecord = options.getChatRecord?.();
    if (chatRecord) ChatManagement.stop(chatRecord.id);
    abortController?.abort();
    abortController = undefined;
    running.value = false;
  }

  function handleEvent(line: string) {
    const event = parseDebugSseLine(line);
    if (!event) return;
    const chatRecord = options.getChatRecord?.();
    if (chatRecord) applyDebugEventToChat(chatRecord, event);
    const eventName = normalizedEventName(event.event);
    switch (eventName) {
      case 'canceled':
      case 'error': {
        result.value.error = true;
        result.value.errorMessage =
          event.message ||
          (event.event === 'canceled' ? '调试已取消' : '调试执行失败');
        break;
      }
      case 'done': {
        result.value.finalOutput = event.payload;
        // 保存 chatRecordId，用于表单提交时更新已有记录而非创建新记录
        if (event.chatRecordId !== undefined && event.chatRecordId !== null) {
          result.value.chatRecordId = event.chatRecordId;
        }
        break;
      }
      case 'node_chunk':
      case 'node_reasoning_chunk': {
        const step = findActiveStep(result.value, event.nodeId);
        if (step && event.content)
          step.content = `${step.content || ''}${event.content}`;
        if (step && event.reasoningContent) {
          step.output = {
            ...step.output,
            reasoning_content: `${step.output?.reasoning_content || ''}${event.reasoningContent}`,
          };
        }
        break;
      }
      case 'node_end': {
        const step = findActiveStep(result.value, event.nodeId);
        if (step) {
          step.status = 'SUCCESS';
          step.expanded = false;
          applyNodeOutput(step, event.payload);
          notifyNodeStatus(options, step.nodeId ?? event.nodeId, 'SUCCESS');
        }
        break;
      }
      case 'node_interrupt': {
        const step = findActiveStep(result.value, event.nodeId);
        if (step) {
          step.status = 'WARNING';
          step.expanded = true;
          applyNodeOutput(step, event.payload);
          notifyNodeStatus(options, step.nodeId ?? event.nodeId, 'WARNING');
        }
        break;
      }
      case 'node_start': {
        notifyNodeStatus(options, event.nodeId, 'RUNNING');
        result.value.nodeSteps.push(
          nodeStepFromStart(
            `${event.nodeId ?? ''}`,
            `${event.nodeType ?? ''}`,
            `${event.nodeName ?? event.nodeType ?? '节点'}`,
          ),
        );
        break;
      }
      case 'run_start': {
        result.value.runId = event.runId;
        break;
      }
      default: {
        break;
      }
    }
  }

  async function hydrateNodeRuns() {
    if (result.value.runId === undefined) return;
    try {
      const data = await listToolRunNodes(
        options.getToolId(),
        result.value.runId,
      );
      const runs = nodeRunsFrom(data);
      if (runs.length > 0) mergeNodeRuns(result.value, runs);
    } catch {
      // 补数据失败不影响已展示的 SSE 态。
    }
  }

  /**
   * 共享 SSE 流核心：发起 POST、逐行解析事件、收尾补数据。
   * debug 与 resume 复用同一处理循环，区别仅在 URL / body / 是否 reset。
   */
  async function streamSse(path: string, body: JsonRecord) {
    running.value = true;
    abortController = new AbortController();

    try {
      const response = await fetch(`${apiURL}${adaptationUrl(path)}`, {
        body: JSON.stringify(body),
        headers: {
          Authorization: accessStore.accessToken
            ? `Bearer ${accessStore.accessToken}`
            : '',
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: abortController.signal,
      });
      if (!response.body) {
        result.value.error = true;
        result.value.errorMessage = '调试流为空';
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        for (const line of lines) handleEvent(line);
      }
      if (buffer.trim()) handleEvent(buffer);
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') {
        result.value.error = true;
        result.value.errorMessage = '调试请求失败';
      }
    } finally {
      await hydrateNodeRuns();
      const chatRecord = options.getChatRecord?.();
      if (chatRecord)
        hydrateChatRecordFromDebugResult(chatRecord, result.value);
      running.value = false;
      abortController = undefined;
    }
  }

  async function debug(inputParams?: JsonRecord) {
    if (running.value) return;

    const submittedInput = inputParams ?? {};
    reset();
    const chatRecord = options.getChatRecord?.();
    if (chatRecord) {
      resetDebugChatRecord(chatRecord, JSON.stringify(submittedInput, null, 2));
      bindChatManagement(chatRecord, 50, running);
    }
    await streamSse(
      debugToolWorkflowStream(options.getToolId()),
      debugRequestBody(submittedInput),
    );
  }

  /**
   * 恢复表单中断的工具工作流运行。
   *
   * 与 debug 不同：不 reset nodeSteps（续跑表单节点之后的节点），
   * 复用当前 runId 与同一 chatRecord（在原对话上追加），
   * 向后端提交 formDataJson 与 formData。
   */
  async function resume(runId: number | string, formData: JsonRecord) {
    if (running.value) return;
    // 续跑前清除上一轮的中断态，避免误判为失败。
    result.value.error = false;
    result.value.errorMessage = undefined;
    const chatRecord = options.getChatRecord?.();
    if (chatRecord) {
      chatRecord.write_ed = false;
      chatRecord.is_stop = false;
      chatRecord.status = undefined;
      bindChatManagement(chatRecord, 50, running);
    }
    const formDataJson = JSON.stringify(formData);
    await streamSse(resumeToolWorkflowStream(options.getToolId(), runId), {
      chatRecordId: result.value.chatRecordId,
      formData,
      formDataJson,
    });
  }

  return { debug, reset, result, resume, running, stop };
}
