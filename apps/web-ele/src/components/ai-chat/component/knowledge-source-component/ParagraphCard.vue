<script setup lang="ts">
import { computed } from 'vue';

import { ElCard, ElScrollbar, ElText } from 'element-plus';

import MarkdownBlock from '#/components/markdown/MarkdownBlock.vue';
import { getImgUrl } from '#/utils/file-util';

import CardBox from './CardBox.vue';
import KnowledgeIcon from './KnowledgeIcon.vue';

const props = withDefaults(
  defineProps<{
    content?: string;
    data?: Record<string, any>;
    index?: number;
    score?: null | number;
  }>(),
  {
    content: '',
    data: () => ({}),
    index: 0,
    score: null,
  },
);

const meta = computed<Record<string, any>>(() => {
  if (typeof props.data.meta === 'string') {
    try {
      return JSON.parse(props.data.meta);
    } catch {
      return {};
    }
  }
  return props.data.meta && typeof props.data.meta === 'object'
    ? props.data.meta
    : {};
});

const documentName = computed(
  () => `${props.data.document_name || props.data.title || '知识段落'}`,
);
const scoreText = computed(() =>
  (props.score ?? props.data.similarity ?? props.data.score)?.toFixed?.(3),
);

function getFileUrl(fileId?: number | string) {
  if (!fileId) return '';
  return `/admin/sys-file/details?id=${encodeURIComponent(`${fileId}`)}`;
}
</script>

<template>
  <CardBox
    :title="`${index + 1}.${data.title || documentName || '-'}`"
    class="paragraph-source-card"
    :class="data.is_active === false ? 'is-disabled' : ''"
  >
    <template #tag>
      <div class="score">{{ scoreText || '-' }}</div>
    </template>

    <ElScrollbar height="150">
      <MarkdownBlock :source="content" />
    </ElScrollbar>

    <template #footer>
      <ElCard v-if="documentName.trim()" shadow="never" class="doc-card">
        <ElText class="doc-row">
          <img :src="getImgUrl(documentName.trim())" alt="" width="20" />
          <a
            v-if="meta.source_file_id || meta.source_url"
            :href="getFileUrl(meta.source_file_id) || meta.source_url"
            target="_blank"
            rel="noopener noreferrer"
            :title="documentName.trim()"
          >
            {{ documentName.trim() }}
          </a>
          <span v-else :title="documentName.trim()">{{
            documentName.trim()
          }}</span>
        </ElText>
      </ElCard>
      <div class="knowledge-row">
        <KnowledgeIcon :type="data.knowledge_type" :size="18" />
        <span :title="data.knowledge_name">{{
          data.knowledge_name || '-'
        }}</span>
      </div>
    </template>
  </CardBox>
</template>

<style scoped>
.paragraph-source-card {
  height: 300px;
  margin-bottom: 8px;
}

.paragraph-source-card.is-disabled {
  opacity: 0.65;
}

.score {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-color-primary);
}

.doc-card {
  width: 100%;
  margin-bottom: 12px;
}

.doc-card :deep(.el-card__body) {
  padding: 8px;
}

.doc-row,
.knowledge-row {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.doc-row a,
.doc-row span,
.knowledge-row span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-row a {
  color: var(--el-color-primary);
  text-decoration: none;
}

.knowledge-row {
  padding-top: 10px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
