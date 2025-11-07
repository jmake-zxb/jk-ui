<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';

import { computed, nextTick, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { ElMessage } from 'element-plus';

import { useDict } from '#/adapter/dict';
import { useVbenForm, z } from '#/adapter/form';
import { addObj, getObj, putObj } from '#/api/admin/client';
import { $t } from '#/locales';

// 定义子组件向父组件传值/事件
const emit = defineEmits(['refresh']);

// 定义字典
const { grant_types, common_status } = useDict('grant_types', 'common_status');

const pageData = ref({
  id: '',
});

// 初始化表单数据
const getsysOauthClientDetailsData = (id: string) => {
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
        pageData.value.id ? await putObj(form) : await addObj(form);
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
      nextTick(() => {
        FormApi.updateSchema(formSchema.value);
      });
      if (dat?.data?.id) {
        getsysOauthClientDetailsData(dat.data.clientId);
      } else {
        pageData.value = {
          id: '',
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
      placeholder: $t('client.client.inputClientIdTip'),
    },
    // 字段名
    fieldName: 'clientId',
    // 界面显示的label
    label: $t('client.client.clientId'),
    rules: z
      .string()
      .min(1, $t('client.client.inputClientIdTip'))
      .regex(/^[a-z_]+$/, '只能包含小写英文字母和下划线'),
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('client.client.inputClientSecretTip'),
    },
    // 字段名
    fieldName: 'clientSecret',
    // 界面显示的label
    label: $t('client.client.clientSecret'),
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('client.client.inputScopeTip'),
    },
    // 字段名
    fieldName: 'scope',
    // 界面显示的label
    label: $t('client.client.scope'),
    defaultValue: 'server',
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
      options: grant_types?.value,
      showSearch: true,
      placeholder: $t('client.client.inputAuthorizedGrantTypesTip'),
    },
    // 字段名
    fieldName: 'authorizedGrantTypes',
    // 界面显示的label
    label: $t('client.client.authorizedGrantTypes'),
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'InputNumber',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('client.client.inputAccessTokenValidityTip'),
    },
    // 字段名
    fieldName: 'accessTokenValidity',
    // 界面显示的label
    label: $t('client.client.accessTokenValidity'),
    defaultValue: 43_200,
    rules: z.number().min(0, $t('client.client.inputAccessTokenValidityTip')),
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'InputNumber',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('client.client.inputRefreshTokenValidityTip'),
    },
    // 字段名
    fieldName: 'refreshTokenValidity',
    // 界面显示的label
    label: $t('client.client.refreshTokenValidity'),
    defaultValue: 2_592_001,
    rules: 'required',
  },
  {
    component: 'RadioGroup',
    componentProps: {
      options: common_status?.value,
      border: true,
    },
    dependencies: {
      triggerFields: ['authorizedGrantTypes'],
      if(values, _formApi) {
        return values?.authorizedGrantTypes?.includes('authorization_code');
      },
    },
    fieldName: 'autoapprove',
    label: $t('client.client.autoapprove'),
    rules: 'selectRequired',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('client.client.inputAuthoritiesTip'),
    },
    dependencies: {
      triggerFields: ['authorizedGrantTypes'],
      if(values, _formApi) {
        return values?.authorizedGrantTypes?.includes('authorization_code');
      },
    },
    // 字段名
    fieldName: 'authorities',
    // 界面显示的label
    label: $t('client.client.authorities'),
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('client.client.inputWebServerRedirectUriTip'),
    },
    dependencies: {
      triggerFields: ['authorizedGrantTypes'],
      if(values, _formApi) {
        return values?.authorizedGrantTypes?.includes('authorization_code');
      },
    },
    // 字段名
    fieldName: 'webServerRedirectUri',
    // 界面显示的label
    label: $t('client.client.webServerRedirectUri'),
    rules: z.string().url('请输入有效的URL'),
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
