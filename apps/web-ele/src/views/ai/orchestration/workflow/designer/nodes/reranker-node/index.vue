<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue';

import { Operation } from '@element-plus/icons-vue';
import {
  ElButton,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElOption,
  ElSelect,
  ElSwitch,
} from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

import ModelParamSettingDialog from '../../../../applications/ModelParamSettingDialog.vue';
import { syncNodeProperties } from '../../common/node-inline-update';
import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';
import LocalModelSelect from '../base-node/component/LocalModelSelect.vue';

const props = defineProps<{ nodeModel: any; renderVersion?: number }>();
type WorkflowMode = 'application' | 'application-loop' | 'tool' | string;
const workflowMode = inject<WorkflowMode>('workflowMode', 'application');
const nodeRenderVersion = ref(0);
const modelParamOpen = ref(false);
const defaultRerankerSetting = {
  max_paragraph_char_number: 5000,
  similarity: 0,
  top_n: 3,
};

const formData = computed({
  get: () => {
    trackRenderVersion(props.renderVersion, nodeRenderVersion.value);
    return props.nodeModel.properties.node_data || {};
  },
  set: (value) => {
    syncNodeProperties(props.nodeModel, { node_data: value }, ['node_data']);
    nodeRenderVersion.value += 1;
  },
});

const references = computed(() => {
  if (Array.isArray(formData.value.reranker_reference_list))
    return formData.value.reranker_reference_list;
  if (Array.isArray(formData.value.documents)) return formData.value.documents;
  return [[]];
});
const setting = computed(() => ({
  max_paragraph_char_number:
    formData.value.reranker_setting?.max_paragraph_char_number ??
    defaultRerankerSetting.max_paragraph_char_number,
  similarity:
    formData.value.reranker_setting?.similarity ??
    defaultRerankerSetting.similarity,
  top_n: formData.value.reranker_setting?.top_n ?? defaultRerankerSetting.top_n,
}));
const showWorkflowOutputControls = computed(
  () => !`${workflowMode || 'application'}`.includes('knowledge'),
);
const resolvedRerankerModelId = computed(() => {
  const value = formData.value.reranker_model_id || formData.value.modelId;
  return typeof value === 'number' || typeof value === 'string' ? value : '';
});
const modelParamSetting = computed(() =>
  formData.value.model_params_setting &&
  typeof formData.value.model_params_setting === 'object'
    ? formData.value.model_params_setting
    : {},
);
const modelParamsSummary = computed(() => {
  const count = Object.keys(modelParamSetting.value).length;
  return count ? `${count} 项` : '默认参数';
});

function patchData(key: string, value: any) {
  formData.value = { ...formData.value, [key]: value };
}

function patchModelType(value: string) {
  formData.value = {
    ...formData.value,
    reranker_model_id_reference: [],
    reranker_model_id_type: value,
  };
}

function patchModelId(value: number | string | undefined) {
  const previousModelId = formData.value.reranker_model_id;
  const nextData = { ...formData.value, reranker_model_id: value || '' };
  if (!value || previousModelId !== value) nextData.model_params_setting = {};
  formData.value = nextData;
}

function trackRenderVersion(..._versions: unknown[]) {}

function patchReference(index: number, value: any[]) {
  patchData(
    'reranker_reference_list',
    references.value.map((item: any, itemIndex: number) =>
      itemIndex === index ? value : item,
    ),
  );
}

function addReference() {
  patchData('reranker_reference_list', [...references.value, []]);
}

function removeReference(index: number) {
  patchData(
    'reranker_reference_list',
    references.value.filter((_: any, itemIndex: number) => itemIndex !== index),
  );
}

function patchSetting(key: string, value: any) {
  formData.value = {
    ...formData.value,
    reranker_setting: { ...setting.value, [key]: value },
  };
}

function openModelParamDialog() {
  modelParamOpen.value = true;
}

function refreshModelParams(value: Record<string, unknown>) {
  patchData('model_params_setting', value);
}

function ensureDefaults() {
  const nodeData = props.nodeModel.properties.node_data || {};
  const rerankerSetting =
    nodeData.reranker_setting && typeof nodeData.reranker_setting === 'object'
      ? nodeData.reranker_setting
      : {};
  const nextData = {
    ...nodeData,
    model_params_setting:
      nodeData.model_params_setting &&
      typeof nodeData.model_params_setting === 'object'
        ? nodeData.model_params_setting
        : {},
    reranker_model_id_reference: Array.isArray(
      nodeData.reranker_model_id_reference,
    )
      ? nodeData.reranker_model_id_reference
      : [],
    reranker_model_id_type: nodeData.reranker_model_id_type || 'custom',
    reranker_setting: { ...defaultRerankerSetting, ...rerankerSetting },
  };
  set(props.nodeModel.properties, 'node_data', cloneDeep(nextData));
  syncNodeProperties(props.nodeModel, { node_data: nextData }, ['node_data']);
  nodeRenderVersion.value += 1;
}

onMounted(ensureDefaults);
</script>

<template>
  <NodeContainer
    :node-model="nodeModel"
    :render-version="nodeRenderVersion + (renderVersion || 0)"
  >
    <ElForm :model="formData" label-position="top" @submit.prevent>
      <ElFormItem label="重排模型">
        <div class="workflow-node-row is-model">
          <ElSelect
            :model-value="formData.reranker_model_id_type || 'custom'"
            :teleported="false"
            @update:model-value="patchModelType(`${$event}`)"
          >
            <ElOption label="自定义" value="custom" />
            <ElOption label="变量引用" value="reference" />
          </ElSelect>
          <LocalModelSelect
            v-if="(formData.reranker_model_id_type || 'custom') === 'custom'"
            :model-value="formData.reranker_model_id || formData.modelId"
            model-type="RERANKER"
            placeholder="请选择重排模型"
            show-footer
            @update:model-value="patchModelId"
          />
          <NodeCascader
            v-else
            :node-model="nodeModel"
            :model-value="formData.reranker_model_id_reference || []"
            placeholder="选择模型变量"
            @update:model-value="
              patchData('reranker_model_id_reference', $event)
            "
          />
          <ElButton
            :disabled="
              (formData.reranker_model_id_type || 'custom') !== 'custom' ||
              !resolvedRerankerModelId
            "
            size="small"
            @click="openModelParamDialog"
          >
            <ElIcon><Operation /></ElIcon>
          </ElButton>
        </div>
      </ElFormItem>
      <ElFormItem label="模型参数">
        <ElInput :model-value="modelParamsSummary" disabled />
      </ElFormItem>
      <ElFormItem label="检索问题">
        <NodeCascader
          :node-model="nodeModel"
          :model-value="formData.question_reference_address || []"
          class="w-full"
          placeholder="选择问题变量"
          @update:model-value="patchData('question_reference_address', $event)"
        />
      </ElFormItem>
      <div class="workflow-node-panel">
        <div class="workflow-node-panel__head">
          <span>重排内容</span>
          <ElButton link type="primary" @click="addReference">添加</ElButton>
        </div>
        <div
          v-for="(reference, index) in references"
          :key="index"
          class="workflow-node-row"
        >
          <NodeCascader
            :node-model="nodeModel"
            :model-value="reference || []"
            placeholder="选择召回结果变量"
            @update:model-value="patchReference(Number(index), $event)"
          />
          <ElButton
            link
            type="danger"
            :disabled="references.length <= 1"
            @click="removeReference(Number(index))"
          >
            删
          </ElButton>
        </div>
      </div>
      <div class="workflow-node-grid is-two">
        <ElFormItem label="Top N">
          <ElInputNumber
            :model-value="setting.top_n"
            :min="1"
            :max="50"
            controls-position="right"
            @update:model-value="patchSetting('top_n', $event)"
          />
        </ElFormItem>
        <ElFormItem label="Score 阈值">
          <ElInputNumber
            :model-value="setting.similarity"
            :min="0"
            :max="1"
            :step="0.05"
            controls-position="right"
            @update:model-value="patchSetting('similarity', $event)"
          />
        </ElFormItem>
      </div>
      <ElFormItem label="展示知识来源">
        <ElSwitch
          :model-value="!!formData.show_knowledge"
          size="small"
          @update:model-value="patchData('show_knowledge', $event)"
        />
      </ElFormItem>
      <ElFormItem v-if="showWorkflowOutputControls" label="作为结果返回">
        <ElSwitch
          :model-value="formData.is_result !== false"
          size="small"
          @update:model-value="patchData('is_result', $event)"
        />
      </ElFormItem>
    </ElForm>
    <ModelParamSettingDialog
      v-model="modelParamOpen"
      :model-id="resolvedRerankerModelId"
      :setting="modelParamSetting"
      @refresh="refreshModelParams"
    />
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-node-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  width: 100%;
  min-width: 0;
  margin-bottom: 8px;
}

.workflow-node-row.is-model {
  grid-template-columns: minmax(0, 86px) minmax(0, 1fr) auto;
}

.workflow-node-grid.is-two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  min-width: 0;
}

.workflow-node-grid > *,
.workflow-node-row > * {
  min-width: 0;
}

.workflow-node-panel {
  display: grid;
  gap: 6px;
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
</style>
