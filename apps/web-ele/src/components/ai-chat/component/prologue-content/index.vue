<script setup lang="ts">
import type { ChatRecord } from '../../types/application';

import { computed } from 'vue';

import { ElCard } from 'element-plus';

import MdRenderer from '#/components/markdown/MdRenderer.vue';

const props = defineProps<{
  application: Record<string, any>;
  available: boolean;
  selection?: boolean;
  sendMessage: (
    question: string,
    otherParamsData?: unknown,
    chat?: ChatRecord,
  ) => void;
  type: 'ai-chat' | 'debug-ai-chat' | 'log' | 'share';
}>();

const showAvatar = computed(() => {
  return props.application.show_avatar === undefined
    ? true
    : props.application.show_avatar;
});

const showUserAvatar = computed(() => {
  return props.application.show_user_avatar === undefined
    ? true
    : props.application.show_user_avatar;
});

const prologue = computed(() => {
  const temp = props.available
    ? props.application?.prologue
    : '您好！我是 AI 助手，有什么可以帮您？';
  if (temp) {
    const tag_list = [
      /<html_rander>.*?<\/html_rander>/gs,
      /<echarts_rander>.*?<\/echarts_rander>/gs,
      /<quick_question>.*?<\/quick_question>/gs,
      /<form_rander>.*?<\/form_rander>/gs,
    ];
    let _temp = temp;
    for (const index in tag_list) {
      _temp = _temp.replaceAll(tag_list[index], '');
    }
    const quick_question_list = _temp.match(/-\s.+/g) || [];
    let result = temp;
    for (const index in quick_question_list) {
      const quick_question = quick_question_list[index];
      result = result.replace(
        quick_question,
        (_match: string) =>
          `<quick_question>${_match.replace('- ', '')}</quick_question>`,
      );
    }
    return result;
  }
  return '';
});

function sendPrologueMessage(
  question: string,
  _type: 'new' | 'old',
  otherParamsData?: unknown,
) {
  props.sendMessage(question, otherParamsData);
}
</script>

<template>
  <div class="prologue-content">
    <div class="avatar" v-if="prologue && showAvatar">
      <img
        v-if="application.avatar"
        :src="application.avatar"
        height="28px"
        width="28px"
      />
      <svg
        v-else
        class="avatar-icon"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        width="28"
        height="28"
      >
        <rect
          x="3"
          y="5"
          width="18"
          height="14"
          rx="3"
          fill="currentColor"
          opacity="0.2"
        />
        <rect
          x="3"
          y="5"
          width="18"
          height="14"
          rx="3"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <circle cx="9" cy="12" r="1.5" fill="currentColor" />
        <circle cx="15" cy="12" r="1.5" fill="currentColor" />
        <path
          d="M8 18v2M16 18v2"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
    </div>
    <div
      class="content"
      v-if="prologue"
      :style="{
        paddingRight: showUserAvatar
          ? 'var(--el-ai-chat-padding-left, 36px)'
          : '0',
      }"
    >
      <ElCard shadow="always" style="

--el-card-padding: 10px 16px 12px">
        <MdRenderer
          :source="prologue"
          :send-message="sendPrologueMessage"
          reasoning_content=""
          :type="type"
          :selection="selection"
        />
      </ElCard>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.prologue-content {
  display: flex;
  margin-bottom: 16px; /* was: .mb-16 */

  /* was: .item-content (semantic class from MaxKB, no explicit styles) */

  .avatar {
    float: left;
    margin-right: 8px; /* was: .mr-8 */
  }
}

.avatar-icon {
  color: #fff;
  background: var(--el-color-primary);
  border-radius: 6px;
}
</style>
