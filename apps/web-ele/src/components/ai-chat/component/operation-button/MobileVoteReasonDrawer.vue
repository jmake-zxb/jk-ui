<script setup lang="ts">
import { computed, ref } from 'vue';

import { ElButton, ElCheckTag, ElDrawer, ElInput, ElSpace } from 'element-plus';

import { vote } from '#/api/ai/chat';

const props = defineProps<{
  applicationId: string;
  defaultOtherContent?: string;
  defaultReason?: string;
  recordId: string;
}>();

const emit = defineEmits<{
  success: [voteStatus: string];
}>();
const feedBack = ref<string>('');
const selectedReason = ref<string>('');
const visible = ref(false);
const voteType = ref<string>('');

const LIKE_REASONS = [
  { label: '回答准确', value: 'accurate' },
  { label: '回答完整', value: 'complete' },
  { label: '其他', value: 'other' },
];

const OPPOSE_REASONS = [
  { label: '回答不准确', value: 'inaccurate' },
  { label: '答非所问', value: 'incomplete' },
  { label: '其他', value: 'other' },
];

const isSubmitDisabled = computed(() => {
  if (!selectedReason.value) {
    return true;
  }
  if (selectedReason.value === 'other' && !feedBack.value.trim()) {
    return true;
  }
  return false;
});

const reasons = computed(() => {
  return voteType.value === '0' ? LIKE_REASONS : OPPOSE_REASONS;
});

const title = computed(() => {
  return voteType.value === '0' ? '点赞原因' : '点踩原因';
});

const selectReason = (value: string) => {
  selectedReason.value = value;
};

function voteHandle() {
  vote(
    props.applicationId,
    props.recordId,
    voteType.value,
    selectedReason.value,
    feedBack.value,
  ).then(() => {
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
    footer-class="mobile-vote-drawer-footer"
    :modal="true"
    size="-"
  >
    <template #header>
      <h4 class="text-center">{{ title }}</h4>
    </template>
    <template #default>
      <ElSpace :size="12" wrap>
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

      <div v-if="selectedReason === 'other'" class="g-mt-16">
        <ElInput
          v-model="feedBack"
          :autosize="{ maxRows: 20, minRows: 4 }"
          placeholder="请输入您的反馈"
          type="textarea"
        />
      </div>
    </template>
    <template #footer>
      <ElSpace :fill-ratio="40" fill style="width: 100%">
        <ElButton size="large" @click="visible = false">取消</ElButton>
        <ElButton
          :disabled="isSubmitDisabled"
          size="large"
          type="primary"
          @click="voteHandle()"
        >
          提交
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

<style lang="scss" scoped>
.g-mt-16 {
  margin-top: 16px;
}
</style>
