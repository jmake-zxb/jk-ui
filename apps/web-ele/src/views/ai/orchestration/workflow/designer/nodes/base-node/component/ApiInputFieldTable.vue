<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { Delete, EditPen, Plus } from '@element-plus/icons-vue';
import {
  ElButton,
  ElIcon,
  ElMessage,
  ElSwitch,
  ElTable,
  ElTableColumn,
} from 'element-plus';
import Sortable from 'sortablejs';

import ApiFieldFormDialog from './ApiFieldFormDialog.vue';
import {
  cloneValue,
  emitGraphEvent,
  normalizeList,
  syncInputFieldList,
} from './base-node-utils';

const props = defineProps<{ nodeModel: any; renderVersion?: number }>();
const nodeModel = props.nodeModel;

const tableRef = ref<any>();
const apiFieldFormDialogRef = ref<InstanceType<typeof ApiFieldFormDialog>>();
const currentIndex = ref<null | number>(null);
const inputFieldList = ref<any[]>([]);
let sortable: ReturnType<typeof Sortable.create> | undefined;

function syncToProperties() {
  nodeModel.properties.api_input_field_list = inputFieldList.value;
  syncInputFieldList(nodeModel);
}

function openAddDialog(row?: any, index?: any) {
  if (index !== undefined) {
    currentIndex.value = index;
  }
  apiFieldFormDialogRef.value?.open(row);
}

function deleteField(index: any) {
  inputFieldList.value.splice(index, 1);
  syncToProperties();
  emitGraphEvent(props.nodeModel, 'refreshFieldList');
  nextTick(onDragHandle);
}

function refreshFieldList(data: any) {
  for (let i = 0; i < inputFieldList.value.length; i++) {
    if (
      inputFieldList.value[i].variable === data.variable &&
      (currentIndex.value === null || currentIndex.value !== i)
    ) {
      ElMessage.error(`参数名已存在：${data.variable}`);
      return;
    }
  }
  const arr = normalizeList(nodeModel.properties.user_input_field_list);
  for (const element of arr) {
    if (element?.field === data.variable) {
      ElMessage.error(`参数名已存在：${data.variable}`);
      return;
    }
  }
  if (currentIndex.value === null) {
    inputFieldList.value.push(data);
  } else {
    inputFieldList.value.splice(currentIndex.value, 1, data);
  }
  currentIndex.value = null;
  syncToProperties();
  emitGraphEvent(nodeModel, 'refreshFieldList');
  nextTick(onDragHandle);
}

function onDragHandle() {
  sortable?.destroy();
  sortable = undefined;
  if (!tableRef.value) return;
  const wrapper = tableRef.value.$el as HTMLElement;
  const tbody = wrapper.querySelector(
    '.base-api-field-table .el-table__body-wrapper tbody',
  );
  if (!tbody) return;
  sortable = Sortable.create(tbody as HTMLElement, {
    animation: 150,
    ghostClass: 'base-node-ghost-row',
    onEnd: (evt) => {
      if (evt.oldIndex === undefined || evt.newIndex === undefined) return;
      const items = cloneValue([...inputFieldList.value]);
      const [movedItem] = items.splice(evt.oldIndex, 1);
      if (!movedItem) return;
      items.splice(evt.newIndex, 0, movedItem);
      inputFieldList.value = items;
      syncToProperties();
      emitGraphEvent(nodeModel, 'refreshFieldList');
    },
  });
}

function syncFromProperties() {
  if (!nodeModel.properties) nodeModel.properties = {};
  const properties = nodeModel.properties;
  inputFieldList.value = [];
  if (properties.api_input_field_list) {
    inputFieldList.value.push(...properties.api_input_field_list);
  } else {
    if (properties.input_field_list) {
      properties.input_field_list
        .filter((item: any) => item.assignment_method === 'api_input')
        .forEach((item: any) => {
          inputFieldList.value.push(item);
        });
    }
  }
  properties.api_input_field_list = inputFieldList.value;
  nextTick(onDragHandle);
}

onMounted(syncFromProperties);

watch(() => props.renderVersion, syncFromProperties);

onBeforeUnmount(() => {
  sortable?.destroy();
});
</script>

<template>
  <section class="base-field-section">
    <div class="base-field-section__head">
      <h5>接口传参</h5>
      <ElButton link size="small" type="primary" @click="openAddDialog()">
        <ElIcon><Plus /></ElIcon>
        添加
      </ElButton>
    </div>
    <ElTable
      v-if="inputFieldList.length > 0"
      ref="tableRef"
      :data="inputFieldList"
      class="base-api-field-table"
      row-key="variable"
      size="small"
    >
      <ElTableColumn label="字段" prop="variable">
        <template #default="{ row }">
          <span class="base-cell-ellipsis" :title="row.variable">{{
            row.variable
          }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="描述" prop="desc">
        <template #default="{ row }">
          <span class="base-cell-ellipsis" :title="row.desc">{{
            row.desc
          }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="默认值" prop="default_value">
        <template #default="{ row }">
          <span class="base-cell-ellipsis" :title="row.default_value">{{
            row.default_value
          }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="必填" width="64">
        <template #default="{ row }">
          <ElSwitch :model-value="!!row.is_required" disabled size="small" />
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="96">
        <template #default="{ row, $index }">
          <ElButton
            size="small"
            text
            type="primary"
            @click.stop="openAddDialog(row, $index)"
          >
            <ElIcon><EditPen /></ElIcon>
          </ElButton>
          <ElButton
            size="small"
            text
            type="danger"
            @click.stop="deleteField($index)"
          >
            <ElIcon><Delete /></ElIcon>
          </ElButton>
        </template>
      </ElTableColumn>
    </ElTable>
    <div v-else class="base-field-section__empty">暂无接口参数</div>
    <ApiFieldFormDialog
      ref="apiFieldFormDialogRef"
      @refresh="refreshFieldList"
    />
  </section>
</template>

<style scoped lang="scss">
.base-field-section {
  display: grid;
  gap: 4px;
}

.base-field-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.base-field-section__head h5 {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  color: var(--el-text-color-secondary);
}

.base-cell-ellipsis {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.base-field-section__empty {
  padding: 2px 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--el-text-color-placeholder);
}

.base-field-section :deep(.el-table__cell) {
  padding: 2px 0;
}

.base-field-section :deep(.el-button.is-text) {
  padding: 4px;
}
</style>
