<script setup lang="ts" name="systemSysDict">
// ========== 导入声明 ==========
import type { VbenFormProps, VbenFormSchema } from '@vben/common-ui';

import type { VxeGridListeners, VxeGridProps } from '#/adapter/vxe-table';

import { computed, defineAsyncComponent, ref } from 'vue';

import { confirm, Page, useVbenModal } from '@vben/common-ui';
import { CircumEdit, SolarFolderAdd, WeuiDelete } from '@vben/icons';

import { ElButton, ElMessage, ElSplitter, ElSplitterPanel } from 'element-plus';

// import { useDict } from '#/adapter/dict';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { delObj, fetchPage } from '#/api/admin/dict';
import { $t } from '#/locales';

import DictItem from './dictItem/index.vue';

// ========== 组件声明 ==========
// 异步加载表单弹窗组件
const FormModalComponent = defineAsyncComponent(() => import('./form.vue'));

// ========== 字典数据 ==========
// 加载字典数据
// const { dict_type } = useDict('dict_type');

// ========== table表格 ==========
const dictItemRef = ref();

const formSchema = computed<VbenFormSchema[]>(() => [
  {
    component: 'Input',
    componentProps: {
      clearable: true,
      placeholder: '请输入字典名称',
    },
    fieldName: 'description',
    label: '字典名称',
    hideLabel: true,
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
  resetButtonOptions: {
    show: false,
  },
};

const gridOptions: VxeGridProps = {
  height: 'auto',
  rowConfig: {
    isCurrent: true,
  },
  columns: [
    {
      field: 'description',
      title: '字典名称',
    },
    {
      field: 'dictType',
      title: '字典标识',
    },
    // {
    //   field: 'systemFlag',
    //   title: '系统标志',
    //   cellRender: {
    //     name: 'CellDictTag',
    //     props: {
    //       options: dict_type,
    //     },
    //   },
    // },
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
        return await fetchPage({
          ...formValues,
          current: page.currentPage,
          size: page.pageSize,
          descs: 'create_time',
        });
      },
    },
  },
};

const gridEvents: VxeGridListeners = {
  cellClick: ({ row }) => {
    dictItemRef.value.open(row);
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
</script>

<template>
  <Page auto-content-height class="jk-page">
    <ElSplitter>
      <ElSplitterPanel size="500px" min="500px" max="600px">
        <Grid>
          <template #toolbar-actions>
            <ElButton
              v-access:code="['sys_dict_add']"
              :icon="SolarFolderAdd"
              type="primary"
              @click="onOpenAdd()"
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
            />
            <ElButton
              :icon="WeuiDelete"
              @click="handleDelete([row.id])"
              link
              type="danger"
              v-access:code="['sys_dict_del']"
            />
          </template>
        </Grid>
      </ElSplitterPanel>
      <ElSplitterPanel class="ml8">
        <DictItem ref="dictItemRef" />
      </ElSplitterPanel>
    </ElSplitter>

    <!-- 编辑、新增弹窗 -->
    <FormModal @refresh="() => GridApi.reload()" />
  </Page>
</template>

<style lang="scss" scoped>
:deep(.ml8) {
  margin-left: 8px;
}

:deep(.el-splitter-panel) {
  overflow: hidden;
}

:deep(.el-splitter-bar__dragger-horizontal)::before {
  width: 0;
}
</style>
