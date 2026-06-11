<script setup lang="ts">
import { computed } from 'vue';

import { parseJsonLike } from '#/components/ai-chat/utils/markdown';

const props = defineProps<{
  option: string;
}>();

const display = computed(() => {
  const parsed = parseJsonLike(props.option);
  return parsed === undefined ? props.option : JSON.stringify(parsed, null, 2);
});
</script>

<template>
  <pre class="chart-json">{{ display }}</pre>
</template>

<style scoped>
.chart-json {
  max-height: 320px;
  padding: 10px 12px;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  white-space: pre-wrap;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}
</style>
