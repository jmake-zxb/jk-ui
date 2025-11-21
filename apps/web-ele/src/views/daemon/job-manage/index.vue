<script lang="ts" setup>
import type { VbenFormProps } from '@vben/common-ui';

import type { VxeGridListeners, VxeGridProps } from '#/adapter/vxe-table';

import { computed, ref } from 'vue';

import { confirm, Page, useVbenModal } from '@vben/common-ui';
import { SolarFolderAdd, WeuiDelete } from '@vben/icons';
import { $t } from '@vben/locales';

import { ElButton, ElMessage } from 'element-plus';

import { useDict } from '#/adapter/dict';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  delObj,
  fetchList,
  runJobRa,
  shutDownJobRa,
  startJobRa,
} from '#/api/daemon/job';
import DictTag from '#/component/DictTag/index.vue';

import ExtraModal from './form.vue';

/** 查询字典 */
const { job_status, job_execute_status, misfire_policy, job_type } = useDict(
  'job_status',
  'job_execute_status',
  'misfire_policy',
  'job_type',
);

const selectedRows = ref<any[]>([]);

const formOptions: VbenFormProps = {
  schema: [
    {
      component: 'Input',
      componentProps: {
        clearable: true,
        placeholder: $t('job.job.inputjobNameTip'),
      },
      fieldName: 'jobName',
      label: $t('job.job.jobName'),
    },
    {
      component: 'Select',
      componentProps: () => ({
        allowClear: true,
        filterOption: true,
        options: job_status?.value,
        showSearch: true,
        placeholder: $t('job.job.inputjobStatusTip'),
      }),
      fieldName: 'jobStatus',
      label: $t('job.job.jobStatus'),
    },
    {
      component: 'Select',
      componentProps: () => ({
        allowClear: true,
        filterOption: true,
        options: job_execute_status?.value,
        showSearch: true,
        placeholder: $t('job.job.inputjobExecuteStatusTip'),
      }),
      fieldName: 'jobExecuteStatus',
      label: $t('job.job.jobExecuteStatus'),
    },
  ],
  // 控制表单是否显示折叠按钮
  showCollapseButton: false,
  submitButtonOptions: {},
  // 是否在字段值改变时提交表单
  submitOnChange: false,
  // 按下回车时是否提交表单
  submitOnEnter: true,
};

const gridOptions: VxeGridProps = {
  columns: [
    { align: 'center', type: 'checkbox', width: 40, fixed: 'left' },
    { title: $t('job.job.index'), type: 'seq', width: 50, fixed: 'left' },
    {
      field: 'jobName',
      title: $t('job.job.jobName'),
      width: 120,
      fixed: 'left',
    },
    { field: 'jobGroup', title: $t('job.job.jobGroup'), width: 120 },
    {
      field: 'jobStatus',
      title: $t('job.job.jobStatus'),
      width: 120,
      slots: { default: 'jobStatus' },
    },
    {
      field: 'jobExecuteStatus',
      title: $t('job.job.jobExecuteStatus'),
      width: 120,
      slots: { default: 'jobExecuteStatus' },
    },
    { field: 'startTime', title: $t('job.job.startTime'), width: 120 },
    { field: 'previousTime', title: $t('job.job.previousTime'), width: 120 },
    { field: 'nextTime', title: $t('job.job.nextTime'), width: 120 },
    {
      field: 'jobType',
      title: $t('job.job.jobType'),
      width: 120,
      slots: { default: 'jobType' },
    },
    { field: 'executePath', title: $t('job.job.executePath'), width: 120 },
    { field: 'className', title: $t('job.job.className'), width: 120 },
    { field: 'methodName', title: $t('job.job.methodName'), width: 120 },
    {
      field: 'methodParamsValue',
      title: $t('job.job.methodParamsValue'),
      width: 120,
    },
    {
      field: 'cronExpression',
      title: $t('job.job.cronExpression'),
      width: 120,
    },
    {
      field: 'misfirePolicy',
      title: $t('job.job.misfirePolicy'),
      width: 200,
      slots: { default: 'misfirePolicy' },
    },
    {
      field: 'action',
      title: $t('page.common.action'),
      slots: { default: 'action' },
      width: 260,
      fixed: 'right',
    },
  ],
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues) => {
        return await fetchList({
          ...formValues,
          current: page.currentPage,
          size: page.pageSize,
          descs: 'create_time',
        });
      },
    },
  },
  toolbarConfig: {
    custom: true,
    refresh: true,
    zoom: true,
    export: true,
    // @ts-ignore 正式环境时有完整的类型声明
    search: true,
  },
};

const gridEvents: VxeGridListeners = {
  checkboxAll: ({ records }) => {
    selectedRows.value = records;
  },
  checkboxChange: ({ records }) => {
    selectedRows.value = records;
  },
};

const [Grid, gridApi] = useVbenVxeGrid({
  gridEvents,
  gridOptions,
  formOptions,
});

const multiple = computed(() => selectedRows.value.length === 0);

const [FormModal, formModalApi] = useVbenModal({
  // 连接抽离的组件
  connectedComponent: ExtraModal,
});

const onOpenAdd = (_type?: string, row?: any) => {
  formModalApi.setData({ type: 'page.common.addBtn', data: row }).open();
};

const onOpenEdit = (_type: string, row: any) => {
  formModalApi.setData({ type: 'page.common.editBtn', data: row }).open();
};

// 删除操作
const handleDelete = (ids: string[]) => {
  confirm($t('page.common.delConfirmText')).then(async () => {
    try {
      await delObj(ids);
      gridApi.reload();
      ElMessage.success($t('page.common.delSuccessText'));
    } catch (error: any) {
      ElMessage.error(error.msg);
    }
  });
};

/** 启动作业 */
const handleStartJob = async (row: {
  jobId: string;
  jobName: any;
  jobStatus: any;
}) => {
  const jobStatus = row.jobStatus;
  if (jobStatus === '1' || jobStatus === '3') {
    confirm(`即将发布或启动(任务名称: ${row.jobName}), 是否继续?`).then(
      async () => {
        try {
          await startJobRa(row.jobId);
          gridApi.reload();
          ElMessage.success($t('page.common.optSuccessText'));
        } catch (error: any) {
          ElMessage.error(error.msg);
        }
      },
    );
  } else {
    ElMessage.error('定时任务已运行');
  }
};

/** 暂停作业 */
const handleShutDownJob = async (row: {
  jobId: string;
  jobName: any;
  jobStatus: any;
}) => {
  const jobStatus = row.jobStatus;
  if (jobStatus === '2') {
    confirm(`即将暂停(任务名称: ${row.jobName}), 是否继续?`).then(async () => {
      try {
        await shutDownJobRa(row.jobId);
        gridApi.reload();
        ElMessage.success($t('page.common.optSuccessText'));
      } catch (error: any) {
        ElMessage.error(error.msg);
      }
    });
  } else {
    ElMessage.error('已暂停，不要重复操作');
  }
};

/** 运行作业 */
const handleRunJob = async (row: { jobId: string; jobName: any }) => {
  confirm(`立刻执行一次任务(任务名称: ${row.jobName}), 是否继续?`).then(
    async () => {
      try {
        await runJobRa(row.jobId);
        gridApi.reload();
        ElMessage.success($t('page.common.optSuccessText'));
      } catch {
        ElMessage.error('运行失败');
      }
    },
  );
};

/** 查看作业日志 */
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #toolbar-actions>
        <ElButton
          v-access:code="['sys_menu_add']"
          :icon="SolarFolderAdd"
          type="primary"
          @click="onOpenAdd()"
        >
          {{ $t('page.common.addBtn') }}
        </ElButton>
        <ElButton
          plain
          v-access:code="['sys_client_del']"
          class="ml10"
          :disabled="multiple"
          :icon="WeuiDelete"
          type="primary"
          @click="
            handleDelete(
              gridApi?.grid?.getCheckboxRecords?.().map((item) => item.jobId),
            )
          "
        >
          {{ $t('page.common.delBtn') }}
        </ElButton>
      </template>
      <template #jobStatus="{ row }">
        <DictTag :options="job_status" :value="row.jobStatus" />
      </template>
      <template #jobExecuteStatus="{ row }">
        <DictTag :options="job_execute_status" :value="row.jobExecuteStatus" />
      </template>
      <template #jobType="{ row }">
        <DictTag :options="job_type" :value="row.jobType" />
      </template>
      <template #misfirePolicy="{ row }">
        <DictTag :options="misfire_policy" :value="row.misfirePolicy" />
      </template>
      <template #action="{ row }">
        <ElButton @click="handleJobLog(row)" link type="primary">
          日志
        </ElButton>
        <ElButton
          v-access:code="['job_sys_job_start_job']"
          @click="handleStartJob(row)"
          link
          type="primary"
          v-if="row.jobStatus !== '2'"
        >
          启动
        </ElButton>

        <ElButton
          v-access:code="['job_sys_job_shutdown_job']"
          @click="handleShutDownJob(row)"
          link
          type="primary"
          v-if="row.jobStatus === '2'"
        >
          暂停
        </ElButton>

        <ElButton
          v-access:code="['job_sys_job_edit']"
          @click="onOpenEdit('edit', row)"
          link
          type="primary"
        >
          {{ $t('page.common.editBtn') }}
        </ElButton>

        <ElButton
          v-access:code="['job_sys_job_start_job']"
          @click="handleRunJob(row)"
          link
          type="primary"
        >
          执行
        </ElButton>

        <ElButton
          v-access:code="['job_sys_job_del']"
          @click="handleDelete(row)"
          link
          type="primary"
        >
          {{ $t('page.common.delBtn') }}
        </ElButton>
      </template>
    </Grid>
    <FormModal @refresh="() => gridApi.reload()" />
  </Page>
</template>

<style lang="scss" scoped>
.div {
  margin-top: 90px;
}
</style>
