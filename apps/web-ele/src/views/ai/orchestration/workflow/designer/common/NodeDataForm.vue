<script setup lang="ts">
import { computed } from 'vue';

import {
  ElButton,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElOption,
  ElSelect,
  ElSwitch,
} from 'element-plus';

import NodeCascader from './NodeCascader.vue';
import NodeContainer from './NodeContainer.vue';

type FieldSource = 'custom' | 'reference';

type FieldConfig = {
  key: string;
  label: string;
  max?: number;
  min?: number;
  options?: Array<{ label: string; value: any }>;
  placeholder?: string;
  referenceKey?: string;
  referenceValue?: 'reference' | 'referencing';
  rows?: number;
  sourceKey?: string;
  step?: number;
  type:
    | 'boolean'
    | 'ids'
    | 'number'
    | 'select'
    | 'text'
    | 'textarea'
    | 'variable';
  visibleWhen?: (data: Record<string, any>) => boolean;
};

type NodeConfig = {
  fields: FieldConfig[];
  panels?: Array<'conditions' | 'inputMapping'>;
};

const props = defineProps<{
  nodeModel: any;
  variant: string;
}>();

const formData = computed({
  get: () => props.nodeModel.properties.node_data || {},
  set: (value) =>
    props.nodeModel.updateWorkflowProperties?.({ node_data: value }, [
      'node_data',
    ]),
});

const sourceOptions = [
  { label: '自定义', value: 'custom' },
  { label: '引用', value: 'reference' },
];

const textGenerationModels = [
  { label: '默认', value: '' },
  { label: '图像模型', value: 'IMAGE' },
  { label: '视频模型', value: 'VIDEO' },
  { label: '语音模型', value: 'AUDIO' },
];

const configs: Record<string, NodeConfig> = {
  'data-source-local-node': {
    fields: [
      {
        key: 'content',
        label: '本地内容',
        placeholder: '固定内容或 {{变量}}',
        rows: 4,
        type: 'textarea',
      },
      {
        key: 'source_name',
        label: '来源名称',
        placeholder: '可选，本地文件/来源标识',
        type: 'text',
      },
      { key: 'is_result', label: '作为结果返回', type: 'boolean' },
    ],
  },
  'data-source-web-node': {
    fields: [
      {
        key: 'source_url',
        label: '网页地址',
        placeholder: '请输入 Web 根地址',
        type: 'text',
      },
      {
        key: 'selector',
        label: '网页选择器',
        placeholder: '可选，默认 body，支持 .class/#id/tag',
        type: 'text',
      },
      {
        key: 'document_list',
        label: '文档引用',
        placeholder: '选择上游文档变量',
        type: 'variable',
      },
    ],
  },
  'document-extract-node': {
    fields: [
      {
        key: 'document_list',
        label: '文档引用',
        placeholder: '选择上游文档变量',
        type: 'variable',
      },
    ],
  },
  'document-split-node': {
    fields: [
      {
        key: 'document_list',
        label: '文档引用',
        placeholder: '选择上游文档变量',
        type: 'variable',
      },
      {
        key: 'split_strategy',
        label: '分段策略',
        options: [
          { label: '智能', value: 'auto' },
          { label: '自定义', value: 'custom' },
          { label: '问答', value: 'qa' },
        ],
        type: 'select',
      },
      {
        key: 'paragraph_title_relate_problem',
        label: '分段标题关联问题',
        referenceKey: 'paragraph_title_relate_problem_reference',
        referenceValue: 'referencing',
        sourceKey: 'paragraph_title_relate_problem_type',
        type: 'boolean',
      },
      {
        key: 'document_name_relate_problem',
        label: '文档名称关联问题',
        referenceKey: 'document_name_relate_problem_reference',
        referenceValue: 'referencing',
        sourceKey: 'document_name_relate_problem_type',
        type: 'boolean',
      },
      {
        key: 'limit',
        label: '最大字符',
        max: 100_000,
        min: 1,
        referenceKey: 'limit_reference',
        referenceValue: 'referencing',
        sourceKey: 'limit_type',
        type: 'number',
      },
      {
        key: 'chunk_size',
        label: '分段长度',
        max: 100_000,
        min: 1,
        referenceKey: 'chunk_size_reference',
        referenceValue: 'referencing',
        sourceKey: 'chunk_size_type',
        type: 'number',
      },
      {
        key: 'patterns',
        label: '分隔符',
        placeholder: '多个用逗号分隔',
        referenceKey: 'patterns_reference',
        referenceValue: 'referencing',
        sourceKey: 'patterns_type',
        type: 'ids',
      },
      {
        key: 'with_filter',
        label: '清洗过滤',
        referenceKey: 'with_filter_reference',
        referenceValue: 'referencing',
        sourceKey: 'with_filter_type',
        type: 'boolean',
      },
      {
        key: 'chunkSize',
        label: '旧版分段长度',
        max: 100_000,
        min: 50,
        step: 50,
        type: 'number',
        visibleWhen: (data) =>
          Object.prototype.hasOwnProperty.call(data, 'chunkSize'),
      },
      {
        key: 'overlap',
        label: '旧版重叠长度',
        max: 20_000,
        min: 0,
        step: 10,
        type: 'number',
        visibleWhen: (data) =>
          Object.prototype.hasOwnProperty.call(data, 'overlap'),
      },
    ],
  },
  'image-generate-node': {
    fields: [
      {
        key: 'modelId',
        label: '模型 ID',
        placeholder: '图像生成模型',
        type: 'text',
      },
      {
        key: 'model_id_reference',
        label: '模型变量',
        sourceKey: 'model_id_type',
        type: 'variable',
      },
      { key: 'prompt', label: '提示词', rows: 4, type: 'textarea' },
      {
        key: 'size',
        label: '尺寸',
        options: [
          { label: '默认', value: '' },
          { label: '1024x1024', value: '1024x1024' },
          { label: '1024x1792', value: '1024x1792' },
          { label: '1792x1024', value: '1792x1024' },
        ],
        type: 'select',
      },
      { key: 'is_result', label: '作为结果返回', type: 'boolean' },
    ],
  },
  'image-to-video-node': {
    fields: [
      { key: 'modelId', label: '模型 ID', type: 'text' },
      { key: 'image_list', label: '图片引用', type: 'variable' },
      { key: 'prompt', label: '视频提示词', rows: 3, type: 'textarea' },
      { key: 'duration', label: '时长秒数', max: 30, min: 1, type: 'number' },
      { key: 'is_result', label: '作为结果返回', type: 'boolean' },
    ],
  },
  'image-understand-node': {
    fields: [
      {
        key: 'modelId',
        label: '模型 ID',
        placeholder: '图像理解模型',
        type: 'text',
      },
      {
        key: 'model_id_reference',
        label: '模型变量',
        sourceKey: 'model_id_type',
        type: 'variable',
      },
      { key: 'image_list', label: '图片引用', type: 'variable' },
      { key: 'system', label: '系统提示词', rows: 2, type: 'textarea' },
      { key: 'prompt', label: '用户提示词', rows: 4, type: 'textarea' },
      { key: 'is_result', label: '作为结果返回', type: 'boolean' },
    ],
  },
  'knowledge-write-node': {
    fields: [
      {
        key: 'document_list',
        label: '文档引用',
        placeholder: '选择上游分段列表',
        type: 'variable',
      },
      {
        key: 'knowledgeId',
        label: '知识库 ID',
        placeholder: '目标知识库标识',
        type: 'text',
      },
      {
        key: 'knowledge_id_reference',
        label: '知识库变量',
        sourceKey: 'knowledge_id_type',
        type: 'variable',
      },
      {
        key: 'documentId',
        label: '文档 ID',
        placeholder: '可选，追加到指定文档',
        type: 'text',
      },
      { key: 'content', label: '写入内容', rows: 4, type: 'textarea' },
      {
        key: 'document_name',
        label: '文档名称',
        placeholder: '可选',
        type: 'text',
      },
    ],
  },
  'loop-break-node': {
    fields: [
      { key: 'condition_reference', label: '条件变量', type: 'variable' },
      {
        key: 'condition',
        label: '条件表达式',
        placeholder: '为空表示直接跳出',
        rows: 2,
        type: 'textarea',
      },
      { key: 'reason', label: '原因', rows: 2, type: 'textarea' },
    ],
  },
  'loop-continue-node': {
    fields: [
      { key: 'condition_reference', label: '条件变量', type: 'variable' },
      {
        key: 'condition',
        label: '条件表达式',
        placeholder: '为空表示直接继续下一轮',
        rows: 2,
        type: 'textarea',
      },
      { key: 'reason', label: '原因', rows: 2, type: 'textarea' },
    ],
  },
  'search-document-node': {
    fields: [
      {
        key: 'knowledge_id_list',
        label: '知识库 ID 列表',
        placeholder: '多个 ID 用逗号分隔',
        type: 'ids',
      },
      {
        key: 'documentIds',
        label: '文档 ID 列表',
        placeholder: '多个 ID 用逗号分隔',
        type: 'ids',
      },
      {
        key: 'tagIds',
        label: '标签 ID 列表',
        placeholder: '多个标签 ID 用逗号分隔',
        type: 'ids',
      },
      {
        key: 'search_scope_source',
        label: '引用范围类型',
        options: [
          { label: '知识库', value: 'knowledge' },
          { label: '文档', value: 'document' },
        ],
        type: 'select',
      },
      {
        key: 'search_scope_reference',
        label: '检索范围变量',
        sourceKey: 'search_scope_type',
        type: 'variable',
      },
      { key: 'question_reference', label: '检索问题变量', type: 'variable' },
      {
        key: 'query',
        label: '备用问题',
        placeholder: '{{input}}',
        type: 'text',
      },
      {
        key: 'search_mode',
        label: '检索模式',
        options: [
          { label: '自动', value: 'auto' },
          { label: '自定义条件', value: 'custom' },
        ],
        type: 'select',
      },
      { key: 'topK', label: 'Top K', max: 50, min: 1, type: 'number' },
    ],
    panels: ['conditions'],
  },
  'speech-to-text-node': {
    fields: [
      { key: 'modelId', label: '模型 ID', type: 'text' },
      { key: 'audio_list', label: '音频引用', type: 'variable' },
      { key: 'audio', label: '备用音频地址', type: 'text' },
      {
        key: 'language',
        label: '语言',
        placeholder: 'zh / en / auto',
        type: 'text',
      },
      { key: 'is_result', label: '作为结果返回', type: 'boolean' },
    ],
  },
  'text-to-speech-node': {
    fields: [
      { key: 'modelId', label: '模型 ID', type: 'text' },
      { key: 'text_reference', label: '文本变量', type: 'variable' },
      { key: 'text', label: '文本内容', rows: 3, type: 'textarea' },
      { key: 'voice', label: '音色', type: 'text' },
      { key: 'is_result', label: '作为结果返回', type: 'boolean' },
    ],
  },
  'text-to-video-node': {
    fields: [
      { key: 'modelId', label: '模型 ID', type: 'text' },
      { key: 'prompt_reference', label: '提示词变量', type: 'variable' },
      { key: 'prompt', label: '提示词', rows: 4, type: 'textarea' },
      { key: 'duration', label: '时长秒数', max: 30, min: 1, type: 'number' },
      { key: 'is_result', label: '作为结果返回', type: 'boolean' },
    ],
  },
  'tool-lib-node': {
    fields: [
      { key: 'toolLibId', label: '工具库 ID', type: 'text' },
      { key: 'toolId', label: '工具 ID', type: 'text' },
      { key: 'input', label: '默认输入', type: 'text' },
      { key: 'is_result', label: '作为结果返回', type: 'boolean' },
    ],
    panels: ['inputMapping'],
  },
  'tool-workflow-lib-node': {
    fields: [
      { key: 'workflowId', label: '工作流 ID', type: 'text' },
      { key: 'toolId', label: '工具 ID', type: 'text' },
      { key: 'input', label: '默认输入', type: 'text' },
      { key: 'is_result', label: '作为结果返回', type: 'boolean' },
    ],
    panels: ['inputMapping'],
  },
  'video-understand-node': {
    fields: [
      { key: 'modelId', label: '模型 ID', type: 'text' },
      { key: 'video_list', label: '视频引用', type: 'variable' },
      { key: 'video', label: '备用视频地址', type: 'text' },
      { key: 'prompt', label: '理解提示词', rows: 4, type: 'textarea' },
      { key: 'is_result', label: '作为结果返回', type: 'boolean' },
    ],
  },
};

const config = computed(() => {
  const nodeConfig = configs[props.variant] || { fields: [] };
  return {
    ...nodeConfig,
    fields: nodeConfig.fields.filter(
      (field) => !field.visibleWhen || field.visibleWhen(formData.value),
    ),
  };
});

const inputFields = computed(() =>
  Array.isArray(formData.value.input_field_list)
    ? formData.value.input_field_list
    : [],
);
const conditions = computed(() =>
  Array.isArray(formData.value.search_condition_list)
    ? formData.value.search_condition_list
    : [],
);

function patchData(key: string, value: any) {
  formData.value = { ...formData.value, [key]: value };
}

function valueSource(field: FieldConfig): FieldSource {
  if (!field.sourceKey) return 'custom';
  return formData.value[field.sourceKey] === 'reference' ||
    formData.value[field.sourceKey] === 'referencing'
    ? 'reference'
    : 'custom';
}

function setValueSource(field: FieldConfig, source: FieldSource) {
  if (!field.sourceKey) return;
  patchData(
    field.sourceKey,
    source === 'reference' ? field.referenceValue || 'reference' : 'custom',
  );
}

function referenceFieldKey(field: FieldConfig) {
  return field.referenceKey || field.key;
}

function idsValue(key: string) {
  const value = formData.value[key];
  return Array.isArray(value) ? value.join(',') : value || '';
}

function patchIds(key: string, value: string) {
  patchData(
    key,
    value
      ? `${value}`
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
  );
}

function syncInputFields(nextFields: any[]) {
  patchData('input_field_list', nextFields);
}

function addInputField() {
  syncInputFields([
    ...inputFields.value,
    {
      is_required: false,
      name: `param_${inputFields.value.length + 1}`,
      source: 'reference',
      type: 'string',
      value: [],
    },
  ]);
}

function patchInputField(index: number, patch: Record<string, any>) {
  syncInputFields(
    inputFields.value.map((field: any, fieldIndex: number) =>
      fieldIndex === index ? { ...field, ...patch } : field,
    ),
  );
}

function removeInputField(index: number) {
  syncInputFields(
    inputFields.value.filter(
      (_: any, fieldIndex: number) => fieldIndex !== index,
    ),
  );
}

function syncConditions(nextConditions: any[]) {
  patchData('search_condition_list', nextConditions);
}

function addCondition() {
  syncConditions([
    ...conditions.value,
    { compare: 'contain', key: '', value: '' },
  ]);
}

function patchCondition(index: number, patch: Record<string, any>) {
  syncConditions(
    conditions.value.map((condition: any, conditionIndex: number) =>
      conditionIndex === index ? { ...condition, ...patch } : condition,
    ),
  );
}

function removeCondition(index: number) {
  syncConditions(
    conditions.value.filter(
      (_: any, conditionIndex: number) => conditionIndex !== index,
    ),
  );
}
</script>

<template>
  <NodeContainer :node-model="nodeModel">
    <ElForm :model="formData" label-position="top" @submit.prevent>
      <template v-for="field in config.fields" :key="field.key">
        <ElFormItem :label="field.label">
          <template v-if="field.sourceKey" #label>
            <div class="workflow-node-flex">
              <span>{{ field.label }}</span>
              <ElSelect
                :model-value="valueSource(field)"
                size="small"
                :teleported="false"
                @update:model-value="setValueSource(field, $event)"
              >
                <ElOption
                  v-for="item in sourceOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </ElSelect>
            </div>
          </template>
          <NodeCascader
            v-if="
              field.type === 'variable' && valueSource(field) === 'reference'
            "
            :node-model="nodeModel"
            :model-value="formData[referenceFieldKey(field)] || []"
            class="w-full"
            :placeholder="field.placeholder || '选择上游变量'"
            @update:model-value="patchData(referenceFieldKey(field), $event)"
          />
          <template
            v-else-if="field.sourceKey && valueSource(field) === 'reference'"
          >
            <NodeCascader
              :node-model="nodeModel"
              :model-value="formData[referenceFieldKey(field)] || []"
              class="w-full"
              :placeholder="field.placeholder || '选择上游变量'"
              @update:model-value="patchData(referenceFieldKey(field), $event)"
            />
          </template>
          <NodeCascader
            v-else-if="field.type === 'variable' && !field.sourceKey"
            :node-model="nodeModel"
            :model-value="formData[field.key] || []"
            class="w-full"
            :placeholder="field.placeholder || '选择上游变量'"
            @update:model-value="patchData(field.key, $event)"
          />
          <ElInput
            v-else-if="field.type === 'textarea'"
            :model-value="formData[field.key]"
            type="textarea"
            :rows="field.rows || 3"
            :placeholder="field.placeholder"
            @update:model-value="patchData(field.key, $event)"
          />
          <ElInput
            v-else-if="field.type === 'text' || field.type === 'variable'"
            :model-value="formData[field.key]"
            :placeholder="field.placeholder"
            @update:model-value="patchData(field.key, $event)"
          />
          <ElInput
            v-else-if="field.type === 'ids'"
            :model-value="idsValue(field.key)"
            :placeholder="field.placeholder"
            @update:model-value="patchIds(field.key, $event)"
          />
          <ElInputNumber
            v-else-if="field.type === 'number'"
            :model-value="formData[field.key]"
            :min="field.min"
            :max="field.max"
            :step="field.step || 1"
            controls-position="right"
            class="w-full"
            @update:model-value="patchData(field.key, $event)"
          />
          <ElSelect
            v-else-if="field.type === 'select'"
            :model-value="formData[field.key]"
            :teleported="false"
            @update:model-value="patchData(field.key, $event)"
          >
            <ElOption
              v-for="item in field.options || textGenerationModels"
              :key="`${item.value}`"
              :label="item.label"
              :value="item.value"
            />
          </ElSelect>
          <ElSwitch
            v-else-if="field.type === 'boolean'"
            :model-value="!!formData[field.key]"
            size="small"
            @update:model-value="patchData(field.key, $event)"
          />
        </ElFormItem>
      </template>

      <div
        v-if="config.panels?.includes('inputMapping')"
        class="workflow-node-panel"
      >
        <div class="workflow-node-panel__head">
          <span>输入映射</span>
          <ElButton link type="primary" @click="addInputField">添加</ElButton>
        </div>
        <div v-if="inputFields.length > 0" class="workflow-node-list">
          <div
            v-for="(field, index) in inputFields"
            :key="index"
            class="workflow-node-field"
          >
            <div class="workflow-node-field__meta">
              <ElInput
                :model-value="field.name"
                placeholder="参数名"
                @update:model-value="
                  patchInputField(Number(index), { name: $event })
                "
              />
              <ElSelect
                :model-value="field.source || 'reference'"
                :teleported="false"
                @update:model-value="
                  patchInputField(Number(index), {
                    source: $event,
                    value: $event === 'reference' ? [] : '',
                  })
                "
              >
                <ElOption label="引用" value="reference" />
                <ElOption label="固定" value="custom" />
              </ElSelect>
              <ElButton
                link
                type="danger"
                @click="removeInputField(Number(index))"
              >
                删
              </ElButton>
            </div>
            <NodeCascader
              v-if="(field.source || 'reference') === 'reference'"
              :node-model="nodeModel"
              :model-value="field.value || []"
              placeholder="选择变量"
              @update:model-value="
                patchInputField(Number(index), { value: $event })
              "
            />
            <ElInput
              v-else
              :model-value="field.value"
              placeholder="固定值"
              @update:model-value="
                patchInputField(Number(index), { value: $event })
              "
            />
          </div>
        </div>
        <ElEmpty v-else description="暂无映射" :image-size="42" />
      </div>

      <div
        v-if="config.panels?.includes('conditions')"
        class="workflow-node-panel"
      >
        <div class="workflow-node-panel__head">
          <span>过滤条件</span>
          <ElButton link type="primary" @click="addCondition">添加</ElButton>
        </div>
        <div v-if="conditions.length > 0" class="workflow-node-list">
          <div
            v-for="(condition, index) in conditions"
            :key="index"
            class="workflow-node-condition"
          >
            <ElInput
              :model-value="condition.key"
              placeholder="字段"
              @update:model-value="
                patchCondition(Number(index), { key: $event })
              "
            />
            <ElSelect
              :model-value="condition.compare || 'contain'"
              :teleported="false"
              @update:model-value="
                patchCondition(Number(index), { compare: $event })
              "
            >
              <ElOption label="包含" value="contain" />
              <ElOption label="不包含" value="not_contain" />
              <ElOption label="等于" value="eq" />
            </ElSelect>
            <ElInput
              :model-value="condition.value"
              placeholder="值"
              @update:model-value="
                patchCondition(Number(index), { value: $event })
              "
            />
            <ElButton
              link
              type="danger"
              @click="removeCondition(Number(index))"
            >
              删
            </ElButton>
          </div>
        </div>
        <ElEmpty v-else description="暂无条件" :image-size="42" />
      </div>
    </ElForm>
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-node-flex {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.workflow-node-flex :deep(.el-select) {
  width: 86px;
}

.workflow-node-panel {
  display: grid;
  gap: 8px;
  padding: 8px;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-node-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.workflow-node-list,
.workflow-node-field {
  display: grid;
  gap: 8px;
}

.workflow-node-field {
  padding: 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-node-field__meta,
.workflow-node-condition {
  display: grid;
  grid-template-columns: 1fr 88px auto;
  gap: 6px;
  align-items: center;
}

.workflow-node-condition {
  grid-template-columns: 1fr 86px 1fr auto;
}
</style>
