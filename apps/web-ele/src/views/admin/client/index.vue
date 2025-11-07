<script lang="ts" setup>
import type { VbenFormProps } from '@vben/common-ui';

import type { VxeGridListeners, VxeGridProps } from '#/adapter/vxe-table';
import type { BasicUserInfo } from '#/api/core/user';

import { computed, ref } from 'vue';

import { confirm, Page, useVbenModal } from '@vben/common-ui';
import { CircumEdit, RotateCw, SolarFolderAdd, WeuiDelete } from '@vben/icons';
import { $t } from '@vben/locales';

import { ElButton, ElMessage } from 'element-plus';

import { useDict } from '#/adapter/dict';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { delObj, fetchList, refreshCache } from '#/api/admin/client';
import { downBlobFile } from '#/api/core/other';
import DictTag from '#/component/DictTag/index.vue';

import ExtraModal from './form.vue';

const selectedRows = ref<any[]>([]);
const { grant_types } = useDict('grant_types');

const formOptions: VbenFormProps = {
  schema: [
    {
      component: 'Input',
      componentProps: {
        clearable: true,
        placeholder: $t('client.client.inputClientIdTip'),
      },
      fieldName: 'clientId',
      label: $t('client.client.clientId'),
    },
    {
      component: 'Input',
      componentProps: {
        clearable: true,
        placeholder: $t('client.client.inputClientSecretTip'),
      },
      fieldName: 'clientSecret',
      label: $t('client.client.clientSecret'),
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

const gridOptions: VxeGridProps<BasicUserInfo> = {
  columns: [
    { align: 'center', type: 'checkbox', width: 40 },
    { title: $t('client.client.index'), type: 'seq', width: 50 },
    { field: 'clientId', title: $t('client.client.clientId'), width: 150 },
    {
      field: 'clientSecret',
      title: $t('client.client.clientSecret'),
      width: 150,
    },
    { field: 'scope', title: $t('client.client.scope'), width: 150 },
    {
      field: 'authorizedGrantTypes',
      title: $t('client.client.authorizedGrantTypes'),
      slots: { default: 'authorizedGrantTypes' },
    },
    {
      field: 'accessTokenValidity',
      title: $t('client.client.accessTokenValidity'),
      width: 150,
    },
    {
      field: 'refreshTokenValidity',
      title: $t('client.client.refreshTokenValidity'),
      width: 150,
    },
    {
      field: 'action',
      title: $t('page.common.action'),
      slots: { default: 'action' },
      width: 150,
    },
  ],
  exportConfig: {
    type: 'custom',
    mode: 'all',
    types: ['xlsx'],
    download: false,
    filename: 'client.xlsx',
    remote: true,
    exportMethod: ({ options }) => {
      return downBlobFile('/admin/client/export', options, 'client.xlsx');
    },
  },
  toolbarConfig: {
    custom: true,
    refresh: true,
    zoom: true,
    export: true,
  },
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues) => {
        return await fetchList({
          ...formValues,
          current: page.currentPage,
          size: page.pageSize,
        });
      },
    },
  },
};

const gridEvents: VxeGridListeners<BasicUserInfo> = {
  checkboxAll: ({ records }) => {
    selectedRows.value = records;
  },
  checkboxChange: ({ records }) => {
    selectedRows.value = records;
  },
};

const multiple = computed(() => selectedRows.value.length === 0);

const [Grid, gridApi] = useVbenVxeGrid({
  gridEvents,
  gridOptions,
  formOptions,
});

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

// 删除缓存
const handleRefreshCache = () => {
  refreshCache().then(() => {
    ElMessage.success($t('page.common.optSuccessText'));
  });
};

const [FormModal, formModalApi] = useVbenModal({
  // 连接抽离的组件
  connectedComponent: ExtraModal,
  onCancel() {
    gridApi.reload();
  },
});

// 打开新增菜单弹窗
const onOpenAddMenu = (row?: any) => {
  formModalApi.setData({ type: 'page.common.addBtn', data: row }).open();
};

// 打开编辑菜单弹窗
const onOpenEditMenu = (row?: any) => {
  formModalApi.setData({ type: 'page.common.editBtn', data: row }).open();
};
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #toolbar-actions>
        <ElButton
          v-access:code="['sys_client_add']"
          :icon="SolarFolderAdd"
          type="primary"
          @click="onOpenAddMenu()"
        >
          {{ $t('page.common.addBtn') }}
        </ElButton>
        <ElButton
          plain
          v-access:code="['sys_client_del']"
          :icon="RotateCw"
          type="primary"
          class="ml10"
          @click="handleRefreshCache()"
        >
          {{ $t('page.common.refreshCacheBtn') }}
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
              gridApi?.grid?.getCheckboxRecords?.().map((item) => item.id),
            )
          "
        >
          {{ $t('page.common.delBtn') }}
        </ElButton>
      </template>
      <template #authorizedGrantTypes="{ row }">
        <DictTag :options="grant_types" :value="row.authorizedGrantTypes" />
      </template>
      <template #action="{ row }">
        <ElButton
          :icon="CircumEdit"
          link
          type="primary"
          v-access:code="['sys_client_add']"
          @click="onOpenEditMenu(row)"
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
    <FormModal @refresh="() => gridApi.reload()" />
  </Page>
</template>

<style lang="scss" scoped></style>
