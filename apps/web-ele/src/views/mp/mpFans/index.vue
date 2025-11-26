<script setup lang="ts" name="systemMpFans">
// ========== 导入声明 ==========
import type { VbenFormProps, VbenFormSchema } from '@vben/common-ui';

import type { VxeGridListeners, VxeGridProps } from '#/adapter/vxe-table';

import { computed, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { confirm, Page } from '@vben/common-ui';
import { SolarFolderAdd, WeuiDelete } from '@vben/icons';

import { ElButton, ElMessage } from 'element-plus';

import { useDict } from '#/adapter/dict';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getObjs } from '#/api/mp/mpAccount';
import { delObjs, exportData, fetchList, syncMpFansApi } from '#/api/mp/mpFans';
import DictTag from '#/component/DictTag/index.vue';
import { $t } from '#/locales';

// ========== 字典数据 ==========
// 加载字典数据
const { subscribe, yes_no_type } = useDict('subscribe', 'yes_no_type');

// ========== table表格 ==========
const { hasAccessByCodes } = useAccess();
const selectedRows = ref<any[]>([]);

const wxAccountList = ref([]);

const getWxAccountList = async () => {
  const data = await getObjs();
  wxAccountList.value = data;
  if (data && data.length > 0) {
    GridApi.formApi.setFieldValue('wxAccountId', data[0].id);
  }
  GridApi.reload();
};

const formSchema = computed<VbenFormSchema[]>(() => [
  {
    component: 'Input',
    componentProps: {
      clearable: true,
      placeholder: '请输入昵称',
    },
    fieldName: 'nickname',
    label: '昵称',
  },
  {
    component: 'Select',
    componentProps: () => ({
      allowClear: true,
      filterOption: true,
      options: wxAccountList.value,
      props: {
        value: 'id',
        label: 'name',
      },
      showSearch: true,
      placeholder: '请选择微信公众号',
    }),
    fieldName: 'wxAccountId',
    label: '微信公众号',
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
      field: 'openid',
      title: '用户标识',
    },
    {
      align: 'center',
      field: 'subscribeStatus',
      title: '订阅状态',
      slots: { default: 'subscribeStatusColumn' },
    },
    {
      field: 'subscribeTime',
      title: '订阅时间',
    },
    {
      field: 'nickname',
      title: '昵称',
    },
    {
      field: 'language',
      title: '语言',
    },
    {
      field: 'remark',
      title: '备注信息',
    },
    {
      field: 'wxAccountName',
      title: '微信公众号',
    },
    {
      align: 'center',
      field: 'isBlack',
      title: '黑名单',
      slots: { default: 'isBlackColumn' },
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
    export: hasAccessByCodes(['mp_mpFans_export']),
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

const syncMpFans = async () => {
  await syncMpFansApi({ wxAccountId: '1991917746541670402' });
};

// 初始化数据
onMounted(() => {
  getWxAccountList();
});
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #toolbar-actions>
        <ElButton
          v-access:code="['mp_mpFans_syncMpFans']"
          :icon="SolarFolderAdd"
          type="primary"
          @click="syncMpFans()"
        >
          同步
        </ElButton>
        <ElButton
          plain
          v-access:code="['mp_mpFans_del']"
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
      <template #subscribeStatusColumn="{ row }">
        <DictTag :options="subscribe" :value="row.subscribeStatus" />
      </template>
      <template #isBlackColumn="{ row }">
        <DictTag :options="yes_no_type" :value="row.isBlack" />
      </template>
      <template #action="{ row }">
        <ElButton
          :icon="WeuiDelete"
          @click="handleDelete([row.id])"
          link
          type="primary"
          v-access:code="['mp_mpFans_del']"
        >
          {{ $t('page.common.delBtn') }}
        </ElButton>
      </template>
    </Grid>
  </Page>
</template>
