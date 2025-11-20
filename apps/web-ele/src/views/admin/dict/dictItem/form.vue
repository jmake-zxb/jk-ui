<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';

import { computed, nextTick, reactive } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { ElMessage } from 'element-plus';

import { useVbenForm } from '#/adapter/form';
import { addObj, getObj, putObj } from '#/api/admin/post';
import { $t } from '#/locales';

// 定义子组件向父组件传值/事件
const emit = defineEmits(['refresh']);

// 定义需要的数据
const state = reactive({
  dataForm: {
    postId: '',
  },
});

const [Modal, modalApi] = useVbenModal({
  draggable: true,
  closeOnClickModal: false,
  closeOnPressEscape: false,
  onCancel() {
    state.dataForm.postId = '';
    FormApi.resetForm();
    modalApi.close();
  },
  onConfirm() {
    FormApi.validateAndSubmitForm().then(async (values) => {
      if (!values) return;
      try {
        modalApi.setState({ loading: true });
        const form = Object.assign(state.dataForm, values);
        state.dataForm.postId ? await putObj(form) : await addObj(form);
        ElMessage.success(
          $t(
            form.postId
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
      if (dat?.data?.postId) {
        await getDetail(dat?.data?.postId);
      } else {
        state.dataForm.postId = '';
      }
      nextTick(() => {
        FormApi.updateSchema(formSchema.value);
      });
    }
  },
});

// 获取菜单节点的详细信息
const getDetail = async (id: string) => {
  const res = await getObj(id);
  Object.assign(state.dataForm, res);
  FormApi.setValues(state.dataForm);
};

const formSchema = computed<VbenFormSchema[]>(() => [
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('post.post.inputpostCodeTip'),
    },
    // 字段名
    fieldName: 'postCode',
    // 界面显示的label
    label: $t('post.post.postCode'),
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('post.post.inputpostNameTip'),
    },
    // 字段名
    fieldName: 'postName',
    // 界面显示的label
    label: $t('post.post.postName'),
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'InputNumber',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('post.post.inputpostSortTip'),
    },
    // 字段名
    fieldName: 'postSort',
    // 界面显示的label
    label: $t('post.post.postSort'),
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
