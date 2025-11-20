<script lang="ts" setup>
import type { VbenFormProps } from '@vben/common-ui';

import type { VxeGridProps } from '#/adapter/vxe-table';

import { ref } from 'vue';

import { confirm, Page, useVbenModal, VbenIcon } from '@vben/common-ui';
import { CircumEdit, SolarFolderAdd, WeuiDelete } from '@vben/icons';

import { ElButton, ElMessage, ElTag, ElTooltip } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { delObj, pageList } from '#/api/core/menu';
import { $t } from '#/locales';

import ExtraModal from './form.vue';

const isExpand = ref(false);

const formOptions: VbenFormProps = {
  schema: [
    {
      component: 'Input',
      componentProps: {
        clearable: true,
        placeholder: $t('menu.sysmenu.inputNameTip'),
      },
      fieldName: 'menuName',
      label: $t('menu.sysmenu.name'),
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
  stripe: false,
  columns: [
    { field: 'name', title: $t('menu.sysmenu.name'), treeNode: true },
    { field: 'sortOrder', title: $t('menu.sysmenu.sortOrder') },
    {
      field: 'icon',
      title: $t('menu.sysmenu.icon'),
      align: 'center',
      slots: { default: 'icon' },
    },
    { field: 'path', title: $t('menu.sysmenu.path') },
    {
      field: 'menuType',
      title: $t('menu.sysmenu.menuType'),
      slots: { default: 'menuType' },
    },
    {
      field: 'keepAlive',
      title: $t('menu.sysmenu.keepAlive'),
      slots: { default: 'keepAlive' },
    },
    { field: 'permission', title: $t('menu.sysmenu.permission') },
    {
      field: 'action',
      fixed: 'right',
      slots: { default: 'action' },
      title: $t('page.common.action'),
      width: 210,
    },
  ],
  treeConfig: {
    childrenField: 'children',
  },
  height: 'auto',
  pagerConfig: {
    enabled: false,
  },
  proxyConfig: {
    ajax: {
      query: (_e, formValues) => {
        return new Promise<object>((resolve) => {
          pageList(formValues || {}).then((res) => {
            resolve({ items: res });
          });
        });
      },
    },
  },
  toolbarConfig: {
    custom: true,
    refresh: true,
    zoom: true,
    // @ts-ignore 正式环境时有完整的类型声明
    search: true,
  },
};

const [Grid, GridApi] = useVbenVxeGrid({ formOptions, gridOptions });

const [FormModal, formModalApi] = useVbenModal({
  // 连接抽离的组件
  connectedComponent: ExtraModal,
});

// 打开新增菜单弹窗
const onOpenAddMenu = (type?: string, row?: any) => {
  formModalApi.setData({ type: 'page.common.addBtn', data: row }).open();
};

// 打开编辑菜单弹窗
const onOpenEditMenu = (type: string, row: any) => {
  formModalApi.setData({ type: 'page.common.editBtn', data: row }).open();
};

// 是否禁用删除
const deleteMenuDisabled = (row: any) => {
  return (row.children || []).length > 0;
};

// 删除操作
const handleDelete = (id: string) => {
  confirm($t('page.common.delConfirmText')).then(async () => {
    try {
      await delObj(id);
      GridApi.reload();
      ElMessage.success($t('page.common.delSuccessText'));
    } catch (error: any) {
      ElMessage.error(error.msg);
    }
  });
};

// 展开折叠树
const handleExpand = async () => {
  isExpand.value = !isExpand.value;
  GridApi.grid.setAllTreeExpand(isExpand.value);
};
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #toolbar-actions>
        <ElButton
          v-access:code="['sys_menu_add']"
          :icon="SolarFolderAdd"
          type="primary"
          @click="onOpenAddMenu()"
        >
          {{ $t('page.common.addBtn') }}
        </ElButton>
        <ElButton @click="handleExpand" plain>
          {{ $t('page.common.expandBtn') }}
        </ElButton>
      </template>
      <template #menuType="{ row }">
        <ElTag v-if="row.menuType === '0'">左菜单</ElTag>
        <ElTag v-if="row.menuType === '2'">顶菜单</ElTag>
        <ElTag type="success" v-if="row.menuType === '1'">按钮</ElTag>
      </template>
      <template #icon="{ row }">
        <VbenIcon :icon="row.icon" fallback />
      </template>
      <template #keepAlive="{ row }">
        <ElTag v-if="row.meta.isKeepAlive">开启</ElTag>
        <ElTag type="info" v-else>关闭</ElTag>
      </template>
      <template #action="{ row }">
        <ElButton
          :icon="SolarFolderAdd"
          @click="onOpenAddMenu('add', row)"
          link
          type="primary"
          v-access:code="['sys_menu_add']"
        >
          {{ $t('page.common.addBtn') }}
        </ElButton>
        <ElButton
          :icon="CircumEdit"
          @click="onOpenEditMenu('edit', row)"
          link
          type="primary"
          v-access:code="['sys_menu_edit']"
        >
          {{ $t('page.common.editBtn') }}
        </ElButton>

        <ElTooltip
          icon="delete"
          :content="$t('menu.sysmenu.deleteDisabledTip')"
          :disabled="!deleteMenuDisabled(row)"
          placement="top"
        >
          <span style="margin-left: 10px">
            <ElButton
              :icon="WeuiDelete"
              :disabled="deleteMenuDisabled(row)"
              link
              type="primary"
              v-access:code="['sys_menu_del']"
              @click="handleDelete(row.id)"
            >
              {{ $t('page.common.delBtn') }}
            </ElButton>
          </span>
        </ElTooltip>
      </template>
    </Grid>
    <FormModal @refresh="() => GridApi.reload()" />
  </Page>
</template>

<style lang="scss" scoped></style>
