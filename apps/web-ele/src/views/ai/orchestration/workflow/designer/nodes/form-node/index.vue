<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

import { Delete, EditPen, Plus } from '@element-plus/icons-vue';
import {
  ElButton,
  ElCard,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElMessage,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag,
  ElTooltip,
} from 'element-plus';
import { cloneDeep, set } from 'lodash-es';
import Sortable from 'sortablejs';

import NodeContainer from '../../common/NodeContainer.vue';
import FormFieldDialog from './component/FormFieldDialog.vue';

type FormField = Record<string, any> & {
  default_value?: any;
  field?: string;
  input_type?: string;
  label?: string | { label?: string };
  option_list?: Array<{ label?: string; value?: string }>;
  required?: boolean;
  visibility_rules?: {
    action?: string;
    condition?: string;
    conditions?: Array<Record<string, any>>;
  };
};

type FormNodeData = {
  form_content_format: string;
  form_field_list: FormField[];
  is_result: boolean;
};

const props = defineProps<{
  nodeModel: any;
}>();
const nodeModel = props.nodeModel;

const defaultFormContent =
  '你好，请先填写下面表单内容：\n{{form}}\n填写后请点击【提交】按钮进行提交。';
const inputTypeList = [
  { label: '文本', value: 'TextInput' },
  { label: '多行文本', value: 'TextareaInput' },
  { label: 'JSON', value: 'JsonInput' },
  { label: '密码', value: 'PasswordInput' },
  { label: '单选下拉', value: 'SingleSelect' },
  { label: '多选下拉', value: 'MultiSelect' },
  { label: '单选卡片', value: 'RadioCard' },
  { label: '单选行', value: 'RadioRow' },
  { label: '多行输入', value: 'MultiRow' },
  { label: '滑块', value: 'Slider' },
  { label: '开关', value: 'SwitchInput' },
  { label: '日期', value: 'DatePicker' },
  { label: '上传', value: 'UploadInput' },
  { label: '模型', value: 'Model' },
  { label: '知识库', value: 'Knowledge' },
  { label: '树选择', value: 'TreeSelect' },
];

const formNodeFormRef = ref<FormInstance>();
const tableRef = ref();
const fieldDialogRef = ref<InstanceType<typeof FormFieldDialog>>();
const formData = ref<FormNodeData>(readNodeData());
let sortable: Sortable | undefined;

function labelText(field: FormField) {
  if (typeof field.label === 'string') return field.label;
  if (field.label?.label) return field.label.label;
  return field.field || '';
}

function inputTypeLabel(value?: string) {
  return (
    inputTypeList.find((item) => item.value === value)?.label || value || '文本'
  );
}

function normalizeLegacyField(field: FormField): FormField {
  return {
    ...cloneDeep(field),
    field: field.field || field.key || field.variable || '',
    input_type: field.input_type || field.type || 'TextInput',
    label: field.label || field.name || field.field || '',
    required:
      field.required === undefined ? !!field.is_required : !!field.required,
  };
}

function readNodeData(): FormNodeData {
  const source = nodeModel.properties?.node_data || {};
  let sourceFields: FormField[] = [];
  if (Array.isArray(source.form_field_list)) {
    sourceFields = source.form_field_list;
  } else if (Array.isArray(source.fields)) {
    sourceFields = source.fields;
  }
  const normalized = {
    ...cloneDeep(source),
    form_content_format: source.form_content_format || defaultFormContent,
    form_field_list: sourceFields.map((field: FormField) =>
      normalizeLegacyField(field),
    ),
    is_result: source.is_result === undefined ? true : !!source.is_result,
  } as FormNodeData;
  set(nodeModel.properties, 'node_data', cloneDeep(normalized));
  return normalized;
}

function outputFields(fields = formData.value.form_field_list) {
  return [
    { label: '表单全部内容', name: 'form_data', value: 'form_data' },
    ...fields
      .map((field) => ({
        label: labelText(field),
        name: field.field || '',
        value: field.field || '',
      }))
      .filter((field) => field.value),
  ];
}

function emitInlineUpdate(fields = ['node_data', 'config']) {
  nodeModel.graphModel?.eventCenter?.emit?.('node:inline-update', {
    fields,
    id: nodeModel.id,
    properties: nodeModel.properties,
    source: 'form-node',
  });
}

function syncNodeProperties(options: { refreshSortable?: boolean } = {}) {
  if (!nodeModel.properties) nodeModel.properties = {};
  if (!nodeModel.properties.config) nodeModel.properties.config = {};
  set(nodeModel.properties, 'node_data', cloneDeep(formData.value));
  set(nodeModel.properties.config, 'fields', outputFields());
  nodeModel.clear_next_node_field?.(false);
  emitInlineUpdate(['node_data', 'config']);
  if (options.refreshSortable) nextTick(initSortable);
}

function updateFormContent(value: string) {
  formData.value.form_content_format = value;
  syncNodeProperties();
}

function openAddDialog() {
  fieldDialogRef.value?.open(undefined, null);
}

function openEditDialog(row: FormField, index: number) {
  fieldDialogRef.value?.open(cloneDeep(row), index);
}

function upsertField(field: FormField, index: null | number) {
  const fieldName = `${field.field || ''}`.trim();
  if (!fieldName) {
    ElMessage.error('字段不能为空');
    return;
  }
  const exists = formData.value.form_field_list.some(
    (item, itemIndex) => item.field === fieldName && itemIndex !== index,
  );
  if (exists) {
    ElMessage.error(`字段已存在：${fieldName}`);
    return;
  }
  const nextField = { ...cloneDeep(field), field: fieldName };
  if (index === null) {
    formData.value.form_field_list.push(nextField);
  } else {
    formData.value.form_field_list.splice(index, 1, nextField);
  }
  syncNodeProperties({ refreshSortable: true });
}

function deleteField(index: number) {
  formData.value.form_field_list.splice(index, 1);
  syncNodeProperties({ refreshSortable: true });
}

function defaultValueLabel(field: FormField) {
  if (field.input_type === 'PasswordInput')
    return field.default_value ? '******' : '';
  if (Array.isArray(field.default_value)) {
    return field.default_value
      .map(
        (value) =>
          field.option_list?.find((item) => item.value === value)?.label ||
          value,
      )
      .join(', ');
  }
  const optionLabel = field.option_list?.find(
    (item) => item.value === field.default_value,
  )?.label;
  if (optionLabel) return optionLabel;
  if (field.default_value === undefined || field.default_value === null)
    return '';
  if (typeof field.default_value === 'object')
    return JSON.stringify(field.default_value);
  return `${field.default_value}`;
}

function initSortable() {
  sortable?.destroy();
  sortable = undefined;
  if (!tableRef.value) return;
  const wrapper = tableRef.value.$el as HTMLElement;
  const tbody = wrapper.querySelector(
    '.form-node-field-table .el-table__body-wrapper tbody',
  );
  if (!tbody) return;
  sortable = Sortable.create(tbody as HTMLElement, {
    animation: 150,
    ghostClass: 'form-node-ghost-row',
    onEnd: (event) => {
      if (event.oldIndex === undefined || event.newIndex === undefined) return;
      const items = cloneDeep(formData.value.form_field_list);
      const [movedItem] = items.splice(event.oldIndex, 1);
      if (!movedItem) return;
      items.splice(event.newIndex, 0, movedItem);
      formData.value.form_field_list = items;
      syncNodeProperties({ refreshSortable: true });
    },
  });
}

async function validate() {
  try {
    await formNodeFormRef.value?.validate();
    const errors: string[] = [];
    const names = formData.value.form_field_list.map((field) =>
      `${field.field || ''}`.trim(),
    );
    if (names.some((name) => !name)) errors.push('字段不能为空');
    if (new Set(names).size !== names.length) errors.push('字段不能重复');
    if (errors.length > 0) throw new Error(errors[0]);
  } catch (error) {
    throw Object.assign(new Error(`${error || ''}`), {
      errMessage: error,
      node: nodeModel,
    });
  }
}

onMounted(() => {
  set(nodeModel, 'validate', validate);
  syncNodeProperties({ refreshSortable: true });
});

onBeforeUnmount(() => {
  sortable?.destroy();
});
</script>

<template>
  <NodeContainer :node-model="nodeModel">
    <h5 class="form-node-title">节点设置</h5>
    <ElCard shadow="never" class="form-node-card card-never">
      <ElForm
        ref="formNodeFormRef"
        :model="formData"
        label-position="top"
        label-width="auto"
        require-asterisk-position="right"
        hide-required-asterisk
        @submit.prevent
      >
        <ElFormItem
          label="表单输出内容"
          prop="form_content_format"
          :rules="{
            required: true,
            message: '请输入表单输出内容',
            trigger: 'blur',
          }"
        >
          <ElInput
            :model-value="formData.form_content_format"
            type="textarea"
            :rows="6"
            placeholder="请输入表单提交前展示给用户的内容，使用 {{form}} 插入表单"
            @update:model-value="updateFormContent"
          />
        </ElFormItem>
        <ElFormItem label="表单设置" @click.prevent>
          <template #label>
            <div class="form-node-section-head">
              <h5>表单设置</h5>
              <ElButton link size="small" type="primary" @click="openAddDialog">
                <ElIcon class="form-node-icon"><Plus /></ElIcon>
                添加
              </ElButton>
            </div>
          </template>
          <ElTable
            v-if="formData.form_field_list.length > 0"
            ref="tableRef"
            :data="formData.form_field_list"
            class="form-node-field-table border"
            row-key="field"
            size="small"
          >
            <ElTableColumn label="字段" prop="field" width="95">
              <template #default="{ row }">
                <span class="form-node-cell-ellipsis" :title="row.field">{{
                  row.field
                }}</span>
              </template>
            </ElTableColumn>
            <ElTableColumn label="名称" prop="label">
              <template #default="{ row }">
                <span class="form-node-cell-ellipsis" :title="labelText(row)">{{
                  labelText(row)
                }}</span>
              </template>
            </ElTableColumn>
            <ElTableColumn label="类型" width="110">
              <template #default="{ row }">
                <ElTag size="small" type="info">
                  {{ inputTypeLabel(row.input_type) }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="默认值" prop="default_value">
              <template #default="{ row }">
                <span
                  class="form-node-cell-ellipsis"
                  :title="defaultValueLabel(row)"
                >
                  {{ defaultValueLabel(row) }}
                </span>
              </template>
            </ElTableColumn>
            <ElTableColumn label="必填" width="64">
              <template #default="{ row }">
                <ElSwitch :model-value="!!row.required" disabled size="small" />
              </template>
            </ElTableColumn>
            <ElTableColumn label="操作" width="96">
              <template #default="{ row, $index }">
                <ElTooltip content="编辑" placement="top">
                  <ElButton
                    size="small"
                    text
                    type="primary"
                    @click.stop="openEditDialog(row, $index)"
                  >
                    <ElIcon><EditPen /></ElIcon>
                  </ElButton>
                </ElTooltip>
                <ElTooltip content="删除" placement="top">
                  <ElButton
                    size="small"
                    text
                    type="danger"
                    @click.stop="deleteField($index)"
                  >
                    <ElIcon><Delete /></ElIcon>
                  </ElButton>
                </ElTooltip>
              </template>
            </ElTableColumn>
          </ElTable>
          <div v-else class="form-node-empty">暂无表单字段</div>
        </ElFormItem>
      </ElForm>
    </ElCard>
    <FormFieldDialog
      ref="fieldDialogRef"
      :current-node-fields="formData.form_field_list"
      :node-model="nodeModel"
      @refresh="upsertField"
    />
  </NodeContainer>
</template>

<style scoped lang="scss">
.form-node-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
  color: var(--el-text-color-primary);
}

.form-node-card {
  --el-card-padding: 12px;

  overflow: visible;
}

.form-node-card :deep(.el-card__body) {
  overflow: visible;
}

.form-node-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.form-node-section-head h5 {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  color: var(--el-text-color-secondary);
}

.form-node-icon {
  margin-right: 4px;
}

.form-node-cell-ellipsis {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.form-node-empty {
  padding: 2px 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--el-text-color-placeholder);
}

.form-node-field-table :deep(.el-table__cell) {
  padding: 2px 0;
}

.form-node-field-table :deep(.el-button.is-text) {
  padding: 4px;
}

.form-node-ghost-row {
  opacity: 0.45;
}
</style>
