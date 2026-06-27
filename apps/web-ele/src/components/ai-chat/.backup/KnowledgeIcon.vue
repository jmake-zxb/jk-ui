<script setup lang="ts">
import { computed } from 'vue';

import { Collection, Files, Link } from '@element-plus/icons-vue';
import { ElIcon } from 'element-plus';

const props = withDefaults(
  defineProps<{
    size?: number;
    type?: string;
  }>(),
  {
    size: 18,
    type: '',
  },
);

const icon = computed(() => {
  const type = props.type?.toLowerCase() || '';
  if (type.includes('web') || type.includes('url')) return Link;
  if (type.includes('file') || type.includes('document')) return Files;
  return Collection;
});
</script>

<template>
  <ElIcon :size="size"><component :is="icon" /></ElIcon>
</template>
