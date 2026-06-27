<script setup lang="ts">
import { Download, Notebook } from '@element-plus/icons-vue';
import { ElAvatar, ElButton, ElIcon } from 'element-plus';

const props = defineProps<{
  addLoading: boolean;
  getSubTitle: (v: any) => string;
  tool: any;
}>();

const emit = defineEmits<{
  handleAdd: [];
  handleDetail: [];
}>();

function formatDownloads(value: unknown): string {
  return Number(value ?? 0).toLocaleString('zh-CN');
}
</script>

<template>
  <article class="template-card knowledge-card">
    <header class="knowledge-card__head">
      <ElAvatar shape="square" :size="32" style="background: none">
        <ElIcon :size="28"><Notebook /></ElIcon>
      </ElAvatar>
      <div class="knowledge-card__title">
        <strong :title="props.tool?.name" class="ellipsis">
          {{ props.tool?.name }}
        </strong>
      </div>
    </header>

    <p class="knowledge-card__desc">{{ props.tool?.desc }}</p>

    <footer class="knowledge-card__footer template-card__footer">
      <span
        v-if="props.tool?.downloads !== undefined"
        class="template-card__downloads"
      >
        <ElIcon class="mr-4"><Download /></ElIcon>
        <span>{{ formatDownloads(props.tool.downloads) }}</span>
      </span>

      <div class="template-card__operations mb-8" @click.stop>
        <ElButton @click="emit('handleDetail')"> 详情 </ElButton>
        <ElButton
          type="primary"
          :loading="props.addLoading"
          @click="emit('handleAdd')"
        >
          使用
        </ElButton>
      </div>
    </footer>
  </article>
</template>

<style scoped lang="scss">
.template-card {
  cursor: pointer;
}

.template-card__footer {
  position: relative;
}

.template-card__downloads {
  display: flex;
  align-items: center;
  color: var(--el-text-color-secondary);
}

.template-card__operations {
  display: none;
  gap: 8px;

  .el-button {
    flex: 1;
  }
}

.template-card:hover .template-card__downloads {
  display: none;
}

.template-card:hover .template-card__operations {
  display: flex;
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mr-4 {
  margin-right: 4px;
}

.mb-8 {
  margin-bottom: 8px;
}
</style>
