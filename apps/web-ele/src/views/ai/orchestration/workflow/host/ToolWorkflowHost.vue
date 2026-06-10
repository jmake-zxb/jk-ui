<script setup lang="ts">
import type { ValidationState } from '../designer/validation';
import type WorkflowHostChrome from './WorkflowHostChrome.vue';

import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { ElMessage } from 'element-plus';

import {
  debugTool,
  getTool,
  getToolWorkflow,
  pageToolVersions,
  publishToolWorkflow,
  saveToolWorkflow,
} from '#/api/ai/tools';

import { prettyJson, recordsOf, safeParseJson } from '../../utils';
import { normalizeGraphData } from '../designer/graph-data';
import { DEFAULT_GRAPH_DATA, DEFAULT_TOOL_GRAPH_DATA } from '../designer/nodes';
import {
  isMissingToolWorkflowError,
  toBackendToolWorkflowGraphData,
  toEditorToolWorkflowGraphData,
} from '../tool-workflow-utils';
import {
  debugResultTitle,
  isRecord,
  showApiError,
  useAutoSave,
  useDebugLog,
} from './workflow-host-shared';
import WorkflowHostChromeComponent from './WorkflowHostChrome.vue';

const props = defineProps<{ toolId: number | string }>();

const router = useRouter();

const chromeRef = ref<InstanceType<typeof WorkflowHostChrome>>();
const tools = ref<any[]>([]);
const toolDetail = ref<any>();
const toolId = ref<number | string>(props.toolId || '');
const workflowGraphJson = ref(DEFAULT_TOOL_GRAPH_DATA);
const debugInput = ref('{\n  "message": "测试工作流"\n}');
const debugMessage = ref('测试工作流');
const validation = ref<any>();
const localValidation = ref<ValidationState>({ errors: [], warnings: [] });
const loading = ref(false);
const versions = ref<any[]>([]);
const versionsLoading = ref(false);

const { autoSaveEnabled, lastSavedAt, markSaved, startAutoSave } = useAutoSave(
  () => autoSaveDraft(),
);
const { debugEvents, debugRows, pushResultRow, resetDebugLog } = useDebugLog();

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

async function validateDraft() {
  if (!(await saveDraft(false))) return;
  validation.value = { message: '本地校验通过', result: 'LOCAL' };
  ElMessage.success('本地校验完成');
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

async function debugStream() {
  if (!runLocalValidation(true)) return;
  if (!(await saveDraft(false))) return;
  resetDebugLog();
  const payload = safeParseJson(debugInput.value, {});
  const inputJson = prettyJson(payload, '{}');
  const result = await debugTool(toolId.value, {
    input_json: inputJson,
    inputJson,
    message: debugMessage.value,
  });
  const raw = prettyJson(result, '{}');
  pushResultRow(raw, {
    event: 'tool_debug',
    raw,
    status: 'SUCCESS',
    title: debugResultTitle(result),
  });
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
  <WorkflowHostChromeComponent
    ref="chromeRef"
    v-model:graph-data="workflowGraphJson"
    v-model:debug-message="debugMessage"
    v-model:debug-input="debugInput"
    v-model:debug-rows="debugRows"
    v-model:debug-events="debugEvents"
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
    @debug="debugStream"
    @local-validation-change="localValidation = $event"
    @open-versions="loadVersions()"
    @publish="publishDraft"
    @restore-version="restoreVersion"
    @save="saveDraft()"
    @toggle-auto-save="autoSaveEnabled = !autoSaveEnabled"
    @validate="validateDraft"
  />
</template>
