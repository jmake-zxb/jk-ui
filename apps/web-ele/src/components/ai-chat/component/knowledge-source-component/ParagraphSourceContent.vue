<script setup lang="ts">
import ParagraphCard from './ParagraphCard.vue';

const props = defineProps<{
  detail?: {
    paragraph_list?: Array<Record<string, any>>;
  };
}>();
</script>

<template>
  <div class="paragraph-source-height">
    <div v-if="props.detail?.paragraph_list?.length" class="paragraph-list">
      <ParagraphCard
        v-for="(item, index) in props.detail.paragraph_list"
        :key="`${item.paragraph_id || item.id || index}`"
        :content="item.content"
        :data="item"
        :index="index"
      />
    </div>
    <div v-else class="empty-message">暂无知识来源</div>
  </div>
</template>

<style scoped>
.paragraph-source-height {
  min-height: 100px;
}

.paragraph-list {
  width: 100%;
}

.empty-message {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}
</style>
