<script setup lang="ts">
import { computed } from 'vue';

import { ElInput } from 'element-plus';

const props = defineProps<{
  view?: boolean;
}>();

const inputAttrs = computed(() => {
  return {
    ...(props.view ? { disabled: true } : {}),
  };
});
</script>

<template>
  <ElInput v-bind="{ ...$attrs, ...inputAttrs }" />
</template>
