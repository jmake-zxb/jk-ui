<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';

import { ElAlert } from 'element-plus';

import { getKnowledgeWorkflowAction } from '#/api/ai/knowledge';
import ExecutionDetailCard from '#/components/execution-detail-card/index.vue';
import { arraySort } from '#/utils/array';

defineOptions({ name: 'Result' });

const props = defineProps<{
  id?: string;
  isRecord?: boolean;
  knowledgeId: string;
}>();

const knowledgeAction = ref<Record<string, any>>();
let pollingTimer: null | ReturnType<typeof setTimeout> = null;

const detail = computed(() => {
  const details = knowledgeAction.value?.details;
  if (Array.isArray(details)) return details;
  if (details && typeof details === 'object') return Object.values(details);
  return [];
});

const state = computed(
  () =>
    knowledgeAction.value?.state || knowledgeAction.value?.status || 'PADDING',
);

function stopPolling() {
  if (pollingTimer) {
    clearTimeout(pollingTimer);
    pollingTimer = null;
  }
}

async function pollAction() {
  if (!pollingTimer || !props.id || !props.knowledgeId) return;
  try {
    knowledgeAction.value = (await getKnowledgeWorkflowAction(
      props.knowledgeId,
      props.id,
    )) as Record<string, any>;
  } finally {
    if (['FAILURE', 'REVOKED', 'SUCCESS'].includes(`${state.value}`)) {
      stopPolling();
    } else {
      pollingTimer = setTimeout(pollAction, 2000);
    }
  }
}

function startPolling() {
  stopPolling();
  pollingTimer = setTimeout(pollAction, 0);
}

watch(
  () => props.id,
  () => {
    if (props.id) startPolling();
  },
  { immediate: true },
);

onUnmounted(stopPolling);
</script>

<template>
  <div>
    <h4 class="title-decoration-1 mb-16 mt-4">执行详情</h4>
    <div v-if="!isRecord" class="mb-16">
      <ElAlert
        v-if="state === 'SUCCESS'"
        title="成功"
        type="success"
        show-icon
        :closable="false"
      />
      <ElAlert
        v-if="state === 'FAILURE'"
        title="失败"
        type="error"
        show-icon
        :closable="false"
      />
    </div>
    <template
      v-for="(item, index) in arraySort(detail ?? [], 'index')"
      :key="index"
    >
      <ExecutionDetailCard :data="item" type="knowledge" />
    </template>
  </div>
</template>

<style scoped lang="scss">
.mb-16 {
  margin-bottom: 16px;
}

.mt-4 {
  margin-top: 4px;
}
</style>
