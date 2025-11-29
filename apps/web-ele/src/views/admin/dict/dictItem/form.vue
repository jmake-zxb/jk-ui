<script setup lang="ts" name="SysDictItemModal">
import type { VbenFormSchema } from '#/adapter/form';

import { computed, reactive } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { ElMessage } from 'element-plus';

import { useVbenForm, z } from '#/adapter/form';
import { addItemObj, getItemDetails, putItemObj } from '#/api/admin/dict';
import { $t } from '#/locales';

// 定义子组件向父组件传值/事件
const emit = defineEmits(['refresh']);

// 表单数据对象
const state = reactive({
  dataForm: {
    id: '', // 主键
    dictId: '',
    dictType: '', // 字典类型
    itemValue: '', // 字典值
    label: '', // 标签名
    description: '', // 字典项描述
    sortOrder: 0, // 排序
    remarks: '', // 备注
  },
});

// ========== 字典数据 ==========

const formSchema = computed<VbenFormSchema[]>(() => [
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入字典类型',
    },
    fieldName: 'dictType',
    label: '字典类型',
    disabled: true,
    rules: z.string().min(1, { message: '字典类型不能为空' }),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入字典值',
    },
    fieldName: 'value',
    label: '字典值',
    rules: z.string().min(1, { message: '字典值不能为空' }),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入标签名',
    },
    fieldName: 'label',
    label: '标签名',
    rules: z.string().min(1, { message: '标签名不能为空' }),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入字典项描述',
    },
    fieldName: 'description',
    label: '字典项描述',
    rules: z.string().min(1, { message: '字典项描述不能为空' }),
  },
  {
    component: 'InputNumber',
    componentProps: {
      min: 1,
      max: 1000,
      placeholder: '请输入排序',
    },
    controlClass: '!w-[230px]',
    fieldName: 'sortOrder',
    label: '排序',
    rules: z.number().min(1, { message: '排序不能为空' }),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入备注',
    },
    fieldName: 'remarks',
    label: '备注',
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
        state.dataForm.id ? await putItemObj(form) : await addItemObj(form);
        ElMessage.success(
          $t(
            form.id
              ? 'page.common.editSuccessText'
              : 'page.common.addSuccessText',
          ),
        );
        ModalApi.close();
        emit('refresh');
      } finally {
        ModalApi.setState({ loading: false });
      }
    });
  },
  async onOpenChange(isOpen) {
    if (isOpen) {
      await FormApi.resetForm();
      const dat = ModalApi.getData<Record<string, any>>();
      ModalApi.setState({
        title: $t(dat.type),
      });
      if (dat?.data?.queryData) {
        state.dataForm.dictId = dat?.data?.queryData?.dictId;
        state.dataForm.dictType = dat?.data?.queryData?.dictType;
      }
      if (dat?.data?.id) {
        await getSysDictItemData(dat?.data?.id);
      } else {
        state.dataForm = {
          id: '', // 主键
          dictId: dat?.data?.queryData?.dictId || '',
          dictType: dat?.data?.queryData?.dictType || '', // 字典类型
          itemValue: '', // 字典值
          label: '', // 标签名
          description: '', // 字典项描述
          sortOrder: 0, // 排序
          remarks: '', // 备注
        };
        FormApi.setValues(state.dataForm);
      }
    }
  },
});

// 初始化表单数据
const getSysDictItemData = async (id: string) => {
  // 获取数据
  const res = await getItemDetails({ id });
  Object.assign(state.dataForm, res);
  FormApi.setValues(state.dataForm);
};
</script>
<template>
  <Modal>
    <Form />
  </Modal>
</template>
