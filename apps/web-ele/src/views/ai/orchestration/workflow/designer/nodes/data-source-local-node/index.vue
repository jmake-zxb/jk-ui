<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import { onBeforeUnmount, onMounted, ref } from 'vue';

import {
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElOption,
  ElSelect,
} from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

import { syncNodeProperties } from '../../common/node-inline-update';
import NodeContainer from '../../common/NodeContainer.vue';

type DataSourceLocalNodeData = Record<string, unknown> & {
  content?: string;
  file_count_limit: number;
  file_size_limit: number;
  file_type_list: string[];
};

const props = defineProps<{ nodeModel: any }>();
const nodeModel = props.nodeModel;

const fileTypeOptions = [
  'TXT',
  'DOCX',
  'PDF',
  'HTML',
  'XLS',
  'XLSX',
  'ZIP',
  'CSV',
  'MD',
];
const defaultNodeData: DataSourceLocalNodeData = {
  content: '{{input}}',
  file_count_limit: 50,
  file_size_limit: 100,
  file_type_list: cloneDeep(fileTypeOptions),
};

const formRef = ref<FormInstance>();
const formData = ref<DataSourceLocalNodeData>(
  normalizeNodeData(nodeModel.properties?.node_data),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeNodeData(value: unknown): DataSourceLocalNodeData {
  const source = isRecord(value) ? cloneDeep(value) : {};
  return {
    ...source,
    content:
      typeof source.content === 'string'
        ? source.content
        : defaultNodeData.content,
    file_count_limit: numberValue(
      source.file_count_limit,
      defaultNodeData.file_count_limit,
    ),
    file_size_limit: numberValue(
      source.file_size_limit,
      defaultNodeData.file_size_limit,
    ),
    file_type_list: Array.isArray(source.file_type_list)
      ? source.file_type_list.map((item) => `${item}`).filter(Boolean)
      : cloneDeep(defaultNodeData.file_type_list),
  };
}

function validationError(errMessage: string) {
  return Object.assign(new Error(errMessage), {
    errMessage,
    node: nodeModel,
  });
}

function syncNodeData() {
  syncNodeProperties(nodeModel, { node_data: cloneDeep(formData.value) }, [
    'node_data',
  ]);
}

function patchData(key: keyof DataSourceLocalNodeData, value: unknown) {
  set(formData.value, key, cloneDeep(value));
  syncNodeData();
}

async function validate() {
  try {
    if (formData.value.file_type_list.length === 0) {
      throw validationError('请选择文件格式');
    }
    if (formData.value.file_count_limit < 1) {
      throw validationError('最大文件数量必须大于 0');
    }
    if (formData.value.file_size_limit < 1) {
      throw validationError('单文件大小必须大于 0');
    }
    await formRef.value?.validate();
  } catch (error) {
    if (error instanceof Error && 'node' in error) throw error;
    throw Object.assign(new Error(`${error || ''}`), {
      errMessage: error,
      node: nodeModel,
    });
  }
}

onMounted(() => {
  syncNodeData();
  set(nodeModel, 'validate', validate);
});

onBeforeUnmount(() => {
  if (nodeModel.validate === validate) {
    set(nodeModel, 'validate', undefined);
  }
});
</script>

<template>
  <NodeContainer :node-model="nodeModel">
    <ElForm
      ref="formRef"
      :model="formData"
      label-position="top"
      @submit.prevent
    >
      <div class="workflow-node-panel">
        <div class="workflow-node-panel__head">节点设置</div>
        <ElFormItem
          label="文件格式"
          prop="file_type_list"
          :rules="{
            required: true,
            message: '请选择文件格式',
            trigger: 'change',
            type: 'array',
          }"
        >
          <ElSelect
            :model-value="formData.file_type_list"
            :teleported="false"
            allow-create
            clearable
            default-first-option
            filterable
            multiple
            placeholder="请选择或输入文件格式"
            @update:model-value="patchData('file_type_list', $event)"
          >
            <ElOption
              v-for="item in fileTypeOptions"
              :key="item"
              :label="item"
              :value="item"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem
          label="最大文件数量"
          prop="file_count_limit"
          :rules="{
            required: true,
            message: '请输入最大文件数量',
            trigger: 'change',
          }"
        >
          <ElInputNumber
            :model-value="formData.file_count_limit"
            :min="1"
            :max="1000"
            :step="1"
            :step-strictly="true"
            controls-position="right"
            class="w-full"
            @update:model-value="patchData('file_count_limit', $event || 0)"
          />
        </ElFormItem>
        <ElFormItem
          label="单文件大小限制 MB"
          prop="file_size_limit"
          :rules="{
            required: true,
            message: '请输入单文件大小限制',
            trigger: 'change',
          }"
        >
          <ElInputNumber
            :model-value="formData.file_size_limit"
            :min="1"
            :max="1000"
            :step="1"
            :step-strictly="true"
            controls-position="right"
            class="w-full"
            @update:model-value="patchData('file_size_limit', $event || 0)"
          />
        </ElFormItem>
        <ElFormItem label="本地内容">
          <ElInput
            :model-value="formData.content"
            type="textarea"
            :rows="3"
            placeholder="固定内容或 {{变量}}"
            @update:model-value="patchData('content', $event)"
          />
        </ElFormItem>
      </div>
    </ElForm>
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-node-panel {
  display: grid;
  gap: 8px;
  padding: 8px;
  overflow: visible;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-node-panel__head {
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.workflow-node-panel :deep(.el-form-item) {
  margin-bottom: 0;
}
</style>
