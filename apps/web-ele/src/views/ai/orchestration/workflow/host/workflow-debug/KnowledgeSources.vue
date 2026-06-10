<script setup lang="ts">
/**
 * 工作流调试 — 知识来源列表。
 *
 * 数据来自 AI/检索类节点 node_end payload.knowledgeSources。
 * 列表渲染 title + score + content 摘要，可展开看完整段落。
 */
import type { KnowledgeSource } from './types';

import { ref } from 'vue';

import { ArrowRight } from '@element-plus/icons-vue';
import { ElIcon, ElTag } from 'element-plus';

defineProps<{
  sources: KnowledgeSource[];
}>();

const expanded = ref<Set<number>>(new Set());

function toggle(index: number) {
  if (expanded.value.has(index)) expanded.value.delete(index);
  else expanded.value.add(index);
}

function scoreText(score?: number): string {
  if (typeof score !== 'number' || Number.isNaN(score)) return '';
  return score.toFixed(2);
}

function sourceTitle(source: KnowledgeSource, index: number): string {
  return `${source.title || ''}`.trim() || `来源 ${index + 1}`;
}
</script>

<template>
  <div class="knowledge-sources">
    <div
      v-for="(source, index) in sources"
      :key="`${source.id ?? index}`"
      class="ks-item"
    >
      <div class="ks-head" @click="toggle(index)">
        <ElIcon class="ks-arrow" :class="{ 'is-open': expanded.has(index) }">
          <ArrowRight />
        </ElIcon>
        <span class="ks-title" :title="sourceTitle(source, index)">
          {{ sourceTitle(source, index) }}
        </span>
        <ElTag
          v-if="scoreText(source.score)"
          size="small"
          type="info"
          class="ks-score"
        >
          {{ scoreText(source.score) }}
        </ElTag>
      </div>
      <div v-if="expanded.has(index)" class="ks-body">
        {{ source.content || '（无内容）' }}
      </div>
    </div>
    <div v-if="sources.length === 0" class="ks-empty">无知识来源</div>
  </div>
</template>

<style scoped lang="scss">
.knowledge-sources {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ks-item {
  overflow: hidden;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.ks-head {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 6px 8px;
  cursor: pointer;
}

.ks-arrow {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  transition: transform 0.2s;
}

.ks-arrow.is-open {
  transform: rotate(90deg);
}

.ks-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.ks-score {
  flex-shrink: 0;
}

.ks-body {
  padding: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
  border-top: 1px solid var(--el-border-color-lighter);
}

.ks-empty {
  padding: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
