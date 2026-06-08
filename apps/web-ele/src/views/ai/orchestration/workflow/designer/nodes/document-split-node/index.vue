<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import { onBeforeUnmount, onMounted, ref } from 'vue';

import {
  ElForm,
  ElFormItem,
  ElInputNumber,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTooltip,
} from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

import { syncNodeProperties } from '../../common/node-inline-update';
import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';

type SourceType = 'custom' | 'referencing';

type DocumentSplitNodeData = Record<string, unknown> & {
  chunk_size: number;
  chunk_size_reference: unknown[];
  chunk_size_type: SourceType;
  document_list: unknown[];
  document_name_relate_problem: boolean;
  document_name_relate_problem_reference: unknown[];
  document_name_relate_problem_type: SourceType;
  limit: number;
  limit_reference: unknown[];
  limit_type: SourceType;
  paragraph_title_relate_problem: boolean;
  paragraph_title_relate_problem_reference: unknown[];
  paragraph_title_relate_problem_type: SourceType;
  patterns: string[];
  patterns_reference: unknown[];
  patterns_type: SourceType;
  split_strategy: 'auto' | 'custom' | 'qa';
  with_filter: boolean;
  with_filter_reference: unknown[];
  with_filter_type: SourceType;
};

const props = defineProps<{ nodeModel: any; renderVersion?: number }>();
const nodeModel = props.nodeModel;

const defaultNodeData: DocumentSplitNodeData = {
  chunk_size: 256,
  chunk_size_reference: [],
  chunk_size_type: 'custom',
  document_list: ['start-node', 'document'],
  document_name_relate_problem: true,
  document_name_relate_problem_reference: [],
  document_name_relate_problem_type: 'custom',
  limit: 4096,
  limit_reference: [],
  limit_type: 'custom',
  paragraph_title_relate_problem: true,
  paragraph_title_relate_problem_reference: [],
  paragraph_title_relate_problem_type: 'custom',
  patterns: [],
  patterns_reference: [],
  patterns_type: 'custom',
  split_strategy: 'auto',
  with_filter: false,
  with_filter_reference: [],
  with_filter_type: 'custom',
};

const formRef = ref<FormInstance>();
const documentCascaderRef = ref<InstanceType<typeof NodeCascader>>();
const chunkSizeCascaderRef = ref<InstanceType<typeof NodeCascader>>();
const patternsCascaderRef = ref<InstanceType<typeof NodeCascader>>();
const limitCascaderRef = ref<InstanceType<typeof NodeCascader>>();
const withFilterCascaderRef = ref<InstanceType<typeof NodeCascader>>();
const paragraphTitleCascaderRef = ref<InstanceType<typeof NodeCascader>>();
const documentNameCascaderRef = ref<InstanceType<typeof NodeCascader>>();
const formData = ref<DocumentSplitNodeData>(
  normalizeNodeData(nodeModel.properties?.node_data),
);
const nodeRenderVersion = ref(0);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sourceType(value: unknown): SourceType {
  return value === 'referencing' ? 'referencing' : 'custom';
}

function splitStrategy(
  value: unknown,
): DocumentSplitNodeData['split_strategy'] {
  return value === 'custom' || value === 'qa' ? value : 'auto';
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? cloneDeep(value) : [];
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => `${item}`).filter((item) => item.trim());
}

function normalizeNodeData(value: unknown): DocumentSplitNodeData {
  const source = isRecord(value) ? cloneDeep(value) : {};
  return {
    ...source,
    chunk_size: numberValue(source.chunk_size, defaultNodeData.chunk_size),
    chunk_size_reference: arrayValue(source.chunk_size_reference),
    chunk_size_type: sourceType(source.chunk_size_type),
    document_list: Array.isArray(source.document_list)
      ? cloneDeep(source.document_list)
      : cloneDeep(defaultNodeData.document_list),
    document_name_relate_problem: booleanValue(
      source.document_name_relate_problem,
      defaultNodeData.document_name_relate_problem,
    ),
    document_name_relate_problem_reference: arrayValue(
      source.document_name_relate_problem_reference,
    ),
    document_name_relate_problem_type: sourceType(
      source.document_name_relate_problem_type,
    ),
    limit: numberValue(source.limit, defaultNodeData.limit),
    limit_reference: arrayValue(source.limit_reference),
    limit_type: sourceType(source.limit_type),
    paragraph_title_relate_problem: booleanValue(
      source.paragraph_title_relate_problem,
      defaultNodeData.paragraph_title_relate_problem,
    ),
    paragraph_title_relate_problem_reference: arrayValue(
      source.paragraph_title_relate_problem_reference,
    ),
    paragraph_title_relate_problem_type: sourceType(
      source.paragraph_title_relate_problem_type,
    ),
    patterns: stringList(source.patterns),
    patterns_reference: arrayValue(source.patterns_reference),
    patterns_type: sourceType(source.patterns_type),
    split_strategy: splitStrategy(source.split_strategy),
    with_filter: booleanValue(source.with_filter, defaultNodeData.with_filter),
    with_filter_reference: arrayValue(source.with_filter_reference),
    with_filter_type: sourceType(source.with_filter_type),
  };
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

function patchData(key: keyof DocumentSplitNodeData, value: unknown) {
  set(formData.value, key, cloneDeep(value));
  syncNodeData();
}

function patchSourceType(key: keyof DocumentSplitNodeData, value: unknown) {
  patchData(key, sourceType(value));
}

function visibleReferenceChecks() {
  const checks: Array<{ label: string; refValue: unknown; visible: boolean }> =
    [
      {
        label: '分段长度变量',
        refValue: formData.value.chunk_size_reference,
        visible: formData.value.chunk_size_type === 'referencing',
      },
      {
        label: '分隔符变量',
        refValue: formData.value.patterns_reference,
        visible:
          formData.value.split_strategy === 'custom' &&
          formData.value.patterns_type === 'referencing',
      },
      {
        label: '最大字符变量',
        refValue: formData.value.limit_reference,
        visible:
          formData.value.split_strategy === 'custom' &&
          formData.value.limit_type === 'referencing',
      },
      {
        label: '清洗过滤变量',
        refValue: formData.value.with_filter_reference,
        visible:
          formData.value.split_strategy === 'custom' &&
          formData.value.with_filter_type === 'referencing',
      },
      {
        label: '分段标题关联变量',
        refValue: formData.value.paragraph_title_relate_problem_reference,
        visible:
          formData.value.split_strategy !== 'qa' &&
          formData.value.paragraph_title_relate_problem_type === 'referencing',
      },
      {
        label: '文档名称关联变量',
        refValue: formData.value.document_name_relate_problem_reference,
        visible:
          formData.value.document_name_relate_problem_type === 'referencing',
      },
    ];
  return checks.filter((item) => item.visible);
}

async function validate() {
  try {
    if (!hasReferenceValue(formData.value.document_list)) {
      throw validationError('请选择文档变量');
    }
    visibleReferenceChecks().forEach((item) => {
      if (!hasReferenceValue(item.refValue)) {
        throw validationError(`请选择${item.label}`);
      }
    });
    await formRef.value?.validate();
    await documentCascaderRef.value?.validate();
    await chunkSizeCascaderRef.value?.validate();
    await patternsCascaderRef.value?.validate();
    await limitCascaderRef.value?.validate();
    await withFilterCascaderRef.value?.validate();
    await paragraphTitleCascaderRef.value?.validate();
    await documentNameCascaderRef.value?.validate();
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
      <div class="workflow-node-panel">
        <div class="workflow-node-panel__head">节点设置</div>
        <ElFormItem
          label="选择文档"
          prop="document_list"
          :rules="{
            required: true,
            message: '请选择文档变量',
            trigger: 'change',
            type: 'array',
          }"
        >
          <NodeCascader
            ref="documentCascaderRef"
            :node-model="nodeModel"
            :model-value="formData.document_list"
            class="w-full"
            placeholder="请选择文档变量"
            @update:model-value="patchData('document_list', $event)"
          />
        </ElFormItem>
        <ElFormItem label="分段策略" prop="split_strategy">
          <ElSelect
            :model-value="formData.split_strategy"
            :teleported="false"
            @update:model-value="
              patchData('split_strategy', splitStrategy($event))
            "
          >
            <ElOption label="智能" value="auto" />
            <ElOption label="自定义" value="custom" />
            <ElOption label="问答" value="qa" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem>
          <template #label>
            <div class="workflow-node-panel__line-label">
              <span>分段长度</span>
              <ElSelect
                :model-value="formData.chunk_size_type"
                :teleported="false"
                size="small"
                class="workflow-node-panel__source-select"
                @update:model-value="patchSourceType('chunk_size_type', $event)"
              >
                <ElOption label="引用" value="referencing" />
                <ElOption label="自定义" value="custom" />
              </ElSelect>
            </div>
          </template>
          <ElInputNumber
            v-if="formData.chunk_size_type === 'custom'"
            :model-value="formData.chunk_size"
            :min="50"
            :max="100000"
            :step="1"
            :step-strictly="true"
            controls-position="right"
            class="w-full"
            @update:model-value="patchData('chunk_size', $event || 0)"
          />
          <NodeCascader
            v-else
            ref="chunkSizeCascaderRef"
            :node-model="nodeModel"
            :model-value="formData.chunk_size_reference"
            class="w-full"
            placeholder="请选择分段长度变量"
            @update:model-value="patchData('chunk_size_reference', $event)"
          />
        </ElFormItem>
        <ElFormItem v-if="formData.split_strategy === 'custom'">
          <template #label>
            <div class="workflow-node-panel__line-label">
              <span>
                分隔符
                <ElTooltip
                  content="多个分隔符会按顺序尝试切分；API 下拉待目标接口确认后补齐。"
                  placement="top"
                >
                  <span class="workflow-node-panel__hint">?</span>
                </ElTooltip>
              </span>
              <ElSelect
                :model-value="formData.patterns_type"
                :teleported="false"
                size="small"
                class="workflow-node-panel__source-select"
                @update:model-value="patchSourceType('patterns_type', $event)"
              >
                <ElOption label="引用" value="referencing" />
                <ElOption label="自定义" value="custom" />
              </ElSelect>
            </div>
          </template>
          <ElSelect
            v-if="formData.patterns_type === 'custom'"
            :model-value="formData.patterns"
            :teleported="false"
            allow-create
            default-first-option
            filterable
            multiple
            placeholder="输入分隔符后回车"
            @update:model-value="patchData('patterns', $event)"
          />
          <NodeCascader
            v-else
            ref="patternsCascaderRef"
            :node-model="nodeModel"
            :model-value="formData.patterns_reference"
            class="w-full"
            placeholder="请选择分隔符变量"
            @update:model-value="patchData('patterns_reference', $event)"
          />
        </ElFormItem>
        <ElFormItem v-if="formData.split_strategy === 'custom'">
          <template #label>
            <div class="workflow-node-panel__line-label">
              <span>最大字符</span>
              <ElSelect
                :model-value="formData.limit_type"
                :teleported="false"
                size="small"
                class="workflow-node-panel__source-select"
                @update:model-value="patchSourceType('limit_type', $event)"
              >
                <ElOption label="引用" value="referencing" />
                <ElOption label="自定义" value="custom" />
              </ElSelect>
            </div>
          </template>
          <ElInputNumber
            v-if="formData.limit_type === 'custom'"
            :model-value="formData.limit"
            :min="50"
            :max="100000"
            :step="1"
            :step-strictly="true"
            controls-position="right"
            class="w-full"
            @update:model-value="patchData('limit', $event || 0)"
          />
          <NodeCascader
            v-else
            ref="limitCascaderRef"
            :node-model="nodeModel"
            :model-value="formData.limit_reference"
            class="w-full"
            placeholder="请选择最大字符变量"
            @update:model-value="patchData('limit_reference', $event)"
          />
        </ElFormItem>
        <ElFormItem v-if="formData.split_strategy === 'custom'">
          <template #label>
            <div class="workflow-node-panel__line-label">
              <span>清洗过滤</span>
              <ElSelect
                :model-value="formData.with_filter_type"
                :teleported="false"
                size="small"
                class="workflow-node-panel__source-select"
                @update:model-value="
                  patchSourceType('with_filter_type', $event)
                "
              >
                <ElOption label="引用" value="referencing" />
                <ElOption label="自定义" value="custom" />
              </ElSelect>
            </div>
          </template>
          <ElSwitch
            v-if="formData.with_filter_type === 'custom'"
            :model-value="formData.with_filter"
            size="small"
            @update:model-value="patchData('with_filter', $event)"
          />
          <NodeCascader
            v-else
            ref="withFilterCascaderRef"
            :node-model="nodeModel"
            :model-value="formData.with_filter_reference"
            class="w-full"
            placeholder="请选择清洗过滤变量"
            @update:model-value="patchData('with_filter_reference', $event)"
          />
        </ElFormItem>
        <ElFormItem v-if="formData.split_strategy !== 'qa'">
          <template #label>
            <div class="workflow-node-panel__line-label">
              <span>分段标题关联问题</span>
              <ElSelect
                :model-value="formData.paragraph_title_relate_problem_type"
                :teleported="false"
                size="small"
                class="workflow-node-panel__source-select"
                @update:model-value="
                  patchSourceType('paragraph_title_relate_problem_type', $event)
                "
              >
                <ElOption label="引用" value="referencing" />
                <ElOption label="自定义" value="custom" />
              </ElSelect>
            </div>
          </template>
          <ElSwitch
            v-if="formData.paragraph_title_relate_problem_type === 'custom'"
            :model-value="formData.paragraph_title_relate_problem"
            size="small"
            @update:model-value="
              patchData('paragraph_title_relate_problem', $event)
            "
          />
          <NodeCascader
            v-else
            ref="paragraphTitleCascaderRef"
            :node-model="nodeModel"
            :model-value="formData.paragraph_title_relate_problem_reference"
            class="w-full"
            placeholder="请选择关联变量"
            @update:model-value="
              patchData('paragraph_title_relate_problem_reference', $event)
            "
          />
        </ElFormItem>
        <ElFormItem>
          <template #label>
            <div class="workflow-node-panel__line-label">
              <span>文档名称关联问题</span>
              <ElSelect
                :model-value="formData.document_name_relate_problem_type"
                :teleported="false"
                size="small"
                class="workflow-node-panel__source-select"
                @update:model-value="
                  patchSourceType('document_name_relate_problem_type', $event)
                "
              >
                <ElOption label="引用" value="referencing" />
                <ElOption label="自定义" value="custom" />
              </ElSelect>
            </div>
          </template>
          <ElSwitch
            v-if="formData.document_name_relate_problem_type === 'custom'"
            :model-value="formData.document_name_relate_problem"
            size="small"
            @update:model-value="
              patchData('document_name_relate_problem', $event)
            "
          />
          <NodeCascader
            v-else
            ref="documentNameCascaderRef"
            :node-model="nodeModel"
            :model-value="formData.document_name_relate_problem_reference"
            class="w-full"
            placeholder="请选择关联变量"
            @update:model-value="
              patchData('document_name_relate_problem_reference', $event)
            "
          />
        </ElFormItem>
      </div>
    </ElForm>
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-node-panel {
  display: grid;
  gap: 8px;
  padding: 8px;
  overflow: visible;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-node-panel__head,
.workflow-node-panel__line-label {
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

.workflow-node-panel__source-select {
  width: 92px;
}

.workflow-node-panel__hint {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 4px;
  font-size: var(--el-font-size-extra-small);
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 50%;
}

.workflow-node-panel :deep(.el-form-item) {
  margin-bottom: 0;
}
</style>
