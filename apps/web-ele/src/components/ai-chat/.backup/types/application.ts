import type { Ref } from 'vue';

import { aiChatBus } from '../utils/bus';

export interface ChatChunk {
  chat_id?: string;
  chat_record_id?: string;
  child_node?: unknown;
  content?: string;
  is_end?: boolean;
  node_id?: string;
  node_is_end?: boolean;
  node_name?: string;
  node_type?: string;
  real_node_id?: string;
  reasoning_content?: string;
  runtime_node_id?: string;
  up_node_id?: string;
  view_type?: string;
}

export interface ChatAnswerBlock {
  chat_record_id?: string;
  child_node?: unknown;
  content: string;
  real_node_id?: string;
  reasoning_content?: string;
  runtime_node_id?: string;
}

export interface ChatRecord {
  answer_text: string;
  answer_text_list: ChatAnswerBlock[][];
  answer_tokens?: number;
  buffer: string[];
  chat_id: string;
  create_time?: string;
  currentChunk?: ChatChunk;
  execution_details?: unknown[];
  id: string;
  is_stop?: boolean;
  message_tokens?: number;
  paragraph_list?: unknown[];
  problem_text: string;
  record_id: string;
  run_time?: number;
  status?: number;
  upload_meta?: {
    audio_list: unknown[];
    document_list: unknown[];
    image_list: unknown[];
    other_list: unknown[];
    video_list: unknown[];
  };
  vote_status: string;
  write_ed?: boolean;
}

interface ManagedNode {
  buffer: string[];
  chat_record_id?: string;
  child_node?: unknown;
  content: string;
  index: number;
  is_end: boolean;
  node_id?: string;
  node_type?: string;
  real_node_id: string;
  reasoning_content: string;
  reasoning_content_buffer: string[];
  runtime_node_id?: string;
  up_node_id?: string;
  view_type?: string;
}

interface WriteNodeInfo {
  answer_text_list_index: number;
  current_node: ManagedNode;
  current_up_node?: ManagedNode;
}

function findIndex<T>(
  array: T[],
  find: (item: T) => boolean,
  type: 'index' | 'last',
) {
  let setIndex = -1;
  for (const [index, element] of array.entries()) {
    if (element !== undefined && find(element)) {
      setIndex = index;
      if (type === 'index') break;
    }
  }
  return setIndex;
}

function emptyAnswerBlock(item: ChatAnswerBlock[]) {
  return (item.length === 1 && item[0]?.content === '') || item.length === 0;
}

function nodeIdentity(chunk: ChatChunk) {
  return `${chunk.real_node_id || chunk.runtime_node_id || chunk.node_id || 'default-node'}`;
}

export class ChatRecordManage {
  get closedAndWritten() {
    return this.is_close && this.write_ed;
  }

  get stopped() {
    return this.is_stop;
  }

  private chat: ChatRecord;

  private id?: number;

  private is_close = false;

  private is_stop = false;

  private loading?: Ref<boolean>;

  private ms: number;

  private node_list: ManagedNode[] = [];

  private write_ed = false;

  private write_node_info?: WriteNodeInfo;

  constructor(chat: ChatRecord, ms = 10, loading?: Ref<boolean>) {
    this.ms = ms;
    this.chat = chat;
    this.loading = loading;
  }

  append(answerTextBlock: string, reasoningContent = '') {
    let setIndex = findIndex(
      this.chat.answer_text_list,
      emptyAnswerBlock,
      'index',
    );
    if (setIndex <= -1) setIndex = 0;
    this.chat.answer_text_list[setIndex] = [
      {
        content: answerTextBlock,
        reasoning_content: reasoningContent,
      },
    ];
    this.chat.answer_text = answerTextBlock;
  }

  appendChunk(chunk: ChatChunk) {
    if (chunk.node_name) this.chat.currentChunk = chunk;

    const realNodeId = nodeIdentity(chunk);
    const content = chunk.content ?? '';
    const reasoningContent = chunk.reasoning_content ?? '';
    let node = this.node_list.find((item) => item.real_node_id === realNodeId);

    if (node) {
      node.buffer.push(...content);
      node.content += content;
      if (reasoningContent) {
        node.reasoning_content_buffer.push(...reasoningContent);
        node.reasoning_content += reasoningContent;
      }
    } else {
      node = {
        buffer: [...content],
        chat_record_id: chunk.chat_record_id,
        child_node: chunk.child_node,
        content,
        index: this.node_list.length,
        is_end: false,
        node_id: chunk.node_id,
        node_type: chunk.node_type,
        real_node_id: realNodeId,
        reasoning_content: reasoningContent,
        reasoning_content_buffer: reasoningContent ? [...reasoningContent] : [],
        runtime_node_id: chunk.runtime_node_id,
        up_node_id: chunk.up_node_id,
        view_type: chunk.view_type,
      };
      this.node_list.push(node);
    }

    if (chunk.node_is_end) node.is_end = true;
  }

  close() {
    this.is_close = true;
  }

  /**
   * Given a complete answer (e.g. from a `done` event), return the
   * new suffix that hasn't yet been queued for typewriter display.
   *
   * The composited text is answer_text (already flushed by the interval)
   * plus all characters remaining in node buffers. If the complete answer
   * starts with that composited text, we return only the trailing
   * portion. Otherwise we return the full answer — it is entirely
   * new content. If the answer is already fully present, returns ''.
   */
  getMissingSuffix(answer: string): string {
    const bufferedText = this.node_list
      .map((node) => node.buffer.join(''))
      .join('');
    const composited = this.chat.answer_text + bufferedText;
    if (composited.includes(answer)) {
      return '';
    }
    if (answer.startsWith(composited) && composited.length > 0) {
      return answer.slice(composited.length);
    }
    return answer;
  }

  /**
   * 标记数据已全部到达，让打字机自然消耗完缓冲区后关闭。
   * 与 close() 的区别：close() 立即生效，打字机下次间隔会清空缓冲区；
   * markDone() 仅设置 is_close 标志，打字机等到缓冲区空后才调用 closeInterval()。
   * 对齐 MaxKB：所有内容通过 appendChunk 流入，打字机逐字输出，
   * is_end 标志触发自然关闭，不强制清空。
   */
  markDone() {
    this.is_close = true;
  }

  open() {
    this.is_close = false;
    this.is_stop = false;
  }

  stop() {
    if (this.id) window.clearInterval(this.id);
    this.is_stop = true;
    this.chat.is_stop = true;
    if (this.loading) this.loading.value = false;
  }

  updateStatus(code: number) {
    this.chat.status = code;
  }

  write() {
    this.chat.is_stop = false;
    this.is_stop = false;
    this.is_close = false;
    this.write_ed = false;
    this.chat.write_ed = false;
    if (this.loading) this.loading.value = true;

    if (this.id) window.clearInterval(this.id);
    this.id = window.setInterval(() => {
      const nodeInfo = this.getRunNode();
      if (nodeInfo === undefined) {
        if (this.is_close) this.closeInterval();
        return;
      }

      const { answer_text_list_index, current_node } = nodeInfo;
      // 正常打字机处理：逐字输出缓冲区内容
      if (current_node.buffer.length > 20) {
        const context = current_node.is_end
          ? current_node.buffer.splice(0)
          : current_node.buffer.splice(0, current_node.buffer.length - 20);
        const reasoningContent = current_node.is_end
          ? current_node.reasoning_content_buffer.splice(0)
          : current_node.reasoning_content_buffer.splice(
              0,
              current_node.reasoning_content_buffer.length - 20,
            );
        this.appendAnswer(
          context.join(''),
          reasoningContent.join(''),
          answer_text_list_index,
          current_node,
        );
      } else {
        const content = current_node.buffer.shift();
        const reasoningContent = current_node.reasoning_content_buffer.shift();
        if (content !== undefined) {
          this.appendAnswer(content, '', answer_text_list_index, current_node);
        }
        if (reasoningContent !== undefined) {
          this.appendAnswer(
            '',
            reasoningContent,
            answer_text_list_index,
            current_node,
          );
        }
      }
    }, this.ms);
  }

  private appendAnswer(
    chunkAnswer: string,
    reasoningContent: string,
    index: number,
    node: ManagedNode,
  ) {
    if (chunkAnswer || reasoningContent) {
      let cardList = this.chat.answer_text_list[index];
      if (!cardList) {
        cardList = [];
        this.chat.answer_text_list[index] = cardList;
      }
      const answerValue = cardList.find(
        (item) => item.real_node_id === node.real_node_id,
      );
      if (answerValue) {
        answerValue.content += chunkAnswer;
        answerValue.reasoning_content = `${answerValue.reasoning_content || ''}${reasoningContent}`;
      } else {
        cardList.push({
          chat_record_id: node.chat_record_id,
          child_node: node.child_node,
          content: chunkAnswer,
          real_node_id: node.real_node_id,
          reasoning_content: reasoningContent,
          runtime_node_id: node.runtime_node_id,
        });
      }
    }
    this.chat.answer_text += chunkAnswer;
    aiChatBus.emit('change:answer', {
      is_end: false,
      record_id: this.chat.record_id,
    });
  }

  private closeInterval() {
    this.chat.write_ed = true;
    this.write_ed = true;
    this.chat.currentChunk = undefined;
    if (this.loading) this.loading.value = false;
    aiChatBus.emit('change:answer', {
      is_end: true,
      record_id: this.chat.record_id,
    });
    if (this.id) window.clearInterval(this.id);
    const lastIndex = findIndex(
      this.chat.answer_text_list,
      emptyAnswerBlock,
      'last',
    );
    if (lastIndex > 0) this.chat.answer_text_list.splice(lastIndex, 1);
  }

  private getCurrentUpNode(runNode: ManagedNode) {
    const index = this.node_list.indexOf(runNode);
    return index > 0 ? this.node_list[index - 1] : undefined;
  }

  private getRunNode(): undefined | WriteNodeInfo {
    if (
      this.write_node_info &&
      (this.write_node_info.current_node.reasoning_content_buffer.length > 0 ||
        this.write_node_info.current_node.buffer.length > 0 ||
        !this.write_node_info.current_node.is_end)
    ) {
      return this.write_node_info;
    }

    const runNode = this.node_list.find(
      (item) =>
        item.reasoning_content_buffer.length > 0 ||
        item.buffer.length > 0 ||
        !item.is_end,
    );
    if (!runNode) return undefined;

    const currentUpNode = this.getCurrentUpNode(runNode);
    let answerTextListIndex = 0;
    const noneIndex = findIndex(
      this.chat.answer_text_list,
      emptyAnswerBlock,
      'index',
    );
    if (
      currentUpNode === undefined ||
      runNode.view_type === 'single_view' ||
      currentUpNode.view_type === 'single_view'
    ) {
      answerTextListIndex =
        noneIndex > -1 ? noneIndex : this.chat.answer_text_list.length;
    } else {
      answerTextListIndex =
        noneIndex > -1 ? noneIndex : this.chat.answer_text_list.length - 1;
    }

    this.write_node_info = {
      answer_text_list_index: answerTextListIndex,
      current_node: runNode,
      current_up_node: currentUpNode,
    };
    return this.write_node_info;
  }
}

export const ChatManagement = {
  chatMessageContainer: {} as Record<string, ChatRecordManage>,

  addChatRecord(chat: ChatRecord, ms: number, loading?: Ref<boolean>) {
    this.chatMessageContainer[chat.id] = new ChatRecordManage(
      chat,
      ms,
      loading,
    );
  },

  append(chatRecordId: string, content: string, reasoningContent?: string) {
    this.chatMessageContainer[chatRecordId]?.append(content, reasoningContent);
  },

  appendChunk(chatRecordId: string, chunk: ChatChunk) {
    this.chatMessageContainer[chatRecordId]?.appendChunk(chunk);
  },

  clean() {
    for (const key of Object.keys(this.chatMessageContainer)) {
      if (this.chatMessageContainer[key]?.closedAndWritten)
        this.chatMessageContainer[key] = undefined as any;
    }
  },

  close(chatRecordId: string) {
    this.chatMessageContainer[chatRecordId]?.close();
  },

  markDone(chatRecordId: string) {
    this.chatMessageContainer[chatRecordId]?.markDone();
  },

  getMissingSuffix(chatRecordId: string, answer: string): string {
    return (
      this.chatMessageContainer[chatRecordId]?.getMissingSuffix(answer) ??
      answer
    );
  },

  isClose(chatRecordId: string) {
    return this.chatMessageContainer[chatRecordId]?.closedAndWritten ?? false;
  },

  isStop(chatRecordId: string) {
    return this.chatMessageContainer[chatRecordId]?.stopped ?? false;
  },

  open(chatRecordId: string) {
    this.chatMessageContainer[chatRecordId]?.open();
  },

  stop(chatRecordId: string) {
    this.chatMessageContainer[chatRecordId]?.stop();
  },

  updateStatus(chatRecordId: string, code: number) {
    this.chatMessageContainer[chatRecordId]?.updateStatus(code);
  },

  write(chatRecordId: string) {
    this.chatMessageContainer[chatRecordId]?.write();
  },
};

export type chatType = ChatRecord;
