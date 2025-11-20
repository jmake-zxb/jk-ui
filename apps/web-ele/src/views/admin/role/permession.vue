<script setup lang="ts" name="role-permession">
import type { Ref } from 'vue';

import { reactive, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { ElMessage, ElScrollbar, ElTree } from 'element-plus';

import { fetchRoleTree, permissionUpd } from '#/api/admin/role';
import { pageList } from '#/api/core/menu';
import { $t } from '#/locales';
import { resolveAllEunuchNodeId } from '#/utils/other';

const menuTree = ref();
const checkStrictly = ref(true);
const loading = ref(false);

const state = reactive({
  checkedKeys: [] as any[],
  treeData: [] as any[],
  defaultProps: {
    label: 'name',
    value: 'id',
  },
  roleId: '',
  dialog: {
    isShowDialog: false,
    title: '分配权限',
    submitTxt: '更新',
  },
});

const checkedKeys: Ref<any[]> = ref([]);

const [Modal, modalApi] = useVbenModal({
  draggable: true,
  closeOnClickModal: false,
  closeOnPressEscape: false,
  onCancel() {
    modalApi.close();
  },
  onConfirm() {
    onSubmit();
  },
  async onOpenChange(isOpen) {
    if (isOpen) {
      modalApi.setState({
        title: state.dialog.title,
      });
      const { data: row } = modalApi.getData<Record<string, any>>();
      state.checkedKeys = [];
      state.treeData = [];
      checkedKeys.value = [];
      state.roleId = row.roleId;
      modalApi.setState({ loading: true });
      fetchRoleTree(row.roleId)
        .then((res) => {
          checkedKeys.value = res;
          return pageList({});
        })
        .then((r) => {
          state.treeData = r;
          state.checkedKeys = resolveAllEunuchNodeId(
            state.treeData,
            checkedKeys.value,
            [],
          );
        })
        .finally(() => {
          modalApi.setState({ loading: false });
        });
    }
  },
});

// 提交授权数据
const onSubmit = () => {
  const checked = menuTree.value.getCheckedKeys();
  const halfChecked = menuTree.value.getHalfCheckedKeys();
  const allKeys = [...checked, ...halfChecked];

  const menuIds = allKeys.filter((key) => key !== null && key !== '').join(',');
  modalApi.setState({ loading: true });
  permissionUpd(state.roleId, menuIds)
    .then(() => {
      ElMessage.success($t('page.common.editSuccessText'));
    })
    .finally(() => {
      modalApi.setState({ loading: false });
      modalApi.close();
    });
};
</script>

<template>
  <Modal>
    <ElScrollbar class="h-[400px] sm:h-[600px]">
      <ElTree
        v-loading="loading"
        ref="menuTree"
        :data="state.treeData"
        :default-checked-keys="state.checkedKeys"
        :check-strictly="!checkStrictly"
        :props="state.defaultProps"
        class="filter-tree"
        node-key="id"
        highlight-current
        show-checkbox
      />
    </ElScrollbar>
  </Modal>
</template>

<style scoped></style>
