<script setup lang="ts">
import type { ValidationState } from '../workflow/designer/validation';
import type WorkflowHostChrome from '../workflow/host/WorkflowHostChrome.vue';

import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Close } from '@element-plus/icons-vue';
import {
  ElButton,
  ElDrawer,
  ElDropdownItem,
  ElIcon,
  ElInput,
  ElMessage,
} from 'element-plus';

import {
  getWorkflowDraft,
  pageWorkflowVersions,
  publishWorkflow,
  restoreWorkflowVersion,
  saveWorkflowDraft,
  validateWorkflowDraft,
} from '#/api/ai/application-workflow';
import { getApplication, listApplications } from '#/api/ai/applications';
import AiChat from '#/components/ai-chat/index.vue';
import {
  createDebugChatRecord,
  resetDebugChatRecord,
} from '#/components/ai-chat/utils/chat';

import {
  APPLICATION_DETAIL_PATH,
  isWorkflowApplication,
} from '../applications/application-entry';
import { prettyJson, recordsOf, safeParseJson } from '../utils';
import { normalizeGraphData } from '../workflow/designer/graph-data';
import { DEFAULT_GRAPH_DATA } from '../workflow/designer/nodes';
import { normalizeBaseNodeApplicationInfo } from '../workflow/host/base-node-application-info';
import { buildDebugApplicationDetails } from '../workflow/host/debug-application-details';
import {
  showApiError,
  useAutoSave,
} from '../workflow/host/workflow-host-shared';
import WorkflowHostChromeComponent from '../workflow/host/WorkflowHostChrome.vue';

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

/** AiChat 需要的 applicationDetails：合并应用实体 + 图中 base-node 的 prologue / work_flow.nodes。 */
const debugApplicationDetails = computed(() =>
  buildDebugApplicationDetails(
    currentApplication.value || {},
    workflowGraphJson.value,
  ),
);

/** AiChat 需要的 chatRecord prop（新建空记录即可）。 */
const debugChatRecord = ref(createDebugChatRecord());

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
  return normalizeBaseNodeApplicationInfo(
    graphData,
    currentApplication.value || {},
  );
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
      path: APPLICATION_DETAIL_PATH,
      query: { applicationId: detail.id, tab: 'overview' },
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
    path: APPLICATION_DETAIL_PATH,
    query: { applicationId: applicationId.value, tab: 'overview' },
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
    syncBaseNodeApplicationInfo(
      normalizeGraphData(
        safeParseJson(workflowGraphJson.value, {}),
        true,
        true,
        'application',
      ),
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

async function toggleDebugPanel() {
  if (!runLocalValidation(true)) return;
  const graphData = chromeRef.value?.getGraphData?.();
  if (typeof graphData === 'string') {
    workflowGraphJson.value = prettyJson(
      syncBaseNodeApplicationInfo(
        normalizeGraphData(
          safeParseJson(graphData, {}),
          true,
          true,
          'application',
        ),
      ),
      DEFAULT_GRAPH_DATA,
    );
    await nextTick();
    await renderGraphData(false);
  }
  resetDebugChatRecord(debugChatRecord.value);
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
      <Transition name="debug-panel-transition">
        <div v-if="debugPanelVisible" class="debug-panel-ai-chat">
          <div class="dp-header">
            <div class="dp-title">
              <div class="dp-avatar">
                <img
                  v-if="currentApplication?.icon"
                  :src="currentApplication.icon"
                  alt=""
                />
                <span v-else>{{
                  (currentApplicationName || 'AI').slice(0, 1)
                }}</span>
              </div>
              <span class="dp-name" :title="currentApplicationName">{{
                currentApplicationName || '工作流调试'
              }}</span>
            </div>
            <div class="dp-actions">
              <ElButton link @click="debugPanelVisible = false">
                <ElIcon :size="18"><Close /></ElIcon>
              </ElButton>
            </div>
          </div>
          <AiChat
            :app-id="`${applicationId}`"
            :application-details="debugApplicationDetails"
            :chat-record="debugChatRecord"
            type="debug-ai-chat"
          />
        </div>
      </Transition>
    </template>
  </WorkflowHostChromeComponent>
</template>

<style scoped lang="scss">
.debug-panel-transition-enter-active,
.debug-panel-transition-leave-active {
  transition: all 0.3s ease;
}

.debug-panel-transition-enter-from,
.debug-panel-transition-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.debug-panel-ai-chat {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 30;
  display: flex;
  flex-direction: column;
  width: 460px;
  height: 680px;
  max-height: calc(100% - 32px);
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  box-shadow: var(--el-box-shadow-light);
}

.debug-panel-ai-chat :deep(.ai-chat) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.dp-header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.dp-title {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.dp-avatar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: var(--el-color-primary);
  border-radius: 6px;
}

.dp-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dp-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.dp-actions {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
  align-items: center;
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
</style>
