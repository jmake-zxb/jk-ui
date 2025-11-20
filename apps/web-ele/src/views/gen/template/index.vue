<script setup lang="ts" name="systemGenTemplate">
// ========== 导入声明 ==========
import type { VbenFormProps, VbenFormSchema } from '@vben/common-ui';

import type { VxeGridListeners, VxeGridProps } from '#/adapter/vxe-table';

import { computed, defineAsyncComponent, ref } from 'vue';

import { confirm, Page, useVbenModal } from '@vben/common-ui';
import { CircumEdit, SolarFolderAdd, WeuiDelete } from '@vben/icons';

import { ElButton, ElMessage } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { delObjs, exportData, fetchList } from '#/api/gen/template';
import { $t } from '#/locales';

// ========== 组件声明 ==========
// 异步加载表单弹窗组件
const FormModalComponent = defineAsyncComponent(() => import('./form.vue'));

// ========== 字典数据 ==========

// ========== table表格 ==========

const selectedRows = ref<any[]>([]);

const formSchema = computed<VbenFormSchema[]>(() => [
  {
    component: 'Input',
    componentProps: {
      clearable: true,
      placeholder: '请输入模板名称',
    },
    fieldName: 'templateName',
    label: '模板名称',
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
      field: 'templateName',
      title: '模板名称',
    },
    {
      field: 'generatorPath',
      title: '模板路径',
    },
    {
      field: 'templateDesc',
      title: '模板描述',
    },
    {
      field: 'createTime',
      title: '创建时间',
      sortable: true,
    },
    {
      field: 'action',
      title: '操作',
      slots: { default: 'action' },
      width: 150,
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
      // 定义导出全部数据
      queryAll: async () => {
        const params = await GridApi?.formApi?.getValues();
        const data = await exportData(params);
        return { items: data };
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
      await delObjs(ids);
      GridApi.reload();
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
          v-access:code="['codegen_template_add']"
          :icon="SolarFolderAdd"
          type="primary"
          @click="onOpenAdd()"
        >
          {{ $t('page.common.addBtn') }}
        </ElButton>
        <ElButton
          plain
          v-access:code="['codegen_template_del']"
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
        <ElButton
          :icon="CircumEdit"
          link
          type="primary"
          v-access:code="['codegen_template_edit']"
          @click="onOpenEdit(row)"
        >
          {{ $t('page.common.editBtn') }}
        </ElButton>
        <ElButton
          :icon="WeuiDelete"
          @click="handleDelete([row.id])"
          link
          type="primary"
          v-access:code="['codegen_template_del']"
        >
          {{ $t('page.common.delBtn') }}
        </ElButton>
      </template>
    </Grid>
    <!-- 编辑、新增弹窗 -->
    <FormModal @refresh="() => GridApi.reload()" />
  </Page>
</template>
