<script setup lang="ts">
import type { ValidationState } from '../workflow/designer/validation';
import type WorkflowHostChrome from '../workflow/host/WorkflowHostChrome.vue';

import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { ElMessage } from 'element-plus';

import {
  getToolWorkflow,
  pageToolVersions,
  publishToolWorkflow,
  saveToolWorkflow,
} from '#/api/ai/tool-workflow';
import { getTool } from '#/api/ai/tools';

import WorkflowDebugDrawer from '../tools/component/WorkflowDebugDrawer.vue';
import { prettyJson, recordsOf, safeParseJson } from '../utils';
import { normalizeGraphData } from '../workflow/designer/graph-data';
import {
  DEFAULT_GRAPH_DATA,
  DEFAULT_TOOL_GRAPH_DATA,
} from '../workflow/designer/nodes';
import {
  isRecord,
  showApiError,
  useAutoSave,
} from '../workflow/host/workflow-host-shared';
import WorkflowHostChromeComponent from '../workflow/host/WorkflowHostChrome.vue';
import {
  isMissingToolWorkflowError,
  toBackendToolWorkflowGraphData,
  toEditorToolWorkflowGraphData,
} from '../workflow/tool-workflow-utils';

const props = defineProps<{ toolId: number | string }>();

const router = useRouter();

const chromeRef = ref<InstanceType<typeof WorkflowHostChrome>>();
const debugDrawerRef = ref<InstanceType<typeof WorkflowDebugDrawer>>();
const tools = ref<any[]>([]);
const toolDetail = ref<any>();
const toolId = ref<number | string>(props.toolId || '');
const workflowGraphJson = ref(DEFAULT_TOOL_GRAPH_DATA);
const validation = ref<any>();
const localValidation = ref<ValidationState>({ errors: [], warnings: [] });
const loading = ref(false);
const versions = ref<any[]>([]);
const versionsLoading = ref(false);

const { autoSaveEnabled, lastSavedAt, markSaved, startAutoSave } = useAutoSave(
  () => autoSaveDraft(),
);

const currentTool = computed(() =>
  `${toolDetail.value?.id || ''}` === `${toolId.value}`
    ? toolDetail.value
    : tools.value.find((item) => `${item.id}` === `${toolId.value}`),
);
const currentToolName = computed(
  () => currentTool.value?.name || toolId.value || '未选择工具',
);
const subtitleText = computed(() => {
  if (lastSavedAt.value) return `最近保存 ${lastSavedAt.value}`;
  return autoSaveEnabled.value ? '自动保存开启' : '手动保存';
});

function normalizeToolDetail(detail: unknown): Record<string, any> {
  if (!isRecord(detail)) return {};
  const tool = isRecord(detail.tool) ? detail.tool : detail;
  const workflow = isRecord(detail.workflow) ? detail.workflow : undefined;
  const workFlow = detail.work_flow || detail.workFlow;
  return {
    ...tool,
    ...(workflow ? { workflow } : {}),
    ...(workFlow ? { work_flow: workFlow } : {}),
  };
}

function firstWorkflowValue(...values: unknown[]) {
  return values.find((value) => {
    if (typeof value === 'string') return value.trim().length > 0;
    return isRecord(value);
  });
}

function workflowValueFromToolWorkflow(workflow: unknown, tool: unknown) {
  const workflowRecord = isRecord(workflow) ? workflow : {};
  const nestedWorkflow = isRecord(workflowRecord.workflow)
    ? workflowRecord.workflow
    : undefined;
  const toolRecord = isRecord(tool) ? tool : {};
  const toolNestedWorkflow = isRecord(toolRecord.workflow)
    ? toolRecord.workflow
    : undefined;
  return firstWorkflowValue(
    workflowRecord.graphData,
    workflowRecord.graph_data,
    workflowRecord.workFlow,
    workflowRecord.work_flow,
    nestedWorkflow?.graphData,
    nestedWorkflow?.graph_data,
    nestedWorkflow?.workFlow,
    nestedWorkflow?.work_flow,
    toolRecord.graphData,
    toolRecord.graph_data,
    toolRecord.workFlow,
    toolRecord.work_flow,
    toolNestedWorkflow?.graphData,
    toolNestedWorkflow?.graph_data,
    toolNestedWorkflow?.workFlow,
    toolNestedWorkflow?.work_flow,
  );
}

function toolWorkflowPayload(graphJson = workflowGraphJson.value) {
  const backendGraphJson = prettyJson(
    toBackendToolWorkflowGraphData(
      normalizeGraphData(safeParseJson(graphJson, {}), true, true, 'tool'),
    ),
    DEFAULT_GRAPH_DATA,
  );
  return {
    graphData: backendGraphJson,
    graph_data: backendGraphJson,
    work_flow: backendGraphJson,
  };
}

async function loadToolWorkflowValue() {
  try {
    const workflow = await getToolWorkflow(toolId.value);
    return workflowValueFromToolWorkflow(workflow, currentTool.value);
  } catch (error) {
    if (isMissingToolWorkflowError(error)) return undefined;
    throw error;
  }
}

function syncToolBaseNodeInfo(graphData: any) {
  const tool = currentTool.value;
  if (!tool || !Array.isArray(graphData?.nodes)) return graphData;
  const baseNode = graphData.nodes.find(
    (node: any) =>
      node?.id === 'tool-base-node' || node?.type === 'tool-base-node',
  );
  if (!baseNode) return graphData;
  if (!baseNode.properties) baseNode.properties = {};
  if (!baseNode.properties.node_data) baseNode.properties.node_data = {};
  const nodeData = baseNode.properties.node_data;
  const toolName = `${tool.name || tool.label || ''}`.trim();
  const toolDesc = `${tool.description || tool.desc || ''}`.trim();
  if (toolName && !`${nodeData.tool_name || nodeData.name || ''}`.trim()) {
    nodeData.tool_name = toolName;
  }
  if (
    toolDesc &&
    !`${nodeData.tool_desc || nodeData.description || ''}`.trim()
  ) {
    nodeData.tool_desc = toolDesc;
  }
  return graphData;
}

async function loadToolDetail() {
  if (!toolId.value) {
    toolDetail.value = undefined;
    return;
  }
  const detail = normalizeToolDetail(await getTool(toolId.value));
  toolDetail.value = detail;
  const index = tools.value.findIndex(
    (item) => `${item.id}` === `${detail?.id || toolId.value}`,
  );
  if (index !== -1) {
    tools.value[index] = { ...tools.value[index], ...detail };
  } else if (detail?.id) {
    tools.value.unshift(detail);
  }
}

function syncGraphData() {
  chromeRef.value?.syncGraphData();
}

async function renderGraphData(fit = true) {
  await chromeRef.value?.renderGraphData(undefined, fit);
}

function runLocalValidation(showMessage = true) {
  return chromeRef.value?.runLocalValidation(showMessage) ?? true;
}

function backToTools() {
  router.push('/ai/orchestration/tools/index');
}

async function loadDraft() {
  if (!toolId.value) return;
  loading.value = true;
  try {
    await loadToolDetail();
    const graphValue = await loadToolWorkflowValue();
    const graphData = normalizeGraphData(
      safeParseJson(
        prettyJson(
          toEditorToolWorkflowGraphData(graphValue),
          DEFAULT_TOOL_GRAPH_DATA,
        ),
        {},
      ),
      true,
      true,
      'tool',
    );
    workflowGraphJson.value = prettyJson(
      syncToolBaseNodeInfo(graphData),
      DEFAULT_TOOL_GRAPH_DATA,
    );
    localValidation.value = { errors: [], warnings: [] };
    validation.value = undefined;
    await nextTick();
    await renderGraphData(true);
    await loadVersions(false);
  } catch (error) {
    showApiError(error, '工具工作流加载失败');
  } finally {
    loading.value = false;
  }
}

async function saveDraft(showMessage = true) {
  if (!toolId.value) return false;
  if (!runLocalValidation(false)) {
    if (showMessage)
      ElMessage.error(
        `本地校验未通过：${localValidation.value.errors.length || 1} 个错误，请查看画布提示`,
      );
    return false;
  }
  syncGraphData();
  workflowGraphJson.value = prettyJson(
    normalizeGraphData(
      safeParseJson(workflowGraphJson.value, {}),
      true,
      true,
      'tool',
    ),
    DEFAULT_TOOL_GRAPH_DATA,
  );
  await saveToolWorkflow(toolId.value, toolWorkflowPayload());
  markSaved();
  if (showMessage) ElMessage.success('草稿已保存');
  return true;
}

async function autoSaveDraft() {
  if (!autoSaveEnabled.value || !toolId.value) return;
  await saveDraft(false);
}

async function publishDraft() {
  if (!(await saveDraft(false))) return;
  await publishToolWorkflow(toolId.value, toolWorkflowPayload());
  ElMessage.success('发布成功');
  await loadVersions(false);
}

async function loadVersions(showLoading = true) {
  if (!toolId.value) return;
  if (showLoading) versionsLoading.value = true;
  try {
    versions.value = recordsOf(
      await pageToolVersions(toolId.value, {
        current: 1,
        page: 1,
        size: 20,
      }),
    );
  } finally {
    versionsLoading.value = false;
  }
}

function restoreVersion() {
  ElMessage.warning('工具工作流暂不支持版本恢复');
}

async function openDebug() {
  if (!runLocalValidation(true)) return;
  if (!(await saveDraft(false))) return;
  debugDrawerRef.value?.open(toolId.value);
}

watch(
  () => props.toolId,
  (next) => {
    const nextId = `${next || ''}`;
    if (`${toolId.value}` === nextId) return;
    toolId.value = nextId;
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
  <div>
    <WorkflowHostChromeComponent
      ref="chromeRef"
      v-model:graph-data="workflowGraphJson"
      :auto-save-enabled="autoSaveEnabled"
      back-list-label="工具管理"
      :can-restore-version="false"
      debug-drawer-title="工具工作流调试"
      foundation-mode="tool"
      :loading="loading"
      :local-validation="localValidation"
      palette-mode="tool"
      :subtitle-text="subtitleText"
      :title="currentToolName"
      :validation="validation"
      :versions="versions"
      versions-drawer-title="工具发布历史"
      :versions-loading="versionsLoading"
      @back="backToTools"
      @debug="openDebug"
      @local-validation-change="localValidation = $event"
      @open-versions="loadVersions()"
      @publish="publishDraft"
      @restore-version="restoreVersion"
      @save="saveDraft(true)"
    />

    <WorkflowDebugDrawer ref="debugDrawerRef" />
  </div>
</template>
