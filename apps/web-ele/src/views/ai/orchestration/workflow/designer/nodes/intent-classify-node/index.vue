<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import {
  ElButton,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElOption,
  ElSelect,
} from 'element-plus';
import { set } from 'lodash-es';

import { syncNodeProperties } from '../../common/node-inline-update';
import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';
import LocalModelSelect from '../base-node/component/LocalModelSelect.vue';

const props = defineProps<{ nodeModel: any; renderVersion?: number }>();
const nodeRenderVersion = ref(0);

const formData = computed({
  get: () => {
    trackRenderVersion(props.renderVersion, nodeRenderVersion.value);
    return props.nodeModel.properties.node_data || {};
  },
  set: (value) => syncNodeData(value),
});

const branches = computed(() => resolveBranches(formData.value));
const outputFields = computed(() =>
  Array.isArray(formData.value.output_field_list)
    ? formData.value.output_field_list
    : [],
);

function resolveBranches(data: Record<string, any>) {
  if (Array.isArray(data.branch)) return data.branch;
  if (Array.isArray(data.intents)) return data.intents;
  return [];
}

function textValue(value: unknown) {
  return `${value ?? ''}`.trim();
}

function hasReferenceValue(value: unknown) {
  return Array.isArray(value) ? value.length >= 2 : !!textValue(value);
}

function branchContent(branch: Record<string, any>) {
  return textValue(branch.content || branch.name);
}

function validationError(errMessage: string) {
  return Object.assign(new Error(errMessage), {
    errMessage,
    node: props.nodeModel,
  });
}

function validate() {
  const data = formData.value;
  if ((data.model_id_type || 'custom') === 'reference') {
    if (!hasReferenceValue(data.model_id_reference)) {
      return Promise.reject(validationError('请选择模型变量'));
    }
  } else if (!textValue(data.model_id || data.modelId)) {
    return Promise.reject(validationError('请选择模型'));
  }

  if (!hasReferenceValue(data.content_list || data.question_reference)) {
    return Promise.reject(validationError('请选择分类问题'));
  }

  const branchList = resolveBranches(data);
  if (branchList.length === 0) {
    return Promise.reject(validationError('请添加意图分类'));
  }

  const contentList = branchList.map((branch: Record<string, any>) =>
    branchContent(branch),
  );
  if (contentList.some((content: string) => !content)) {
    return Promise.reject(validationError('请输入分类名称或意图描述'));
  }
  if (new Set(contentList).size !== contentList.length) {
    return Promise.reject(validationError('意图分类不能重复'));
  }

  return Promise.resolve();
}

function patchData(key: string, value: any) {
  formData.value = { ...formData.value, [key]: value };
}

function syncNodeData(value: Record<string, any>, fields = ['node_data']) {
  syncNodeProperties(props.nodeModel, { node_data: value }, fields);
  nodeRenderVersion.value += 1;
}

function trackRenderVersion(..._versions: unknown[]) {}

function syncBranches(nextBranches: any[]) {
  syncNodeData({ ...formData.value, branch: nextBranches }, [
    'node_data.branch',
  ]);
  props.nodeModel.refreshAnchors?.();
}

function addIntent() {
  syncBranches([
    ...branches.value,
    { content: '', id: `intent_${Date.now()}`, isOther: false },
  ]);
}

function patchIntent(index: number, patch: Record<string, any>) {
  syncBranches(
    branches.value.map((branch: any, branchIndex: number) =>
      branchIndex === index ? { ...branch, ...patch } : branch,
    ),
  );
}

function removeIntent(index: number) {
  const [removed] = branches.value.slice(index, index + 1);
  if (removed?.id) {
    const anchorId = `${props.nodeModel.id}_${removed.id}_right`;
    props.nodeModel.outgoing?.edges
      ?.filter((edge: any) => edge.sourceAnchorId === anchorId)
      .forEach((edge: any) =>
        props.nodeModel.graphModel?.deleteEdgeById?.(edge.id),
      );
  }
  syncBranches(
    branches.value.filter(
      (_: any, branchIndex: number) => branchIndex !== index,
    ),
  );
}

function syncOutputFields(nextFields: any[]) {
  patchData('output_field_list', nextFields);
}

function addOutputField() {
  syncOutputFields([
    ...outputFields.value,
    {
      label: `结果 ${outputFields.value.length + 1}`,
      name: `result_${outputFields.value.length + 1}`,
      type: 'string',
    },
  ]);
}

function patchOutputField(index: number, patch: Record<string, any>) {
  syncOutputFields(
    outputFields.value.map((field: any, fieldIndex: number) =>
      fieldIndex === index ? { ...field, ...patch } : field,
    ),
  );
}

function removeOutputField(index: number) {
  syncOutputFields(
    outputFields.value.filter(
      (_: any, fieldIndex: number) => fieldIndex !== index,
    ),
  );
}

const toIndex = Number;

onMounted(() => {
  set(props.nodeModel, 'validate', validate);
});

onBeforeUnmount(() => {
  if (props.nodeModel.validate === validate) {
    set(props.nodeModel, 'validate', undefined);
  }
});
</script>

<template>
  <NodeContainer
    :node-model="nodeModel"
    :render-version="nodeRenderVersion + (renderVersion || 0)"
  >
    <ElForm :model="formData" label-position="top" @submit.prevent>
      <ElFormItem label="模型">
        <div class="workflow-node-grid">
          <ElSelect
            :model-value="formData.model_id_type || 'custom'"
            :teleported="false"
            @update:model-value="patchData('model_id_type', $event)"
          >
            <ElOption label="自定义" value="custom" />
            <ElOption label="引用" value="reference" />
          </ElSelect>
          <NodeCascader
            v-if="formData.model_id_type === 'reference'"
            :node-model="nodeModel"
            :model-value="formData.model_id_reference || []"
            class="w-full"
            placeholder="选择模型变量"
            @update:model-value="patchData('model_id_reference', $event)"
          />
          <LocalModelSelect
            v-else
            :model-value="formData.model_id || formData.modelId"
            model-type="LLM"
            placeholder="请选择模型"
            @update:model-value="patchData('model_id', $event)"
          />
        </div>
      </ElFormItem>
      <ElFormItem label="分类问题">
        <NodeCascader
          :node-model="nodeModel"
          :model-value="
            formData.content_list || formData.question_reference || []
          "
          class="w-full"
          placeholder="选择问题变量"
          @update:model-value="patchData('content_list', $event)"
        />
      </ElFormItem>
      <ElFormItem label="历史对话数">
        <ElInputNumber
          :model-value="formData.dialogue_number ?? 1"
          :min="0"
          :max="50"
          controls-position="right"
          class="w-full"
          @update:model-value="patchData('dialogue_number', $event)"
        />
      </ElFormItem>
      <div class="workflow-node-panel">
        <div class="workflow-node-panel__head">
          <span>意图分类</span>
          <ElButton link type="primary" @click="addIntent">添加</ElButton>
        </div>
        <div v-if="branches.length > 0" class="workflow-node-list">
          <div
            v-for="(branch, index) in branches"
            :key="branch.id || index"
            class="workflow-node-field is-inline"
          >
            <ElInput
              :model-value="branch.content || branch.name"
              :disabled="!!branch.isOther"
              placeholder="分类名称或意图描述"
              @update:model-value="
                patchIntent(toIndex(index), { content: $event })
              "
            />
            <ElButton
              link
              type="danger"
              :disabled="!!branch.isOther || branches.length <= 1"
              @click="removeIntent(toIndex(index))"
            >
              删
            </ElButton>
          </div>
        </div>
        <ElEmpty v-else description="暂无分类" :image-size="42" />
      </div>
      <div class="workflow-node-panel">
        <div class="workflow-node-panel__head">
          <span>结果字段</span>
          <ElButton link type="primary" @click="addOutputField">添加</ElButton>
        </div>
        <div v-if="outputFields.length > 0" class="workflow-node-list">
          <div
            v-for="(field, index) in outputFields"
            :key="index"
            class="workflow-node-field is-output"
          >
            <ElInput
              :model-value="field.name"
              placeholder="字段名"
              @update:model-value="
                patchOutputField(toIndex(index), { name: $event })
              "
            />
            <ElInput
              :model-value="field.label"
              placeholder="显示名"
              @update:model-value="
                patchOutputField(toIndex(index), { label: $event })
              "
            />
            <ElSelect
              :model-value="field.type || 'string'"
              :teleported="false"
              @update:model-value="
                patchOutputField(toIndex(index), { type: $event })
              "
            >
              <ElOption label="string" value="string" />
              <ElOption label="number" value="number" />
              <ElOption label="boolean" value="boolean" />
              <ElOption label="object" value="object" />
            </ElSelect>
            <ElButton
              link
              type="danger"
              @click="removeOutputField(toIndex(index))"
            >
              删
            </ElButton>
          </div>
        </div>
        <ElEmpty
          v-else
          description="使用默认 intent/confidence 输出"
          :image-size="42"
        />
      </div>
    </ElForm>
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-node-grid,
.workflow-node-list {
  display: grid;
  gap: 8px;
  width: 100%;
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

.workflow-node-field {
  display: grid;
  gap: 6px;
  padding: 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-node-field.is-inline {
  grid-template-columns: 1fr auto;
  align-items: center;
}

.workflow-node-field.is-output {
  grid-template-columns: 1fr 1fr 86px auto;
  align-items: center;
}
</style>
