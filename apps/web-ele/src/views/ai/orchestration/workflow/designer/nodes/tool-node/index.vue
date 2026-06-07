<script setup lang="ts">
import { computed } from 'vue';

import {
  ElButton,
  ElEmpty,
  ElForm,
  ElFormItem,
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

const fields = computed(() =>
  Array.isArray(formData.value.input_field_list)
    ? formData.value.input_field_list
    : [],
);

function patchData(key: string, value: any) {
  formData.value = { ...formData.value, [key]: value };
}

function syncFields(nextFields: any[]) {
  patchData('input_field_list', nextFields);
}

function addField() {
  syncFields([
    ...fields.value,
    {
      desc: '',
      is_required: false,
      name: `param_${fields.value.length + 1}`,
      source: 'reference',
      type: 'string',
      value: [],
    },
  ]);
}

function patchField(index: number, patch: Record<string, any>) {
  syncFields(
    fields.value.map((field: any, fieldIndex: number) =>
      fieldIndex === index ? { ...field, ...patch } : field,
    ),
  );
}

function removeField(index: number) {
  syncFields(
    fields.value.filter((_: any, fieldIndex: number) => fieldIndex !== index),
  );
}
</script>

<template>
  <NodeContainer :node-model="nodeModel">
    <ElForm :model="formData" label-position="top" @submit.prevent>
      <ElFormItem label="工具 ID">
        <ElInput
          :model-value="formData.toolId || formData.tool_id"
          placeholder="选择或填写工具标识"
          @update:model-value="patchData('toolId', $event)"
        />
      </ElFormItem>
      <div class="workflow-node-panel">
        <div class="workflow-node-panel__head">
          <span>输入参数</span>
          <ElButton link type="primary" @click="addField">添加</ElButton>
        </div>
        <div v-if="fields.length > 0" class="workflow-node-list">
          <div
            v-for="(field, index) in fields"
            :key="index"
            class="workflow-node-field"
          >
            <div class="workflow-node-field__meta">
              <ElInput
                :model-value="field.name"
                placeholder="参数名"
                @update:model-value="
                  patchField(Number(index), { name: $event })
                "
              />
              <ElSelect
                :model-value="field.type || 'string'"
                :teleported="false"
                @update:model-value="
                  patchField(Number(index), { type: $event })
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
                  patchField(Number(index), { is_required: $event })
                "
              />
              <ElButton link type="danger" @click="removeField(Number(index))">
                删
              </ElButton>
            </div>
            <div class="workflow-node-field__value">
              <ElSelect
                :model-value="field.source || 'reference'"
                :teleported="false"
                @update:model-value="
                  patchField(Number(index), {
                    source: $event,
                    value: $event === 'reference' ? [] : '',
                  })
                "
              >
                <ElOption label="引用" value="reference" />
                <ElOption label="自定义" value="custom" />
              </ElSelect>
              <NodeCascader
                v-if="(field.source || 'reference') === 'reference'"
                :node-model="nodeModel"
                :model-value="field.value || []"
                placeholder="选择变量"
                @update:model-value="
                  patchField(Number(index), { value: $event })
                "
              />
              <ElInput
                v-else
                :model-value="field.value"
                placeholder="固定值"
                @update:model-value="
                  patchField(Number(index), { value: $event })
                "
              />
            </div>
          </div>
        </div>
        <ElEmpty v-else description="暂无参数" :image-size="42" />
      </div>
      <ElFormItem label="执行代码">
        <ElInput
          :model-value="formData.code"
          type="textarea"
          :rows="4"
          placeholder="工具执行代码或脚本配置"
          @update:model-value="patchData('code', $event)"
        />
      </ElFormItem>
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

.workflow-node-field__meta {
  display: grid;
  grid-template-columns: 1fr 86px auto auto;
  gap: 6px;
  align-items: center;
}

.workflow-node-field__value {
  display: grid;
  grid-template-columns: 86px 1fr;
  gap: 6px;
}
</style>
