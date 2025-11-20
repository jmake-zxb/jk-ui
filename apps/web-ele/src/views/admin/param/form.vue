<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';

import { computed, nextTick, reactive } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { ElMessage } from 'element-plus';

import { useDict } from '#/adapter/dict';
import { useVbenForm } from '#/adapter/form';
import { addObj, getObj, putObj } from '#/api/admin/param';
import { $t } from '#/locales';

// 定义子组件向父组件传值/事件
const emit = defineEmits(['refresh']);

// 定义字典
const { dict_type, status_type, param_type } = useDict(
  'dict_type',
  'status_type',
  'param_type',
);

// 定义需要的数据
const state = reactive({
  dataForm: {
    publicId: '',
  },
});

const [Modal, modalApi] = useVbenModal({
  draggable: true,
  closeOnClickModal: false,
  closeOnPressEscape: false,
  onCancel() {
    state.dataForm.publicId = '';
    FormApi.resetForm();
    modalApi.close();
  },
  onConfirm() {
    FormApi.validateAndSubmitForm().then(async (values) => {
      if (!values) return;
      try {
        modalApi.setState({ loading: true });
        const form = Object.assign(state.dataForm, values);
        state.dataForm.publicId ? await putObj(form) : await addObj(form);
        ElMessage.success(
          $t(
            form.publicId
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
      if (dat?.data?.publicId) {
        await getDetail(dat?.data?.publicId);
      } else {
        state.dataForm.publicId = '';
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
    component: 'RadioGroup',
    // 对应组件的参数
    componentProps: {
      options: dict_type?.value,
    },
    // 字段名
    fieldName: 'systemFlag',
    // 界面显示的label
    label: $t('param.param.systemFlag'),
    defaultValue: '0',
    rules: 'required',
  },
  {
    component: 'Select',
    componentProps: {
      allowClear: true,
      filterOption: true,
      options: param_type?.value,
      showSearch: true,
      placeholder: $t('param.param.inputpublicTypeTip'),
    },
    fieldName: 'publicType',
    label: $t('param.param.publicType'),
    defaultValue: '0',
    rules: 'selectRequired',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('param.param.inputvalidateCodeTip'),
    },
    // 字段名
    fieldName: 'validateCode',
    // 界面显示的label
    label: $t('param.param.validateCode'),
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('param.param.inputpublicNameTip'),
    },
    // 字段名
    fieldName: 'publicName',
    // 界面显示的label
    label: $t('param.param.publicName'),
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('param.param.inputpublicKeyTip'),
    },
    // 字段名
    fieldName: 'publicKey',
    // 界面显示的label
    label: $t('param.param.publicKey'),
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('param.param.inputpublicValueTip'),
    },
    // 字段名
    fieldName: 'publicValue',
    // 界面显示的label
    label: $t('param.param.publicValue'),
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'RadioGroup',
    // 对应组件的参数
    componentProps: {
      options: status_type?.value,
    },
    // 字段名
    fieldName: 'status',
    defaultValue: '0',
    // 界面显示的label
    label: $t('param.param.status'),
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
