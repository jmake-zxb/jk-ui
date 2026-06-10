<script setup lang="ts">
/**
 * 思维链折叠卡。
 *
 * 直接渲染后端已抽离的 reasoning_content（无需解析 <think> 分隔符）。
 * 仅服务工作流调试面板。
 */
import { ref } from 'vue';

import { ArrowDown, ArrowRight } from '@element-plus/icons-vue';
import { ElACodeHighlight, ElAMarkdown } from 'element-ai-vue';
import { ElCollapseTransition, ElIcon } from 'element-plus';

defineProps<{ content: string }>();

const expanded = ref(true);
</script>

<template>
  <div class="reasoning-card">
    <button
      type="button"
      class="reasoning-header"
      @click="expanded = !expanded"
    >
      <ElIcon class="reasoning-arrow">
        <ArrowDown v-if="expanded" />
        <ArrowRight v-else />
      </ElIcon>
      <span class="reasoning-title">思考</span>
    </button>
    <ElCollapseTransition>
      <div v-show="expanded" class="reasoning-body">
        <ElAMarkdown :content="content">
          <template #code="props">
            <ElACodeHighlight
              :content="props.content"
              :language="props.language"
              :extend-themes="props.extendThemes"
              :show-line-numbers="false"
            />
          </template>
        </ElAMarkdown>
      </div>
    </ElCollapseTransition>
  </div>
</template>

<style scoped lang="scss">
.reasoning-card {
  margin-bottom: 8px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.reasoning-header {
  display: flex;
  gap: 6px;
  align-items: center;
  width: 100%;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  background: transparent;
  border: none;
}

.reasoning-arrow {
  font-size: 12px;
}

.reasoning-title {
  font-weight: 600;
}

.reasoning-body {
  padding: 0 10px 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
