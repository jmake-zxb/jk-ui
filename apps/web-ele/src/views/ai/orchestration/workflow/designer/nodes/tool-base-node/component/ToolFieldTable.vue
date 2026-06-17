<script setup lang="ts">
import { computed } from 'vue';

import {
  ElButton,
  ElEmpty,
  ElInput,
  ElOption,
  ElSelect,
  ElSwitch,
} from 'element-plus';
import { cloneDeep } from 'lodash-es';

import NodeCascader from '../../../common/NodeCascader.vue';

type ToolField = {
  desc?: string;
  field?: string;
  is_required?: boolean;
  label?: string;
  name?: string;
  source?: string;
  type?: string;
  value?: unknown;
};

const props = defineProps<{
  fields: ToolField[];
  kind: 'input' | 'output';
  nodeModel: any;
}>();

const emit = defineEmits<{
  update: [fields: ToolField[]];
}>();

const isInput = computed(() => props.kind === 'input');
const emptyDescription = computed(() =>
  isInput.value ? '暂无输入字段' : '暂无输出字段',
);
const title = computed(() => (isInput.value ? '输入字段' : '输出字段'));

function defaultField(): ToolField {
  const index = props.fields.length + 1;
  const prefix = isInput.value ? 'input' : 'output';
  const labelPrefix = isInput.value ? '输入' : '输出';

  if (!isInput.value) {
    return {
      desc: '',
      field: `${prefix}_${index}`,
      label: `${labelPrefix} ${index}`,
      type: 'string',
    };
  }

  return {
    desc: '',
    field: `${prefix}_${index}`,
    is_required: false,
    label: `${labelPrefix} ${index}`,
    source: 'reference',
    type: 'string',
    value: isInput.value ? [] : undefined,
  };
}

function syncFields(fields: ToolField[]) {
  emit('update', cloneDeep(fields));
}

function addField() {
  syncFields([...props.fields, defaultField()]);
}

function patchField(index: number, patch: Partial<ToolField>) {
  const nextFields = cloneDeep(props.fields);
  nextFields[index] = { ...nextFields[index], ...patch };
  syncFields(nextFields);
}

function removeField(index: number) {
  syncFields(props.fields.filter((_, fieldIndex) => fieldIndex !== index));
}

function cascaderValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function inputValue(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (value === undefined || value === null) return undefined;
  return `${value}`;
}
</script>

<template>
  <div class="tool-field-table">
    <div class="tool-field-table__head">
      <span>{{ title }}</span>
      <ElButton link type="primary" @click="addField">添加</ElButton>
    </div>
    <div v-if="fields.length > 0" class="tool-field-table__list">
      <div
        v-for="(field, index) in fields"
        :key="index"
        class="tool-field-table__item"
      >
        <div class="tool-field-table__meta" :class="{ 'is-output': !isInput }">
          <ElInput
            :model-value="field.field || field.name"
            placeholder="字段名"
            @update:model-value="patchField(Number(index), { field: $event })"
          />
          <ElInput
            :model-value="field.label"
            placeholder="显示名"
            @update:model-value="patchField(Number(index), { label: $event })"
          />
          <ElSelect
            :model-value="field.type || 'string'"
            :teleported="false"
            @update:model-value="patchField(Number(index), { type: $event })"
          >
            <ElOption label="string" value="string" />
            <ElOption label="number" value="number" />
            <ElOption label="boolean" value="boolean" />
            <ElOption
              :label="isInput ? 'json' : 'object'"
              :value="isInput ? 'json' : 'object'"
            />
          </ElSelect>
          <ElSwitch
            v-if="isInput"
            :model-value="!!field.is_required"
            size="small"
            active-text="必填"
            @update:model-value="
              patchField(Number(index), { is_required: $event === true })
            "
          />
          <ElButton link type="danger" @click="removeField(Number(index))">
            删
          </ElButton>
        </div>
        <div v-if="isInput" class="tool-field-table__value">
          <ElSelect
            :model-value="field.source || 'reference'"
            :teleported="false"
            @update:model-value="
              patchField(Number(index), {
                source: `${$event}`,
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
            :model-value="cascaderValue(field.value)"
            placeholder="选择变量"
            @update:model-value="patchField(Number(index), { value: $event })"
          />
          <ElInput
            v-else
            :model-value="inputValue(field.value)"
            placeholder="固定值"
            @update:model-value="patchField(Number(index), { value: $event })"
          />
        </div>
      </div>
    </div>
    <ElEmpty v-else :description="emptyDescription" :image-size="42" />
  </div>
</template>

<style scoped lang="scss">
.tool-field-table,
.tool-field-table__list,
.tool-field-table__item {
  display: grid;
  gap: 8px;
}

.tool-field-table__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.tool-field-table__item {
  padding: 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.tool-field-table__meta {
  display: grid;
  grid-template-columns: 1fr 1fr 86px auto auto;
  gap: 6px;
  align-items: center;
}

.tool-field-table__meta.is-output {
  grid-template-columns: 1fr 1fr 86px auto;
}

.tool-field-table__value {
  display: grid;
  grid-template-columns: 86px 1fr;
  gap: 6px;
}
</style>
