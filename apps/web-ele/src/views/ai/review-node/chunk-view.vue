<script setup lang="ts">
import type { ScrollbarDirection } from 'element-plus';

import { reactive, ref } from 'vue';

import { EllipsisText, useVbenModal } from '@vben/common-ui';

import { ElCard, ElEmpty, ElScrollbar, ElSpace } from 'element-plus';

import { fetchList } from '#/api/ai/reviewChunk';

const id = ref();
const chunkList = ref<any[]>([]);

const pagesConfig = reactive({
  current: 1,
  size: 10,
  total: 0,
});

// Modal定义
const [Modal, ModalApi] = useVbenModal({
  draggable: true,
  closeOnClickModal: false,
  closeOnPressEscape: false,
  showConfirmButton: false,
  fullscreenButton: false,
  contentClass: 'chunk-view-list',
  onCancel() {
    id.value = null;
    ModalApi.close();
  },
  async onOpenChange(isOpen) {
    if (isOpen) {
      const dat = ModalApi.getData<Record<string, any>>();
      ModalApi.setState({ title: '查看分段' });
      if (dat?.id) {
        id.value = dat?.id;
        pagesConfig.current = 1;
        pagesConfig.size = 10;
        pagesConfig.total = 0;
        chunkList.value = [];
        await getDbConnectionConfigData();
      }
    }
  },
});

// 初始化表单数据
const getDbConnectionConfigData = async () => {
  try {
    ModalApi.setState({ loading: true });
    // 获取数据
    const res = await fetchList({
      docId: id.value,
      current: pagesConfig.current,
      size: pagesConfig.size,
    });
    chunkList.value.push(...res.records);
    pagesConfig.current = res.current;
    pagesConfig.size = res.size;
    pagesConfig.total = res.total;
  } catch (error) {
    console.error(error);
  } finally {
    ModalApi.setState({ loading: false });
  }
};

const loadMore = (direction: ScrollbarDirection) => {
  if (direction === 'bottom' && chunkList.value.length <= pagesConfig.total) {
    pagesConfig.current += 1;
    getDbConnectionConfigData();
  }
};
</script>
<template>
  <Modal class="w-[40%]">
    <ElScrollbar @end-reached="loadMore" height="40vh">
      <ElSpace direction="vertical" :size="20">
        <ElCard v-for="item in chunkList" :key="item.id" shadow="always">
          <EllipsisText :line="3" :tooltip="false">
            {{ item.content }}
          </EllipsisText>
        </ElCard>
      </ElSpace>
      <ElEmpty v-if="chunkList.length === 0" description="暂无数据" />
    </ElScrollbar>
  </Modal>
</template>
<style lang="css">
.chunk-view-list {
  overflow: hidden;
}
</style>
