<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';

import { computed, nextTick, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { ElMessage } from 'element-plus';

import { useVbenForm, z } from '#/adapter/form';
import { addObj, getObj, putObj } from '#/api/admin/role';
import { $t } from '#/locales';

// 定义子组件向父组件传值/事件
const emit = defineEmits(['refresh']);

const pageData = ref({
  roleId: '',
});

// 初始化表单数据
const getRoleData = (id: string) => {
  // 获取数据
  getObj(id).then((res: any) => {
    const formData = Object.assign(pageData.value, res);
    FormApi.setValues(formData || {});
  });
};

const [Modal, modalApi] = useVbenModal({
  draggable: true,
  closeOnClickModal: false,
  closeOnPressEscape: false,
  onCancel() {
    modalApi.close();
  },
  onConfirm() {
    FormApi.validateAndSubmitForm().then(async (values) => {
      if (!values) return;
      try {
        modalApi.setState({ loading: true });
        const form = Object.assign(pageData.value, values);
        pageData.value.roleId ? await putObj(form) : await addObj(form);
        ElMessage.success(
          $t(
            form.roleId
              ? 'page.common.editSuccessText'
              : 'page.common.addSuccessText',
          ),
        );
        modalApi.setState({ loading: false });
        modalApi.close();
        emit('refresh');
      } finally {
        modalApi.setState({ loading: false });
      }
    });
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const dat = modalApi.getData<Record<string, any>>();
      modalApi.setState({
        title: $t(dat.type),
      });
      nextTick(() => {
        FormApi.updateSchema(formSchema.value);
      });
      if (dat?.data?.roleId) {
        getRoleData(dat.data.roleId);
      } else {
        pageData.value = {
          roleId: '',
        };
      }
    }
  },
});

const formSchema = computed<VbenFormSchema[]>(() => [
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('role.sysrole.inputRoleNameTip'),
    },
    // 字段名
    fieldName: 'roleName',
    // 界面显示的label
    label: $t('role.sysrole.roleName'),
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('role.sysrole.please_enter_the_role_Code'),
    },
    // 字段名
    fieldName: 'roleCode',
    // 界面显示的label
    label: $t('role.sysrole.roleCode'),
    rules: z
      .string()
      .min(1, $t('role.sysrole.please_enter_the_role_Code'))
      .regex(/^[A-Z_]+$/, '只能包含大写英文字母和下划线'),
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('role.sysrole.please_enter_the_role_description'),
      type: 'textarea',
      rows: 3,
    },
    // 字段名
    fieldName: 'roleDesc',
    // 界面显示的label
    label: $t('role.sysrole.roleDesc'),
  },
]);

const [Form, FormApi] = useVbenForm({
  showDefaultActions: false,
  schema: formSchema.value,
});
</script>
<template>
  <Modal>
    <Form />
  </Modal>
</template>
