<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { Delete, EditPen, Plus, Setting } from '@element-plus/icons-vue';
import {
  ElButton,
  ElIcon,
  ElMessage,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag,
  ElTooltip,
} from 'element-plus';
import Sortable from 'sortablejs';

import {
  cloneValue,
  defaultValueLabel,
  emitGraphEvent,
  exposedInputTypes,
  fieldLabel,
  inputTypeLabel,
  normalizeList,
  syncInputFieldList,
} from './base-node-utils';
import UserFieldFormDialog from './UserFieldFormDialog.vue';
import UserInputTitleDialog from './UserInputTitleDialog.vue';

const props = defineProps<{ nodeModel: any; renderVersion?: number }>();
const nodeModel = props.nodeModel;

const tableRef = ref<any>();
const userFieldFormDialogRef = ref<InstanceType<typeof UserFieldFormDialog>>();
const userInputTitleDialogRef =
  ref<InstanceType<typeof UserInputTitleDialog>>();
const inputFieldList = ref<any[]>([]);
const inputFieldConfig = ref({ title: '用户输入' });
let sortable: ReturnType<typeof Sortable.create> | undefined;

function syncToProperties() {
  nodeModel.properties.user_input_field_list = inputFieldList.value;
  nodeModel.properties.user_input_config = inputFieldConfig.value;
  syncInputFieldList(nodeModel);
}

function openAddDialog(data?: any, index?: any) {
  userFieldFormDialogRef.value?.open(data, index);
}

function removeFromExposed(fieldName: string) {
  const setting = nodeModel.properties?.user_input_field_list_setting;
  if (!setting?.exposed_fields?.includes(fieldName)) return;
  nodeModel.properties.user_input_field_list_setting = {
    ...setting,
    exposed_fields: setting.exposed_fields.filter(
      (field: string) => field !== fieldName,
    ),
  };
}

function deleteField(index: any) {
  const removed = inputFieldList.value[index];
  if (removed?.field) removeFromExposed(removed.field);
  inputFieldList.value.splice(index, 1);
  syncToProperties();
  emitGraphEvent(nodeModel, 'refreshFieldList');
  nextTick(onDragHandle);
}

function refreshFieldList(data: any, index: any) {
  for (let i = 0; i < inputFieldList.value.length; i++) {
    if (
      inputFieldList.value[i].field === data.field &&
      (index === null || index === undefined || index !== i)
    ) {
      ElMessage.error(`参数名已存在：${data.field}`);
      return;
    }
  }
  const arr = normalizeList(nodeModel.properties.api_input_field_list);
  for (const element of arr) {
    if (element?.variable === data.field) {
      ElMessage.error(`参数名已存在：${data.field}`);
      return;
    }
  }
  if (index === null) {
    inputFieldList.value.push(data);
  } else {
    inputFieldList.value.splice(index, 1, data);
  }
  if (!exposedInputTypes.includes(data.input_type))
    removeFromExposed(data.field);
  syncToProperties();
  emitGraphEvent(nodeModel, 'refreshFieldList');
  nextTick(onDragHandle);
}

function refreshFieldTitle(setting: any) {
  if (setting) {
    inputFieldConfig.value = {
      ...inputFieldConfig.value,
      title: setting.title,
    };
    nodeModel.properties.user_input_field_list_setting = {
      exposed_fields: setting.exposed_fields || [],
      menu_title: setting.menu_title,
    };
  }
  syncToProperties();
  emitGraphEvent(nodeModel, 'refreshFieldList');
}

function openChangeTitleDialog() {
  userInputTitleDialogRef.value?.open(
    inputFieldList.value,
    nodeModel.properties.user_input_field_list_setting,
    nodeModel.properties.user_input_config?.title,
  );
}

function onDragHandle() {
  sortable?.destroy();
  sortable = undefined;
  if (!tableRef.value) return;
  const wrapper = tableRef.value.$el as HTMLElement;
  const tbody = wrapper.querySelector(
    '.base-user-field-table .el-table__body-wrapper tbody',
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

function normalizeLegacyFields() {
  inputFieldList.value.forEach((item) => {
    item.label = item.label || item.name;
    item.field = item.field || item.variable;
    item.required =
      item.required === undefined ? item.is_required : item.required;
    switch (item.type) {
      case 'date': {
        item.input_type = 'DatePicker';
        break;
      }
      case 'input': {
        item.input_type = 'TextInput';
        break;
      }
      case 'select': {
        item.input_type = 'SingleSelect';
        break;
      }
    }
  });
}

function syncFromProperties() {
  if (!nodeModel.properties) nodeModel.properties = {};
  const properties = nodeModel.properties;
  inputFieldList.value = [];
  if (properties.user_input_field_list) {
    inputFieldList.value.push(...properties.user_input_field_list);
  } else {
    if (properties.input_field_list) {
      properties.input_field_list
        .filter((item: any) => item.assignment_method === 'user_input')
        .forEach((item: any) => {
          inputFieldList.value.push(item);
        });
    }
  }
  normalizeLegacyFields();
  properties.user_input_field_list = inputFieldList.value;
  inputFieldConfig.value = properties.user_input_config || {
    title: '用户输入',
  };
  properties.user_input_config = inputFieldConfig.value;
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
      <h5 :title="inputFieldConfig.title">{{ inputFieldConfig.title }}</h5>
      <div class="base-field-section__actions">
        <ElTooltip content="设置" placement="top">
          <ElButton
            size="small"
            text
            type="primary"
            @click="openChangeTitleDialog"
          >
            <ElIcon><Setting /></ElIcon>
          </ElButton>
        </ElTooltip>
        <ElButton link size="small" type="primary" @click="openAddDialog()">
          <ElIcon><Plus /></ElIcon>
          添加
        </ElButton>
      </div>
    </div>
    <ElTable
      v-if="inputFieldList.length > 0"
      ref="tableRef"
      :data="inputFieldList"
      class="base-user-field-table"
      row-key="field"
      size="small"
    >
      <ElTableColumn label="字段" prop="field" width="95">
        <template #default="{ row }">
          <span class="base-cell-ellipsis" :title="row.field">{{
            row.field
          }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="名称" prop="label">
        <template #default="{ row }">
          <span class="base-cell-ellipsis" :title="fieldLabel(row)">{{
            fieldLabel(row)
          }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="类型" width="96">
        <template #default="{ row }">
          <ElTag size="small" type="info">
            {{ inputTypeLabel(row.input_type) }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="默认值">
        <template #default="{ row }">
          <span class="base-cell-ellipsis" :title="defaultValueLabel(row)">{{
            defaultValueLabel(row)
          }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="必填" width="64">
        <template #default="{ row }">
          <ElSwitch :model-value="!!row.required" disabled size="small" />
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
    <div v-else class="base-field-section__empty">暂无用户输入字段</div>
    <UserFieldFormDialog
      ref="userFieldFormDialogRef"
      :current-node-fields="inputFieldList"
      :node-model="nodeModel"
      @refresh="refreshFieldList"
    />
    <UserInputTitleDialog
      ref="userInputTitleDialogRef"
      @refresh="refreshFieldTitle"
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
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.base-field-section__head h5 {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.base-field-section__actions {
  display: flex;
  gap: 4px;
  align-items: center;
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
