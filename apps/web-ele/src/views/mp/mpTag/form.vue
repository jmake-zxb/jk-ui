<script setup lang="ts" name="MpTagModal">
import type { VbenFormSchema } from '#/adapter/form';

import { computed, reactive, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { ElMessage } from 'element-plus';

import { useVbenForm, z } from '#/adapter/form';
import { getObjs } from '#/api/mp/mpAccount';
import { addObj, getObj, putObj } from '#/api/mp/mpTag';
import { $t } from '#/locales';

// 定义子组件向父组件传值/事件
const emit = defineEmits(['refresh']);

// 表单数据对象
const state = reactive({
  dataForm: {
    id: '', // 主键
    tag: '', // 标签名称
    wxAccountName: '', // 微信公众号名称
  },
});

// ========== 字典数据 ==========

const wxAccountList = ref([]);

const getWxAccountList = async () => {
  const data = await getObjs();
  wxAccountList.value = data;
};

getWxAccountList();

const formSchema = computed<VbenFormSchema[]>(() => [
  {
    component: 'Select',
    componentProps: () => ({
      allowClear: true,
      filterOption: true,
      options: wxAccountList.value,
      props: {
        value: 'id',
        label: 'name',
      },
      showSearch: true,
      placeholder: '请选择微信公众号',
    }),
    fieldName: 'wxAccountId',
    label: '微信公众号',
    rules: 'selectRequired',
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入标签名称',
    },
    fieldName: 'tag',
    label: '标签名称',
    rules: z.string().min(1, { message: '标签名称不能为空' }),
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
        await getMpTagData(dat?.data?.id);
      } else {
        state.dataForm.id = '';
      }
    }
  },
});

// 初始化表单数据
const getMpTagData = async (id: string) => {
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
