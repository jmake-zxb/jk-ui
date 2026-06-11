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
    <span v-else>暂无知识来源</span>
  </div>
</template>

<style scoped>
.paragraph-list {
  width: 100%;
}
</style>
