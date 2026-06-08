<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import { onMounted, ref } from 'vue';

import { ElButton, ElForm, ElFormItem, ElInput, ElMessage } from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

import { syncNodeProperties as syncInlineNodeProperties } from '../../common/node-inline-update';
import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';

type VariableField = {
  expression: string;
  field: string;
  label: string;
};

type VariableSplittingNodeData = {
  input_variable: unknown[];
  variable_list: VariableField[];
};

const props = defineProps<{ nodeModel: any }>();
const nodeModel = props.nodeModel;
const formRef = ref<FormInstance>();
const formData = ref<VariableSplittingNodeData>(readNodeData());

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textValue(value: unknown) {
  return value === undefined || value === null ? '' : `${value}`;
}

function normalizeField(value: unknown): VariableField {
  const source = isRecord(value) ? value : {};
  return {
    expression: textValue(source.expression),
    field: textValue(source.field),
    label: textValue(source.label),
  };
}

function normalizeNodeData(value: unknown): VariableSplittingNodeData {
  const source = isRecord(value) ? value : {};
  let inputVariable: unknown[] = [];
  if (Array.isArray(source.input_variable)) {
    inputVariable = source.input_variable;
  } else if (Array.isArray(source.variable)) {
    inputVariable = source.variable;
  }
  const variableList = Array.isArray(source.variable_list)
    ? source.variable_list.map((item) => normalizeField(item))
    : [];

  return {
    input_variable: cloneDeep(inputVariable),
    variable_list: variableList,
  };
}

function readNodeData() {
  return normalizeNodeData(nodeModel.properties?.node_data);
}

function outputFields(variableList = formData.value.variable_list) {
  return [
    { label: '结果', value: 'result' },
    ...variableList
      .filter((item) => item.field.trim())
      .map((item) => ({
        label: item.label.trim() || item.field.trim(),
        value: item.field.trim(),
      })),
  ];
}

function syncNodeProperties(clearNextNodeField = false) {
  if (!nodeModel.properties) nodeModel.properties = {};
  const nodeData = cloneDeep(formData.value);
  const config = {
    ...nodeModel.properties.config,
    fields: outputFields(),
  };
  syncInlineNodeProperties(
    props.nodeModel,
    {
      config,
      node_data: nodeData,
    },
    ['node_data', 'config'],
  );
  if (clearNextNodeField) nodeModel.clear_next_node_field?.(false);
}

function patchInputVariable(value: unknown[]) {
  formData.value.input_variable = value || [];
  syncNodeProperties();
}

function addVariable() {
  formData.value.variable_list = [
    ...formData.value.variable_list,
    { expression: '', field: '', label: '' },
  ];
  syncNodeProperties(true);
}

function patchVariable(index: number, patch: Partial<VariableField>) {
  formData.value.variable_list = formData.value.variable_list.map(
    (item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item),
  );
  syncNodeProperties(true);
}

function removeVariable(index: number) {
  formData.value.variable_list = formData.value.variable_list.filter(
    (_, itemIndex) => itemIndex !== index,
  );
  syncNodeProperties(true);
}

function validateVariableList() {
  const fields = formData.value.variable_list.map((item) => item.field.trim());
  if (fields.some((field) => !field)) throw new Error('变量不能为空');
  if (fields.some((field) => !/^\w+$/.test(field))) {
    throw new Error('变量只能包含字母、数字和下划线');
  }
  if (new Set(fields).size !== fields.length) throw new Error('变量不能重复');
  if (formData.value.variable_list.some((item) => !item.label.trim())) {
    throw new Error('名称不能为空');
  }
  if (formData.value.variable_list.some((item) => !item.expression.trim())) {
    throw new Error('表达式不能为空');
  }
}

async function validate() {
  try {
    await formRef.value?.validate();
    validateVariableList();
  } catch (error) {
    const message = error instanceof Error ? error.message : `${error || ''}`;
    ElMessage.error(message);
    throw Object.assign(new Error(message), {
      errMessage: error,
      node: nodeModel,
    });
  }
}

onMounted(() => {
  set(nodeModel, 'validate', validate);
  syncNodeProperties();
});
</script>

<template>
  <NodeContainer :node-model="nodeModel">
    <ElForm
      ref="formRef"
      :model="formData"
      label-position="top"
      hide-required-asterisk
      @submit.prevent
    >
      <ElFormItem
        label="输入变量"
        prop="input_variable"
        :rules="{
          required: true,
          message: '请选择变量',
          trigger: 'change',
          type: 'array',
        }"
      >
        <NodeCascader
          :node-model="nodeModel"
          :model-value="formData.input_variable"
          class="w-full"
          placeholder="请选择变量"
          @update:model-value="patchInputVariable"
        />
      </ElFormItem>
      <div class="workflow-node-panel">
        <div class="workflow-node-panel__head">
          <span>
            拆分变量
            <span class="workflow-node-required">*</span>
          </span>
          <ElButton link type="primary" @click="addVariable">添加变量</ElButton>
        </div>
        <div class="workflow-node-row is-header">
          <span>变量</span>
          <span>名称</span>
          <span>表达式</span>
          <span>操作</span>
        </div>
        <div
          v-for="(item, index) in formData.variable_list"
          :key="index"
          class="workflow-node-row"
        >
          <ElInput
            :model-value="item.field"
            :maxlength="64"
            placeholder="请输入变量"
            show-word-limit
            @update:model-value="
              patchVariable(Number(index), { field: $event })
            "
          />
          <ElInput
            :model-value="item.label"
            :maxlength="64"
            placeholder="请输入名称"
            show-word-limit
            @update:model-value="
              patchVariable(Number(index), { label: $event })
            "
          />
          <ElInput
            :model-value="item.expression"
            :maxlength="64"
            placeholder="请输入 JSONPath 表达式"
            show-word-limit
            @update:model-value="
              patchVariable(Number(index), { expression: $event })
            "
          />
          <ElButton link type="danger" @click="removeVariable(Number(index))">
            删
          </ElButton>
        </div>
        <div
          v-if="formData.variable_list.length === 0"
          class="workflow-node-empty"
        >
          请添加拆分变量
        </div>
      </div>
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

.workflow-node-panel__head {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.workflow-node-required {
  color: var(--el-color-danger);
}

.workflow-node-row {
  display: grid;
  grid-template-columns: 88px 88px 1fr auto;
  gap: 6px;
  align-items: center;
}

.workflow-node-row.is-header {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.workflow-node-empty {
  padding: 8px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  text-align: center;
  background: var(--el-bg-color);
  border: 1px dashed var(--el-border-color-lighter);
  border-radius: 6px;
}
</style>
