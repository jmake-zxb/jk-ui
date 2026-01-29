<script setup lang="ts">
import type { VbenFormProps } from '@vben/common-ui';

import type { VxeGridListeners, VxeGridProps } from '#/adapter/vxe-table';

import { computed, ref } from 'vue';

import { confirm } from '@vben/common-ui';
import { SolarFolderAdd, WeuiDelete } from '@vben/icons';

import { ElButton, ElMessage, ElTooltip } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { delObjs, fetchList } from '#/api/ai/auditRules';
import { $t } from '#/locales';

interface RowType {
  id: string;
  ruleName: string;
  tabName: string;
  conditionSql: string;
  conditionDescription: string;
  createdAt: string;
  updatedAt: string;
}

const selectedRows = ref<any[]>([]);

const gridEvents: VxeGridListeners<RowType> = {
  checkboxAll: ({ records }) => {
    selectedRows.value = records;
  },
  checkboxChange: ({ records }) => {
    selectedRows.value = records;
  },
  formReset: async () => {
    await GridRulerApi.formApi.resetForm();
    const formValues = await GridRulerApi.formApi.getValues();
    GridRulerApi.formApi.setLatestSubmissionValues(formValues);
    GridRulerApi.reload();
  },
};

const gridOptions: VxeGridProps<RowType> = {
  columns: [
    { align: 'center', type: 'checkbox', width: 40 },
    { title: '序号', type: 'seq', width: 50 },
    { field: 'ruleName', title: '规则名称' },
    { field: 'tabName', title: '数据源表' },
    { field: 'conditionSql', title: '规则' },
    {
      field: 'conditionDescription',
      title: '规则说明',
    },
    { field: 'createdAt', title: '创建时间' },
    { field: 'updatedAt', title: '更新时间' },
    {
      field: 'action',
      fixed: 'right',
      slots: { default: 'action' },
      title: $t('page.common.action'),
      width: 150,
    },
  ],
  toolbarConfig: {
    custom: true,
    export: true,
    refresh: true,
    zoom: true,
    // @ts-ignore 正式环境时有完整的类型声明
    search: true,
  },
  pagerConfig: {
    pageSize: 10,
  },
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
};

const formOptions: VbenFormProps = {
  schema: [
    {
      component: 'Input',
      componentProps: {
        clearable: true,
        placeholder: '请输入规则名称',
      },
      fieldName: 'ruleName',
      label: '规则名称',
    },
  ],
  // 控制表单是否显示折叠按钮
  showCollapseButton: false,
  // 是否在字段值改变时提交表单
  submitOnChange: false,
  // 按下回车时是否提交表单
  submitOnEnter: true,
};

const [GridRuler, GridRulerApi] = useVbenVxeGrid<RowType>({
  gridOptions,
  gridEvents,
  formOptions,
});

// 删除操作
const handleDelete = (ids: string[]) => {
  confirm($t('page.common.delConfirmText')).then(async () => {
    try {
      await delObjs(ids);
      GridRulerApi.reload();
      ElMessage.success($t('page.common.delSuccessText'));
    } catch (error: any) {
      ElMessage.error(error.msg);
    }
  });
};

const isSelectionEmpty = computed(() => selectedRows.value.length === 0);
</script>

<template>
  <div class="h-full">
    <GridRuler>
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
          :disabled="isSelectionEmpty"
          :icon="WeuiDelete"
          type="primary"
          @click="
            handleDelete(
              GridRulerApi?.grid?.getCheckboxRecords?.().map((item) => item.id),
            )
          "
        >
          {{ $t('page.common.delBtn') }}
        </ElButton>
      </template>
      <template #action="{ row }">
        <ElButton link type="primary"> 分段 </ElButton>
        <ElTooltip
          :content="$t('user.sysuser.deleteDisabledTip')"
          placement="top"
        >
          <span style="margin-left: 12px">
            <ElButton
              :icon="WeuiDelete"
              link
              type="primary"
              @click="handleDelete([row.id])"
              >{{ $t('page.common.delBtn') }}
            </ElButton>
          </span>
        </ElTooltip>
      </template>
    </GridRuler>
  </div>
</template>

<style scoped></style>
