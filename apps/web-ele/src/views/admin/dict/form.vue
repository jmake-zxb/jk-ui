<script setup lang="ts" name="SysDictModal">
import type { VbenFormSchema } from '#/adapter/form';

import { computed, reactive } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { ElMessage } from 'element-plus';

import { useDict } from '#/adapter/dict';
import { useVbenForm, z } from '#/adapter/form';
import { addObj, getObj, getObjDetails, putObj } from '#/api/admin/dict';
import { $t } from '#/locales';
import { createUniqueFieldRule } from '#/utils/validate';

// 定义子组件向父组件传值/事件
const emit = defineEmits(['refresh']);

// 表单数据对象
const state = reactive({
  dataForm: {
    id: '', // 主键
    dictType: '', // 字典标识
    description: '', // 字典名称
    remarks: '', // 备注信息
    systemFlag: '', // 系统标志
  },
});

// ========== 字典数据 ==========
// 加载字典数据
const { dict_type } = useDict('dict_type');

const formSchema = computed<VbenFormSchema[]>(() => [
  {
    component: 'RadioGroup',
    componentProps: () => ({
      options: dict_type?.value,
    }),
    fieldName: 'systemFlag',
    label: '系统标志',
    defaultValue: '0',
    rules: z.string().min(1, { message: '系统标志不能为空' }),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入字典标识',
    },
    fieldName: 'dictType',
    label: '字典标识',
    dependencies: {
      triggerFields: ['dictType'],
      disabled() {
        return !!state.dataForm.id;
      },
    },
    rules: z
      .string()
      .min(1, { message: '字典标识不能为空' })
      .refine(
        createUniqueFieldRule(
          'dictType',
          getObjDetails,
          () => state.dataForm.id,
        ),
        { message: '字典标识已存在' },
      ),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入字典名称',
    },
    fieldName: 'description',
    label: '字典名称',
    rules: z.string().min(1, { message: '字典名称不能为空' }),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入备注信息',
    },
    fieldName: 'remarks',
    label: '备注信息',
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
        await getSysDictData(dat?.data?.id);
      } else {
        state.dataForm.id = '';
      }
    }
  },
});

// 初始化表单数据
const getSysDictData = async (id: string) => {
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
