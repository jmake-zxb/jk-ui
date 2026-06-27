<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { onBeforeRouteLeave, useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Folder, FolderOpened, Refresh } from '@element-plus/icons-vue';
import {
  ElBreadcrumb,
  ElBreadcrumbItem,
  ElButton,
  ElEmpty,
  ElIcon,
  ElInput,
  ElScrollbar,
  ElTree,
} from 'element-plus';

import { treeKnowledge } from '#/api/ai/knowledge';

import KnowledgeListContainer from './components/KnowledgeListContainer.vue';
import KnowledgeDetailPage from './detail/index.vue';

interface KnowledgeFolder extends Record<string, any> {
  children?: KnowledgeFolder[];
  id?: number | string;
  name?: string;
  parentId?: number | string;
  parent_id?: number | string;
}

const loading = ref(false);
const route = useRoute();
const folderList = ref<KnowledgeFolder[]>([]);
const currentFolder = ref<KnowledgeFolder>({ id: '', name: '全部知识库' });
const folderKeyword = ref('');
const isDetailRoute = computed(() => Boolean(route.params.id));

const visibleFolderList = computed(() => {
  const root = {
    children: filterFolders(folderList.value, folderKeyword.value),
    id: '',
    name: '全部知识库',
  };
  return [root];
});

const breadcrumbs = computed<KnowledgeFolder[]>(() => {
  if (!currentFolder.value.id) return [];
  const chain: KnowledgeFolder[] = [];
  let node: KnowledgeFolder | undefined = currentFolder.value;
  while (node && node.id) {
    chain.unshift(node);
    const pid = node.parentId ?? node.parent_id;
    node = pid ? findFolderById(folderList.value, `${pid}`) : undefined;
  }
  return chain;
});

function findFolderById(
  folders: KnowledgeFolder[],
  id: string,
): KnowledgeFolder | undefined {
  for (const f of folders) {
    if (`${f.id ?? ''}` === id) return f;
    if (f.children) {
      const found = findFolderById(f.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

function folderName(folder?: KnowledgeFolder) {
  return folder?.name || '未命名文件夹';
}

function filterFolders(
  folders: KnowledgeFolder[],
  keyword: string,
): KnowledgeFolder[] {
  const value = keyword.trim().toLowerCase();
  if (!value) return folders;
  return folders
    .map((folder): KnowledgeFolder | null => {
      const children = filterFolders(folder.children || [], keyword);
      const matched = folderName(folder).toLowerCase().includes(value);
      return matched || children.length > 0 ? { ...folder, children } : null;
    })
    .filter((folder): folder is KnowledgeFolder => folder !== null);
}

async function getFolder(resetCurrent = false) {
  loading.value = true;
  try {
    const data = await treeKnowledge();
    folderList.value = Array.isArray(data)
      ? data
      : data?.records || data?.items || [];
    if (resetCurrent) {
      const first = firstLeaf(folderList.value);
      currentFolder.value = first || { id: '', name: '全部知识库' };
    }
  } finally {
    loading.value = false;
  }
}

function firstLeaf(folders: KnowledgeFolder[]): KnowledgeFolder | undefined {
  if (folders.length === 0) return undefined;
  const f = folders[0];
  return f.children && f.children.length > 0 ? firstLeaf(f.children) : f;
}

function folderClickHandle(row: KnowledgeFolder) {
  if (`${row.id ?? ''}` === `${currentFolder.value.id ?? ''}`) return;
  currentFolder.value = row;
}

function refreshFolder() {
  getFolder();
}

onBeforeRouteLeave(() => {
  currentFolder.value = { id: '', name: '全部知识库' };
  folderKeyword.value = '';
});

onMounted(() => getFolder(true));
</script>

<template>
  <KnowledgeDetailPage v-if="isDetailRoute" />
  <Page v-else auto-content-height>
    <div class="knowledge-manage">
      <aside class="knowledge-manage__left" v-loading="loading">
        <div class="knowledge-folder-header">
          <h4>知识库</h4>
          <ElButton text :icon="Refresh" @click="refreshFolder" />
        </div>
        <ElInput
          v-model="folderKeyword"
          class="knowledge-folder-search"
          clearable
          placeholder="搜索文件夹"
        />
        <ElScrollbar class="knowledge-folder-scrollbar">
          <ElTree
            :data="visibleFolderList"
            node-key="id"
            :current-node-key="currentFolder.id"
            :default-expanded-keys="['']"
            highlight-current
            @node-click="folderClickHandle"
          >
            <template #default="{ node, data }">
              <div class="knowledge-folder-node">
                <ElIcon>
                  <FolderOpened v-if="node.expanded" />
                  <Folder v-else />
                </ElIcon>
                <span>{{ data.name }}</span>
              </div>
            </template>
          </ElTree>
          <ElEmpty
            v-if="visibleFolderList[0]?.children?.length === 0 && folderKeyword"
            description="暂无匹配文件夹"
          />
        </ElScrollbar>
      </aside>
      <KnowledgeListContainer
        class="knowledge-manage__content"
        :current-folder="currentFolder"
        @refresh-folder="refreshFolder"
      >
        <template #header>
          <div class="knowledge-breadcrumb">
            <h2 v-if="currentFolder.id === 'share'">共享知识库</h2>
            <ElBreadcrumb v-else-if="breadcrumbs.length > 0" separator="/">
              <ElBreadcrumbItem
                @click="folderClickHandle({ id: '', name: '全部知识库' })"
              >
                全部知识库
              </ElBreadcrumbItem>
              <ElBreadcrumbItem
                v-for="(crumb, idx) in breadcrumbs"
                :key="idx"
                @click="folderClickHandle(crumb)"
              >
                {{ folderName(crumb) }}
              </ElBreadcrumbItem>
            </ElBreadcrumb>
            <h2 v-else>{{ folderName(currentFolder) }}</h2>
            <span>MaxKB 知识库管理</span>
          </div>
        </template>
      </KnowledgeListContainer>
    </div>
  </Page>
</template>

<style scoped lang="scss">
.knowledge-manage {
  --kb-space-2: 8px;
  --kb-space-3: 12px;
  --kb-space-4: 16px;
  --kb-border-color: var(--el-border-color-lighter);
  --kb-panel-bg: hsl(var(--card));
  --kb-radius: 6px;
  --kb-folder-pane-width: 280px;

  display: grid;
  grid-template-columns: var(--kb-folder-pane-width) minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--kb-panel-bg);
  border: 1px solid var(--kb-border-color);
  border-radius: var(--kb-radius);
}

.knowledge-manage__left {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--kb-border-color);
}

.knowledge-folder-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--kb-space-4) var(--kb-space-4) var(--kb-space-2);
}

.knowledge-folder-header h4 {
  margin: 0;
  font-size: calc(var(--el-font-size-base) * 1.25);
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.knowledge-folder-search {
  flex-shrink: 0;
  padding: var(--kb-space-2) var(--kb-space-4) var(--kb-space-3);
}

.knowledge-folder-scrollbar {
  flex: 1;
  min-height: 0;
}

.knowledge-folder-scrollbar :deep(.el-tree) {
  padding: 0 var(--kb-space-2);
  background: transparent;
}

.knowledge-folder-scrollbar :deep(.el-tree-node__content) {
  height: 36px;
  margin-bottom: 2px;
  border-radius: var(--kb-radius);
  transition: background-color var(--el-transition-duration);
}

.knowledge-folder-scrollbar :deep(.el-tree-node__content:hover) {
  background: var(--el-fill-color-lighter);
}

.knowledge-folder-scrollbar
  :deep(.el-tree-node.is-current > .el-tree-node__content) {
  font-weight: 600;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.knowledge-folder-node {
  display: flex;
  gap: var(--kb-space-2);
  align-items: center;
  min-width: 0;
  font-size: calc(var(--el-font-size-base) * 0.875);
}

.knowledge-folder-node .el-icon {
  font-size: calc(var(--el-font-size-base) * 1.125);
  color: var(--el-text-color-secondary);
}

.knowledge-folder-scrollbar
  :deep(.el-tree-node.is-current)
  .knowledge-folder-node
  .el-icon {
  color: var(--el-color-primary);
}

.knowledge-folder-node span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.knowledge-manage__content {
  min-width: 0;
  min-height: 0;
}

.knowledge-breadcrumb {
  display: grid;
  gap: var(--kb-space-1, 4px);
}

.knowledge-breadcrumb h2 {
  margin: 0;
  font-size: var(--el-font-size-large);
  font-weight: var(--el-font-weight-primary);
  color: var(--el-text-color-primary);
}

.knowledge-breadcrumb :deep(.el-breadcrumb) {
  font-size: var(--el-font-size-base);
}

.knowledge-breadcrumb :deep(.el-breadcrumb__item) {
  font-weight: 500;
}

.knowledge-breadcrumb :deep(.el-breadcrumb__inner) {
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: color var(--el-transition-duration);
}

.knowledge-breadcrumb :deep(.el-breadcrumb__inner:hover) {
  color: var(--el-color-primary);
}

.knowledge-breadcrumb > span {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}
</style>
