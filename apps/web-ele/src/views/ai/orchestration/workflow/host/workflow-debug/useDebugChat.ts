/**
 * 工作流调试对话 composable。
 *
 * 仅服务高级智能体（WORK_FLOW）的工作流调试，走 `workflow/debug/stream`（跑草稿、无会话）。
 * 不要与应用对话调试（chat/message/stream）混淆。
 *
 * 数据流见 .omo/plans/workflow-debug-maxkb-parity.md「实现总览」。
 */
import type {
  DebugChatMessage,
  NodeOutput,
  NodeStep,
  WorkflowNodeRunVO,
} from './types';

import { ref } from 'vue';

import { listWorkflowNodeRuns } from '#/api/ai/applications';
import { adaptationUrl } from '#/utils/other';

import { recordsOf, safeParseJson } from '../../../utils';
import { parseDebugSseLine } from '../workflow-host-shared';

export interface UseDebugChatOptions {
  /** SSE 请求基址（来自 useAppConfig 的 apiURL）。 */
  apiURL: string;
  /** 取当前 access token。 */
  getAccessToken: () => null | string | undefined;
  /** 取当前应用 id（可能随切换变化，用 getter）。 */
  getApplicationId: () => number | string;
  /** 发送前本地校验，返回 false 则中止。 */
  runLocalValidation?: (showMessage?: boolean) => boolean;
}

function nodeStepFromStart(
  nodeId: string,
  nodeType: string,
  nodeName: string,
): NodeStep {
  return {
    content: '',
    expanded: true,
    nodeId,
    nodeName,
    nodeType,
    status: 'RUNNING',
  };
}

/**
 * 在 message.nodeSteps 中找到指定 nodeId 的「当前活动步骤」。
 * 同一 nodeId 在 loop 内可能多次出现，取最后一个未完成（RUNNING）的。
 */
function findActiveStep(
  message: DebugChatMessage,
  nodeId?: null | string,
): NodeStep | undefined {
  if (!nodeId) {
    return [...message.nodeSteps]
      .toReversed()
      .find((step) => step.status === 'RUNNING');
  }
  return [...message.nodeSteps]
    .toReversed()
    .find((step) => step.nodeId === nodeId && step.status === 'RUNNING');
}

function applyNodeOutput(step: NodeStep, payload?: string) {
  if (!payload) return;
  step.outputJson = payload;
  const output = safeParseJson(payload, undefined) as NodeOutput | undefined;
  if (!output || typeof output !== 'object') return;
  step.output = output;
  if (typeof output.reasoning_content === 'string') {
    step.reasoningContent = output.reasoning_content;
  }
  if (Array.isArray(output.knowledgeSources)) {
    step.knowledgeSources = output.knowledgeSources;
  }
  let answer = '';
  if (typeof output.answer === 'string') {
    answer = output.answer;
  } else if (typeof output.content === 'string') {
    answer = output.content;
  }
  if (answer && !step.content) step.content = answer;
}

/**
 * 流结束后用持久化记录补齐 tokens / 耗时 / inputJson / contextJson。
 * merge key：nodeId + 出现顺序（同 nodeId 多次执行按顺序对齐）。
 */
function mergeNodeRuns(message: DebugChatMessage, runs: WorkflowNodeRunVO[]) {
  const consumed = new Set<number>();
  for (const step of message.nodeSteps) {
    const matchIndex = runs.findIndex(
      (run, index) => !consumed.has(index) && run.nodeId === step.nodeId,
    );
    if (matchIndex === -1) continue;
    consumed.add(matchIndex);
    const run = runs[matchIndex];
    if (!run) continue;
    step.runtimeNodeId = run.runtimeNodeId ?? step.runtimeNodeId;
    step.inputJson = run.inputJson ?? step.inputJson;
    step.contextJson = run.contextJson ?? step.contextJson;
    step.promptTokens = run.promptTokens ?? step.promptTokens;
    step.completionTokens = run.completionTokens ?? step.completionTokens;
    step.runTime = run.runTime ?? step.runTime;
    if (run.errorMessage) step.errorMessage = run.errorMessage;
    if (!step.outputJson && run.outputJson) {
      applyNodeOutput(step, run.outputJson);
    }
  }
  let totalPrompt = 0;
  let totalCompletion = 0;
  let totalRunTime = 0;
  for (const step of message.nodeSteps) {
    totalPrompt += step.promptTokens ?? 0;
    totalCompletion += step.completionTokens ?? 0;
    totalRunTime += step.runTime ?? 0;
  }
  message.promptTokens = totalPrompt;
  message.completionTokens = totalCompletion;
  message.totalTokens = totalPrompt + totalCompletion;
  message.totalRunTime = totalRunTime;
}

export function useDebugChat(options: UseDebugChatOptions) {
  const messages = ref<DebugChatMessage[]>([]);
  const sending = ref(false);
  let messageSeq = 0;
  let abortController: AbortController | undefined;

  function reset() {
    messages.value = [];
  }

  function stop() {
    abortController?.abort();
    abortController = undefined;
    sending.value = false;
  }

  function handleEvent(message: DebugChatMessage, line: string) {
    const event = parseDebugSseLine(line);
    if (!event) return;
    switch (event.event) {
      case 'canceled':
      case 'error': {
        message.error = true;
        message.errorMessage =
          event.message ||
          (event.event === 'canceled' ? '工作流已取消' : '工作流执行失败');
        break;
      }
      case 'done': {
        message.finalAnswer = event.payload;
        break;
      }
      case 'node_chunk': {
        const step = findActiveStep(message, event.nodeId);
        if (step && event.content) step.content += event.content;
        break;
      }
      case 'node_end': {
        const step = findActiveStep(message, event.nodeId);
        if (step) {
          step.status = 'SUCCESS';
          step.expanded = false;
          applyNodeOutput(step, event.payload);
        }
        break;
      }
      case 'node_interrupt': {
        const step = findActiveStep(message, event.nodeId);
        if (step) {
          step.status = 'WARNING';
          step.expanded = true;
          applyNodeOutput(step, event.payload);
        }
        break;
      }
      case 'node_start': {
        message.nodeSteps.push(
          nodeStepFromStart(
            `${event.nodeId ?? ''}`,
            `${event.nodeType ?? ''}`,
            `${event.nodeName ?? event.nodeType ?? '节点'}`,
          ),
        );
        break;
      }
      case 'run_start': {
        message.currentRunId = event.runId;
        break;
      }
      default: {
        // 其它事件（含未知 event）忽略。
        break;
      }
    }
  }

  async function hydrateNodeRuns(message: DebugChatMessage) {
    if (message.currentRunId === undefined) return;
    try {
      const data = await listWorkflowNodeRuns(
        options.getApplicationId(),
        message.currentRunId,
      );
      const runs = recordsOf<WorkflowNodeRunVO>(data);
      if (runs.length > 0) mergeNodeRuns(message, runs);
    } catch {
      // 补数据失败不影响已展示的 SSE 态。
    }
  }

  async function sendMessage(text: string, inputJson: string) {
    const trimmed = text.trim();
    if (!trimmed || sending.value) return;
    if (options.runLocalValidation && !options.runLocalValidation(true)) return;

    messages.value.push({
      id: (messageSeq += 1),
      nodeSteps: [],
      problemText: trimmed,
      role: 'user',
      write_ed: true,
    });
    const assistant: DebugChatMessage = {
      id: (messageSeq += 1),
      nodeSteps: [],
      role: 'assistant',
      write_ed: false,
    };
    messages.value.push(assistant);

    sending.value = true;
    abortController = new AbortController();
    const payload = safeParseJson(inputJson, {});
    try {
      const response = await fetch(
        `${options.apiURL}${adaptationUrl(
          `/ai/api/applications/${options.getApplicationId()}/workflow/debug/stream`,
        )}`,
        {
          body: JSON.stringify({
            inputJson: JSON.stringify(payload),
            message: trimmed,
          }),
          headers: {
            Authorization: options.getAccessToken()
              ? `Bearer ${options.getAccessToken()}`
              : '',
            'Content-Type': 'application/json',
          },
          method: 'POST',
          signal: abortController.signal,
        },
      );
      if (!response.body) {
        assistant.error = true;
        assistant.errorMessage = '调试流为空';
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
        for (const line of lines) handleEvent(assistant, line);
      }
      if (buffer.trim()) handleEvent(assistant, buffer);
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') {
        assistant.error = true;
        assistant.errorMessage = '调试请求失败';
      }
    } finally {
      await hydrateNodeRuns(assistant);
      assistant.write_ed = true;
      sending.value = false;
      abortController = undefined;
    }
  }

  return { messages, reset, sending, sendMessage, stop };
}
