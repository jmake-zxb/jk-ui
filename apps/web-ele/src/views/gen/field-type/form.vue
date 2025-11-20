<script setup lang="ts" name="GenFieldTypeModal">
import type { VbenFormSchema } from '#/adapter/form';

import { computed, nextTick, reactive } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { ElMessage } from 'element-plus';

import { useVbenForm, z } from '#/adapter/form';
import { addObj, getObj, putObj } from '#/api/gen/fieldtype';
import { $t } from '#/locales';
import { rule } from '#/utils/validate';

// 定义子组件向父组件传值/事件
const emit = defineEmits(['refresh']);

// 表单数据对象
const state = reactive({
  dataForm: {
    id: '', // 主键
    columnType: '', // 字段类型
    attrType: '', // 属性类型
    packageName: '', // 属性包名
  },
});

// 字典数据处理

const formSchema = computed<VbenFormSchema[]>(() => [
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入字段类型',
    },
    fieldName: 'columnType',
    label: '字段类型',
    colProps: { span: 24 },
    rules: z
      .string()
      .min(1, { message: '字段类型不能为空' })
      .refine(
        (value) => {
          let isValid = true;
          const mockRule = {};
          const mockCallback = (error?: Error) => {
            if (error) {
              isValid = false;
            }
          };
          rule.noChinese(mockRule, value, mockCallback);
          return isValid;
        },
        { message: '字段类型格式不正确' },
      ),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入属性类型',
    },
    fieldName: 'attrType',
    label: '属性类型',
    colProps: { span: 24 },
    rules: z.string().min(1, { message: '属性类型不能为空' }),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入属性包名',
    },
    fieldName: 'packageName',
    label: '属性包名',
    colProps: { span: 24 },
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
        await getGenFieldTypeData(dat?.data?.id);
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
const getGenFieldTypeData = async (id: string) => {
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
