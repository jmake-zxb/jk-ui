<script setup lang="ts">
import type { ValidationState } from './designer/validation';
import type WorkflowDesigner from './designer/WorkflowDesigner.vue';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import {
  ArrowLeft,
  Connection,
  MoreFilled,
  VideoPlay,
} from '@element-plus/icons-vue';
import {
  ElButton,
  ElDrawer,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElInput,
  ElMessage,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
  ElTag,
} from 'element-plus';

import {
  getApplication,
  getWorkflowDraft,
  listApplications,
  pageWorkflowVersions,
  publishWorkflow,
  restoreWorkflowVersion,
  saveWorkflowDraft,
  validateWorkflowDraft,
} from '#/api/ai/applications';
import {
  debugTool,
  getTool,
  getToolWorkflow,
  pageToolVersions,
  publishToolWorkflow,
  saveToolWorkflow,
} from '#/api/ai/tools';
import { adaptationUrl } from '#/utils/other';

import {
  APPLICATION_CHAT_PATH,
  isWorkflowApplication,
} from '../applications/application-entry';
import { prettyJson, recordsOf, safeParseJson } from '../utils';
import { normalizeGraphData } from './designer/graph-data';
import { DEFAULT_GRAPH_DATA, DEFAULT_TOOL_GRAPH_DATA } from './designer/nodes';
import WorkflowDesignerComponent from './designer/WorkflowDesigner.vue';
import {
  isMissingToolWorkflowError,
  toBackendToolWorkflowGraphData,
  toEditorToolWorkflowGraphData,
} from './tool-workflow-utils';

type WorkflowHostMode = 'application' | 'tool';

type DebugRunEvent = {
  event: string;
  nodeName?: string;
  nodeType?: string;
  raw: string;
  status: 'FAILED' | 'RUNNING' | 'STREAM' | 'SUCCESS' | 'WARNING';
  title: string;
};

const route = useRoute();
const router = useRouter();
const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
const accessStore = useAccessStore();

const workflowDesignerRef = ref<InstanceType<typeof WorkflowDesigner>>();
const applications = ref<any[]>([]);
const applicationDetail = ref<any>();
const applicationId = ref<number | string>(
  (route.query.applicationId as string) || '',
);
const tools = ref<any[]>([]);
const toolDetail = ref<any>();
const toolId = ref<number | string>((route.query.toolId as string) || '');
const workflowGraphJson = ref(DEFAULT_GRAPH_DATA);
const applicationConfig = ref('{}');
const debugInput = ref('{\n  "message": "测试工作流"\n}');
const debugMessage = ref('测试工作流');
const debugEvents = ref<string[]>([]);
const debugRows = ref<DebugRunEvent[]>([]);
const validation = ref<any>();
const localValidation = ref<ValidationState>({ errors: [], warnings: [] });
const loading = ref(false);
const autoSaveEnabled = ref(
  localStorage.getItem('jkWorkflowAutoSave') === 'true',
);
const lastSavedAt = ref('');
const debugDrawerOpen = ref(false);
const applicationConfigOpen = ref(false);
const versionsOpen = ref(false);
const rawDebugOpen = ref(false);
const versions = ref<any[]>([]);
const versionsLoading = ref(false);
let autoSaveTimer: number | undefined;

const workflowMode = computed<WorkflowHostMode>(() =>
  toolId.value ? 'tool' : 'application',
);
const isToolMode = computed(() => workflowMode.value === 'tool');
const workflowFoundationMode = computed<WorkflowHostMode>(() =>
  isToolMode.value ? 'tool' : 'application',
);
const workflowPaletteMode = computed<WorkflowHostMode>(() =>
  isToolMode.value ? 'tool' : 'application',
);
const activeTargetId = computed(() =>
  isToolMode.value ? toolId.value : applicationId.value,
);
const defaultGraphJson = computed(() =>
  isToolMode.value ? DEFAULT_TOOL_GRAPH_DATA : DEFAULT_GRAPH_DATA,
);

const currentApplication = computed(() =>
  `${applicationDetail.value?.id || ''}` === `${applicationId.value}`
    ? applicationDetail.value
    : applications.value.find(
        (item) => `${item.id}` === `${applicationId.value}`,
      ),
);
const currentTool = computed(() =>
  `${toolDetail.value?.id || ''}` === `${toolId.value}`
    ? toolDetail.value
    : tools.value.find((item) => `${item.id}` === `${toolId.value}`),
);
const currentApplicationName = computed(() =>
  isToolMode.value
    ? currentTool.value?.name || toolId.value || '未选择工具'
    : currentApplication.value?.name || applicationId.value || '未选择应用',
);
const publicAccessAvailable = computed(
  () =>
    !isToolMode.value &&
    currentApplication.value?.accessEnabled !== false &&
    !!applicationId.value,
);
const backListLabel = computed(() =>
  isToolMode.value ? '工具管理' : '应用管理',
);
const debugDrawerTitle = computed(() =>
  isToolMode.value ? '工具工作流调试' : '工作流调试',
);
const versionsDrawerTitle = computed(() =>
  isToolMode.value ? '工具发布历史' : '发布历史',
);

function getApiErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object') {
    const maybeMessage =
      (error as { message?: unknown; msg?: unknown }).msg ||
      (error as { message?: unknown; msg?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim())
      return maybeMessage;
  }
  return fallback;
}

function showApiError(error: unknown, fallback: string) {
  const message = getApiErrorMessage(error, fallback);
  if (message.includes('不允许访问')) ElMessage.warning(message);
  else ElMessage.error(message);
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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

function normalizeActiveGraphData(value: unknown) {
  const graphValue = isToolMode.value
    ? toEditorToolWorkflowGraphData(value)
    : value;
  return normalizeGraphData(
    safeParseJson(prettyJson(graphValue, defaultGraphJson.value), {}),
    true,
    true,
    workflowFoundationMode.value,
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

function syncBaseNodeApplicationInfo(graphData: any) {
  const application = currentApplication.value;
  if (!application || !Array.isArray(graphData?.nodes)) return graphData;
  const baseNode = graphData.nodes.find(
    (node: any) => node?.id === 'base-node' || node?.type === 'base-node',
  );
  if (!baseNode) return graphData;
  if (!baseNode.properties) baseNode.properties = {};
  if (!baseNode.properties.node_data) baseNode.properties.node_data = {};
  const nodeData = baseNode.properties.node_data;
  const applicationName =
    `${application.name || application.title || ''}`.trim();
  const applicationDesc =
    `${application.description || application.desc || ''}`.trim();
  if (applicationName && !`${nodeData.name || ''}`.trim()) {
    nodeData.name = applicationName;
  }
  if (applicationDesc && !`${nodeData.desc || ''}`.trim()) {
    nodeData.desc = applicationDesc;
  }
  return graphData;
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

async function loadApplicationDetail() {
  if (!applicationId.value) {
    applicationDetail.value = undefined;
    return true;
  }
  const detail = await getApplication(applicationId.value);
  applicationDetail.value = detail;
  if (detail?.id && !isWorkflowApplication(detail.type)) {
    ElMessage.info('智能体应用使用对话调试');
    await router.replace({
      path: APPLICATION_CHAT_PATH,
      query: { applicationId: detail.id, mode: 'debug' },
    });
    return false;
  }
  const index = applications.value.findIndex(
    (item) => `${item.id}` === `${detail?.id || applicationId.value}`,
  );
  if (index !== -1) {
    applications.value[index] = { ...applications.value[index], ...detail };
  } else if (detail?.id) {
    applications.value.unshift(detail);
  }
  return true;
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
  workflowDesignerRef.value?.syncGraphData();
}

async function renderGraphData(fit = true) {
  await workflowDesignerRef.value?.renderGraphData(undefined, fit);
}

function runLocalValidation(showMessage = true) {
  const passed =
    workflowDesignerRef.value?.runLocalValidation(showMessage) ?? true;
  return passed;
}

function backToApplications() {
  router.push(
    isToolMode.value
      ? '/ai/orchestration/tools/index'
      : '/ai/orchestration/applications/index',
  );
}

function openPublicChat() {
  if (!applicationId.value) return;
  router.push({
    path: '/ai/orchestration/public-chat/index',
    query: { applicationId: applicationId.value },
  });
}

async function loadApplications() {
  if (isToolMode.value) {
    await loadDraft();
    return;
  }
  loading.value = true;
  try {
    applications.value = recordsOf(await listApplications());
    if (!applicationId.value && applications.value.length > 0) {
      applicationId.value =
        applications.value.find((item) => isWorkflowApplication(item.type))
          ?.id || applications.value[0].id;
    }
    await loadDraft();
  } catch (error) {
    showApiError(error, '应用列表加载失败');
  } finally {
    loading.value = false;
  }
}

async function loadWorkflowHost() {
  await (isToolMode.value ? loadDraft() : loadApplications());
}

async function loadDraft() {
  if (!activeTargetId.value) return;
  loading.value = true;
  try {
    let graphValue: unknown;
    let nextApplicationConfig = '{}';
    if (isToolMode.value) {
      await loadToolDetail();
      graphValue = await loadToolWorkflowValue();
    } else {
      if (!(await loadApplicationDetail())) return;
      const draft = await getWorkflowDraft(applicationId.value);
      graphValue = draft?.graphData || draft;
      nextApplicationConfig = prettyJson(draft?.applicationConfig, '{}');
    }
    const graphData = normalizeActiveGraphData(graphValue);
    workflowGraphJson.value = prettyJson(
      isToolMode.value
        ? syncToolBaseNodeInfo(graphData)
        : syncBaseNodeApplicationInfo(graphData),
      defaultGraphJson.value,
    );
    applicationConfig.value = nextApplicationConfig;
    localValidation.value = { errors: [], warnings: [] };
    validation.value = undefined;
    await nextTick();
    await renderGraphData(true);
    await loadVersions(false);
  } catch (error) {
    showApiError(
      error,
      isToolMode.value ? '工具工作流加载失败' : '工作流草稿加载失败',
    );
  } finally {
    loading.value = false;
  }
}

async function saveDraft(showMessage = true) {
  if (!activeTargetId.value) return false;
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
      workflowFoundationMode.value,
    ),
    defaultGraphJson.value,
  );
  await (isToolMode.value
    ? saveToolWorkflow(toolId.value, toolWorkflowPayload())
    : saveWorkflowDraft(applicationId.value, {
        graphData: workflowGraphJson.value,
        applicationConfig: applicationConfig.value,
      }));
  lastSavedAt.value = new Date().toLocaleTimeString();
  if (showMessage) ElMessage.success('草稿已保存');
  return true;
}

async function autoSaveDraft() {
  if (!autoSaveEnabled.value || !activeTargetId.value) return;
  await saveDraft(false);
}

async function validateDraft() {
  if (!(await saveDraft(false))) return;
  if (isToolMode.value) {
    validation.value = { message: '本地校验通过', result: 'LOCAL' };
    ElMessage.success('本地校验完成');
    return;
  }
  validation.value = await validateWorkflowDraft(applicationId.value);
  ElMessage.success('校验完成');
}

async function publishDraft() {
  if (!(await saveDraft(false))) return;
  await (isToolMode.value
    ? publishToolWorkflow(toolId.value, toolWorkflowPayload())
    : publishWorkflow(applicationId.value, { description: '前端工作流发布' }));
  ElMessage.success('发布成功');
  await loadVersions(false);
}

async function loadVersions(showLoading = true) {
  if (!activeTargetId.value) return;
  if (showLoading) versionsLoading.value = true;
  try {
    versions.value = recordsOf(
      isToolMode.value
        ? await pageToolVersions(toolId.value, {
            current: 1,
            page: 1,
            size: 20,
          })
        : await pageWorkflowVersions(applicationId.value, {
            current: 1,
            page: 1,
            size: 20,
          }),
    );
  } finally {
    versionsLoading.value = false;
  }
}

async function openVersions() {
  versionsOpen.value = true;
  await loadVersions();
}

async function restoreVersion(row: any) {
  if (!row?.id) return;
  if (isToolMode.value) {
    ElMessage.warning('工具工作流暂不支持版本恢复');
    return;
  }
  await restoreWorkflowVersion(applicationId.value, row.id);
  ElMessage.success('版本已恢复');
  await loadDraft();
}

function parseDebugChunk(chunk: string): DebugRunEvent[] {
  return chunk
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const raw = line.startsWith('data:') ? line.slice(5).trim() : line;
      const data = safeParseJson(raw, undefined);
      if (!data)
        return {
          event: 'raw',
          raw,
          status: 'STREAM',
          title: raw.slice(0, 80) || 'stream',
        };
      const event = data.event || data.type || 'event';
      const status = debugEventStatus(event);
      return {
        event,
        nodeName: data.nodeName,
        nodeType: data.nodeType,
        raw,
        status,
        title: data.message || data.content || data.payload || event,
      };
    });
}

function debugEventStatus(event: string) {
  if (event === 'error' || event === 'canceled') return 'FAILED';
  if (event === 'node_start' || event === 'run_start') return 'RUNNING';
  if (event === 'node_chunk') return 'STREAM';
  if (event === 'node_interrupt') return 'WARNING';
  return 'SUCCESS';
}

function debugResultTitle(result: unknown) {
  if (isRecord(result)) {
    const value =
      result.message || result.output || result.result || result.data;
    if (value === undefined || value === null) return '工具调试完成';
    return typeof value === 'string'
      ? value
      : prettyJson(value, '工具调试完成');
  }
  return result === undefined || result === null ? '工具调试完成' : `${result}`;
}

async function debugStream() {
  if (!runLocalValidation(true)) return;
  if (isToolMode.value && !(await saveDraft(false))) return;
  debugEvents.value = [];
  debugRows.value = [];
  debugDrawerOpen.value = true;
  const payload = safeParseJson(debugInput.value, {});
  if (isToolMode.value) {
    const inputJson = prettyJson(payload, '{}');
    const result = await debugTool(toolId.value, {
      input_json: inputJson,
      inputJson,
      message: debugMessage.value,
    });
    const raw = prettyJson(result, '{}');
    debugEvents.value.push(raw);
    debugRows.value.push({
      event: 'tool_debug',
      raw,
      status: 'SUCCESS',
      title: debugResultTitle(result),
    });
    return;
  }
  const response = await fetch(
    `${apiURL}${adaptationUrl(`/ai/api/applications/${applicationId.value}/workflow/debug/stream`)}`,
    {
      body: JSON.stringify({
        inputJson: JSON.stringify(payload),
        message: debugMessage.value,
      }),
      headers: {
        Authorization: accessStore.accessToken
          ? `Bearer ${accessStore.accessToken}`
          : '',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    debugEvents.value.push(chunk);
    debugRows.value.push(...parseDebugChunk(chunk));
  }
}

function startAutoSave() {
  if (autoSaveTimer) window.clearInterval(autoSaveTimer);
  if (!autoSaveEnabled.value) return;
  autoSaveTimer = window.setInterval(autoSaveDraft, 60_000);
}

watch(autoSaveEnabled, (enabled) => {
  localStorage.setItem('jkWorkflowAutoSave', `${enabled}`);
  startAutoSave();
});

watch(
  () => [route.query.applicationId, route.query.toolId],
  async ([nextApplicationId, nextToolId]) => {
    const nextApplication = (nextApplicationId as string) || '';
    const nextTool = (nextToolId as string) || '';
    if (
      `${applicationId.value}` === nextApplication &&
      `${toolId.value}` === nextTool
    ) {
      return;
    }
    applicationId.value = nextApplication;
    toolId.value = nextTool;
    validation.value = undefined;
    localValidation.value = { errors: [], warnings: [] };
    await loadWorkflowHost();
  },
);

onMounted(async () => {
  await loadWorkflowHost();
  startAutoSave();
});

onBeforeUnmount(() => {
  if (autoSaveTimer) window.clearInterval(autoSaveTimer);
});
</script>

<template>
  <Page auto-content-height>
    <div class="workflow-host" v-loading="loading">
      <div class="toolbar editor-header">
        <div class="header-left">
          <ElButton :icon="ArrowLeft" @click="backToApplications">
            {{ backListLabel }}
          </ElButton>
          <div class="workflow-title-block">
            <div class="page-title">{{ currentApplicationName }}</div>
            <div class="page-subtitle">
              <span v-if="lastSavedAt">最近保存 {{ lastSavedAt }}</span>
              <span v-else>{{
                autoSaveEnabled ? '自动保存开启' : '手动保存'
              }}</span>
            </div>
          </div>
          <ElTag v-if="validation" type="success">
            {{ validation.message || validation.result || '已校验' }}
          </ElTag>
          <ElTag v-if="localValidation.errors.length > 0" type="danger">
            {{ localValidation.errors.length }} 错误
          </ElTag>
          <ElTag v-else-if="localValidation.warnings.length > 0" type="warning">
            {{ localValidation.warnings.length }} 警告
          </ElTag>
        </div>
        <div class="header-actions">
          <ElButton
            type="primary"
            @click="workflowDesignerRef?.toggleAddMenu()"
          >
            添加组件
          </ElButton>
          <ElButton :icon="VideoPlay" @click="debugDrawerOpen = true">
            调试
          </ElButton>
          <ElButton @click="saveDraft()">保存</ElButton>
          <ElButton :icon="Connection" @click="publishDraft">发布</ElButton>
          <ElDropdown trigger="click">
            <ElButton :icon="MoreFilled" />
            <template #dropdown>
              <ElDropdownMenu>
                <template v-if="!isToolMode">
                  <ElDropdownItem
                    v-for="item in applications"
                    :key="item.id"
                    @click="
                      applicationId = item.id;
                      loadDraft();
                    "
                  >
                    切换到 {{ item.name || item.id }}
                  </ElDropdownItem>
                </template>
                <ElDropdownItem @click="validateDraft">校验</ElDropdownItem>
                <ElDropdownItem @click="openVersions">
                  版本 / 历史
                </ElDropdownItem>
                <ElDropdownItem
                  v-if="!isToolMode"
                  :disabled="!publicAccessAvailable"
                  @click="openPublicChat"
                >
                  公开访问
                </ElDropdownItem>
                <ElDropdownItem @click="autoSaveEnabled = !autoSaveEnabled">
                  {{ autoSaveEnabled ? '关闭自动保存' : '开启自动保存' }}
                </ElDropdownItem>
                <ElDropdownItem
                  v-if="!isToolMode"
                  @click="applicationConfigOpen = true"
                >
                  应用配置
                </ElDropdownItem>
                <ElDropdownItem @click="rawDebugOpen = true">
                  调试原始流
                </ElDropdownItem>
                <ElDropdownItem @click="runLocalValidation(true)">
                  本地校验
                </ElDropdownItem>
              </ElDropdownMenu>
            </template>
          </ElDropdown>
        </div>
      </div>

      <WorkflowDesignerComponent
        ref="workflowDesignerRef"
        v-model:graph-data="workflowGraphJson"
        :foundation-mode="workflowFoundationMode"
        :palette-mode="workflowPaletteMode"
        @debug="debugStream"
        @local-validation-change="localValidation = $event"
        @raw-debug="rawDebugOpen = true"
      />

      <ElDrawer
        v-if="!isToolMode"
        v-model="applicationConfigOpen"
        title="应用配置"
        size="640px"
      >
        <div class="drawer-grid">
          <section>
            <div class="panel-title">应用配置</div>
            <ElInput v-model="applicationConfig" type="textarea" :rows="8" />
          </section>
        </div>
      </ElDrawer>

      <ElDrawer
        v-model="debugDrawerOpen"
        :title="debugDrawerTitle"
        size="520px"
      >
        <div class="debug-drawer">
          <ElInput v-model="debugMessage" placeholder="消息" />
          <ElInput v-model="debugInput" type="textarea" :rows="6" class="mt8" />
          <ElButton
            type="primary"
            class="full-action"
            :icon="VideoPlay"
            @click="debugStream"
          >
            运行调试
          </ElButton>
          <div class="run-events drawer-events">
            <div
              v-for="(event, index) in debugRows"
              :key="`${event.event}-${index}`"
              class="run-event"
              :class="`is-${event.status.toLowerCase()}`"
            >
              <span>{{ event.event }}</span>
              <strong>{{
                event.nodeName || event.nodeType || event.title
              }}</strong>
              <small>{{ event.nodeType || event.status }}</small>
            </div>
            <div v-if="debugRows.length === 0" class="empty-state">
              暂无调试事件
            </div>
          </div>
        </div>
      </ElDrawer>

      <ElDrawer
        v-model="versionsOpen"
        :title="versionsDrawerTitle"
        size="680px"
      >
        <ElTabs model-value="versions">
          <ElTabPane label="版本" name="versions">
            <ElTable
              v-loading="versionsLoading"
              :data="versions"
              size="small"
              height="calc(100vh - 160px)"
            >
              <ElTableColumn prop="versionNo" label="版本" width="110" />
              <ElTableColumn prop="status" label="状态" width="110" />
              <ElTableColumn
                prop="createTime"
                label="发布时间"
                min-width="180"
              />
              <ElTableColumn label="操作" width="110">
                <template #default="{ row }">
                  <ElButton
                    v-if="!isToolMode"
                    link
                    type="primary"
                    @click="restoreVersion(row)"
                  >
                    恢复
                  </ElButton>
                  <ElTag v-else size="small" type="info">仅查看</ElTag>
                </template>
              </ElTableColumn>
            </ElTable>
          </ElTabPane>
        </ElTabs>
      </ElDrawer>

      <ElDrawer v-model="rawDebugOpen" title="调试原始流" size="520px">
        <div class="stream-box raw-stream">
          <pre v-for="(event, index) in debugEvents" :key="index">{{
            event
          }}</pre>
        </div>
      </ElDrawer>
    </div>
  </Page>
</template>

<style scoped lang="scss">
.workflow-host {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.workflow-host :deep(.workflow-designer) {
  flex: 1;
  width: 100%;
  min-height: 0;
}

.toolbar {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: center;
}

.editor-header {
  position: relative;
  z-index: 20;
  flex-shrink: 0;
  justify-content: space-between;
  padding: 8px 10px;
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.header-left,
.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.header-left {
  min-width: 0;
}

.page-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.toolbar .el-select {
  width: 260px;
}

.debug-drawer {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 96px);
}

.drawer-grid {
  display: grid;
  gap: 12px;
}

.panel-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.full-action {
  width: 100%;
  margin-top: 8px;
}

.mt8 {
  margin-top: 8px;
}

.run-events {
  flex: 1;
  min-height: 120px;
  margin-top: 8px;
  overflow: auto;
}

.run-event {
  display: grid;
  grid-template-columns: 82px 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 8px;
  margin-bottom: 6px;
  font-size: 12px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-left-width: 4px;
  border-radius: 6px;
}

.run-event strong {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.run-event small,
.run-event span,
.empty-state {
  color: var(--el-text-color-secondary);
}

.run-event.is-running {
  border-left-color: var(--el-color-primary);
}

.run-event.is-stream {
  border-left-color: var(--el-color-info);
}

.run-event.is-success {
  border-left-color: var(--el-color-success);
}

.run-event.is-warning {
  border-left-color: var(--el-color-warning);
}

.run-event.is-failed {
  border-left-color: var(--el-color-danger);
}

.empty-state {
  padding: 8px;
  font-size: 12px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.stream-box {
  height: 100%;
  padding: 8px;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.stream-box pre {
  margin: 0 0 8px;
  white-space: pre-wrap;
}

.raw-stream {
  height: calc(100vh - 110px);
}
</style>
