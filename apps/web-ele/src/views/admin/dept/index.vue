<script lang="ts" setup>
import type { VbenFormProps } from '@vben/common-ui';

import type { VxeGridProps } from '#/adapter/vxe-table';

import { ref } from 'vue';

import { confirm, Page, useVbenModal } from '@vben/common-ui';
import { CircumEdit, SolarFolderAdd, WeuiDelete } from '@vben/icons';

import { ElButton, ElMessage } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { delObj, deptTree } from '#/api/admin/dept';
import { $t } from '#/locales';

import ExtraModal from './form.vue';

const isExpand = ref(false);

const formOptions: VbenFormProps = {
  schema: [
    {
      component: 'Input',
      componentProps: {
        clearable: true,
        placeholder: $t('dept.sysdept.inputnameTip'),
      },
      fieldName: 'name',
      label: $t('dept.sysdept.name'),
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
    { field: 'name', title: $t('dept.sysdept.name'), treeNode: true },
    { field: 'weight', title: $t('dept.sysdept.weight') },
    {
      field: 'createTime',
      title: $t('dept.sysdept.createTime'),
    },
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
          deptTree(formValues || {}).then((res) => {
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
const onOpenAddMenu = (_type?: string, row?: any) => {
  formModalApi.setData({ type: 'page.common.addBtn', data: row }).open();
};

// 打开编辑菜单弹窗
const onOpenEditMenu = (_type: string, row: any) => {
  formModalApi.setData({ type: 'page.common.editBtn', data: row }).open();
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
          v-access:code="['sys_dept_add']"
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
      <template #action="{ row }">
        <ElButton
          :icon="SolarFolderAdd"
          @click="onOpenAddMenu('add', row)"
          link
          type="primary"
          v-access:code="['sys_dept_add']"
        >
          {{ $t('page.common.addBtn') }}
        </ElButton>
        <ElButton
          :icon="CircumEdit"
          @click="onOpenEditMenu('edit', row)"
          link
          type="primary"
          v-access:code="['sys_dept_edit']"
        >
          {{ $t('page.common.editBtn') }}
        </ElButton>

        <ElButton
          :icon="WeuiDelete"
          link
          type="primary"
          v-access:code="['sys_dept_del']"
          @click="handleDelete(row.id)"
        >
          {{ $t('page.common.delBtn') }}
        </ElButton>
      </template>
    </Grid>
    <FormModal @refresh="() => GridApi.reload()" />
  </Page>
</template>

<style lang="scss" scoped></style>
