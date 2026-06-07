<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { Refresh } from '@element-plus/icons-vue';
import {
  ElButton,
  ElCheckbox,
  ElCheckboxGroup,
  ElDialog,
  ElEmpty,
  ElInput,
  ElMessage,
  ElTag,
} from 'element-plus';
import { cloneDeep } from 'lodash-es';

import { listKnowledge } from '#/api/ai/knowledge';

type KnowledgeRecord = Record<string, unknown>;

const emit = defineEmits<{
  select: [records: KnowledgeRecord[]];
}>();

const dialogVisible = ref(false);
const loading = ref(false);
const keyword = ref('');
const records = ref<KnowledgeRecord[]>([]);
const selectedIds = ref<Array<number | string>>([]);

const filteredRecords = computed(() => {
  const value = keyword.value.trim().toLowerCase();
  if (!value) return records.value;
  return records.value.filter((record) =>
    `${nameOf(record)} ${idOf(record)} ${typeOf(record)}`
      .toLowerCase()
      .includes(value),
  );
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function idOf(record: KnowledgeRecord): number | string {
  const value =
    record.id ?? record.knowledgeId ?? record.knowledge_id ?? record.value;
  return typeof value === 'number' || typeof value === 'string'
    ? value
    : `${value || ''}`;
}

function nameOf(record: KnowledgeRecord) {
  return `${record.name || record.knowledgeName || record.knowledge_name || record.title || idOf(record) || ''}`;
}

function typeOf(record: KnowledgeRecord) {
  return `${record.type || record.knowledgeType || record.knowledge_type || '知识库'}`;
}

function embeddingModelOf(record: KnowledgeRecord) {
  const value =
    record.embeddingModelId ??
    record.embedding_model_id ??
    (isRecord(record.embeddingModel) ? record.embeddingModel.id : undefined);
  return typeof value === 'number' || typeof value === 'string'
    ? `${value}`
    : '';
}

function normalizeCollection(value: unknown): KnowledgeRecord[] {
  if (Array.isArray(value))
    return value
      .filter((item) => isRecord(item))
      .map((item) => cloneDeep(item));
  if (!isRecord(value)) return [];
  for (const key of ['records', 'items', 'list', 'rows', 'data']) {
    const result = normalizeCollection(value[key]);
    if (result.length > 0) return result;
  }
  return [];
}

function mergeRecords(
  nextRecords: KnowledgeRecord[],
  selectedRecords: KnowledgeRecord[],
) {
  const map = new Map<string, KnowledgeRecord>();
  [...selectedRecords, ...nextRecords].forEach((record) => {
    const id = `${idOf(record)}`;
    if (id) map.set(id, cloneDeep(record));
  });
  records.value = [...map.values()];
}

async function loadRecords(selectedRecords: KnowledgeRecord[] = []) {
  loading.value = true;
  try {
    const response = await listKnowledge();
    mergeRecords(normalizeCollection(response), selectedRecords);
  } catch {
    mergeRecords([], selectedRecords);
    ElMessage.error('知识库列表加载失败');
  } finally {
    loading.value = false;
  }
}

function open(selectedRecords: KnowledgeRecord[] = []) {
  const currentRecords = cloneDeep(selectedRecords);
  selectedIds.value = currentRecords
    .map((item) => idOf(item))
    .filter((id) => `${id}`);
  keyword.value = '';
  mergeRecords([], currentRecords);
  dialogVisible.value = true;
  loadRecords(currentRecords);
}

function close() {
  dialogVisible.value = false;
}

function selectedRecords() {
  const selectedIdSet = new Set(selectedIds.value.map((id) => `${id}`));
  return records.value.filter((record) => selectedIdSet.has(`${idOf(record)}`));
}

function validateEmbeddingModel(items: KnowledgeRecord[]) {
  const models = items.map((item) => embeddingModelOf(item)).filter(Boolean);
  return new Set(models).size <= 1;
}

function submit() {
  const items = selectedRecords();
  if (!validateEmbeddingModel(items)) {
    ElMessage.warning('请选择相同向量模型的知识库');
    return;
  }
  dialogVisible.value = false;
  emit('select', cloneDeep(items));
}

watch(dialogVisible, (visible) => {
  if (visible) return;
  keyword.value = '';
});

defineExpose({ open });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    title="选择知识库"
    append-to-body
    :close-on-click-modal="false"
    width="640"
  >
    <div class="knowledge-select-dialog">
      <div class="knowledge-select-dialog__toolbar">
        <ElInput
          v-model="keyword"
          clearable
          placeholder="搜索知识库名称 / ID"
        />
        <ElButton
          :icon="Refresh"
          :loading="loading"
          @click="loadRecords(selectedRecords())"
        />
      </div>
      <ElCheckboxGroup
        v-model="selectedIds"
        class="knowledge-select-dialog__list"
      >
        <label
          v-for="record in filteredRecords"
          :key="`${idOf(record)}`"
          class="knowledge-select-dialog__item"
        >
          <ElCheckbox :value="idOf(record)" />
          <ElTag size="small" type="warning">{{ typeOf(record) }}</ElTag>
          <span class="knowledge-select-dialog__body">
            <strong>{{ nameOf(record) }}</strong>
            <small>{{ idOf(record) }}</small>
          </span>
        </label>
      </ElCheckboxGroup>
      <ElEmpty
        v-if="filteredRecords.length === 0"
        :description="loading ? '加载中' : '暂无可选知识库'"
        :image-size="52"
      />
    </div>
    <template #footer>
      <ElButton @click="close">取消</ElButton>
      <ElButton type="primary" @click="submit">保存</ElButton>
    </template>
  </ElDialog>
</template>

<style scoped lang="scss">
.knowledge-select-dialog {
  display: grid;
  gap: 8px;
}

.knowledge-select-dialog__toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.knowledge-select-dialog__list {
  display: grid;
  gap: 6px;
  max-height: 360px;
  overflow: auto;
}

.knowledge-select-dialog__item {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  padding: 8px;
  cursor: pointer;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.knowledge-select-dialog__body {
  display: grid;
  min-width: 0;
}

.knowledge-select-dialog__body strong,
.knowledge-select-dialog__body small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.knowledge-select-dialog__body strong {
  font-size: var(--el-font-size-base);
  color: var(--el-text-color-primary);
}

.knowledge-select-dialog__body small {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-placeholder);
}
</style>
