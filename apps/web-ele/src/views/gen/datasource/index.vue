<script setup lang="ts" name="systemGenDatasourceConf">
// ========== 导入声明 ==========
import type { VbenFormProps, VbenFormSchema } from '@vben/common-ui';

import type { VxeGridListeners, VxeGridProps } from '#/adapter/vxe-table';

import { computed, defineAsyncComponent, ref } from 'vue';

import { confirm, Page, useVbenModal } from '@vben/common-ui';
import { CircumEdit, SolarFolderAdd, WeuiDelete } from '@vben/icons';

import { ElButton, ElMessage } from 'element-plus';

import { useDict } from '#/adapter/dict';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { downBlobFile } from '#/api/core/other';
import { delObj, fetchList } from '#/api/gen/datasource';
import { $t } from '#/locales';

// ========== 组件声明 ==========
// 异步加载表单弹窗组件
const FormModalComponent = defineAsyncComponent(() => import('./form.vue'));

// ========== 字典数据 ==========
// 加载字典数据
const { ds_type } = useDict('ds_type');

// ========== table表格 ==========

const selectedRows = ref<any[]>([]);

const formSchema = computed<VbenFormSchema[]>(() => [
  {
    component: 'Input',
    componentProps: {
      clearable: true,
      placeholder: '请输入数据库名称',
    },
    fieldName: 'dsName',
    label: '数据库名称',
  },
]);

const formOptions: VbenFormProps = {
  schema: formSchema?.value,
  // 控制表单是否显示折叠按钮
  showCollapseButton: false,
  collapsed: false,
  submitButtonOptions: {},
  // 是否在字段值改变时提交表单
  submitOnChange: false,
  // 按下回车时是否提交表单
  submitOnEnter: true,
};

const gridOptions: VxeGridProps = {
  columns: [
    { type: 'checkbox', width: 40 },
    { title: '#', type: 'seq', width: 40 },
    {
      field: 'name',
      title: '别名',
    },
    {
      field: 'dsName',
      title: '数据库名称',
    },
    {
      field: 'dsType',
      title: '数据库类型',
      cellRender: {
        name: 'CellDictTag',
        props: {
          options: ds_type,
        },
      },
    },
    {
      field: 'username',
      title: '用户名',
    },
    {
      field: 'createTime',
      title: '创建时间',
    },
    {
      field: 'action',
      title: '操作',
      slots: { default: 'action' },
      width: 200,
    },
  ],
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

const [Grid, GridApi] = useVbenVxeGrid({
  gridEvents,
  gridOptions,
  formOptions,
});

const [FormModal, FormModalApi] = useVbenModal({
  // 连接抽离的组件
  connectedComponent: FormModalComponent,
});

const multiple = computed(() => selectedRows.value.length === 0);

// 新增操作
const onOpenAdd = (row?: any) => {
  FormModalApi.setData({ type: 'page.common.addBtn', data: row }).open();
};

// 编辑操作
const onOpenEdit = (row: any) => {
  FormModalApi.setData({ type: 'page.common.editBtn', data: row }).open();
};

// 删除操作
const handleDelete = (ids: string[]) => {
  confirm($t('page.common.delConfirmText')).then(async () => {
    try {
      await delObj(ids);
      GridApi.reload();
      ElMessage.success($t('page.common.delSuccessText'));
    } catch (error: any) {
      ElMessage.error(error.msg);
    }
  });
};

const downloadDoc = (dsName: string) => {
  downBlobFile('/gen/dsconf/doc', { dsName }, `${dsName}.html`);
};
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #toolbar-actions>
        <ElButton :icon="SolarFolderAdd" type="primary" @click="onOpenAdd()">
          {{ $t('page.common.addBtn') }}
        </ElButton>
        <ElButton
          plain
          class="ml10"
          :disabled="multiple"
          :icon="WeuiDelete"
          type="primary"
          @click="
            handleDelete(
              GridApi?.grid?.getCheckboxRecords?.().map((item) => item.id),
            )
          "
        >
          {{ $t('page.common.delBtn') }}
        </ElButton>
      </template>
      <template #action="{ row }">
        <ElButton @click="downloadDoc(row.name)" link type="primary">
          <span class="icon-[ep--document]"></span>文档
        </ElButton>
        <ElButton
          :icon="CircumEdit"
          link
          type="primary"
          @click="onOpenEdit(row)"
        >
          {{ $t('page.common.editBtn') }}
        </ElButton>
        <ElButton
          :icon="WeuiDelete"
          @click="handleDelete([row.id])"
          link
          type="primary"
        >
          {{ $t('page.common.delBtn') }}
        </ElButton>
      </template>
    </Grid>
    <!-- 编辑、新增弹窗 -->
    <FormModal @refresh="() => GridApi.reload()" />
  </Page>
</template>
