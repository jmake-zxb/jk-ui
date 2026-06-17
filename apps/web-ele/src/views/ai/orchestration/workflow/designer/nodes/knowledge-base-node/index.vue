<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

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
import { cloneDeep } from 'lodash-es';

import { syncNodeProperties } from '../../common/node-inline-update';
import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';

const props = defineProps<{ nodeModel: any; renderVersion?: number }>();
const nodeRenderVersion = ref(0);

const defaultKnowledgeGlobalField = {
  label: '知识库',
  value: 'knowledge',
  globeLabel: '{{global.knowledge}}',
  globeValue: "{{context['global'].knowledge}}",
};

const inputTypeOptions = [
  { label: '文本', value: 'TextInput' },
  { label: '多行文本', value: 'TextareaInput' },
  { label: '密码', value: 'PasswordInput' },
  { label: 'JSON', value: 'JsonInput' },
  { label: '数字', value: 'number' },
  { label: '布尔', value: 'boolean' },
  { label: '数组', value: 'array' },
  { label: '字符串', value: 'string' },
];

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
  trackRenderVersion(props.renderVersion, nodeRenderVersion.value);
  return normalizeUserFields(props.nodeModel.properties?.user_input_field_list);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textValue(value: unknown) {
  return `${value ?? ''}`.trim();
}

function labelText(label: unknown, fallback = '') {
  if (typeof label === 'string') return label;
  if (isRecord(label)) {
    const tooltipLabel = label.label;
    if (typeof tooltipLabel === 'string') return tooltipLabel;
  }
  return fallback;
}

function normalizeUserFields(fields: unknown): Array<Record<string, any>> {
  if (!Array.isArray(fields)) return [];
  return fields.map((field, index) => {
    const source = isRecord(field) ? cloneDeep(field) : {};
    const fieldName =
      textValue(source.field || source.name || source.variable) ||
      `field_${index + 1}`;
    const fieldLabel =
      labelText(source.label, textValue(source.name) || fieldName) || fieldName;
    const inputType =
      textValue(source.input_type || source.type) || 'TextInput';
    return {
      ...source,
      default_value: source.default_value ?? '',
      field: fieldName,
      input_type: inputType,
      label: fieldLabel,
      required:
        source.required === undefined
          ? !!source.is_required
          : !!source.required,
      type: textValue(source.type) || inputType,
    };
  });
}

function globalFieldsFor(fields: Array<Record<string, any>>) {
  const userGlobalFields = fields
    .map((field) => {
      const fieldName = textValue(field.field || field.name || field.variable);
      if (!fieldName) return null;
      return {
        label: labelText(field.label, fieldName) || fieldName,
        value: fieldName,
        globeLabel: `{{global.${fieldName}}}`,
        globeValue: `{{context['global'].${fieldName}}}`,
      };
    })
    .filter(Boolean);
  return [...userGlobalFields, defaultKnowledgeGlobalField];
}

function syncUserFields(nextFields: any[]) {
  const normalizedFields = normalizeUserFields(nextFields);
  const config = {
    ...props.nodeModel.properties?.config,
    globalFields: globalFieldsFor(normalizedFields),
  };
  syncNodeProperties(
    props.nodeModel,
    {
      config,
      user_input_field_list: normalizedFields,
    },
    ['user_input_field_list', 'config'],
  );
  props.nodeModel.clear_next_node_field?.(true);
  nodeRenderVersion.value += 1;
}

function addUserField() {
  syncUserFields([
    ...userFields.value,
    {
      field: `field_${userFields.value.length + 1}`,
      input_type: 'TextInput',
      label: `字段 ${userFields.value.length + 1}`,
      default_value: '',
      required: false,
      type: 'TextInput',
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

function defaultValueText(value: unknown) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return `${value}`;
}

onMounted(() => {
  syncUserFields(userFields.value);
});
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
            :model-value="idsValue('knowledge_id_list')"
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
              :model-value="field.input_type || field.type || 'TextInput'"
              :teleported="false"
              @update:model-value="
                patchUserField(Number(index), {
                  input_type: $event,
                  type: $event,
                })
              "
            >
              <ElOption
                v-for="option in inputTypeOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </ElSelect>
            <ElInput
              :model-value="defaultValueText(field.default_value)"
              placeholder="默认值"
              @update:model-value="
                patchUserField(Number(index), { default_value: $event })
              "
            />
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
  grid-template-columns: 1fr 1fr 104px 1fr auto auto;
  align-items: center;
}

.workflow-node-field.is-output {
  grid-template-columns: 1fr 1fr 86px auto;
  align-items: center;
}
</style>
