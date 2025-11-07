<script lang="ts" setup>
import type { VbenFormProps } from '@vben/common-ui';

import type { VxeGridListeners, VxeGridProps } from '#/adapter/vxe-table';

import { computed, ref } from 'vue';

import { confirm, Page } from '@vben/common-ui';
import { CircumEdit, WeuiDelete } from '@vben/icons';
import { $t } from '@vben/locales';

import { ElButton, ElMessage } from 'element-plus';

import { useDict } from '#/adapter/dict';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { delObj, pageList } from '#/api/admin/log';
import DictTag from '#/component/DictTag/index.vue';

const { log_type } = useDict('log_type');
const selectedRows = ref<any[]>([]);

const formOptions: VbenFormProps = {
  schema: [
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        filterOption: true,
        options: log_type?.value,
        showSearch: true,
        placeholder: $t('log.syslog.inputLogTypeTip'),
      },
      fieldName: 'logType',
      label: $t('log.syslog.logType'),
    },
    {
      component: 'DatePicker',
      componentProps: {
        clearable: true,
        type: 'datetimerange',
        rangeSeparator: 'To',
        startPlaceholder: $t('log.syslog.inputStartPlaceholderTip'),
        endPlaceholder: $t('log.syslog.inputEndPlaceholderTip'),
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      fieldName: 'createTime',
      label: $t('log.syslog.createTime'),
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
    { align: 'center', type: 'checkbox', width: 40 },
    { title: $t('log.syslog.index'), type: 'seq', width: 50 },
    {
      field: 'logType',
      title: $t('log.syslog.logType'),
      slots: { default: 'logType' },
    },
    { field: 'title', title: $t('log.syslog.title') },
    { field: 'remoteAddr', title: $t('log.syslog.remoteAddr') },
    { field: 'method', title: $t('log.syslog.method') },
    { field: 'time', title: $t('log.syslog.time') },
    { field: 'createTime', title: $t('log.syslog.createTime') },
    { field: 'createBy', title: $t('log.syslog.createBy') },
    {
      field: 'action',
      title: $t('page.common.action'),
      slots: { default: 'action' },
      width: 150,
    },
  ],
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues) => {
        return await pageList({
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
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #toolbar-actions>
        <ElButton
          plain
          v-access:code="['sys_client_del']"
          class="ml10"
          :disabled="multiple"
          :icon="WeuiDelete"
          type="primary"
          @click="
            handleDelete(
              gridApi?.grid?.getCheckboxRecords?.().map((item) => item.id),
            )
          "
        >
          {{ $t('page.common.delBtn') }}
        </ElButton>
      </template>
      <template #logType="{ row }">
        <DictTag :options="log_type" :value="row.logType" />
      </template>
      <template #action="{ row }">
        <ElButton
          :icon="CircumEdit"
          link
          type="primary"
          v-access:code="['sys_client_add']"
        >
          {{ $t('page.common.editBtn') }}
        </ElButton>
        <ElButton
          :icon="WeuiDelete"
          @click="handleDelete([row.id])"
          link
          type="primary"
          v-access:code="['sys_client_del']"
        >
          {{ $t('page.common.delBtn') }}
        </ElButton>
      </template>
    </Grid>
  </Page>
</template>

<style lang="scss" scoped>
.div {
  margin-top: 90px;
}
</style>
