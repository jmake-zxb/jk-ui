<script setup lang="ts">
import type { VbenFormProps } from '#/adapter/form';
import type { VxeGridListeners, VxeGridProps } from '#/adapter/vxe-table';

import { computed, ref } from 'vue';

import { confirm, useVbenModal } from '@vben/common-ui';
import { SolarFolderAdd, WeuiDelete } from '@vben/icons';

import { ElButton, ElMessage, ElSwitch, ElTooltip } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { delObj, pageList, putObj } from '#/api/ai/reviewDocument';
import { $t } from '#/locales';
import { filesize } from '#/utils/file-util';

import ChunkUploadModalComponent from './chunk-upload.vue';
import ChunkViewModalComponent from './chunk-view.vue';

const selectedRows = ref<any[]>([]);

const gridEvents: VxeGridListeners = {
  checkboxAll: ({ records }) => {
    selectedRows.value = records;
  },
  checkboxChange: ({ records }) => {
    selectedRows.value = records;
  },
};

const gridOptions: VxeGridProps = {
  columns: [
    { align: 'center', type: 'checkbox', width: 40 },
    { title: '序号', type: 'seq', width: 50 },
    { field: 'fileName', title: '文件名称' },
    { field: 'charCount', title: '字符数', slots: { default: 'charCount' } },
    { field: 'chunkCount', title: '分段' },
    {
      field: 'enabled',
      title: '启用状态',
      slots: { default: 'enabled' },
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
        return await pageList({
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
        placeholder: '请输入文件名称',
      },
      fieldName: 'fileName',
      label: '文件名称',
    },
  ],
  // 控制表单是否显示折叠按钮
  showCollapseButton: false,
  submitButtonOptions: {},
  // 是否在字段值改变时提交表单
  submitOnChange: false,
  // 按下回车时是否提交表单
  submitOnEnter: true,
  handleReset: async () => {
    await GridFileApi.formApi.resetForm();
    const formValues = await GridFileApi.formApi.getValues();
    GridFileApi.formApi.setLatestSubmissionValues(formValues);
    GridFileApi.reload();
  },
};

const [GridFile, GridFileApi] = useVbenVxeGrid({
  gridEvents,
  gridOptions,
  formOptions,
} as any);

const multiple = computed(() => selectedRows.value.length === 0);

// 删除操作
const handleDelete = (ids: string[]) => {
  confirm($t('page.common.delConfirmText')).then(async () => {
    try {
      await delObj(ids);
      GridFileApi.reload();
      ElMessage.success($t('page.common.delSuccessText'));
    } catch (error: any) {
      ElMessage.error(error.msg);
    }
  });
};

// 表格内开关
const changeSwitch = async (row: object) => {
  await putObj(row);
  ElMessage.success($t('page.common.optSuccessText'));
  GridFileApi.reload();
};

const [ChunkUploadModal, ChunkUploadModalApi] = useVbenModal({
  // 连接抽离的组件
  connectedComponent: ChunkUploadModalComponent,
});

const onOpenChunkUploadAdd = () => {
  ChunkUploadModalApi.setData({
    type: 'page.common.addBtn',
    data: {},
  }).open();
};

const [ChunkViewModal, ChunkViewModalApi] = useVbenModal({
  // 连接抽离的组件
  connectedComponent: ChunkViewModalComponent,
});
</script>

<template>
  <div class="h-full">
    <GridFile>
      <template #toolbar-actions>
        <ElButton
          v-access:code="['sys_user_add']"
          :icon="SolarFolderAdd"
          type="primary"
          @click="onOpenChunkUploadAdd()"
        >
          上传规则文件
        </ElButton>
        <ElButton
          plain
          v-access:code="['sys_user_del']"
          class="ml10"
          :disabled="multiple"
          :icon="WeuiDelete"
          type="primary"
          @click="
            handleDelete(
              GridFileApi?.grid?.getCheckboxRecords?.().map((item) => item.id),
            )
          "
        >
          {{ $t('page.common.delBtn') }}
        </ElButton>
      </template>
      <template #enabled="{ row }">
        <ElSwitch v-model="row.enabled" @change="() => changeSwitch(row)" />
      </template>
      <template #charCount="{ row }">
        {{ filesize(row.charCount) }}
      </template>
      <template #action="{ row }">
        <ElButton
          link
          type="primary"
          @click="() => ChunkViewModalApi.setData({ id: row.id }).open()"
        >
          分段
        </ElButton>
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
    </GridFile>
    <!-- 切片上传文件 -->
    <ChunkUploadModal @refresh="() => GridFileApi.reload()" />
    <!-- 切片查看 -->
    <ChunkViewModal />
  </div>
</template>

<style scoped></style>
