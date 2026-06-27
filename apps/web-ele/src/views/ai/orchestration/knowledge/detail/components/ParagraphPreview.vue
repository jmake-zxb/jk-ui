<script setup lang="ts">
import { ref } from 'vue';

import { ElScrollbar, ElTabPane, ElTabs, ElText } from 'element-plus';

import { getImgUrl } from '#/utils/file-util';

import ParagraphList from './ParagraphList.vue';

defineProps<{
  data: any[];
  isConnect?: boolean;
  knowledgeId?: string;
}>();

const activeName = ref(0);
</script>

<template>
  <ElTabs v-model="activeName" class="paragraph-tabs">
    <template v-for="(item, index) in data" :key="index">
      <ElTabPane :label="item.name" :name="index">
        <template #label>
          <div class="flex-center">
            <img
              v-if="item?.name"
              :src="getImgUrl(item.name)"
              alt=""
              height="16"
              class="mr-4"
            />
            <span>{{ item?.name }}</span>
          </div>
        </template>
        <div class="mb-16">
          <ElText type="info">{{ item.content?.length || 0 }} 分段</ElText>
        </div>
        <div v-if="activeName === index" class="paragraph-list">
          <ElScrollbar>
            <ParagraphList
              v-model="item.content"
              :is-connect="isConnect"
              :knowledge-id="knowledgeId"
            />
          </ElScrollbar>
        </div>
      </ElTabPane>
    </template>
  </ElTabs>
</template>

<style scoped lang="scss">
.paragraph-tabs {
  width: 100%;
}

.flex-center {
  display: flex;
  align-items: center;
}

.mb-16 {
  margin-bottom: 16px;
}

.paragraph-list {
  height: calc(100vh - 319px);
}
</style>
