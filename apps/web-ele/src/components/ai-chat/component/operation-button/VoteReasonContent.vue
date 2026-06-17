<script setup lang="ts">
import { computed, ref } from 'vue';

import { ElButton, ElCheckTag, ElInput, ElSpace } from 'element-plus';

import { vote } from '#/api/ai/chat';

const props = defineProps<{
  applicationId: string;
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
const feedBack = ref<string>(
  props.readonly ? props.defaultOtherContent || '' : '',
);
const selectedReason = ref<string>(
  props.readonly ? props.defaultReason || '' : '',
);

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
  return props.voteType === '0' ? LIKE_REASONS : OPPOSE_REASONS;
});

const title = computed(() => {
  return props.voteType === '0' ? '点赞原因' : '点踩原因';
});

const selectReason = (value: string) => {
  if (props.readonly) {
    return;
  }
  selectedReason.value = value;
};

function voteHandle() {
  vote(
    props.applicationId,
    props.recordId,
    props.voteType,
    selectedReason.value,
    feedBack.value,
  ).then(() => {
    emit('success', props.voteType);
    emit('close');
  });
}
</script>

<template>
  <div>
    <h4>{{ title }}</h4>
    <div class="g-mt-16">
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
    </div>
    <div v-if="selectedReason === 'other'" class="g-mt-16">
      <ElInput
        v-model="feedBack"
        :autosize="{ maxRows: 20, minRows: 4 }"
        placeholder="请输入您的反馈"
        :readonly="readonly"
        type="textarea"
      />
    </div>
    <div v-if="!readonly" class="dialog-footer mt-24 text-right">
      <ElButton @click="emit('close')">取消</ElButton>
      <ElButton
        :disabled="isSubmitDisabled"
        type="primary"
        @click="voteHandle()"
      >
        提交
      </ElButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.g-mt-16 {
  margin-top: 16px;
}
</style>
