<script setup lang="ts">
import { computed, ref } from 'vue';

import { ElButton, ElCheckTag, ElInput, ElSpace } from 'element-plus';

import chatAPI from '#/api/ai/chat';
import { $t } from '#/locales';

const props = defineProps<{
  chatId: string;
  defaultOtherContent?: string;
  defaultReason?: string;
  readonly?: boolean;
  recordId: string;
  voteType: '0' | '1';
}>();

const emit = defineEmits<{
  close: [];
  success: [voteStatus: string];
}>();
const selectedReason = ref<string>(
  props.readonly ? props.defaultReason || '' : '',
);
const feedBack = ref<string>(
  props.readonly ? props.defaultOtherContent || '' : '',
);
const loading = ref(false);

const selectReason = (value: string) => {
  if (props.readonly) {
    return;
  }
  selectedReason.value = value;
};

const isSubmitDisabled = computed(() => {
  if (!selectedReason.value) {
    return true;
  }
  if (selectedReason.value === 'other' && !feedBack.value.trim()) {
    return true;
  }
  return false;
});

const LIKE_REASONS = [
  { label: $t('aiChat.vote.accurate'), value: 'accurate' },
  { label: $t('aiChat.vote.complete'), value: 'complete' },
  { label: $t('common.other'), value: 'other' },
];

const OPPOSE_REASONS = [
  { label: $t('aiChat.vote.inaccurate'), value: 'inaccurate' },
  { label: $t('aiChat.vote.irrelevantAnswer'), value: 'incomplete' },
  { label: $t('common.other'), value: 'other' },
];

const title = computed(() => {
  return props.voteType === '0'
    ? $t('aiChat.vote.likeTitle')
    : $t('aiChat.vote.opposeTitle');
});

const reasons = computed(() => {
  return props.voteType === '0' ? LIKE_REASONS : OPPOSE_REASONS;
});

function voteHandle() {
  chatAPI
    .vote(
      props.chatId,
      props.recordId,
      props.voteType,
      selectedReason.value,
      feedBack.value,
      loading,
    )
    .then(() => {
      emit('success', props.voteType);
      emit('close');
    });
}
</script>

<template>
  <div>
    <h4>{{ title }}</h4>
    <div class="mt-4">
      <ElSpace wrap :size="12">
        <template v-for="reason in reasons" :key="reason.value">
          <ElCheckTag
            type="primary"
            :checked="selectedReason === reason.value"
            @change="selectReason(reason.value)"
          >
            {{ reason.label }}
          </ElCheckTag>
        </template>
      </ElSpace>
    </div>
    <div v-if="selectedReason === 'other'" class="mt-4">
      <ElInput
        v-model="feedBack"
        type="textarea"
        :autosize="{ minRows: 4, maxRows: 20 }"
        :placeholder="$$t('aiChat.vote.placeholder')"
        :readonly="readonly"
      />
    </div>
    <div v-if="!readonly" class="dialog-footer mt-6 text-right">
      <ElButton @click="emit('close')"> {{ $$t('common.cancel') }}</ElButton>
      <ElButton
        :disabled="isSubmitDisabled"
        type="primary"
        @click="voteHandle()"
      >
        {{ $$t('common.submit') }}
      </ElButton>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
