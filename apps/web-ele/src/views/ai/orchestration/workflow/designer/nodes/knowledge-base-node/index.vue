<script setup lang="ts">
import { computed, ref } from 'vue';

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

import { syncNodeProperties } from '../../common/node-inline-update';
import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';

const props = defineProps<{ nodeModel: any; renderVersion?: number }>();
const nodeRenderVersion = ref(0);

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

const userFields = computed(() => {
  if (Array.isArray(formData.value.user_input_field_list))
    return formData.value.user_input_field_list;
  if (Array.isArray(formData.value.userInputFields))
    return formData.value.userInputFields;
  return [];
});
const outputFields = computed(() =>
  Array.isArray(formData.value.output_field_list)
    ? formData.value.output_field_list
    : [],
);

function patchData(key: string, value: any) {
  formData.value = { ...formData.value, [key]: value };
}

function trackRenderVersion(..._versions: unknown[]) {}

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

function syncUserFields(nextFields: any[]) {
  patchData('user_input_field_list', nextFields);
}

function addUserField() {
  syncUserFields([
    ...userFields.value,
    {
      field: `field_${userFields.value.length + 1}`,
      label: `字段 ${userFields.value.length + 1}`,
      required: false,
      type: 'string',
      value: [],
    },
  ]);
}

function patchUserField(index: number, patch: Record<string, any>) {
  syncUserFields(
    userFields.value.map((field: any, fieldIndex: number) =>
      fieldIndex === index ? { ...field, ...patch } : field,
    ),
  );
}

function removeUserField(index: number) {
  syncUserFields(
    userFields.value.filter(
      (_: any, fieldIndex: number) => fieldIndex !== index,
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
      label: `输出 ${outputFields.value.length + 1}`,
      name: `output_${outputFields.value.length + 1}`,
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
</script>

<template>
  <NodeContainer
    :node-model="nodeModel"
    :render-version="nodeRenderVersion + (renderVersion || 0)"
  >
    <ElForm :model="formData" label-position="top" @submit.prevent>
      <div class="workflow-node-panel">
        <div class="workflow-node-panel__head">知识库应用基础设置</div>
        <ElFormItem label="应用 ID">
          <ElInput
            :model-value="formData.application_id || formData.applicationId"
            placeholder="可选，知识库应用标识"
            @update:model-value="patchData('application_id', $event)"
          />
        </ElFormItem>
        <ElFormItem label="知识库 ID">
          <ElInput
            :model-value="
              idsValue('knowledge_id_list') || idsValue('knowledgeIds')
            "
            placeholder="多个 ID 用逗号分隔"
            @update:model-value="patchIds('knowledge_id_list', $event)"
          />
        </ElFormItem>
        <ElFormItem label="默认问题">
          <NodeCascader
            v-if="formData.question_type === 'reference'"
            :node-model="nodeModel"
            :model-value="formData.question_reference || []"
            class="w-full"
            placeholder="选择问题变量"
            @update:model-value="patchData('question_reference', $event)"
          />
          <ElInput
            v-else
            :model-value="formData.query || formData.question"
            placeholder="{{input}}"
            @update:model-value="patchData('query', $event)"
          />
        </ElFormItem>
        <ElFormItem label="问题类型">
          <ElSelect
            :model-value="formData.question_type || 'custom'"
            :teleported="false"
            @update:model-value="patchData('question_type', $event)"
          >
            <ElOption label="自定义" value="custom" />
            <ElOption label="引用" value="reference" />
          </ElSelect>
        </ElFormItem>
      </div>
      <div class="workflow-node-panel">
        <div class="workflow-node-panel__head">
          <span>用户输入字段</span>
          <ElButton link type="primary" @click="addUserField">添加</ElButton>
        </div>
        <div v-if="userFields.length > 0" class="workflow-node-list">
          <div
            v-for="(field, index) in userFields"
            :key="index"
            class="workflow-node-field is-user"
          >
            <ElInput
              :model-value="field.field || field.name"
              placeholder="字段名"
              @update:model-value="
                patchUserField(Number(index), { field: $event })
              "
            />
            <ElInput
              :model-value="field.label"
              placeholder="显示名"
              @update:model-value="
                patchUserField(Number(index), { label: $event })
              "
            />
            <ElSelect
              :model-value="field.type || 'string'"
              :teleported="false"
              @update:model-value="
                patchUserField(Number(index), { type: $event })
              "
            >
              <ElOption label="string" value="string" />
              <ElOption label="number" value="number" />
              <ElOption label="boolean" value="boolean" />
              <ElOption label="array" value="array" />
            </ElSelect>
            <ElSwitch
              :model-value="!!field.required || !!field.is_required"
              size="small"
              active-text="必填"
              @update:model-value="
                patchUserField(Number(index), { required: $event })
              "
            />
            <ElButton
              link
              type="danger"
              @click="removeUserField(Number(index))"
            >
              删
            </ElButton>
          </div>
        </div>
        <ElEmpty v-else description="暂无用户字段" :image-size="42" />
      </div>
      <div class="workflow-node-panel">
        <div class="workflow-node-panel__head">
          <span>输出字段</span>
          <ElButton link type="primary" @click="addOutputField">添加</ElButton>
        </div>
        <div v-if="outputFields.length > 0" class="workflow-node-list">
          <div
            v-for="(field, index) in outputFields"
            :key="index"
            class="workflow-node-field is-output"
          >
            <ElInput
              :model-value="field.name || field.value"
              placeholder="字段名"
              @update:model-value="
                patchOutputField(Number(index), { name: $event })
              "
            />
            <ElInput
              :model-value="field.label"
              placeholder="显示名"
              @update:model-value="
                patchOutputField(Number(index), { label: $event })
              "
            />
            <ElSelect
              :model-value="field.type || 'string'"
              :teleported="false"
              @update:model-value="
                patchOutputField(Number(index), { type: $event })
              "
            >
              <ElOption label="string" value="string" />
              <ElOption label="array" value="array" />
              <ElOption label="object" value="object" />
            </ElSelect>
            <ElButton
              link
              type="danger"
              @click="removeOutputField(Number(index))"
            >
              删
            </ElButton>
          </div>
        </div>
        <ElEmpty
          v-else
          description="使用默认 query/documents 输出"
          :image-size="42"
        />
      </div>
    </ElForm>
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-node-panel,
.workflow-node-list {
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
  display: grid;
  gap: 6px;
  padding: 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-node-field.is-user {
  grid-template-columns: 1fr 1fr 86px auto auto;
  align-items: center;
}

.workflow-node-field.is-output {
  grid-template-columns: 1fr 1fr 86px auto;
  align-items: center;
}
</style>
