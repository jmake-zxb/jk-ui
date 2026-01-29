<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';

import { computed, reactive } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { ElMessage } from 'element-plus';

import { useVbenForm } from '#/adapter/form';
import { addObj, getObj, putObj } from '#/api/ai/reviewNode';
import { $t } from '#/locales';

// 定义子组件向父组件传值/事件
const emit = defineEmits(['refresh']);

// 表单数据对象
const state = reactive({
  dataForm: {
    id: '', // 主键
    pid: '0',
    rwName: '',
    rwType: '1',
    rwDoc: '',
  },
});

// ========== 字典数据 ==========

const formSchema = computed<VbenFormSchema[]>(() => [
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入流程名称',
    },
    fieldName: 'rwName',
    label: '流程名称',
    rules: 'required',
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入描述',
      type: 'textarea',
      rows: 4,
    },
    fieldName: 'rwDoc',
    label: '描述',
    rules: 'required',
    help: '此项内容会影响AI生成规则，请仔细填写！',
  },
]);

const [Form, FormApi] = useVbenForm({
  showDefaultActions: false,
  schema: formSchema.value,
});

// Modal定义
const [Modal, ModalApi] = useVbenModal({
  draggable: true,
  closeOnClickModal: false,
  closeOnPressEscape: false,
  async onCancel() {
    state.dataForm.id = '';
    await FormApi.resetForm();
    ModalApi.close();
  },
  onConfirm() {
    FormApi.validateAndSubmitForm().then(async (values) => {
      if (!values) return;
      try {
        ModalApi.setState({ loading: true });
        const form = Object.assign(state.dataForm, values);
        state.dataForm.id ? await putObj(form) : await addObj(form);
        ElMessage.success(
          $t(
            form.id
              ? 'page.common.editSuccessText'
              : 'page.common.addSuccessText',
          ),
        );
        ModalApi.setState({ loading: false });
        ModalApi.close();
        emit('refresh');
      } finally {
        ModalApi.setState({ loading: false });
      }
    });
  },
  async onOpenChange(isOpen) {
    if (isOpen) {
      const dat = ModalApi.getData<Record<string, any>>();
      ModalApi.setState({
        title: $t(dat.type),
      });
      state.dataForm.pid = dat?.data?.pid;
      if (dat?.data?.id) {
        await getDbConnectionConfigData(dat?.data?.id);
      } else {
        state.dataForm.id = '';
      }
    }
  },
});

// 初始化表单数据
const getDbConnectionConfigData = async (id: string) => {
  // 获取数据
  const res = await getObj({ id });
  Object.assign(state.dataForm, res);
  FormApi.setValues(state.dataForm);
};
</script>
<template>
  <Modal>
    <Form />
  </Modal>
</template>
