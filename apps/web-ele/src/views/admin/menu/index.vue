<script lang="ts" setup>
import type { VbenFormProps } from '@vben/common-ui';

import type { VxeGridProps } from '#/adapter/vxe-table';

import { h, markRaw, nextTick, ref } from 'vue';

import { confirm, Page, useVbenModal, VbenIcon } from '@vben/common-ui';
import { CircumEdit, SolarFolderAdd, WeuiDelete } from '@vben/icons';

import { ElButton, ElMessage, ElTag, ElTooltip } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { delObj, pageList } from '#/api/core/menu';
import { $t } from '#/locales';

import ExtraModal from './form.vue';

interface MenuRow {
  id: string;
  parentId?: string;
  menuType: string;
  children?: MenuRow[];
  icon: string;
  meta?: {
    isKeepAlive?: boolean;
  };
  [key: string]: any;
}

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

const MENU_TYPE_MAP: Record<string, { text: string; type: string }> = {
  '0': { text: '左菜单', type: 'info' },
  '2': { text: '顶菜单', type: 'info' },
  '1': { text: '按钮', type: 'success' },
};

const gridOptions: VxeGridProps<MenuRow> = {
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
      slots: {
        // 使用 default 函数代替模板插槽，减少 Vue 指令解析开销
        default: (params: any) => {
          const { row } = params;
          const config = MENU_TYPE_MAP[row.menuType] || {
            text: '未知',
            type: 'info',
          };
          return [
            h(
              ElTag,
              { type: config.type as any, size: 'small' },
              () => config.text,
            ),
          ];
        },
      },
    },
    {
      field: 'keepAlive',
      title: $t('menu.sysmenu.keepAlive'),
      slots: { default: 'keepAlive' },
    },
    { field: 'permission', title: $t('menu.sysmenu.permission') },
    {
      field: 'action',
      slots: { default: 'action' },
      title: $t('page.common.action'),
      width: 210,
    },
  ],
  treeConfig: {
    childrenField: 'children',
    hasChildField: 'children',
    rowField: 'id',
    parentField: 'parentId',
    reserve: true,
  },
  scrollY: {
    enabled: true,
    gt: 20,
  },
  pagerConfig: {
    enabled: false,
  },
  proxyConfig: {
    ajax: {
      query: async (_e: any, formValues: any) => {
        const res = await pageList(formValues || {});
        return { items: markRaw(res) };
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

const [Grid, GridApi] = useVbenVxeGrid<MenuRow>({ formOptions, gridOptions });

const [FormModal, formModalApi] = useVbenModal({
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
  const grid = GridApi?.grid;
  if (!grid) return;
  GridApi.setLoading(true);
  await nextTick();
  setTimeout(async () => {
    await (isExpand.value
      ? grid.setAllTreeExpand(true)
      : grid.clearTreeExpand());
    GridApi.setLoading(false);
  }, 150);
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
      <template #icon="{ row }">
        <VbenIcon v-if="row.icon" :icon="row.icon" fallback />
      </template>
      <template #keepAlive="{ row }">
        <ElTag v-if="row?.meta?.isKeepAlive">开启</ElTag>
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
