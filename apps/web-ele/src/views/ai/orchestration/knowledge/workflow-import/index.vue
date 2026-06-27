<script setup lang="ts">
import type { Ref } from 'vue';

import { computed, nextTick, onMounted, provide, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { ArrowLeft } from '@element-plus/icons-vue';
import {
  ElButton,
  ElCard,
  ElEmpty,
  ElMessage,
  ElScrollbar,
} from 'element-plus';

import { postUploadFile } from '#/api/ai/chat';
import { getKnowledge, workflowUploadDocument } from '#/api/ai/knowledge';
import { WorkflowType } from '#/enums/application';
import { prettyJson, safeParseJson } from '#/views/ai/orchestration/utils';
import { normalizeGraphData } from '#/views/ai/orchestration/workflow/designer/graph-data';
import { DEFAULT_KNOWLEDGE_GRAPH_DATA } from '#/views/ai/orchestration/workflow/designer/nodes';

import DataSource from '../workflow/component/action/DataSource.vue';
import KnowledgeBase from '../workflow/component/action/KnowledgeBase.vue';
import Result from '../workflow/component/action/Result.vue';

type ActionStep = 'data_source' | 'knowledge_base' | 'result';

const props = defineProps<{
  folderId?: number | string;
}>();

const route = useRoute();
const router = useRouter();

const key = ref(0);
const loading = ref(false);
const actionId = ref<string>();
const formData = ref<Record<string, any>>({});
const active = ref<ActionStep>('data_source');
const workflow = ref<null | Record<string, any>>(null);
const knowledgeDetail = ref<Record<string, any>>();
const actionRef = ref();

const knowledgeId = computed(() => {
  const value = route.query.id;
  return Array.isArray(value)
    ? `${value[0] || ''}`
    : `${value || route.params.id || ''}`;
});
const folderId = computed(
  () => `${props.folderId || route.params.folderId || 'shared'}`,
);

const actionComponents = {
  data_source: DataSource,
  knowledge_base: KnowledgeBase,
  result: Result,
};

const baseFormList = computed(() => {
  const knowledgeBaseNode = workflow.value?.nodes?.find(
    (node: Record<string, any>) => node.type === WorkflowType.KnowledgeBase,
  );
  const fields = knowledgeBaseNode?.properties?.user_input_field_list;
  return Array.isArray(fields) ? fields : [];
});

provide('upload', (file: File, _loading?: Ref<boolean>) =>
  postUploadFile(file, knowledgeId.value, 'KNOWLEDGE'),
);

async function next() {
  await actionRef.value?.validate();
  formData.value[active.value] = actionRef.value?.get_data?.() || {};
  active.value = 'knowledge_base';
}

async function up() {
  await actionRef.value?.validate();
  active.value = 'data_source';
}

async function upload() {
  await actionRef.value?.validate();
  formData.value[active.value] = actionRef.value?.get_data?.() || {};
  const result = (await workflowUploadDocument(
    knowledgeId.value,
    formData.value,
  )) as Record<string, any>;
  actionId.value = `${result.id || result.actionId || ''}`;
  active.value = 'result';
  ElMessage.success('已提交导入');
}

async function loadDetail() {
  if (!knowledgeId.value) return;
  loading.value = true;
  try {
    knowledgeDetail.value = (await getKnowledge(knowledgeId.value)) as Record<
      string,
      any
    >;
    const rawGraph =
      knowledgeDetail.value.graphData ||
      knowledgeDetail.value.graph_data ||
      DEFAULT_KNOWLEDGE_GRAPH_DATA;
    workflow.value = normalizeGraphData(
      safeParseJson(prettyJson(rawGraph, DEFAULT_KNOWLEDGE_GRAPH_DATA), {}),
      true,
      true,
      'knowledge',
    );
  } finally {
    loading.value = false;
  }
}

function continueImporting() {
  active.value = 'data_source';
  key.value += 1;
  actionId.value = undefined;
  const currentWorkflow = workflow.value;
  workflow.value = null;
  formData.value = {};
  nextTick(() => {
    workflow.value = currentWorkflow;
  });
}

function goDocument() {
  router.push({
    name: 'KnowledgeDetail',
    params: {
      folderId: folderId.value,
      id: knowledgeId.value,
      tab: 'document',
      type: 'WORKFLOW',
    },
  });
}

function back() {
  if (!knowledgeId.value) {
    router.push('/knowledge');
    return;
  }
  router.push({
    name: 'KnowledgeWorkflow',
    params: { folderId: folderId.value, id: knowledgeId.value },
  });
}

onMounted(loadDetail);
</script>

<template>
  <Page auto-content-height>
    <div class="upload-document p-12-24">
      <div class="align-center mb-16 flex">
        <ElButton :icon="ArrowLeft" @click="back">工作流</ElButton>
        <h3 class="page-heading">导入文档</h3>
      </div>
      <ElCard class="upload-document__card">
        <div class="upload-document__main flex" v-loading="loading">
          <div class="upload-document__component main-calc-height">
            <ElScrollbar>
              <div class="upload-component p-24">
                <ElEmpty v-if="!workflow" description="暂无可用工作流" />
                <component
                  v-else
                  :is="actionComponents[active]"
                  :key="key"
                  ref="actionRef"
                  v-model:loading="loading"
                  :workflow="workflow"
                  :knowledge-id="knowledgeId"
                  :id="actionId"
                />
              </div>
            </ElScrollbar>
          </div>
        </div>
      </ElCard>
      <div class="upload-document__footer border-t text-right">
        <ElButton v-if="active === 'result'" @click="continueImporting">
          继续导入
        </ElButton>
        <ElButton
          v-if="baseFormList.length > 0 && active === 'knowledge_base'"
          :loading="loading"
          @click="up"
        >
          上一步
        </ElButton>
        <ElButton
          v-if="baseFormList.length > 0 && active === 'data_source'"
          :disabled="loading"
          @click="next"
        >
          下一步
        </ElButton>
        <ElButton
          v-if="
            baseFormList.length > 0
              ? active === 'knowledge_base'
              : active === 'data_source'
          "
          type="primary"
          :disabled="loading || !workflow"
          @click="upload"
        >
          导入
        </ElButton>
        <ElButton v-if="active === 'result'" type="primary" @click="goDocument">
          查看文档
        </ElButton>
      </div>
    </div>
  </Page>
</template>

<style scoped lang="scss">
.upload-document {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.upload-document__card {
  flex: 1;
  min-height: 0;
}

.upload-document__card :deep(.el-card__body) {
  height: 100%;
  min-height: 0;
  padding: 0;
}

.upload-document__main,
.upload-document__component {
  height: 100%;
  min-height: 0;
}

.upload-component {
  min-width: 850px;
}

.upload-document__footer {
  flex-shrink: 0;
  padding: 12px 0 0;
  margin-top: 12px;
}

.page-heading {
  display: inline-block;
  margin: 0 0 0 12px;
}

.flex {
  display: flex;
}

.align-center {
  align-items: center;
}

.mb-16 {
  margin-bottom: 16px;
}

.p-12-24 {
  padding: 12px 24px;
}

.p-24 {
  padding: 24px;
}

.text-right {
  text-align: right;
}

.border-t {
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
