<script setup lang="ts">
import { computed } from 'vue';

import { ElCard, ElTag } from 'element-plus';

import MarkdownBlock from '#/components/markdown/MarkdownBlock.vue';

const props = defineProps<{
  appType?: string;
  detail?: Array<Record<string, any>>;
}>();

const sortedDetail = computed(() =>
  [...(props.detail ?? [])].toSorted(
    (a, b) => Number(a.index ?? 0) - Number(b.index ?? 0),
  ),
);

function statusType(status: unknown) {
  if (status === 500 || status === 'FAILED') return 'danger';
  if (status === 'RUNNING') return 'primary';
  if (status === 'WARNING') return 'warning';
  return 'success';
}

function title(item: Record<string, any>) {
  return (
    item.node_name ||
    item.step_name ||
    item.step_type ||
    item.type ||
    '执行步骤'
  );
}
</script>

<template>
  <div class="execution-details">
    <ElCard
      v-for="(item, index) in sortedDetail"
      :key="index"
      shadow="never"
      class="detail-card"
    >
      <template #header>
        <div class="detail-head">
          <span>{{ title(item) }}</span>
          <ElTag :type="statusType(item.status)" size="small">
            {{ item.status || 'SUCCESS' }}
          </ElTag>
        </div>
      </template>
      <section v-if="item.content" class="detail-section">
        <h5>内容</h5>
        <MarkdownBlock :source="`${item.content}`" />
      </section>
      <section v-if="item.input" class="detail-section">
        <h5>输入</h5>
        <pre>{{ item.input }}</pre>
      </section>
      <section v-if="item.err_message" class="detail-section is-error">
        <h5>错误</h5>
        <div>{{ item.err_message }}</div>
      </section>
    </ElCard>
    <span v-if="sortedDetail.length === 0">暂无执行详情</span>
  </div>
</template>

<style scoped>
.detail-card {
  margin-bottom: 12px;
}

.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.detail-section + .detail-section {
  margin-top: 10px;
}

.detail-section h5 {
  margin: 0 0 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.detail-section pre {
  padding: 8px;
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.is-error {
  color: var(--el-color-danger);
}
</style>
