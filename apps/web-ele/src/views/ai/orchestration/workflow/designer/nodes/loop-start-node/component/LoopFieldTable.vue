<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { Delete, Edit, Plus } from '@element-plus/icons-vue';
import {
  ElButton,
  ElIcon,
  ElMessage,
  ElTable,
  ElTableColumn,
  ElTooltip,
} from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

import LoopFieldDialog from './LoopFieldDialog.vue';

type LoopField = {
  field: string;
  label: string;
  type?: string;
  value?: string;
};

const props = defineProps<{ nodeModel: any }>();

const loopFieldDialogRef = ref<InstanceType<typeof LoopFieldDialog>>();
const inputFieldList = ref<LoopField[]>([]);

function sourceFields() {
  const nodeData = props.nodeModel.properties?.node_data || {};
  const fields = resolveSourceFields(nodeData);
  return fields.map((field: LoopField) => normalizeField(field));
}

function resolveSourceFields(nodeData: Record<string, any>) {
  if (Array.isArray(props.nodeModel.properties?.loop_input_field_list)) {
    return props.nodeModel.properties.loop_input_field_list;
  }
  if (Array.isArray(nodeData.loop_input_field_list)) {
    return nodeData.loop_input_field_list;
  }
  return [];
}

function normalizeField(field: LoopField): LoopField {
  const value = `${field.field || field.value || ''}`.trim();
  return {
    field: value,
    label: `${field.label || value}`,
    type: field.type || (value === 'index' ? 'number' : 'string'),
    value,
  };
}

function emitInlineUpdate(fields: string[]) {
  props.nodeModel.graphModel?.eventCenter?.emit?.('node:inline-update', {
    fields,
    id: props.nodeModel.id,
    properties: props.nodeModel.properties,
    source: 'vue-node',
  });
}

function syncFieldList() {
  const normalized = inputFieldList.value.map((field) => normalizeField(field));
  inputFieldList.value = normalized;
  set(
    props.nodeModel.properties,
    'loop_input_field_list',
    cloneDeep(normalized),
  );
  props.nodeModel.graphModel?.refresh_loop_fields?.(cloneDeep(normalized));
  props.nodeModel.clear_next_node_field?.(true);
  props.nodeModel.refreshVueComponent?.();
  emitInlineUpdate(['loop_input_field_list']);
}

function openAddDialog(data?: LoopField, index?: number) {
  loopFieldDialogRef.value?.open(data ? cloneDeep(data) : undefined, index);
}

function deleteField(index: number) {
  inputFieldList.value.splice(index, 1);
  syncFieldList();
}

function refreshFieldList(data: LoopField, index?: number) {
  const normalized = normalizeField(data);
  const duplicate = inputFieldList.value.some(
    (item, itemIndex) => item.field === normalized.field && itemIndex !== index,
  );
  if (duplicate) {
    ElMessage.error(`参数重复: ${normalized.field}`);
    return;
  }
  if (index === undefined) inputFieldList.value.push(normalized);
  else inputFieldList.value.splice(index, 1, normalized);
  syncFieldList();
  loopFieldDialogRef.value?.close();
}

onMounted(() => {
  inputFieldList.value = cloneDeep(sourceFields());
  syncFieldList();
});
</script>

<template>
  <div class="loop-field-table__head">
    <h5>循环变量</h5>
    <ElButton link type="primary" @click="openAddDialog()">
      <ElIcon class="mr-4"><Plus /></ElIcon>
      添加
    </ElButton>
  </div>
  <ElTable
    v-if="inputFieldList.length > 0"
    :data="inputFieldList"
    class="mb-16"
    row-key="field"
  >
    <ElTableColumn prop="field" label="字段" width="95">
      <template #default="{ row }">
        <span :title="row.field" class="ellipsis-1">{{ row.field }}</span>
      </template>
    </ElTableColumn>
    <ElTableColumn prop="label" label="名称">
      <template #default="{ row }">
        <span :title="row.label" class="ellipsis-1">{{ row.label }}</span>
      </template>
    </ElTableColumn>
    <ElTableColumn label="操作" align="left" width="90">
      <template #default="{ row, $index }">
        <ElTooltip content="修改" placement="top">
          <ElButton
            type="primary"
            text
            @click.stop="openAddDialog(row, Number($index))"
          >
            <ElIcon><Edit /></ElIcon>
          </ElButton>
        </ElTooltip>
        <ElTooltip content="删除" placement="top">
          <ElButton type="primary" text @click="deleteField(Number($index))">
            <ElIcon><Delete /></ElIcon>
          </ElButton>
        </ElTooltip>
      </template>
    </ElTableColumn>
  </ElTable>
  <LoopFieldDialog ref="loopFieldDialogRef" @refresh="refreshFieldList" />
</template>

<style scoped lang="scss">
.loop-field-table__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.loop-field-table__head h5 {
  max-width: 80%;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.ellipsis-1 {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mb-16 {
  margin-bottom: 16px;
}

.mr-4 {
  margin-right: 4px;
}
</style>
