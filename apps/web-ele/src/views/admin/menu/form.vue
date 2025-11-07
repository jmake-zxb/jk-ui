<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';

import { computed, reactive } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { ElMessage } from 'element-plus';

import { useVbenForm } from '#/adapter/form';
import { addObj, info, pageList, putObj } from '#/api/core/menu';
import { $t } from '#/locales';

// 定义子组件向父组件传值/事件
const emit = defineEmits(['refresh']);

// 定义需要的数据
const state = reactive({
  ruleForm: {
    menuId: '',
    parentId: '',
  },
  parentData: [] as any[],
});

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
        const form = Object.assign(state.ruleForm, values);
        state.ruleForm.menuId ? await putObj(form) : await addObj(form);
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
  onOpenChange(isOpen) {
    if (isOpen) {
      const dat = modalApi.getData<Record<string, any>>();
      modalApi.setState({
        title: $t(dat.type),
      });
      state.ruleForm.parentId = dat?.data?.id || '-1';
      state.ruleForm.menuId = '';
      if (dat?.data?.id && dat.type === 'page.common.editBtn') {
        state.ruleForm.menuId = dat?.data?.id;
        // 获取当前节点菜单信息
        getMenuDetail(dat?.data?.id);
      } else if (dat?.data?.id) {
        // 新增时，重置表单
        FormApi.setValues({ parentId: dat?.data?.id });
      }
      // 渲染上级菜单列表树
      getAllMenuData();
      FormApi.updateSchema(formSchema.value);
    }
  },
});

// 获取菜单节点的详细信息
const getMenuDetail = (id: string) => {
  info(id).then((res) => {
    Object.assign(state.ruleForm, res);
    FormApi.setValues(state.ruleForm);
  });
};

// 从后端获取菜单信息（含层级）
const getAllMenuData = () => {
  state.parentData = [];
  pageList({
    type: '0',
  }).then((data) => {
    const menu = {
      id: '-1',
      name: '根菜单',
      children: [] as any[],
    };
    menu.children = data;
    state.parentData.push(menu);
  });
};

const formSchema = computed<VbenFormSchema[]>(() => [
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'RadioGroup',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('menu.sysmenu.inputNameTip'),
      options: [
        { label: $t('menu.sysmenu.menuType0'), value: '0' },
        { label: $t('menu.sysmenu.menuType1'), value: '1' },
      ],
    },
    // 字段名
    fieldName: 'menuType',
    defaultValue: '1',
    // 界面显示的label
    label: $t('menu.sysmenu.menuType'),
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'TreeSelect',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('menu.sysmenu.inputParentIdTip'),
      data: state.parentData,
      props: { value: 'id', label: 'name', children: 'children' },
      'check-strictly': true,
    },
    // 字段名
    fieldName: 'parentId',
    // 界面显示的label
    label: $t('menu.sysmenu.parentId'),
    rules: 'selectRequired',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('menu.sysmenu.inputNameTip'),
    },
    // 字段名
    fieldName: 'name',
    // 界面显示的label
    label: $t('menu.sysmenu.name'),
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('menu.sysmenu.inputEnNameTip'),
    },
    // 字段名
    fieldName: 'enName',
    // 界面显示的label
    label: $t('menu.sysmenu.enName'),
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('menu.sysmenu.inputPermissionTip'),
    },
    // 字段名
    fieldName: 'permission',
    // 界面显示的label
    label: $t('menu.sysmenu.permission'),
    rules: 'required',
    dependencies: {
      triggerFields: ['menuType'],
      if: (values) => values.menuType === '1',
    },
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('menu.sysmenu.inputPathTip'),
    },
    // 字段名
    fieldName: 'path',
    // 界面显示的label
    label: $t('menu.sysmenu.path'),
    rules: 'required',
    dependencies: {
      triggerFields: ['menuType'],
      if: (values) => values.menuType === '0',
    },
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'InputNumber',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('menu.sysmenu.inputSortOrderTip'),
    },
    // 字段名
    fieldName: 'sortOrder',
    // 界面显示的label
    label: $t('menu.sysmenu.sortOrder'),
    defaultValue: 0,
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'IconPicker',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('menu.sysmenu.inputIconTip'),
    },
    // 字段名
    fieldName: 'icon',
    // 界面显示的label
    label: $t('menu.sysmenu.icon'),
    rules: 'required',
    dependencies: {
      triggerFields: ['menuType'],
      if: (values) => values.menuType === '0',
    },
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'RadioGroup',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('menu.sysmenu.inputEmbeddedTip'),
      options: [
        { label: $t('page.common.isNo'), value: '0' },
        { label: $t('page.common.isYes'), value: '1' },
      ],
    },
    // 字段名
    fieldName: 'embedded',
    defaultValue: '0',
    // 界面显示的label
    label: $t('menu.sysmenu.embedded'),
    rules: 'required',
    dependencies: {
      triggerFields: ['menuType'],
      if: (values) => values.menuType === '0',
    },
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'RadioGroup',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('menu.sysmenu.inputKeepAliveTip'),
      options: [
        { label: $t('page.common.isNo'), value: '0' },
        { label: $t('page.common.isYes'), value: '1' },
      ],
    },
    // 字段名
    fieldName: 'keepAlive',
    // 界面显示的label
    label: $t('menu.sysmenu.keepAlive'),
    defaultValue: '0',
    rules: 'required',
    dependencies: {
      triggerFields: ['menuType'],
      if: (values) => values.menuType === '0',
    },
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'RadioGroup',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('menu.sysmenu.inputVisibleTip'),
      options: [
        { label: $t('page.common.isNo'), value: '0' },
        { label: $t('page.common.isYes'), value: '1' },
      ],
    },
    // 字段名
    fieldName: 'visible',
    // 界面显示的label
    label: $t('menu.sysmenu.visible'),
    defaultValue: '1',
    rules: 'required',
    dependencies: {
      triggerFields: ['menuType'],
      if: (values) => values.menuType === '0',
    },
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
