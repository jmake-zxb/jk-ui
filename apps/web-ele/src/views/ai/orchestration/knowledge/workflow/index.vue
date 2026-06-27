<script setup lang="ts">
import type { ValidationState } from '#/views/ai/orchestration/workflow/designer/validation';
import type WorkflowHostChrome from '#/views/ai/orchestration/workflow/host/WorkflowHostChrome.vue';

import { computed, nextTick, onMounted, provide, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ElDropdownItem, ElMessage } from 'element-plus';

import {
  debugKnowledgeWorkflow,
  exportKnowledgeWorkflow,
  getKnowledge,
  importKnowledgeWorkflow,
  pageKnowledgeWorkflowActions,
  publishKnowledgeWorkflow,
  saveKnowledgeWorkflowDraft,
} from '#/api/ai/knowledge';
import { WorkflowMode } from '#/enums/application';
import {
  prettyJson,
  recordsOf,
  safeParseJson,
} from '#/views/ai/orchestration/utils';
import { normalizeGraphData } from '#/views/ai/orchestration/workflow/designer/graph-data';
import { DEFAULT_KNOWLEDGE_GRAPH_DATA } from '#/views/ai/orchestration/workflow/designer/nodes';
import {
  showApiError,
  useAutoSave,
} from '#/views/ai/orchestration/workflow/host/workflow-host-shared';
import WorkflowHostChromeComponent from '#/views/ai/orchestration/workflow/host/WorkflowHostChrome.vue';

const props = defineProps<{
  folderId?: number | string;
  id?: number | string;
}>();

const route = useRoute();
const router = useRouter();
provide('workflowMode', WorkflowMode.Knowledge);
provide('loopWorkflowMode', WorkflowMode.KnowledgeLoop);

function routeParamId(value: unknown): number | string {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'number' || typeof first === 'string' ? first : '';
  }
  return '';
}

const chromeRef = ref<InstanceType<typeof WorkflowHostChrome>>();
const knowledgeDetail = ref<Record<string, any>>();
const knowledgeId = ref<number | string>(
  props.id || routeParamId(route.params.id),
);
const workflowGraphJson = ref(DEFAULT_KNOWLEDGE_GRAPH_DATA);
const validation = ref<any>();
const localValidation = ref<ValidationState>({ errors: [], warnings: [] });
const loading = ref(false);
const versions = ref<any[]>([]);
const versionsLoading = ref(false);
const workflowImportInput = ref<HTMLInputElement>();

const { autoSaveEnabled, lastSavedAt, markSaved, startAutoSave } = useAutoSave(
  () => autoSaveDraft(),
);

const currentKnowledgeName = computed(
  () => knowledgeDetail.value?.name || knowledgeId.value || '未选择知识库',
);
const subtitleText = computed(() => {
  if (lastSavedAt.value) return `最近保存 ${lastSavedAt.value}`;
  return autoSaveEnabled.value ? '自动保存开启' : '手动保存';
});

function syncGraphData() {
  chromeRef.value?.syncGraphData();
}

async function renderGraphData(fit = true) {
  await chromeRef.value?.renderGraphData(undefined, fit);
}

function runLocalValidation(showMessage = true) {
  return chromeRef.value?.runLocalValidation(showMessage) ?? true;
}

function backToKnowledge() {
  if (!knowledgeId.value) {
    router.push('/knowledge');
    return;
  }
  router.push({
    name: 'KnowledgeDetail',
    params: {
      folderId: `${route.params.folderId || 'shared'}`,
      id: `${knowledgeId.value}`,
      tab: 'document',
      type: 'WORKFLOW',
    },
  });
}

async function loadKnowledgeDetail() {
  if (!knowledgeId.value) {
    knowledgeDetail.value = undefined;
    return;
  }
  knowledgeDetail.value = await getKnowledge(knowledgeId.value);
}

async function loadDraft() {
  if (!knowledgeId.value) return;
  loading.value = true;
  try {
    await loadKnowledgeDetail();
    const graphValue =
      knowledgeDetail.value?.graphData ||
      knowledgeDetail.value?.graph_data ||
      '{}';
    const graphData = normalizeGraphData(
      safeParseJson(prettyJson(graphValue, DEFAULT_KNOWLEDGE_GRAPH_DATA), {}),
      true,
      true,
      'knowledge',
    );
    workflowGraphJson.value = prettyJson(
      graphData,
      DEFAULT_KNOWLEDGE_GRAPH_DATA,
    );
    localValidation.value = { errors: [], warnings: [] };
    validation.value = undefined;
    await nextTick();
    await renderGraphData(true);
    await loadVersions(false);
  } catch (error) {
    showApiError(error, '知识库工作流加载失败');
  } finally {
    loading.value = false;
  }
}

async function saveDraft(showMessage = true) {
  if (!knowledgeId.value) return false;
  if (!runLocalValidation(false)) {
    if (showMessage) {
      ElMessage.error(
        `本地校验未通过：${localValidation.value.errors.length || 1} 个错误，请查看画布提示`,
      );
    }
    return false;
  }
  syncGraphData();
  workflowGraphJson.value = prettyJson(
    normalizeGraphData(
      safeParseJson(workflowGraphJson.value, {}),
      true,
      true,
      'knowledge',
    ),
    DEFAULT_KNOWLEDGE_GRAPH_DATA,
  );
  await saveKnowledgeWorkflowDraft(knowledgeId.value, {
    graphData: workflowGraphJson.value,
    workFlow: workflowGraphJson.value,
    work_flow: workflowGraphJson.value,
  });
  markSaved();
  if (showMessage) ElMessage.success('草稿已保存');
  return true;
}

async function autoSaveDraft() {
  if (!autoSaveEnabled.value || !knowledgeId.value) return;
  await saveDraft(false);
}

async function publishDraft() {
  if (!(await saveDraft(false))) return;
  await publishKnowledgeWorkflow(knowledgeId.value);
  ElMessage.success('发布成功');
  await loadVersions(false);
}

async function loadVersions(showLoading = true) {
  if (!knowledgeId.value) return;
  if (showLoading) versionsLoading.value = true;
  try {
    versions.value = recordsOf(
      await pageKnowledgeWorkflowActions(knowledgeId.value, {
        current: 1,
        page: 1,
        size: 20,
      }),
    ).map((item) => ({
      ...item,
      id: item.id || item.actionId || item.createTime,
      name: item.name || item.actionType || item.action_type,
      publishUserName:
        item.publishUserName || item.createByName || item.create_by_name,
      updateTime: item.updateTime || item.createTime || item.create_time,
    }));
  } finally {
    versionsLoading.value = false;
  }
}

function restoreVersion() {
  ElMessage.warning('知识库工作流暂不支持版本恢复');
}

async function importWorkflow() {
  if (!knowledgeId.value) return;
  workflowImportInput.value?.click();
}

async function exportWorkflow() {
  if (!knowledgeId.value) return;
  const data = await exportKnowledgeWorkflow(knowledgeId.value);
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `${knowledgeDetail.value?.name || knowledgeId.value}.kbwf`;
  link.click();
  URL.revokeObjectURL(url);
}

async function debugDraft() {
  if (!runLocalValidation(true)) return;
  await saveDraft(false);
  await debugKnowledgeWorkflow(knowledgeId.value, {
    graphData: workflowGraphJson.value,
    workFlow: workflowGraphJson.value,
    work_flow: workflowGraphJson.value,
  });
  ElMessage.success('已提交调试');
}

async function handleWorkflowImportChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !knowledgeId.value) return;
  const text = await file.text();
  const formData = new FormData();
  formData.append('file', new File([text], file.name, { type: file.type }));
  await importKnowledgeWorkflow(knowledgeId.value, formData);
  await loadDraft();
  ElMessage.success('导入成功');
}

watch(
  () => [props.id, route.params.id],
  (next) => {
    const nextId = `${next[0] || routeParamId(next[1]) || ''}`;
    if (`${knowledgeId.value}` === nextId) return;
    knowledgeId.value = nextId;
    validation.value = undefined;
    localValidation.value = { errors: [], warnings: [] };
    loadDraft();
  },
);

onMounted(async () => {
  await loadDraft();
  startAutoSave();
});
</script>

<template>
  <WorkflowHostChromeComponent
    ref="chromeRef"
    v-model:graph-data="workflowGraphJson"
    :auto-save-enabled="autoSaveEnabled"
    back-list-label="知识库"
    :can-add-component="true"
    :can-debug="true"
    :can-publish="true"
    :can-restore-version="false"
    :can-save="true"
    :can-validate="true"
    :can-view-versions="true"
    debug-drawer-title="知识库工作流调试"
    foundation-mode="knowledge"
    :loading="loading"
    :local-validation="localValidation"
    palette-mode="knowledge"
    :subtitle-text="subtitleText"
    :title="currentKnowledgeName"
    :validation="validation"
    :versions="versions"
    versions-drawer-title="工作流操作记录"
    :versions-loading="versionsLoading"
    @back="backToKnowledge"
    @local-validation-change="localValidation = $event"
    @open-versions="loadVersions()"
    @debug="debugDraft"
    @publish="publishDraft"
    @restore-version="restoreVersion"
    @save="saveDraft(true)"
    @toggle-auto-save="autoSaveEnabled = !autoSaveEnabled"
    @validate="runLocalValidation(true)"
  >
    <template #menu-before>
      <ElDropdownItem @click="importWorkflow">导入工作流</ElDropdownItem>
      <ElDropdownItem @click="exportWorkflow">导出工作流</ElDropdownItem>
      <ElDropdownItem
        @click="
          router.push({
            name: 'KnowledgeImportWorkflow',
            params: { folderId: `${route.params.folderId || 'shared'}` },
            query: { id: `${knowledgeId}` },
          })
        "
      >
        导入文档
      </ElDropdownItem>
    </template>
    <template #menu-after>
      <ElDropdownItem @click="debugDraft">调试</ElDropdownItem>
    </template>
  </WorkflowHostChromeComponent>

  <input
    ref="workflowImportInput"
    accept=".kbwf,.json,application/json"
    style="display: none"
    type="file"
    @change="handleWorkflowImportChange"
  />
</template>
