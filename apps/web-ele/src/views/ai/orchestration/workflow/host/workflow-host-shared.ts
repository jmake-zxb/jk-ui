import type { DebugSseEvent } from './workflow-debug/types';

import { onBeforeUnmount, ref, watch } from 'vue';

import { ElMessage } from 'element-plus';

import { prettyJson, safeParseJson } from '../../utils';

export type DebugRunEvent = {
  event: string;
  nodeName?: string;
  nodeType?: string;
  raw: string;
  status: 'FAILED' | 'RUNNING' | 'STREAM' | 'SUCCESS' | 'WARNING';
  title: string;
};

export function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object') {
    const maybeMessage =
      (error as { message?: unknown; msg?: unknown }).msg ||
      (error as { message?: unknown; msg?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim())
      return maybeMessage;
  }
  return fallback;
}

export function showApiError(error: unknown, fallback: string) {
  const message = getApiErrorMessage(error, fallback);
  if (message.includes('不允许访问')) ElMessage.warning(message);
  else ElMessage.error(message);
}

export function debugEventStatus(event: string): DebugRunEvent['status'] {
  if (event === 'error' || event === 'canceled') return 'FAILED';
  if (event === 'node_start' || event === 'run_start') return 'RUNNING';
  if (event === 'node_chunk') return 'STREAM';
  if (event === 'node_interrupt') return 'WARNING';
  return 'SUCCESS';
}

export function parseDebugChunk(chunk: string): DebugRunEvent[] {
  return chunk
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const raw = line.startsWith('data:') ? line.slice(5).trim() : line;
      const data = safeParseJson(raw, undefined);
      if (!data)
        return {
          event: 'raw',
          raw,
          status: 'STREAM' as const,
          title: raw.slice(0, 80) || 'stream',
        };
      const event = data.event || data.type || 'event';
      const status = debugEventStatus(event);
      return {
        event,
        nodeName: data.nodeName,
        nodeType: data.nodeType,
        raw,
        status,
        title: data.message || data.content || data.payload || event,
      };
    });
}

/**
 * 解析单行 SSE（保留 runId/content/payload/message/isEnd），供 useDebugChat 消费。
 * 与旧 parseDebugChunk 不同：不丢字段、按行返回 DebugSseEvent | null。
 */
export function parseDebugSseLine(line: string): DebugSseEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const raw = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
  if (!raw) return null;
  const data = safeParseJson(raw, undefined);
  if (!isRecord(data)) return null;
  const event = (data.event || data.type) as string | undefined;
  if (!event) return null;
  return {
    applicationId: data.applicationId,
    content: typeof data.content === 'string' ? data.content : undefined,
    event,
    isEnd: data.isEnd === true,
    message: typeof data.message === 'string' ? data.message : undefined,
    nodeId: data.nodeId ?? undefined,
    nodeName: data.nodeName ?? undefined,
    nodeType: data.nodeType ?? undefined,
    payload: typeof data.payload === 'string' ? data.payload : undefined,
    reasoningContent:
      typeof data.reasoningContent === 'string'
        ? data.reasoningContent
        : undefined,
    runId: data.runId,
    versionId: data.versionId,
  };
}

export function debugResultTitle(result: unknown) {
  if (isRecord(result)) {
    const value =
      result.message || result.output || result.result || result.data;
    if (value === undefined || value === null) return '工具调试完成';
    return typeof value === 'string'
      ? value
      : prettyJson(value, '工具调试完成');
  }
  return result === undefined || result === null ? '工具调试完成' : `${result}`;
}

/**
 * Owns the auto-save toggle persisted in localStorage and the interval timer.
 * The host passes its own save callback so the generic timer stays type-agnostic.
 */
export function useAutoSave(save: () => Promise<void> | void) {
  const autoSaveEnabled = ref(
    localStorage.getItem('jkWorkflowAutoSave') === 'true',
  );
  const lastSavedAt = ref('');
  let autoSaveTimer: number | undefined;

  function startAutoSave() {
    if (autoSaveTimer) window.clearInterval(autoSaveTimer);
    if (!autoSaveEnabled.value) return;
    autoSaveTimer = window.setInterval(() => void save(), 60_000);
  }

  function markSaved() {
    lastSavedAt.value = new Date().toLocaleTimeString();
  }

  watch(autoSaveEnabled, (enabled) => {
    localStorage.setItem('jkWorkflowAutoSave', `${enabled}`);
    startAutoSave();
  });

  onBeforeUnmount(() => {
    if (autoSaveTimer) window.clearInterval(autoSaveTimer);
  });

  return { autoSaveEnabled, lastSavedAt, markSaved, startAutoSave };
}

/**
 * Holds debug stream rows + raw chunks. Both hosts append through the same
 * helpers so the chrome can render a uniform event list.
 */
export function useDebugLog() {
  const debugEvents = ref<string[]>([]);
  const debugRows = ref<DebugRunEvent[]>([]);

  function resetDebugLog() {
    debugEvents.value = [];
    debugRows.value = [];
  }

  function pushRawChunk(chunk: string) {
    debugEvents.value.push(chunk);
    debugRows.value.push(...parseDebugChunk(chunk));
  }

  function pushResultRow(raw: string, row: DebugRunEvent) {
    debugEvents.value.push(raw);
    debugRows.value.push(row);
  }

  return {
    debugEvents,
    debugRows,
    pushRawChunk,
    pushResultRow,
    resetDebugLog,
  };
}
