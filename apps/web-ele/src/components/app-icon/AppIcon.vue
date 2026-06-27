<script setup lang="ts">
import { computed } from 'vue';

import {
  CircleCheck,
  CircleClose,
  CopyDocument,
  Delete,
  Document,
  Edit,
  Share,
  VideoPause,
  VideoPlay,
} from '@element-plus/icons-vue';
import { ElIcon } from 'element-plus';

defineOptions({ name: 'AppIcon' });

const props = withDefaults(
  defineProps<{
    iconName?: string;
  }>(),
  {
    iconName: '',
  },
);

// Map MaxKB icon names to Element Plus icons
const iconMap: Record<string, any> = {
  'app-video-play': VideoPlay,
  'app-video-pause': VideoPause,
  'app-copy': CopyDocument,
  'app-delete': Delete,
  'app-edit': Edit,
  'app-document-active': Document,
  'app-share': Share,
  'app-like-color': CircleCheck,
  'app-oppose-color': CircleClose,
};

const iconComponent = computed(() => {
  return iconMap[props.iconName] || Document;
});
</script>

<template>
  <ElIcon v-if="iconName">
    <component :is="iconComponent" />
  </ElIcon>
</template>

<style lang="scss" scoped></style>
