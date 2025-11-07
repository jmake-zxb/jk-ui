<script lang="ts" setup>
import type { VbenFormProps } from '@vben/common-ui';

import type { VxeGridListeners, VxeGridProps } from '#/adapter/vxe-table';
import type { BasicUserInfo } from '#/api/core/user';

import { computed, ref } from 'vue';

import { confirm, Page } from '@vben/common-ui';
import { WeuiDelete } from '@vben/icons';
import { $t } from '@vben/locales';

import { ElButton, ElMessage } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { delObj, fetchList } from '#/api/admin/token';

const selectedRows = ref<any[]>([]);

const formOptions: VbenFormProps = {
  schema: [
    {
      component: 'Input',
      componentProps: {
        clearable: true,
        placeholder: $t('token.systoken.inputUsernameTip'),
      },
      fieldName: 'username',
      label: $t('token.systoken.username'),
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
    { title: $t('token.systoken.index'), type: 'seq', width: 50 },
    { field: 'username', title: $t('token.systoken.username'), width: 150 },
    { field: 'clientId', title: $t('token.systoken.clientId'), width: 100 },
    { field: 'accessToken', title: $t('token.systoken.accessToken') },
    { field: 'expiresAt', title: $t('token.systoken.expiresAt'), width: 180 },
    {
      field: 'action',
      title: $t('page.common.action'),
      slots: { default: 'action' },
      width: 90,
    },
  ],
  toolbarConfig: {
    custom: true,
    refresh: true,
    zoom: true,
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
const handleDelete = (accessTokens: string[]) => {
  confirm($t('token.systoken.offlineConfirmText')).then(async () => {
    try {
      await delObj(accessTokens);
      gridApi.reload();
      ElMessage.success($t('token.systoken.offlineSuccessText'));
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
          v-access:code="['sys_user_del']"
          class="ml10"
          :disabled="multiple"
          :icon="WeuiDelete"
          type="primary"
        >
          {{ $t('token.systoken.offlineBtn') }}
        </ElButton>
      </template>
      <template #action="{ row }">
        <ElButton
          v-access:code="['sys_user_del']"
          :icon="WeuiDelete"
          link
          type="primary"
          @click="handleDelete([row.accessToken])"
        >
          {{ $t('token.systoken.offlineBtn') }}
        </ElButton>
      </template>
    </Grid>
  </Page>
</template>

<style lang="scss" scoped></style>
