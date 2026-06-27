<script setup lang="ts">
import type {
  Id,
  KnowledgeDetailTabProps,
  PageRecord,
} from './KnowledgeDetailTypes';

import { onMounted, reactive, ref, watch } from 'vue';

import {
  Delete,
  Download,
  EditPen,
  Plus,
  Search,
} from '@element-plus/icons-vue';
import {
  ElButton,
  ElDialog,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElMessage,
  ElPagination,
  ElPopconfirm,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';

import {
  createTerm,
  deleteTerm,
  pageTermbase,
  updateTerm,
} from '#/api/ai/knowledge';
import { recordsOf, totalOf } from '#/views/ai/orchestration/utils';

import { booleanOf, dateText, numberOf, textOf } from './KnowledgeDetailTypes';

interface TermRecord extends PageRecord {
  content?: string;
  createTime?: string;
  create_time?: string;
  definition?: string;
  enabled?: boolean;
  isActive?: boolean;
  is_active?: boolean;
  name?: string;
  term?: string;
  updateTime?: string;
  update_time?: string;
}

const props = defineProps<KnowledgeDetailTabProps>();

const loading = ref(false);
const keyword = ref('');
const list = ref<TermRecord[]>([]);
const pagination = reactive({ current: 1, page: 1, size: 10, total: 0 });
const dialogVisible = ref(false);
const form = reactive({
  content: '',
  enabled: true,
  id: '' as Id,
  name: '',
});

const tableRef = ref<InstanceType<typeof ElTable>>();
const selection = ref<TermRecord[]>([]);

const batchVisible = ref(false);
const batchText = ref('');
const batchLoading = ref(false);

const exportLoading = ref(false);

function enabledValue(row: TermRecord) {
  if (row.enabled !== undefined) return row.enabled;
  if (row.isActive !== undefined) return row.isActive;
  if (row.is_active !== undefined) return row.is_active;
  return true;
}

function resetPage() {
  pagination.current = 1;
  pagination.page = 1;
}

async function getList() {
  loading.value = true;
  try {
    const response = await pageTermbase(props.knowledgeId, {
      current: pagination.current,
      keyword: keyword.value || undefined,
      page: pagination.current,
      size: pagination.size,
    });
    list.value = recordsOf<TermRecord>(response);
    pagination.total = totalOf(response);
  } finally {
    loading.value = false;
  }
}

function refresh() {
  resetPage();
  getList();
}

function openDialog(row?: TermRecord) {
  form.id = row?.id || '';
  form.name = textOf(row?.term ?? row?.name, '');
  form.content = textOf(row?.definition ?? row?.content, '');
  form.enabled = row ? enabledValue(row) : true;
  dialogVisible.value = true;
}

async function submit() {
  if (!form.name.trim()) {
    ElMessage.warning('请输入术语');
    return;
  }
  const data = {
    content: form.content.trim(),
    enabled: form.enabled,
    isActive: form.enabled,
    is_active: form.enabled,
    name: form.name.trim(),
    title: form.name.trim(),
  };
  if (form.id) {
    await updateTerm(props.knowledgeId, form.id, data);
    ElMessage.success('保存成功');
  } else {
    await createTerm(props.knowledgeId, data);
    ElMessage.success('创建成功');
  }
  dialogVisible.value = false;
  await getList();
}

async function remove(row: TermRecord) {
  if (!row.id) return;
  await deleteTerm(props.knowledgeId, row.id);
  ElMessage.success('删除成功');
  await getList();
}

function handleSelectionChange(val: TermRecord[]) {
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
    ElMessage.warning('请输入术语，每行一个，格式：术语,解释');
    return;
  }
  const items = lines.map((line) => {
    let sep = '';
    if (line.includes(',')) {
      sep = ',';
    } else if (line.includes('，')) {
      sep = '，';
    } else if (line.includes('\t')) {
      sep = '\t';
    }
    let name = '';
    let content = '';
    if (sep) {
      const idx = line.indexOf(sep);
      name = line.slice(0, idx).trim();
      content = line.slice(idx + sep.length).trim();
    } else {
      name = line.trim();
      content = '';
    }
    return { name, content };
  });
  const invalid = items.find((item) => !item.name);
  if (invalid) {
    ElMessage.warning('每行格式：术语,解释（术语必填）');
    return;
  }
  batchLoading.value = true;
  try {
    await Promise.all(
      items.map((item) => {
        const data = {
          content: item.content,
          isActive: true,
          is_active: true,
          name: item.name,
          title: item.name,
        };
        return createTerm(props.knowledgeId, data);
      }),
    );
    ElMessage.success(`批量创建成功，共 ${items.length} 条`);
    batchVisible.value = false;
    await getList();
  } finally {
    batchLoading.value = false;
  }
}

async function batchDelete() {
  if (selection.value.length === 0) return;
  const rows = [...selection.value];
  await Promise.all(
    rows.map((row) =>
      row.id ? deleteTerm(props.knowledgeId, row.id) : Promise.resolve(),
    ),
  );
  ElMessage.success(`批量删除成功，共 ${rows.length} 条`);
  tableRef.value?.clearSelection();
  await getList();
}

function exportTxt() {
  if (selection.value.length === 0) return;
  exportLoading.value = true;
  try {
    const lines = selection.value.map((row) => {
      const name = textOf(row.term ?? row.name, '');
      const def = textOf(row.definition ?? row.content, '');
      return `${name},${def}`;
    });
    const text = lines.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'termbase_export.txt';
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success(`导出成功，共 ${selection.value.length} 条`);
    tableRef.value?.clearSelection();
  } finally {
    exportLoading.value = false;
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
        <h2>术语库</h2>
        <span>迁移 MaxKB 术语管理，用于知识库内专有名词解释</span>
      </div>
      <div class="knowledge-detail-panel__actions">
        <ElInput
          v-model="keyword"
          clearable
          placeholder="搜索术语"
          style="width: 240px"
          @change="refresh"
        >
          <template #prefix>
            <ElIcon><Search /></ElIcon>
          </template>
        </ElInput>
        <ElButton type="primary" :icon="Plus" @click="openDialog()">
          创建术语
        </ElButton>
        <ElButton :icon="Plus" @click="openBatchDialog">批量创建</ElButton>
        <ElPopconfirm
          :title="`确认批量删除选中的 ${selection.length} 个术语？`"
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
        <ElButton
          :icon="Download"
          :disabled="selection.length === 0"
          :loading="exportLoading"
          @click="exportTxt"
        >
          导出
        </ElButton>
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
      <ElTableColumn label="术语" min-width="220">
        <template #default="{ row }">
          <strong>{{ textOf(row.term ?? row.name, '-') }}</strong>
        </template>
      </ElTableColumn>
      <ElTableColumn label="解释" min-width="360">
        <template #default="{ row }">
          <span class="line-clamp-2">{{
            textOf(row.definition ?? row.content, '-')
          }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="状态" width="100">
        <template #default="{ row }">
          <ElTag
            :type="booleanOf(enabledValue(row), true) ? 'success' : 'info'"
            effect="plain"
          >
            {{ booleanOf(enabledValue(row), true) ? '启用' : '停用' }}
          </ElTag>
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
      <ElTableColumn fixed="right" label="操作" width="150">
        <template #default="{ row }">
          <ElButton
            link
            type="primary"
            :icon="EditPen"
            @click="openDialog(row)"
          >
            编辑
          </ElButton>
          <ElPopconfirm title="确认删除该术语？" @confirm="remove(row)">
            <template #reference>
              <ElButton link type="danger" :icon="Delete">删除</ElButton>
            </template>
          </ElPopconfirm>
        </template>
      </ElTableColumn>
      <template #empty>
        <ElEmpty description="暂无术语" />
      </template>
    </ElTable>

    <footer class="knowledge-detail-panel__footer">
      <span>共 {{ numberOf(pagination.total) }} 个术语</span>
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
      :title="form.id ? '编辑术语' : '创建术语'"
      width="560"
    >
      <ElForm :model="form" label-position="top">
        <ElFormItem label="术语" required>
          <ElInput v-model="form.name" placeholder="请输入术语" />
        </ElFormItem>
        <ElFormItem label="解释">
          <ElInput
            v-model="form.content"
            :autosize="{ minRows: 4, maxRows: 8 }"
            placeholder="请输入术语解释"
            type="textarea"
          />
        </ElFormItem>
        <ElFormItem label="启用状态">
          <ElSwitch
            v-model="form.enabled"
            active-text="启用"
            inactive-text="停用"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="submit">保存</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="batchVisible" title="批量创建术语" width="560">
      <ElForm label-position="top">
        <ElFormItem label="术语列表" required>
          <ElInput
            v-model="batchText"
            :autosize="{ minRows: 8, maxRows: 16 }"
            placeholder="每行一个，格式：术语,解释，例如：&#10;RAG,检索增强生成&#10;向量库,存储向量数据的数据库"
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
  </section>
</template>
