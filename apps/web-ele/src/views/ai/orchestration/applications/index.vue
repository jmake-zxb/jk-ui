<script setup lang="ts">
import type { ApplicationPayload } from '#/api/ai/types';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { confirm, Page } from '@vben/common-ui';

import { Connection, Plus, Promotion, Tickets } from '@element-plus/icons-vue';
import {
  ElButton,
  ElCheckbox,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDrawer,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
  ElTag,
} from 'element-plus';

import {
  batchDeleteApplications,
  copyApplication,
  createAccessToken,
  createApplication,
  createApplicationKey,
  deleteAccessToken,
  deleteApplication,
  deleteApplicationKey,
  getWorkflowDraft,
  pageAccessTokens,
  pageApplicationKeys,
  pageApplications,
  pageWorkflowVersions,
  publishWorkflow,
  restoreWorkflowVersion,
  saveWorkflowDraft,
  toggleAccessToken,
  toggleApplicationKey,
  updateApplication,
} from '#/api/ai/applications';
import { getApplicationStats } from '#/api/ai/dashboard';

import { enabledText, prettyJson, recordsOf, totalOf } from '../utils';

const router = useRouter();
const loading = ref(false);
const applications = ref<any[]>([]);
const total = ref(0);
const query = reactive({
  access: '',
  current: 1,
  name: '',
  page: 1,
  publish: '',
  size: 24,
  type: '',
});

const selectedIds = ref<Array<number | string>>([]);
const dialogOpen = ref(false);
const editingId = ref<number | string>();
const form = reactive<ApplicationPayload>({
  accessEnabled: true,
  description: '',
  icon: 'App',
  name: '',
  showGuide: true,
  showHistory: true,
  showSource: true,
  type: 'WORK_FLOW',
  workspaceId: 'default',
});

const drawerOpen = ref(false);
const activeApp = ref<any>();
const detailTab = ref('overview');
const workflowGraphData = ref('{}');
const applicationConfig = ref('{}');
const accessTokens = ref<any[]>([]);
const appKeys = ref<any[]>([]);
const versions = ref<any[]>([]);
const applicationStats = ref<any>({});

const drawerTitle = computed(() => activeApp.value?.name || '应用详情');
const activeAppId = computed(() => activeApp.value?.id);
const selectedApps = computed(() =>
  applications.value.filter((item) => selectedIds.value.includes(item.id)),
);
const filteredApplications = computed(() =>
  applications.value.filter((item) => {
    const typeMatched =
      !query.type || normalizeAppType(item.type) === query.type;
    const accessMatched =
      !query.access || `${item.accessEnabled !== false}` === query.access;
    const publishMatched =
      !query.publish || publishState(item) === query.publish;
    return typeMatched && accessMatched && publishMatched;
  }),
);
const publicLink = computed(() =>
  activeAppId.value
    ? `/ai/orchestration/public-chat/index?applicationId=${activeAppId.value}`
    : '-',
);
const apiBaseUrl = computed(() =>
  activeAppId.value ? `/v1/applications/${activeAppId.value}` : '-',
);
const statSource = computed(
  () => applicationStats.value?.data || applicationStats.value || {},
);
const statItems = computed(() => [
  {
    label: '成功运行',
    value: statSource.value.successRuns || statSource.value.success || 0,
  },
  {
    label: '失败运行',
    value: statSource.value.failedRuns || statSource.value.failures || 0,
  },
  {
    label: '平均耗时',
    value: `${statSource.value.avgRunTime || statSource.value.avgDuration || 0} ms`,
  },
  {
    label: 'Token',
    value: statSource.value.tokenUsage || statSource.value.tokens || 0,
  },
]);

function normalizeAppType(type?: string) {
  const value = `${type || 'WORK_FLOW'}`.toUpperCase();
  return value === 'WORKFLOW' ? 'WORK_FLOW' : value;
}

function appTypeLabel(type?: string) {
  const value = normalizeAppType(type);
  if (value === 'CHAT') return '聊天应用';
  if (value === 'SIMPLE') return '简单应用';
  return '工作流应用';
}

function publishState(row: any) {
  const value =
    `${row.publishStatus || row.status || row.workflowStatus || ''}`.toUpperCase();
  if (['ONLINE', 'PUBLISHED', 'RELEASED'].includes(value)) return 'published';
  if (['DRAFT', 'UNPUBLISHED'].includes(value)) return 'draft';
  return row.lastPublishTime || row.publishTime ? 'published' : 'draft';
}

function publishLabel(row: any) {
  return publishState(row) === 'published' ? '已发布' : '草稿';
}

function publishTagType(row: any) {
  return publishState(row) === 'published' ? 'success' : 'warning';
}

async function loadApplications() {
  loading.value = true;
  try {
    const data = await pageApplications({
      current: query.current,
      name: query.name,
      page: query.page,
      size: query.size,
    });
    applications.value = recordsOf(data);
    total.value = totalOf(data);
    selectedIds.value = selectedIds.value.filter((id) =>
      applications.value.some((item) => item.id === id),
    );
  } finally {
    loading.value = false;
  }
}

function resetForm(row?: any, type = 'WORK_FLOW') {
  editingId.value = row?.id;
  Object.assign(form, {
    accessEnabled: row?.accessEnabled !== false,
    description: row?.description || '',
    folderId: row?.folderId,
    icon: row?.icon || 'App',
    name: row?.name || '',
    showGuide: row?.showGuide !== false,
    showHistory: row?.showHistory !== false,
    showSource: row?.showSource !== false,
    type: row?.type || type,
    workspaceId: row?.workspaceId || 'default',
  });
}

function openDialog(row?: any, type = 'WORK_FLOW') {
  resetForm(row, type);
  dialogOpen.value = true;
}

async function saveApplication() {
  if (!form.name) {
    ElMessage.warning('请输入应用名称');
    return;
  }
  const payload = { ...form };
  const saved = await (editingId.value
    ? updateApplication(editingId.value, payload)
    : createApplication(payload));
  ElMessage.success('保存成功');
  dialogOpen.value = false;
  await loadApplications();
  if (!editingId.value && normalizeAppType(payload.type) === 'WORK_FLOW') {
    const created =
      saved && typeof saved === 'object' && 'id' in saved
        ? saved
        : applications.value.find((item) => item.name === payload.name);
    if (created?.id) {
      openWorkflow(created);
      return;
    }
  }
  if (activeApp.value?.id === editingId.value) {
    activeApp.value =
      applications.value.find((item) => item.id === editingId.value) ||
      activeApp.value;
  }
}

async function saveSettings() {
  if (!activeAppId.value) return;
  await updateApplication(activeAppId.value, { ...form });
  ElMessage.success('设置已保存');
  await loadApplications();
  activeApp.value =
    applications.value.find((item) => item.id === activeAppId.value) ||
    activeApp.value;
}

function removeApplication(row: any) {
  confirm(`确认删除应用 ${row.name || row.id}？`).then(async () => {
    await deleteApplication(row.id);
    ElMessage.success('删除成功');
    await loadApplications();
  });
}

function removeSelectedApplications() {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('请选择要删除的应用');
    return;
  }
  confirm(`确认删除选中的 ${selectedIds.value.length} 个应用？`).then(
    async () => {
      await batchDeleteApplications([...selectedIds.value]);
      ElMessage.success('批量删除成功');
      selectedIds.value = [];
      await loadApplications();
    },
  );
}

async function duplicateApplication(row: any) {
  await copyApplication(row.id);
  ElMessage.success('复制成功');
  await loadApplications();
}

function isSelected(row: any) {
  return selectedIds.value.includes(row.id);
}

function toggleSelection(row: any, checked: boolean) {
  selectedIds.value = checked
    ? [...new Set([row.id, ...selectedIds.value])]
    : selectedIds.value.filter((id) => id !== row.id);
}

async function openDetailDrawer(row: any, tab = 'overview') {
  activeApp.value = row;
  detailTab.value = tab;
  resetForm(row);
  drawerOpen.value = true;
  await Promise.all([
    loadDraft(),
    loadTokens(),
    loadKeys(),
    loadVersions(),
    loadStats(),
  ]);
}

async function loadStats() {
  if (!activeAppId.value) return;
  try {
    applicationStats.value = await getApplicationStats(activeAppId.value);
  } catch {
    applicationStats.value = {};
  }
}

async function loadDraft() {
  if (!activeAppId.value) return;
  const draft = await getWorkflowDraft(activeAppId.value);
  workflowGraphData.value = prettyJson(draft?.graphData || draft, '{}');
  applicationConfig.value = prettyJson(draft?.applicationConfig, '{}');
}

async function loadTokens() {
  if (!activeAppId.value) return;
  accessTokens.value = recordsOf(
    await pageAccessTokens(activeAppId.value, {
      current: 1,
      page: 1,
      size: 20,
    }),
  );
}

async function loadKeys() {
  if (!activeAppId.value) return;
  appKeys.value = recordsOf(
    await pageApplicationKeys(activeAppId.value, {
      current: 1,
      page: 1,
      size: 20,
    }),
  );
}

async function loadVersions() {
  if (!activeAppId.value) return;
  versions.value = recordsOf(
    await pageWorkflowVersions(activeAppId.value, {
      current: 1,
      page: 1,
      size: 20,
    }),
  );
}

async function saveDraft() {
  if (!activeAppId.value) return;
  await saveWorkflowDraft(activeAppId.value, {
    applicationConfig: applicationConfig.value,
    graphData: workflowGraphData.value,
  });
  ElMessage.success('草稿已保存');
}

async function publishActiveWorkflow() {
  if (!activeAppId.value) return;
  await publishWorkflow(activeAppId.value, { description: '从应用管理发布' });
  ElMessage.success('发布成功');
  await loadVersions();
}

async function addToken() {
  await createAccessToken(activeAppId.value, {
    enabled: true,
    name: '访问令牌',
  });
  ElMessage.success('令牌已创建');
  await loadTokens();
}

async function addKey() {
  await createApplicationKey(activeAppId.value, {
    enabled: true,
    name: 'API Key',
  });
  ElMessage.success('密钥已创建');
  await loadKeys();
}

async function toggleToken(row: any) {
  await toggleAccessToken(activeAppId.value, row.id, !row.enabled);
  await loadTokens();
}

async function toggleKey(row: any) {
  await toggleApplicationKey(activeAppId.value, row.id, !row.enabled);
  await loadKeys();
}

async function removeToken(row: any) {
  await deleteAccessToken(activeAppId.value, row.id);
  await loadTokens();
}

async function removeKey(row: any) {
  await deleteApplicationKey(activeAppId.value, row.id);
  await loadKeys();
}

async function restoreVersion(row: any) {
  await restoreWorkflowVersion(activeAppId.value, row.id);
  ElMessage.success('已恢复到草稿');
  await loadDraft();
}

function openWorkflow(row = activeApp.value) {
  if (!row?.id) return;
  router.push({
    path: '/ai/orchestration/workflow/index',
    query: { applicationId: row.id },
  });
}

function openPublic(row = activeApp.value) {
  if (!row?.id) return;
  router.push({
    path: '/ai/orchestration/public-chat/index',
    query: { applicationId: row.id },
  });
}

onMounted(loadApplications);
</script>

<template>
  <Page auto-content-height>
    <div class="app-manager" v-loading="loading">
      <section class="manager-hero">
        <div>
          <div class="eyebrow">APPLICATIONS</div>
          <h2>AI 应用管理</h2>
          <p>以应用卡片为入口，集中管理概览、访问、发布版本和工作流草稿。</p>
        </div>
        <div class="hero-actions">
          <ElButton @click="loadApplications">刷新</ElButton>
          <ElButton
            :disabled="selectedIds.length === 0"
            type="danger"
            @click="removeSelectedApplications"
          >
            批量删除 {{ selectedIds.length > 0 ? selectedIds.length : '' }}
          </ElButton>
          <ElDropdown trigger="click">
            <ElButton :icon="Plus" type="primary">创建应用</ElButton>
            <template #dropdown>
              <ElDropdownMenu>
                <ElDropdownItem @click="openDialog(undefined, 'CHAT')">
                  简单 / 聊天应用
                </ElDropdownItem>
                <ElDropdownItem @click="openDialog(undefined, 'WORK_FLOW')">
                  工作流应用
                </ElDropdownItem>
              </ElDropdownMenu>
            </template>
          </ElDropdown>
        </div>
      </section>

      <section class="filter-bar">
        <ElInput
          v-model="query.name"
          clearable
          placeholder="按应用名称搜索"
          @keyup.enter="loadApplications"
        />
        <ElSelect v-model="query.type" clearable placeholder="类型">
          <ElOption label="工作流应用" value="WORK_FLOW" />
          <ElOption label="聊天应用" value="CHAT" />
          <ElOption label="简单应用" value="SIMPLE" />
        </ElSelect>
        <ElSelect v-model="query.publish" clearable placeholder="发布状态">
          <ElOption label="已发布" value="published" />
          <ElOption label="草稿" value="draft" />
        </ElSelect>
        <ElSelect v-model="query.access" clearable placeholder="访问状态">
          <ElOption label="公开访问" value="true" />
          <ElOption label="停用访问" value="false" />
        </ElSelect>
        <ElButton type="primary" @click="loadApplications">查询</ElButton>
      </section>

      <section class="selection-strip" v-if="selectedIds.length > 0">
        <span>已选择 {{ selectedIds.length }} 个应用</span>
        <span class="muted">{{
          selectedApps.map((item) => item.name || item.id).join('、')
        }}</span>
      </section>

      <section class="application-grid" v-if="filteredApplications.length > 0">
        <article
          v-for="item in filteredApplications"
          :key="item.id"
          class="application-card"
        >
          <div class="card-topline">
            <ElCheckbox
              :model-value="isSelected(item)"
              @change="(checked) => toggleSelection(item, !!checked)"
            />
            <ElTag size="small" :type="publishTagType(item)">
              {{ publishLabel(item) }}
            </ElTag>
          </div>
          <button
            class="card-main"
            type="button"
            @click="openDetailDrawer(item, 'overview')"
          >
            <span class="app-avatar">{{
              (item.name || 'A').slice(0, 1).toUpperCase()
            }}</span>
            <span class="app-copy">
              <strong>{{ item.name || item.id }}</strong>
              <em>{{ item.description || '暂无描述，点击完善应用设置' }}</em>
            </span>
          </button>
          <div class="card-meta">
            <ElTag size="small">{{ appTypeLabel(item.type) }}</ElTag>
            <ElTag
              :type="item.accessEnabled === false ? 'info' : 'success'"
              size="small"
            >
              {{ enabledText(item.accessEnabled) }}访问
            </ElTag>
            <span>{{ item.workspaceId || 'default' }}</span>
          </div>
          <div class="card-stats">
            <span>
              版本{{
                item.versionNo ||
                item.version ||
                (versions.length > 0 ? versions.length : '-')
              }}
            </span>
            <span>{{
              item.updateTime || item.createTime || '未记录时间'
            }}</span>
          </div>
          <div class="card-actions">
            <ElButton
              link
              type="primary"
              @click="openDetailDrawer(item, 'overview')"
            >
              概览
            </ElButton>
            <ElButton link type="primary" @click="openWorkflow(item)">
              工作流
            </ElButton>
            <ElButton link @click="openDetailDrawer(item, 'settings')">
              设置
            </ElButton>
            <ElButton link @click="openDetailDrawer(item, 'access')">
              访问
            </ElButton>
            <ElDropdown trigger="click">
              <ElButton link>更多</ElButton>
              <template #dropdown>
                <ElDropdownMenu>
                  <ElDropdownItem @click="openDetailDrawer(item, 'workflow')">
                    版本 / 发布
                  </ElDropdownItem>
                  <ElDropdownItem @click="duplicateApplication(item)">
                    复制应用
                  </ElDropdownItem>
                  <ElDropdownItem @click="removeApplication(item)">
                    删除应用
                  </ElDropdownItem>
                </ElDropdownMenu>
              </template>
            </ElDropdown>
          </div>
        </article>
      </section>
      <ElEmpty v-else class="empty-panel" description="暂无匹配应用" />
      <div class="pager">
        共 {{ total }} 条，当前显示 {{ filteredApplications.length }} 条
      </div>

      <ElDialog
        v-model="dialogOpen"
        :title="editingId ? '编辑应用' : '新增应用'"
        width="560px"
      >
        <ElForm label-width="90px" :model="form">
          <ElFormItem label="名称"><ElInput v-model="form.name" /></ElFormItem>
          <ElFormItem label="描述">
            <ElInput v-model="form.description" type="textarea" :rows="3" />
          </ElFormItem>
          <ElFormItem label="类型">
            <ElSelect v-model="form.type">
              <ElOption label="工作流" value="WORK_FLOW" />
              <ElOption label="聊天" value="CHAT" />
              <ElOption label="简单" value="SIMPLE" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="工作空间">
            <ElInput v-model="form.workspaceId" />
          </ElFormItem>
          <ElFormItem label="能力">
            <div class="switch-row">
              <ElSwitch v-model="form.accessEnabled" active-text="公开访问" />
              <ElSwitch v-model="form.showSource" active-text="引用来源" />
              <ElSwitch v-model="form.showHistory" active-text="历史" />
              <ElSwitch v-model="form.showGuide" active-text="引导" />
            </div>
          </ElFormItem>
        </ElForm>
        <template #footer>
          <ElButton @click="dialogOpen = false">取消</ElButton>
          <ElButton type="primary" @click="saveApplication">保存</ElButton>
        </template>
      </ElDialog>

      <ElDrawer v-model="drawerOpen" :title="drawerTitle" size="860px">
        <ElTabs v-model="detailTab" class="detail-tabs">
          <ElTabPane label="概览" name="overview">
            <section class="detail-section overview-head">
              <div class="app-avatar large">
                {{ (activeApp?.name || 'A').slice(0, 1).toUpperCase() }}
              </div>
              <div>
                <h3>{{ activeApp?.name || '-' }}</h3>
                <p>{{ activeApp?.description || '暂无应用描述' }}</p>
                <div class="card-meta">
                  <ElTag>{{ appTypeLabel(activeApp?.type) }}</ElTag>
                  <ElTag
                    :type="
                      activeApp?.accessEnabled === false ? 'info' : 'success'
                    "
                  >
                    {{ enabledText(activeApp?.accessEnabled) }}访问
                  </ElTag>
                  <ElTag :type="publishTagType(activeApp)">
                    {{ publishLabel(activeApp) }}
                  </ElTag>
                </div>
              </div>
            </section>
            <div class="stat-grid">
              <div
                v-for="item in statItems"
                :key="item.label"
                class="stat-cell"
              >
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
            <ElDescriptions :column="1" border size="small">
              <ElDescriptionsItem label="公开访问链接">
                {{ publicLink }}
              </ElDescriptionsItem>
              <ElDescriptionsItem label="API Base URL">
                {{ apiBaseUrl }}
              </ElDescriptionsItem>
              <ElDescriptionsItem label="工作空间">
                {{ activeApp?.workspaceId || 'default' }}
              </ElDescriptionsItem>
              <ElDescriptionsItem label="创建 / 更新">
                {{ activeApp?.createTime || '-' }} /
                {{ activeApp?.updateTime || '-' }}
              </ElDescriptionsItem>
            </ElDescriptions>
            <div class="drawer-toolbar mt12">
              <ElButton type="primary" @click="openWorkflow()">
                进入工作流编辑器
              </ElButton>
              <ElButton @click="openPublic()">打开公开访问</ElButton>
            </div>
          </ElTabPane>

          <ElTabPane label="设置" name="settings">
            <ElForm label-width="100px" :model="form">
              <ElFormItem label="应用名称">
                <ElInput v-model="form.name" />
              </ElFormItem>
              <ElFormItem label="应用描述">
                <ElInput v-model="form.description" type="textarea" :rows="4" />
              </ElFormItem>
              <ElFormItem label="应用类型">
                <ElSelect v-model="form.type">
                  <ElOption label="工作流" value="WORK_FLOW" /><ElOption
                    label="聊天"
                    value="CHAT"
                  /><ElOption label="简单" value="SIMPLE" />
                </ElSelect>
              </ElFormItem>
              <ElFormItem label="工作空间">
                <ElInput v-model="form.workspaceId" />
              </ElFormItem>
              <ElFormItem label="访问能力">
                <div class="switch-row">
                  <ElSwitch
                    v-model="form.accessEnabled"
                    active-text="公开访问"
                  /><ElSwitch
                    v-model="form.showSource"
                    active-text="引用来源"
                  /><ElSwitch
                    v-model="form.showHistory"
                    active-text="历史记录"
                  /><ElSwitch v-model="form.showGuide" active-text="开场引导" />
                </div>
              </ElFormItem>
              <ElButton type="primary" @click="saveSettings">保存设置</ElButton>
            </ElForm>
          </ElTabPane>

          <ElTabPane label="访问" name="access">
            <div class="access-grid">
              <section class="detail-section">
                <div class="section-title">
                  <span>访问令牌</span>
                  <ElButton size="small" type="primary" @click="addToken">
                    创建令牌
                  </ElButton>
                </div>
                <ElTable :data="accessTokens" size="small">
                  <ElTableColumn prop="name" label="名称" />
                  <ElTableColumn prop="token" label="Token" min-width="220" />
                  <ElTableColumn label="状态" width="90">
                    <template #default="{ row }">
                      <ElTag size="small">
                        {{ enabledText(row.enabled) }}
                      </ElTag>
                    </template>
                  </ElTableColumn>
                  <ElTableColumn label="操作" width="150">
                    <template #default="{ row }">
                      <ElButton link @click="toggleToken(row)">切换</ElButton>
                      <ElButton link type="danger" @click="removeToken(row)">
                        删除
                      </ElButton>
                    </template>
                  </ElTableColumn>
                </ElTable>
              </section>
              <section class="detail-section">
                <div class="section-title">
                  <span>API Keys</span>
                  <ElButton size="small" type="primary" @click="addKey">
                    创建 Key
                  </ElButton>
                </div>
                <ElTable :data="appKeys" size="small">
                  <ElTableColumn prop="name" label="名称" />
                  <ElTableColumn prop="keyValue" label="Key" min-width="220" />
                  <ElTableColumn label="状态" width="90">
                    <template #default="{ row }">
                      <ElTag size="small">
                        {{ enabledText(row.enabled) }}
                      </ElTag>
                    </template>
                  </ElTableColumn>
                  <ElTableColumn label="操作" width="150">
                    <template #default="{ row }">
                      <ElButton link @click="toggleKey(row)">切换</ElButton>
                      <ElButton link type="danger" @click="removeKey(row)">
                        删除
                      </ElButton>
                    </template>
                  </ElTableColumn>
                </ElTable>
              </section>
            </div>
          </ElTabPane>

          <ElTabPane label="工作流" name="workflow">
            <div class="drawer-toolbar">
              <ElButton type="primary" @click="saveDraft">保存草稿</ElButton>
              <ElButton :icon="Promotion" @click="publishActiveWorkflow">
                发布
              </ElButton>
              <ElButton :icon="Connection" @click="openWorkflow()">
                完整编辑器
              </ElButton>
            </div>
            <ElInput
              v-model="workflowGraphData"
              class="mt12"
              type="textarea"
              :rows="12"
              placeholder="graphData JSON"
            />
            <ElInput
              v-model="applicationConfig"
              class="mt8"
              type="textarea"
              :rows="5"
              placeholder="applicationConfig JSON"
            />
            <section class="detail-section mt12">
              <div class="section-title">
                <span>版本历史</span>
                <span class="muted">发布后可恢复到草稿</span>
              </div>
              <ElTable :data="versions" size="small">
                <ElTableColumn prop="versionNo" label="版本" width="90" />
                <ElTableColumn prop="status" label="状态" width="100" />
                <ElTableColumn prop="createTime" label="发布时间" width="170" />
                <ElTableColumn prop="graphData" label="Graph">
                  <template #default="{ row }">
                    <span class="mono-line">{{
                      prettyJson(row.graphData, '-')
                    }}</span>
                  </template>
                </ElTableColumn>
                <ElTableColumn label="操作" width="100">
                  <template #default="{ row }">
                    <ElButton
                      :icon="Tickets"
                      link
                      type="primary"
                      @click="restoreVersion(row)"
                    >
                      恢复
                    </ElButton>
                  </template>
                </ElTableColumn>
              </ElTable>
            </section>
          </ElTabPane>
        </ElTabs>
      </ElDrawer>
    </div>
  </Page>
</template>

<style scoped lang="scss">
.app-manager {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  overflow: hidden;
}

.manager-hero,
.filter-bar,
.selection-strip,
.detail-section,
.empty-panel {
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.manager-hero {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background:
    radial-gradient(
      circle at 8% 20%,
      var(--el-color-primary-light-9),
      transparent 30%
    ),
    hsl(var(--card));
}

.eyebrow,
.muted,
.pager,
.card-stats,
.app-copy em,
.manager-hero p {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.manager-hero h2 {
  margin: 2px 0 4px;
  font-size: 20px;
  color: var(--el-text-color-primary);
}

.manager-hero p {
  margin: 0;
}

.hero-actions,
.filter-bar,
.drawer-toolbar,
.switch-row,
.card-actions,
.card-meta,
.section-title,
.selection-strip {
  display: flex;
  gap: 8px;
  align-items: center;
}

.filter-bar {
  flex-shrink: 0;
  padding: 10px;
}

.filter-bar .el-input {
  width: 280px;
}

.filter-bar .el-select {
  width: 150px;
}

.selection-strip {
  flex-shrink: 0;
  padding: 8px 10px;
}

.application-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
  min-height: 0;
  padding-right: 2px;
  overflow: auto;
}

.application-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-top: 4px solid var(--el-color-primary-light-5);
  border-radius: 6px;
  transition:
    border-color var(--el-transition-duration),
    box-shadow var(--el-transition-duration),
    transform var(--el-transition-duration);
}

.application-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 10px 26px rgb(15 23 42 / 8%);
  transform: translateY(-1px);
}

.card-topline,
.card-main,
.overview-head {
  display: flex;
  gap: 10px;
  align-items: center;
}

.card-topline {
  justify-content: space-between;
}

.card-main {
  padding: 0;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.app-avatar {
  display: inline-flex;
  flex: 0 0 38px;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  font-weight: 800;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 6px;
}

.app-avatar.large {
  width: 52px;
  height: 52px;
  font-size: 20px;
}

.app-copy {
  min-width: 0;
}

.app-copy strong {
  display: block;
  color: var(--el-text-color-primary);
}

.app-copy em {
  display: block;
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-style: normal;
  white-space: nowrap;
}

.card-meta {
  flex-wrap: wrap;
}

.card-meta span {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.card-stats {
  display: flex;
  justify-content: space-between;
}

.card-actions {
  padding-top: 4px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.pager {
  flex-shrink: 0;
}

.detail-tabs {
  height: 100%;
}

.detail-tabs :deep(.el-tabs__content) {
  height: calc(100% - 48px);
  overflow: auto;
}

.overview-head {
  padding: 12px;
  margin-bottom: 12px;
}

.overview-head h3 {
  margin: 0 0 4px;
  font-size: 18px;
}

.overview-head p {
  margin: 0 0 8px;
  color: var(--el-text-color-secondary);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.stat-cell {
  padding: 10px;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.stat-cell span {
  display: block;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.stat-cell strong {
  display: block;
  margin-top: 5px;
  color: var(--el-text-color-primary);
}

.access-grid {
  display: grid;
  gap: 12px;
}

.detail-section {
  padding: 12px;
}

.section-title {
  justify-content: space-between;
  margin-bottom: 10px;
  font-weight: 600;
}

.mt8 {
  margin-top: 8px;
}

.mt12 {
  margin-top: 12px;
}

.mono-line {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: nowrap;
}
</style>
