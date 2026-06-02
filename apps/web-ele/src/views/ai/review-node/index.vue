<script lang="ts" setup>
import { reactive, ref } from 'vue';

import { confirm, Page, useVbenModal } from '@vben/common-ui';

import { Delete, EditPen, More } from '@element-plus/icons-vue';
import {
  ElButton,
  ElDivider,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElIcon,
  ElMessage,
  ElPagination,
  ElScrollbar,
  ElSplitter,
  ElSplitterPanel,
  ElTabPane,
  ElTabs,
  ElTooltip,
} from 'element-plus';

import { delObjs, fetchList } from '#/api/ai/reviewNode';
import { $t } from '#/locales';

import NodeFormModalComponent from './node-form.vue';
import RulerFileTab from './ruler-file-tab.vue';
import RulerListTab from './ruler-list-tab.vue';

const fatherNode = ref<any[]>([]);

const nodeActiveId = ref<string>();
const activeName = ref<string>('rulerList');
const nodePage = reactive<Record<string, number>>({
  total: 0,
  current: 1,
  size: 10,
});
const nodeLoading = ref<boolean>(false);

const getFatherNode = async () => {
  nodeLoading.value = true;
  try {
    const res = await fetchList({
      pid: 0,
      size: nodePage.size,
      current: nodePage.current,
      ruleTotal: 1,
    });
    fatherNode.value = res.records;
    nodePage.total = res.total;
    nodeLoading.value = false;
    if (fatherNode.value.length > 0) {
      nodeActiveId.value = fatherNode.value[0].id as string;
      handleClickNode(nodeActiveId.value);
    }
  } catch (error) {
    console.error(error);
    nodeLoading.value = false;
  }
};

const nodeCurrentChange = (val: number) => {
  nodePage.current = val;
  getFatherNode();
};

getFatherNode();

const handleClickNode = async (id: string) => {
  nodeActiveId.value = id;
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
const onOpenNodeEdit = (row: any) => {
  NodeFormModalApi.setData({ type: 'page.common.editBtn', data: row }).open();
};

// 删除操作
const handleDelete = (id: string) => {
  confirm($t('page.common.delConfirmText')).then(async () => {
    try {
      await delObjs([id]);
      getFatherNode();
      ElMessage.success($t('page.common.delSuccessText'));
    } catch (error: any) {
      ElMessage.error(error.msg);
    }
  });
};
</script>

<template>
  <Page auto-content-height>
    <ElSplitter>
      <ElSplitterPanel size="240px" min="240px" max="350px">
        <div class="left-content flex flex-col" v-loading="nodeLoading">
          <ElButton
            type="primary"
            class="w-full"
            plain
            @click="onOpenNodeAdd()"
          >
            新增
          </ElButton>
          <ElDivider border-style="dashed" />
          <ElScrollbar class="flex-1">
            <div class="flex flex-col gap-2">
              <div
                v-for="item in fatherNode"
                :key="item.id"
                class="node-item"
                :class="nodeActiveId === item.id ? 'is-active' : ''"
                @click="handleClickNode(item.id)"
              >
                <div class="flex flex-row">
                  <div
                    class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                  >
                    <ElTooltip :content="item.rwName">
                      {{ item.rwName }}({{ item.ruleTotal }})
                    </ElTooltip>
                  </div>
                  <div>
                    <ElDropdown>
                      <ElIcon class="rotate-90"><More /></ElIcon>
                      <template #dropdown>
                        <ElDropdownMenu>
                          <ElDropdownItem
                            @click="onOpenNodeEdit(item)"
                            :icon="EditPen"
                          >
                            修改
                          </ElDropdownItem>
                          <ElDropdownItem
                            @click="handleDelete(item.id)"
                            :icon="Delete"
                          >
                            删除
                          </ElDropdownItem>
                        </ElDropdownMenu>
                      </template>
                    </ElDropdown>
                  </div>
                </div>
              </div>
              <ElEmpty v-if="fatherNode.length === 0" description="暂无数据" />
            </div>
          </ElScrollbar>
          <div>
            <ElPagination
              size="small"
              layout="prev, pager,next"
              :pager-count="5"
              :total="nodePage.total"
              @current-change="nodeCurrentChange"
            />
          </div>
        </div>
      </ElSplitterPanel>
      <ElSplitterPanel class="ml8 h-full">
        <ElTabs v-model="activeName" class="rw-tabs">
          <ElTabPane label="规则列表" name="rulerList">
            <RulerListTab :node-active-id="nodeActiveId" />
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
  box-sizing: border-box;
  padding: 10px;
  cursor: pointer;
  border-radius: var(--radius);
  transition: all 0.3s;

  &:hover {
    color: hsl(var(--primary));
    background-color: hsl(var(--primary) / 15%);
  }
}

.is-active {
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 15%);
}

.rw-tabs {
  height: 100%;
}

.rw-tabs :deep(.el-tabs__content) {
  display: flex;
  width: 100%;
  height: 100%;

  .el-tab-pane {
    width: 100%;
  }
}

.rw-tabs :deep(.el-tabs__header) {
  padding: 5px 16px;
  background-color: hsl(var(--card));
  border-radius: var(--radius);
}

.rw-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}
</style>
