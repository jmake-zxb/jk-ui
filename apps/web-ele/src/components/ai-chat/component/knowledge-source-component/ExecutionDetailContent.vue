<script setup lang="ts">
import { computed } from 'vue';

import ExecutionDetailCard from '#/components/execution-detail-card/index.vue';
import MdRenderer from '#/components/markdown/MdRenderer.vue';
import { isWorkFlow } from '#/utils/application';
import { arraySort } from '#/utils/array';

const props = defineProps<{
  appType?: string;
  detail?: any[];
}>();

const errStepMsg = computed(() => {
  const err_step = props.detail?.find((item) => item.status === 500);
  if (err_step) {
    return `${err_step.step_type}: ${err_step.err_message}`;
  }
  return undefined;
});

const messageList = computed(() => {
  const chat_step = props.detail?.find(
    (item) => item.step_type === 'chat_step',
  );
  if (chat_step) {
    return chat_step.message_list;
  }
  return [];
});
const get_padding_problem = () => {
  return props.detail?.find((item) => item.step_type === 'problem_padding');
};

const get_padded_problem = () => {
  return props.detail?.find((item) => item.step_type === 'problem_padding');
};

const paddedProblem = computed(() => {
  const problem_padded = get_padded_problem();
  return problem_padded ? problem_padded.padding_problem_text : '';
});

const problem = computed(() => {
  const problem_padding = get_padding_problem();
  if (problem_padding) {
    return problem_padding.problem_text;
  }
  const user_list = messageList.value.filter(
    (item: any) => item.role === 'user',
  );
  return user_list.length > 0 ? user_list[user_list.length - 1].content : '';
});

const system = computed(() => {
  const user_list = messageList.value.filter(
    (item: any) => item.role === 'system',
  );
  return user_list.length > 0 ? user_list[user_list.length - 1].content : '';
});

const historyRecord = computed<any>(() => {
  const messages = messageList.value.filter(
    (item: any) => item.role !== 'system',
  );
  if (messages.length > 2) {
    return messages.slice(0, -2);
  }
  return [];
});

const currentChat = computed(() => {
  const messages = messageList.value.filter(
    (item: any) => item.role !== 'system',
  );
  return messages.slice(-2, -1);
});

const AiResponse = computed(() => {
  const messages = messageList.value?.filter(
    (item: any) => item.role !== 'system',
  );
  return messages.slice(-1);
});

// Group execution details by view_type
// Consecutive nodes with view_type !=== 'single_view' are grouped together
// Nodes with view_type === 'single_view' are kept separate
const groupedDetails = computed(() => {
  const sorted = arraySort(props.detail ?? [], 'index');
  const groups: any[][] = [];
  let currentGroup: any[] = [];
  let previousViewType: null | string = null;

  for (const item of sorted) {
    const viewType = item.view_type;

    // Start a new group if:
    // 1. This is the first item, OR
    // 2. Current item is single_view, OR
    // 3. Previous item was single_view
    if (
      currentGroup.length === 0 ||
      viewType === 'single_view' ||
      previousViewType === 'single_view'
    ) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [item];
    } else {
      // Add to current group if both current and previous are not single_view
      currentGroup.push(item);
    }

    previousViewType = viewType;
  }

  // Add the last group
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
});
</script>
<template>
  <div class="execution-details">
    <div v-if="isWorkFlow(props.appType)">
      <template v-for="(group, groupIndex) in groupedDetails" :key="groupIndex">
        <ExecutionDetailCard v-if="group.length === 1" :data="group[0]" />
        <div v-else class="execution-detail-group">
          <template v-for="(item, index) in group" :key="index">
            <ExecutionDetailCard :data="item" />
          </template>
        </div>
      </template>
    </div>

    <template v-else>
      <div class="card-never mb-3 rounded-md">
        <h5 class="p-8-12">
          {{ $$t('aiChat.paragraphSource.question') }}
        </h5>
        <div class="p-8-12 border-t-dashed lighter">
          <span class="mb-2">user: {{ problem }}</span>
        </div>
      </div>
      <div v-if="paddedProblem" class="card-never mb-3 rounded-md">
        <h5 class="p-8-12">
          {{ $$t('aiChat.paragraphSource.questionPadded') }}
        </h5>
        <div class="p-8-12 border-t-dashed lighter">
          <span class="mb-2">user: {{ paddedProblem }}</span>
        </div>
      </div>
      <div v-if="system" class="card-never mb-3 rounded-md">
        <h5 class="p-8-12">
          {{ $$t('views.application.form.roleSettings.label') }}
        </h5>
        <div class="p-8-12 border-t-dashed lighter">
          <span class="mb-2">{{ system }}</span>
        </div>
      </div>

      <div class="card-never mb-3 rounded-md">
        <h5 class="p-8-12">
          {{ $$t('aiChat.history') }}
        </h5>
        <div class="p-8-12 border-t-dashed lighter">
          <div v-for="(msg, index) in historyRecord" :key="index">
            <span>{{ msg.role }}: </span>
            <span>{{ msg.content }}</span>
          </div>
        </div>
      </div>

      <div class="card-never mb-3 rounded-md">
        <h5 class="p-8-12">
          {{ $$t('aiChat.executionDetails.currentChat') }}
        </h5>
        <div class="p-8-12 border-t-dashed lighter">
          <div class="mb-2">
            {{ $$t('aiChat.executionDetails.knowedMessage') }}:
          </div>
          <div v-for="(msg, index) in currentChat" :key="index">
            <span>{{ msg.content }}</span>
          </div>
        </div>
      </div>

      <div class="card-never mb-3 rounded-md">
        <h5 class="p-8-12">
          {{ $$t('aiChat.executionDetails.answer') }}
        </h5>
        <div class="p-8-12 border-t-dashed lighter">
          <div v-for="(msg, index) in AiResponse" :key="index">
            <MdRenderer
              v-if="msg.content"
              :source="msg.content"
              no-img-zoom-in
            />
            <template v-else> -</template>
          </div>
        </div>
      </div>
      <div v-if="errStepMsg" class="card-never mb-3 rounded-md">
        <h5 class="p-8-12">
          {{ $$t('aiChat.executionDetails.errLog') }}
        </h5>
        <div class="p-8-12 border-t-dashed lighter">
          <div>
            <span>{{ errStepMsg }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
<style lang="scss" scoped>
.execution-details {
  :deep(.md-editor-previewOnly) {
    background: none !important;
  }
}
</style>
