<script setup lang="ts">
import type { chatType } from '#/api/ai/types';

import { computed, onMounted } from 'vue';

import { InfoFilled as LogoIcon } from '@element-plus/icons-vue';
import { ElCard } from 'element-plus';

import KnowledgeSourceComponent from '#/components/ai-chat/component/knowledge-source-component/index.vue';
import OperationButton from '#/components/ai-chat/component/operation-button/index.vue';
import MdRenderer from '#/components/markdown/MdRenderer.vue';
import { $t } from '#/locales';
import bus from '#/utils/bus';
import { iconComponent } from '#/workflow/icons/utils';

const props = defineProps<{
  application: any;
  chatManagement: any;
  chatRecord: chatType;
  executionIsRightPanel?: boolean;
  loading: boolean;
  selection?: boolean;
  sendMessage: (
    question: string,
    other_params_data?: any,
    chat?: chatType,
  ) => Promise<boolean>;
  type: 'ai-chat' | 'debug-ai-chat' | 'log' | 'share';
}>();

const emit = defineEmits([
  'update:chatRecord',
  'openExecutionDetail',
  'openParagraph',
  'openParagraphDocument',
]);

const showAvatar = computed(() => {
  return props.application.show_avatar === undefined
    ? true
    : props.application.show_avatar;
});
const progress = computed(() => {
  if (props.chatRecord.currentChunk) {
    return {
      content: `${$t('aiChat.executing')} ${props.chatRecord.currentChunk.node_name}`,
      node_type: props.chatRecord.currentChunk.node_type,
    };
  }
  return null;
});
const showUserAvatar = computed(() => {
  return props.application.show_user_avatar === undefined
    ? true
    : props.application.show_user_avatar;
});
const chatMessage = (
  question: string,
  type: 'new' | 'old',
  other_params_data?: any,
) => {
  if (type === 'old') {
    add_answer_text_list(props.chatRecord.answer_text_list);
    props
      .sendMessage(question, other_params_data, props.chatRecord)
      .then(() => {
        props.chatManagement.open(props.chatRecord.id);
        props.chatManagement.write(props.chatRecord.id);
      });
  } else {
    props.sendMessage(question, other_params_data);
  }
};
const add_answer_text_list = (answer_text_list: Array<any>) => {
  answer_text_list.push([]);
};

const openControl = (event: any) => {
  if (props.type !== 'log') {
    bus.emit('open-control', event);
  }
};

const answer_text_list = computed(() => {
  return props.chatRecord.answer_text_list.map((item) => {
    if (typeof item === 'string') {
      return [
        {
          content: item,
          chat_record_id: undefined,
          child_node: undefined,
          runtime_node_id: undefined,
          reasoning_content: undefined,
        },
      ];
    } else if (Array.isArray(item)) {
      return item;
    } else {
      return [item];
    }
  });
});

function showSource(row: any) {
  if (props.type === 'log') {
    return true;
  } else if (row.write_ed && row.status !== 500) {
    return true;
  }
  return false;
}

const regenerationChart = (chat: chatType) => {
  const container =
    props.chatRecord?.upload_meta ||
    props.chatRecord.execution_details?.find(
      (detail) => detail.type === 'start-node',
    );

  props.sendMessage(chat.problem_text, {
    re_chat: true,
    image_list: container?.image_list || [],
    document_list: container?.document_list || [],
    audio_list: container?.audio_list || [],
    video_list: container?.video_list || [],
    other_list: container?.other_list || [],
  });
};
const stopChat = (chat: chatType) => {
  props.chatManagement.stop(chat.id);
};
const startChat = (chat: chatType) => {
  props.chatManagement.write(chat.id);
};

onMounted(() => {
  bus.on('chat:stop', () => {
    stopChat(props.chatRecord);
  });
});
</script>
<template>
  <div class="item-content lighter">
    <div
      v-for="(answer_text, index) in answer_text_list"
      :key="index"
      class="mb-2 flex"
    >
      <div class="avatar mr-2" v-if="showAvatar">
        <img
          v-if="application.avatar"
          :src="application.avatar"
          height="28px"
          width="28px"
        />
        <LogoIcon v-else height="28px" width="28px" />
      </div>
      <div
        class="content w-full"
        @mouseup="openControl"
        :style="{
          'padding-right': showUserAvatar ? 'var(--padding-left)' : '0',
        }"
      >
        <ElCard
          v-if="!chatRecord.write_ed && progress"
          shadow="always"
          class="mb-2 rounded-lg"
          style="
            --el-card-padding: 1px 16px;

            width: fit-content;
          "
        >
          <div class="align-center flex">
            <component
              :is="iconComponent(`${progress.node_type}-icon`)"
              class="mr-2"
              :size="16"
              style="--el-avatar-border-radius: 3px"
            />
            <MdRenderer :source="progress.content" />
          </div>
        </ElCard>
        <ElCard
          shadow="always"
          class="rounded-lg"
          style="--el-card-padding: 6px 16px"
        >
          <MdRenderer
            v-if="
              (chatRecord.write_ed === undefined ||
                chatRecord.write_ed === true) &&
              answer_text.length === 0 &&
              answer_text
                .map((item) => item.content)
                .join('')
                .trim().length === 0
            "
            :source="$$t('aiChat.tip.answerMessage')"
          />
          <template v-else-if="answer_text.length > 0">
            <MdRenderer
              v-for="(answer, ansIdx) in answer_text"
              :key="ansIdx"
              :chat-record-id="answer.chat_record_id"
              :child-node="answer.child_node"
              :runtime-node-id="answer.runtime_node_id"
              :reasoning-content="answer.reasoning_content"
              :disabled="loading || type === 'log'"
              :source="answer.content"
              :send-message="chatMessage"
            />
          </template>
          <p
            v-else-if="chatRecord.is_stop"
            shadow="always"
            style="margin: 0.5rem 0"
          >
            {{ $$t('aiChat.tip.stopAnswer') }}
          </p>
          <p v-else shadow="always" style="margin: 0.5rem 0">
            {{ $$t('aiChat.tip.answerLoading') }} <span class="dotting"></span>
          </p>
          <!-- 知识来源 -->
          <KnowledgeSourceComponent
            :data="chatRecord"
            :application="application"
            :type="type"
            :app-type="application.type"
            :execution-is-right-panel="props.executionIsRightPanel"
            @open-execution-detail="emit('openExecutionDetail', chatRecord)"
            @open-paragraph="emit('openParagraph')"
            @open-paragraph-document="
              (val: string) => emit('openParagraphDocument', val)
            "
            v-if="
              showSource(chatRecord) &&
              index === chatRecord.answer_text_list.length - 1
            "
          />
        </ElCard>
      </div>
    </div>

    <div
      class="content"
      :style="{
        'padding-left': showAvatar ? 'var(--padding-left)' : '0',
        'padding-right': showUserAvatar ? 'var(--padding-left)' : '0',
      }"
      v-if="!selection"
    >
      <OperationButton
        :type="type"
        :application="application"
        :chat-record="chatRecord"
        @update:chat-record="(event: any) => emit('update:chatRecord', event)"
        :loading="loading"
        :start-chat="startChat"
        :stop-chat="stopChat"
        :regeneration-chart="regenerationChart"
      />
    </div>
  </div>
</template>
<style lang="scss" scoped></style>
