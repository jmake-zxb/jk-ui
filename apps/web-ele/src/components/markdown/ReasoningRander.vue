<script setup lang="ts">
import { ref } from 'vue';

import { ArrowDown, ArrowRight } from '@element-plus/icons-vue';
import { ElIcon } from 'element-plus';

import MarkdownBlock from './MarkdownBlock.vue';

const props = defineProps<{
  content?: string;
}>();

const expanded = ref(false);
</script>

<template>
  <div v-if="props.content?.trim()" class="reasoning-render">
    <button class="reasoning-head" type="button" @click="expanded = !expanded">
      <ElIcon>
        <ArrowDown v-if="expanded" />
        <ArrowRight v-else />
      </ElIcon>
      <span>思考过程</span>
    </button>
    <MarkdownBlock
      v-show="expanded"
      class="reasoning-body"
      :source="props.content"
    />
  </div>
</template>

<style scoped lang="scss">
.reasoning-render {
  margin-bottom: 8px;
  color: var(--el-text-color-secondary);
  border-left: 3px solid var(--el-border-color);
}

.reasoning-head {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 2px 0 2px 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  background: transparent;
  border: 0;
}

.reasoning-body {
  padding: 4px 0 6px 8px;
}
</style>
