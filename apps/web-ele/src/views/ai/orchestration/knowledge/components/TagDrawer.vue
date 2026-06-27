<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import {
  ElButton,
  ElDialog,
  ElDrawer,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElPagination,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';

import {
  batchDeleteTags,
  createTag,
  deleteTag,
  pageTags,
  updateTag,
} from '#/api/ai/knowledge';

type Id = number | string;

interface TagValueRecord extends Record<string, unknown> {
  color?: string;
  doc_count?: number;
  docCount?: number;
  id?: Id;
  value: string;
}

interface TagGroupRecord extends Record<string, unknown> {
  key: string;
  values: TagValueRecord[];
}

interface TagRow extends Record<string, unknown> {
  color?: string;
  docCount: number;
  id?: Id;
  key: string;
  keyIndex: number;
  value: string;
}

const props = defineProps<{ knowledgeId?: Id }>();

const emit = defineEmits<{ refresh: [] }>();

const visible = ref(false);
const loading = ref(false);
const filterText = ref('');
const page = ref(1);
const pageSize = ref(20);
const selectedIds = ref<Id[]>([]);
const groups = ref<TagGroupRecord[]>([]);
const dialogVisible = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const editingRow = ref<TagRow>();
const form = ref({ key: '', value: '' });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordsOf(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value))
    return value.filter((item): item is Record<string, unknown> =>
      isRecord(item),
    );
  if (!isRecord(value)) return [];
  for (const key of ['records', 'items', 'list', 'rows', 'data']) {
    const nested = recordsOf(value[key]);
    if (nested.length > 0) return nested;
  }
  return [];
}

function idValue(value: unknown): Id | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return value;
  return undefined;
}

function stringValue(value: unknown, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return typeof value === 'string' ? value : `${value}`;
}

function parseTagName(name: unknown) {
  const value = stringValue(name).trim();
  if (!value) return { key: '标签', value: '未命名标签' };
  for (const separator of [' / ', ':', '：']) {
    const index = value.indexOf(separator);
    if (index > 0) {
      const key = value.slice(0, index).trim();
      const parsedValue = value.slice(index + separator.length).trim();
      if (key && parsedValue) return { key, value: parsedValue };
    }
  }
  return { key: '标签', value };
}

function tagDisplayName(key: string, value: string) {
  return `${key.trim()} / ${value.trim()}`;
}

function tagDocCount(entry: TagValueRecord) {
  if (typeof entry.doc_count === 'number') return entry.doc_count;
  if (typeof entry.docCount === 'number') return entry.docCount;
  return 0;
}

function pushGroupedTag(
  target: Map<string, TagGroupRecord>,
  row: TagValueRecord & { key: string },
) {
  const group = target.get(row.key) || { key: row.key, values: [] };
  group.values.push(row);
  target.set(row.key, group);
}

function normalizeTagGroups(value: unknown): TagGroupRecord[] {
  const records = recordsOf(value);
  const grouped = new Map<string, TagGroupRecord>();
  records.forEach((item) => {
    if (Array.isArray(item.values)) {
      const key = stringValue(item.key ?? item.name, '标签');
      item.values
        .filter((entry): entry is Record<string, unknown> => isRecord(entry))
        .forEach((entry) => {
          const parsed = parseTagName(entry.value ?? entry.name);
          pushGroupedTag(grouped, {
            ...entry,
            doc_count:
              typeof entry.doc_count === 'number' ? entry.doc_count : undefined,
            docCount:
              typeof entry.docCount === 'number' ? entry.docCount : undefined,
            id: idValue(entry.id),
            key,
            value: stringValue(entry.value ?? entry.name, parsed.value),
          });
        });
      if ((item.values || []).length === 0 && key) {
        grouped.set(key, grouped.get(key) || { key, values: [] });
      }
      return;
    }
    const source = isRecord(item.tag) ? item.tag : item;
    const parsed = parseTagName(
      source.name ?? source.value ?? source.label ?? item.name,
    );
    pushGroupedTag(grouped, {
      ...source,
      doc_count:
        typeof source.doc_count === 'number' ? source.doc_count : undefined,
      docCount:
        typeof source.docCount === 'number' ? source.docCount : undefined,
      id: idValue(source.id ?? item.tagId ?? item.tag_id),
      key: parsed.key,
      value: parsed.value,
    });
  });
  return [...grouped.values()];
}

const filteredGroups = computed(() => {
  const keyword = filterText.value.trim().toLowerCase();
  if (!keyword) return groups.value;
  return groups.value
    .map((group) => ({
      ...group,
      values: (group.values || []).filter((item) =>
        `${group.key || ''} ${item.value || ''} ${item.id || ''}`
          .toLowerCase()
          .includes(keyword),
      ),
    }))
    .filter(
      (group) =>
        (group.values?.length || 0) > 0 ||
        `${group.key || ''}`.toLowerCase().includes(keyword),
    );
});

const pagedGroups = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filteredGroups.value.slice(start, start + pageSize.value);
});

const tableRows = computed<TagRow[]>(() =>
  pagedGroups.value.flatMap((group) => {
    const values = group.values || [];
    if (values.length === 0) {
      return [
        {
          key: stringValue(group.key, '-'),
          value: '-',
          docCount: 0,
          keyIndex: 0,
        },
      ];
    }
    return values.map((entry, index) => ({
      docCount: tagDocCount(entry),
      id: idValue(entry.id),
      key: stringValue(group.key, '-'),
      keyIndex: index,
      color: typeof entry.color === 'string' ? entry.color : undefined,
      value: stringValue(entry.value, '-'),
    }));
  }),
);

const total = computed(() => filteredGroups.value.length);

function rowSpan({ row, columnIndex }: { columnIndex: number; row: TagRow }) {
  if (columnIndex === 0 || columnIndex === 1) {
    if (row.keyIndex === 0) {
      const sameKeyCount = tableRows.value.filter(
        (item) => item.key === row.key,
      ).length;
      return { rowspan: sameKeyCount, colspan: 1 };
    }
    return { rowspan: 0, colspan: 0 };
  }
  return undefined;
}

async function loadTags() {
  if (props.knowledgeId === undefined) return;
  loading.value = true;
  try {
    const response = await pageTags(props.knowledgeId, {
      current: 1,
      page: 1,
      size: 1000,
    });
    groups.value = normalizeTagGroups(response);
    selectedIds.value = selectedIds.value.filter((id) =>
      tableRows.value.some((row) => `${row.id ?? ''}` === `${id}`),
    );
  } finally {
    loading.value = false;
  }
}

function openCreate(row?: TagRow) {
  dialogMode.value = 'create';
  editingRow.value = row;
  form.value = {
    key: row?.key || '',
    value: '',
  };
  dialogVisible.value = true;
}

function openEdit(row: TagRow) {
  dialogMode.value = 'edit';
  editingRow.value = row;
  form.value = {
    key: row.key,
    value: row.value,
  };
  dialogVisible.value = true;
}

async function saveTag() {
  const knowledgeId = idValue(props.knowledgeId);
  if (knowledgeId === undefined) return;
  if (!form.value.key.trim() || !form.value.value.trim()) {
    ElMessage.warning('请输入标签键和值');
    return;
  }
  const payload = {
    ...(typeof editingRow.value?.color === 'string'
      ? { color: editingRow.value.color }
      : {}),
    name: tagDisplayName(form.value.key, form.value.value),
    key: form.value.key.trim(),
    value: form.value.value.trim(),
  };
  await (dialogMode.value === 'edit' && editingRow.value?.id !== undefined
    ? updateTag(knowledgeId, editingRow.value.id, payload)
    : createTag(knowledgeId, payload));
  ElMessage.success('保存成功');
  dialogVisible.value = false;
  await loadTags();
  emit('refresh');
}

async function removeRow(row: TagRow) {
  const knowledgeId = idValue(props.knowledgeId);
  if (knowledgeId === undefined || row.id === undefined) return;
  await deleteTag(knowledgeId, row.id);
  ElMessage.success('删除成功');
  await loadTags();
  emit('refresh');
}

async function batchDelete() {
  const knowledgeId = idValue(props.knowledgeId);
  if (knowledgeId === undefined || selectedIds.value.length === 0) return;
  await batchDeleteTags(knowledgeId, selectedIds.value);
  selectedIds.value = [];
  ElMessage.success('批量删除成功');
  await loadTags();
  emit('refresh');
}

function handleSelectionChange(rows: TagRow[]) {
  selectedIds.value = rows
    .map((row) => row.id)
    .filter((id): id is Id => id !== undefined);
}

function open() {
  visible.value = true;
  void loadTags();
}

watch(visible, (nextVisible) => {
  if (!nextVisible) {
    filterText.value = '';
    selectedIds.value = [];
    page.value = 1;
  }
});

defineExpose({ open });
</script>

<template>
  <ElDrawer v-model="visible" size="60%" append-to-body>
    <template #header>
      <h4>标签</h4>
    </template>
    <div class="tag-drawer__toolbar">
      <div>
        <ElButton type="primary" @click="openCreate()">新增标签</ElButton>
        <ElButton :disabled="selectedIds.length === 0" @click="batchDelete">
          批量删除
        </ElButton>
      </div>
      <ElInput
        v-model="filterText"
        clearable
        class="tag-drawer__search"
        placeholder="搜索标签"
        @change="page = 1"
      />
    </div>
    <ElTable
      :data="tableRows"
      :span-method="rowSpan"
      v-loading="loading"
      @selection-change="handleSelectionChange"
    >
      <ElTableColumn type="selection" width="55" />
      <ElTableColumn label="标签键">
        <template #default="{ row }">
          <div class="tag-drawer__row-main">
            <span>{{ row.key }}</span>
            <div v-if="row.keyIndex === 0" class="tag-drawer__actions">
              <ElButton link type="primary" @click.stop="openCreate(row)">
                添加值
              </ElButton>
              <ElButton link type="primary" @click.stop="openEdit(row)">
                编辑
              </ElButton>
              <ElButton link type="danger" @click.stop="removeRow(row)">
                删除
              </ElButton>
            </div>
            <div v-else class="tag-drawer__actions">
              <ElButton link type="primary" @click.stop="openEdit(row)">
                编辑
              </ElButton>
              <ElButton link type="danger" @click.stop="removeRow(row)">
                删除
              </ElButton>
            </div>
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn class-name="border-l" label="标签值">
        <template #default="{ row }">{{ row.value }}</template>
      </ElTableColumn>
      <ElTableColumn align="right" label="关联文档" width="120">
        <template #default="{ row }">
          <ElTag effect="plain" type="info">{{ row.docCount || 0 }}</ElTag>
        </template>
      </ElTableColumn>
    </ElTable>
    <div class="tag-drawer__pager">
      <ElPagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        layout="total, prev, pager, next, sizes"
      />
    </div>

    <ElDialog
      v-model="dialogVisible"
      :title="dialogMode === 'edit' ? '编辑标签' : '新增标签'"
      width="520px"
    >
      <ElForm label-position="top" :model="form">
        <ElFormItem label="标签键">
          <ElInput v-model="form.key" placeholder="请输入标签键" />
        </ElFormItem>
        <ElFormItem label="标签值">
          <ElInput v-model="form.value" placeholder="请输入标签值" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="saveTag">保存</ElButton>
      </template>
    </ElDialog>

    <ElEmpty v-if="tableRows.length === 0" description="暂无标签" />
  </ElDrawer>
</template>

<style scoped lang="scss">
.tag-drawer__toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.tag-drawer__search {
  width: 240px;
}

.tag-drawer__row-main {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.tag-drawer__actions {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.tag-drawer__pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
