<script setup lang="ts">
import { computed } from 'vue';

import { ElEmpty } from 'element-plus';

const props = defineProps<{
  detail?: Record<string, any>;
}>();

const meta = computed<Record<string, any>>(() => {
  const raw = props.detail?.meta ?? props.detail?.metadata;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw && typeof raw === 'object' ? raw : {};
});

const previewUrl = computed(() => {
  if (meta.value.source_url) return `${meta.value.source_url}`;
  if (meta.value.source_file_id)
    return `/admin/sys-file/details?id=${encodeURIComponent(`${meta.value.source_file_id}`)}`;
  return '';
});
</script>

<template>
  <div class="paragraph-document-content">
    <iframe v-if="previewUrl" class="document-frame" :src="previewUrl"></iframe>
    <ElEmpty v-else description="暂无文档预览" />
  </div>
</template>

<style scoped>
.paragraph-document-content {
  width: 100%;
  min-height: 480px;
}

.document-frame {
  width: 100%;
  height: calc(100vh - 260px);
  min-height: 480px;
  border: 0;
}
</style>
