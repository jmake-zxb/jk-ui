<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { Close, Plus } from '@element-plus/icons-vue';
import {
  ElButton,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElOption,
  ElRadio,
  ElRadioGroup,
  ElSelect,
  ElText,
  ElTooltip,
} from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

import { listKnowledgeTags } from '#/api/ai/knowledge';

import { syncNodeProperties } from '../../common/node-inline-update';
import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';
import KnowledgeSelectDialog from '../search-knowledge-node/component/KnowledgeSelectDialog.vue';

type KnowledgeRecord = Record<string, unknown>;
type SearchScopeType = 'custom' | 'referencing';
type SearchScopeSource = 'document' | 'knowledge';
type SearchMode = 'auto' | 'custom';
type SearchConditionType = 'AND' | 'OR';

type SearchCondition = {
  compare: string;
  key: string;
  value: string;
};

type KnowledgeTagRecord = Record<string, unknown>;

type SearchDocumentNodeData = Record<string, unknown> & {
  knowledge_id_list: Array<number | string>;
  knowledge_list?: KnowledgeRecord[];
  question_reference: unknown[];
  search_condition_list: SearchCondition[];
  search_condition_type: SearchConditionType;
  search_mode: SearchMode;
  search_scope_reference: unknown[];
  search_scope_source: SearchScopeSource;
  search_scope_type: SearchScopeType;
  topK: number;
};

const props = defineProps<{ nodeModel: any; renderVersion?: number }>();
const nodeModel = props.nodeModel;

const defaultNodeData: SearchDocumentNodeData = {
  knowledge_id_list: [],
  question_reference: ['start-node', 'question'],
  search_condition_list: [],
  search_condition_type: 'AND',
  search_mode: 'auto',
  search_scope_reference: [],
  search_scope_source: 'knowledge',
  search_scope_type: 'custom',
  topK: 5,
};

const compareOptions = [
  { label: '包含', value: 'contain' },
  { label: '不包含', value: 'not_contain' },
  { label: '等于', value: 'eq' },
];

const formRef = ref<FormInstance>();
const scopeCascaderRef = ref<InstanceType<typeof NodeCascader>>();
const questionCascaderRef = ref<InstanceType<typeof NodeCascader>>();
const knowledgeDialogRef = ref<InstanceType<typeof KnowledgeSelectDialog>>();
const knowledgeTagOptions = ref<KnowledgeTagRecord[]>([]);
const tagLoading = ref(false);
const formData = ref<SearchDocumentNodeData>(
  normalizeNodeData(nodeModel.properties?.node_data),
);
const nodeRenderVersion = ref(0);

const selectedKnowledgeItems = computed(() => {
  const records = Array.isArray(formData.value.knowledge_list)
    ? formData.value.knowledge_list
    : [];
  return formData.value.knowledge_id_list.map((id) => {
    const record = records.find((item) => `${idOf(item)}` === `${id}`);
    return record || { id, name: `${id}` };
  });
});
const conditionKeyOptions = computed(() => {
  const values = new Map<string, string>();
  knowledgeTagOptions.value.forEach((record) => {
    const key = tagKeyOf(record);
    if (key) values.set(key, tagLabelOf(record));
  });
  formData.value.search_condition_list.forEach((condition) => {
    if (condition.key) values.set(condition.key, condition.key);
  });
  return [...values.entries()].map(([value, label]) => ({ label, value }));
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textValue(value: unknown) {
  return `${value ?? ''}`.trim();
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function scopeType(value: unknown): SearchScopeType {
  return value === 'referencing' ? 'referencing' : 'custom';
}

function scopeSource(value: unknown): SearchScopeSource {
  return value === 'document' ? 'document' : 'knowledge';
}

function searchMode(value: unknown): SearchMode {
  return value === 'custom' ? 'custom' : 'auto';
}

function conditionType(value: unknown): SearchConditionType {
  return value === 'OR' ? 'OR' : 'AND';
}

function normalizeCondition(value: unknown): SearchCondition {
  const source = isRecord(value) ? value : {};
  return {
    compare: textValue(source.compare) || 'contain',
    key: textValue(source.key),
    value: textValue(source.value),
  };
}

function normalizeNodeData(value: unknown): SearchDocumentNodeData {
  const source = isRecord(value) ? cloneDeep(value) : {};
  const next: SearchDocumentNodeData = {
    ...source,
    knowledge_id_list: Array.isArray(source.knowledge_id_list)
      ? cloneDeep(source.knowledge_id_list).filter(
          (item) => typeof item === 'number' || typeof item === 'string',
        )
      : [],
    question_reference: Array.isArray(source.question_reference)
      ? cloneDeep(source.question_reference)
      : cloneDeep(defaultNodeData.question_reference),
    search_condition_list: Array.isArray(source.search_condition_list)
      ? source.search_condition_list.map((item) => normalizeCondition(item))
      : [],
    search_condition_type: conditionType(source.search_condition_type),
    search_mode: searchMode(source.search_mode),
    search_scope_reference: Array.isArray(source.search_scope_reference)
      ? cloneDeep(source.search_scope_reference)
      : [],
    search_scope_source: scopeSource(source.search_scope_source),
    search_scope_type: scopeType(source.search_scope_type),
    topK: numberValue(source.topK, defaultNodeData.topK),
  };
  if (Array.isArray(source.knowledge_list)) {
    next.knowledge_list = cloneDeep(source.knowledge_list).filter((item) =>
      isRecord(item),
    );
  }
  if (
    next.search_scope_type === 'referencing' &&
    next.search_mode === 'custom'
  ) {
    next.search_mode = 'auto';
  }
  return next;
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

function tagKeyOf(record: KnowledgeTagRecord) {
  const value = record.key;
  return `${value ?? ''}`.trim();
}

function tagLabelOf(record: KnowledgeTagRecord) {
  const key = tagKeyOf(record);
  return key || `${record.label ?? ''}`.trim();
}

function normalizeTagRecords(value: unknown): KnowledgeTagRecord[] {
  if (Array.isArray(value)) {
    return value.filter((item) => isRecord(item));
  }
  if (!isRecord(value)) return [];
  for (const key of ['records', 'items', 'list', 'rows', 'data']) {
    const records = normalizeTagRecords(value[key]);
    if (records.length > 0) return records;
  }
  return [];
}

function hasReferenceValue(value: unknown) {
  return Array.isArray(value) && value.length >= 2;
}

function validationError(errMessage: string) {
  return Object.assign(new Error(errMessage), {
    errMessage,
    node: nodeModel,
  });
}

function syncNodeData() {
  syncNodeProperties(nodeModel, { node_data: cloneDeep(formData.value) }, [
    'node_data',
  ]);
  nodeRenderVersion.value += 1;
}

function patchData(key: keyof SearchDocumentNodeData, value: unknown) {
  set(formData.value, key, cloneDeep(value));
  syncNodeData();
}

function patchSearchScopeType(value: unknown) {
  const nextType = scopeType(value);
  set(formData.value, 'search_scope_type', nextType);
  if (nextType === 'referencing') {
    set(formData.value, 'knowledge_id_list', []);
    set(formData.value, 'knowledge_list', []);
    set(formData.value, 'search_mode', 'auto');
  } else {
    set(formData.value, 'search_scope_reference', []);
  }
  syncNodeData();
}

function patchSearchScopeSource(value: unknown) {
  set(formData.value, 'search_scope_source', scopeSource(value));
  set(formData.value, 'search_scope_reference', []);
  syncNodeData();
}

function patchSearchMode(value: unknown) {
  const nextMode = searchMode(value);
  set(formData.value, 'search_mode', nextMode);
  if (nextMode === 'auto') set(formData.value, 'search_condition_list', []);
  syncNodeData();
}

function openKnowledgeDialog() {
  knowledgeDialogRef.value?.open(selectedKnowledgeItems.value);
}

function applyKnowledgeSelection(records: KnowledgeRecord[]) {
  const normalizedRecords = cloneDeep(records);
  set(
    formData.value,
    'knowledge_id_list',
    normalizedRecords.map((item) => idOf(item)).filter((id) => `${id}`),
  );
  set(formData.value, 'knowledge_list', normalizedRecords);
  syncNodeData();
}

async function loadKnowledgeTags() {
  const ids = formData.value.knowledge_id_list.filter((id) => `${id}`);
  if (ids.length === 0) {
    knowledgeTagOptions.value = [];
    return;
  }
  tagLoading.value = true;
  try {
    const responses = await listKnowledgeTags(ids);
    const records = responses.flatMap((response) =>
      normalizeTagRecords(response),
    );
    const seen = new Set<string>();
    knowledgeTagOptions.value = records.filter((record) => {
      const key = tagKeyOf(record);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    knowledgeTagOptions.value = [];
  } finally {
    tagLoading.value = false;
  }
}

function removeKnowledge(id: number | string) {
  const nextIds = formData.value.knowledge_id_list.filter(
    (item) => `${item}` !== `${id}`,
  );
  set(formData.value, 'knowledge_id_list', nextIds);
  if (Array.isArray(formData.value.knowledge_list)) {
    set(
      formData.value,
      'knowledge_list',
      formData.value.knowledge_list.filter(
        (item) => `${idOf(item)}` !== `${id}`,
      ),
    );
  }
  syncNodeData();
}

function addCondition() {
  set(formData.value, 'search_condition_list', [
    ...formData.value.search_condition_list,
    { compare: 'contain', key: '', value: '' },
  ]);
  syncNodeData();
}

function patchCondition(index: number, patch: Partial<SearchCondition>) {
  set(
    formData.value,
    'search_condition_list',
    formData.value.search_condition_list.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    ),
  );
  syncNodeData();
}

function removeCondition(index: number) {
  set(
    formData.value,
    'search_condition_list',
    formData.value.search_condition_list.filter(
      (_item, itemIndex) => itemIndex !== index,
    ),
  );
  syncNodeData();
}

function validateConditions() {
  if (formData.value.search_mode !== 'custom') return;
  if (formData.value.search_condition_list.length === 0) {
    throw validationError('请添加检索条件');
  }
  formData.value.search_condition_list.forEach((condition) => {
    if (!condition.key.trim()) throw validationError('请输入检索字段');
    if (!condition.compare.trim()) throw validationError('请选择比较方式');
    if (!condition.value.trim()) throw validationError('请输入检索值');
  });
}

async function validate() {
  try {
    if (formData.value.search_scope_type === 'custom') {
      if (formData.value.knowledge_id_list.length === 0) {
        throw validationError('请选择知识库');
      }
    } else if (!hasReferenceValue(formData.value.search_scope_reference)) {
      throw validationError('请选择检索范围变量');
    }
    if (formData.value.search_mode === 'auto') {
      if (!hasReferenceValue(formData.value.question_reference)) {
        throw validationError('请选择检索问题变量');
      }
    } else {
      validateConditions();
    }
    await formRef.value?.validate();
    await scopeCascaderRef.value?.validate();
    await questionCascaderRef.value?.validate();
  } catch (error) {
    if (error instanceof Error && 'node' in error) throw error;
    throw Object.assign(new Error(`${error || ''}`), {
      errMessage: error,
      node: nodeModel,
    });
  }
}

onMounted(() => {
  syncNodeData();
  set(nodeModel, 'validate', validate);
});

watch(
  () => cloneDeep(formData.value.knowledge_id_list),
  () => {
    loadKnowledgeTags();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (nodeModel.validate === validate) {
    set(nodeModel, 'validate', undefined);
  }
});
</script>

<template>
  <NodeContainer
    :node-model="nodeModel"
    :render-version="nodeRenderVersion + (renderVersion || 0)"
  >
    <ElForm
      ref="formRef"
      :model="formData"
      label-position="top"
      @submit.prevent
    >
      <div class="workflow-search-document-node">
        <div class="workflow-search-document-node__head">节点设置</div>
        <ElFormItem label="选择知识库">
          <template #label>
            <div class="workflow-search-document-node__label">
              <span>选择知识库</span>
              <span class="workflow-search-document-node__tools">
                <ElButton
                  v-if="formData.search_scope_type === 'custom'"
                  link
                  type="primary"
                  :icon="Plus"
                  @click="openKnowledgeDialog"
                />
                <ElSelect
                  :model-value="formData.search_scope_type"
                  :teleported="false"
                  size="small"
                  class="workflow-search-document-node__scope-select"
                  @update:model-value="patchSearchScopeType"
                >
                  <ElOption label="引用" value="referencing" />
                  <ElOption label="自定义" value="custom" />
                </ElSelect>
              </span>
            </div>
          </template>
          <div
            v-if="formData.search_scope_type === 'custom'"
            class="workflow-search-document-node__knowledge-list"
          >
            <ElText v-if="selectedKnowledgeItems.length === 0" type="info">
              请选择关联知识库
            </ElText>
            <div
              v-for="item in selectedKnowledgeItems"
              :key="`${idOf(item)}`"
              class="workflow-search-document-node__knowledge-item"
            >
              <span class="workflow-search-document-node__knowledge-badge">
                知
              </span>
              <span
                class="workflow-search-document-node__knowledge-name"
                :title="nameOf(item)"
              >
                {{ nameOf(item) }}
              </span>
              <ElButton
                text
                :icon="Close"
                size="small"
                @click="removeKnowledge(idOf(item))"
              />
            </div>
          </div>
          <div v-else class="workflow-search-document-node__reference">
            <div class="workflow-search-document-node__label is-inner">
              <span>
                选择变量
                <span class="workflow-search-document-node__required">*</span>
              </span>
              <ElSelect
                :model-value="formData.search_scope_source"
                :teleported="false"
                size="small"
                class="workflow-search-document-node__source-select"
                @update:model-value="patchSearchScopeSource"
              >
                <ElOption label="知识库列表" value="knowledge" />
                <ElOption label="文档列表" value="document" />
              </ElSelect>
            </div>
            <ElFormItem prop="search_scope_reference">
              <NodeCascader
                ref="scopeCascaderRef"
                :node-model="nodeModel"
                :model-value="formData.search_scope_reference"
                class="w-full"
                placeholder="请选择变量"
                @update:model-value="
                  patchData('search_scope_reference', $event)
                "
              />
            </ElFormItem>
          </div>
        </ElFormItem>
        <ElFormItem label="检索设置">
          <ElRadioGroup
            :model-value="formData.search_mode"
            @update:model-value="patchSearchMode"
          >
            <ElRadio value="auto">
              <span class="workflow-search-document-node__radio-label">
                自动
                <ElTooltip content="按问题变量自动检索文档" placement="top">
                  <span class="workflow-search-document-node__hint">?</span>
                </ElTooltip>
              </span>
            </ElRadio>
            <ElRadio
              v-if="formData.search_scope_type === 'custom'"
              value="custom"
            >
              <span class="workflow-search-document-node__radio-label">
                自定义条件
                <ElTooltip content="按知识库标签字段过滤文档" placement="top">
                  <span class="workflow-search-document-node__hint">?</span>
                </ElTooltip>
              </span>
            </ElRadio>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem
          v-if="formData.search_mode === 'auto'"
          label="检索问题"
          prop="question_reference"
        >
          <NodeCascader
            ref="questionCascaderRef"
            :node-model="nodeModel"
            :model-value="formData.question_reference"
            class="w-full"
            placeholder="请选择问题变量"
            @update:model-value="patchData('question_reference', $event)"
          />
        </ElFormItem>
        <div v-else class="workflow-search-document-node__conditions">
          <div class="workflow-search-document-node__condition-head">
            <ElText size="small" type="info">满足</ElText>
            <ElSelect
              :model-value="formData.search_condition_type"
              :teleported="false"
              size="small"
              class="workflow-search-document-node__logic-select"
              @update:model-value="
                patchData('search_condition_type', conditionType($event))
              "
            >
              <ElOption label="AND" value="AND" />
              <ElOption label="OR" value="OR" />
            </ElSelect>
            <ElText size="small" type="info">以下条件</ElText>
          </div>
          <div
            v-for="(condition, index) in formData.search_condition_list"
            :key="index"
            class="workflow-search-document-node__condition-row"
          >
            <ElSelect
              :model-value="condition.key"
              allow-create
              clearable
              filterable
              :loading="tagLoading"
              placeholder="字段"
              :teleported="false"
              @update:model-value="
                patchCondition(index, { key: textValue($event) })
              "
            >
              <ElOption
                v-for="item in conditionKeyOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
            <ElSelect
              :model-value="condition.compare"
              :teleported="false"
              @update:model-value="
                patchCondition(index, { compare: textValue($event) })
              "
            >
              <ElOption
                v-for="item in compareOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
            <ElInput
              :model-value="condition.value"
              clearable
              placeholder="值"
              @update:model-value="patchCondition(index, { value: $event })"
            />
            <ElButton
              text
              type="info"
              :icon="Close"
              @click="removeCondition(index)"
            />
          </div>
          <ElButton link type="primary" :icon="Plus" @click="addCondition">
            添加条件
          </ElButton>
        </div>
        <ElFormItem label="Top K">
          <ElInputNumber
            :model-value="formData.topK"
            :min="1"
            :max="50"
            :step="1"
            :step-strictly="true"
            controls-position="right"
            class="w-full"
            @update:model-value="patchData('topK', $event || 1)"
          />
        </ElFormItem>
      </div>
    </ElForm>
    <KnowledgeSelectDialog
      ref="knowledgeDialogRef"
      @select="applyKnowledgeSelection"
    />
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-search-document-node,
.workflow-search-document-node__knowledge-list,
.workflow-search-document-node__reference,
.workflow-search-document-node__conditions {
  display: grid;
  gap: 8px;
}

.workflow-search-document-node {
  padding: 8px;
  overflow: visible;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-search-document-node__head,
.workflow-search-document-node__label,
.workflow-search-document-node__condition-head {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-width: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.workflow-search-document-node__label.is-inner {
  margin-bottom: 4px;
}

.workflow-search-document-node__tools,
.workflow-search-document-node__radio-label {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.workflow-search-document-node__scope-select,
.workflow-search-document-node__logic-select {
  width: 92px;
}

.workflow-search-document-node__source-select {
  width: 96px;
}

.workflow-search-document-node__knowledge-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 5px 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-search-document-node__knowledge-badge,
.workflow-search-document-node__hint {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-5);
}

.workflow-search-document-node__knowledge-badge {
  width: 22px;
  height: 22px;
  font-size: 11px;
  font-weight: 800;
  border-radius: 6px;
}

.workflow-search-document-node__hint {
  width: 16px;
  height: 16px;
  font-size: var(--el-font-size-extra-small);
  border-radius: 50%;
}

.workflow-search-document-node__knowledge-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-search-document-node__condition-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 88px minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
}

.workflow-search-document-node__required {
  color: var(--el-color-danger);
}

.workflow-search-document-node :deep(.el-form-item) {
  margin-bottom: 0;
}
</style>
