<script setup lang="ts">
import { computed, ref } from 'vue';

import { ElButton, ElCheckTag, ElDrawer, ElInput, ElSpace } from 'element-plus';

import chatAPI from '#/api/ai/chat';
import { $t } from '#/locales';

const props = defineProps<{
  chatId: string;
  defaultOtherContent?: string;
  defaultReason?: string;
  recordId: string;
}>();

const emit = defineEmits<{
  success: [voteStatus: string];
}>();
const visible = ref(false);
const voteType = ref<string>(''); // '0' like, '1' oppose
const selectedReason = ref<string>('');
const feedBack = ref<string>('');
const loading = ref(false);

const selectReason = (value: string) => {
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
  return voteType.value === '0'
    ? $t('aiChat.vote.likeTitle')
    : $t('aiChat.vote.opposeTitle');
});

const reasons = computed(() => {
  return voteType.value === '0' ? LIKE_REASONS : OPPOSE_REASONS;
});

function voteHandle() {
  chatAPI
    .vote(
      props.chatId,
      props.recordId,
      voteType.value,
      selectedReason.value,
      feedBack.value,
      loading,
    )
    .then(() => {
      emit('success', voteType.value);
      visible.value = false;
    });
}

const open = (voteStatus: string) => {
  selectedReason.value = '';
  feedBack.value = '';
  voteType.value = voteStatus;
  visible.value = true;
};

defineExpose({ open });
</script>

<template>
  <ElDrawer
    v-model="visible"
    direction="btt"
    size="-"
    footer-class="mobile-vote-drawer-footer"
    :modal="true"
  >
    <template #header>
      <h4 class="text-center">{{ title }}</h4>
    </template>
    <template #default>
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

      <div v-if="selectedReason === 'other'" class="mt-4">
        <ElInput
          v-model="feedBack"
          type="textarea"
          :autosize="{ minRows: 4, maxRows: 20 }"
          :placeholder="$$t('aiChat.vote.placeholder')"
        />
      </div>
    </template>
    <template #footer>
      <ElSpace fill wrap :fill-ratio="40" style="width: 100%">
        <ElButton @click="visible = false" size="large">
          {{ $$t('common.cancel') }}
        </ElButton>
        <ElButton
          :disabled="isSubmitDisabled"
          type="primary"
          size="large"
          @click="voteHandle()"
        >
          {{ $$t('common.submit') }}
        </ElButton>
      </ElSpace>
    </template>
  </ElDrawer>
</template>

<style lang="scss">
.mobile-vote-drawer-footer {
  padding: 0 24px 32px;
  border: none !important;
}
</style>
