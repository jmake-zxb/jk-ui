<script setup lang="ts">
import { computed } from 'vue';

import { ElForm, ElFormItem, ElInput, ElSwitch } from 'element-plus';

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

const inputFields = computed(() => [
  ...(Array.isArray(formData.value.api_input_field_list)
    ? formData.value.api_input_field_list
    : []),
  ...(Array.isArray(formData.value.user_input_field_list)
    ? formData.value.user_input_field_list
    : []),
]);

function patchData(key: string, value: any) {
  formData.value = { ...formData.value, [key]: value };
}

function patchInput(index: number, value: any[]) {
  const apiFields = Array.isArray(formData.value.api_input_field_list)
    ? formData.value.api_input_field_list
    : [];
  const userFields = Array.isArray(formData.value.user_input_field_list)
    ? formData.value.user_input_field_list
    : [];
  if (index < apiFields.length) {
    patchData(
      'api_input_field_list',
      apiFields.map((field: any, fieldIndex: number) =>
        fieldIndex === index ? { ...field, value } : field,
      ),
    );
  } else {
    const userIndex = index - apiFields.length;
    patchData(
      'user_input_field_list',
      userFields.map((field: any, fieldIndex: number) =>
        fieldIndex === userIndex ? { ...field, value } : field,
      ),
    );
  }
}

function fieldLabel(field: any) {
  return (
    field?.label?.label ||
    field?.label ||
    field?.variable?.label ||
    field?.variable ||
    field?.field ||
    '输入字段'
  );
}
</script>

<template>
  <NodeContainer :node-model="nodeModel">
    <ElForm :model="formData" label-position="top" @submit.prevent>
      <ElFormItem label="应用 ID">
        <ElInput
          :model-value="formData.application_id || formData.applicationId"
          placeholder="目标应用标识"
          @update:model-value="patchData('application_id', $event)"
        />
      </ElFormItem>
      <ElFormItem label="用户消息">
        <NodeCascader
          :node-model="nodeModel"
          :model-value="
            formData.question_reference_address || formData.messageRef || []
          "
          class="w-full"
          placeholder="选择消息变量"
          @update:model-value="patchData('question_reference_address', $event)"
        />
      </ElFormItem>
      <div v-if="inputFields.length > 0" class="workflow-node-panel">
        <div class="workflow-node-panel__title">应用输入</div>
        <ElFormItem
          v-for="(field, index) in inputFields"
          :key="index"
          :label="fieldLabel(field)"
        >
          <NodeCascader
            :node-model="nodeModel"
            :model-value="field.value || []"
            class="w-full"
            placeholder="选择变量"
            @update:model-value="patchInput(index, $event)"
          />
        </ElFormItem>
      </div>
      <ElFormItem label="作为结果返回">
        <ElSwitch
          :model-value="!!formData.is_result"
          size="small"
          @update:model-value="patchData('is_result', $event)"
        />
      </ElFormItem>
    </ElForm>
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-node-panel {
  display: grid;
  gap: 8px;
  padding: 8px;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-node-panel__title {
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}
</style>
