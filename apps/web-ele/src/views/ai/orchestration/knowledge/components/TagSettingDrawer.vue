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
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
} from 'element-plus';

import {
  bindDocumentTag,
  listDocumentTags,
  pageTags,
  unbindDocumentTag,
} from '#/api/ai/knowledge';

type Id = number | string;

interface DocumentRecord extends Record<string, unknown> {
  id?: Id;
  name?: string;
  title?: string;
}

interface TagValueRecord extends Record<string, unknown> {
  id?: Id;
  value: string;
}

interface TagGroupRecord extends Record<string, unknown> {
  key: string;
  values: TagValueRecord[];
}

interface TagRow extends Record<string, unknown> {
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
const documentRecord = ref<DocumentRecord>();
const currentTags = ref<TagGroupRecord[]>([]);
const availableTags = ref<TagGroupRecord[]>([]);
const selectedIds = ref<Id[]>([]);
const pickerVisible = ref(false);
const pickerValues = ref<Id[]>([]);

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
      id: idValue(source.id ?? item.tagId ?? item.tag_id),
      key: parsed.key,
      value: parsed.value,
    });
  });
  return [...grouped.values()];
}

function flattenTagGroups(groups: TagGroupRecord[]) {
  return groups.flatMap((group) =>
    group.values.map((value) => ({ ...value, key: group.key })),
  );
}

function bindingTagIds(value: unknown) {
  return recordsOf(value)
    .map((item) =>
      idValue(
        item.tagId ??
          item.tag_id ??
          (isRecord(item.tag) ? item.tag.id : undefined) ??
          item.id,
      ),
    )
    .filter((id): id is Id => id !== undefined);
}

function groupsFromRows(rows: Array<TagValueRecord & { key: string }>) {
  const grouped = new Map<string, TagGroupRecord>();
  rows.forEach((row) => pushGroupedTag(grouped, row));
  return [...grouped.values()];
}

const filteredGroups = computed(() => {
  const keyword = filterText.value.trim().toLowerCase();
  if (!keyword) return currentTags.value;
  return currentTags.value
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
      return [{ key: stringValue(group.key, '-'), value: '-', keyIndex: 0 }];
    }
    return values.map((entry, index) => ({
      id: idValue(entry.id),
      key: stringValue(group.key, '-'),
      keyIndex: index,
      value: stringValue(entry.value, '-'),
    }));
  }),
);

const availableTagOptions = computed(() =>
  availableTags.value.flatMap((group) =>
    (group.values || []).map((item) => ({
      label: `${stringValue(group.key, '')} / ${stringValue(item.value, '')}`,
      value: idValue(item.id) ?? '',
    })),
  ),
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

async function loadCurrentTags() {
  const knowledgeId = idValue(props.knowledgeId);
  const documentId = idValue(documentRecord.value?.id);
  if (knowledgeId === undefined || documentId === undefined) return;
  loading.value = true;
  try {
    const response = await listDocumentTags(knowledgeId, documentId);
    const ids = bindingTagIds(response).map((id) => `${id}`);
    const availableRows = flattenTagGroups(availableTags.value);
    currentTags.value =
      ids.length > 0 && availableRows.length > 0
        ? groupsFromRows(
            availableRows.filter(
              (row) => row.id !== undefined && ids.includes(`${row.id}`),
            ),
          )
        : normalizeTagGroups(response);
    selectedIds.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadAvailableTags() {
  const knowledgeId = idValue(props.knowledgeId);
  if (knowledgeId === undefined) return;
  const response = await pageTags(knowledgeId, {
    current: 1,
    page: 1,
    size: 1000,
  });
  availableTags.value = normalizeTagGroups(response);
}

function openPicker() {
  pickerValues.value = [];
  pickerVisible.value = true;
}

async function savePicker() {
  const knowledgeId = idValue(props.knowledgeId);
  const documentId = idValue(documentRecord.value?.id);
  if (
    knowledgeId === undefined ||
    documentId === undefined ||
    pickerValues.value.length === 0
  )
    return;
  await Promise.all(
    pickerValues.value.map((tagId) =>
      bindDocumentTag(knowledgeId, documentId, tagId),
    ),
  );
  ElMessage.success('标签已添加');
  pickerVisible.value = false;
  await loadCurrentTags();
  emit('refresh');
}

async function removeRow(row: TagRow) {
  const knowledgeId = idValue(props.knowledgeId);
  const documentId = idValue(documentRecord.value?.id);
  if (
    knowledgeId === undefined ||
    documentId === undefined ||
    row.id === undefined
  )
    return;
  await unbindDocumentTag(knowledgeId, documentId, row.id);
  ElMessage.success('标签已移除');
  await loadCurrentTags();
  emit('refresh');
}

async function batchDelete() {
  const knowledgeId = idValue(props.knowledgeId);
  const documentId = idValue(documentRecord.value?.id);
  if (
    knowledgeId === undefined ||
    documentId === undefined ||
    selectedIds.value.length === 0
  )
    return;
  await Promise.all(
    selectedIds.value.map((tagId) =>
      unbindDocumentTag(knowledgeId, documentId, tagId),
    ),
  );
  selectedIds.value = [];
  ElMessage.success('批量移除成功');
  await loadCurrentTags();
  emit('refresh');
}

function handleSelectionChange(rows: TagRow[]) {
  selectedIds.value = rows
    .map((row) => row.id)
    .filter((id): id is Id => id !== undefined);
}

async function loadDrawerData() {
  await loadAvailableTags();
  await loadCurrentTags();
}

function open(row: DocumentRecord) {
  documentRecord.value = row;
  visible.value = true;
  void loadDrawerData();
}

watch(visible, (nextVisible) => {
  if (!nextVisible) {
    filterText.value = '';
    page.value = 1;
    selectedIds.value = [];
  }
});

defineExpose({ open });
</script>

<template>
  <ElDrawer v-model="visible" size="60%" append-to-body>
    <template #header>
      <h4>标签设置</h4>
    </template>
    <div class="tag-setting-drawer__toolbar">
      <div>
        <ElButton type="primary" @click="openPicker">添加标签</ElButton>
        <ElButton :disabled="selectedIds.length === 0" @click="batchDelete">
          批量删除
        </ElButton>
      </div>
      <ElInput
        v-model="filterText"
        clearable
        class="tag-setting-drawer__search"
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
          <div class="tag-setting-drawer__row-main">
            <span>{{ row.key }}</span>
            <span v-if="row.keyIndex === 0" class="tag-setting-drawer__hint">
              可批量管理同键标签值
            </span>
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn class-name="border-l" label="标签值">
        <template #default="{ row }">{{ row.value }}</template>
      </ElTableColumn>
      <ElTableColumn align="right" label="操作" width="110">
        <template #default="{ row }">
          <ElButton link type="danger" @click.stop="removeRow(row)">
            移除
          </ElButton>
        </template>
      </ElTableColumn>
    </ElTable>
    <div class="tag-setting-drawer__pager">
      <ElPagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        layout="total, prev, pager, next, sizes"
      />
    </div>

    <ElDialog v-model="pickerVisible" title="添加标签" width="520px">
      <ElForm label-position="top">
        <ElFormItem label="选择标签">
          <ElSelect
            v-model="pickerValues"
            clearable
            filterable
            multiple
            collapse-tags
            placeholder="请选择标签"
          >
            <ElOption
              v-for="item in availableTagOptions"
              :key="String(item.value)"
              :label="item.label"
              :value="item.value"
            />
          </ElSelect>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="pickerVisible = false">取消</ElButton>
        <ElButton type="primary" @click="savePicker">保存</ElButton>
      </template>
    </ElDialog>

    <ElEmpty v-if="tableRows.length === 0" description="当前文档暂无标签" />
  </ElDrawer>
</template>

<style scoped lang="scss">
.tag-setting-drawer__toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.tag-setting-drawer__search {
  width: 240px;
}

.tag-setting-drawer__row-main {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.tag-setting-drawer__hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.tag-setting-drawer__pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
