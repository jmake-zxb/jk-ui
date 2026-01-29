<script lang="ts" setup>
import type { VbenFormProps } from '@vben/common-ui';

import type { VxeGridListeners, VxeGridProps } from '#/adapter/vxe-table';
import type { BasicUserInfo } from '#/api/core/user';

import { computed, ref } from 'vue';

import { confirm, Page, useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { Delete, Edit, Operation, Plus } from '@element-plus/icons-vue';
import { ElButton, ElMessage, ElTooltip } from 'element-plus';

import { useDict } from '#/adapter/dict';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { delObj, pageList } from '#/api/admin/role';
import DictTag from '#/component/DictTag/index.vue';

import ExtraModal from './form.vue';
import ExtraPermessionModal from './permession.vue';

const selectedRows = ref<any[]>([]);
const { grant_types } = useDict('grant_types');

const formOptions: VbenFormProps = {
  schema: [
    {
      component: 'Input',
      componentProps: {
        clearable: true,
        placeholder: $t('role.sysrole.please_enter_a_role_name'),
      },
      fieldName: 'roleName',
      label: $t('role.sysrole.roleName'),
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
    { title: $t('role.sysrole.index'), type: 'seq', width: 50 },
    { field: 'roleName', title: $t('role.sysrole.roleName') },
    {
      field: 'roleCode',
      title: $t('role.sysrole.roleCode'),
    },
    { field: 'roleDesc', title: $t('role.sysrole.roleDesc') },
    {
      field: 'createTime',
      title: $t('role.sysrole.createTime'),
    },
    {
      field: 'action',
      title: $t('page.common.action'),
      slots: { default: 'action' },
      width: 220,
    },
  ],
  checkboxConfig: {
    checkMethod({ row }) {
      return row.roleId !== '1';
    },
  },
  exportConfig: {
    excludeFields: ['action'],
  },
  toolbarConfig: {
    custom: true,
    export: true,
    refresh: true,
    zoom: true,
    // @ts-ignore 正式环境时有完整的类型声明
    search: true,
  },
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues) => {
        return await pageList({
          ...formValues,
          current: page.currentPage,
          size: page.pageSize,
        });
      },
      queryAll: async () => {
        const data: never[] = [];
        return { items: data };
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

const [PermessionModal, PermessionModalApi] = useVbenModal({
  // 连接抽离的组件
  connectedComponent: ExtraPermessionModal,
});

const onOpenPermession = (row?: any) => {
  PermessionModalApi.setData({ type: 'page.common.editBtn', data: row }).open();
};
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #toolbar-actions>
        <ElButton
          v-access:code="['sys_role_add']"
          :icon="Plus"
          type="primary"
          @click="onOpenAddMenu()"
        >
          {{ $t('page.common.addBtn') }}
        </ElButton>
        <ElButton
          plain
          v-access:code="['sys_user_del']"
          class="ml10"
          :disabled="multiple"
          :icon="Delete"
          type="primary"
          @click="
            handleDelete(
              gridApi?.grid?.getCheckboxRecords?.().map((item) => item.roleId),
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
          :icon="Edit"
          link
          type="primary"
          :disabled="row.roleId === '1'"
          v-access:code="['sys_role_edit']"
          @click="onOpenEditMenu(row)"
        >
          {{ $t('page.common.editBtn') }}
        </ElButton>
        <ElButton
          :icon="Operation"
          @click="onOpenPermession(row)"
          link
          type="primary"
          v-access:code="['sys_role_edit']"
        >
          {{ $t('role.sysrole.permissionTip') }}
        </ElButton>
        <ElTooltip
          :content="$t('role.sysrole.deleteDisabledTip')"
          :disabled="row.roleId !== '1'"
          placement="top"
        >
          <ElButton
            :icon="Delete"
            :disabled="row.roleId === '1'"
            @click="handleDelete([row.roleId])"
            link
            type="primary"
            v-access:code="['sys_role_del']"
          >
            {{ $t('page.common.delBtn') }}
          </ElButton>
        </ElTooltip>
      </template>
    </Grid>
    <FormModal @refresh="() => gridApi.reload()" />
    <PermessionModal />
  </Page>
</template>

<style lang="scss" scoped></style>
