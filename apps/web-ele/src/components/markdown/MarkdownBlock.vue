<script setup lang="ts">
import { computed } from 'vue';

import { renderMarkdown } from '#/components/ai-chat/utils/markdown';

const props = withDefaults(
  defineProps<{
    source?: string;
  }>(),
  {
    source: '',
  },
);

const html = computed(() => renderMarkdown(props.source));
</script>

<template>
  <div class="maxkb-md" v-html="html"></div>
</template>

<style scoped lang="scss">
.maxkb-md {
  line-height: 1.65;
  color: var(--el-text-color-primary);
  overflow-wrap: anywhere;
}

.maxkb-md :deep(p) {
  margin: 0.35rem 0;
}

.maxkb-md :deep(h1),
.maxkb-md :deep(h2),
.maxkb-md :deep(h3),
.maxkb-md :deep(h4),
.maxkb-md :deep(h5),
.maxkb-md :deep(h6) {
  margin: 0.6rem 0 0.35rem;
  font-weight: 700;
  line-height: 1.35;
}

.maxkb-md :deep(ul) {
  padding-left: 1.25rem;
  margin: 0.35rem 0;
}

.maxkb-md :deep(pre) {
  padding: 10px 12px;
  margin: 0.5rem 0;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.maxkb-md :deep(code) {
  padding: 1px 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.92em;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

.maxkb-md :deep(pre code) {
  padding: 0;
  background: transparent;
}

.maxkb-md :deep(a) {
  color: var(--el-color-primary);
  text-decoration: none;
}

.maxkb-md :deep(a:hover) {
  text-decoration: underline;
}

.maxkb-md :deep(img) {
  display: inline-block;
  max-width: 100%;
  min-height: 33px;
  padding: 0;
  margin: 0;
  vertical-align: middle;
}

.maxkb-md :deep(blockquote) {
  padding-left: 10px;
  margin: 0.5rem 0;
  color: var(--el-text-color-secondary);
  border-left: 3px solid var(--el-border-color);
}
</style>
