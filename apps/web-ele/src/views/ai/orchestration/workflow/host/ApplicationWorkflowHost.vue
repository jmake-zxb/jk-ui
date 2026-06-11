<script setup lang="ts">
import type { ValidationState } from '../designer/validation';
import type WorkflowHostChrome from './WorkflowHostChrome.vue';

import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { ElDrawer, ElDropdownItem, ElInput, ElMessage } from 'element-plus';

import {
  getWorkflowDraft,
  pageWorkflowVersions,
  publishWorkflow,
  restoreWorkflowVersion,
  saveWorkflowDraft,
  validateWorkflowDraft,
} from '#/api/ai/application-workflow';
import { getApplication, listApplications } from '#/api/ai/applications';

import {
  APPLICATION_CHAT_PATH,
  isWorkflowApplication,
} from '../../applications/application-entry';
import { prettyJson, recordsOf, safeParseJson } from '../../utils';
import { normalizeGraphData } from '../designer/graph-data';
import { DEFAULT_GRAPH_DATA } from '../designer/nodes';
import DebugChatPanel from './workflow-debug/DebugChatPanel.vue';
import { showApiError, useAutoSave } from './workflow-host-shared';
import WorkflowHostChromeComponent from './WorkflowHostChrome.vue';

const props = defineProps<{ applicationId: number | string }>();

const router = useRouter();

const chromeRef = ref<InstanceType<typeof WorkflowHostChrome>>();
const applications = ref<any[]>([]);
const applicationDetail = ref<any>();
const applicationId = ref<number | string>(props.applicationId || '');
const workflowGraphJson = ref(DEFAULT_GRAPH_DATA);
const applicationConfig = ref('{}');
const validation = ref<any>();
const localValidation = ref<ValidationState>({ errors: [], warnings: [] });
const loading = ref(false);
const applicationConfigOpen = ref(false);
const versions = ref<any[]>([]);
const versionsLoading = ref(false);

const { autoSaveEnabled, lastSavedAt, markSaved, startAutoSave } = useAutoSave(
  () => autoSaveDraft(),
);
const debugPanelVisible = ref(false);

const currentApplication = computed(() =>
  `${applicationDetail.value?.id || ''}` === `${applicationId.value}`
    ? applicationDetail.value
    : applications.value.find(
        (item) => `${item.id}` === `${applicationId.value}`,
      ),
);
const currentApplicationName = computed(
  () => currentApplication.value?.name || applicationId.value || '未选择应用',
);
const subtitleText = computed(() => {
  if (lastSavedAt.value) return `最近保存 ${lastSavedAt.value}`;
  return autoSaveEnabled.value ? '自动保存开启' : '手动保存';
});
const publicAccessAvailable = computed(
  () =>
    currentApplication.value?.accessEnabled !== false && !!applicationId.value,
);

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

function syncGraphData() {
  chromeRef.value?.syncGraphData();
}

async function renderGraphData(fit = true) {
  await chromeRef.value?.renderGraphData(undefined, fit);
}

function runLocalValidation(showMessage = true) {
  return chromeRef.value?.runLocalValidation(showMessage) ?? true;
}

function backToApplications() {
  router.push('/ai/orchestration/applications/index');
}

function openPublicChat() {
  if (!applicationId.value) return;
  router.push({
    path: '/ai/orchestration/public-chat/index',
    query: { applicationId: applicationId.value },
  });
}

async function loadApplications() {
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

async function loadDraft() {
  if (!applicationId.value) return;
  loading.value = true;
  try {
    if (!(await loadApplicationDetail())) return;
    const draft = await getWorkflowDraft(applicationId.value);
    const graphValue = draft?.graphData || draft;
    const nextApplicationConfig = prettyJson(draft?.applicationConfig, '{}');
    const graphData = normalizeGraphData(
      safeParseJson(prettyJson(graphValue, DEFAULT_GRAPH_DATA), {}),
      true,
      true,
      'application',
    );
    workflowGraphJson.value = prettyJson(
      syncBaseNodeApplicationInfo(graphData),
      DEFAULT_GRAPH_DATA,
    );
    applicationConfig.value = nextApplicationConfig;
    localValidation.value = { errors: [], warnings: [] };
    validation.value = undefined;
    await nextTick();
    await renderGraphData(true);
    await loadVersions(false);
  } catch (error) {
    showApiError(error, '工作流草稿加载失败');
  } finally {
    loading.value = false;
  }
}

async function saveDraft(showMessage = true) {
  if (!applicationId.value) return false;
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
      'application',
    ),
    DEFAULT_GRAPH_DATA,
  );
  await saveWorkflowDraft(applicationId.value, {
    graphData: workflowGraphJson.value,
    applicationConfig: applicationConfig.value,
  });
  markSaved();
  if (showMessage) ElMessage.success('草稿已保存');
  return true;
}

async function autoSaveDraft() {
  if (!autoSaveEnabled.value || !applicationId.value) return;
  await saveDraft(false);
}

async function validateDraft() {
  if (!(await saveDraft(false))) return;
  validation.value = await validateWorkflowDraft(applicationId.value);
  ElMessage.success('校验完成');
}

async function publishDraft() {
  if (!(await saveDraft(false))) return;
  await publishWorkflow(applicationId.value, { description: '前端工作流发布' });
  ElMessage.success('发布成功');
  await loadVersions(false);
}

async function loadVersions(showLoading = true) {
  if (!applicationId.value) return;
  if (showLoading) versionsLoading.value = true;
  try {
    versions.value = recordsOf(
      await pageWorkflowVersions(applicationId.value, {
        current: 1,
        page: 1,
        size: 20,
      }),
    );
  } finally {
    versionsLoading.value = false;
  }
}

async function restoreVersion(row: any) {
  if (!row?.id) return;
  await restoreWorkflowVersion(applicationId.value, row.id);
  ElMessage.success('版本已恢复');
  await loadDraft();
}

function toggleDebugPanel() {
  if (!runLocalValidation(true)) return;
  debugPanelVisible.value = true;
}

function switchApplication(id: number | string) {
  applicationId.value = id;
  loadDraft();
}

watch(
  () => props.applicationId,
  (next) => {
    const nextId = `${next || ''}`;
    if (`${applicationId.value}` === nextId) return;
    applicationId.value = nextId;
    validation.value = undefined;
    localValidation.value = { errors: [], warnings: [] };
    loadApplications();
  },
);

onMounted(async () => {
  await loadApplications();
  startAutoSave();
});
</script>

<template>
  <WorkflowHostChromeComponent
    ref="chromeRef"
    v-model:graph-data="workflowGraphJson"
    :auto-save-enabled="autoSaveEnabled"
    back-list-label="应用管理"
    :can-restore-version="true"
    debug-drawer-title="工作流调试"
    debug-mode="panel"
    foundation-mode="application"
    :loading="loading"
    :local-validation="localValidation"
    palette-mode="application"
    :subtitle-text="subtitleText"
    :title="currentApplicationName"
    :validation="validation"
    :versions="versions"
    versions-drawer-title="发布历史"
    :versions-loading="versionsLoading"
    @back="backToApplications"
    @local-validation-change="localValidation = $event"
    @open-versions="loadVersions()"
    @publish="publishDraft"
    @restore-version="restoreVersion"
    @save="saveDraft()"
    @toggle-auto-save="autoSaveEnabled = !autoSaveEnabled"
    @toggle-debug="toggleDebugPanel"
    @validate="validateDraft"
  >
    <template #menu-before>
      <ElDropdownItem
        v-for="item in applications"
        :key="item.id"
        @click="switchApplication(item.id)"
      >
        切换到 {{ item.name || item.id }}
      </ElDropdownItem>
    </template>
    <template #menu-after>
      <ElDropdownItem
        :disabled="!publicAccessAvailable"
        @click="openPublicChat"
      >
        公开访问
      </ElDropdownItem>
      <ElDropdownItem @click="applicationConfigOpen = true">
        应用配置
      </ElDropdownItem>
    </template>
    <template #drawers>
      <ElDrawer v-model="applicationConfigOpen" title="应用配置" size="640px">
        <div class="drawer-grid">
          <section>
            <div class="panel-title">应用配置</div>
            <ElInput v-model="applicationConfig" type="textarea" :rows="8" />
          </section>
        </div>
      </ElDrawer>
    </template>
    <template #debug-panel>
      <DebugChatPanel
        v-model:visible="debugPanelVisible"
        :app-icon="currentApplication?.icon"
        :app-name="currentApplicationName"
        :application-id="applicationId"
        :run-local-validation="runLocalValidation"
      />
    </template>
  </WorkflowHostChromeComponent>
</template>

<style scoped lang="scss">
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
</style>
