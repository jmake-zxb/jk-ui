<script setup lang="ts">
import { computed } from 'vue';

import {
  ElButton,
  ElEmpty,
  ElForm,
  ElInput,
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

const inputFields = computed(() => normalizeInputFields());

function normalizeInputFields() {
  if (Array.isArray(formData.value.input_field_list)) {
    return formData.value.input_field_list;
  }
  if (Array.isArray(formData.value.inputFields)) {
    return formData.value.inputFields;
  }
  return [];
}

function patchData(key: string, value: any) {
  formData.value = { ...formData.value, [key]: value };
}

function syncInputFields(nextFields: any[]) {
  patchData('input_field_list', nextFields);
}

function addInputField() {
  syncInputFields([
    ...inputFields.value,
    {
      field: `input_${inputFields.value.length + 1}`,
      is_required: false,
      label: `输入 ${inputFields.value.length + 1}`,
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
</script>

<template>
  <NodeContainer :node-model="nodeModel">
    <ElForm :model="formData" label-position="top" @submit.prevent>
      <div class="workflow-node-panel">
        <div class="workflow-node-panel__head">
          <span>工具输入字段</span>
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
                :model-value="field.field || field.name"
                placeholder="字段名"
                @update:model-value="
                  patchInputField(Number(index), { field: $event })
                "
              />
              <ElInput
                :model-value="field.label"
                placeholder="显示名"
                @update:model-value="
                  patchInputField(Number(index), { label: $event })
                "
              />
              <ElSelect
                :model-value="field.type || 'string'"
                :teleported="false"
                @update:model-value="
                  patchInputField(Number(index), { type: $event })
                "
              >
                <ElOption label="string" value="string" />
                <ElOption label="number" value="number" />
                <ElOption label="boolean" value="boolean" />
                <ElOption label="json" value="json" />
              </ElSelect>
              <ElSwitch
                :model-value="!!field.is_required"
                size="small"
                active-text="必填"
                @update:model-value="
                  patchInputField(Number(index), { is_required: $event })
                "
              />
              <ElButton
                link
                type="danger"
                @click="removeInputField(Number(index))"
              >
                删
              </ElButton>
            </div>
            <div class="workflow-node-field__value">
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
        </div>
        <ElEmpty v-else description="暂无输入字段" :image-size="42" />
      </div>
    </ElForm>
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-node-panel,
.workflow-node-list,
.workflow-node-field {
  display: grid;
  gap: 8px;
}

.workflow-node-panel {
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
  padding: 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-node-field__meta {
  display: grid;
  grid-template-columns: 1fr 1fr 86px auto auto;
  gap: 6px;
  align-items: center;
}

.workflow-node-field__value {
  display: grid;
  grid-template-columns: 86px 1fr;
  gap: 6px;
}
</style>
