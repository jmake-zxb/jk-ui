<script lang="ts" setup>
import type { VbenFormProps, VbenFormSchema } from '@vben/common-ui';

import type { VxeGridListeners, VxeGridProps } from '#/adapter/vxe-table';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { CircumEdit, WeuiDelete } from '@vben/icons';
import { $t } from '@vben/locales';

import { ElButton, ElMessage } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { list } from '#/api/gen/datasource';
import { fetchList, useSyncTableApi, useTableApi } from '#/api/gen/table';
import { router } from '#/router';
import { validateNull } from '#/utils/validate';

// 多选变量
const datasourceList: any = ref([]);

const formSchema = computed<VbenFormSchema[]>(() => [
  {
    component: 'Select',
    componentProps: {
      allowClear: true,
      filterOption: true,
      options: [
        { label: '默认数据源', value: 'master' },
        ...datasourceList.value,
      ],
      showSearch: true,
      placeholder: $t('table.table.inputdatasourceTip'),
    },
    defaultValue: 'master',
    fieldName: 'dsName',
    label: $t('table.table.datasource'),
  },
  {
    component: 'Input',
    componentProps: {
      clearable: true,
      placeholder: $t('table.table.inputtableNameTip'),
    },
    fieldName: 'tableName',
    label: $t('table.table.tableName'),
  },
]);

const formOptions: VbenFormProps = {
  schema: formSchema.value,
  // 控制表单是否显示折叠按钮
  showCollapseButton: false,
  submitButtonOptions: {},
  // 是否在字段值改变时提交表单
  submitOnChange: false,
  // 按下回车时是否提交表单
  submitOnEnter: true,
};

const gridOptions: VxeGridProps = {
  columns: [
    { title: $t('table.table.index'), type: 'seq', width: 50 },
    { field: 'name', title: $t('table.table.tableName') },
    { field: 'comment', title: $t('table.table.tableDesc') },
    { field: 'createTime', title: $t('table.table.createTime') },
    {
      field: 'action',
      title: $t('page.common.action'),
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
          descs: 'create_time',
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

const gridEvents: VxeGridListeners = {};

const [Grid, gridApi] = useVbenVxeGrid({
  gridEvents,
  gridOptions,
  formOptions,
});

const openGen = async (row: { name: any }) => {
  const queryForm = await gridApi.formApi.getValues();
  useTableApi(queryForm.dsName, row.name)
    .then((res) => {
      if (validateNull(res.fieldList)) {
        syncTable(row);
      }
    })
    .finally(() => {
      router.push({
        path: '/gen/gener/index',
        query: {
          tableName: row.name,
          dsName: queryForm.dsName,
        },
      });
    });
};

// 同步表数据
const syncTable = async (row: { name: string }) => {
  const queryForm = await gridApi.formApi.getValues();
  useSyncTableApi(queryForm.dsName, row.name).then(() => {
    ElMessage.success($t('page.common.optSuccessText'));
  });
};

// 初始化数据
onMounted(() => {
  list().then((res: any[]) => {
    res?.map((element: Record<string, any>) => {
      return datasourceList.value.push({
        label: element.name,
        value: element.name,
      });
    });
    gridApi.formApi.updateSchema(formSchema.value);
  });
});
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #action="{ row }">
        <ElButton
          :icon="CircumEdit"
          link
          type="primary"
          v-access:code="['sys_client_add']"
          @click="syncTable(row)"
        >
          {{ $t('table.gen.syncBtn') }}
        </ElButton>
        <ElButton
          :icon="WeuiDelete"
          @click="openGen(row)"
          link
          type="primary"
          v-access:code="['sys_client_del']"
        >
          {{ $t('table.gen.genBtn') }}
        </ElButton>
      </template>
    </Grid>
  </Page>
</template>

<style lang="scss" scoped>
.div {
  margin-top: 90px;
}
</style>
