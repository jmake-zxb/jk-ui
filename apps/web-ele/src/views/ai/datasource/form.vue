<script setup lang="ts" name="DbConnectionConfigModal">
import type { VbenFormSchema } from '#/adapter/form';

import { computed, reactive } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { ElMessage } from 'element-plus';

import { useVbenForm } from '#/adapter/form';
import { addObj, getObj, putObj } from '#/api/ai/dbConnectionConfig';
import { $t } from '#/locales';

// 定义子组件向父组件传值/事件
const emit = defineEmits(['refresh']);

const schemaRequired = new Set([
  'dameng',
  'db2',
  'kingbase',
  'oracle',
  'postgresql',
  'sqlserver',
]);

// 表单数据对象
const state = reactive({
  dataForm: {
    id: '', // 主键
    dbType: '', // 数据库类型（如 MYSQL, DAMENG）
    hostAddr: '', // 主机地址
    port: '', // 端口
    dbName: '', // 数据库名
    dbSchema: '', // 模式名
    username: '', // 用户名
    dbPassword: '', // 密码（建议加密存储）
  },
});

// ========== 字典数据 ==========

const formSchema = computed<VbenFormSchema[]>(() => [
  {
    component: 'Select',
    componentProps: () => ({
      allowClear: true,
      filterOption: true,
      options: [
        { value: 'mysql', label: 'MySQL' },
        { value: 'postgresql', label: 'PostgreSQL' },
        { value: 'oracle', label: 'Oracle' },
        { value: 'sqlserver', label: 'SQL Server' },
        { value: 'dameng', label: '达梦 (DM)' },
        { value: 'kingbase', label: '人大金仓 (KingbaseES)' },
        { value: 'db2', label: 'IBM Db2' },
      ],
      showSearch: true,
      placeholder: '请选择数据库类型',
    }),
    fieldName: 'dbType',
    label: '数据库类型',
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入主机地址',
    },
    fieldName: 'hostAddr',
    label: '主机地址',
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入端口',
    },
    fieldName: 'port',
    label: '端口',
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入数据库名',
    },
    fieldName: 'dbName',
    label: '数据库名',
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入模式名',
    },
    fieldName: 'dbSchema',
    label: '模式名',
    dependencies: {
      triggerFields: ['dbType'],
      if(values, _actions) {
        return schemaRequired.has(values.dbType);
      },
    },
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入用户名',
    },
    fieldName: 'username',
    label: '用户名',
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入密码',
    },
    fieldName: 'dbPassword',
    label: '密码',
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
