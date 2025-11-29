<script setup lang="ts" name="systemSysDictItem">
// ========== 导入声明 ==========

import type { VxeGridListeners, VxeGridProps } from '#/adapter/vxe-table';

import { defineAsyncComponent, reactive, ref } from 'vue';

import { confirm, useVbenModal } from '@vben/common-ui';
import { CircumEdit, SolarFolderAdd, WeuiDelete } from '@vben/icons';

import { ElButton, ElMessage } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { delItemObj, fetchItemList } from '#/api/admin/dict';
import { $t } from '#/locales';

// ========== 组件声明 ==========
// 异步加载表单弹窗组件
const FormModalComponent = defineAsyncComponent(() => import('./form.vue'));

const state = reactive<Record<string, any>>({
  queryData: {
    dictId: '',
    dictType: '',
  },
});

// ========== table表格 ==========
const selectedRows = ref<any[]>([]);

const gridOptions: VxeGridProps = {
  columns: [
    {
      field: 'dictType',
      title: '字典类型',
    },
    {
      field: 'value',
      title: '字典值',
    },
    {
      field: 'label',
      title: '标签名',
    },
    {
      field: 'description',
      title: '字典项描述',
    },
    {
      field: 'sortOrder',
      title: '排序',
      sortable: true,
    },
    {
      field: 'remarks',
      title: '备注',
    },
    {
      field: 'createTime',
      title: '创建时间',
    },
    {
      field: 'action',
      title: '操作',
      slots: { default: 'action' },
      width: 150,
    },
  ],
  proxyConfig: {
    autoLoad: false,
    ajax: {
      query: async ({ page }, formValues) => {
        return await fetchItemList({
          ...formValues,
          ...state.queryData,
          current: page.currentPage,
          size: page.pageSize,
        });
      },
    },
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

const [Grid, GridApi] = useVbenVxeGrid({
  gridEvents,
  gridOptions,
});

const [FormModal, FormModalApi] = useVbenModal({
  // 连接抽离的组件
  connectedComponent: FormModalComponent,
});
// 新增操作
const onOpenAdd = (row?: any) => {
  FormModalApi.setData({ type: 'page.common.addBtn', data: row }).open();
};

// 编辑操作
const onOpenEdit = (row: any) => {
  FormModalApi.setData({ type: 'page.common.editBtn', data: row }).open();
};

// 删除操作
const handleDelete = (id: string) => {
  confirm($t('page.common.delConfirmText')).then(async () => {
    try {
      await delItemObj(id);
      GridApi.reload();
      ElMessage.success($t('page.common.delSuccessText'));
    } catch (error: any) {
      ElMessage.error(error.msg);
    }
  });
};
const open = (row: Record<string, any>) => {
  state.queryData.dictId = row.id;
  state.queryData.dictType = row.dictType;
  GridApi.reload();
};
// 暴露变量
defineExpose({
  open,
});
</script>

<template>
  <div class="page">
    <Grid>
      <template #toolbar-actions>
        <ElButton
          v-access:code="['sys_dict_add']"
          :icon="SolarFolderAdd"
          type="primary"
          @click="onOpenAdd({ queryData: state.queryData })"
        >
          {{ $t('page.common.addBtn') }}
        </ElButton>
      </template>
      <template #action="{ row }">
        <ElButton
          :icon="CircumEdit"
          link
          type="primary"
          v-access:code="['sys_dict_edit']"
          @click="onOpenEdit(row)"
        >
          {{ $t('page.common.editBtn') }}
        </ElButton>
        <ElButton
          :icon="WeuiDelete"
          @click="handleDelete(row.id)"
          link
          type="primary"
          v-access:code="['sys_dict_del']"
        >
          {{ $t('page.common.delBtn') }}
        </ElButton>
      </template>
    </Grid>
    <!-- 编辑、新增弹窗 -->
    <FormModal @refresh="() => GridApi.reload()" />
  </div>
</template>
<style lang="scss" scoped>
.page {
  height: 100%;
}
</style>
