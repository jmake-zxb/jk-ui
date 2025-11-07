<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';

import { computed, h, ref } from 'vue';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { useAuthStore } from '#/store';
import { generateUUID } from '#/utils/other';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();

const captchaKey = ref(generateUUID());

const pageFormApi = ref();

const refreshCaptcha = () => {
  captchaKey.value = generateUUID(); // 更新 key，触发图片 src 变化
  pageFormApi.value?.setFieldValue('randomStr', captchaKey.value); // 同时更新表单中的 randomStr 字段值
};

const codeImageUrl = `${import.meta.env.VITE_GLOB_API_URL}${import.meta.env.VITE_IS_MICRO === 'false' ? '/admin' : '/auth'}/code/image`;

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('authentication.usernameTip'),
      },
      fieldName: 'username',
      label: $t('authentication.username'),
      rules: z.string().min(1, { message: $t('authentication.usernameTip') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: $t('authentication.passwordTip'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      rules: z.string().min(1, { message: $t('authentication.passwordTip') }),
    },
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('page.auth.codeTip'),
      },
      dependencies: {
        if(_values, formApi) {
          pageFormApi.value = formApi;
        },
        show(_values, _formApi) {
          return false;
        },
        triggerFields: ['code'],
      },
      defaultValue: captchaKey.value,
      fieldName: 'randomStr',
    },
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('page.auth.codeTip'),
      },
      fieldName: 'code',
      label: $t('authentication.code'),
      suffix: () =>
        h('img', {
          src: `${codeImageUrl}?randomStr=${captchaKey.value}`,
          onClick: refreshCaptcha,
          style: 'cursor:pointer;',
        }),
      rules: z.string().min(1, { message: $t('page.auth.codeTip') }),
    },
  ];
});
</script>

<template>
  <AuthenticationLogin
    :form-schema="formSchema"
    :loading="authStore.loginLoading"
    :show-forget-password="false"
    :show-third-party-login="false"
    :show-register="false"
    :show-qrcode-login="false"
    :show-code-login="false"
    @submit="authStore.authLogin"
  />
</template>
