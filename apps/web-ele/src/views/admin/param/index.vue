<script lang="ts" setup>
import type { VbenFormProps } from '@vben/common-ui';

import type { VxeGridListeners, VxeGridProps } from '#/adapter/vxe-table';

import { computed, ref } from 'vue';

import { confirm, Page, useVbenModal } from '@vben/common-ui';
import { CircumEdit, SolarFolderAdd, WeuiDelete } from '@vben/icons';
import { $t } from '@vben/locales';

import { ElButton, ElMessage } from 'element-plus';

import { useDict } from '#/adapter/dict';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { delObj, fetchList } from '#/api/admin/param';
import DictTag from '#/component/DictTag/index.vue';

import ExtraModal from './form.vue';

const { dict_type, status_type } = useDict('dict_type', 'status_type');
const selectedRows = ref<any[]>([]);

const formOptions: VbenFormProps = {
  schema: [
    {
      component: 'Input',
      componentProps: {
        clearable: true,
        placeholder: $t('param.param.inputpublicNameTip'),
      },
      fieldName: 'publicName',
      label: $t('param.param.publicName'),
    },
    {
      component: 'Input',
      componentProps: {
        clearable: true,
        placeholder: $t('param.param.inputpublicKeyTip'),
      },
      fieldName: 'publicKey',
      label: $t('param.param.publicKey'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        filterOption: true,
        options: dict_type?.value,
        showSearch: true,
        placeholder: $t('param.param.inputsystemFlagTip'),
      },
      fieldName: 'systemFlag',
      label: $t('param.param.systemFlag'),
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
  columns: [
    { align: 'center', type: 'checkbox', width: 40 },
    { title: $t('param.param.index'), type: 'seq', width: 50 },
    { field: 'publicName', title: $t('param.param.publicName') },
    { field: 'publicKey', title: $t('param.param.publicKey') },
    { field: 'publicValue', title: $t('param.param.publicValue') },
    {
      field: 'status',
      title: $t('param.param.status'),
      slots: { default: 'status' },
    },
    { field: 'createTime', title: $t('param.param.createTime') },
    {
      field: 'systemFlag',
      title: $t('param.param.systemFlag'),
      slots: { default: 'systemFlag' },
    },
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

const gridEvents: VxeGridListeners = {
  checkboxAll: ({ records }) => {
    selectedRows.value = records;
  },
  checkboxChange: ({ records }) => {
    selectedRows.value = records;
  },
};

const [Grid, gridApi] = useVbenVxeGrid({
  gridEvents,
  gridOptions,
  formOptions,
});

const multiple = computed(() => selectedRows.value.length === 0);

const [FormModal, formModalApi] = useVbenModal({
  // 连接抽离的组件
  connectedComponent: ExtraModal,
});

const onOpenAdd = (_type?: string, row?: any) => {
  formModalApi.setData({ type: 'page.common.addBtn', data: row }).open();
};

const onOpenEdit = (type: string, row: any) => {
  formModalApi.setData({ type: 'page.common.editBtn', data: row }).open();
};

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
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #toolbar-actions>
        <ElButton
          v-access:code="['sys_menu_add']"
          :icon="SolarFolderAdd"
          type="primary"
          @click="onOpenAdd()"
        >
          {{ $t('page.common.addBtn') }}
        </ElButton>
        <ElButton
          plain
          v-access:code="['sys_client_del']"
          class="ml10"
          :disabled="multiple"
          :icon="WeuiDelete"
          type="primary"
          @click="
            handleDelete(
              gridApi?.grid
                ?.getCheckboxRecords?.()
                .map((item) => item.publicId),
            )
          "
        >
          {{ $t('page.common.delBtn') }}
        </ElButton>
      </template>
      <template #status="{ row }">
        <DictTag :options="status_type" :value="row.status" />
      </template>
      <template #systemFlag="{ row }">
        <DictTag :options="dict_type" :value="row.systemFlag" />
      </template>
      <template #action="{ row }">
        <ElButton
          :icon="CircumEdit"
          link
          type="primary"
          v-access:code="['sys_client_add']"
          @click="onOpenEdit('edit', row)"
        >
          {{ $t('page.common.editBtn') }}
        </ElButton>
        <ElButton
          :icon="WeuiDelete"
          @click="handleDelete([row.publicId])"
          link
          type="primary"
          v-access:code="['sys_client_del']"
        >
          {{ $t('page.common.delBtn') }}
        </ElButton>
      </template>
    </Grid>
    <FormModal @refresh="() => gridApi.reload()" />
  </Page>
</template>

<style lang="scss" scoped>
.div {
  margin-top: 90px;
}
</style>
