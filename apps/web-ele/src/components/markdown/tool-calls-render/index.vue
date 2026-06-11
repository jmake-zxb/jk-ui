<script setup lang="ts">
import type { ToolCallContent } from './index';

import { computed } from 'vue';

import { ElCollapse, ElCollapseItem, ElTag } from 'element-plus';

import { parseJsonLike } from '#/components/ai-chat/utils/markdown';

const props = defineProps<{
  content?: string;
}>();

const calls = computed<ToolCallContent[]>(() => {
  const parsed = parseJsonLike(props.content || '');
  if (Array.isArray(parsed)) return parsed as ToolCallContent[];
  if (parsed && typeof parsed === 'object') return [parsed as ToolCallContent];
  return [];
});

function pretty(value: unknown) {
  return typeof value === 'string'
    ? value
    : JSON.stringify(value ?? {}, null, 2);
}
</script>

<template>
  <ElCollapse v-if="calls.length > 0" class="tool-calls-render">
    <ElCollapseItem
      v-for="(call, index) in calls"
      :key="call.id || index"
      :name="index"
    >
      <template #title>
        <span class="tool-title">{{
          call.name || call.type || 'Tool Call'
        }}</span>
        <ElTag v-if="call.id" class="ml-2" size="small" type="info">
          {{ call.id }}
        </ElTag>
      </template>
      <section v-if="call.arguments !== undefined">
        <h5>参数</h5>
        <pre>{{ pretty(call.arguments) }}</pre>
      </section>
      <section v-if="call.result !== undefined">
        <h5>结果</h5>
        <pre>{{ pretty(call.result) }}</pre>
      </section>
    </ElCollapseItem>
  </ElCollapse>
  <pre v-else class="tool-raw">{{ content }}</pre>
</template>

<style scoped>
.tool-title {
  font-weight: 600;
}

.tool-calls-render pre,
.tool-raw {
  padding: 8px;
  margin: 4px 0 8px;
  overflow: auto;
  font-size: 12px;
  white-space: pre-wrap;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.ml-2 {
  margin-left: 8px;
}
</style>
