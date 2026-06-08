<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import { onBeforeUnmount, onMounted, ref } from 'vue';

import { ElForm, ElFormItem } from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

import { syncNodeProperties } from '../../common/node-inline-update';
import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';

type DocumentExtractNodeData = Record<string, unknown> & {
  document_list: unknown[];
};

const props = defineProps<{ nodeModel: any }>();
const nodeModel = props.nodeModel;

const defaultNodeData: DocumentExtractNodeData = {
  document_list: ['start-node', 'document'],
};

const formRef = ref<FormInstance>();
const documentCascaderRef = ref<InstanceType<typeof NodeCascader>>();
const formData = ref<DocumentExtractNodeData>(
  normalizeNodeData(nodeModel.properties?.node_data),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeNodeData(value: unknown): DocumentExtractNodeData {
  const source = isRecord(value) ? cloneDeep(value) : {};
  return {
    ...source,
    document_list: Array.isArray(source.document_list)
      ? cloneDeep(source.document_list)
      : cloneDeep(defaultNodeData.document_list),
  };
}

function hasReferenceValue(value: unknown) {
  return Array.isArray(value) && value.length >= 2;
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

function patchDocumentList(value: unknown[]) {
  formData.value.document_list = value || [];
  syncNodeData();
}

async function validate() {
  try {
    if (!hasReferenceValue(formData.value.document_list)) {
      throw validationError('请选择文档变量');
    }
    await formRef.value?.validate();
    await documentCascaderRef.value?.validate();
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
          label="选择文档"
          prop="document_list"
          :rules="{
            required: true,
            message: '请选择文档变量',
            trigger: 'change',
            type: 'array',
          }"
        >
          <NodeCascader
            ref="documentCascaderRef"
            :node-model="nodeModel"
            :model-value="formData.document_list"
            class="w-full"
            placeholder="请选择文档变量"
            @update:model-value="patchDocumentList"
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
