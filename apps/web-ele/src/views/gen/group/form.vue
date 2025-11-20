<script setup lang="ts" name="GenGroupModal">
import type { VbenFormSchema } from '#/adapter/form';

import { computed, nextTick, reactive } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { ElMessage } from 'element-plus';

import { useVbenForm, z } from '#/adapter/form';
import { addObj, getObj, putObj } from '#/api/gen/group';
import { $t } from '#/locales';

// 定义子组件向父组件传值/事件
const emit = defineEmits(['refresh']);

// 表单数据对象
const state = reactive({
  dataForm: {
    id: '', // 主键
    groupName: '', // 分组名称
    groupDesc: '', // 分组描述
  },
});

// ========== 字典数据 ==========

const formSchema = computed<VbenFormSchema[]>(() => [
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入分组名称',
    },
    fieldName: 'groupName',
    label: '分组名称',
    rules: z.string().min(1, { message: '分组名称不能为空' }),
  },
  {
    component: 'Input',
    componentProps: {
      type: 'textarea',
      rows: 4,
      placeholder: '请输入分组描述',
    },
    fieldName: 'groupDesc',
    label: '分组描述',
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
        await getGenGroupData(dat?.data?.id);
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
const getGenGroupData = async (id: string) => {
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
