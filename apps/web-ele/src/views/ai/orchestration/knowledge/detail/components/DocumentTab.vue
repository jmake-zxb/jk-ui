<script setup lang="ts">
import type { UploadFile } from 'element-plus';

import type {
  Id,
  KnowledgeDetailTabProps,
  PageRecord,
} from './KnowledgeDetailTypes';

import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';
import { useRouter } from 'vue-router';

import {
  ArrowDown,
  DocumentAdd,
  Download,
  Edit,
  MoreFilled,
  Refresh,
  Search,
  Upload,
} from '@element-plus/icons-vue';
import {
  ElButton,
  ElDialog,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElPagination,
  ElPopconfirm,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag,
  ElUpload,
} from 'element-plus';

import {
  batchCancelDocumentTask,
  batchGenerateRelatedDocuments,
  batchHitHandling,
  batchTokenizeDocuments,
  cancelDocumentTask,
  createWebDocument,
  deleteDocument,
  downloadSourceFile,
  exportKnowledge,
  exportZipKnowledge,
  pageDocuments,
  reembedDocument,
  replaceSourceFile,
  tokenizeDocument,
  updateDocument,
} from '#/api/ai/knowledge';
import { requestClient } from '#/api/request';
import { recordsOf, totalOf } from '#/views/ai/orchestration/utils';

import TagSettingDrawer from '../../components/TagSettingDrawer.vue';
import {
  countText,
  dateText,
  idText,
  numberOf,
  textOf,
} from './KnowledgeDetailTypes';

interface DocumentRecord extends PageRecord {
  charLength?: number;
  char_length?: number;
  characterCount?: number;
  character_count?: number;
  createTime?: string;
  create_time?: string;
  directlyReturnSimilarity?: number;
  directly_return_similarity?: number;
  allowDownload?: boolean;
  allow_download?: boolean;
  enabled?: boolean;
  hitHandlingMethod?: string;
  hit_handling_method?: string;
  isActive?: boolean;
  is_active?: boolean;
  name?: string;
  paragraphCount?: number;
  paragraph_count?: number;
  sourceType?: string;
  source_type?: string;
  status?: string;
  tagCount?: number;
  tag_count?: number;
  updateTime?: string;
  update_time?: string;
}

const props = defineProps<KnowledgeDetailTabProps>();

const router = useRouter();
const loading = ref(false);
const searchName = ref('');
const statusFilter = ref('');
const documents = ref<DocumentRecord[]>([]);
const pagination = reactive({ current: 1, page: 1, size: 10, total: 0 });
const editDialogVisible = ref(false);
const editForm = reactive({
  allowDownload: false,
  content: '',
  directlyReturnSimilarity: 0.6,
  enabled: true,
  hitHandlingMethod: 'optimization',
  id: '' as Id,
  name: '',
});
const multipleSelection = ref<DocumentRecord[]>([]);
const tableRef = ref<InstanceType<typeof ElTable>>();
const importWebDialogVisible = ref(false);
const importWebForm = reactive({ name: '', selector: '', sourceUrl: '' });
const tagSettingRef = ref<InstanceType<typeof TagSettingDrawer>>();
let refreshTimer: number | undefined;

// --- Inline name editing ---
const editingDocId = ref<Id | null>(null);
const editingName = ref('');
const editingInputRef = ref<InstanceType<typeof ElInput>>();

// --- Replace source file hidden upload ---
const replaceUploadRef = ref<InstanceType<typeof ElUpload>>();
const replacingDocId = ref<Id | null>(null);

function knowledgeType(): string {
  return `${props.knowledge?.type ?? props.type ?? ''}`.toUpperCase();
}

function isWebKnowledge() {
  const type = knowledgeType();
  return type === 'WEB' || type === '1';
}

function isWorkflowKnowledge() {
  const type = knowledgeType();
  return type === 'WORKFLOW' || type === '4';
}

function enabledValue(row: DocumentRecord) {
  if (row.enabled !== undefined) return row.enabled;
  if (row.isActive !== undefined) return row.isActive;
  if (row.is_active !== undefined) return row.is_active;
  return true;
}

function setEnabledValue(row: DocumentRecord, value: boolean) {
  row.enabled = value;
  row.isActive = value;
  row.is_active = value;
}

function statusTagType(status?: string) {
  const value = `${status || ''}`.toUpperCase();
  if (['COMPLETED', 'DONE', 'SUCCESS'].includes(value)) return 'success';
  if (['ERROR', 'FAILED', 'FAILURE'].includes(value)) return 'danger';
  if (['EMBEDDING', 'INDEXING', 'TOKENIZING'].includes(value)) return '';
  if (['PENDING', 'QUEUED', 'RUNNING', 'STARTED', 'WAITING'].includes(value))
    return 'warning';
  if (['GENERATING'].includes(value)) return '';
  return 'info';
}

function statusText(status?: string) {
  const value = `${status || ''}`.toUpperCase();
  if (['COMPLETED', 'DONE', 'SUCCESS'].includes(value)) return '成功';
  if (['ERROR', 'FAILED', 'FAILURE'].includes(value)) return '失败';
  if (['TOKENIZING'].includes(value)) return '分词索引中';
  if (['EMBEDDING', 'INDEXING'].includes(value)) return '索引中';
  if (['PENDING', 'QUEUED'].includes(value)) return '排队中';
  if (['RUNNING', 'STARTED', 'WAITING'].includes(value)) return '处理中';
  if (['GENERATING'].includes(value)) return '生成中';
  return value || '等待中';
}

function isVectorizing(row: DocumentRecord) {
  const value = `${row.status || ''}`.toUpperCase();
  return ['PENDING', 'RUNNING', 'STARTED', 'WAITING'].includes(value);
}

function isTokenizing(row: DocumentRecord) {
  const value = `${row.status || ''}`.toUpperCase();
  return ['EMBEDDING', 'INDEXING', 'TOKENIZING'].includes(value);
}

function tagCountValue(row: DocumentRecord) {
  return numberOf(row.tag_count ?? row.tagCount, -1);
}

function hitHandlingText(row: DocumentRecord) {
  const value = row.hit_handling_method ?? row.hitHandlingMethod;
  return textOf(value, '-');
}

function resetPage() {
  pagination.current = 1;
  pagination.page = 1;
}

async function getList(silent = false) {
  if (!props.knowledgeId) return;
  if (!silent) loading.value = true;
  try {
    const response = await pageDocuments(props.knowledgeId, {
      current: pagination.current,
      name: searchName.value || undefined,
      page: pagination.current,
      size: pagination.size,
      status: statusFilter.value || undefined,
    });
    documents.value = recordsOf<DocumentRecord>(response);
    pagination.total = totalOf(response);
  } finally {
    loading.value = false;
  }
}

function refresh() {
  resetPage();
  getList();
}

function openEditDialog(row: DocumentRecord) {
  if (!row.id) return;
  editForm.id = row.id;
  editForm.name = textOf(row.name, '未命名文档');
  editForm.enabled = enabledValue(row);
  editForm.hitHandlingMethod = textOf(
    row.hit_handling_method ?? row.hitHandlingMethod,
    'optimization',
  );
  editForm.directlyReturnSimilarity = Number(
    row.directly_return_similarity ?? row.directlyReturnSimilarity ?? 0.6,
  );
  editForm.allowDownload = Boolean(row.allow_download ?? row.allowDownload);
  editForm.content = '';
  editDialogVisible.value = true;
}

async function submitDocument() {
  if (!editForm.name.trim()) {
    ElMessage.warning('请输入文档名称');
    return;
  }
  if (editForm.id) {
    await updateDocument(props.knowledgeId, editForm.id, {
      enabled: editForm.enabled,
      isActive: editForm.enabled,
      is_active: editForm.enabled,
      hitHandlingMethod: editForm.hitHandlingMethod,
      hit_handling_method: editForm.hitHandlingMethod,
      name: editForm.name.trim(),
    });
    ElMessage.success('保存成功');
  }
  editDialogVisible.value = false;
  await getList();
}

async function removeDocument(row: DocumentRecord) {
  if (!row.id) return;
  await deleteDocument(props.knowledgeId, row.id);
  ElMessage.success('删除成功');
  await getList();
}

async function reembed(row: DocumentRecord) {
  if (!row.id) return;
  await reembedDocument(props.knowledgeId, row.id);
  ElMessage.success('已提交向量化');
  await getList(true);
}

async function cancelReembed(row: DocumentRecord) {
  if (!row.id) return;
  await cancelDocumentTask(props.knowledgeId, row.id);
  ElMessage.success('已取消向量化');
  await getList(true);
}

async function toggleEnabled(
  row: DocumentRecord,
  value: boolean | number | string,
) {
  if (!row.id) return;
  const next = !!value;
  try {
    await updateDocument(props.knowledgeId, row.id, {
      enabled: next,
      isActive: next,
      is_active: next,
    });
    setEnabledValue(row, next);
    ElMessage.success(next ? '已启用' : '已停用');
  } catch {
    setEnabledValue(row, !next);
  }
}

async function generateQuestion(row: DocumentRecord) {
  if (!row.id) return;
  await batchGenerateRelatedDocuments(props.knowledgeId, [row.id]);
  ElMessage.success('已提交生成问题');
}

function openTagSetting(row: DocumentRecord) {
  if (!row.id) return;
  tagSettingRef.value?.open(row);
}

async function migrateDocument(row: DocumentRecord) {
  if (!row.id) return;
  try {
    const { value } = await ElMessageBox.prompt(
      '请输入目标知识库 ID',
      '迁移文档',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPattern: /\S+/,
        inputErrorMessage: '请输入目标知识库 ID',
        inputPlaceholder: '输入目标知识库 ID',
      },
    );
    if (!value) return;
    await requestClient.put(
      `/ai/api/knowledge/${props.knowledgeId}/documents/${row.id}/migrate`,
      {
        targetKnowledgeId: value,
        target_knowledge_id: value,
      },
    );
    ElMessage.success('迁移成功');
    await getList();
  } catch {
    // User cancelled
  }
}

async function exportDocumentExcel(_row: DocumentRecord) {
  try {
    await exportKnowledge(props.knowledgeId);
    ElMessage.success('导出成功');
  } catch {
    ElMessage.error('导出失败');
  }
}

async function exportDocumentZip(row: DocumentRecord) {
  try {
    const response: unknown = await exportZipKnowledge(props.knowledgeId);
    const blob =
      response instanceof Blob ? response : new Blob([response as BlobPart]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${textOf(row.name, 'document')}.zip`;
    document.body.append(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    ElMessage.success('导出 Zip 成功');
  } catch {
    ElMessage.error('导出 Zip 失败');
  }
}

// --- Download source file ---
async function handleDownloadSourceFile(row: DocumentRecord) {
  if (!row.id) return;
  try {
    const response = await downloadSourceFile(props.knowledgeId, row.id);
    const blob =
      response instanceof Blob ? response : new Blob([response as BlobPart]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = textOf(row.name, 'document');
    document.body.append(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    ElMessage.success('下载成功');
  } catch {
    ElMessage.error('下载失败');
  }
}

// --- Replace source file ---
function triggerReplaceUpload(row: DocumentRecord) {
  if (!row.id) return;
  replacingDocId.value = row.id;
  nextTick(() => {
    replaceUploadRef.value?.$el.querySelector('input')?.click();
  });
}

async function handleReplaceFileChange(uploadFile: UploadFile) {
  if (!uploadFile.raw || !replacingDocId.value) return;
  try {
    await replaceSourceFile(
      props.knowledgeId,
      replacingDocId.value,
      uploadFile.raw,
    );
    ElMessage.success('替换成功');
    await getList();
  } catch {
    ElMessage.error('替换失败');
  } finally {
    replacingDocId.value = null;
  }
}

// --- Tokenize ---
async function tokenizeRow(row: DocumentRecord) {
  if (!row.id) return;
  if (isTokenizing(row)) {
    await cancelDocumentTask(props.knowledgeId, row.id);
    ElMessage.success('已取消分词');
  } else {
    await tokenizeDocument(props.knowledgeId, row.id);
    ElMessage.success('已提交分词');
  }
  await getList(true);
}

// --- Navigate to upload page ---
function navigateToUploadPage() {
  router.push({
    name: 'KnowledgeUpload',
    params: {
      folderId: props.folderId || 'shared',
      type: props.type || props.knowledge?.type || 'BASE',
    },
    query: { id: idText(props.knowledgeId) },
  });
}

function importWebDocument() {
  importWebForm.name = '';
  importWebForm.selector = '';
  importWebForm.sourceUrl = '';
  importWebDialogVisible.value = true;
}

async function submitWebDocument() {
  if (!importWebForm.sourceUrl.trim()) {
    ElMessage.warning('请输入网页地址');
    return;
  }
  await createWebDocument(props.knowledgeId, {
    sourceUrl: importWebForm.sourceUrl.trim(),
    source_url: importWebForm.sourceUrl.trim(),
    selector: importWebForm.selector.trim() || undefined,
    name: importWebForm.name.trim() || undefined,
  });
  ElMessage.success('已提交 Web 文档导入');
  importWebDialogVisible.value = false;
  await getList(true);
}

function importWorkflowDocument() {
  router.push({
    name: 'KnowledgeImportWorkflow',
    params: { folderId: props.folderId || 'shared' },
    query: { id: idText(props.knowledgeId) },
  });
}

function openParagraph(row: DocumentRecord) {
  if (!row.id) return;
  router.push({
    name: 'KnowledgeDetail',
    params: {
      folderId: props.folderId || 'shared',
      id: props.knowledgeId,
      tab: 'document',
      type: props.type || props.knowledge?.type || 'BASE',
    },
    query: { documentId: row.id },
  });
}

// --- Inline name editing ---
function startEditName(row: DocumentRecord, event: Event) {
  event.stopPropagation();
  if (!row.id) return;
  editingDocId.value = row.id;
  editingName.value = textOf(row.name, '未命名文档');
  nextTick(() => {
    editingInputRef.value?.focus();
  });
}

async function saveEditName() {
  if (!editingDocId.value || !editingName.value.trim()) {
    editingDocId.value = null;
    return;
  }
  try {
    await updateDocument(props.knowledgeId, editingDocId.value, {
      name: editingName.value.trim(),
    });
    ElMessage.success('文档名称已更新');
    await getList(true);
  } catch {
    ElMessage.error('更新失败');
  } finally {
    editingDocId.value = null;
  }
}

function cancelEditName() {
  editingDocId.value = null;
}

function handleSelectionChange(rows: DocumentRecord[]) {
  multipleSelection.value = rows;
}

function clearSelection() {
  tableRef.value?.clearSelection();
}

async function batchReembed() {
  if (multipleSelection.value.length === 0) {
    ElMessage.warning('请先选择文档');
    return;
  }
  const targets = multipleSelection.value.filter((item) => item.id);
  if (targets.length === 0) return;
  loading.value = true;
  try {
    await Promise.all(
      targets.map((row) => reembedDocument(props.knowledgeId, row.id as Id)),
    );
    ElMessage.success('已批量提交向量化');
    clearSelection();
    await getList(true);
  } finally {
    loading.value = false;
  }
}

async function batchTokenize() {
  if (multipleSelection.value.length === 0) {
    ElMessage.warning('请先选择文档');
    return;
  }
  const targets = multipleSelection.value.filter((item) => item.id);
  if (targets.length === 0) return;
  loading.value = true;
  try {
    await batchTokenizeDocuments(
      props.knowledgeId,
      targets.map((row) => row.id as Id),
    );
    ElMessage.success('已批量提交分词');
    clearSelection();
    await getList(true);
  } finally {
    loading.value = false;
  }
}

async function batchDelete() {
  if (multipleSelection.value.length === 0) {
    ElMessage.warning('请先选择文档');
    return;
  }
  const targets = multipleSelection.value.filter((item) => item.id);
  if (targets.length === 0) return;
  loading.value = true;
  try {
    await Promise.all(
      targets.map((row) => deleteDocument(props.knowledgeId, row.id as Id)),
    );
    ElMessage.success('批量删除成功');
    clearSelection();
    await getList();
  } finally {
    loading.value = false;
  }
}

async function batchCancelTask() {
  if (multipleSelection.value.length === 0) {
    ElMessage.warning('请先选择文档');
    return;
  }
  const targets = multipleSelection.value.filter((item) => item.id);
  if (targets.length === 0) return;
  loading.value = true;
  try {
    await batchCancelDocumentTask(
      props.knowledgeId,
      targets.map((row) => row.id as Id),
    );
    ElMessage.success('批量取消成功');
    clearSelection();
    await getList(true);
  } finally {
    loading.value = false;
  }
}

async function doBatchHitHandling(method: string) {
  if (multipleSelection.value.length === 0) {
    ElMessage.warning('请先选择文档');
    return;
  }
  const targets = multipleSelection.value.filter((item) => item.id);
  if (targets.length === 0) return;
  loading.value = true;
  try {
    await batchHitHandling(
      props.knowledgeId,
      targets.map((row) => row.id as Id),
      method,
    );
    ElMessage.success('批量命中处理已更新');
    clearSelection();
    await getList(true);
  } finally {
    loading.value = false;
  }
}

async function batchGenerateQuestion() {
  if (multipleSelection.value.length === 0) {
    ElMessage.warning('请先选择文档');
    return;
  }
  const targets = multipleSelection.value.filter((item) => item.id);
  if (targets.length === 0) return;
  loading.value = true;
  try {
    await batchGenerateRelatedDocuments(
      props.knowledgeId,
      targets.map((row) => row.id as Id),
    );
    ElMessage.success('已批量生成问题');
    clearSelection();
    await getList(true);
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.knowledgeId,
  () => {
    resetPage();
    getList();
  },
);

onMounted(() => {
  getList();
  refreshTimer = window.setInterval(() => getList(true), 6000);
});

onBeforeUnmount(() => {
  if (refreshTimer) window.clearInterval(refreshTimer);
});
</script>

<template>
  <section class="knowledge-detail-panel">
    <header class="knowledge-detail-panel__header">
      <div>
        <h2>文档</h2>
        <span>管理当前知识库的文档、解析状态和向量化状态</span>
      </div>
      <div class="knowledge-detail-panel__actions">
        <ElInput
          v-model="searchName"
          clearable
          placeholder="搜索文档"
          style="width: 220px"
          @change="refresh"
        >
          <template #prefix>
            <ElIcon><Search /></ElIcon>
          </template>
        </ElInput>
        <ElSelect
          v-model="statusFilter"
          clearable
          placeholder="状态"
          style="width: 140px"
          @change="refresh"
        >
          <ElOption label="成功" value="SUCCESS" />
          <ElOption label="失败" value="FAILED" />
          <ElOption label="索引中" value="INDEXING" />
          <ElOption label="分词索引中" value="TOKENIZING" />
          <ElOption label="排队中" value="PENDING" />
          <ElOption label="生成中" value="GENERATING" />
        </ElSelect>
        <ElButton :icon="Refresh" @click="getList()">刷新</ElButton>
        <ElButton
          :disabled="multipleSelection.length === 0"
          @click="batchReembed"
        >
          向量化
        </ElButton>
        <ElButton
          :disabled="multipleSelection.length === 0"
          @click="batchTokenize"
        >
          分词索引
        </ElButton>
        <ElButton
          :disabled="multipleSelection.length === 0"
          @click="batchGenerateQuestion"
        >
          生成问题
        </ElButton>
        <ElButton
          v-if="isWebKnowledge()"
          type="primary"
          :icon="Upload"
          @click="importWebDocument"
        >
          导入文档
        </ElButton>
        <ElButton
          v-else-if="isWorkflowKnowledge()"
          type="primary"
          :icon="Upload"
          @click="importWorkflowDocument"
        >
          导入文档
        </ElButton>
        <ElButton
          v-else
          type="primary"
          :icon="DocumentAdd"
          @click="navigateToUploadPage"
        >
          上传文档
        </ElButton>
      </div>
    </header>

    <ElTable
      ref="tableRef"
      v-loading="loading"
      :data="documents"
      height="100%"
      row-key="id"
      class="knowledge-detail-table"
      @row-click="openParagraph"
      @selection-change="handleSelectionChange"
    >
      <ElTableColumn type="selection" width="45" :reserve-selection="true" />
      <ElTableColumn prop="name" label="文档名称" min-width="220">
        <template #default="{ row }">
          <div class="table-title" @click.stop>
            <template v-if="editingDocId === row.id">
              <ElInput
                ref="editingInputRef"
                v-model="editingName"
                size="small"
                @blur="saveEditName"
                @keyup.enter="saveEditName"
                @keyup.escape="cancelEditName"
              />
            </template>
            <template v-else>
              <div class="doc-name-cell">
                <div class="doc-name-text">
                  <strong>{{ textOf(row.name, '未命名文档') }}</strong>
                  <span>{{
                    textOf(row.source_type ?? row.sourceType, 'DOCUMENT')
                  }}</span>
                </div>
                <ElIcon
                  class="doc-name-edit-icon"
                  @click="startEditName(row, $event)"
                >
                  <Edit />
                </ElIcon>
              </div>
            </template>
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="status" label="状态" width="100">
        <template #default="{ row }">
          <ElTag :type="statusTagType(row.status)" effect="light" size="small">
            {{ statusText(row.status) }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="字符数" align="right" width="90" sortable="custom">
        <template #default="{ row }">
          {{
            countText(
              row.char_length ??
                row.charLength ??
                row.character_count ??
                row.characterCount,
            )
          }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="分段" align="right" width="80" sortable="custom">
        <template #default="{ row }">
          {{ countText(row.paragraph_count ?? row.paragraphCount) }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="命中处理" width="110">
        <template #default="{ row }">
          <ElTag
            v-if="hitHandlingText(row) !== '-'"
            type="info"
            effect="plain"
            size="small"
          >
            {{ hitHandlingText(row) }}
          </ElTag>
          <span v-else class="text-muted">-</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="标签" width="150">
        <template #default="{ row }">
          <div class="tag-cell">
            <span v-if="tagCountValue(row) > 0"
              >{{ tagCountValue(row) }} 个标签</span
            >
            <span v-else class="text-muted">-</span>
            <ElButton
              link
              type="primary"
              size="small"
              @click.stop="openTagSetting(row)"
            >
              添加
            </ElButton>
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="创建时间" width="170" sortable="custom">
        <template #default="{ row }">
          <span class="text-muted">{{
            dateText(row.create_time ?? row.createTime)
          }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="更新时间" width="160" sortable="custom">
        <template #default="{ row }">
          <span class="text-muted">{{
            dateText(
              row.update_time ??
                row.updateTime ??
                row.create_time ??
                row.createTime,
            )
          }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn fixed="right" label="操作" width="220">
        <template #default="{ row }">
          <div class="table-actions">
            <ElSwitch
              :model-value="enabledValue(row)"
              size="small"
              @click.stop
              @change="(val) => toggleEnabled(row, val)"
            />
            <ElButton
              v-if="isVectorizing(row)"
              link
              type="warning"
              size="small"
              @click.stop="cancelReembed(row)"
            >
              取消向量化
            </ElButton>
            <ElButton
              v-else
              link
              type="primary"
              size="small"
              @click.stop="reembed(row)"
            >
              向量化
            </ElButton>
            <ElButton
              v-if="isTokenizing(row)"
              link
              type="warning"
              size="small"
              @click.stop="tokenizeRow(row)"
            >
              取消分词
            </ElButton>
            <ElButton
              v-else
              link
              type="primary"
              size="small"
              @click.stop="tokenizeRow(row)"
            >
              分词
            </ElButton>
            <ElDropdown trigger="click" @click.stop>
              <ElButton link type="primary" size="small" @click.stop>
                <ElIcon><MoreFilled /></ElIcon>
              </ElButton>
              <template #dropdown>
                <ElDropdownMenu>
                  <ElDropdownItem @click="openEditDialog(row)">
                    设置
                  </ElDropdownItem>
                  <ElDropdownItem @click="generateQuestion(row)">
                    生成问题
                  </ElDropdownItem>
                  <ElDropdownItem @click="openTagSetting(row)">
                    标签设置
                  </ElDropdownItem>
                  <ElDropdownItem @click="migrateDocument(row)">
                    迁移
                  </ElDropdownItem>
                  <ElDropdownItem
                    divided
                    @click="handleDownloadSourceFile(row)"
                  >
                    <ElIcon class="mr-1"><Download /></ElIcon>下载原文档
                  </ElDropdownItem>
                  <ElDropdownItem divided @click="triggerReplaceUpload(row)">
                    <ElIcon class="mr-1"><Upload /></ElIcon>替换原文档
                  </ElDropdownItem>
                  <ElDropdownItem divided @click="exportDocumentExcel(row)">
                    导出 Excel
                  </ElDropdownItem>
                  <ElDropdownItem @click="exportDocumentZip(row)">
                    导出 Zip
                  </ElDropdownItem>
                  <ElDropdownItem divided @click="removeDocument(row)">
                    <span style="color: var(--el-color-danger)">删除</span>
                  </ElDropdownItem>
                </ElDropdownMenu>
              </template>
            </ElDropdown>
          </div>
        </template>
      </ElTableColumn>
      <template #empty>
        <ElEmpty description="暂无文档">
          <ElButton
            type="primary"
            :icon="DocumentAdd"
            @click="navigateToUploadPage"
          >
            上传文档
          </ElButton>
        </ElEmpty>
      </template>
    </ElTable>

    <footer class="knowledge-detail-panel__footer">
      <div class="knowledge-detail-panel__batch">
        <template v-if="multipleSelection.length > 0">
          <span>已选 {{ multipleSelection.length }} 项</span>
          <ElButton size="small" @click="batchReembed">批量向量化</ElButton>
          <ElPopconfirm title="确认批量取消向量化？" @confirm="batchCancelTask">
            <template #reference>
              <ElButton size="small">批量取消</ElButton>
            </template>
          </ElPopconfirm>
          <ElPopconfirm title="确认批量分词？" @confirm="batchTokenize">
            <template #reference>
              <ElButton size="small">批量分词</ElButton>
            </template>
          </ElPopconfirm>
          <ElDropdown @command="(method: string) => doBatchHitHandling(method)">
            <ElButton size="small">
              批量命中处理 <ElIcon class="el-icon--right"><ArrowDown /></ElIcon>
            </ElButton>
            <template #dropdown>
              <ElDropdownMenu>
                <ElDropdownItem command="optimization">优化模型</ElDropdownItem>
                <ElDropdownItem command="directly_return">
                  直接返回
                </ElDropdownItem>
              </ElDropdownMenu>
            </template>
          </ElDropdown>
          <ElPopconfirm
            title="确认批量生成问题？"
            @confirm="batchGenerateQuestion"
          >
            <template #reference>
              <ElButton size="small">批量生成问题</ElButton>
            </template>
          </ElPopconfirm>
          <ElPopconfirm title="确认批量删除选中文档？" @confirm="batchDelete">
            <template #reference>
              <ElButton size="small" type="danger">批量删除</ElButton>
            </template>
          </ElPopconfirm>
          <ElButton size="small" link type="primary" @click="clearSelection">
            清除选择
          </ElButton>
        </template>
        <span v-else>共 {{ numberOf(pagination.total) }} 个文档</span>
      </div>
      <ElPagination
        v-model:current-page="pagination.current"
        v-model:page-size="pagination.size"
        background
        layout="sizes, prev, pager, next"
        :total="pagination.total"
        @change="getList()"
      />
    </footer>

    <ElDialog v-model="editDialogVisible" title="文档设置" width="640">
      <ElForm :model="editForm" label-position="top">
        <ElFormItem label="文档名称" required>
          <ElInput v-model="editForm.name" placeholder="请输入文档名称" />
        </ElFormItem>
        <ElFormItem label="命中处理方式">
          <ElSelect
            v-model="editForm.hitHandlingMethod"
            placeholder="请选择命中处理方式"
            style="width: 100%"
          >
            <ElOption label="优化模型" value="optimization" />
            <ElOption label="直接返回" value="directly_return" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="直接返回相似度">
          <ElInputNumber
            v-model="editForm.directlyReturnSimilarity"
            :min="0"
            :max="1"
            :precision="2"
            :step="0.1"
            controls-position="right"
            style="width: 100%"
          />
        </ElFormItem>
        <ElFormItem label="允许下载">
          <ElSwitch
            v-model="editForm.allowDownload"
            active-text="允许"
            inactive-text="禁止"
          />
        </ElFormItem>
        <ElFormItem label="启用状态">
          <ElSwitch
            v-model="editForm.enabled"
            active-text="启用"
            inactive-text="停用"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="editDialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="submitDocument">保存</ElButton>
      </template>
    </ElDialog>

    <ElDialog
      v-model="importWebDialogVisible"
      title="导入 Web 文档"
      width="560"
    >
      <ElForm :model="importWebForm" label-position="top">
        <ElFormItem label="网页地址" required>
          <ElInput
            v-model="importWebForm.sourceUrl"
            placeholder="请输入网页 URL，例如 https://example.com"
          />
        </ElFormItem>
        <ElFormItem label="文档名称">
          <ElInput
            v-model="importWebForm.name"
            placeholder="留空将自动从网页标题获取"
          />
        </ElFormItem>
        <ElFormItem label="CSS 选择器">
          <ElInput
            v-model="importWebForm.selector"
            placeholder="可选，例如 .article-content，留空则抓取整个页面"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="importWebDialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="submitWebDocument">确认导入</ElButton>
      </template>
    </ElDialog>

    <!-- Hidden upload for replace source file -->
    <ElUpload
      ref="replaceUploadRef"
      action="#"
      :auto-upload="false"
      :file-list="[]"
      :show-file-list="false"
      style="display: none"
      @change="handleReplaceFileChange"
    />

    <TagSettingDrawer
      ref="tagSettingRef"
      :knowledge-id="props.knowledgeId"
      @refresh="getList"
    />
  </section>
</template>

<style scoped lang="scss">
.table-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  align-items: center;
}

.text-muted {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}

.tag-cell {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: var(--el-font-size-extra-small);
}

.doc-name-cell {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 2px 0;

  .doc-name-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .doc-name-edit-icon {
    flex-shrink: 0;
    font-size: calc(var(--el-font-size-base) * 1.125);
    color: var(--el-text-color-secondary);
    cursor: pointer;
    opacity: 0;
    transition: opacity var(--el-transition-duration);

    &:hover {
      color: var(--el-color-primary);
    }
  }

  &:hover .doc-name-edit-icon {
    opacity: 1;
  }
}

.mr-1 {
  margin-right: 4px;
}

:deep(.el-empty__bottom) {
  margin-top: 16px;
}

:deep(.el-empty .el-button) {
  color: var(--el-button-text-color);
}
</style>
