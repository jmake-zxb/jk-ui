<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';

import { computed, reactive, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { ElMessage } from 'element-plus';

import { useVbenForm } from '#/adapter/form';
import { addObj, deptTree, getObj, putObj } from '#/api/admin/dept';
import { $t } from '#/locales';

// 定义子组件向父组件传值/事件
const emit = defineEmits(['refresh']);

// 定义需要的数据
const parentData = ref<any[]>([]);
const state = reactive({
  dataForm: {
    id: '',
    parentId: '',
  },
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
        const form = Object.assign(state.dataForm, values);
        state.dataForm.id ? await putObj(form) : await addObj(form);
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
      if (dat?.data?.id && dat.type === 'page.common.editBtn') {
        await getDetail(dat?.data?.id);
      } else if (dat?.data?.id) {
        // 新增时，重置表单
        FormApi.setValues({ parentId: dat?.data?.id });
      }
      // 渲染上级菜单列表树
      await getDeptData();
      FormApi.updateSchema(formSchema.value);
    }
  },
});

// 获取菜单节点的详细信息
const getDetail = async (id: string) => {
  const res = await getObj(id);
  Object.assign(state.dataForm, res);
  FormApi.setValues(state.dataForm);
};

const getDeptData = async () => {
  const res = await deptTree();
  parentData.value = [];
  const dept = {
    id: '0',
    name: '根部门',
    children: [] as any[],
  };
  dept.children = res;
  parentData.value.push(dept);
};

const formSchema = computed<VbenFormSchema[]>(() => [
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'TreeSelect',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('dept.sysdept.inputparentIdTip'),
      data: parentData.value,
      props: { value: 'id', label: 'name', children: 'children' },
      'check-strictly': true,
    },
    // 字段名
    fieldName: 'parentId',
    // 界面显示的label
    label: $t('dept.sysdept.parentId'),
    rules: 'selectRequired',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('dept.sysdept.inputdeptNameTip'),
    },
    // 字段名
    fieldName: 'name',
    // 界面显示的label
    label: $t('dept.sysdept.name'),
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'InputNumber',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('dept.sysdept.inputsortOrderTip'),
    },
    // 字段名
    fieldName: 'sortOrder',
    // 界面显示的label
    label: $t('dept.sysdept.sortOrder'),
    defaultValue: 0,
    rules: 'required',
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
