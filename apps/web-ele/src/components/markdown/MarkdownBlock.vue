<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

import { usePreferences } from '@vben/preferences';

import { MdPreview } from 'md-editor-v3';
import mediumZoom from 'medium-zoom';

import 'md-editor-v3/lib/preview.css';

const props = withDefaults(
  defineProps<{
    source?: string;
  }>(),
  {
    source: '',
  },
);

const { isDark } = usePreferences();

const mdRef = ref<HTMLElement>();

function applyZoom() {
  nextTick(() => {
    if (mdRef.value) {
      mdRef.value
        .querySelectorAll('img:not(.medium-zoom-image)')
        .forEach((img) => {
          mediumZoom(img as HTMLImageElement, {
            background: 'var(--el-bg-color)',
          });
        });
    }
  });
}

watch(
  () => props.source,
  () => applyZoom(),
  { immediate: true },
);
</script>

<template>
  <div ref="mdRef" class="maxkb-md">
    <MdPreview
      editor-id="chat-preview"
      :model-value="source"
      no-iconfont
      no-prettier
      :code-foldable="false"
      preview-theme="default"
      :theme="isDark ? 'dark' : 'light'"
    />
  </div>
</template>

<style scoped lang="scss">
.maxkb-md {
  font-size: 14px;
  line-height: 1.65;
  color: var(--el-text-color-primary);
  overflow-wrap: anywhere;
}

.maxkb-md :deep(.md-editor) {
  background: transparent;
  border: none;
}

.maxkb-md :deep(.md-editor-preview) {
  font-size: 14px;
  background: transparent;
}

.maxkb-md :deep(.md-editor-preview .markdown-body) {
  color: var(--el-text-color-primary);
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

.maxkb-md :deep(ul),
.maxkb-md :deep(ol) {
  padding-left: 1.25rem;
  margin: 0.35rem 0;
}

.maxkb-md :deep(pre) {
  padding: 10px 12px;
  margin: 0.5rem 0;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  scrollbar-width: thin;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.maxkb-md :deep(pre::-webkit-scrollbar) {
  width: 4px;
  height: 4px;
}

.maxkb-md :deep(pre::-webkit-scrollbar-thumb) {
  background: var(--md-scrollbar-thumb-color, var(--el-border-color));
  border-radius: 4px;
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
  scrollbar-width: thin;
  background: transparent;
}

.maxkb-md :deep(pre code::-webkit-scrollbar) {
  width: 4px;
  height: 4px;
}

.maxkb-md :deep(pre code::-webkit-scrollbar-thumb) {
  background: var(--md-scrollbar-thumb-color, var(--el-border-color));
  border-radius: 4px;
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
  cursor: zoom-in;
}

.medium-zoom-overlay {
  z-index: 999;
}

.medium-zoom-image--opened {
  z-index: 1000;
  cursor: zoom-out;
}

.maxkb-md :deep(blockquote) {
  padding-left: 10px;
  margin: 0.5rem 0;
  color: var(--el-text-color-secondary);
  border-left: 3px solid var(--el-border-color);
}

.maxkb-md :deep(table) {
  display: block;
  width: 100%;
  overflow: auto;
  border-spacing: 0;
  border-collapse: collapse;
}

.maxkb-md :deep(table th),
.maxkb-md :deep(table td) {
  padding: 6px 13px;
  border: 1px solid var(--el-border-color);
}

.maxkb-md :deep(table th) {
  font-weight: 600;
  background: var(--el-fill-color-light);
}

.maxkb-md :deep(table tr) {
  background: transparent;
}

.maxkb-md :deep(table tr:nth-child(2n)) {
  background: var(--el-fill-color-lighter);
}
</style>
