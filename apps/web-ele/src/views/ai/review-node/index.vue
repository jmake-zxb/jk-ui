<script lang="ts" setup>
import { ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';

import {
  ElButton,
  ElDivider,
  ElEmpty,
  ElScrollbar,
  ElSplitter,
  ElSplitterPanel,
  ElTabPane,
  ElTabs,
} from 'element-plus';

import { fetchList } from '#/api/ai/reviewNode';

import NodeFormModalComponent from './node-form.vue';
import RulerFileTab from './ruler-file-tab.vue';
import RulerListTab from './ruler-list-tab.vue';

const fatherNode = ref<any[]>([]);
const prentNode = ref<any[]>([]);
const nodeActiveId = ref<string>();
const activeName = ref<string>('rulerList');

const getFatherNode = async () => {
  const res = await fetchList({ pid: 0 });
  fatherNode.value = res.records;
  if (fatherNode.value.length > 0) {
    nodeActiveId.value = fatherNode.value[0].id as string;
    handleClickNode(nodeActiveId.value);
  }
};

getFatherNode();

const handleClickNode = async (id: string) => {
  nodeActiveId.value = id;
  // 请求接口
  const res = await fetchList({ pid: id });
  prentNode.value = res.records;
};

const [NodeFormModal, NodeFormModalApi] = useVbenModal({
  // 连接抽离的组件
  connectedComponent: NodeFormModalComponent,
});

// 新增操作
const onOpenNodeAdd = (row?: any) => {
  NodeFormModalApi.setData({ type: 'page.common.addBtn', data: row }).open();
};

// 编辑操作
// const onOpenNodeEdit = (row: any) => {
//   NodeFormModalApi.setData({ type: 'page.common.editBtn', data: row }).open();
// };
</script>

<template>
  <Page auto-content-height>
    <ElSplitter>
      <ElSplitterPanel size="220px" min="200px" max="350px">
        <div class="left-content">
          <ElScrollbar>
            <div class="flex flex-col gap-2">
              <ElButton type="primary" plain @click="onOpenNodeAdd()">
                新增
              </ElButton>
              <ElDivider border-style="dashed" />
              <div
                v-for="item in fatherNode"
                :key="item.id"
                class="node-item"
                :class="nodeActiveId === item.id ? 'is-active' : ''"
                @click="handleClickNode(item.id)"
              >
                {{ item.rwName }}
              </div>
            </div>
            <ElEmpty v-if="fatherNode.length === 0" description="暂无数据" />
          </ElScrollbar>
        </div>
      </ElSplitterPanel>
      <ElSplitterPanel class="ml8 h-full">
        <ElTabs v-model="activeName" class="rw-tabs">
          <ElTabPane label="规则列表" name="rulerList">
            <RulerListTab />
          </ElTabPane>
          <ElTabPane label="规则文件" name="rulerFile">
            <RulerFileTab />
          </ElTabPane>
        </ElTabs>
      </ElSplitterPanel>
    </ElSplitter>
    <!-- 一级目录编辑、新增弹窗 -->
    <NodeFormModal @refresh="() => getFatherNode()" />
    <!-- 规则分类编辑、新增弹窗 -->
    <!-- <RulerFormModal @refresh="() => handleClickNode(nodeActiveId as string)" /> -->
  </Page>
</template>

<style lang="scss" scoped>
.div {
  margin-top: 90px;
}

:deep(.ml8) {
  margin-left: 8px;
}

:deep(.el-splitter-panel) {
  overflow: hidden;
}

:deep(.el-splitter-bar__dragger-horizontal)::before {
  width: 0;
}

.left-content {
  width: 100%;
  height: 100%;
  padding: 10px;
  overflow: hidden;
  background-color: hsl(var(--card));
  border-radius: calc(var(--radius) - 2px);
  :deep(.el-divider--horizontal) {
    margin: 12px 0;
  }
}

.node-item {
  padding: 10px;
  border-radius: var(--radius);
  transition: all 0.3s;
  cursor: pointer;
  box-sizing: border-box;
  &:hover {
    background-color: hsl(var(--primary) / 15%);
    color: hsl(var(--primary));
  }
}

.is-active {
  background-color: hsl(var(--primary) / 15%);
  color: hsl(var(--primary));
}

.rw-tabs {
  height: 100%;
}

.rw-tabs :deep(.el-tabs__content) {
  display: flex;
  height: 100%;
  width: 100%;
  .el-tab-pane {
    width: 100%;
  }
}

.rw-tabs :deep(.el-tabs__header) {
  padding: 5px 16px;
  border-radius: var(--radius);
  background-color: hsl(var(--card));
}
.rw-tabs :deep(.el-tabs__nav-wrap:after) {
  display: none;
}
</style>
