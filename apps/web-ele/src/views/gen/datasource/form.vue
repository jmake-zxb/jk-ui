<script setup lang="ts" name="GenDatasourceConfModal">
import type { VbenFormSchema } from '#/adapter/form';

import { computed, nextTick, reactive } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { ElMessage } from 'element-plus';

import { useDict } from '#/adapter/dict';
import { useVbenForm, z } from '#/adapter/form';
import { addObj, getObj, putObj } from '#/api/gen/datasource';
import { $t } from '#/locales';
import { rule } from '#/utils/validate';

// 定义子组件向父组件传值/事件
const emit = defineEmits(['refresh']);

// 表单数据对象
const state = reactive({
  dataForm: {
    id: '', // 主键
    name: '', // 别名
    dsName: '', // 数据库名称
    dsType: '', // 数据库类型
    url: '', // jdbcurl
    username: '', // 用户名
    password: '', // 密码
    confType: '0', // 配置类型
    instance: '', // 实例
    port: 0, // 端口
    host: '', // 主机
  },
});

// ========== 字典数据 ==========
// 加载字典数据
const { ds_config_type, ds_type } = useDict('ds_config_type', 'ds_type');

const formSchema = computed<VbenFormSchema[]>(() => [
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入别名',
    },
    fieldName: 'name',
    label: '别名',
    rules: z.string().min(1, { message: '别名不能为空' }),
  },
  {
    component: 'Select',
    componentProps: {
      allowClear: true,
      filterOption: true,
      options: ds_type?.value,
      showSearch: true,
      placeholder: '请选择数据库类型',
    },
    fieldName: 'dsType',
    label: '数据库类型',
    rules: z.string().min(1, { message: '数据库类型不能为空' }),
  },
  {
    component: 'RadioGroup',
    componentProps: {
      options: ds_config_type?.value,
    },
    fieldName: 'confType',
    label: '配置类型',
    defaultValue: '0',
    rules: z.string().min(1, { message: '配置类型不能为空' }),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入主机',
    },
    dependencies: {
      triggerFields: ['confType'],
      if(values, _formApi) {
        return values?.confType === '0';
      },
    },
    fieldName: 'host',
    label: '主机',
    rules: z.string().min(1, { message: '主机不能为空' }),
  },
  {
    component: 'InputNumber',
    componentProps: {
      min: 1,
      max: 65_535,
      placeholder: '请输入端口',
    },
    dependencies: {
      triggerFields: ['confType'],
      if(values, _formApi) {
        return values?.confType === '0';
      },
    },
    controlClass: '!w-[230px]',
    fieldName: 'port',
    label: '端口',
    rules: z
      .number()
      .min(1, { message: '端口不能为空' })
      .refine(
        (value) => {
          let isValid = true;
          const mockRule = {};
          const mockCallback = (error?: Error) => {
            if (error) {
              isValid = false;
            }
          };
          rule.number(mockRule, value, mockCallback);
          return isValid;
        },
        { message: '端口格式不正确' },
      ),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入数据库名称',
    },
    dependencies: {
      triggerFields: ['confType'],
      if(values, _formApi) {
        return values?.confType === '0';
      },
    },
    fieldName: 'dsName',
    label: '数据库名称',
    rules: z.string().min(1, { message: '数据库名称不能为空' }),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入jdbcurl',
    },
    dependencies: {
      triggerFields: ['confType'],
      if(values, _formApi) {
        return values?.confType === '1';
      },
    },
    fieldName: 'url',
    label: 'jdbcurl',
    rules: z.string().min(1, { message: 'jdbcurl不能为空' }),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入用户名',
    },
    fieldName: 'username',
    label: '用户名',
    rules: z.string().min(1, { message: '用户名不能为空' }),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入密码',
    },
    fieldName: 'password',
    label: '密码',
    rules: z.string().min(1, { message: '密码不能为空' }),
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
        const form: Record<string, any> = Object.assign(state.dataForm, values);
        form.password = form?.password?.includes('******')
          ? undefined
          : form.password;
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
        await getGenDatasourceConfData(dat?.data?.id);
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
const getGenDatasourceConfData = async (id: string) => {
  // 获取数据
  const res = await getObj(id);
  res.confType = res?.confType || '0';
  res.confType = `${res.confType}`;
  res.password = '******';
  Object.assign(state.dataForm, res);
  FormApi.setValues(state.dataForm);
};
</script>
<template>
  <Modal>
    <Form />
  </Modal>
</template>
