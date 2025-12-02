<script setup lang="ts" name="systemSysAuditLog">
// ========== 导入声明 ==========
import type { VbenFormProps, VbenFormSchema } from '@vben/common-ui';

import type { VxeGridListeners, VxeGridProps } from '#/adapter/vxe-table';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { confirm, Page } from '@vben/common-ui';
import { WeuiDelete } from '@vben/icons';

import { ElButton, ElMessage } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { delObjs, exportData, fetchList } from '#/api/admin/sysAuditLog';
import { $t } from '#/locales';

// ========== 字典数据 ==========

// ========== table表格 ==========
const { hasAccessByCodes } = useAccess();
const selectedRows = ref<any[]>([]);

const formSchema = computed<VbenFormSchema[]>(() => [
  {
    component: 'Input',
    componentProps: {
      clearable: true,
      placeholder: '请输入审计名称',
    },
    fieldName: 'auditName',
    label: '审计名称',
  },
  {
    component: 'Input',
    componentProps: {
      clearable: true,
      placeholder: '请输入字段名称',
    },
    fieldName: 'auditField',
    label: '字段名称',
  },
  {
    component: 'Input',
    componentProps: {
      clearable: true,
      placeholder: '请输入操作人',
    },
    fieldName: 'createBy',
    label: '操作人',
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
      field: 'auditName',
      title: '审计名称',
    },
    {
      field: 'auditField',
      title: '字段名称',
    },
    {
      field: 'beforeVal',
      title: '变更前值',
    },
    {
      field: 'afterVal',
      title: '变更后值',
    },
    {
      field: 'createBy',
      title: '操作人',
    },
    {
      field: 'createTime',
      title: '操作时间',
    },
    {
      field: 'action',
      title: '操作',
      slots: { default: 'action' },
      width: 80,
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
    export: hasAccessByCodes(['sys_audit_log_export']),
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

const multiple = computed(() => selectedRows.value.length === 0);

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
          plain
          v-access:code="['sys_audit_log_del']"
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
          :icon="WeuiDelete"
          @click="handleDelete([row.id])"
          link
          type="primary"
          v-access:code="['sys_audit_log_del']"
        >
          {{ $t('page.common.delBtn') }}
        </ElButton>
      </template>
    </Grid>
  </Page>
</template>
