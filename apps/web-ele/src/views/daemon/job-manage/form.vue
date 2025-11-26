<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';

import { computed, reactive } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { ElMessage } from 'element-plus';

import { useDict } from '#/adapter/dict';
import { useVbenForm } from '#/adapter/form';
import { addObj, getObj, putObj } from '#/api/daemon/job';
import Crontab from '#/component/Crontab/index.vue';
import { $t } from '#/locales';

// 定义子组件向父组件传值/事件
const emit = defineEmits(['refresh']);

// 定义字典
// 定义字典
const { misfire_policy, job_type } = useDict('misfire_policy', 'job_type');

// 定义需要的数据
const state = reactive({
  dataForm: {
    jobId: '',
  },
});

const [Modal, modalApi] = useVbenModal({
  draggable: true,
  closeOnClickModal: false,
  closeOnPressEscape: false,
  onCancel() {
    state.dataForm.jobId = '';
    FormApi.resetForm();
    modalApi.close();
  },
  onConfirm() {
    FormApi.validateAndSubmitForm().then(async (values) => {
      if (!values) return;
      try {
        modalApi.setState({ loading: true });
        const form = Object.assign(state.dataForm, values);
        state.dataForm.jobId ? await putObj(form) : await addObj(form);
        ElMessage.success(
          $t(
            form.jobId
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
      if (dat?.data?.jobId) {
        await getDetail(dat?.data?.jobId);
      } else {
        state.dataForm.jobId = '';
      }
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
      placeholder: $t('job.job.inputjobNameTip'),
    },
    // 字段名
    fieldName: 'jobName',
    // 界面显示的label
    label: $t('job.job.jobName'),
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('job.job.inputjobGroupTip'),
    },
    // 字段名
    fieldName: 'jobGroup',
    // 界面显示的label
    label: $t('job.job.jobGroup'),
    rules: 'required',
  },
  {
    component: 'Select',
    componentProps: () => ({
      allowClear: true,
      filterOption: true,
      options: job_type?.value,
      showSearch: true,
      placeholder: $t('job.job.jobType'),
    }),
    fieldName: 'jobType',
    label: $t('job.job.jobType'),
    rules: 'selectRequired',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('job.job.inputexecutePathTip'),
    },
    // 字段名
    fieldName: 'executePath',
    // 界面显示的label
    label: $t('job.job.executePath'),
    dependencies: {
      triggerFields: ['jobType'],
      if(values, _actions) {
        return ['3', '4'].includes(values.jobType);
      },
    },
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('job.job.inputclassNameTip'),
    },
    // 字段名
    fieldName: 'className',
    // 界面显示的label
    label: $t('job.job.className'),
    dependencies: {
      triggerFields: ['jobType'],
      if(values, _actions) {
        return ['1', '2'].includes(values.jobType);
      },
    },
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('job.job.inputmethodNameTip'),
    },
    // 字段名
    fieldName: 'methodName',
    // 界面显示的label
    label: $t('job.job.methodName'),
    dependencies: {
      triggerFields: ['jobType'],
      if(values, _actions) {
        return ['1', '2'].includes(values.jobType);
      },
    },
    rules: 'required',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('job.job.inputmethodParamsValueTip'),
    },
    // 字段名
    fieldName: 'methodParamsValue',
    // 界面显示的label
    label: $t('job.job.methodParamsValue'),
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('job.job.cronExpression'),
    },
    // 字段名
    fieldName: 'cronExpression',
    defaultValue: '',
    // 界面显示的label
    label: $t('job.job.cronExpression'),
    rules: 'required',
  },
  {
    component: 'Select',
    componentProps: () => ({
      allowClear: true,
      filterOption: true,
      options: misfire_policy?.value,
      showSearch: true,
      placeholder: $t('job.job.inputmisfirePolicyTip'),
    }),
    fieldName: 'misfirePolicy',
    label: $t('job.job.misfirePolicy'),
    rules: 'selectRequired',
  },
  {
    // 组件需要在 #/adapter.ts内注册，并加上类型
    component: 'Input',
    // 对应组件的参数
    componentProps: {
      placeholder: $t('job.job.inputremarkTip'),
      type: 'textarea',
      row: 4,
    },
    // 字段名
    fieldName: 'remark',
    // 界面显示的label
    label: $t('job.job.remark'),
  },
]);

const [Form, FormApi] = useVbenForm({
  showDefaultActions: false,
  schema: formSchema.value,
});
</script>
<template>
  <Modal>
    <Form>
      <template #cronExpression="slotProps">
        <Crontab v-bind="slotProps" />
      </template>
    </Form>
  </Modal>
</template>
