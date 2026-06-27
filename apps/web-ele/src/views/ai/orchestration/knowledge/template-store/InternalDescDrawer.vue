<script setup lang="ts">
import { ref, watch } from 'vue';

import { ArrowLeft, Download, Notebook } from '@element-plus/icons-vue';
import { ElAvatar, ElButton, ElDrawer, ElIcon, ElText } from 'element-plus';
import { cloneDeep } from 'lodash-es';

import MarkdownBlock from '#/components/markdown/MarkdownBlock.vue';

const emit = defineEmits<{
  addTool: [data: any];
}>();

const visibleInternalDesc = ref(false);
const markdownContent = ref('');
const toolDetail = ref<any>({});

watch(visibleInternalDesc, (bool) => {
  if (!bool) {
    markdownContent.value = '';
  }
});

function open(data: any, detail: any) {
  toolDetail.value = detail;
  if (data) {
    markdownContent.value = cloneDeep(data);
  }
  visibleInternalDesc.value = true;
}

function addInternalTool(data: any) {
  emit('addTool', data);
  visibleInternalDesc.value = false;
}

function formatDownloads(value: unknown): string {
  return Number(value ?? 0).toLocaleString('zh-CN');
}

defineExpose({
  open,
});
</script>

<template>
  <ElDrawer v-model="visibleInternalDesc" size="60%" :append-to-body="true">
    <template #header>
      <div class="align-center flex" style="margin-left: -8px">
        <ElButton
          class="cursor mr-4"
          link
          @click.prevent="visibleInternalDesc = false"
        >
          <ElIcon :size="20">
            <ArrowLeft />
          </ElIcon>
        </ElButton>
        <h4>详情</h4>
      </div>
    </template>

    <div>
      <div class="border-b">
        <div class="flex-between mb-24">
          <div class="title align-center flex">
            <ElAvatar shape="square" :size="64" style="background: none">
              <ElIcon :size="56"><Notebook /></ElIcon>
            </ElAvatar>
            <div class="ml-16">
              <h3 class="mb-8">{{ toolDetail.name }}</h3>
              <ElText type="info" v-if="toolDetail?.desc">
                {{ toolDetail.desc }}
              </ElText>
              <span
                class="color-secondary align-center mt-8 flex"
                v-if="toolDetail?.downloads !== undefined"
              >
                <ElIcon class="mr-4"><Download /></ElIcon>
                <span>{{ formatDownloads(toolDetail.downloads) }}</span>
              </span>
            </div>
          </div>
          <div @click.stop>
            <ElButton type="primary" @click="addInternalTool(toolDetail)">
              使用
            </ElButton>
          </div>
        </div>
      </div>
      <div class="markdown-content">
        <MarkdownBlock :source="markdownContent" />
      </div>
    </div>
  </ElDrawer>
</template>

<style scoped lang="scss">
.flex {
  display: flex;
}

.align-center {
  align-items: center;
}

.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cursor {
  cursor: pointer;
}

.mr-4 {
  margin-right: 4px;
}

.ml-16 {
  margin-left: 16px;
}

.mb-8 {
  margin-bottom: 8px;
}

.mb-24 {
  margin-bottom: 24px;
}

.mt-8 {
  margin-top: 8px;
}

.border-b {
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.color-secondary {
  color: var(--el-text-color-secondary);
}

.markdown-content {
  padding: 16px;
  margin-top: 16px;
  overflow: auto;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
}
</style>
