<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

import { Delete, EditPen, Plus } from '@element-plus/icons-vue';
import {
  ElButton,
  ElIcon,
  ElMessage,
  ElTable,
  ElTableColumn,
} from 'element-plus';

import { cloneValue, emitGraphEvent } from './base-node-utils';
import ChatFieldDialog from './ChatFieldDialog.vue';

const props = defineProps<{ nodeModel: any; renderVersion?: number }>();
const nodeModel = props.nodeModel;

const chatFieldDialogRef = ref<InstanceType<typeof ChatFieldDialog>>();
const inputFieldList = ref<any[]>([]);

function openAddDialog(row?: any, index?: any) {
  chatFieldDialogRef.value?.open(row, index);
}

function syncToProperties() {
  nodeModel.properties.chat_input_field_list = inputFieldList.value;
}

function deleteField(index: any) {
  inputFieldList.value.splice(index, 1);
  syncToProperties();
  emitGraphEvent(nodeModel, 'chatFieldList');
}

function refreshFieldList(data: any, index: any) {
  for (let i = 0; i < inputFieldList.value.length; i++) {
    if (
      inputFieldList.value[i].field === data.field &&
      (index === null || index === undefined || index !== i)
    ) {
      ElMessage.error(`变量名已存在：${data.field}`);
      return;
    }
  }
  if ([null, undefined].includes(index)) {
    inputFieldList.value.push(data);
  } else {
    inputFieldList.value.splice(index, 1, data);
  }
  syncToProperties();
  emitGraphEvent(nodeModel, 'chatFieldList');
}

function syncFromProperties() {
  if (!nodeModel.properties) nodeModel.properties = {};
  inputFieldList.value =
    cloneValue(nodeModel.properties.chat_input_field_list) || [];
  nodeModel.properties.chat_input_field_list = inputFieldList.value;
}

onMounted(syncFromProperties);

watch(() => props.renderVersion, syncFromProperties);
</script>

<template>
  <section class="base-field-section">
    <div class="base-field-section__head">
      <h5>会话变量</h5>
      <ElButton link size="small" type="primary" @click="openAddDialog()">
        <ElIcon><Plus /></ElIcon>
        添加
      </ElButton>
    </div>
    <ElTable
      v-if="inputFieldList.length > 0"
      :data="inputFieldList"
      row-key="field"
      size="small"
    >
      <ElTableColumn label="字段" prop="field" width="140">
        <template #default="{ row }">
          <span class="base-cell-ellipsis" :title="row.field">{{
            row.field
          }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="名称" prop="label">
        <template #default="{ row }">
          <span class="base-cell-ellipsis" :title="row.label">{{
            row.label
          }}</span>
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
    <div v-else class="base-field-section__empty">暂无会话变量</div>
    <ChatFieldDialog ref="chatFieldDialogRef" @refresh="refreshFieldList" />
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
