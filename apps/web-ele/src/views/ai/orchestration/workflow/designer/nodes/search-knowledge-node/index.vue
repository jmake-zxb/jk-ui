<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import { computed, onMounted, ref } from 'vue';

import { Close, Plus, Setting } from '@element-plus/icons-vue';
import {
  ElButton,
  ElForm,
  ElFormItem,
  ElOption,
  ElSelect,
  ElSwitch,
  ElText,
} from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';
import KnowledgeSelectDialog from './component/KnowledgeSelectDialog.vue';
import ParamSettingDialog from './component/ParamSettingDialog.vue';

type SearchMode = 'blend' | 'embedding' | 'keywords';

type KnowledgeSetting = {
  max_paragraph_char_number: number;
  search_mode: SearchMode;
  similarity: number;
  top_n: number;
};

type KnowledgeRecord = Record<string, unknown>;

type SearchKnowledgeNodeData = Record<string, unknown> & {
  knowledge_id_list: Array<number | string>;
  knowledge_list?: KnowledgeRecord[];
  knowledge_setting: KnowledgeSetting;
  question_reference_address: unknown[];
  search_scope_reference: unknown[];
  search_scope_source: 'document' | 'knowledge';
  search_scope_type: 'custom' | 'referencing';
  show_knowledge: boolean;
};

const props = defineProps<{ nodeModel: any; renderVersion?: number }>();

const defaultNodeData: SearchKnowledgeNodeData = {
  knowledge_id_list: [],
  knowledge_setting: {
    max_paragraph_char_number: 5000,
    search_mode: 'embedding',
    similarity: 0.6,
    top_n: 3,
  },
  question_reference_address: [],
  search_scope_reference: [],
  search_scope_source: 'knowledge',
  search_scope_type: 'custom',
  show_knowledge: false,
};

const formRef = ref<FormInstance>();
const questionCascaderRef = ref<InstanceType<typeof NodeCascader>>();
const scopeCascaderRef = ref<InstanceType<typeof NodeCascader>>();
const knowledgeDialogRef = ref<InstanceType<typeof KnowledgeSelectDialog>>();
const paramDialogRef = ref<InstanceType<typeof ParamSettingDialog>>();
const formData = ref<SearchKnowledgeNodeData>(
  normalizeNodeData(props.nodeModel.properties?.node_data),
);
const nodeRenderVersion = ref(0);

const searchModeLabel: Record<SearchMode, string> = {
  blend: '混合检索',
  embedding: '向量检索',
  keywords: '全文检索',
};

const selectedKnowledgeItems = computed(() => {
  const records = Array.isArray(formData.value.knowledge_list)
    ? formData.value.knowledge_list
    : [];
  return formData.value.knowledge_id_list.map((id) => {
    const record = records.find((item) => `${idOf(item)}` === `${id}`);
    return record || { id, name: `${id}` };
  });
});

const paramSummary = computed(() => {
  const setting = formData.value.knowledge_setting;
  return [
    {
      label: '检索模式',
      value: searchModeLabel[setting.search_mode] || setting.search_mode,
    },
    { label: '相似度', value: Number(setting.similarity || 0).toFixed(3) },
    { label: 'Top N', value: `${setting.top_n}` },
    { label: '最大字符', value: `${setting.max_paragraph_char_number}` },
  ];
});

const formRules = {
  question_reference_address: [
    { message: '请选择检索问题', required: true, trigger: 'change' },
  ],
  search_scope_reference: [
    { message: '请选择变量', required: true, trigger: 'change' },
  ],
  show_knowledge: [
    { message: '请选择是否展示知识来源', required: true, trigger: 'change' },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasField(data: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function hasReference(value: unknown) {
  return Array.isArray(value) && value.length >= 2;
}

function numericValue(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
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

function normalizeNodeData(source: unknown): SearchKnowledgeNodeData {
  const sourceData = isRecord(source) ? cloneDeep(source) : {};
  const settingSource = isRecord(sourceData.knowledge_setting)
    ? sourceData.knowledge_setting
    : {};
  const next: SearchKnowledgeNodeData = {
    ...sourceData,
    knowledge_id_list: Array.isArray(sourceData.knowledge_id_list)
      ? cloneDeep(sourceData.knowledge_id_list)
      : [],
    knowledge_setting: {
      max_paragraph_char_number: numericValue(
        settingSource.max_paragraph_char_number,
        defaultNodeData.knowledge_setting.max_paragraph_char_number,
      ),
      search_mode: ['blend', 'embedding', 'keywords'].includes(
        `${settingSource.search_mode}`,
      )
        ? (settingSource.search_mode as SearchMode)
        : defaultNodeData.knowledge_setting.search_mode,
      similarity: numericValue(
        settingSource.similarity,
        defaultNodeData.knowledge_setting.similarity,
      ),
      top_n: numericValue(
        settingSource.top_n,
        defaultNodeData.knowledge_setting.top_n,
      ),
    },
    question_reference_address: Array.isArray(
      sourceData.question_reference_address,
    )
      ? cloneDeep(sourceData.question_reference_address)
      : [],
    search_scope_reference: Array.isArray(sourceData.search_scope_reference)
      ? cloneDeep(sourceData.search_scope_reference)
      : [],
    search_scope_source:
      sourceData.search_scope_source === 'document' ? 'document' : 'knowledge',
    search_scope_type:
      sourceData.search_scope_type === 'referencing' ? 'referencing' : 'custom',
    show_knowledge:
      typeof sourceData.show_knowledge === 'boolean'
        ? sourceData.show_knowledge
        : false,
  };
  if (Array.isArray(sourceData.knowledge_list))
    next.knowledge_list = cloneDeep(sourceData.knowledge_list);
  return next;
}

function isSameNodeData(
  left: SearchKnowledgeNodeData,
  right: SearchKnowledgeNodeData,
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function emitInlineUpdate() {
  props.nodeModel.graphModel?.eventCenter?.emit?.('node:inline-update', {
    fields: ['node_data'],
    id: props.nodeModel.id,
    properties: props.nodeModel.properties,
    source: 'vue-node',
  });
}

function createValidationError(errMessage: unknown) {
  const error = new Error(`${errMessage}`) as Error & {
    errMessage: unknown;
    node: unknown;
  };
  error.node = props.nodeModel;
  error.errMessage = errMessage;
  return error;
}

function nodeProperties() {
  const nodeModel = props.nodeModel;
  if (!nodeModel.properties) nodeModel.properties = {};
  return nodeModel.properties;
}

function syncNodeData(nextData: SearchKnowledgeNodeData) {
  formData.value = cloneDeep(nextData);
  set(nodeProperties(), 'node_data', cloneDeep(nextData));
  nodeRenderVersion.value += 1;
  emitInlineUpdate();
}

function patchNodeData(key: string, value: unknown) {
  const nextData = cloneDeep(formData.value);
  set(nextData, key, cloneDeep(value));
  syncNodeData(nextData);
}

function patchSearchScopeType(value: 'custom' | 'referencing') {
  const nextData = cloneDeep(formData.value);
  set(nextData, 'search_scope_type', value);
  if (value === 'custom') set(nextData, 'search_scope_reference', []);
  syncNodeData(nextData);
}

function patchSearchScopeSource(value: 'document' | 'knowledge') {
  const nextData = cloneDeep(formData.value);
  set(nextData, 'search_scope_source', value);
  set(nextData, 'search_scope_reference', []);
  syncNodeData(nextData);
}

function openKnowledgeDialog() {
  knowledgeDialogRef.value?.open(selectedKnowledgeItems.value);
}

function applyKnowledgeSelection(records: KnowledgeRecord[]) {
  const nextData = cloneDeep(formData.value);
  const normalizedRecords = cloneDeep(records);
  set(
    nextData,
    'knowledge_id_list',
    normalizedRecords.map((item) => idOf(item)).filter((id) => `${id}`),
  );
  set(nextData, 'knowledge_list', normalizedRecords);
  syncNodeData(nextData);
}

function removeKnowledge(id: number | string) {
  const nextData = cloneDeep(formData.value);
  const nextIds = nextData.knowledge_id_list.filter(
    (item) => `${item}` !== `${id}`,
  );
  set(nextData, 'knowledge_id_list', nextIds);
  if (Array.isArray(nextData.knowledge_list)) {
    set(
      nextData,
      'knowledge_list',
      nextData.knowledge_list.filter((item) => `${idOf(item)}` !== `${id}`),
    );
  }
  if (Array.isArray(nextData.all_knowledge_id_list)) {
    set(
      nextData,
      'all_knowledge_id_list',
      nextData.all_knowledge_id_list.filter((item) => `${item}` !== `${id}`),
    );
  }
  syncNodeData(nextData);
}

function openParamDialog() {
  paramDialogRef.value?.open(formData.value.knowledge_setting);
}

function applyParamSetting(setting: KnowledgeSetting) {
  patchNodeData('knowledge_setting', setting);
}

function validate() {
  const checks: Array<Promise<unknown>> = [];
  if (formData.value.search_scope_type === 'referencing') {
    if (!hasReference(formData.value.search_scope_reference)) {
      return Promise.reject(createValidationError('请选择知识范围变量'));
    }
    if (scopeCascaderRef.value?.validate)
      checks.push(scopeCascaderRef.value.validate());
  }
  if (!hasReference(formData.value.question_reference_address)) {
    return Promise.reject(createValidationError('请选择检索问题'));
  }
  if (!hasField(formData.value, 'show_knowledge')) {
    return Promise.reject(createValidationError('请选择是否展示知识来源'));
  }
  if (questionCascaderRef.value?.validate)
    checks.push(questionCascaderRef.value.validate());
  if (formRef.value?.validate) checks.push(formRef.value.validate());
  return Promise.all(checks).catch((error) => {
    throw createValidationError(error);
  });
}

onMounted(() => {
  const normalizedData = normalizeNodeData(
    props.nodeModel.properties?.node_data,
  );
  if (!isSameNodeData(formData.value, normalizedData))
    formData.value = normalizedData;
  if (
    !isSameNodeData(normalizedData, props.nodeModel.properties?.node_data || {})
  )
    syncNodeData(normalizedData);
  set(props.nodeModel, 'validate', validate);
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
      :rules="formRules"
      class="workflow-search-knowledge-node"
      label-position="top"
      @submit.prevent
    >
      <section class="workflow-search-knowledge-node__panel">
        <div class="workflow-search-knowledge-node__head">节点设置</div>

        <ElFormItem label="选择知识库">
          <template #label>
            <div class="workflow-search-knowledge-node__label">
              <span>选择知识库</span>
              <span class="workflow-search-knowledge-node__tools">
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
                  class="workflow-search-knowledge-node__scope-select"
                  @update:model-value="patchSearchScopeType"
                >
                  <ElOption label="变量引用" value="referencing" />
                  <ElOption label="自定义" value="custom" />
                </ElSelect>
              </span>
            </div>
          </template>

          <div
            v-if="formData.search_scope_type === 'custom'"
            class="workflow-search-knowledge-node__knowledge-list"
          >
            <ElText v-if="selectedKnowledgeItems.length === 0" type="info">
              请选择关联知识库
            </ElText>
            <div
              v-for="item in selectedKnowledgeItems"
              :key="`${idOf(item)}`"
              class="workflow-search-knowledge-node__knowledge-item"
            >
              <span class="workflow-search-knowledge-node__knowledge-badge">
                知
              </span>
              <span
                class="workflow-search-knowledge-node__knowledge-name"
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

          <div v-else class="workflow-search-knowledge-node__reference">
            <div class="workflow-search-knowledge-node__label is-inner">
              <span>
                选择变量
                <span class="workflow-search-knowledge-node__required">*</span>
              </span>
              <ElSelect
                :model-value="formData.search_scope_source"
                :teleported="false"
                size="small"
                class="workflow-search-knowledge-node__source-select"
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
                  patchNodeData('search_scope_reference', $event)
                "
              />
            </ElFormItem>
          </div>
        </ElFormItem>

        <ElFormItem label="检索参数">
          <template #label>
            <div class="workflow-search-knowledge-node__label">
              <span>检索参数</span>
              <ElButton
                link
                type="primary"
                :icon="Setting"
                @click="openParamDialog"
              />
            </div>
          </template>
          <div class="workflow-search-knowledge-node__summary">
            <template v-for="item in paramSummary" :key="item.label">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </template>
          </div>
        </ElFormItem>

        <ElFormItem label="检索问题" prop="question_reference_address" required>
          <NodeCascader
            ref="questionCascaderRef"
            :node-model="nodeModel"
            :model-value="formData.question_reference_address"
            class="w-full"
            placeholder="请选择问题变量"
            @update:model-value="
              patchNodeData('question_reference_address', $event)
            "
          />
        </ElFormItem>

        <ElFormItem
          label="展示知识来源"
          prop="show_knowledge"
          required
          @click.prevent
        >
          <ElSwitch
            :model-value="formData.show_knowledge"
            size="small"
            @update:model-value="patchNodeData('show_knowledge', $event)"
          />
        </ElFormItem>
      </section>
    </ElForm>
    <KnowledgeSelectDialog
      ref="knowledgeDialogRef"
      @select="applyKnowledgeSelection"
    />
    <ParamSettingDialog ref="paramDialogRef" @refresh="applyParamSetting" />
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-search-knowledge-node,
.workflow-search-knowledge-node__panel,
.workflow-search-knowledge-node__knowledge-list,
.workflow-search-knowledge-node__reference {
  display: grid;
  gap: 8px;
}

.workflow-search-knowledge-node__panel {
  padding: 8px;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-search-knowledge-node__head,
.workflow-search-knowledge-node__label {
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

.workflow-search-knowledge-node__label.is-inner {
  margin-bottom: 4px;
}

.workflow-search-knowledge-node__tools {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.workflow-search-knowledge-node__scope-select {
  width: 92px;
}

.workflow-search-knowledge-node__source-select {
  width: 96px;
}

.workflow-search-knowledge-node__knowledge-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 5px 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-search-knowledge-node__knowledge-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 11px;
  font-weight: 800;
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 6px;
}

.workflow-search-knowledge-node__knowledge-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-search-knowledge-node__summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 6px 8px;
  width: 100%;
  font-size: 12px;
}

.workflow-search-knowledge-node__summary span {
  color: var(--el-text-color-secondary);
}

.workflow-search-knowledge-node__summary strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.workflow-search-knowledge-node__required {
  color: var(--el-color-danger);
}

.workflow-search-knowledge-node :deep(.el-form-item) {
  margin-bottom: 8px;
}

.workflow-search-knowledge-node :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}
</style>
