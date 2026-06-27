<script setup lang="ts">
import type { FormRules } from 'element-plus';

import type { FormField } from '#/components/dynamics-form/type';

import { computed, provide, ref, watch } from 'vue';

import { ElCard, ElCol, ElFormItem, ElRow } from 'element-plus';

import { getKnowledgeWorkflowFormList } from '#/api/ai/knowledge';
import DynamicsForm from '#/components/dynamics-form/index.vue';
import { WorkflowKind, WorkflowType } from '#/enums/application';
import { nodeTypeIcon } from '#/views/ai/orchestration/workflow/designer/common/node-type-icons';

defineOptions({ name: 'DataSource' });

const props = defineProps<{
  knowledgeId: string;
  loading: boolean;
  workflow: null | Record<string, any>;
}>();

const emit = defineEmits<{
  'update:loading': [value: boolean];
}>();

type WorkflowNode = {
  id?: string;
  properties?: Record<string, any>;
  type?: string;
};

const formFields = ref<FormField[]>([]);
const dynamicsFormRef = ref<InstanceType<typeof DynamicsForm>>();
const baseFormData = ref<{ node_id: string }>({ node_id: '' });
const dynamicFormData = ref<Record<string, any>>({});
const extra = ref<Record<string, any>>({ current_tool_id: undefined });

const formData = computed({
  get: () => ({ ...dynamicFormData.value, ...baseFormData.value }),
  set: (value: Record<string, any>) => {
    dynamicFormData.value = value;
  },
});

const loadingProxy = computed({
  get: () => props.loading,
  set: (value: boolean) => emit('update:loading', value),
});

const sourceNodeList = computed<WorkflowNode[]>(() => {
  const nodes = props.workflow?.nodes;
  if (!Array.isArray(nodes)) return [];
  return nodes.filter((node: WorkflowNode) => {
    const properties = node.properties || {};
    return (
      properties.kind === WorkflowKind.DataSource ||
      node.type === WorkflowType.DataSourceLocalNode ||
      node.type === WorkflowType.DataSourceWebNode
    );
  });
});

const baseFormDataRule = ref<FormRules>({
  node_id: {
    message: '请选择数据源',
    required: true,
    trigger: 'blur',
  },
});

function getExtra() {
  return extra.value;
}

provide('get_extra', getExtra);

function nodeLabel(node: WorkflowNode) {
  return (
    node.properties?.stepName ||
    node.properties?.name ||
    node.id ||
    node.type ||
    '数据源'
  );
}

function nodeIcon(node: WorkflowNode) {
  return nodeTypeIcon(node.type || WorkflowType.DataSourceLocalNode);
}

async function sourceChange(nodeId: string) {
  baseFormData.value.node_id = nodeId;
  const node = sourceNodeList.value.find((item) => item.id === nodeId);
  if (!node) {
    formFields.value = [];
    dynamicFormData.value = {};
    return;
  }

  if (node.properties?.node_data?.tool_lib_id) {
    extra.value.current_tool_id = node.properties.node_data.tool_lib_id;
  }

  const isBuiltinDataSource = [
    WorkflowType.DataSourceLocalNode,
    WorkflowType.DataSourceWebNode,
  ].includes(node.type as WorkflowType);
  const type = isBuiltinDataSource ? 'local' : 'tool';
  const targetId = isBuiltinDataSource
    ? node.type || nodeId
    : `${node.properties?.node_data?.tool_lib_id || nodeId}`;

  loadingProxy.value = true;
  try {
    const fields = (await getKnowledgeWorkflowFormList(
      props.knowledgeId,
      type,
      targetId,
      {
        node,
      },
    )) as FormField[];
    formFields.value = Array.isArray(fields) ? fields : [];
    dynamicsFormRef.value?.render(formFields.value, formData.value);
  } finally {
    loadingProxy.value = false;
  }
}

function validate() {
  return dynamicsFormRef.value?.validate();
}

function getData() {
  return formData.value;
}

watch(
  sourceNodeList,
  () => {
    if (!baseFormData.value.node_id && sourceNodeList.value.length > 0) {
      sourceChange(`${sourceNodeList.value[0]?.id || ''}`);
    }
  },
  { immediate: true },
);

defineExpose({ get_data: getData, validate });
</script>

<template>
  <DynamicsForm
    ref="dynamicsFormRef"
    v-model="formData"
    :model="formData"
    :other-params="{ current_knowledge_id: knowledgeId }"
    :render-fields="formFields"
    label-position="top"
    require-asterisk-position="right"
  >
    <template #default>
      <h4 class="title-decoration-1 mb-16 mt-4">选择数据源</h4>
      <ElFormItem
        label="数据源"
        prop="node_id"
        :rules="baseFormDataRule.node_id"
      >
        <ElRow class="w-full" :gutter="8">
          <ElCol v-for="node in sourceNodeList" :key="node.id" :span="8">
            <ElCard
              shadow="never"
              class="card-checkbox cursor data-source-card mb-8 w-full"
              :class="baseFormData.node_id === node.id ? 'border-active' : ''"
              @click="sourceChange(`${node.id || ''}`)"
            >
              <div class="align-center flex">
                <component :is="nodeIcon(node)" class="mr-8" :size="20" />
                <span class="ellipsis">{{ nodeLabel(node) }}</span>
              </div>
            </ElCard>
          </ElCol>
        </ElRow>
      </ElFormItem>
    </template>
  </DynamicsForm>
</template>

<style scoped lang="scss">
.data-source-card {
  --el-card-padding: 4px 12px;

  line-height: 24px;
}

.border-active {
  border-color: var(--el-color-primary);
}

.cursor {
  cursor: pointer;
}

.flex {
  display: flex;
}

.align-center {
  align-items: center;
}

.mr-8 {
  margin-right: 8px;
}

.mb-8 {
  margin-bottom: 8px;
}

.mb-16 {
  margin-bottom: 16px;
}

.mt-4 {
  margin-top: 4px;
}

.w-full {
  width: 100%;
}

.ellipsis {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
