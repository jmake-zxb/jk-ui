<script setup lang="ts">
import { computed, ref } from 'vue';

import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElSelect,
  ElSwitch,
} from 'element-plus';

import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';

const props = defineProps<{ nodeModel: any }>();

const formData = computed({
  get: () => props.nodeModel.properties.node_data || {},
  set: (value) =>
    props.nodeModel.updateWorkflowProperties?.({ node_data: value }, [
      'node_data',
    ]),
});

const paramsDialogVisible = ref(false);
const paramsDraft = ref('');

const hasLegacyQuestion = computed(
  () =>
    Object.prototype.hasOwnProperty.call(formData.value, 'question') ||
    Object.prototype.hasOwnProperty.call(
      formData.value,
      'question_reference',
    ) ||
    Object.prototype.hasOwnProperty.call(
      formData.value,
      'question_reference_address',
    ),
);

const modelParamsSummary = computed(() => {
  const setting = formData.value.model_params_setting;
  return setting && typeof setting === 'object' && !Array.isArray(setting)
    ? `${Object.keys(setting).length} 项`
    : '默认参数';
});

function patchData(key: string, value: any) {
  formData.value = { ...formData.value, [key]: value };
}

function openParamsDialog() {
  paramsDraft.value = JSON.stringify(
    formData.value.model_params_setting || {},
    null,
    2,
  );
  paramsDialogVisible.value = true;
}

function saveParamsDialog() {
  try {
    patchData(
      'model_params_setting',
      paramsDraft.value.trim() ? JSON.parse(paramsDraft.value) : {},
    );
    paramsDialogVisible.value = false;
  } catch {
    ElMessage.warning('模型参数必须是有效 JSON');
  }
}
</script>

<template>
  <NodeContainer :node-model="nodeModel">
    <ElForm :model="formData" label-position="top" @submit.prevent>
      <ElFormItem label="模型">
        <div class="workflow-node-row is-model">
          <ElSelect
            :model-value="formData.model_id_type || 'custom'"
            :teleported="false"
            @update:model-value="patchData('model_id_type', $event)"
          >
            <ElOption label="自定义" value="custom" />
            <ElOption label="引用" value="reference" />
          </ElSelect>
          <ElInput
            v-if="(formData.model_id_type || 'custom') === 'custom'"
            :model-value="formData.model_id || formData.modelId"
            placeholder="LLM 模型 ID"
            @update:model-value="patchData('model_id', $event)"
          />
          <NodeCascader
            v-else
            :node-model="nodeModel"
            :model-value="formData.model_id_reference || []"
            class="w-full"
            placeholder="选择模型变量"
            @update:model-value="patchData('model_id_reference', $event)"
          />
        </div>
      </ElFormItem>
      <ElFormItem label="系统提示词">
        <ElInput
          :model-value="formData.system"
          type="textarea"
          :rows="3"
          placeholder="定义问题优化规则"
          @update:model-value="patchData('system', $event)"
        />
      </ElFormItem>
      <ElFormItem label="用户提示词">
        <ElInput
          :model-value="formData.prompt || formData.question"
          type="textarea"
          :rows="4"
          placeholder="支持 {{节点.字段}} 引用，例如 {{start-node.question}}"
          @update:model-value="patchData('prompt', $event)"
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
      <ElFormItem label="模型参数">
        <div class="workflow-node-row is-params">
          <ElInput :model-value="modelParamsSummary" disabled />
          <ElButton @click="openParamsDialog">设置</ElButton>
        </div>
      </ElFormItem>
      <ElFormItem label="作为结果返回">
        <ElSwitch
          :model-value="!!formData.is_result"
          size="small"
          @update:model-value="patchData('is_result', $event)"
        />
      </ElFormItem>
      <ElFormItem v-if="hasLegacyQuestion" label="旧版问题来源">
        <div class="workflow-node-stack">
          <NodeCascader
            v-if="
              formData.question_reference || formData.question_reference_address
            "
            :node-model="nodeModel"
            :model-value="
              formData.question_reference ||
              formData.question_reference_address ||
              []
            "
            class="w-full"
            placeholder="旧版问题变量"
            @update:model-value="patchData('question_reference', $event)"
          />
          <ElInput
            :model-value="formData.question"
            placeholder="旧版问题内容"
            @update:model-value="patchData('question', $event)"
          />
        </div>
      </ElFormItem>
    </ElForm>
    <ElDialog
      v-model="paramsDialogVisible"
      title="模型参数设置"
      width="420px"
      append-to-body
    >
      <ElInput
        v-model="paramsDraft"
        type="textarea"
        :rows="8"
        placeholder="{}"
      />
      <template #footer>
        <ElButton @click="paramsDialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="saveParamsDialog">保存</ElButton>
      </template>
    </ElDialog>
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-node-row,
.workflow-node-stack {
  display: grid;
  gap: 8px;
  width: 100%;
}

.workflow-node-row.is-model {
  grid-template-columns: 86px 1fr;
}

.workflow-node-row.is-params {
  grid-template-columns: 1fr auto;
}
</style>
