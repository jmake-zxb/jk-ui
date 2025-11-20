<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';

import { computed, nextTick, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { ElMessage } from 'element-plus';

import { useDict } from '#/adapter/dict';
import { useVbenForm, z } from '#/adapter/form';
import { deptTree } from '#/api/admin/dept';
import { list as postList } from '#/api/admin/post';
import { list as roleList } from '#/api/admin/role';
import { addObj, getObj, putObj } from '#/api/core/user';
import { $t } from '#/locales';

// 定义子组件向父组件传值/事件
const emit = defineEmits(['refresh']);

// 定义字典
const { lock_flag } = useDict('lock_flag');

const pageData = ref({
  userId: '',
});

const deptData = ref<any[]>([]);
const roleData = ref<any[]>([]);
const postData = ref<any[]>([]);

/**
 * 从服务器获取用户数据
 *
 * @async
 * @param {string} id - 用户 ID
 * @return {Promise} - 包含用户数据的 Promise 对象
 */
const getUserData = async (id: string) => {
  try {
    modalApi.setState({ loading: true });
    const data = await getObj(id);
    const dataForm = {
      role: [],
      post: [],
      deptId: [],
      password: '******',
    };
    Object.assign(dataForm, data);
    if (data.roleList) {
      dataForm.role = data.roleList.map((item: { roleId: any }) => item.roleId);
    }
    if (data.postList) {
      dataForm.post = data.postList.map((item: { postId: any }) => item.postId);
    }

    if (data.dept) {
      dataForm.deptId = data.dept.deptId;
    }
    FormApi.setValues(dataForm);
  } finally {
    modalApi.setState({ loading: false });
  }
};

const [Modal, modalApi] = useVbenModal({
  draggable: true,
  closeOnClickModal: false,
  closeOnPressEscape: false,
  onCancel() {
    pageData.value = {
      userId: '',
    };
    FormApi.resetForm();
    modalApi.close();
  },
  onConfirm() {
    FormApi.validateAndSubmitForm().then(async (values) => {
      if (!values) return;
      try {
        modalApi.setState({ loading: true });
        const form = Object.assign(pageData.value, values);
        pageData.value.userId ? await putObj(form) : await addObj(form);
        ElMessage.success(
          $t(
            form.id
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
  async onOpenChange(isOpen) {
    if (isOpen) {
      const dat = modalApi.getData<Record<string, any>>();
      modalApi.setState({
        title: $t(dat.type),
      });
      // 加载使用的数据
      await getDeptData();
      await getPostData();
      await getRoleData();
      if (dat?.data?.userId) {
        pageData.value.userId = dat.data.userId;
        await getUserData(dat.data.userId);
      } else {
        pageData.value = {
          userId: '',
        };
      }
      nextTick(() => {
        FormApi.updateSchema(formSchema.value);
      });
    }
  },
});

const formSchema = computed<VbenFormSchema[]>(() => [
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('user.sysuser.inputUsernameTip'),
    },
    dependencies: {
      triggerFields: ['username'],
      disabled(_values, _formApi) {
        return pageData.value.userId !== '';
      },
    },
    // 字段名
    fieldName: 'username',
    // 界面显示的label
    label: $t('user.sysuser.username'),
    rules: z.string().min(1, $t('user.sysuser.inputUsernameTip')),
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('user.sysuser.password'),
      type: 'password',
      showPassword: true,
    },
    // 字段名
    fieldName: 'password',
    // 界面显示的label
    label: $t('user.sysuser.password'),
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('user.sysuser.inputNameTip'),
    },
    // 字段名
    fieldName: 'name',
    // 界面显示的label
    label: $t('user.sysuser.name'),
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('user.sysuser.inputPhoneTip'),
    },
    // 字段名
    fieldName: 'phone',
    // 界面显示的label
    label: $t('user.sysuser.phone'),
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Select',
    // 对应组件的参数
    componentProps: {
      multiple: true,
      allowClear: true,
      filterOption: true,
      options: roleData?.value,
      props: {
        value: 'roleId',
        label: 'roleName',
      },
      showSearch: true,
      placeholder: $t('user.sysuser.role'),
    },
    // 字段名
    fieldName: 'role',
    // 界面显示的label
    label: $t('user.sysuser.role'),
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Select',
    // 对应组件的参数
    componentProps: {
      multiple: true,
      allowClear: true,
      filterOption: true,
      options: postData?.value,
      props: {
        value: 'postId',
        label: 'postName',
      },
      showSearch: true,
      placeholder: $t('user.sysuser.post'),
    },
    // 字段名
    fieldName: 'post',
    // 界面显示的label
    label: $t('user.sysuser.post'),
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'TreeSelect',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('user.sysuser.dept'),
      data: deptData.value,
      props: { value: 'id', label: 'name', children: 'children' },
      'check-strictly': true,
      clearable: true,
    },
    // 字段名
    fieldName: 'deptId',
    // 界面显示的label
    label: $t('user.sysuser.dept'),
    rules: 'selectRequired',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('user.sysuser.email'),
    },
    // 字段名
    fieldName: 'email',
    // 界面显示的label
    label: $t('user.sysuser.email'),
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('user.sysuser.nickname'),
    },
    // 字段名
    fieldName: 'nickname',
    // 界面显示的label
    label: $t('user.sysuser.nickname'),
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'RadioGroup',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('user.sysuser.lockFlag'),
      options: lock_flag,
      props: { value: 'value', label: 'label' },
    },
    // 字段名
    fieldName: 'lockFlag',
    defaultValue: '0',
    // 界面显示的label
    label: $t('user.sysuser.lockFlag'),
    rules: 'required',
  },
]);

const [Form, FormApi] = useVbenForm({
  showDefaultActions: false,
  schema: formSchema.value,
});

// 初始化部门数据
const getDeptData = async () => {
  // 获取部门数据
  const res = await deptTree();
  deptData.value = res;
  // 默认选择第一个
  // dataForm.deptId = res.data[0].id;
};

// 岗位数据
const getPostData = async () => {
  const res = await postList();
  postData.value = res;
  // 默认选择第一个
  // dataForm.post = [res.data[0].postId];
};
// 角色数据
const getRoleData = async () => {
  const res = await roleList();
  roleData.value = res;
  // 默认选择第一个
  // dataForm.role = [res.data[0].roleId];
};
</script>
<template>
  <Modal>
    <Form />
  </Modal>
</template>
