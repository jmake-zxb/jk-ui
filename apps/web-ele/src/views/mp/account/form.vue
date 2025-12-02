<script setup lang="ts" name="MpAccountModal">
import type { VbenFormSchema } from '#/adapter/form';

import { computed, nextTick, reactive } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { ElMessage } from 'element-plus';

import { useVbenForm, z } from '#/adapter/form';
import { addObj, getObj, putObj } from '#/api/mp/mpAccount';
import { $t } from '#/locales';
import { createUniqueFieldRule, rule } from '#/utils/validate';

// 定义子组件向父组件传值/事件
const emit = defineEmits(['refresh']);

// 表单数据对象
const state = reactive({
  dataForm: {
    id: '', // 主键
    name: '', // 名称
    account: '', // 微信号
    appid: '', // AppID
    appsecret: '', // 密钥
    url: '', // 回调URL
    token: '', // token
    aesKey: '', // 消息加解密密钥 (EncodingAESKey)
  },
});

// ========== 字典数据 ==========

const formSchema = computed<VbenFormSchema[]>(() => [
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入名称',
    },
    fieldName: 'name',
    label: '名称',
    rules: z.string().min(1, { message: '名称不能为空' }),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入微信号',
    },
    fieldName: 'account',
    label: '微信号',
    rules: z
      .string()
      .min(1, { message: '微信号不能为空' })
      .refine(
        createUniqueFieldRule('account', getObj, () => state.dataForm.id),
        { message: '微信号已存在' },
      ),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入AppID',
    },
    fieldName: 'appid',
    label: 'AppID',
    rules: z
      .string()
      .min(1, { message: 'AppID不能为空' })
      .refine(
        createUniqueFieldRule('appid', getObj, () => state.dataForm.id),
        { message: 'AppID已存在' },
      ),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入密钥',
    },
    fieldName: 'appsecret',
    label: '密钥',
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入回调URL',
    },
    fieldName: 'url',
    label: '回调URL',
    rules: z.string().refine(
      (value) => {
        let isValid = true;
        const mockRule = {};
        const mockCallback = (error?: Error) => {
          if (error) {
            isValid = false;
          }
        };
        rule.url(mockRule, value, mockCallback);
        return isValid;
      },
      { message: '回调URL格式不正确' },
    ),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入token',
    },
    fieldName: 'token',
    label: 'token',
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入EncodingAESKey',
    },
    fieldName: 'aesKey',
    label: 'EncodingAESKey',
  },
  {
    component: 'UploadImg',
    componentProps: {},
    fieldName: 'qrUrl',
    label: '公众号二维码',
  },
]);

const [Form, FormApi] = useVbenForm({
  showDefaultActions: false,
  schema: formSchema.value,
});

// Modal定义
const [Modal, modalApi] = useVbenModal({
  draggable: true,
  closeOnClickModal: false,
  closeOnPressEscape: false,
  async onCancel() {
    state.dataForm.id = '';
    await FormApi.resetForm();
    modalApi.close();
  },
  onConfirm() {
    FormApi.validateAndSubmitForm().then(async (values) => {
      if (!values) return;
      try {
        await modalApi.setState({ loading: true });
        const form = Object.assign(state.dataForm, values);
        state.dataForm.id ? await putObj(form) : await addObj(form);
        ElMessage.success(
          $t(
            form.id
              ? 'page.common.editSuccessText'
              : 'page.common.addSuccessText',
          ),
        );
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
      if (dat?.data?.id) {
        await getMpAccountData(dat?.data?.id);
      } else {
        state.dataForm.id = '';
      }
    }
  },
});

// 初始化表单数据
const getMpAccountData = async (id: string) => {
  // 获取数据
  const res = await getObj({ id });
  Object.assign(state.dataForm, res);
  nextTick(() => {
    FormApi.setValues(state.dataForm);
  });
};
</script>
<template>
  <Modal>
    <Form />
  </Modal>
</template>
