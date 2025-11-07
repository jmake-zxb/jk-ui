<script setup lang="ts" name="Cache">
import type { EchartsUIType } from '@vben/plugins/echarts';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { ElCard } from 'element-plus';

import { systemCache } from '#/api/admin/system';

// refs
const commandChartRef = ref<EchartsUIType>();
const memoryChartRef = ref<EchartsUIType>();

// composables
const { renderEcharts: renderCommandChart } = useEcharts(commandChartRef);
const { renderEcharts: renderMemoryChart } = useEcharts(memoryChartRef);

// data
const baseInfo = ref<Record<string, any>>({});

// load data
const loadCacheData = async () => {
  const res = await systemCache();
  const data = res.data || res; // 兼容不同返回结构

  baseInfo.value = data.info || {};
  baseInfo.value.dbSize = data.dbSize;

  // 命令统计：确保 value 是 number
  const commandStats = (data.commandStats || []).map((item: any) => ({
    name: item.name || 'unknown',
    value: Number(item.value) || 0,
  }));

  // 渲染命令饼图
  await renderCommandChart({
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: '85%',
        label: { show: true },
        labelLine: { show: true },
        color: [
          '#0D47A1',
          '#1565C0',
          '#1976D2',
          '#1E88E5',
          '#2196F3',
          '#42A5F5',
          '#64B5F6',
          '#90CAF9',
          '#BBDEFB',
          '#E3F2FD',
          '#CAF0F8',
          '#ADE8F4',
          '#90E0EF',
          '#48CAE4',
          '#00B4D8',
        ],
        data: commandStats,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  });

  // 内存仪表盘
  const usedMemoryMB = Number.parseFloat(
    (data.info.used_memory / 1024 / 1024).toFixed(2),
  );
  await renderMemoryChart({
    series: [
      {
        name: '内存消耗',
        type: 'gauge',
        radius: '90%',
        detail: {
          formatter: (value: number) => `${value} MB`,
        },
        data: [{ value: usedMemoryMB, name: '内存' }],
      },
    ],
  });
};

onMounted(() => {
  loadCacheData();
});

// computed
const labels = computed(() => [
  'Redis版本',
  '客户端数',
  '运行时间(天)',
  '使用内存',
  'AOF是否开启',
  'RDB是否成功',
]);

const values = computed(() => {
  const info = baseInfo.value;
  return [
    info?.redis_version || '--',
    info?.connected_clients || '--',
    info?.uptime_in_days || '--',
    info?.used_memory_human || '--',
    info?.aof_enabled === '1' ? '开启' : '关闭',
    info?.rdb_last_bgsave_status === 'ok' ? '成功' : '失败',
  ];
});
</script>

<template>
  <Page auto-content-height>
    <!-- 基础信息卡片 -->
    <div
      class="3xl:grid-cols-6 mt-3 grid min-w-[375px] grid-cols-1 gap-5 p-4 md:min-w-[700px] md:grid-cols-2 lg:grid-cols-3 xl:min-w-[800px] 2xl:grid-cols-3"
    >
      <div
        v-for="(label, index) in labels"
        :key="index"
        class="relative flex flex-grow !flex-row flex-col items-center rounded-[10px] border-[1px] border-gray-200 bg-white bg-clip-border shadow-md shadow-[#F3F3F3] hover:scale-105 hover:shadow-lg dark:border-[#ffffff33] dark:!bg-[#1d1d1d] dark:text-white dark:shadow-none"
      >
        <div class="ml-[18px] flex h-[90px] w-auto flex-row items-center">
          <div class="bg-lightPrimary dark:bg-navy-700 rounded-full p-3">
            <span class="text-brand-500 flex items-center dark:text-white">
              <svg
                stroke="currentColor"
                fill="currentColor"
                stroke-width="0"
                viewBox="0 0 24 24"
                class="h-7 w-7"
                height="1em"
                width="1em"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path fill="none" d="M0 0h24v24H0z" />
                <path d="M4 9h4v11H4zM16 13h4v7h-4zM10 4h4v16h-4z" />
              </svg>
            </span>
          </div>
        </div>
        <div class="h-50 ml-4 flex w-auto flex-col justify-center">
          <p
            class="font-dm text-sm font-medium text-gray-600 dark:text-gray-400"
          >
            {{ label }}
          </p>
          <h4 class="text-navy-700 text-xl font-bold dark:text-white">
            {{ values[index] }}
          </h4>
        </div>
      </div>
    </div>

    <!-- 图表区域 -->
    <div class="mt-4 sm:flex">
      <ElCard
        class="flex-1 !border-none !bg-transparent sm:mr-4 dark:!bg-transparent"
        shadow="never"
      >
        <div class="mb-4 font-semibold dark:text-gray-200">命令统计</div>
        <EchartsUI ref="commandChartRef" class="h-[30vh]" />
      </ElCard>

      <ElCard
        class="flex-1 !border-none !bg-transparent dark:!bg-transparent"
        shadow="never"
      >
        <div class="mb-4 font-semibold dark:text-gray-200">内存信息</div>
        <EchartsUI ref="memoryChartRef" class="h-[30vh]" />
      </ElCard>
    </div>
  </Page>
</template>
