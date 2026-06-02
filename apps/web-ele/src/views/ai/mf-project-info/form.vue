<script setup lang="ts" name="MfProjectInfoModal">
import type { VxeGridProps } from '@vben/plugins/vxe-table';

import { useRouter } from 'vue-router';

import { useVbenModal } from '@vben/common-ui';
import { useVbenVxeGrid } from '@vben/plugins/vxe-table';

import { ElButton } from 'element-plus';

import { fetchList } from '#/api/ai/analysis';

let projectId: string = '';

const router = useRouter();

const gridOptions: VxeGridProps = {
  height: '500px',
  columns: [
    { title: '#', type: 'seq', width: 40 },
    {
      field: 'analysisName',
      title: '报告名称',
    },
    {
      field: 'totalRules',
      title: '规则数量',
    },
    {
      field: 'violationCount',
      title: '违规数量',
    },
    {
      field: 'highRiskCount',
      title: '严重违规数量',
    },
    {
      field: 'createTime',
      title: '生成时间',
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
      query: async ({ page }, formValues) => {
        return await fetchList({
          ...formValues,
          current: page.currentPage,
          size: page.pageSize,
          projectId,
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

// Modal定义
const [Modal, ModalApi] = useVbenModal({
  draggable: true,
  closeOnClickModal: false,
  closeOnPressEscape: false,
  async onOpenChange(isOpen) {
    if (isOpen) {
      const dat = ModalApi.getData<Record<string, any>>();
      ModalApi.setState({
        title: `分析报告${dat?.data?.projectName || ''}`,
      });
      if (dat?.data?.id) {
        projectId = dat.data.id;
      }
    }
  },
});

const openReport = (id: string) => {
  router.push({
    path: '/report',
    query: {
      id,
    },
  });
};
</script>
<template>
  <Modal class="w-[60%]">
    <Grid>
      <template #action="{ row }">
        <ElButton link type="primary" @click="openReport(row.id)">
          报告详情
        </ElButton>
      </template>
    </Grid>
  </Modal>
</template>
