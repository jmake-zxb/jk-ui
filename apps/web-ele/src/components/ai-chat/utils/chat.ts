import type { Ref } from 'vue';

import type {
  ChatAnswerBlock,
  ChatChunk,
  ChatRecord,
} from '../types/application';

import { ChatManagement } from '../types/application';

interface DebugSseLikeEvent {
  answer_tokens?: number;
  chatId?: null | number | string;
  chatRecordId?: null | number | string;
  childNode?: unknown;
  content?: null | string;
  event: string;
  isEnd?: boolean;
  message?: null | string;
  message_tokens?: number;
  nodeId?: null | number | string;
  nodeIsEnd?: boolean;
  nodeName?: null | string;
  nodeType?: null | string;
  payload?: null | Record<string, unknown> | string;
  reasoningContent?: null | string;
  realNodeId?: null | number | string;
  runId?: null | number | string;
  run_time?: number;
  runtimeNodeId?: null | number | string;
  viewType?: null | string;
}

const workflowEventNames = new Set([
  'canceled',
  'chunk',
  'done',
  'end',
  'error',
  'interrupt',
  'node_chunk',
  'node_end',
  'node_interrupt',
  'node_reasoning_chunk',
  'node_start',
  'reasoning_chunk',
  'run_start',
]);

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

function outputObject(payload?: null | Record<string, unknown> | string) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload;
  }
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

function debugEventFromData(data: Record<string, unknown>): DebugSseLikeEvent {
  let reasoningContent: null | string;
  if (typeof data.reasoningContent === 'string') {
    reasoningContent = data.reasoningContent;
  } else if (typeof data.reasoning_content === 'string') {
    reasoningContent = data.reasoning_content;
  } else {
    reasoningContent = undefined;
  }
  return {
    answer_tokens:
      typeof data.answer_tokens === 'number' ? data.answer_tokens : undefined,
    chatId: (data.chatId ?? data.chat_id) as null | number | string | undefined,
    chatRecordId: (data.chatRecordId ?? data.chat_record_id) as
      | null
      | number
      | string
      | undefined,
    childNode: data.childNode ?? data.child_node,
    content: typeof data.content === 'string' ? data.content : undefined,
    event: (data.event || data.type || '') as string,
    isEnd: data.isEnd === true,
    message: typeof data.message === 'string' ? data.message : undefined,
    message_tokens:
      typeof data.message_tokens === 'number' ? data.message_tokens : undefined,
    nodeId: (data.nodeId ?? data.node_id) as null | number | string | undefined,
    nodeIsEnd: data.nodeIsEnd === true || data.node_is_end === true,
    nodeName: (data.nodeName ?? data.node_name) as null | string | undefined,
    nodeType: (data.nodeType ?? data.node_type) as null | string | undefined,
    payload:
      typeof data.payload === 'string' ||
      (data.payload &&
        typeof data.payload === 'object' &&
        !Array.isArray(data.payload))
        ? (data.payload as Record<string, unknown> | string)
        : undefined,
    reasoningContent,
    realNodeId: (data.realNodeId ?? data.real_node_id) as
      | null
      | number
      | string
      | undefined,
    runId: (data.runId ?? data.run_id) as null | number | string | undefined,
    run_time: typeof data.run_time === 'number' ? data.run_time : undefined,
    runtimeNodeId: (data.runtimeNodeId ?? data.runtime_node_id) as
      | null
      | number
      | string
      | undefined,
    viewType: (data.viewType ?? data.view_type) as null | string | undefined,
  };
}

function isWorkflowEventData(data: Record<string, unknown>) {
  const event = firstString(data.event, data.type);
  return workflowEventNames.has(event);
}

function extractCompleteJsonObjects(value: string) {
  const items: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let lastConsumed = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (start === -1) {
      if (char === '{') {
        start = index;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    switch (char) {
      case '"': {
        inString = true;

        break;
      }
      case '{': {
        depth += 1;

        break;
      }
      case '}': {
        depth -= 1;
        if (depth === 0) {
          items.push(value.slice(start, index + 1));
          lastConsumed = index + 1;
          start = -1;
        }

        break;
      }
      // No default
    }
  }

  return {
    items,
    rest: start === -1 ? value.slice(lastConsumed) : value.slice(start),
  };
}

function applyDebugRawEvent(chat: ChatRecord, value: string) {
  const raw = value.trim().startsWith('data:')
    ? value.trim().slice(5).trim()
    : value.trim();
  if (!raw || raw === '[DONE]') return;

  const extracted = extractCompleteJsonObjects(raw);
  const candidates = extracted.items.length > 0 ? extracted.items : [raw];
  for (const candidate of candidates) {
    const data = safeParseJson<Record<string, unknown>>(candidate, {});
    if (Object.keys(data).length === 0) continue;
    applyDebugEventToChat(chat, debugEventFromData(data));
  }
}

function drainDebugEvents(chat: ChatRecord, buffer: string, flush = false) {
  const lines = buffer.split(/\r?\n/);
  let rest = flush ? '' : lines.pop() || '';

  for (const line of lines) {
    applyDebugRawEvent(chat, line);
  }

  const extracted = extractCompleteJsonObjects(rest);
  for (const item of extracted.items) {
    applyDebugRawEvent(chat, item);
  }
  rest = extracted.rest;

  if (flush && rest.trim()) {
    applyDebugRawEvent(chat, rest);
    return '';
  }
  return rest;
}

/**
 * Hydrate a ChatRecord from a backend history VO (snake_case fields).
 * The backend ChatRecordHistoryVO returns: record_id, chat_id, problem_text,
 * answer_text, answer_text_list, execution_details, paragraph_list,
 * message_tokens, answer_tokens, run_time (ms), vote_status, vote_reason,
 * create_time.
 *
 * Unlike live-streamed records, history records have `write_ed: true` from the
 * start because the answer is already complete.
 */
export function hydrateChatRecordFromHistory(
  vo: Record<string, unknown>,
): ChatRecord {
  const recordId = String(vo.record_id ?? vo.id ?? '');
  const chatId = String(vo.chat_id ?? vo.chatId ?? '');

  // answer_text_list: backend already builds ChatAnswerBlock[][] shape
  const rawAnswerTextList = vo.answer_text_list ?? vo.answerTextList;
  const answerTextList: ChatAnswerBlock[][] = Array.isArray(rawAnswerTextList)
    ? (rawAnswerTextList as ChatAnswerBlock[][])
    : [[]];

  // execution_details: backend already has correct per-node detail shape
  const rawExecutionDetails = vo.execution_details ?? vo.executionDetails;
  const executionDetails: unknown[] = Array.isArray(rawExecutionDetails)
    ? rawExecutionDetails
    : [];

  // paragraph_list: normalize each entry for consistent shape
  const rawParagraphList = vo.paragraph_list ?? vo.paragraphList;
  const paragraphList: unknown[] = Array.isArray(rawParagraphList)
    ? rawParagraphList.map((item) => normalizeParagraph(item))
    : [];

  // run_time: camelCase (runTime) is raw ms, snake_case (run_time) is already seconds
  let rawRunTime: number;
  if (typeof vo.runTime === 'number') {
    rawRunTime = vo.runTime / 1000;
  } else if (typeof vo.run_time === 'number') {
    rawRunTime = vo.run_time;
  } else {
    rawRunTime = 0;
  }

  // vote_status
  const voteStatus = vo.vote_status ?? vo.voteStatus;

  // create_time
  const createTime = vo.create_time ?? vo.createTime;

  // message_tokens / answer_tokens
  let messageTokens: number;
  if (typeof vo.message_tokens === 'number') {
    messageTokens = vo.message_tokens;
  } else if (typeof vo.messageTokens === 'number') {
    messageTokens = vo.messageTokens;
  } else {
    messageTokens = 0;
  }
  let answerTokens: number;
  if (typeof vo.answer_tokens === 'number') {
    answerTokens = vo.answer_tokens;
  } else if (typeof vo.answerTokens === 'number') {
    answerTokens = vo.answerTokens;
  } else {
    answerTokens = 0;
  }

  // Detect upload_meta from start-node in execution_details
  let uploadMeta: ChatRecord['upload_meta'] | undefined;
  const startNodeItem = executionDetails.find((item) => {
    const entry = objectValue(item);
    return entry.type === 'start-node';
  });
  if (startNodeItem) {
    const entry = objectValue(startNodeItem);
    const imageList = entry.image_list ?? entry.imageList;
    const documentList = entry.document_list ?? entry.documentList;
    const audioList = entry.audio_list ?? entry.audioList;
    const videoList = entry.video_list ?? entry.videoList;
    const otherList = entry.other_list ?? entry.otherList;
    const hasUpload =
      (Array.isArray(imageList) && imageList.length > 0) ||
      (Array.isArray(documentList) && documentList.length > 0) ||
      (Array.isArray(audioList) && audioList.length > 0) ||
      (Array.isArray(videoList) && videoList.length > 0) ||
      (Array.isArray(otherList) && otherList.length > 0);
    if (hasUpload) {
      uploadMeta = {
        audio_list: Array.isArray(audioList) ? audioList : [],
        document_list: Array.isArray(documentList) ? documentList : [],
        image_list: Array.isArray(imageList) ? imageList : [],
        other_list: Array.isArray(otherList) ? otherList : [],
        video_list: Array.isArray(videoList) ? videoList : [],
      };
    }
  }

  // 向后兼容：从执行详情中重建 form_rander 标签（处理旧记录）
  let answerText: string;
  if (typeof vo.answer_text === 'string') {
    answerText = vo.answer_text;
  } else if (typeof vo.answerText === 'string') {
    answerText = vo.answerText;
  } else {
    answerText = '';
  }

  if (answerText.includes('<form_rander>')) {
    // 检查 form_rander 标签是否已有 form_data
    const formRanderMatch = answerText.match(
      /<form_rander>(.*?)<\/form_rander>/s,
    );
    if (formRanderMatch) {
      try {
        const existingData = JSON.parse(formRanderMatch[1]);
        // 如果已有 form_data 和 is_submit，不需要更新
        if (!existingData.form_data || !existingData.is_submit) {
          // 从执行详情中查找 form-node
          const formNodeItem = executionDetails.find((item) => {
            const entry = objectValue(item);
            return entry.type === 'form-node';
          });
          if (formNodeItem) {
            const entry = objectValue(formNodeItem);
            const formData = entry.form_data;
            const isSubmit = entry.is_submit;
            // 如果表单已提交，更新 form_rander 标签
            if (
              isSubmit &&
              formData &&
              typeof formData === 'object' &&
              Object.keys(formData).length > 0
            ) {
              const updatedData = {
                ...existingData,
                form_data: formData,
                is_submit: true,
              };
              const newFormRanderTag = `<form_rander>${JSON.stringify(updatedData)}</form_rander>`;
              answerText = answerText.replace(
                formRanderMatch[0],
                newFormRanderTag,
              );
              // 同时更新 answer_text_list
              for (const row of answerTextList) {
                for (const block of row) {
                  if (
                    block.content &&
                    block.content.includes(formRanderMatch[0])
                  ) {
                    block.content = block.content.replace(
                      formRanderMatch[0],
                      newFormRanderTag,
                    );
                  }
                }
              }
            }
          }
        }
      } catch {
        // JSON 解析错误，跳过
      }
    }
  }

  let problemText: string;
  if (typeof vo.problem_text === 'string') {
    problemText = vo.problem_text;
  } else if (typeof vo.question === 'string') {
    problemText = vo.question;
  } else {
    problemText = '';
  }

  const record: ChatRecord = {
    answer_text: answerText,
    answer_text_list: answerTextList,
    answer_tokens: answerTokens,
    buffer: [],
    chat_id: chatId,
    create_time: typeof createTime === 'string' ? createTime : undefined,
    execution_details: executionDetails,
    id: recordId,
    is_stop: false,
    message_tokens: messageTokens,
    paragraph_list: paragraphList,
    problem_text: problemText,
    record_id: recordId,
    run_time: rawRunTime,
    status: 200,
    vote_status: typeof voteStatus === 'string' ? voteStatus : '-1',
    write_ed: true,
  };

  if (uploadMeta) {
    record.upload_meta = uploadMeta;
  }

  return record;
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

  const applyLegacyOrWorkflowPayload = (rawValue: string) => {
    const raw = rawValue.trim().startsWith('data:')
      ? rawValue.trim().slice(5).trim()
      : rawValue.trim();
    if (!raw) return false;
    if (raw === '[DONE]') return true;

    const data = safeParseJson<Record<string, unknown>>(raw, {});
    if (Object.keys(data).length === 0) return false;

    if (isWorkflowEventData(data)) {
      applyDebugEventToChat(chat, debugEventFromData(data));
      return data.event === 'done' || data.type === 'done';
    }

    const chunk = data as ChatChunk;
    chat.chat_id = chunk.chat_id || chat.chat_id;
    chat.record_id = chunk.chat_record_id || chat.record_id;
    if (!chunk.is_end) ChatManagement.appendChunk(chat.id, chunk);
    return chunk.is_end === true;
  };

  const drainStreamPayloads = (buffer: string, flush = false) => {
    let ended = false;
    const eventBlocks = buffer.split(/\r?\n\r?\n/);
    let rest = flush ? '' : eventBlocks.pop() || '';

    for (const block of eventBlocks) {
      const payload = block
        .split(/\r?\n/)
        .filter((line) => line.trim().startsWith('data:'))
        .map((line) => line.trim().slice(5).trim())
        .join('\n');
      ended = applyLegacyOrWorkflowPayload(payload || block) || ended;
    }

    if (!rest.includes('data:')) {
      const extracted = extractCompleteJsonObjects(rest);
      for (const item of extracted.items) {
        ended = applyLegacyOrWorkflowPayload(item) || ended;
      }
      rest = extracted.rest;
    }

    if (flush && rest.trim()) {
      ended = applyLegacyOrWorkflowPayload(rest) || ended;
      rest = '';
    }

    return { ended, rest };
  };

  const writeStream = async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        const drained = drainStreamPayloads(tempResult, true);
        tempResult = drained.rest;
        // 对齐 MaxKB: 不强制清空打字机缓冲区。
        // 无论是正常结束（done 事件已调用 markDone）还是异常断开，
        // 打字机都会在缓冲区空后自然调用 closeInterval()。
        ChatManagement.markDone(chat.id);
        return;
      }

      tempResult += new TextDecoder('utf-8').decode(value, { stream: true });
      const drained = drainStreamPayloads(tempResult);
      tempResult = drained.rest;
      if (drained.ended) return;
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
  const chatId = firstString(event.chatId, chat.chat_id);
  const chatRecordId = firstString(event.chatRecordId, chat.record_id);
  const nodeId = firstString(event.nodeId, event.nodeType, 'workflow');
  const realNodeId = firstString(event.realNodeId, event.runtimeNodeId, nodeId);
  const runtimeNodeId = firstString(
    event.runtimeNodeId,
    event.realNodeId,
    nodeId,
  );
  return {
    chat_id: chatId,
    chat_record_id: chatRecordId,
    child_node: event.childNode,
    content,
    is_end: false,
    node_id: nodeId,
    node_is_end: nodeIsEnd,
    node_name: firstString(event.nodeName, event.nodeType, '工作流节点'),
    node_type: firstString(event.nodeType, 'workflow'),
    real_node_id: realNodeId,
    reasoning_content: event.reasoningContent || '',
    runtime_node_id: runtimeNodeId,
    up_node_id: '',
    // 工作流调试各节点共享同一个 answer-row，不产生多条独立回复。
    // 仅在非调试场景（node 是独立对话轮次）时才使用 'single_view'。
    view_type: event.viewType ?? undefined,
  };
}

/**
 * 将节点事件追加到 chat.execution_details（逐步构建，供"执行详情"面板渲染）。
 *
 * 数据结构对齐 MaxKB 的 get_details() 返回值：
 * - 通用字段：name, index, type, status, run_time, err_message
 * - 各节点类型特有字段从 outputJson 提取
 */
function pushExecutionDetail(
  chat: ChatRecord,
  event: DebugSseLikeEvent,
  output: Record<string, unknown>,
  errMessage?: string,
) {
  if (!Array.isArray(chat.execution_details)) {
    chat.execution_details = [];
  }
  // 用 nodeId 去重，避免同一节点多次进入（如 node_end + node_interrupt）
  const nodeId = firstString(event.nodeId, event.nodeType, '');
  const details = chat.execution_details as Record<string, any>[];
  const existing = details.find((d) => d._nodeId === nodeId);
  if (existing) {
    // 同一节点再次出现时（如表单提交恢复后 node_end 更新了输出），
    // 将新字段合并到已有条目，保留首次的 index，更新状态和输出
    Object.assign(
      existing,
      buildDetailFields(event, output, errMessage, existing.index),
    );
    return;
  }

  const detail: Record<string, any> = {
    _nodeId: nodeId,
    ...buildDetailFields(
      event,
      output,
      errMessage,
      chat.execution_details.length,
    ),
  };

  chat.execution_details.push(detail);
}

/**
 * 从 SSE 事件 + outputJson 构建执行详情字段（通用 + 节点类型特有）。
 * 提取为独立函数以便 pushExecutionDetail 在新增和更新已有条目时复用。
 */
function buildDetailFields(
  event: DebugSseLikeEvent,
  output: Record<string, unknown>,
  errMessage: string | undefined,
  index: number,
): Record<string, any> {
  const detail: Record<string, any> = {
    name: firstString(event.nodeName, event.nodeType, '工作流节点'),
    index,
    type: firstString(event.nodeType, 'workflow'),
    status: errMessage ? 500 : 200,
    // 后端 NODE_END 的 run_time 单位为毫秒，前端统一转为秒展示
    run_time: typeof event.run_time === 'number' ? event.run_time / 1000 : 0,
    message_tokens: event.message_tokens ?? 0,
    answer_tokens: event.answer_tokens ?? 0,
    err_message: errMessage || '',
  };

  // 从 outputJson 节点类型特有字段中提取（对齐 MaxKB get_details 结构）
  // 后端 outputJson 已包含各节点的结构化输出，直接透传关键字段
  const nodeType = detail.type;
  switch (nodeType) {
    case 'ai-chat-node': {
      detail.system = output.system ?? '';
      detail.history_message = output.history_message ?? [];
      detail.question = output.question ?? '';
      detail.answer = output.answer ?? output.result ?? '';
      detail.reasoning_content = output.reasoning_content ?? '';
      detail.message_tokens =
        firstNumber(output.message_tokens, detail.message_tokens) ?? 0;
      detail.answer_tokens =
        firstNumber(output.answer_tokens, detail.answer_tokens) ?? 0;

      break;
    }
    case 'condition-node': {
      detail.branch_id = output.branch_id ?? '';
      detail.branch_name = output.branch_name ?? '';

      break;
    }
    case 'form-node': {
      detail.result = output.result ?? '';
      detail.form_content_format = output.form_content_format ?? '';
      detail.form_field_list = output.form_field_list ?? [];
      detail.form_data = output.form_data ?? {};
      detail.is_submit = output.is_submit ?? false;

      break;
    }
    case 'reply-node': {
      detail.answer = output.answer ?? output.result ?? '';

      break;
    }
    case 'search-dataset-node':
    case 'search-knowledge-node': {
      detail.question = output.question ?? '';
      detail.paragraph_list =
        output.paragraph_list ?? output.knowledge_sources ?? [];

      break;
    }
    case 'start-node': {
      detail.question = output.question ?? '';
      detail.global_fields = output.global_fields ?? [];
      detail.document_list = output.document_list ?? [];
      detail.image_list = output.image_list ?? [];
      detail.audio_list = output.audio_list ?? [];
      detail.video_list = output.video_list ?? [];
      detail.other_list = output.other_list ?? [];

      break;
    }
    default: {
      // 未特化的节点类型：把 output 整体作为 result 展示
      detail.answer = output.result ?? output.answer ?? output.output ?? '';
    }
  }

  return detail;
}

export function applyDebugEventToChat(
  chat: ChatRecord,
  event: DebugSseLikeEvent,
) {
  const normalizedEvent = event.event;
  if (event.chatId !== undefined && event.chatId !== null)
    chat.chat_id = `${event.chatId}`;
  if (event.chatRecordId !== undefined && event.chatRecordId !== null)
    chat.record_id = `${event.chatRecordId}`;
  if (
    (event.chatId === undefined || event.chatId === null) &&
    event.runId !== undefined &&
    event.runId !== null
  )
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
    // 构建执行详情（去重：node_end 已记录则跳过）
    pushExecutionDetail(chat, event, output);
    // 对齐 MaxKB: node_interrupt 是表单内容的唯一来源。
    const answer = extractInterruptAnswer(output);
    if (answer) {
      ChatManagement.appendChunk(chat.id, toChunk(chat, event, answer, true));
    } else {
      ChatManagement.appendChunk(chat.id, toChunk(chat, event, '', true));
    }
    return;
  }

  if (normalizedEvent === 'end' || normalizedEvent === 'node_end') {
    const output = outputObject(event.payload);
    // 构建执行详情（供"执行详情"面板渲染）
    pushExecutionDetail(chat, event, output);
    // 对齐 MaxKB: node_end 仅标记节点结束，不追加内容。
    ChatManagement.appendChunk(chat.id, toChunk(chat, event, '', true));
    return;
  }

  if (normalizedEvent === 'done') {
    const output = outputObject(event.payload);
    const answer = extractAnswer(output);
    // 表单中断场景：done 事件的 payload 携带的工作流最终答案
    // 与 node_interrupt 相同（含 <form_rander>），此时表单已由
    // node_interrupt 渲染，done 不应重复追加。
    if (answer && !answer.includes('<form_rander>')) {
      // Feed only the missing suffix through the typewriter buffer.
      // The `done` event carries the full final answer, but earlier
      // node_chunk events may have already queued some or all of it
      // in the typewriter buffer. getMissingSuffix() computes only
      // the portion not yet queued, preventing duplication.
      const suffix = ChatManagement.getMissingSuffix(chat.id, answer);
      if (suffix) {
        const doneChunk: ChatChunk = {
          chat_id: chat.chat_id,
          chat_record_id: chat.record_id,
          content: suffix,
          is_end: false,
          node_id: chat.currentChunk?.node_id || 'workflow',
          node_is_end: true,
          node_name: chat.currentChunk?.node_name || '工作流节点',
          node_type: chat.currentChunk?.node_type || 'workflow',
          real_node_id:
            chat.currentChunk?.real_node_id ||
            chat.currentChunk?.runtime_node_id ||
            chat.currentChunk?.node_id ||
            'workflow',
          reasoning_content: '',
          runtime_node_id:
            chat.currentChunk?.runtime_node_id ||
            chat.currentChunk?.real_node_id ||
            chat.currentChunk?.node_id ||
            'workflow',
          up_node_id: '',
          view_type: undefined,
        };
        ChatManagement.appendChunk(chat.id, doneChunk);
      }
    }
    chat.paragraph_list = extractParagraphList(output);
    // 对齐 MaxKB：从 done 事件中读取汇总的 token/耗时信息（后端从 nodeRuns 累加）。
    // 后端 done 事件携带 message_tokens / answer_tokens / run_time 字段。
    // 同时从 execution_details 累加作为降级兜底（兼容不带 usage 的旧后端）。
    if (
      typeof event.message_tokens === 'number' ||
      typeof event.answer_tokens === 'number' ||
      typeof event.run_time === 'number'
    ) {
      chat.message_tokens = event.message_tokens ?? 0;
      chat.answer_tokens = event.answer_tokens ?? 0;
      // run_time 后端单位是毫秒，前端展示为秒
      chat.run_time =
        typeof event.run_time === 'number' ? event.run_time / 1000 : 0;
    } else if (Array.isArray(chat.execution_details)) {
      // 降级：从 execution_details 累加
      const details = chat.execution_details as Record<string, any>[];
      chat.message_tokens = details.reduce(
        (sum, d) => sum + (Number(d.message_tokens) || 0),
        0,
      );
      chat.answer_tokens = details.reduce(
        (sum, d) => sum + (Number(d.answer_tokens) || 0),
        0,
      );
      chat.run_time = details.reduce(
        (sum, d) => sum + (Number(d.run_time) || 0),
        0,
      );
    }
    // 对齐 MaxKB: 标记数据已到达，让打字机自然消耗缓冲区后关闭。
    // 不立即调用 close()，避免打字机被强制清空（跳过逐字效果）。
    // 打字机间隔在缓冲区空后自动调用 closeInterval()。
    ChatManagement.markDone(chat.id);
    return;
  }

  if (normalizedEvent === 'error' || normalizedEvent === 'canceled') {
    chat.status = 500;
    pushExecutionDetail(chat, event, {}, event.message ?? undefined);
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

/**
 * 工作流调试 SSE 读取器（供 AiChat debug-ai-chat 模式使用）。
 *
 * 与 getWrite() 不同：调试 SSE 事件格式为 node_start / node_chunk / node_end / done 等，
 * 每行为 `data:{...}` JSON 或纯 JSON。逐行解析后通过 applyDebugEventToChat 写入 ChatRecord。
 */
export function getWriteDebug(
  chat: ChatRecord,
  reader: ReadableStreamDefaultReader<Uint8Array>,
) {
  return async () => {
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = drainDebugEvents(chat, buffer);
    }
    buffer = drainDebugEvents(chat, buffer, true);
    // Ensure chat is closed if done event didn't arrive.
    // Use markDone() to let typewriter finish naturally.
    if (!chat.write_ed) {
      ChatManagement.markDone(chat.id);
    }
  };
}
