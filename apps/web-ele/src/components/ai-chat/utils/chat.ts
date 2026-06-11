import type { Ref } from 'vue';

import type { ChatChunk, ChatRecord } from '../types/application';

import { ChatManagement } from '../types/application';

interface DebugSseLikeEvent {
  content?: null | string;
  event: string;
  isEnd?: boolean;
  message?: null | string;
  nodeId?: null | number | string;
  nodeName?: null | string;
  nodeType?: null | string;
  payload?: null | string;
  reasoningContent?: null | string;
  runId?: null | number | string;
}

interface ToolDebugResultLike {
  error?: boolean;
  errorMessage?: string;
  finalOutput?: string;
  nodeSteps?: Array<{
    completionTokens?: number;
    content?: string;
    errorMessage?: string;
    inputJson?: string;
    nodeName?: string;
    nodeType?: string;
    output?: Record<string, unknown>;
    outputJson?: string;
    promptTokens?: number;
    runTime?: number;
    status?: string;
  }>;
  runId?: number | string;
}

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeParseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
    if (value !== undefined && value !== null && typeof value !== 'object')
      return `${value}`;
  }
  return '';
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (
      typeof value === 'string' &&
      value.trim() &&
      Number.isFinite(Number(value))
    )
      return Number(value);
  }
  return undefined;
}

function objectValue(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value))
    return value as Record<string, unknown>;
  return {};
}

function normalizeMeta(value: unknown) {
  if (typeof value === 'string')
    return safeParseJson<Record<string, unknown>>(value, {});
  return objectValue(value);
}

function normalizeParagraph(item: unknown) {
  const source = objectValue(item);
  const meta = normalizeMeta(
    source.meta ?? source.metadata ?? source.meta_json,
  );
  const title = firstString(source.title, meta.title, source.name, meta.name);
  const documentName = firstString(
    source.document_name,
    source.documentName,
    meta.document_name,
    meta.documentName,
    meta.source_file_name,
    meta.sourceFileName,
    title,
    '知识段落',
  );
  return {
    ...source,
    content: firstString(source.content, source.text, source.page_content),
    document_id: source.document_id ?? source.documentId,
    document_name: documentName,
    knowledge_id: source.knowledge_id ?? source.knowledgeId,
    knowledge_name: firstString(
      source.knowledge_name,
      source.knowledgeName,
      meta.knowledge_name,
      '知识库',
    ),
    knowledge_type:
      source.knowledge_type ?? source.knowledgeType ?? meta.knowledge_type,
    meta: {
      ...meta,
      source_file_id:
        meta.source_file_id ?? meta.sourceFileId ?? source.source_file_id,
      source_url: meta.source_url ?? meta.sourceUrl ?? source.source_url,
    },
    paragraph_id: source.paragraph_id ?? source.paragraphId ?? source.id,
    similarity: firstNumber(source.similarity, source.score) ?? 0,
    title,
  };
}

function outputObject(payload?: null | string) {
  return safeParseJson<Record<string, unknown>>(payload, {});
}

function extractAnswer(output: Record<string, unknown>) {
  return firstString(
    output.answer,
    output.content,
    output.result,
    output.output,
  );
}

/**
 * 表单中断时取要渲染的文本：优先 result（含 {{form}} 占位渲染后的完整提示），
 * 但若 result 中缺少 <form_rander> 标签（自定义 form_content_format 未含 {{form}}），
 * 则补上 output.form 标签，保证 FormRander 一定渲染。
 */
function extractInterruptAnswer(output: Record<string, unknown>) {
  const base = extractAnswer(output);
  const formTag = firstString(output.form);
  if (formTag && !base.includes('<form_rander>')) {
    return base ? `${base}\n${formTag}` : formTag;
  }
  return base;
}

function extractParagraphList(output: Record<string, unknown>) {
  const candidates = [
    output.paragraph_list,
    output.paragraphList,
    output.knowledgeSources,
    output.knowledge_sources,
    output.documents,
    output.document_list,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate))
      return candidate.map((item) => normalizeParagraph(item));
  }
  return [];
}

export function createDebugChatRecord(problemText = ''): ChatRecord {
  const id = randomId();
  return {
    answer_text: '',
    answer_text_list: [[]],
    buffer: [],
    chat_id: '',
    create_time: new Date().toISOString(),
    execution_details: [],
    id,
    is_stop: false,
    paragraph_list: [],
    problem_text: problemText,
    record_id: id,
    run_time: 0,
    status: undefined,
    vote_status: '-1',
    write_ed: false,
  };
}

export function resetDebugChatRecord(chat: ChatRecord, problemText = '') {
  const next = createDebugChatRecord(problemText);
  Object.assign(chat, next);
}

export function getWrite(
  chat: ChatRecord,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  stream: boolean,
) {
  let tempResult = '';

  const writeStream = async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        ChatManagement.close(chat.id);
        return;
      }

      tempResult += new TextDecoder('utf-8').decode(value, { stream: true });
      const split = tempResult.match(/data:.*?\}\s*(?:\r?\n){2}/g);
      if (!split) continue;

      const consumed = split.join('');
      tempResult = tempResult.replace(consumed, '');
      for (const item of split) {
        const chunk = safeParseJson<ChatChunk>(
          item.replace(/^data:/, '').trim(),
          {},
        );
        chat.chat_id = chunk.chat_id || chat.chat_id;
        chat.record_id = chunk.chat_record_id || chat.record_id;
        if (!chunk.is_end) ChatManagement.appendChunk(chat.id, chunk);
        if (chunk.is_end) return;
      }
    }
  };

  const writeJson = async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        const resultBlock = safeParseJson<Record<string, unknown>>(
          tempResult,
          {},
        );
        if (resultBlock.code === 500) throw resultBlock.message;
        const content = firstString(
          resultBlock.content,
          resultBlock.answer,
          resultBlock.data,
        );
        if (content) ChatManagement.append(chat.id, content);
        ChatManagement.close(chat.id);
        return;
      }
      if (value) tempResult += new TextDecoder('utf-8').decode(value);
    }
  };

  return stream ? writeStream : writeJson;
}

function toChunk(
  chat: ChatRecord,
  event: DebugSseLikeEvent,
  content: string,
  nodeIsEnd = false,
): ChatChunk {
  const nodeId = firstString(event.nodeId, event.nodeType, 'workflow');
  return {
    chat_id: chat.chat_id,
    chat_record_id: chat.record_id,
    content,
    is_end: false,
    node_id: nodeId,
    node_is_end: nodeIsEnd,
    node_name: firstString(event.nodeName, event.nodeType, '工作流节点'),
    node_type: firstString(event.nodeType, 'workflow'),
    real_node_id: nodeId,
    reasoning_content: event.reasoningContent || '',
    runtime_node_id: nodeId,
    up_node_id: '',
    view_type: 'single_view',
  };
}

export function applyDebugEventToChat(
  chat: ChatRecord,
  event: DebugSseLikeEvent,
) {
  const normalizedEvent = event.event;
  if (event.runId !== undefined && event.runId !== null)
    chat.chat_id = `${event.runId}`;

  if (normalizedEvent === 'node_start' || normalizedEvent === 'run_start') {
    chat.currentChunk = toChunk(chat, event, '', false);
    return;
  }

  if (normalizedEvent === 'chunk' || normalizedEvent === 'node_chunk') {
    if (event.content)
      ChatManagement.appendChunk(
        chat.id,
        toChunk(chat, event, event.content, false),
      );
    return;
  }

  if (
    normalizedEvent === 'reasoning_chunk' ||
    normalizedEvent === 'node_reasoning_chunk'
  ) {
    if (event.reasoningContent || event.content) {
      ChatManagement.appendChunk(chat.id, toChunk(chat, event, '', false));
      ChatManagement.appendChunk(chat.id, {
        ...toChunk(chat, event, '', false),
        reasoning_content: event.reasoningContent || event.content || '',
      });
    }
    return;
  }

  if (normalizedEvent === 'interrupt' || normalizedEvent === 'node_interrupt') {
    const output = outputObject(event.payload);
    const answer = extractInterruptAnswer(output);
    if (answer && !chat.answer_text.includes(answer)) {
      ChatManagement.appendChunk(chat.id, toChunk(chat, event, answer, true));
    } else {
      ChatManagement.appendChunk(chat.id, toChunk(chat, event, '', true));
    }
    return;
  }

  if (normalizedEvent === 'end' || normalizedEvent === 'node_end') {
    const output = outputObject(event.payload);
    const answer = extractAnswer(output);
    if (answer && !chat.answer_text.includes(answer)) {
      ChatManagement.appendChunk(chat.id, toChunk(chat, event, answer, true));
    } else {
      ChatManagement.appendChunk(chat.id, toChunk(chat, event, '', true));
    }
    return;
  }

  if (normalizedEvent === 'done') {
    const output = outputObject(event.payload);
    const answer = extractAnswer(output);
    if (answer && !chat.answer_text.trim())
      ChatManagement.append(chat.id, answer);
    chat.paragraph_list = extractParagraphList(output);
    ChatManagement.close(chat.id);
    return;
  }

  if (normalizedEvent === 'error' || normalizedEvent === 'canceled') {
    chat.status = 500;
    ChatManagement.append(chat.id, event.message || '调试执行失败');
    ChatManagement.close(chat.id);
  }
}

export function hydrateChatRecordFromDebugResult(
  chat: ChatRecord,
  result: ToolDebugResultLike,
) {
  const steps = result.nodeSteps ?? [];
  const finalOutput = outputObject(result.finalOutput);
  const finalAnswer = extractAnswer(finalOutput);
  const answerFromStep = [...steps]
    .toReversed()
    .map((step) => extractAnswer(step.output ?? outputObject(step.outputJson)))
    .find((answer) => answer.trim().length > 0);

  if (!chat.answer_text.trim()) {
    const fallback = finalAnswer || answerFromStep || result.errorMessage || '';
    if (fallback) ChatManagement.append(chat.id, fallback);
  }

  const finalParagraphs = extractParagraphList(finalOutput);
  const stepParagraphs = steps.flatMap((step) =>
    extractParagraphList(step.output ?? outputObject(step.outputJson)),
  );
  chat.paragraph_list =
    finalParagraphs.length > 0 ? finalParagraphs : stepParagraphs;
  chat.execution_details = steps.map((step, index) => ({
    answer_tokens: step.completionTokens ?? 0,
    content: step.content,
    err_message: step.errorMessage,
    index,
    input: step.inputJson,
    message_tokens: step.promptTokens ?? 0,
    node_name: step.nodeName,
    run_time: typeof step.runTime === 'number' ? step.runTime / 1000 : 0,
    status: step.status === 'FAILED' ? 500 : 200,
    step_type: step.nodeType,
    type: step.nodeType,
  }));
  chat.message_tokens = steps.reduce(
    (sum, step) => sum + (step.promptTokens ?? 0),
    0,
  );
  chat.answer_tokens = steps.reduce(
    (sum, step) => sum + (step.completionTokens ?? 0),
    0,
  );
  chat.run_time =
    steps.reduce((sum, step) => sum + (step.runTime ?? 0), 0) / 1000;
  chat.status = result.error ? 500 : chat.status;
  if (result.runId !== undefined) chat.chat_id = `${result.runId}`;
  ChatManagement.close(chat.id);
}

export function bindChatManagement(
  chat: ChatRecord,
  ms: number,
  loading?: Ref<boolean>,
) {
  ChatManagement.addChatRecord(chat, ms, loading);
  ChatManagement.write(chat.id);
}
