<script setup lang="ts">
import type { chatType } from '#/api/ai/types';

import { computed } from 'vue';

import { InfoFilled as LogoIcon } from '@element-plus/icons-vue';
import { ElCard } from 'element-plus';

import MdRenderer from '#/components/markdown/MdRenderer.vue';
import { $t } from '#/locales';

const props = defineProps<{
  application: any;
  available: boolean;
  selection?: boolean;
  sendMessage: (
    question: string,
    other_params_data?: any,
    chat?: chatType,
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

const toQuickQuestion = (match: string, _offset: number, _input: string) => {
  return `<quick_question>${match.replace('- ', '')}</quick_question>`;
};
const prologue = computed(() => {
  const temp = props.available
    ? props.application?.prologue
    : $t('aiChat.tip.prologueMessage');
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
    const quick_question_list = _temp.match(/-\s.+/g);
    let result = temp;
    for (const index in quick_question_list) {
      const quick_question = quick_question_list[index];
      result = result.replace(quick_question, toQuickQuestion);
    }
    return result;
  }
  return '';
});
</script>
<template>
  <!-- 开场白组件 -->
  <div class="item-content mb-4">
    <div class="avatar mr-2" v-if="prologue && showAvatar">
      <img
        v-if="application.avatar"
        :src="application.avatar"
        height="28px"
        width="28px"
      />
      <LogoIcon v-else height="28px" width="28px" />
    </div>
    <div
      class="content"
      v-if="prologue"
      :style="{
        'padding-right': showUserAvatar ? 'var(--padding-left)' : '0',
      }"
    >
      <ElCard
        shadow="always"
        class="rounded-lg"
        style="--el-card-padding: 10px 16px 12px"
      >
        <MdRenderer
          :source="prologue"
          :send-message="sendMessage"
          reasoning_content=""
          :type="type"
          :selection="selection"
        />
      </ElCard>
    </div>
  </div>
</template>
<style lang="scss" scoped></style>
