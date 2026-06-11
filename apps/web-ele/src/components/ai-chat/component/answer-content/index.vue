<script setup lang="ts">
import type { ChatAnswerBlock, ChatRecord } from '../../types/application';

import { computed, onBeforeUnmount, onMounted } from 'vue';

import { Loading } from '@element-plus/icons-vue';
import { ElCard, ElIcon } from 'element-plus';

import MdRenderer from '#/components/markdown/MdRenderer.vue';
import { nodeTypeIcon } from '#/views/ai/orchestration/workflow/designer/common/node-type-icons';

import { ChatManagement } from '../../types/application';
import { aiChatBus } from '../../utils/bus';
import KnowledgeSourceComponent from '../knowledge-source-component/index.vue';
import OperationButton from '../operation-button/index.vue';

const props = defineProps<{
  application: Record<string, any>;
  chatManagement: typeof ChatManagement;
  chatRecord: ChatRecord;
  executionIsRightPanel?: boolean;
  loading: boolean;
  selection?: boolean;
  sendMessage: (
    question: string,
    otherParamsData?: unknown,
    chat?: ChatRecord,
  ) => Promise<boolean>;
  type: 'ai-chat' | 'debug-ai-chat' | 'log' | 'share';
}>();

const emit = defineEmits<{
  openExecutionDetail: [];
  openParagraph: [];
  openParagraphDocument: [value: string];
  'update:chatRecord': [value: ChatRecord];
}>();

const showAvatar = computed(() =>
  props.application.show_avatar === undefined
    ? true
    : props.application.show_avatar,
);
const showUserAvatar = computed(() =>
  props.application.show_user_avatar === undefined
    ? true
    : props.application.show_user_avatar,
);

const progress = computed(() => {
  if (!props.chatRecord.currentChunk) return null;
  return {
    content: `执行中 ${props.chatRecord.currentChunk.node_name || ''}`,
    node_type: props.chatRecord.currentChunk.node_type || '',
  };
});

const progressIcon = computed(() =>
  progress.value ? nodeTypeIcon(progress.value.node_type) : Loading,
);

const answerTextList = computed(() =>
  props.chatRecord.answer_text_list.map((item) => {
    if (typeof item === 'string') {
      return [
        {
          content: item,
        },
      ] as ChatAnswerBlock[];
    }
    if (Array.isArray(item)) return item;
    return [item] as ChatAnswerBlock[];
  }),
);

function addAnswerTextList(answerTextListValue: ChatAnswerBlock[][]) {
  answerTextListValue.push([]);
}

function chatMessage(
  question: string,
  type: 'new' | 'old',
  otherParamsData?: unknown,
) {
  if (type === 'old') {
    addAnswerTextList(props.chatRecord.answer_text_list);
    props.sendMessage(question, otherParamsData, props.chatRecord).then(() => {
      props.chatManagement.open(props.chatRecord.id);
      props.chatManagement.write(props.chatRecord.id);
    });
  } else {
    props.sendMessage(question, otherParamsData);
  }
}

function openControl(event: MouseEvent) {
  if (props.type !== 'log') aiChatBus.emit('open-control', event);
}

function showSource(row: ChatRecord) {
  if (props.type === 'log') return true;
  if (row.write_ed && row.status !== 500) return true;
  return false;
}

function regenerationChart(chat: ChatRecord) {
  const container = chat.upload_meta;
  props.sendMessage(chat.problem_text, {
    audio_list: container?.audio_list || [],
    document_list: container?.document_list || [],
    image_list: container?.image_list || [],
    other_list: container?.other_list || [],
    re_chat: true,
    video_list: container?.video_list || [],
  });
}

function stopChat(chat: ChatRecord) {
  props.chatManagement.stop(chat.id);
}

function startChat(chat: ChatRecord) {
  props.chatManagement.write(chat.id);
}

function handleChatStop() {
  stopChat(props.chatRecord);
}

onMounted(() => {
  aiChatBus.on('chat:stop', handleChatStop);
});

onBeforeUnmount(() => {
  aiChatBus.off('chat:stop', handleChatStop);
});
</script>

<template>
  <div class="answer-content">
    <div
      v-for="(answerText, index) in answerTextList"
      :key="index"
      class="answer-row"
    >
      <div v-if="showAvatar" class="avatar">
        <img v-if="application.avatar" :src="application.avatar" alt="" />
        <span v-else>AI</span>
      </div>
      <div
        class="content"
        :style="{
          paddingRight: showUserAvatar ? 'var(--answer-avatar-offset)' : '0',
        }"
        @mouseup="openControl"
      >
        <ElCard
          v-if="!chatRecord.write_ed && progress"
          shadow="always"
          class="progress-card"
          style="

            --el-card-padding: 1px 16px;

            width: fit-content;
          "
        >
          <div class="progress-inner">
            <ElIcon class="progress-icon">
              <component :is="progressIcon" />
            </ElIcon>
            <MdRenderer :source="progress.content" />
          </div>
        </ElCard>
        <ElCard
          shadow="always"
          class="answer-card"
          style="

--el-card-padding: 6px 16px"
        >
          <MdRenderer
            v-if="
              (chatRecord.write_ed === undefined ||
                chatRecord.write_ed === true) &&
              answerText.length === 0 &&
              answerText
                .map((item) => item.content)
                .join('')
                .trim().length === 0
            "
            source="AI 暂无回复"
          />
          <template v-else-if="answerText.length > 0">
            <MdRenderer
              v-for="(answer, answerIndex) in answerText"
              :key="answerIndex"
              :chat_record_id="answer.chat_record_id"
              :child_node="answer.child_node"
              :disabled="loading || type === 'log'"
              :reasoning_content="answer.reasoning_content"
              :runtime_node_id="answer.runtime_node_id"
              :send-message="chatMessage"
              :source="answer.content"
              :type="type"
            />
          </template>
          <p v-else-if="chatRecord.is_stop" class="message-line">已停止回答</p>
          <p v-else class="message-line">
            回答生成中 <span class="dotting"></span>
          </p>

          <KnowledgeSourceComponent
            v-if="
              showSource(chatRecord) &&
              index === chatRecord.answer_text_list.length - 1
            "
            :app-type="application.type"
            :application="application"
            :data="chatRecord"
            :execution-is-right-panel="props.executionIsRightPanel"
            :type="type"
            @open-execution-detail="emit('openExecutionDetail')"
            @open-paragraph="emit('openParagraph')"
            @open-paragraph-document="
              (value) => emit('openParagraphDocument', value)
            "
          />
        </ElCard>
      </div>
    </div>

    <div
      v-if="!selection"
      class="content operation-content"
      :style="{
        paddingLeft: showAvatar ? 'var(--answer-avatar-offset)' : '0',
        paddingRight: showUserAvatar ? 'var(--answer-avatar-offset)' : '0',
      }"
    >
      <OperationButton
        :application="application"
        :chat-record="chatRecord"
        :loading="loading"
        :regeneration-chart="regenerationChart"
        :start-chat="startChat"
        :stop-chat="stopChat"
        :type="type"
        @update:chat-record="(event) => emit('update:chatRecord', event)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.answer-content {
  --answer-avatar-offset: 36px;
}

.answer-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.avatar {
  display: flex;
  flex: 0 0 28px;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  overflow: hidden;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: var(--el-color-primary);
  border-radius: 6px;
}

.avatar img {
  width: 28px;
  height: 28px;
  object-fit: cover;
}

.content {
  width: 100%;
  min-width: 0;
}

.progress-card {
  margin-bottom: 8px;
  border-radius: 8px;
}

.progress-inner {
  display: flex;
  gap: 8px;
  align-items: center;
}

.progress-icon {
  flex-shrink: 0;
  color: var(--el-color-primary);
}

.answer-card {
  border-radius: 8px;
}

.message-line {
  margin: 0.5rem 0;
}

.dotting::after {
  display: inline-block;
  width: 1.5em;
  overflow: hidden;
  vertical-align: bottom;
  content: '...';
  animation: dot 1.4s steps(4, end) infinite;
}

@keyframes dot {
  from {
    width: 0;
  }
}
</style>
