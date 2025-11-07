<script lang="ts" setup>
import type { VxeGridListeners, VxeGridProps } from '#/adapter/vxe-table';
import type { BasicUserInfo } from '#/api/core/user';

import { computed, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { CircumEdit, SolarFolderAdd, WeuiDelete } from '@vben/icons';

import { ElButton, ElTag, ElTooltip } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { pageList } from '#/api/core/user';
import { $t } from '#/locales';

import { useColumns } from './data';

const selectedRows = ref<any[]>([]);

const gridOptions: VxeGridProps<BasicUserInfo> = {
  columns: useColumns(),
  height: 'auto',
  toolbarConfig: {
    custom: true,
    export: true,
    refresh: true,
    zoom: true,
  },
  proxyConfig: {
    ajax: {
      query: async ({ page }) => {
        return await pageList({
          current: page.currentPage,
          size: page.pageSize,
        });
      },
    },
  },
  sortConfig: {
    multiple: true,
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

const [Grid] = useVbenVxeGrid({ gridEvents, gridOptions });

// 删除操作
const handleDelete = async (ids: string[]) => {
  try {
    await useMessageBox().confirm($t('common.delConfirmText'));
  } catch {
    return;
  }

  try {
    await delObj(ids);
    getDataList();
    useMessage().success($t('common.delSuccessText'));
  } catch (error: any) {
    useMessage().error(error.msg);
  }
};

const multiple = computed(() => selectedRows.value.length === 0);
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #toolbar-actions>
        <ElButton
          v-access:code="['sys_user_add']"
          :icon="SolarFolderAdd"
          type="primary"
        >
          {{ $t('page.common.addBtn') }}
        </ElButton>
        <ElButton
          plain
          v-access:code="['sys_user_del']"
          class="ml10"
          :disabled="multiple"
          :icon="WeuiDelete"
          type="primary"
        >
          {{ $t('page.common.delBtn') }}
        </ElButton>
      </template>
      <template #role="{ row }">
        <ElTag v-for="item in row.roleList" :key="item.roleId">
          {{ item.roleName }}
        </ElTag>
      </template>
      <template #action="{ row }">
        <ElButton
          v-access:code="['sys_user_edit']"
          :icon="CircumEdit"
          text
          type="primary"
        >
          {{ $t('page.common.editBtn') }}
        </ElButton>
        <ElTooltip
          :content="$t('user.sysuser.deleteDisabledTip')"
          :disabled="row.userId !== '1'"
          placement="top"
        >
          <span style="margin-left: 12px">
            <ElButton
              :icon="WeuiDelete"
              v-access:code="['sys_user_del']"
              :disabled="row.username === 'admin'"
              text
              type="primary"
              @click="handleDelete([row.userId])"
              >{{ $t('page.common.delBtn') }}
            </ElButton>
          </span>
        </ElTooltip>
      </template>
    </Grid>
  </Page>
</template>

<style lang="scss" scoped>
.div {
  margin-top: 90px;
}
</style>
