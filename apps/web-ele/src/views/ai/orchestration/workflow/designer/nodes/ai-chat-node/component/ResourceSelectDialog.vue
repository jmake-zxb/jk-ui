<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import {
  ElAvatar,
  ElButton,
  ElCheckbox,
  ElCheckboxGroup,
  ElDialog,
  ElEmpty,
  ElInput,
  ElTag,
} from 'element-plus';
import { cloneDeep } from 'lodash-es';

type ResourceRecord = Record<string, unknown>;

const props = withDefaults(
  defineProps<{
    modelValue?: Array<number | string>;
    records?: ResourceRecord[];
    title?: string;
    typeFilter?: string | string[];
  }>(),
  {
    modelValue: () => [],
    records: () => [],
    title: '选择资源',
    typeFilter: undefined,
  },
);

const emit = defineEmits<{
  refresh: [value: Array<number | string>];
}>();

const dialogVisible = ref(false);
const keyword = ref('');
const selectedIds = ref<Array<number | string>>([]);

function idOf(record: ResourceRecord): number | string {
  const value =
    record.id ??
    record.toolId ??
    record.tool_id ??
    record.applicationId ??
    record.application_id ??
    record.value;
  return typeof value === 'number' || typeof value === 'string'
    ? value
    : `${value || ''}`;
}

function nameOf(record: ResourceRecord) {
  return `${record.name || record.toolName || record.tool_name || record.applicationName || record.application_name || record.title || idOf(record) || ''}`;
}

function descriptionOf(record: ResourceRecord) {
  return `${record.description || record.desc || record.remark || ''}`;
}

function typeOf(record: ResourceRecord) {
  return `${record.toolType || record.tool_type || record.type || record.category || ''}`.toUpperCase();
}

function iconOf(record: ResourceRecord) {
  const icon = record.icon || record.logo || record.avatar;
  return typeof icon === 'string' ? icon : '';
}

function typeMatched(record: ResourceRecord) {
  if (!props.typeFilter) return true;
  const filters = Array.isArray(props.typeFilter)
    ? props.typeFilter
    : [props.typeFilter];
  const type = typeOf(record);
  return !type || filters.map((item) => item.toUpperCase()).includes(type);
}

const filteredRecords = computed(() => {
  const value = keyword.value.trim().toLowerCase();
  return props.records.filter((record) => {
    if (!typeMatched(record)) return false;
    if (!value) return true;
    return `${nameOf(record)} ${descriptionOf(record)} ${idOf(record) || ''}`
      .toLowerCase()
      .includes(value);
  });
});

function open(value?: Array<number | string>) {
  selectedIds.value = cloneDeep(value || props.modelValue || []);
  keyword.value = '';
  dialogVisible.value = true;
}

function close() {
  dialogVisible.value = false;
}

function submit() {
  dialogVisible.value = false;
  emit('refresh', cloneDeep(selectedIds.value));
}

watch(
  () => props.modelValue,
  (value) => {
    if (!dialogVisible.value) selectedIds.value = cloneDeep(value || []);
  },
);

defineExpose({ open });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    :title="title"
    append-to-body
    :close-on-click-modal="false"
    width="640"
  >
    <div class="resource-select-dialog">
      <ElInput v-model="keyword" clearable placeholder="搜索名称、描述或 ID" />
      <ElCheckboxGroup
        v-model="selectedIds"
        class="resource-select-dialog__list"
      >
        <label
          v-for="record in filteredRecords"
          :key="`${idOf(record)}`"
          class="resource-select-dialog__item"
        >
          <ElCheckbox :value="idOf(record)" />
          <ElAvatar
            v-if="iconOf(record)"
            :size="28"
            shape="square"
            :src="iconOf(record)"
          />
          <ElTag v-else size="small" type="primary">{{
            typeOf(record) || '资源'
          }}</ElTag>
          <span class="resource-select-dialog__body">
            <strong>{{ nameOf(record) }}</strong>
            <small>{{ descriptionOf(record) || idOf(record) }}</small>
          </span>
        </label>
      </ElCheckboxGroup>
      <ElEmpty
        v-if="filteredRecords.length === 0"
        description="暂无可选资源"
        :image-size="52"
      />
    </div>
    <template #footer>
      <ElButton @click="close">取消</ElButton>
      <ElButton type="primary" @click="submit">保存</ElButton>
    </template>
  </ElDialog>
</template>

<style scoped lang="scss">
.resource-select-dialog {
  --resource-dialog-space-sm: 6px;
  --resource-dialog-space-md: 8px;
  --resource-dialog-radius: 6px;

  display: grid;
  gap: var(--resource-dialog-space-md);
}

.resource-select-dialog__list {
  display: grid;
  gap: var(--resource-dialog-space-sm);
  max-height: 360px;
  overflow: auto;
}

.resource-select-dialog__item {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  gap: var(--resource-dialog-space-md);
  align-items: center;
  padding: var(--resource-dialog-space-md);
  cursor: pointer;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--resource-dialog-radius);
}

.resource-select-dialog__body {
  display: grid;
  min-width: 0;
}

.resource-select-dialog__body strong,
.resource-select-dialog__body small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-select-dialog__body strong {
  font-size: var(--el-font-size-base);
  color: var(--el-text-color-primary);
}

.resource-select-dialog__body small {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-placeholder);
}
</style>
