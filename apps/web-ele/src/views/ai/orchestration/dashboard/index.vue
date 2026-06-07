<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElDescriptions,
  ElDescriptionsItem,
  ElEmpty,
  ElOption,
  ElProgress,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';

import { listApplications, pageWorkflowRuns } from '#/api/ai/applications';
import { getApplicationStats, getDashboardStats } from '#/api/ai/dashboard';

import { prettyJson, recordsOf, statusType } from '../utils';

const loading = ref(false);
const stats = ref<any>({});
const applicationStats = ref<any>({});
const applications = ref<any[]>([]);
const selectedApplicationId = ref<number | string>();
const runs = ref<any[]>([]);

const metricItems = computed(() => {
  const data = stats.value?.data || stats.value || {};
  return [
    { label: '应用', value: data.applicationCount || data.applications || 0 },
    { label: '知识库', value: data.knowledgeCount || data.knowledge || 0 },
    { label: '工具', value: data.toolCount || data.tools || 0 },
    { label: '运行', value: data.runCount || data.workflowRuns || 0 },
    { label: 'Token', value: data.tokenUsage || data.tokens || 0 },
    { label: '失败', value: data.failedRuns || data.failures || 0 },
  ];
});

const topQuestions = computed(() => {
  const data = stats.value?.data || {};
  return data.topQuestions || data.questions || [];
});

async function loadDashboard() {
  loading.value = true;
  try {
    stats.value = await getDashboardStats();
    applications.value = recordsOf(await listApplications());
    if (!selectedApplicationId.value && applications.value.length > 0) {
      selectedApplicationId.value = applications.value[0].id;
    }
    await loadApplicationStats();
  } finally {
    loading.value = false;
  }
}

async function loadApplicationStats() {
  if (!selectedApplicationId.value) return;
  applicationStats.value = await getApplicationStats(
    selectedApplicationId.value,
  );
  const runPage = await pageWorkflowRuns(selectedApplicationId.value, {
    current: 1,
    page: 1,
    size: 8,
  });
  runs.value = recordsOf(runPage);
}

onMounted(loadDashboard);
</script>

<template>
  <Page auto-content-height>
    <div class="ops-page" v-loading="loading">
      <div class="toolbar">
        <div>
          <div class="page-title">AI 编排仪表盘</div>
          <div class="page-subtitle">运行、Token、问题命中和资源状态</div>
        </div>
        <div class="toolbar-actions">
          <ElSelect
            v-model="selectedApplicationId"
            filterable
            placeholder="选择应用"
            @change="loadApplicationStats"
          >
            <ElOption
              v-for="item in applications"
              :key="item.id"
              :label="item.name || item.title || item.id"
              :value="item.id"
            />
          </ElSelect>
          <ElButton type="primary" @click="loadDashboard">刷新</ElButton>
        </div>
      </div>

      <div class="metric-grid">
        <div v-for="item in metricItems" :key="item.label" class="metric-cell">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>

      <div class="split-grid">
        <section class="panel">
          <div class="panel-title">应用统计</div>
          <ElDescriptions :column="2" size="small" border>
            <ElDescriptionsItem label="运行成功">
              {{
                applicationStats?.data?.successRuns ||
                applicationStats?.successRuns ||
                0
              }}
            </ElDescriptionsItem>
            <ElDescriptionsItem label="运行失败">
              {{
                applicationStats?.data?.failedRuns ||
                applicationStats?.failedRuns ||
                0
              }}
            </ElDescriptionsItem>
            <ElDescriptionsItem label="平均耗时">
              {{
                applicationStats?.data?.avgRunTime ||
                applicationStats?.avgRunTime ||
                0
              }}
              ms
            </ElDescriptionsItem>
            <ElDescriptionsItem label="Token 消耗">
              {{
                applicationStats?.data?.tokenUsage ||
                applicationStats?.tokenUsage ||
                0
              }}
            </ElDescriptionsItem>
          </ElDescriptions>
          <ElProgress
            class="mt12"
            :percentage="Number(applicationStats?.data?.successRate || 0)"
            status="success"
          />
        </section>

        <section class="panel">
          <div class="panel-title">Top Questions</div>
          <ElTable
            v-if="topQuestions.length > 0"
            :data="topQuestions"
            size="small"
            height="210"
          >
            <ElTableColumn prop="question" label="问题" min-width="180" />
            <ElTableColumn prop="count" label="次数" width="80" />
          </ElTable>
          <ElEmpty v-else description="暂无问题统计" />
        </section>
      </div>

      <section class="panel grow-panel">
        <div class="panel-title">最近运行</div>
        <ElTable :data="runs" size="small" height="100%">
          <ElTableColumn prop="id" label="Run ID" width="90" />
          <ElTableColumn prop="status" label="状态" width="110">
            <template #default="{ row }">
              <ElTag :type="statusType(row.status)" size="small">
                {{ row.status || '-' }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn prop="startTime" label="开始时间" width="180" />
          <ElTableColumn prop="runTime" label="耗时(ms)" width="110" />
          <ElTableColumn label="输入 / 输出">
            <template #default="{ row }">
              <span class="mono-line">{{
                prettyJson(row.inputJson || row.outputJson, '-')
              }}</span>
            </template>
          </ElTableColumn>
        </ElTable>
      </section>
    </div>
  </Page>
</template>

<style scoped lang="scss">
.ops-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(120px, 1fr));
  gap: 8px;
}

.metric-cell {
  padding: 12px;
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.metric-cell span {
  display: block;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.metric-cell strong {
  display: block;
  margin-top: 6px;
  font-size: 22px;
  color: var(--el-text-color-primary);
}

.split-grid {
  display: grid;
  grid-template-columns: minmax(360px, 1fr) minmax(360px, 1fr);
  gap: 12px;
}

.panel {
  padding: 12px;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.grow-panel {
  flex: 1;
  min-height: 260px;
}

.panel-title {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
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
