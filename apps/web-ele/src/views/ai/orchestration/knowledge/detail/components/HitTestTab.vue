<script setup lang="ts">
import type {
  KnowledgeDetailTabProps,
  PageRecord,
} from './KnowledgeDetailTypes';

import { computed, nextTick, reactive, ref } from 'vue';

import { Search, Setting, Star } from '@element-plus/icons-vue';
import {
  ElButton,
  ElCard,
  ElCol,
  ElDialog,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElPopover,
  ElRadio,
  ElRadioGroup,
  ElRow,
  ElScrollbar,
  ElTag,
} from 'element-plus';
import { cloneDeep } from 'lodash-es';

import { searchKnowledge, updateParagraph } from '#/api/ai/knowledge';

import { countText, textOf } from './KnowledgeDetailTypes';

interface HitRecord extends PageRecord {
  content?: string;
  documentId?: number | string;
  document_id?: number | string;
  documentName?: string;
  document_name?: string;
  isActive?: boolean;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
  paragraphId?: number | string;
  paragraph_id?: number | string;
  score?: number;
  similarity?: number;
  starNum?: number;
  star_num?: number;
  title?: string;
  trampleNum?: number;
  trample_num?: number;
}

const props = defineProps<KnowledgeDetailTabProps>();

const loading = ref(false);
const first = ref(true);
const inputValue = ref('');
const questionTitle = ref('');
const popoverVisible = ref(false);
const hits = ref<HitRecord[]>([]);
const form = reactive({
  searchMode: 'embedding',
  similarityThreshold: 0.6,
  topK: 5,
});
const draftForm = reactive(cloneDeep(form));

const isDisabled = computed(() => !inputValue.value.trim() || loading.value);

function openSetting() {
  draftForm.searchMode = form.searchMode;
  draftForm.similarityThreshold = form.similarityThreshold;
  draftForm.topK = form.topK;
  popoverVisible.value = true;
}

function confirmSetting() {
  form.searchMode = draftForm.searchMode;
  form.similarityThreshold = draftForm.similarityThreshold;
  form.topK = draftForm.topK;
  popoverVisible.value = false;
}

function normalizeHits(response: Record<string, unknown>) {
  const documents = response.documents;
  if (Array.isArray(documents)) return documents as HitRecord[];
  const records = response.records;
  if (Array.isArray(records)) return records as HitRecord[];
  const content = response.content;
  if (typeof content === 'string' && content.trim()) {
    return [
      { content, id: 'content', score: undefined, title: questionTitle.value },
    ];
  }
  return [];
}

async function runHitTest() {
  if (isDisabled.value) return;
  loading.value = true;
  try {
    const query = inputValue.value.trim();
    const response = await searchKnowledge(props.knowledgeId, {
      knowledgeIds: [props.knowledgeId],
      query,
      queryText: query,
      query_text: query,
      searchMode: form.searchMode,
      search_mode: form.searchMode,
      similarity: form.similarityThreshold,
      similarityThreshold: form.similarityThreshold,
      topK: form.topK,
      top_number: form.topK,
    });
    questionTitle.value = query;
    hits.value = normalizeHits(response as Record<string, unknown>);
    inputValue.value = '';
    first.value = false;
  } finally {
    loading.value = false;
  }
}

function scoreValue(row: HitRecord) {
  const score = row.score ?? row.similarity;
  return typeof score === 'number' ? score.toFixed(3) : '-';
}

function documentName(row: HitRecord) {
  return textOf(
    row.document_name ??
      row.documentName ??
      row.metadata?.documentName ??
      row.metadata?.document_name ??
      row.document_id ??
      row.documentId,
    '未知文档',
  );
}

function starCount(row: HitRecord) {
  return Number(row.star_num ?? row.starNum ?? 0);
}

function trampleCount(row: HitRecord) {
  return Number(row.trample_num ?? row.trampleNum ?? 0);
}

function isInactive(row: HitRecord) {
  return row.is_active === false || row.isActive === false;
}

const editDialogVisible = ref(false);
const editContent = ref('');
const editingRow = ref<HitRecord | null>(null);
const editLoading = ref(false);
const inputRef = ref<InstanceType<typeof ElInput>>();

function openEditDialog(row: HitRecord) {
  editingRow.value = row;
  editContent.value = textOf(row.content, '');
  editDialogVisible.value = true;
}

async function saveEdit() {
  const row = editingRow.value;
  if (!row) return;
  const docId = row.document_id ?? row.documentId;
  const paraId = row.paragraph_id ?? row.paragraphId;
  if (!docId || !paraId) {
    ElMessage.info('缺少文档或分段信息，无法编辑');
    editDialogVisible.value = false;
    return;
  }
  editLoading.value = true;
  try {
    await updateParagraph(props.knowledgeId, docId, paraId, {
      content: editContent.value,
    });
    row.content = editContent.value;
    ElMessage.success('保存成功');
    editDialogVisible.value = false;
  } finally {
    editLoading.value = false;
  }
}

function insertNewline() {
  const el = inputRef.value?.ref as HTMLTextAreaElement | undefined;
  if (!el) {
    inputValue.value += '\n';
    return;
  }
  const start = el.selectionStart ?? inputValue.value.length;
  const end = el.selectionEnd ?? inputValue.value.length;
  inputValue.value = `${inputValue.value.slice(0, start)}\n${inputValue.value.slice(end)}`;
  nextTick(() => {
    el.selectionStart = el.selectionEnd = start + 1;
  });
}
</script>

<template>
  <section class="knowledge-hit-test">
    <header class="knowledge-detail-panel__header">
      <div>
        <h2>命中测试</h2>
        <span>输入问题，验证当前知识库的召回分段和相似度</span>
      </div>
      <ElPopover
        :visible="popoverVisible"
        placement="bottom-end"
        :width="520"
        trigger="click"
        @hide="popoverVisible = false"
      >
        <template #reference>
          <ElButton :icon="Setting" @click="openSetting">参数设置</ElButton>
        </template>
        <ElForm :model="draftForm" label-position="top">
          <ElFormItem label="检索模式">
            <ElRadioGroup
              v-model="draftForm.searchMode"
              class="search-mode-group"
            >
              <ElRadio value="embedding">向量检索</ElRadio>
              <ElRadio value="keywords">全文检索</ElRadio>
              <ElRadio value="blend">混合检索</ElRadio>
            </ElRadioGroup>
          </ElFormItem>
          <ElRow :gutter="16">
            <ElCol :span="12">
              <ElFormItem label="相似度阈值">
                <ElInputNumber
                  v-model="draftForm.similarityThreshold"
                  :max="draftForm.searchMode === 'blend' ? 2 : 1"
                  :min="0"
                  :precision="3"
                  :step="0.1"
                  controls-position="right"
                  style="width: 100%"
                />
              </ElFormItem>
            </ElCol>
            <ElCol :span="12">
              <ElFormItem label="引用上限">
                <ElInputNumber
                  v-model="draftForm.topK"
                  :max="100"
                  :min="1"
                  controls-position="right"
                  style="width: 100%"
                />
              </ElFormItem>
            </ElCol>
          </ElRow>
          <div class="popover-footer">
            <ElButton @click="popoverVisible = false">取消</ElButton>
            <ElButton type="primary" @click="confirmSetting">确认</ElButton>
          </div>
        </ElForm>
      </ElPopover>
    </header>

    <main v-loading="loading" class="knowledge-hit-test__main">
      <div v-if="questionTitle" class="knowledge-hit-test__question">
        <ElIcon><Search /></ElIcon>
        <strong>{{ questionTitle }}</strong>
      </div>
      <ElScrollbar class="knowledge-hit-test__scroll">
        <ElEmpty v-if="first" description="请输入问题开始命中测试" />
        <ElEmpty v-else-if="hits.length === 0" description="暂无命中结果" />
        <ElRow v-else :gutter="16">
          <ElCol
            v-for="(item, index) in hits"
            :key="`${item.id || index}`"
            :xs="24"
            :sm="12"
            :md="12"
            :lg="8"
            :xl="6"
            class="hit-card-col"
          >
            <ElCard
              shadow="hover"
              class="hit-card"
              :class="{ 'is-disabled': isInactive(item) }"
              @click="openEditDialog(item)"
            >
              <template #header>
                <div class="hit-card__header">
                  <span
                    >{{ countText(index + 1) }}.
                    {{ textOf(item.title, '命中分段') }}</span
                  >
                  <ElTag size="small" type="primary">
                    {{ scoreValue(item) }}
                  </ElTag>
                </div>
              </template>
              <p>{{ textOf(item.content, '-') }}</p>
              <footer class="hit-card__footer">
                <span>{{ documentName(item) }}</span>
                <span class="hit-card__stats">
                  <span class="hit-card__stat">
                    <ElIcon><Star /></ElIcon>
                    {{ starCount(item) }}
                  </span>
                  <span class="hit-card__stat hit-card__stat--trample">
                    {{ trampleCount(item) }}
                  </span>
                </span>
              </footer>
            </ElCard>
          </ElCol>
        </ElRow>
      </ElScrollbar>
    </main>

    <footer class="knowledge-hit-test__operate">
      <ElInput
        ref="inputRef"
        v-model="inputValue"
        :autosize="{ minRows: 1, maxRows: 3 }"
        placeholder="请输入测试问题（Enter 发送，Ctrl+Enter 换行）"
        type="textarea"
        @keydown.enter.exact.prevent="runHitTest"
        @keydown.ctrl.enter.prevent="insertNewline"
      />
      <ElButton
        type="primary"
        :disabled="isDisabled"
        :loading="loading"
        @click="runHitTest"
      >
        发送
      </ElButton>
    </footer>

    <ElDialog v-model="editDialogVisible" title="编辑分段" width="640">
      <ElInput
        v-model="editContent"
        :autosize="{ minRows: 6, maxRows: 16 }"
        type="textarea"
        placeholder="请输入分段内容"
      />
      <template #footer>
        <ElButton @click="editDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="editLoading" @click="saveEdit">
          保存
        </ElButton>
      </template>
    </ElDialog>
  </section>
</template>

<style scoped lang="scss">
.hit-card.is-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.hit-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  overflow: hidden;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.hit-card__stats {
  display: flex;
  gap: 12px;
  align-items: center;
}

.hit-card__stat {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}

.hit-card__stat--trample {
  color: var(--el-text-color-secondary);
}
</style>

<style scoped lang="scss">
.hit-card.is-disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.hit-card.is-disabled :deep(.el-card__body) {
  pointer-events: none;
}

.hit-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  overflow: hidden;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.hit-card__stats {
  display: flex;
  gap: 8px;
  align-items: center;
}

.hit-card__stat {
  display: inline-flex;
  gap: 2px;
  align-items: center;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.hit-card__stat--trample {
  color: var(--el-text-color-placeholder);
}
</style>

<style scoped lang="scss">
.hit-card.is-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.hit-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  overflow: hidden;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.hit-card__stats {
  display: flex;
  gap: 12px;
  align-items: center;
}

.hit-card__stat {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  color: var(--el-color-warning);
}

.hit-card__stat--trample {
  color: var(--el-text-color-secondary);
}
</style>

<style scoped lang="scss">
.hit-card.is-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.hit-card.is-disabled :deep(.el-card__body) {
  pointer-events: none;
}

.hit-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  overflow: hidden;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.hit-card__stats {
  display: flex;
  gap: 8px;
  align-items: center;
}

.hit-card__stat {
  display: inline-flex;
  gap: 2px;
  align-items: center;
  font-size: 12px;
}

.hit-card__stat--trample {
  color: var(--el-text-color-secondary);
}
</style>

<style scoped lang="scss">
.hit-card.is-disabled {
  pointer-events: none;
  cursor: not-allowed;
  opacity: 0.5;
}

.hit-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--kb-space-2, 8px);
  overflow: hidden;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.hit-card__stats {
  display: flex;
  gap: var(--kb-space-3, 12px);
  align-items: center;
}

.hit-card__stat {
  display: inline-flex;
  gap: var(--kb-space-1, 4px);
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  color: var(--el-color-warning);
}

.hit-card__stat--trample {
  color: var(--el-text-color-secondary);
}
</style>
