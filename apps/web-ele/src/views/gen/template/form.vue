<script setup lang="ts" name="GenTemplateModal">
import type { VbenFormSchema } from '#/adapter/form';

import { computed, nextTick, reactive } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { ElMessage } from 'element-plus';

import { useVbenForm, z } from '#/adapter/form';
import { addObj, getObj, putObj } from '#/api/gen/template';
import { $t } from '#/locales';

// 定义子组件向父组件传值/事件
const emit = defineEmits(['refresh']);

// 表单数据对象
const state = reactive({
  dataForm: {
    id: '', // 主键
    templateName: '', // 模板名称
    generatorPath: '', // 模板路径
    templateDesc: '', // 模板描述
    templateCode: '', // 模板代码
  },
});

// 字典数据处理

const formSchema = computed<VbenFormSchema[]>(() => [
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入模板名称',
    },
    fieldName: 'templateName',
    label: '模板名称',
    colProps: { span: 12 },
    rules: z.string().min(1, { message: '模板名称不能为空' }),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入模板路径',
    },
    fieldName: 'generatorPath',
    label: '模板路径',
    colProps: { span: 12 },
    rules: z.string().min(1, { message: '模板路径不能为空' }),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入模板描述',
    },
    fieldName: 'templateDesc',
    label: '模板描述',
    colProps: { span: 12 },
    rules: z.string().min(1, { message: '模板描述不能为空' }),
  },
  {
    component: 'CodeEditor',
    componentProps: {
      theme: 'darcula',
      mode: 'velocity',
      height: '100%',
    },
    fieldName: 'templateCode',
    label: '模板代码',
    colProps: { span: 12 },
  },
]);

const [Form, FormApi] = useVbenForm({
  showDefaultActions: false,
  schema: formSchema.value,
});

// Modal定义
const [Modal, ModalApi] = useVbenModal({
  draggable: true,
  fullscreen: true,
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
      if (dat?.data?.id) {
        await getGenTemplateData(dat?.data?.id);
      } else {
        state.dataForm.id = '';
      }
      nextTick(() => {
        FormApi.updateSchema(formSchema.value);
      });
    }
  },
});

// 初始化表单数据
const getGenTemplateData = async (id: string) => {
  // 获取数据
  const res = await getObj(id);
  Object.assign(state.dataForm, res);
  FormApi.setValues(state.dataForm);
};
</script>
<template>
  <Modal>
    <Form />
  </Modal>
</template>
