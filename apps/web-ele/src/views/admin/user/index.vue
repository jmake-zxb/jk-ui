<script lang="ts" setup>
import type { VbenFormProps } from '@vben/common-ui';

import type { VxeGridListeners, VxeGridProps } from '#/adapter/vxe-table';
import type { BasicUserInfo } from '#/api/core/user';

import { computed, reactive, ref } from 'vue';

import { confirm, Page, useVbenModal, VbenIcon } from '@vben/common-ui';
import { CircumEdit, SolarFolderAdd, WeuiDelete } from '@vben/icons';

import {
  ElButton,
  ElMessage,
  ElScrollbar,
  ElSplitter,
  ElSplitterPanel,
  ElSwitch,
  ElTag,
  ElTooltip,
} from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deptTree } from '#/api/admin/dept';
import { delObj, pageList, putObj } from '#/api/core/user';
import QueryTree from '#/component/QueryTree/index.vue';
import { $t } from '#/locales';

import { querySchema, useColumns } from './data';
import ExtraModal from './form.vue';

const selectedRows = ref<any[]>([]);
const deptId = ref();

const formOptions: VbenFormProps = {
  schema: querySchema,
  // 控制表单是否显示折叠按钮
  showCollapseButton: false,
  submitButtonOptions: {},
  // 是否在字段值改变时提交表单
  submitOnChange: false,
  // 按下回车时是否提交表单
  submitOnEnter: true,
  handleReset: async () => {
    deptId.value = '';
    await GridApi.formApi.resetForm();
    const formValues = await GridApi.formApi.getValues();
    GridApi.formApi.setLatestSubmissionValues(formValues);
    GridApi.reload();
  },
};

const gridOptions: VxeGridProps<BasicUserInfo> = {
  columns: useColumns(),
  height: 'auto',
  checkboxConfig: {
    checkMethod({ row }) {
      return row.userId !== '1';
    },
  },
  toolbarConfig: {
    custom: true,
    export: true,
    refresh: true,
    zoom: true,
    // @ts-ignore 正式环境时有完整的类型声明
    search: true,
  },
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues) => {
        return await pageList({
          ...formValues,
          deptId: deptId.value,
          current: page.currentPage,
          size: page.pageSize,
        });
      },
    },
  },
};

const gridEvents: VxeGridListeners<BasicUserInfo> = {
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

const multiple = computed(() => selectedRows.value.length === 0);

// 部门树使用的数据
const deptData = reactive({
  queryList: (name: String) => {
    return deptTree({
      deptName: name,
    });
  },
});

// 点击树
const handleNodeClick = (e: any) => {
  deptId.value = e.id;
  GridApi.query();
};

const [FormModal, formModalApi] = useVbenModal({
  // 连接抽离的组件
  connectedComponent: ExtraModal,
  onCancel() {
    GridApi.reload();
  },
});

// 打开新增菜单弹窗
const onOpenAdd = (row?: any) => {
  formModalApi.setData({ type: 'page.common.addBtn', data: row }).open();
};

// 打开编辑菜单弹窗
const onOpenEdit = (row?: any) => {
  formModalApi.setData({ type: 'page.common.editBtn', data: row }).open();
};

// 表格内开关 (用户状态)
const changeSwitch = async (row: object) => {
  await putObj(row);
  ElMessage.success($t('page.common.optSuccessText'));
  GridApi.reload();
};
</script>

<template>
  <Page auto-content-height>
    <ElSplitter>
      <ElSplitterPanel size="220px" min="200px" max="350px">
        <div class="left-content">
          <ElScrollbar>
            <QueryTree
              :placeholder="$t('page.common.queryDeptTip')"
              :query="deptData.queryList"
              :show-expand="true"
              @node-click="handleNodeClick"
            >
              <!-- 没有数据权限提示 -->
              <template #default="{ node, data }">
                <ElTooltip
                  v-if="data.isLock"
                  class="item"
                  effect="dark"
                  :content="$t('user.sysuser.noDataScopeTip')"
                  placement="right-start"
                >
                  <span>
                    {{ node.label }}
                    <VbenIcon icon="ant-design:lock-outlined" />
                  </span>
                </ElTooltip>
                <span v-if="!data.isLock">{{ node.label }}</span>
              </template>
            </QueryTree>
          </ElScrollbar>
        </div>
      </ElSplitterPanel>
      <ElSplitterPanel class="ml8">
        <Grid>
          <template #toolbar-actions>
            <ElButton
              v-access:code="['sys_user_add']"
              :icon="SolarFolderAdd"
              type="primary"
              @click="onOpenAdd()"
            >
              {{ $t('page.common.addBtn') }}
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
                  GridApi?.grid?.getCheckboxRecords?.().map((item) => item.id),
                )
              "
            >
              {{ $t('page.common.delBtn') }}
            </ElButton>
          </template>
          <template #post="{ row }">
            <ElTag v-for="item in row.postList" :key="item.postId">
              {{ item.postName }}
            </ElTag>
          </template>
          <template #role="{ row }">
            <ElTag v-for="item in row.roleList" :key="item.roleId">
              {{ item.roleName }}
            </ElTag>
          </template>
          <template #lockFlag="{ row }">
            <ElSwitch
              v-model="row.lockFlag"
              @change="changeSwitch(row)"
              :disabled="row.userId === '1'"
              active-value="0"
              inactive-value="9"
            />
          </template>
          <template #action="{ row }">
            <ElButton
              v-access:code="['sys_user_edit']"
              :icon="CircumEdit"
              link
              type="primary"
              @click="onOpenEdit(row)"
            >
              {{ $t('page.common.editBtn') }}
            </ElButton>
            <ElTooltip
              :content="$t('user.sysuser.deleteDisabledTip')"
              :disabled="row.userId !== '1'"
              placement="top"
            >
              <span style="margin-left: 12px">
                <ElButton
                  :icon="WeuiDelete"
                  v-access:code="['sys_user_del']"
                  :disabled="row.userId === '1'"
                  link
                  type="primary"
                  @click="handleDelete([row.userId])"
                  >{{ $t('page.common.delBtn') }}
                </ElButton>
              </span>
            </ElTooltip>
          </template>
        </Grid>
        <FormModal @refresh="() => GridApi.reload()" />
      </ElSplitterPanel>
    </ElSplitter>
  </Page>
</template>

<style lang="scss" scoped>
.div {
  margin-top: 90px;
}

:deep(.ml8) {
  margin-left: 8px;
}

:deep(.el-splitter-panel) {
  overflow: hidden;
}

:deep(.el-splitter-bar__dragger-horizontal)::before {
  width: 0;
}

.left-content {
  width: 100%;
  height: 100%;
  padding: 10px;
  overflow: hidden;
  background-color: hsl(var(--card));
  border-radius: calc(var(--radius) - 2px);
}
</style>
