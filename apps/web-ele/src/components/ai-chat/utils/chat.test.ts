import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatManagement } from '../types/application';
import {
  applyDebugEventToChat,
  createDebugChatRecord,
  getWrite,
  getWriteDebug,
} from './chat';

interface DebugExecutionDetail {
  answer_tokens: number;
  message_tokens: number;
  run_time: number;
}

function firstDetail(chat: ReturnType<typeof createDebugChatRecord>) {
  const detail = (chat.execution_details as DebugExecutionDetail[])[0];
  if (!detail) throw new Error('Expected a debug execution detail row');
  return detail;
}

afterEach(() => {
  vi.useRealTimers();
  ChatManagement.chatMessageContainer = {};
});

describe('debug chat execution details', () => {
  it('preserves ai-chat-node token fields from node_end event when output lacks tokens', () => {
    const chat = createDebugChatRecord('高级智能体2主要功能有什么？');

    applyDebugEventToChat(chat, {
      answer_tokens: 67,
      event: 'node_end',
      message_tokens: 123,
      nodeId: 'ai-chat-node_1',
      nodeName: 'AI 对话',
      nodeType: 'ai-chat-node',
      payload: JSON.stringify({ answer: '回答内容' }),
      run_time: 2860,
    });

    expect(firstDetail(chat)).toMatchObject({
      answer_tokens: 67,
      message_tokens: 123,
      run_time: 2.86,
    });
  });

  it('keeps chat summary and execution detail values consistent after done', () => {
    const chat = createDebugChatRecord('高级智能体2主要功能有什么？');

    applyDebugEventToChat(chat, {
      answer_tokens: 67,
      event: 'node_end',
      message_tokens: 123,
      nodeId: 'ai-chat-node_1',
      nodeName: 'AI 对话',
      nodeType: 'ai-chat-node',
      payload: JSON.stringify({ answer: '回答内容' }),
      run_time: 2860,
    });
    applyDebugEventToChat(chat, {
      answer_tokens: 67,
      event: 'done',
      message_tokens: 123,
      payload: JSON.stringify({ answer: '回答内容' }),
      run_time: 2860,
    });

    const detail = firstDetail(chat);
    expect(detail.message_tokens + detail.answer_tokens).toBe(
      (chat.message_tokens || 0) + (chat.answer_tokens || 0),
    );
    expect(detail.run_time).toBe(chat.run_time);
  });

  it('renders node_chunk content when backend events are coalesced in one stream chunk', async () => {
    vi.useFakeTimers();
    const chat = createDebugChatRecord('后端返回内容');
    const encoder = new TextEncoder();
    const events = [
      {
        applicationId: '2063916985447399426',
        content: '具体的',
        event: 'node_chunk',
        isEnd: false,
        nodeId: 'ai-chat-node_1780986801844',
        nodeName: 'AI 对话',
        nodeType: 'ai-chat-node',
        runId: '2066399961091493889',
        versionId: '2064235556199288834',
      },
      {
        event: 'done',
        isEnd: true,
        payload: JSON.stringify({ answer: '具体的答复' }),
        runId: '2066399961091493889',
      },
    ];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(events.map((event) => JSON.stringify(event)).join('')),
        );
        controller.close();
      },
    });

    ChatManagement.addChatRecord(chat, 10);
    ChatManagement.write(chat.id);
    await getWriteDebug(chat, stream.getReader())();
    vi.advanceTimersByTime(1000);

    expect(chat.answer_text).toContain('具体的');
    expect(
      chat.answer_text_list
        .flat()
        .map((item) => item.content)
        .join(''),
    ).toContain('具体的');
  });
});

describe('done event does not duplicate streamed text', () => {
  it('does not duplicate text when node_chunk is followed by done with full answer', async () => {
    vi.useFakeTimers();
    const chat = createDebugChatRecord('test duplication');
    ChatManagement.addChatRecord(chat, 10);
    ChatManagement.write(chat.id);

    // Simulate node_chunk events that deliver partial content
    applyDebugEventToChat(chat, {
      content: 'Hello',
      event: 'node_chunk',
      nodeId: 'ai-chat-node_1',
      nodeName: 'AI 对话',
      nodeType: 'ai-chat-node',
    });
    applyDebugEventToChat(chat, {
      content: ' World',
      event: 'node_chunk',
      nodeId: 'ai-chat-node_1',
      nodeName: 'AI 对话',
      nodeType: 'ai-chat-node',
    });

    // Simulate done event with the full answer (same content already streamed)
    applyDebugEventToChat(chat, {
      event: 'done',
      payload: JSON.stringify({ answer: 'Hello World' }),
    });

    // Advance timers to flush all buffered characters and close the interval
    vi.advanceTimersByTime(1000);

    // The answer must be exactly "Hello World", not duplicated
    expect(chat.answer_text).toBe('Hello World');
  });

  it('preserves typewriter effect for content arriving via node_chunk before done', async () => {
    vi.useFakeTimers();
    const chat = createDebugChatRecord('test typewriter');
    ChatManagement.addChatRecord(chat, 10);
    ChatManagement.write(chat.id);

    // Send node_chunk events
    applyDebugEventToChat(chat, {
      content: 'Hel',
      event: 'node_chunk',
      nodeId: 'ai-chat-node_1',
      nodeName: 'AI 对话',
      nodeType: 'ai-chat-node',
    });
    applyDebugEventToChat(chat, {
      content: 'lo',
      event: 'node_chunk',
      nodeId: 'ai-chat-node_1',
      nodeName: 'AI 对话',
      nodeType: 'ai-chat-node',
    });

    // Advance timer partially — answer should grow character by character
    vi.advanceTimersByTime(10);
    const afterFirstTick = chat.answer_text;
    expect(afterFirstTick.length).toBeGreaterThanOrEqual(1);
    expect(afterFirstTick.length).toBeLessThan(5);

    // Advance more to flush more characters
    vi.advanceTimersByTime(30);
    const afterMoreTicks = chat.answer_text;
    expect(afterMoreTicks.length).toBeGreaterThan(afterFirstTick.length);

    // Now send done with the full answer
    applyDebugEventToChat(chat, {
      event: 'done',
      payload: JSON.stringify({ answer: 'Hello World' }),
    });

    // Advance timers to flush everything
    vi.advanceTimersByTime(2000);

    // Final answer must be correct without duplication
    expect(chat.answer_text).toBe('Hello World');
    // Verify the answer_text_list content blocks also match
    expect(
      chat.answer_text_list
        .flat()
        .map((item) => item.content)
        .join(''),
    ).toBe('Hello World');
  });
});

describe('formal chat SSE parsing', () => {
  it('parses jk workflow event-style chunks and preserves renderer identifiers', async () => {
    vi.useFakeTimers();
    const chat = createDebugChatRecord('formal workflow');
    const encoder = new TextEncoder();
    const events = [
      {
        chatId: 'chat-100',
        chatRecordId: 'record-100',
        event: 'node_chunk',
        nodeId: 'form-node',
        nodeName: '表单',
        nodeType: 'form-node',
        runtimeNodeId: 'runtime-form-100',
        content: '<form_rander>{}</form_rander>',
        childNode: { runtime_node_id: 'child-runtime-1' },
      },
      {
        chatId: 'chat-100',
        chatRecordId: 'record-100',
        event: 'done',
        payload: { answer: '<form_rander>{}</form_rander>' },
      },
    ];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            events.map((event) => `data:${JSON.stringify(event)}\n\n`).join(''),
          ),
        );
        controller.close();
      },
    });

    ChatManagement.addChatRecord(chat, 10);
    ChatManagement.write(chat.id);
    await getWrite(chat, stream.getReader(), true)();
    vi.advanceTimersByTime(1000);

    const answer = chat.answer_text_list.flat()[0];
    expect(chat.chat_id).toBe('chat-100');
    expect(chat.record_id).toBe('record-100');
    expect(answer).toMatchObject({
      chat_record_id: 'record-100',
      content: '<form_rander>{}</form_rander>',
      runtime_node_id: 'runtime-form-100',
    });
    expect(answer?.child_node).toEqual({ runtime_node_id: 'child-runtime-1' });
  });

  it('keeps legacy data chunk parsing for formal chat streams', async () => {
    vi.useFakeTimers();
    const chat = createDebugChatRecord('legacy stream');
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            [
              'data:{"chat_id":"legacy-chat","chat_record_id":"legacy-record","content":"legacy","node_id":"node-1","runtime_node_id":"runtime-1"}\n\n',
              'data:{"chat_id":"legacy-chat","chat_record_id":"legacy-record","is_end":true}\n\n',
            ].join(''),
          ),
        );
        controller.close();
      },
    });

    ChatManagement.addChatRecord(chat, 10);
    ChatManagement.write(chat.id);
    await getWrite(chat, stream.getReader(), true)();
    vi.advanceTimersByTime(1000);

    expect(chat.chat_id).toBe('legacy-chat');
    expect(chat.record_id).toBe('legacy-record');
    expect(chat.answer_text).toBe('legacy');
    expect(chat.answer_text_list.flat()[0]).toMatchObject({
      chat_record_id: 'legacy-record',
      content: 'legacy',
      runtime_node_id: 'runtime-1',
    });
  });
});
