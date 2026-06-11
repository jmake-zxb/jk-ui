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

export interface ToolDebugResult {
  error: boolean;
  errorMessage?: string;
  finalOutput?: string;
  nodeSteps: ToolNodeStep[];
  runId?: number | string;
}

export interface UseToolDebugChatOptions {
  getChatRecord?: () => ChatRecord | undefined;
  getToolId: () => number | string;
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

function mergeNodeRuns(result: ToolDebugResult, runs: any[]) {
  const consumed = new Set<number>();
  for (const step of result.nodeSteps) {
    const matchIndex = runs.findIndex(
      (run, index) => !consumed.has(index) && run.nodeId === step.nodeType,
    );
    if (matchIndex === -1) continue;
    consumed.add(matchIndex);
    const run = runs[matchIndex];
    if (!run) continue;
    step.inputJson = run.inputJson ?? step.inputJson;
    step.promptTokens = run.promptTokens ?? step.promptTokens;
    step.completionTokens = run.completionTokens ?? step.completionTokens;
    step.runTime = run.runTime ?? step.runTime;
    if (run.errorMessage) step.errorMessage = run.errorMessage;
    if (!step.outputJson && run.outputJson) {
      applyNodeOutput(step, run.outputJson);
    }
  }
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
        }
        break;
      }
      case 'node_interrupt': {
        const step = findActiveStep(result.value, event.nodeId);
        if (step) {
          step.status = 'WARNING';
          step.expanded = true;
          applyNodeOutput(step, event.payload);
        }
        break;
      }
      case 'node_start': {
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
      const runs = Array.isArray(data) ? data : (data?.records ?? []);
      if (runs.length > 0) mergeNodeRuns(result.value, runs);
    } catch {
      // 补数据失败不影响已展示的 SSE 态。
    }
  }

  /**
   * 共享 SSE 流核心：发起 POST、逐行解析事件、收尾补数据。
   * debug 与 resume 复用同一处理循环，区别仅在 URL / body / 是否 reset。
   */
  async function streamSse(path: string, body: Record<string, any>) {
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

  async function debug(inputParams: Record<string, any>) {
    if (running.value) return;

    reset();
    const chatRecord = options.getChatRecord?.();
    if (chatRecord) {
      resetDebugChatRecord(chatRecord, JSON.stringify(inputParams, null, 2));
      bindChatManagement(chatRecord, 50, running);
    }
    await streamSse(debugToolWorkflowStream(options.getToolId()), inputParams);
  }

  /**
   * 恢复表单中断的工具工作流运行。
   *
   * 与 debug 不同：不 reset nodeSteps（续跑表单节点之后的节点），
   * 复用当前 runId 与同一 chatRecord（在原对话上追加），
   * 仅向后端提交 formDataJson。
   */
  async function resume(runId: number | string, formDataJson: string) {
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
    await streamSse(resumeToolWorkflowStream(options.getToolId(), runId), {
      formDataJson,
    });
  }

  return { debug, reset, result, resume, running, stop };
}
