<script setup lang="ts">
import type { LoadFunction } from 'element-plus';

import type {
  Id,
  KnowledgeDetailTabProps,
  PageRecord,
} from './KnowledgeDetailTypes';

import type { AiRecord } from '#/api/ai/types';

import { onMounted, reactive, ref, watch } from 'vue';

import {
  Connection,
  Delete,
  EditPen,
  Plus,
  Search,
  View,
} from '@element-plus/icons-vue';
import {
  ElButton,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDrawer,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElMessage,
  ElPagination,
  ElPopconfirm,
  ElScrollbar,
  ElTable,
  ElTableColumn,
  ElTree,
} from 'element-plus';

import {
  batchAssociateProblems,
  batchDeleteProblems,
  createProblem,
  deleteProblem,
  getProblemParagraphs,
  pageDocuments,
  pageParagraphs,
  pageProblems,
  updateProblem,
} from '#/api/ai/knowledge';
import { recordsOf, totalOf } from '#/views/ai/orchestration/utils';

import { countText, dateText, numberOf, textOf } from './KnowledgeDetailTypes';

interface ProblemRecord extends PageRecord {
  content?: string;
  createTime?: string;
  create_time?: string;
  hitNum?: number;
  hit_num?: number;
  paragraphCount?: number;
  paragraph_count?: number;
  title?: string;
  updateTime?: string;
  update_time?: string;
}

interface DocumentNode {
  documentId: Id;
  id: string;
  isLeaf: false;
  label: string;
  type: 'document';
}

interface ParagraphNode {
  documentId: Id;
  id: string;
  isLeaf: true;
  label: string;
  type: 'paragraph';
}

type AssociateTreeNode = DocumentNode | ParagraphNode;

const props = defineProps<KnowledgeDetailTabProps>();

const loading = ref(false);
const keyword = ref('');
const list = ref<ProblemRecord[]>([]);
const pagination = reactive({ current: 1, page: 1, size: 10, total: 0 });
const dialogVisible = ref(false);
const form = reactive({ content: '', id: '' as Id });

const tableRef = ref<InstanceType<typeof ElTable>>();
const selection = ref<ProblemRecord[]>([]);

const batchVisible = ref(false);
const batchText = ref('');
const batchLoading = ref(false);

const associateVisible = ref(false);
const associateProblemId = ref<Id>('');
const associateProblemContent = ref('');
const associateLoading = ref(false);
const treeRef = ref<InstanceType<typeof ElTree>>();
const treeKey = ref(0);
const treeProps = {
  label: 'label',
  children: 'children',
  isLeaf: 'isLeaf',
};

const detailVisible = ref(false);
const detailRow = ref<null | ProblemRecord>(null);
const detailParagraphs = ref<any[]>([]);
const detailLoading = ref(false);

function resetPage() {
  pagination.current = 1;
  pagination.page = 1;
}

async function getList() {
  loading.value = true;
  try {
    const response = await pageProblems(props.knowledgeId, {
      current: pagination.current,
      keyword: keyword.value || undefined,
      page: pagination.current,
      size: pagination.size,
    });
    list.value = recordsOf<ProblemRecord>(response);
    pagination.total = totalOf(response);
  } finally {
    loading.value = false;
  }
}

function refresh() {
  resetPage();
  getList();
}

function openDialog(row?: ProblemRecord) {
  form.id = row?.id || '';
  form.content = textOf(row?.content ?? row?.title, '');
  dialogVisible.value = true;
}

async function submit() {
  if (!form.content.trim()) {
    ElMessage.warning('请输入问题');
    return;
  }
  if (form.id) {
    await updateProblem(props.knowledgeId, form.id, {
      content: form.content.trim(),
      title: form.content.trim(),
    });
    ElMessage.success('保存成功');
  } else {
    await createProblem(props.knowledgeId, {
      content: form.content.trim(),
      title: form.content.trim(),
    });
    ElMessage.success('创建成功');
  }
  dialogVisible.value = false;
  await getList();
}

async function remove(row: ProblemRecord) {
  if (!row.id) return;
  await deleteProblem(props.knowledgeId, row.id);
  ElMessage.success('删除成功');
  await getList();
}

function handleSelectionChange(val: ProblemRecord[]) {
  selection.value = val;
}

function openBatchDialog() {
  batchText.value = '';
  batchVisible.value = true;
}

async function submitBatch() {
  const lines = batchText.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    ElMessage.warning('请输入问题，每行一个');
    return;
  }
  batchLoading.value = true;
  try {
    await Promise.all(
      lines.map((line) =>
        createProblem(props.knowledgeId, { content: line, title: line }),
      ),
    );
    ElMessage.success(`批量创建成功，共 ${lines.length} 条`);
    batchVisible.value = false;
    await getList();
  } finally {
    batchLoading.value = false;
  }
}

async function batchDelete() {
  if (selection.value.length === 0) return;
  const ids = selection.value.map((r) => r.id).filter(Boolean) as Id[];
  await batchDeleteProblems(props.knowledgeId, ids);
  ElMessage.success(`批量删除成功，共 ${ids.length} 条`);
  tableRef.value?.clearSelection();
  await getList();
}

function openAssociate(row: ProblemRecord) {
  associateProblemId.value = row.id ?? '';
  associateProblemContent.value = textOf(row.content ?? row.title, '');
  treeKey.value += 1;
  associateVisible.value = true;
}

const loadTree: LoadFunction = async (node, resolve) => {
  try {
    if (node.level === 0) {
      const res = await pageDocuments(props.knowledgeId, {
        current: 1,
        size: 1000,
      });
      const docs = recordsOf<AiRecord>(res);
      const nodes: DocumentNode[] = docs.map((doc) => ({
        documentId: doc.id as Id,
        id: `doc-${doc.id}`,
        isLeaf: false,
        label: textOf(doc.name ?? doc.title ?? doc.id, '未命名文档'),
        type: 'document',
      }));
      resolve(nodes);
    } else if (node.data && node.data.type === 'document') {
      const docId = node.data.documentId as Id;
      const res = await pageParagraphs(props.knowledgeId, docId, {
        current: 1,
        size: 1000,
      });
      const paras = recordsOf<AiRecord>(res);
      const nodes: ParagraphNode[] = paras.map((para) => ({
        documentId: docId,
        id: `par-${para.id}`,
        isLeaf: true,
        label: textOf(para.content, textOf(para.id, '分段')),
        type: 'paragraph',
      }));
      resolve(nodes);
    } else {
      resolve([]);
    }
  } catch {
    resolve([]);
  }
};

async function submitAssociate() {
  const checked =
    (treeRef.value?.getCheckedNodes() as AssociateTreeNode[]) ?? [];
  const paragraphs = checked.filter((n) => n.type === 'paragraph');
  if (paragraphs.length === 0) {
    ElMessage.warning('请选择要关联的分段');
    return;
  }
  associateLoading.value = true;
  try {
    const paragraphIds = paragraphs.map((n) => {
      const raw = String(n.id);
      return raw.startsWith('par-') ? raw.slice(4) : raw;
    });
    await batchAssociateProblems(
      props.knowledgeId,
      [associateProblemId.value],
      paragraphIds,
    );
    ElMessage.success(`关联成功，共 ${paragraphs.length} 个分段`);
    associateVisible.value = false;
    await getList();
  } finally {
    associateLoading.value = false;
  }
}

async function openDetail(row: ProblemRecord) {
  detailRow.value = row;
  detailParagraphs.value = [];
  detailVisible.value = true;
  if (!row.id) return;
  detailLoading.value = true;
  try {
    const res = await getProblemParagraphs(props.knowledgeId, row.id);
    detailParagraphs.value = recordsOf(res);
  } finally {
    detailLoading.value = false;
  }
}

watch(
  () => props.knowledgeId,
  () => {
    resetPage();
    getList();
  },
);

onMounted(getList);
</script>

<template>
  <section class="knowledge-detail-panel">
    <header class="knowledge-detail-panel__header">
      <div>
        <h2>问题</h2>
        <span>维护 MaxKB 问题库，用于问题关联和命中统计</span>
      </div>
      <div class="knowledge-detail-panel__actions">
        <ElInput
          v-model="keyword"
          clearable
          placeholder="搜索问题"
          style="width: 260px"
          @change="refresh"
        >
          <template #prefix>
            <ElIcon><Search /></ElIcon>
          </template>
        </ElInput>
        <ElButton type="primary" :icon="Plus" @click="openDialog()">
          创建问题
        </ElButton>
        <ElButton :icon="Plus" @click="openBatchDialog">批量创建</ElButton>
        <ElPopconfirm
          :title="`确认批量删除选中的 ${selection.length} 个问题？`"
          @confirm="batchDelete"
        >
          <template #reference>
            <ElButton
              :icon="Delete"
              type="danger"
              plain
              :disabled="selection.length === 0"
            >
              批量删除
            </ElButton>
          </template>
        </ElPopconfirm>
      </div>
    </header>

    <ElTable
      ref="tableRef"
      v-loading="loading"
      :data="list"
      height="100%"
      row-key="id"
      @selection-change="handleSelectionChange"
    >
      <ElTableColumn type="selection" width="55" reserve-selection />
      <ElTableColumn label="问题" min-width="320">
        <template #default="{ row }">
          <span class="line-clamp-2">{{
            textOf(row.content ?? row.title, '-')
          }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="关联分段" align="right" width="110">
        <template #default="{ row }">
          {{ countText(row.paragraph_count ?? row.paragraphCount) }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="命中次数" align="right" width="110">
        <template #default="{ row }">
          {{ countText(row.hit_num ?? row.hitNum) }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="更新时间" width="180">
        <template #default="{ row }">
          {{
            dateText(
              row.update_time ??
                row.updateTime ??
                row.create_time ??
                row.createTime,
            )
          }}
        </template>
      </ElTableColumn>
      <ElTableColumn fixed="right" label="操作" width="260">
        <template #default="{ row }">
          <ElButton link type="primary" :icon="View" @click="openDetail(row)">
            详情
          </ElButton>
          <ElButton
            link
            type="primary"
            :icon="Connection"
            @click="openAssociate(row)"
          >
            关联分段
          </ElButton>
          <ElButton
            link
            type="primary"
            :icon="EditPen"
            @click="openDialog(row)"
          >
            编辑
          </ElButton>
          <ElPopconfirm title="确认删除该问题？" @confirm="remove(row)">
            <template #reference>
              <ElButton link type="danger" :icon="Delete">删除</ElButton>
            </template>
          </ElPopconfirm>
        </template>
      </ElTableColumn>
      <template #empty>
        <ElEmpty description="暂无问题" />
      </template>
    </ElTable>

    <footer class="knowledge-detail-panel__footer">
      <span>共 {{ numberOf(pagination.total) }} 个问题</span>
      <ElPagination
        v-model:current-page="pagination.current"
        v-model:page-size="pagination.size"
        background
        layout="sizes, prev, pager, next"
        :total="pagination.total"
        @change="getList"
      />
    </footer>

    <ElDialog
      v-model="dialogVisible"
      :title="form.id ? '编辑问题' : '创建问题'"
      width="560"
    >
      <ElForm :model="form" label-position="top">
        <ElFormItem label="问题" required>
          <ElInput
            v-model="form.content"
            :autosize="{ minRows: 4, maxRows: 8 }"
            placeholder="请输入问题"
            type="textarea"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="submit">保存</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="batchVisible" title="批量创建问题" width="560">
      <ElForm label-position="top">
        <ElFormItem label="问题列表" required>
          <ElInput
            v-model="batchText"
            :autosize="{ minRows: 8, maxRows: 16 }"
            placeholder="每行一个问题，例如：&#10;什么是知识库？&#10;如何创建文档？"
            type="textarea"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="batchVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="batchLoading" @click="submitBatch">
          批量创建
        </ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="associateVisible" title="关联分段" width="560">
      <div v-if="associateProblemContent" class="associate-problem">
        <span class="associate-problem__label">当前问题：</span>
        <span class="associate-problem__content">{{
          associateProblemContent
        }}</span>
      </div>
      <ElScrollbar height="360px">
        <ElTree
          :key="treeKey"
          ref="treeRef"
          :load="loadTree"
          :props="treeProps"
          check-strictly
          lazy
          node-key="id"
          show-checkbox
        >
          <template #default="{ data }">
            <span>{{ data.label }}</span>
          </template>
        </ElTree>
      </ElScrollbar>
      <template #footer>
        <ElButton @click="associateVisible = false">取消</ElButton>
        <ElButton
          type="primary"
          :loading="associateLoading"
          @click="submitAssociate"
        >
          确认关联
        </ElButton>
      </template>
    </ElDialog>

    <ElDrawer v-model="detailVisible" size="480px" title="问题详情">
      <template v-if="detailRow">
        <ElDescriptions :column="1" border>
          <ElDescriptionsItem label="问题内容">
            {{ textOf(detailRow.content ?? detailRow.title, '-') }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="关联分段">
            {{
              countText(detailRow.paragraph_count ?? detailRow.paragraphCount)
            }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="命中次数">
            {{ countText(detailRow.hit_num ?? detailRow.hitNum) }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="创建时间">
            {{ dateText(detailRow.create_time ?? detailRow.createTime) }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="更新时间">
            {{ dateText(detailRow.update_time ?? detailRow.updateTime) }}
          </ElDescriptionsItem>
        </ElDescriptions>
        <div class="detail-paragraphs">
          <h4>关联分段列表</h4>
          <div v-loading="detailLoading">
            <template v-if="detailParagraphs.length > 0">
              <div
                v-for="(para, idx) in detailParagraphs"
                :key="idx"
                class="detail-paragraphs__item"
              >
                <div class="detail-paragraphs__title">
                  {{ textOf(para.title ?? para.name, `分段 ${idx + 1}`) }}
                </div>
                <div class="detail-paragraphs__content">
                  {{ textOf(para.content ?? para.text, '-') }}
                </div>
              </div>
            </template>
            <ElEmpty v-else description="暂无关联分段" />
          </div>
        </div>
      </template>
    </ElDrawer>
  </section>
</template>

<style scoped>
.associate-problem {
  padding: 8px 12px;
  margin-bottom: 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.associate-problem__label {
  font-weight: 500;
  color: var(--el-text-color-secondary);
}

.associate-problem__content {
  color: var(--el-text-color-primary);
}

.detail-paragraphs {
  margin-top: 16px;
}

.detail-paragraphs h4 {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
}

.detail-paragraphs__item {
  padding: 10px 12px;
  margin-bottom: 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.detail-paragraphs__title {
  margin-bottom: 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.detail-paragraphs__content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
