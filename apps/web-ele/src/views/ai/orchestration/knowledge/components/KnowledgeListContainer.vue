<script setup lang="ts">
import type { UploadFile } from 'element-plus';

import {
  computed,
  nextTick,
  onMounted,
  reactive,
  ref,
  shallowRef,
  watch,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  ArrowDown,
  Coin,
  Delete,
  Download,
  EditPen,
  FolderAdd,
  MoreFilled,
  Notebook,
  Rank,
  Reading,
  Refresh,
  Upload as UploadIcon,
} from '@element-plus/icons-vue';
import {
  ElButton,
  ElCheckbox,
  ElCheckboxGroup,
  ElCol,
  ElDialog,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElMessage,
  ElOption,
  ElRow,
  ElSelect,
  ElTag,
  ElTreeSelect,
  ElUpload,
} from 'element-plus';
import { cloneDeep } from 'lodash-es';

import {
  batchDeleteKnowledge,
  batchMoveKnowledge,
  createKnowledgeFolder,
  deleteKnowledge,
  exportKnowledge,
  exportKnowledgeBundle,
  exportZipKnowledge,
  generateRelatedKnowledge,
  importKnowledge,
  pageKnowledge,
  reembedKnowledge,
  treeKnowledge,
} from '#/api/ai/knowledge';
import { recordsOf, totalOf } from '#/views/ai/orchestration/utils';

import CreateKnowledgeDialog from '../create-component/CreateKnowledgeDialog.vue';
import CreateLarkKnowledgeDialog from '../create-component/CreateLarkKnowledgeDialog.vue';
import CreateWebKnowledgeDialog from '../create-component/CreateWebKnowledgeDialog.vue';
import CreateWorkflowKnowledgeDialog from '../create-component/CreateWorkflowKnowledgeDialog.vue';
import TemplateStoreDialog from '../template-store/TemplateStoreDialog.vue';
import SyncWebDialog from './SyncWebDialog.vue';

type Id = number | string;
type KnowledgeType = 'BASE' | 'LARK' | 'WEB' | 'WORKFLOW';

interface KnowledgeRecord extends Record<string, any> {
  charLength?: number;
  char_length?: number;
  createTime?: string;
  create_time?: string;
  description?: string;
  documentCount?: number;
  document_count?: number;
  folderId?: Id;
  folder_id?: Id;
  id?: Id;
  name?: string;
  type?: KnowledgeType | string;
}

const props = defineProps<{
  currentFolder?: Record<string, any>;
}>();

const emit = defineEmits<{
  refreshFolder: [];
}>();

const router = useRouter();
const route = useRoute();
const loading = ref(false);
const searchType = ref<'create_user' | 'name'>('name');
const searchForm = reactive({ create_user: '', name: '' });
const pagination = reactive({ current: 1, page: 1, size: 30, total: 0 });
const knowledgeList = ref<KnowledgeRecord[]>([]);
const isBatch = ref(false);
const multipleSelection = ref<Id[]>([]);
const createDialogRef = ref();
const currentCreateDialog = shallowRef<any>();
const syncWebDialogRef = ref<InstanceType<typeof SyncWebDialog>>();
const templateStoreDialogRef = ref<InstanceType<typeof TemplateStoreDialog>>();
const folderDialogVisible = ref(false);
const folderForm = reactive({ description: '', name: '' });
const importKnowledgeUploadRef = ref();
const moveDialogVisible = ref(false);
const moveTargetFolderId = ref('');
const moveFolderTree = ref<any[]>([]);
const userOptions = ref<{ id: Id; nickName: string }[]>([]);
const userLoading = ref(false);
const noMore = computed(() => knowledgeList.value.length >= pagination.total);
const showLarkKnowledge = ref(false);
const hoveredCardId = ref<Id | undefined>();

const currentFolderId = computed(() => props.currentFolder?.id);
const isShared = computed(() => currentFolderId.value === 'share');
const checkAll = computed({
  get: () =>
    knowledgeList.value.length > 0 &&
    knowledgeList.value.every(
      (item) => item.id && multipleSelection.value.includes(item.id),
    ),
  set: (value: boolean) => {
    multipleSelection.value = value
      ? knowledgeList.value
          .map((item) => item.id)
          .filter((id): id is Id => id !== undefined)
      : [];
  },
});
const isIndeterminate = computed(
  () =>
    multipleSelection.value.length > 0 &&
    multipleSelection.value.length < knowledgeList.value.length,
);

function idText(value: unknown) {
  return value === undefined || value === null || value === ''
    ? undefined
    : `${value}`;
}

function knowledgeDisplayName(item: KnowledgeRecord) {
  return item.name || item.title || '未命名知识库';
}

function knowledgeDescription(item: KnowledgeRecord) {
  return item.description || item.desc || '暂无描述';
}

function knowledgeTypeIcon(type?: string) {
  if (type === 'WEB' || type === '1') return Reading;
  if (type === 'LARK' || type === '2') return Coin;
  if (type === 'WORKFLOW' || type === '4') return Rank;
  return Notebook;
}

function knowledgeTypeClass(type?: string) {
  if (type === 'WEB' || type === '1') return 'is-web';
  if (type === 'LARK' || type === '2') return 'is-lark';
  if (type === 'WORKFLOW' || type === '4') return 'is-workflow';
  return 'is-base';
}

function formatDate(value: unknown) {
  if (!value) return '-';
  const date = new Date(`${value}`);
  if (Number.isNaN(date.getTime())) return `${value}`;
  return date.toLocaleDateString('zh-CN');
}

function numberText(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue.toLocaleString() : '0';
}

function resetList() {
  pagination.current = 1;
  pagination.page = 1;
  knowledgeList.value = [];
}

function queryParams() {
  const params: Record<string, any> = {
    current: pagination.current,
    folderId: idText(currentFolderId.value),
    folder_id: idText(currentFolderId.value),
    page: pagination.page,
    size: pagination.size,
  };
  if (searchForm[searchType.value]) {
    params[searchType.value] = searchForm[searchType.value];
  }
  return params;
}

async function getList(append = false) {
  if (append && noMore.value) return;
  loading.value = true;
  try {
    const page = await pageKnowledge(queryParams());
    const records = recordsOf<KnowledgeRecord>(page);
    knowledgeList.value = append
      ? [...knowledgeList.value, ...records]
      : records;
    pagination.total = totalOf(page);
  } finally {
    loading.value = false;
  }
}

function loadMore() {
  if (loading.value || noMore.value) return;
  pagination.current += 1;
  getList(true);
}

async function searchUser(query: string) {
  if (!query) {
    userOptions.value = [];
    return;
  }
  userLoading.value = true;
  try {
    // TODO: 接入真实用户搜索 API;当前用 pageKnowledge 的 create_user 参数兼容
    userOptions.value = [{ id: query, nickName: query }];
  } finally {
    userLoading.value = false;
  }
}

async function openMoveToDialog() {
  moveTargetFolderId.value = '';
  if (moveFolderTree.value.length === 0) {
    try {
      const data = await treeKnowledge();
      moveFolderTree.value = Array.isArray(data) ? data : data?.records || [];
    } catch {
      moveFolderTree.value = [];
    }
  }
  moveDialogVisible.value = true;
}

function searchTypeChange() {
  searchForm.create_user = '';
  searchForm.name = '';
}

function searchHandle() {
  resetList();
  getList();
}

function batchSelectedHandle(value: boolean) {
  isBatch.value = value;
  multipleSelection.value = [];
}

function checkboxChange(item: KnowledgeRecord) {
  if (!item.id) return;
  const index = multipleSelection.value.indexOf(item.id);
  if (index === -1) {
    multipleSelection.value.push(item.id);
  } else {
    multipleSelection.value.splice(index, 1);
  }
}

async function deleteMulKnowledge() {
  if (multipleSelection.value.length === 0) return;
  await batchDeleteKnowledge(cloneDeep(multipleSelection.value));
  ElMessage.success('删除成功');
  batchSelectedHandle(false);
  await getList();
}

async function submitBatchMove() {
  if (!moveTargetFolderId.value) {
    ElMessage.warning('请选择目标文件夹');
    return;
  }
  if (multipleSelection.value.length === 0) return;
  await batchMoveKnowledge(
    cloneDeep(multipleSelection.value),
    moveTargetFolderId.value,
  );
  ElMessage.success('移动成功');
  moveDialogVisible.value = false;
  batchSelectedHandle(false);
  await getList();
}

async function removeKnowledge(item: KnowledgeRecord) {
  if (!item.id) return;
  await deleteKnowledge(item.id);
  ElMessage.success('删除成功');
  await getList();
}

function syncWebKnowledge(item: KnowledgeRecord) {
  if (!item.id) return;
  syncWebDialogRef.value?.open(`${item.id}`);
}

async function reEmbedKnowledge(item: KnowledgeRecord) {
  if (!item.id) return;
  await reembedKnowledge(item.id);
  ElMessage.success('已提交向量化');
  await getList();
}

async function generateRelated(item: KnowledgeRecord) {
  if (!item.id) return;
  await generateRelatedKnowledge(item.id);
  ElMessage.success('已提交生成关联问题');
}

function openAuthorizedWorkspace(_item: KnowledgeRecord) {
  // TODO: implement AuthorizedWorkspaceDialog
  ElMessage.info('授权工作空间功能开发中');
}

function openResourceAuthorization(_item: KnowledgeRecord) {
  // TODO: implement ResourceAuthorizationDrawer
  ElMessage.info('资源授权功能开发中');
}

function openResourceMapping(_item: KnowledgeRecord) {
  // TODO: implement ResourceMappingDrawer
  ElMessage.info('资源映射功能开发中');
}

async function exportExcel(item: KnowledgeRecord) {
  if (!item.id) return;
  await exportKnowledge(item.id);
  ElMessage.success('已导出 Excel');
}

async function exportZip(item: KnowledgeRecord) {
  if (!item.id) return;
  await exportZipKnowledge(item.id);
  ElMessage.success('已导出 ZIP');
}

async function exportBundle(item: KnowledgeRecord) {
  if (!item.id) return;
  await exportKnowledgeBundle(item.id);
  ElMessage.success('已导出知识库包');
}

function openTemplateStore() {
  templateStoreDialogRef.value?.open(idText(currentFolderId.value) || '');
}

function openCreateDialog(component: any) {
  currentCreateDialog.value = component;
  nextTick(() => {
    createDialogRef.value?.open(props.currentFolder);
  });
}

function openCreateFolder() {
  folderForm.name = '';
  folderForm.description = '';
  folderDialogVisible.value = true;
}

async function submitFolder() {
  if (!folderForm.name.trim()) {
    ElMessage.warning('请输入文件夹名称');
    return;
  }
  await createKnowledgeFolder({
    description: folderForm.description,
    name: folderForm.name,
    parentId: idText(currentFolderId.value),
    parent_id: idText(currentFolderId.value),
  });
  ElMessage.success('创建成功');
  folderDialogVisible.value = false;
  emit('refreshFolder');
}

function toDocument(item: KnowledgeRecord) {
  if (isBatch.value) {
    checkboxChange(item);
    return;
  }
  if (!item.id) return;
  const folderId =
    currentFolderId.value && currentFolderId.value !== 'share'
      ? item.folder_id || item.folderId || currentFolderId.value
      : currentFolderId.value || 'shared';
  router.push({
    name: 'KnowledgeDetail',
    params: {
      folderId,
      id: item.id,
      tab: 'document',
      type: item.type || 'BASE',
    },
  });
}

function openSetting(item: KnowledgeRecord) {
  if (!item.id) return;
  router.push({
    name: 'KnowledgeDetail',
    params: {
      folderId:
        currentFolderId.value || item.folder_id || item.folderId || 'shared',
      id: item.id,
      tab: 'setting',
      type: item.type || 'BASE',
    },
  });
}

function openWorkflow(item: KnowledgeRecord) {
  if (!item.id) return;
  router.push({
    name: 'KnowledgeWorkflow',
    params: {
      folderId:
        currentFolderId.value || item.folder_id || item.folderId || 'shared',
      id: item.id,
    },
  });
}

async function importKnowledgeBundle(file: UploadFile) {
  if (!file.raw) return;
  const formData = new FormData();
  formData.append('file', file.raw);
  if (currentFolderId.value)
    formData.append('folder_id', `${currentFolderId.value}`);
  importKnowledgeUploadRef.value?.clearFiles?.();
  try {
    const res = await importKnowledge(
      formData as unknown as Record<string, unknown>,
    );
    ElMessage.success('导入成功');
    const newId = (res as any)?.id || (res as any)?.data?.id;
    if (newId) {
      router.push({
        name: 'KnowledgeDetail',
        params: {
          folderId: currentFolderId.value || 'shared',
          id: newId,
          tab: 'document',
          type: 'BASE',
        },
        query: { imported: 'true' },
      });
    } else {
      await getList();
    }
  } catch (error: any) {
    const code = error?.code ?? error?.response?.status;
    if (code === 400) {
      ElMessage.warning('导入失败:压缩包格式不正确或需升级专业版');
    } else {
      ElMessage.error('导入失败');
    }
  }
}

watch(
  currentFolderId,
  () => {
    batchSelectedHandle(false);
    resetList();
    getList();
  },
  { immediate: true },
);

onMounted(() => {
  if (!route.params.id) getList();
});
</script>

<template>
  <section class="knowledge-list-container">
    <header class="knowledge-list-container__header">
      <slot name="header"></slot>
      <div class="knowledge-list-container__search">
        <div class="complex-search">
          <ElSelect
            v-model="searchType"
            class="complex-search__left"
            style="width: 90px"
            @change="searchTypeChange"
          >
            <ElOption label="创建者" value="create_user" />
            <ElOption label="名称" value="name" />
          </ElSelect>
          <ElInput
            v-if="searchType === 'name'"
            v-model="searchForm.name"
            clearable
            placeholder="搜索"
            style="width: 190px"
            @change="searchHandle"
          />
          <ElSelect
            v-else
            v-model="searchForm.create_user"
            clearable
            filterable
            remote
            :remote-method="searchUser"
            :loading="userLoading"
            placeholder="搜索创建者"
            style="width: 190px"
            @change="searchHandle"
          >
            <ElOption
              v-for="u in userOptions"
              :key="u.id"
              :label="u.nickName"
              :value="u.id"
            />
          </ElSelect>
        </div>
        <ElButton v-if="!isShared && !isBatch" @click="openTemplateStore">
          模板中心
        </ElButton>
        <ElButton
          v-if="!isShared && !isBatch"
          @click="batchSelectedHandle(true)"
        >
          批量选择
        </ElButton>
        <ElButton v-if="isBatch" @click="batchSelectedHandle(false)">
          取消选择
        </ElButton>
        <ElDropdown v-if="!isShared && !isBatch" trigger="click">
          <ElButton type="primary">
            创建
            <ElIcon class="el-icon--right"><ArrowDown /></ElIcon>
          </ElButton>
          <template #dropdown>
            <ElDropdownMenu class="create-dropdown">
              <ElDropdownItem @click="openCreateDialog(CreateKnowledgeDialog)">
                <div class="create-menu-item">
                  <ElIcon class="create-menu-icon is-create-blue">
                    <Notebook />
                  </ElIcon>
                  <div>
                    <strong>基础知识库</strong>
                    <span>通过上传文件或手动录入构建知识库</span>
                  </div>
                </div>
              </ElDropdownItem>
              <ElDropdownItem
                @click="openCreateDialog(CreateWebKnowledgeDialog)"
              >
                <div class="create-menu-item">
                  <ElIcon class="create-menu-icon is-create-purple">
                    <Reading />
                  </ElIcon>
                  <div>
                    <strong>Web 知识库</strong>
                    <span>通过网站链接构建知识库</span>
                  </div>
                </div>
              </ElDropdownItem>
              <ElDropdownItem
                v-if="showLarkKnowledge"
                @click="openCreateDialog(CreateLarkKnowledgeDialog)"
              >
                <div class="create-menu-item">
                  <ElIcon class="create-menu-icon is-create-purple">
                    <Coin />
                  </ElIcon>
                  <div>
                    <strong>Lark 知识库</strong>
                    <span>通过飞书文档构建知识库</span>
                  </div>
                </div>
              </ElDropdownItem>
              <ElDropdownItem
                @click="openCreateDialog(CreateWorkflowKnowledgeDialog)"
              >
                <div class="create-menu-item">
                  <ElIcon class="create-menu-icon is-create-orange">
                    <Rank />
                  </ElIcon>
                  <div>
                    <strong>工作流知识库</strong>
                    <span>通过自定义工作流方式构建知识库</span>
                  </div>
                </div>
              </ElDropdownItem>
              <ElUpload
                ref="importKnowledgeUploadRef"
                accept=".zip"
                action="#"
                :auto-upload="false"
                :file-list="[]"
                :limit="1"
                :show-file-list="false"
                @change="importKnowledgeBundle"
              >
                <ElDropdownItem>
                  <div class="create-menu-item">
                    <ElIcon class="create-menu-icon is-create-import">
                      <UploadIcon />
                    </ElIcon>
                    <div>
                      <strong>导入创建</strong>
                      <span>导入 MaxKB 知识库包</span>
                    </div>
                  </div>
                </ElDropdownItem>
              </ElUpload>
              <ElDropdownItem divided @click="openCreateFolder">
                <div class="create-menu-item">
                  <ElIcon class="create-menu-icon is-create-folder">
                    <FolderAdd />
                  </ElIcon>
                  <div>
                    <strong>添加文件夹</strong>
                    <span>在当前目录下创建文件夹</span>
                  </div>
                </div>
              </ElDropdownItem>
            </ElDropdownMenu>
          </template>
        </ElDropdown>
      </div>
    </header>

    <main
      class="knowledge-list-container__body"
      v-loading="loading"
      v-infinite-scroll="loadMore"
      :infinite-scroll-disabled="loading || noMore"
      :infinite-scroll-distance="20"
    >
      <ElCheckboxGroup v-model="multipleSelection">
        <ElRow v-if="knowledgeList.length > 0" :gutter="15" class="w-full">
          <ElCol
            v-for="item in knowledgeList"
            :key="item.id"
            :xs="24"
            :sm="12"
            :md="12"
            :lg="8"
            :xl="6"
            class="mb-16"
          >
            <article
              class="knowledge-card"
              :class="{ 'is-disabled': isBatch }"
              @click="toDocument(item)"
              @mouseenter="hoveredCardId = item.id"
              @mouseleave="hoveredCardId = undefined"
            >
              <header class="knowledge-card__head">
                <ElIcon
                  class="knowledge-card__icon"
                  :class="knowledgeTypeClass(`${item.type || ''}`)"
                >
                  <component :is="knowledgeTypeIcon(`${item.type || ''}`)" />
                </ElIcon>
                <div class="knowledge-card__title">
                  <strong>{{ knowledgeDisplayName(item) }}</strong>
                  <span class="knowledge-card__subtitle">
                    {{ item.nick_name || item.create_user || '未知' }}
                    创建于 {{ formatDate(item.create_time ?? item.createTime) }}
                  </span>
                </div>
                <ElTag v-if="isShared" size="small" type="warning">共享</ElTag>
                <ElCheckbox v-if="isBatch" :value="item.id" @click.stop />
                <ElDropdown
                  v-if="!isBatch"
                  :class="{ 'is-hidden-dropdown': hoveredCardId !== item.id }"
                  trigger="click"
                >
                  <ElButton text :icon="MoreFilled" @click.stop />
                  <template #dropdown>
                    <ElDropdownMenu>
                      <ElDropdownItem
                        v-if="item.type === 'WEB' || item.type === '1'"
                        @click.stop="syncWebKnowledge(item)"
                      >
                        <ElIcon><Refresh /></ElIcon>
                        同步
                      </ElDropdownItem>
                      <ElDropdownItem @click.stop="reEmbedKnowledge(item)">
                        <ElIcon><Refresh /></ElIcon>
                        向量化
                      </ElDropdownItem>
                      <ElDropdownItem @click.stop="generateRelated(item)">
                        <ElIcon><EditPen /></ElIcon>
                        生成问题
                      </ElDropdownItem>
                      <ElDropdownItem
                        @click.stop="openAuthorizedWorkspace(item)"
                      >
                        <ElIcon><Notebook /></ElIcon>
                        授权工作空间
                      </ElDropdownItem>
                      <ElDropdownItem
                        @click.stop="openResourceAuthorization(item)"
                      >
                        <ElIcon><Notebook /></ElIcon>
                        资源授权
                      </ElDropdownItem>
                      <ElDropdownItem @click.stop="openResourceMapping(item)">
                        <ElIcon><Notebook /></ElIcon>
                        资源映射
                      </ElDropdownItem>
                      <ElDropdownItem @click.stop="openMoveToDialog()">
                        <ElIcon><FolderAdd /></ElIcon>
                        移动到
                      </ElDropdownItem>
                      <ElDropdownItem @click.stop="openSetting(item)">
                        <ElIcon><EditPen /></ElIcon>
                        设置
                      </ElDropdownItem>
                      <ElDropdownItem divided @click.stop="exportExcel(item)">
                        <ElIcon><Download /></ElIcon>
                        导出 Excel
                      </ElDropdownItem>
                      <ElDropdownItem @click.stop="exportZip(item)">
                        <ElIcon><Download /></ElIcon>
                        导出 ZIP
                      </ElDropdownItem>
                      <ElDropdownItem @click.stop="exportBundle(item)">
                        <ElIcon><Download /></ElIcon>
                        导出知识库包
                      </ElDropdownItem>
                      <ElDropdownItem
                        v-if="item.type === 'WORKFLOW' || item.type === '4'"
                        @click.stop="openWorkflow(item)"
                      >
                        <ElIcon><Rank /></ElIcon>
                        工作流
                      </ElDropdownItem>
                      <ElDropdownItem
                        divided
                        @click.stop="removeKnowledge(item)"
                      >
                        <ElIcon><Delete /></ElIcon>
                        删除
                      </ElDropdownItem>
                    </ElDropdownMenu>
                  </template>
                </ElDropdown>
              </header>
              <p class="knowledge-card__desc">
                {{ knowledgeDescription(item) }}
              </p>
              <footer class="knowledge-card__footer">
                <span
                  >{{
                    numberText(item.document_count ?? item.documentCount)
                  }}
                  文档</span
                >
                <span class="knowledge-card__divider">|</span>
                <span
                  >{{
                    numberText(item.char_length ?? item.charLength)
                  }}
                  字符</span
                >
              </footer>
            </article>
          </ElCol>
        </ElRow>
        <ElEmpty v-else description="暂无数据" />
      </ElCheckboxGroup>
      <p v-if="knowledgeList.length > 0 && noMore" class="no-more">
        没有更多了
      </p>
    </main>

    <footer v-if="isBatch" class="mul-operation">
      <ElCheckbox v-model="checkAll" :indeterminate="isIndeterminate">
        全选
      </ElCheckbox>
      <ElButton
        :disabled="multipleSelection.length === 0"
        @click="openMoveToDialog()"
      >
        批量移动
      </ElButton>
      <ElButton
        :disabled="multipleSelection.length === 0"
        @click="deleteMulKnowledge"
      >
        删除
      </ElButton>
      <span
        >已选择 {{ multipleSelection.length }}/{{ pagination.total }} 项</span
      >
      <ElButton link type="primary" @click="batchSelectedHandle(false)">
        取消选择
      </ElButton>
    </footer>

    <component
      :is="currentCreateDialog"
      v-if="currentCreateDialog"
      ref="createDialogRef"
      @refresh="getList"
    />

    <SyncWebDialog ref="syncWebDialogRef" @refresh="getList" />
    <TemplateStoreDialog ref="templateStoreDialogRef" @refresh="getList" />

    <ElDialog v-model="moveDialogVisible" title="移动到" width="480">
      <ElForm label-position="top">
        <ElFormItem label="目标文件夹">
          <ElTreeSelect
            v-model="moveTargetFolderId"
            :data="moveFolderTree"
            :props="{ label: 'name', value: 'id', children: 'children' }"
            check-strictly
            default-expand-all
            placeholder="请选择目标文件夹"
            style="width: 100%"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="moveDialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="submitBatchMove">移动</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="folderDialogVisible" title="添加文件夹" width="520">
      <ElForm :model="folderForm" label-position="top">
        <ElFormItem label="名称" required>
          <ElInput v-model="folderForm.name" placeholder="请输入文件夹名称" />
        </ElFormItem>
        <ElFormItem label="描述">
          <ElInput
            v-model="folderForm.description"
            type="textarea"
            placeholder="请输入文件夹描述"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="folderDialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="submitFolder">创建</ElButton>
      </template>
    </ElDialog>
  </section>
</template>

<style scoped lang="scss">
.knowledge-list-container {
  --kb-space-2: 8px;
  --kb-space-3: 12px;
  --kb-space-4: 16px;
  --kb-border-color: var(--el-border-color-lighter);
  --kb-panel-bg: hsl(var(--card));
  --kb-radius: 6px;
  --kb-card-min-width: 292px;
  --kb-card-min-height: 164px;

  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  min-height: 0;
  background: var(--kb-panel-bg);
}

.knowledge-list-container__header {
  display: flex;
  flex-shrink: 0;
  gap: var(--kb-space-3);
  align-items: center;
  justify-content: space-between;
  padding: var(--kb-space-3) var(--kb-space-4);
  border-bottom: 1px solid var(--kb-border-color);
}

.knowledge-list-container__search {
  display: flex;
  flex-wrap: wrap;
  gap: var(--kb-space-2);
  align-items: center;
}

.complex-search {
  display: flex;
  align-items: center;
}

.complex-search__left :deep(.el-select__wrapper) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.complex-search > :deep(.el-input .el-input__wrapper) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.knowledge-list-container__body {
  flex: 1;
  min-height: 0;
  padding: var(--kb-space-4);
  overflow: auto;
}

.knowledge-list-container__body :deep(.el-row) {
  margin-bottom: calc(var(--kb-space-4) * -1);
}

.knowledge-card {
  position: relative;
  min-height: var(--kb-card-min-height);
  padding: var(--kb-space-4);
  cursor: pointer;
  background: var(--kb-panel-bg);
  border: 1px solid var(--kb-border-color);
  border-radius: var(--kb-radius);
  transition:
    border-color var(--el-transition-duration),
    box-shadow var(--el-transition-duration);
}

.knowledge-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: var(--el-box-shadow-light);
}

.is-hidden-dropdown {
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--el-transition-duration);
}

.knowledge-card:hover .is-hidden-dropdown {
  pointer-events: auto;
  opacity: 1;
}

.knowledge-card__head {
  display: flex;
  gap: var(--kb-space-3);
  align-items: flex-start;
}

.knowledge-card__head :deep(.el-tag) {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
}

.knowledge-card__head :deep(.el-checkbox) {
  flex-shrink: 0;
  margin-top: 8px;
}

.knowledge-card__icon,
.create-menu-icon {
  display: inline-flex;
  flex: 0 0 34px;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  font-size: 18px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: var(--kb-radius);
}

.knowledge-card__icon :deep(.el-icon),
.create-menu-icon :deep(.el-icon) {
  font-size: 18px;
}

.knowledge-card__icon.is-web,
.create-menu-icon.is-create-purple {
  color: #9333ea;
  background: #f3e8ff;
}

.knowledge-card__icon.is-lark {
  color: #9333ea;
  background: #f3e8ff;
}

.knowledge-card__icon.is-workflow,
.create-menu-icon.is-create-orange {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
}

.create-menu-icon.is-create-folder {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
}

.create-menu-icon.is-create-import {
  color: var(--el-color-info);
  background: var(--el-fill-color-light);
}

.knowledge-card__title {
  display: grid;
  flex: 1;
  gap: var(--kb-space-1, 4px);
  min-width: 0;
}

.knowledge-card__title strong {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.knowledge-card__title span,
.knowledge-card__desc,
.knowledge-card__footer {
  color: var(--el-text-color-secondary);
}

.knowledge-card__desc {
  display: -webkit-box;
  height: 44px;
  margin: 14px 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 14px;
  line-height: 22px;
  -webkit-box-orient: vertical;
}

.knowledge-card__footer {
  display: flex;
  gap: var(--kb-space-2);
  align-items: center;
  font-size: 12px;
}

.knowledge-card__divider {
  color: var(--el-border-color);
}

.mul-operation {
  display: flex;
  flex-shrink: 0;
  gap: var(--kb-space-3);
  align-items: center;
  padding: var(--kb-space-3) var(--kb-space-4);
  border-top: 1px solid var(--kb-border-color);
}

.knowledge-list-container__pagination {
  display: flex;
  flex-shrink: 0;
  justify-content: flex-end;
  padding: var(--kb-space-3) var(--kb-space-4);
  border-top: 1px solid var(--kb-border-color);
}

.create-dropdown :deep(.el-dropdown-menu__item) {
  padding: var(--kb-space-2);
  border-radius: var(--kb-radius);
}

.create-menu-item {
  display: flex;
  gap: var(--kb-space-3);
  align-items: center;
  width: 260px;
}

.create-menu-item > div {
  flex: 1;
  min-width: 0;
}

.create-menu-item strong,
.create-menu-item span {
  display: block;
}

.create-menu-item strong {
  font-size: var(--el-font-size-base);
  font-weight: var(--el-font-weight-primary);
  color: var(--el-text-color-primary);
}

.create-menu-item span {
  margin-top: var(--kb-space-1, 4px);
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}

.w-full {
  width: 100%;
}

.mb-16 {
  margin-bottom: var(--kb-space-4);
}

.knowledge-card.is-disabled {
  cursor: default;
  opacity: 0.7;
}

.knowledge-card.is-disabled:hover {
  border-color: var(--kb-border-color);
  box-shadow: none;
}

.knowledge-card__subtitle {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.no-more {
  padding: calc(var(--kb-space-4) * 2) 0 var(--kb-space-4);
  margin-top: var(--kb-space-3);
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
  text-align: center;
}
</style>
