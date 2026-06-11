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

const src = computed(() => props.source.trim());
</script>

<template>
  <iframe
    v-if="src"
    class="iframe-render"
    referrerpolicy="no-referrer"
    sandbox="allow-forms allow-popups allow-scripts allow-same-origin"
    :src="src"
  ></iframe>
</template>

<style scoped>
.iframe-render {
  width: 100%;
  min-height: 320px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
</style>
