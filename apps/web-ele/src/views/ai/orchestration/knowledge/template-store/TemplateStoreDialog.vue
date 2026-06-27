<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';

import { Search } from '@element-plus/icons-vue';
import {
  ElCol,
  ElDialog,
  ElDivider,
  ElEmpty,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElRow,
  ElScrollbar,
} from 'element-plus';

import { requestClient } from '#/api/request';

import CreateWorkflowKnowledgeDialog from '../create-component/CreateWorkflowKnowledgeDialog.vue';
import InternalDescDrawer from './InternalDescDrawer.vue';
import TemplateCard from './TemplateCard.vue';

interface ToolCategory {
  id: string;
  title: string;
  tools: any[];
}

const props = defineProps({
  apiType: {
    type: String,
    default: 'workspace',
  },
  source: {
    type: String,
    default: 'knowledge',
  },
});

const emit = defineEmits<{
  refresh: [];
}>();

const route = useRoute();
const dialogVisible = ref(false);
const searchValue = ref('');
const folderId = ref('');
const categories = ref<ToolCategory[]>([]);
const filterList = ref<any>(null);
const addLoading = ref(false);

const internalDescDrawerRef = ref<InstanceType<typeof InternalDescDrawer>>();
const CreateKnowledgeDialogRef =
  ref<InstanceType<typeof CreateWorkflowKnowledgeDialog>>();

function getSubTitle(tool: any) {
  return categories.value.find((i) => i.id === tool.label)?.title ?? '';
}

function open(id: string) {
  folderId.value = id;
  filterList.value = null;
  dialogVisible.value = true;
  getList();
}

async function getList() {
  filterList.value = null;
  const v1 = await getStoreToolList();

  const merged: ToolCategory[] = [];
  for (const category of v1) {
    const existing = merged.find((item: any) => item.id === category.id);
    if (existing) {
      existing.tools = [...existing.tools, ...category.tools];
    } else {
      merged.push({ ...category });
    }
  }

  categories.value = merged.filter((item: any) => item.tools.length > 0);
}

async function getStoreToolList(): Promise<ToolCategory[]> {
  try {
    const res = await requestClient.get(
      '/ai/api/knowledge/template-store/list',
      {
        params: { name: searchValue.value },
      },
    );
    const data = res as any;
    const tags = data.additionalProperties?.tags ?? [];
    const storeTools = data.apps ?? [];

    storeTools.forEach((tool: any) => {
      tool.desc = tool.description;
    });

    if (searchValue.value.length > 0) {
      filterList.value = [...storeTools, ...(filterList.value || [])];
      return [];
    }

    filterList.value = null;
    return tags.map((tag: any) => ({
      id: tag.key,
      title: tag.name,
      tools: storeTools.filter((tool: any) => tool.label === tag.key),
    }));
  } catch (error) {
    console.error(error);
    return [];
  }
}

async function handleDetail(tool: any) {
  internalDescDrawerRef.value?.open(tool.readMe, tool);
}

function handleOpenAdd(data?: any) {
  if (props.source === 'work_flow') {
    ElMessageBox.confirm(
      `确认使用 ${data.name} 模板？这将覆盖当前工作流配置。`,
      '提示',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
      },
    )
      .then(() => {
        handleStoreAdd(data);
      })
      .catch(() => {});
  } else {
    CreateKnowledgeDialogRef.value?.open({ id: folderId.value }, data);
  }
}

async function handleStoreAdd(tool: any) {
  const knowledgeId = (route.params.id as string) || folderId.value;
  try {
    await requestClient.put(`/ai/api/knowledge/${knowledgeId}/workflow`, {
      work_flow_template: tool,
    });
    emit('refresh');
    ElMessage.success('添加成功');
    dialogVisible.value = false;
  } catch (error) {
    console.error(error);
  }
}

defineExpose({ open });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    width="1000"
    append-to-body
    class="template-store-dialog"
    align-center
    :close-on-click-modal="false"
    :close-on-press-escape="false"
  >
    <template #header="{ titleId }">
      <div class="dialog-header flex-between mb-8">
        <h4 :id="titleId" class="medium w-240 mr-8">模板中心</h4>

        <div class="align-center flex" style="margin-right: 28px">
          <ElInput
            v-model="searchValue"
            placeholder="搜索"
            :prefix-icon="Search"
            class="w-240 mr-8"
            clearable
            @change="getList"
          />
          <ElDivider direction="vertical" />
        </div>
      </div>
    </template>

    <ElScrollbar
      class="layout-bg"
      wrap-class="p-16-24 category-scrollbar"
      style="border-radius: 0 0 8px 8px"
    >
      <template v-if="filterList === null">
        <div v-for="category in categories" :key="category.id">
          <ElRow :gutter="16">
            <ElCol
              v-for="tool in category.tools"
              :key="tool.id"
              :span="8"
              class="mb-16"
            >
              <TemplateCard
                :tool="tool"
                :add-loading="addLoading"
                :get-sub-title="getSubTitle"
                @handle-add="handleOpenAdd(tool)"
                @handle-detail="handleDetail(tool)"
              />
            </ElCol>
          </ElRow>
        </div>
      </template>
      <div v-else>
        <ElRow v-if="filterList.length > 0" :gutter="16">
          <ElCol
            v-for="tool in filterList"
            :key="tool.id"
            :span="8"
            class="mb-16"
          >
            <TemplateCard
              :tool="tool"
              :add-loading="addLoading"
              :get-sub-title="getSubTitle"
              @handle-add="handleOpenAdd(tool)"
              @handle-detail="handleDetail(tool)"
            />
          </ElCol>
        </ElRow>
        <ElEmpty v-else description="暂无数据" />
      </div>
    </ElScrollbar>
  </ElDialog>

  <InternalDescDrawer ref="internalDescDrawerRef" @add-tool="handleOpenAdd" />
  <CreateWorkflowKnowledgeDialog ref="CreateKnowledgeDialogRef" />
</template>

<style lang="scss">
.template-store-dialog {
  padding: 0;

  .el-dialog__headerbtn {
    top: 7px;
  }

  .el-dialog__header {
    padding: 12px 20px 4px 24px;
    border-bottom: 1px solid var(--el-border-color-light);

    .dialog-header {
      position: relative;

      .store-type {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
    }
  }

  .el-anchor {
    background-color: var(--app-layout-bg-color);

    .el-anchor__marker {
      display: none;
    }

    .el-anchor__list {
      padding: 8px;
    }

    .el-anchor__item {
      .el-anchor__link {
        padding: 8px 16px;
        font-size: 14px;
        font-weight: 500;
        color: var(--el-text-color-primary);
        border-radius: 6px;

        &.is-active {
          color: var(--el-color-primary);
          background-color: var(--el-color-primary-light-9);
        }
      }
    }
  }

  .category-scrollbar {
    min-height: 500px;
    max-height: calc(100vh - 200px);
  }
}
</style>

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

.mr-8 {
  margin-right: 8px;
}

.mb-8 {
  margin-bottom: 8px;
}

.mb-16 {
  margin-bottom: 16px;
}

.w-240 {
  width: 240px;
}

.medium {
  font-weight: 500;
}

.layout-bg {
  background: var(--el-fill-color-lighter);
}

.p-16-24 {
  padding: 16px 24px;
}
</style>
