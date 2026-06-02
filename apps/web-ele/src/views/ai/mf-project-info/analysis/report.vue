<script setup lang="ts">
import type { EchartsUIType } from '@vben/plugins/echarts';

import type { VxeGridProps } from '#/adapter/vxe-table';

import { nextTick, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import {
  CircleCheck,
  Money,
  Warning,
  WarningFilled,
} from '@element-plus/icons-vue';
import {
  ElAlert,
  ElButton,
  ElCard,
  ElCol,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDivider,
  ElIcon,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElPageHeader,
  ElRow,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getObj } from '#/api/ai/analysis';
import { fetchList, getReportInfo } from '#/api/ai/auditResult';

// 路由
const route = useRoute();
const router = useRouter();

// 响应式数据
const loading = ref(false);
const reportInfo = ref<any>({});
const summary = ref({
  totalViolations: 0,
  highRiskCount: 0,
  mediumRiskCount: 0,
  lowRiskCount: 0,
  totalAmount: 0,
  successRate: 0,
  successToal: 0,
});
const ruleResults = ref<any>([]);
const searchText = ref('');
const filterSeverity = ref('');

// 图表 ref
const riskPieChartRef = ref<EchartsUIType>();
const ruleTypeBarChartRef = ref<EchartsUIType>();
const trendChartRef = ref<EchartsUIType>();

// composables
const { renderEcharts: riskPieChart } = useEcharts(riskPieChartRef);
const { renderEcharts: ruleTypeBarChart } = useEcharts(ruleTypeBarChartRef);
const { renderEcharts: trendChart } = useEcharts(trendChartRef);

// 弹窗
const violationDetailVisible = ref(false);
const sqlVisible = ref(false);
const currentResult = ref<any>(null);
const currentSQL = ref('');
const violationDetails = ref([]);
const violationCols = ref([]);

const gridOptions: VxeGridProps = {
  height: '500px',
  columns: [
    { title: '#', type: 'seq', width: 40 },
    {
      field: 'auditRuleName',
      title: '报告名称',
    },
    {
      field: 'violationCount',
      title: '违规数量',
    },
    {
      field: 'severity',
      title: '风险等级',
    },
    {
      field: 'executedAt',
      title: '执行时间',
      width: 150,
    },
    {
      fixed: 'right',
      field: 'action',
      title: '操作',
      slots: { default: 'action' },
      width: 100,
    },
  ],
  pagerConfig: {
    pageSize: 10,
  },
  proxyConfig: {
    ajax: {
      query: async ({ page }) => {
        return await fetchList({
          current: page.currentPage,
          size: page.pageSize,
          analysisId: route.query.id,
        });
      },
    },
  },
  toolbarConfig: {
    custom: false,
    refresh: false,
    zoom: false,
    export: false,
  },
};

const [Grid, GridApi] = useVbenVxeGrid({
  gridOptions,
});

// 生命周期
onMounted(() => {
  const reportId = route.query.id as string;
  if (reportId) {
    loadReportDetail(reportId);
  }
});

// 加载报告详情
const loadReportDetail = async (reportId: string) => {
  loading.value = true;
  try {
    const res = await getObj({ id: reportId });
    reportInfo.value = res || {};
    const resInfo = await getReportInfo({ analysisId: reportId });
    ruleResults.value = resInfo || {};
    if (
      ruleResults.value?.executeStatusData &&
      ruleResults.value?.executeStatusData.length > 0
    ) {
      ruleResults.value?.executeStatusData.forEach(
        (item: { count: number; execute_status: string }) => {
          if (item.execute_status === 'SUCCESS') {
            summary.value.successToal = item.count;
            summary.value.successRate =
              item.count / reportInfo.value.executedRules || 0;
          }
        },
      );
    }
    await nextTick();
    initCharts();
  } finally {
    loading.value = false;
  }
};

// 初始化图表
const initCharts = () => {
  initRiskPieChart();
  initRuleTypeBarChart();
  initTrendChart();
};

// 风险等级饼图
const initRiskPieChart = () => {
  if (!riskPieChartRef.value) return;

  const data: any = [];
  if (
    ruleResults.value?.severityData &&
    ruleResults.value?.severityData.length > 0
  ) {
    ruleResults.value?.severityData.forEach(
      (item: { count: any; severity: string }) => {
        summary.value.totalViolations += item.count;
        if (item.severity === 'HIGH') {
          summary.value.highRiskCount = item.count;
          data.push({
            value: item.count,
            name: '高风险',
            itemStyle: { color: '#f56c6c' },
          });
        }
        if (item.severity === 'MEDIUM') {
          data.push({
            value: item.count,
            name: '中风险',
            itemStyle: { color: '#e6a23c' },
          });
        }
        if (item.severity === 'LOW') {
          data.push({
            value: item.count,
            name: '低风险',
            itemStyle: { color: '#909399' },
          });
        }
      },
    );
  }

  riskPieChart({
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'middle',
    },
    series: [
      {
        name: '风险等级',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: '{b}\n{c} ({d}%)',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold',
          },
        },
        labelLine: {
          show: false,
        },
        data: data.length > 0 ? data : [{ value: 0, name: '无违规' }],
      },
    ],
  });
};

// 规则类型柱状图
const initRuleTypeBarChart = () => {
  if (!ruleTypeBarChartRef.value) return;

  // 按规则类型统计
  const typeStats: any = {};

  if (
    ruleResults.value?.rwNameData &&
    ruleResults.value?.rwNameData.length > 0
  ) {
    ruleResults.value?.rwNameData.forEach(
      (item: { count: any; rw_name: number | string }) => {
        typeStats[item.rw_name] = { total: item.count };
      },
    );
  }

  const types = Object.keys(typeStats);
  const seriesData = types.map((type) => typeStats[type].total);

  ruleTypeBarChart({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: types,
      axisLabel: { interval: 0, rotate: 30 },
    },
    yAxis: {
      type: 'value',
      name: '违规数量',
    },
    series: [
      {
        name: '违规数量',
        type: 'bar',
        data: seriesData,
      },
    ],
  });
};

// 违规趋势图
const initTrendChart = () => {
  if (!trendChartRef.value) return;

  // 按违规数量排序，取前 10 条规则
  const sortedResults = [...ruleResults.value]
    .filter((r) => r.violationCount > 0)
    .slice(0, 10);

  trendChart({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: sortedResults.map((r) =>
        r.ruleName.length > 15 ? `${r.ruleName.slice(0, 15)}...` : r.ruleName,
      ),
      axisLabel: { interval: 0, rotate: 45 },
    },
    yAxis: {
      type: 'value',
      name: '违规数量',
    },
    series: [
      {
        name: '违规数量',
        type: 'line',
        data: sortedResults.map((r) => r.violationCount),
        smooth: true,
        areaStyle: {
          color: [
            { offset: 0, color: 'rgba(245, 108, 108, 0.5)' },
            { offset: 1, color: 'rgba(245, 108, 108, 0.1)' },
          ],
        },
        itemStyle: {
          color: '#f56c6c',
        },
        markPoint: {
          data: [
            { type: 'max', name: '最大值' },
            { type: 'min', name: '最小值' },
          ],
        },
      },
    ],
  });
};

// 导出报告
const handleExport = () => {
  ElMessageBox.confirm('是否导出完整报告（含图表）？', '导出报告', {
    confirmButtonText: '导出 PDF',
    cancelButtonText: '导出 Excel',
    type: 'info',
  }).then(() => {
    // TODO: 调用后端 PDF 导出接口
    ElMessage.info('PDF 导出功能开发中...');
  });
};

// 工具函数
const getTypeTag = (
  type:
    | 'amount_audit'
    | 'frequency_audit'
    | 'process_audit'
    | 'qualification_audit'
    | 'time_audit',
) => {
  const map = {
    amount_audit: 'warning',
    process_audit: 'info',
    qualification_audit: 'success',
    frequency_audit: '',
    time_audit: 'primary',
  };
  return map[type] || '';
};

const getSeverityTag = (severity: 'HIGH' | 'LOW' | 'MEDIUM'): any => {
  const map = { HIGH: 'danger', MEDIUM: 'warning', LOW: 'info' };
  return map[severity] || '';
};

const getStatusTag = (status: 'COMPLETED' | 'FAILED' | 'RUNNING'): any => {
  const map = {
    RUNNING: 'warning',
    COMPLETED: 'success',
    FAILED: 'danger',
  };
  return map[status];
};

const getStatusText = (status: 'COMPLETED' | 'FAILED' | 'RUNNING'): any => {
  const map = {
    RUNNING: '执行中',
    COMPLETED: '已完成',
    FAILED: '失败',
  };
  return map[status] || status;
};

const formatAmount = (val: number | string) => {
  if (!val) return '¥0.00';
  return `¥${Number(val).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (val: string) => {
  if (!val) return '-';
  return new Date(val).toLocaleString('zh-CN');
};

const goBack = () => {
  router.back();
};
</script>

<template>
  <div class="report-detail-container">
    <!-- 顶部导航栏 -->
    <div class="page-header">
      <ElPageHeader @back="goBack" title="返回报告列表">
        <template #content>
          <div class="header-content">
            <h2>{{ reportInfo.analysisName }}</h2>
            <ElTag :type="getStatusTag(reportInfo.analysisStatus)" size="large">
              {{ getStatusText(reportInfo.analysisStatus) }}
            </ElTag>
          </div>
        </template>
      </ElPageHeader>
    </div>

    <!-- 报告基本信息 -->
    <ElCard class="mb-4" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>📋 报告基本信息</span>
          <ElButton type="primary" size="small" @click="handleExport">
            📥 导出报告
          </ElButton>
        </div>
      </template>
      <ElDescriptions :column="4" border>
        <ElDescriptionsItem label="报告编号">
          {{ `RPT-${reportInfo.id}` }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="审计期间">
          {{ formatDate(reportInfo.startTime) }} 至
          {{ formatDate(reportInfo.endTime) }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="创建时间">
          {{ formatDate(reportInfo.createTime) }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="执行耗时">
          {{ (reportInfo.executeDuration / 1000).toFixed(2) }}s
        </ElDescriptionsItem>
        <ElDescriptionsItem label="规则总数">
          {{ reportInfo.totalRules }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="执行成功">
          {{ summary.successToal }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="政策文档">
          {{ reportInfo.docId || '全部' }}
        </ElDescriptionsItem>
      </ElDescriptions>
    </ElCard>

    <!-- 统计卡片 -->
    <ElRow :gutter="20" class="mb-4">
      <ElCol :span="6">
        <ElCard shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #f56c6c">
              <ElIcon><Warning /></ElIcon>
            </div>
            <div class="stat-info">
              <div class="stat-value" style="color: #f56c6c">
                {{ summary.totalViolations }}
              </div>
              <div class="stat-label">违规总数</div>
            </div>
          </div>
        </ElCard>
      </ElCol>
      <ElCol :span="6">
        <ElCard shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #e6a23c">
              <ElIcon><WarningFilled /></ElIcon>
            </div>
            <div class="stat-info">
              <div class="stat-value" style="color: #e6a23c">
                {{ summary.highRiskCount }}
              </div>
              <div class="stat-label">高风险</div>
            </div>
          </div>
        </ElCard>
      </ElCol>
      <ElCol :span="6">
        <ElCard shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #409eff">
              <ElIcon><Money /></ElIcon>
            </div>
            <div class="stat-info">
              <div class="stat-value" style="color: #409eff">
                {{ formatAmount(summary.totalAmount) }}
              </div>
              <div class="stat-label">中风险</div>
            </div>
          </div>
        </ElCard>
      </ElCol>
      <ElCol :span="6">
        <ElCard shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #67c23a">
              <ElIcon><CircleCheck /></ElIcon>
            </div>
            <div class="stat-info">
              <div class="stat-value" style="color: #67c23a">
                {{ (summary.successRate * 100).toFixed(2) }}%
              </div>
              <div class="stat-label">规则执行成功率</div>
            </div>
          </div>
        </ElCard>
      </ElCol>
    </ElRow>

    <!-- 图表区域 -->
    <ElRow :gutter="20" class="mb-4">
      <!-- 风险等级分布饼图 -->
      <ElCol :span="12">
        <ElCard shadow="hover">
          <template #header>
            <div class="card-header">
              <span>📊 风险等级分布</span>
            </div>
          </template>
          <EchartsUI ref="riskPieChartRef" class="h-[350px]" />
        </ElCard>
      </ElCol>

      <!-- 规则类型分布柱状图 -->
      <ElCol :span="12">
        <ElCard shadow="hover">
          <template #header>
            <div class="card-header">
              <span>📈 规则类型违规统计</span>
            </div>
          </template>
          <EchartsUI ref="ruleTypeBarChartRef" class="h-[350px]" />
        </ElCard>
      </ElCol>
    </ElRow>

    <!-- 违规趋势图 -->
    <ElCard shadow="hover" class="mb-4">
      <template #header>
        <div class="card-header">
          <span>📉 违规数量趋势（按规则）</span>
        </div>
      </template>
      <EchartsUI ref="trendChartRef" class="h-[300px]" />
    </ElCard>

    <!-- 规则执行结果表格 -->
    <ElCard shadow="hover">
      <template #header>
        <div class="card-header">
          <span>📋 规则执行结果明细</span>
          <div class="table-actions">
            <ElInput
              v-model="searchText"
              placeholder="搜索规则名称"
              prefix-icon="Search"
              clearable
              style="width: 200px; margin-right: 10px"
            />
            <ElSelect
              v-model="filterSeverity"
              placeholder="风险等级"
              clearable
              style="width: 120px; margin-right: 10px"
            >
              <ElOption label="全部" value="" />
              <ElOption label="高风险" value="HIGH" />
              <ElOption label="中风险" value="MEDIUM" />
              <ElOption label="低风险" value="LOW" />
            </ElSelect>
          </div>
        </div>
      </template>
      <Grid>
        <template #action>
          <ElButton link type="primary"> 规则详情 </ElButton>
        </template>
      </Grid>
    </ElCard>

    <!-- 违规详情弹窗 -->
    <ElDialog
      v-model="violationDetailVisible"
      title="🔍 违规详情"
      width="900px"
      :close-on-click-modal="false"
    >
      <ElDescriptions :column="2" border v-if="currentResult">
        <ElDescriptionsItem label="规则名称">
          {{ currentResult.ruleName }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="规则类型">
          <ElTag :type="getTypeTag(currentResult.ruleType)">
            {{ currentResult.ruleType }}
          </ElTag>
        </ElDescriptionsItem>
        <ElDescriptionsItem label="风险等级">
          <ElTag :type="getSeverityTag(currentResult.severity)" effect="dark">
            {{ currentResult.severity }}
          </ElTag>
        </ElDescriptionsItem>
        <ElDescriptionsItem label="违规数量">
          {{ currentResult.violationCount }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="涉及金额">
          {{ formatAmount(currentResult.involvedAmount) }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="执行耗时">
          {{ currentResult.executeDuration }}ms
        </ElDescriptionsItem>
        <ElDescriptionsItem label="执行时间" :span="2">
          {{ formatDate(currentResult.executedAt) }}
        </ElDescriptionsItem>
      </ElDescriptions>

      <ElDivider>
        违规记录明细（前 {{ violationDetails.length }} 条）
      </ElDivider>

      <ElTable :data="violationDetails" border max-height="400" stripe>
        <ElTableColumn
          v-for="col in violationCols"
          :key="col"
          :prop="col"
          :label="col"
          min-width="120"
          show-overflow-tooltip
        />
      </ElTable>
    </ElDialog>

    <!-- SQL 查看弹窗 -->
    <ElDialog v-model="sqlVisible" title="📝 执行 SQL" width="800px">
      <ElAlert
        title="⚠️ 这是实际执行的审计规则 SQL"
        type="warning"
        :closable="false"
        style="margin-bottom: 15px"
      />
      <ElInput
        v-model="currentSQL"
        type="textarea"
        :rows="15"
        readonly
        style="font-family: 'Courier New', monospace; font-size: 13px"
      />
    </ElDialog>
  </div>
</template>

<style scoped>
.report-detail-container {
  padding: 20px;
  min-height: 100vh;
}

.page-header {
  margin-bottom: 20px;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 15px;
}

.header-content h2 {
  margin: 0;
  font-size: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
}

.mb-4 {
  margin-bottom: 20px;
}

.stat-card {
  height: 100px;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 15px;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  line-height: 1;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 13px;
}

.table-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pagination-container {
  margin-top: 20px;
}

:deep(.el-descriptions__label) {
  width: 120px;
  font-weight: bold;
}

/* 响应式 */
@media screen and (max-width: 768px) {
  .stat-card {
    margin-bottom: 15px;
  }

  .table-actions {
    flex-wrap: wrap;
  }
}
</style>
