<script setup lang="ts">
import { ref } from 'vue';

import {
  ElButton,
  ElDialog,
  ElEmpty,
  ElMessage,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';

import { getModelParamsForm, updateModelParamsForm } from '#/api/ai/models';
import { input_type_list } from '#/components/dynamics-form/constructor/data';

import AddParamDrawer from './AddParamDrawer.vue';

defineOptions({ name: 'ParamSettingDialog' });

interface ModelRecord {
  id: number | string;
  name?: string;
  displayName?: string;
}

interface ParamField {
  default_value?: any;
  field?: string;
  input_type?: string;
  label?: any;
  required?: boolean;
}

const loading = ref(false);
const dialogVisible = ref(false);
const paramsForm = ref<ParamField[]>([]);
const addParamRef = ref<InstanceType<typeof AddParamDrawer>>();
const currentModel = ref<ModelRecord | null>(null);

function fieldLabel(field: ParamField): string {
  if (!field.label) return '';
  if (
    typeof field.label === 'object' &&
    field.label.input_type === 'TooltipLabel'
  ) {
    return field.label.label ?? '';
  }
  return String(field.label);
}

function fieldTypeTag(field: ParamField): string {
  const found = input_type_list.find((item) => item.value === field.input_type);
  return found?.label ?? field.input_type ?? '';
}

function open(model: ModelRecord) {
  currentModel.value = model;
  dialogVisible.value = true;
  loading.value = true;
  getModelParamsForm(model.id)
    .then((res: any) => {
      paramsForm.value = Array.isArray(res) ? res : (res?.data ?? []);
    })
    .catch(() => {
      paramsForm.value = [];
    })
    .finally(() => {
      loading.value = false;
    });
}

function close() {
  dialogVisible.value = false;
}

function openAddDrawer(data?: ParamField, index?: number) {
  addParamRef.value?.open(data, index);
}

function deleteParam(index: number) {
  paramsForm.value.splice(index, 1);
}

function refresh(data: ParamField, index: null | number) {
  for (let i = 0; i < paramsForm.value.length; i++) {
    const existingField = paramsForm.value[i].field ?? '';
    let existingLabel: string = '';
    const rawExistingLabel = paramsForm.value[i].label;
    if (
      rawExistingLabel &&
      typeof rawExistingLabel === 'object' &&
      rawExistingLabel.input_type === 'TooltipLabel'
    ) {
      existingLabel = rawExistingLabel.label ?? '';
    } else if (rawExistingLabel) {
      existingLabel = String(rawExistingLabel);
    }
    let newLabel: string = '';
    const rawNewLabel = data.label;
    if (
      rawNewLabel &&
      typeof rawNewLabel === 'object' &&
      (rawNewLabel as any).input_type === 'TooltipLabel'
    ) {
      newLabel = (rawNewLabel as any).label ?? '';
    } else if (rawNewLabel) {
      newLabel = String(rawNewLabel);
    }
    if (existingField === data.field && index !== i) {
      ElMessage.error(`字段已存在: ${data.field}`);
      return;
    }
    if (existingLabel === newLabel && index !== i) {
      ElMessage.error(`名称已存在: ${newLabel}`);
      return;
    }
  }
  if (index === null) {
    paramsForm.value.push(data);
  } else {
    paramsForm.value.splice(index, 1, data);
  }
}

function submit() {
  if (!currentModel.value) return;
  loading.value = true;
  updateModelParamsForm(currentModel.value.id, paramsForm.value as any[])
    .then(() => {
      ElMessage.success('参数表单已保存');
      close();
    })
    .finally(() => {
      loading.value = false;
    });
}

defineExpose({ open, close });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    title="参数设置"
    width="800px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :destroy-on-close="true"
    :before-close="close"
  >
    <div v-loading="loading">
      <ElButton type="primary" class="mb-12" @click="openAddDrawer()">
        新增参数
      </ElButton>
      <ElTable :data="paramsForm" class="mb-16">
        <ElTableColumn prop="label" label="名称" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ fieldLabel(row) }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="field" label="字段" show-overflow-tooltip />
        <ElTableColumn label="控件类型" width="120">
          <template #default="{ row }">
            <ElTag size="small" type="info">{{ fieldTypeTag(row) }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="default_value"
          label="默认值"
          show-overflow-tooltip
        />
        <ElTableColumn label="必填" width="80">
          <template #default="{ row }">
            <ElSwitch disabled size="small" :model-value="row.required" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" align="left" width="100">
          <template #default="{ row, $index }">
            <ElButton
              type="primary"
              text
              @click.stop="openAddDrawer(row, $index)"
            >
              编辑
            </ElButton>
            <ElButton type="primary" text @click="deleteParam($index)">
              删除
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
      <ElEmpty v-if="paramsForm.length === 0" description="暂无参数" />
    </div>
    <template #footer>
      <ElButton @click="close">取消</ElButton>
      <ElButton :loading="loading" type="primary" @click="submit">
        保存
      </ElButton>
    </template>
    <AddParamDrawer ref="addParamRef" @refresh="refresh" />
  </ElDialog>
</template>

<style scoped lang="scss">
.mb-12 {
  margin-bottom: 12px;
}

.mb-16 {
  margin-bottom: 16px;
}
</style>
