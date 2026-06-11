<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    sendMessage?: (
      question: string,
      type: 'new' | 'old',
      otherParamsData?: unknown,
    ) => void;
    source?: string;
  }>(),
  {
    sendMessage: undefined,
    source: '',
  },
);

const srcdoc = computed(
  () =>
    `<!doctype html><html><head><base target="_blank" /><style>html,body{margin:0;padding:0;overflow:auto;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}</style></head><body>${props.source}</body></html>`,
);
</script>

<template>
  <iframe
    class="html-render"
    sandbox="allow-forms allow-popups allow-scripts"
    :srcdoc="srcdoc"
  ></iframe>
</template>

<style scoped>
.html-render {
  width: 100%;
  min-height: 240px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
</style>
