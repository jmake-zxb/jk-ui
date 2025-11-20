<script lang="ts" name="systemDicDialog" setup>
import { nextTick, reactive, ref } from 'vue';

import { VbenIcon } from '@vben/common-ui';

import {
  ElButton,
  ElCol,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElRadio,
  ElRadioGroup,
  ElTable,
  ElTableColumn,
} from 'element-plus';

import { useDict } from '#/adapter/dict';
import { addItemObj, addObj, validateDictType } from '#/api/admin/dict';
import { $t } from '#/locales';
import { rule } from '#/utils/validate';

// 定义子组件向父组件传值/事件
const emit = defineEmits(['refresh']);
const { dict_type } = useDict('dict_type');
// 定义变量内容
const dicDialogFormRef = ref();

const visible = ref(false);
const loading = ref(false);
const dataForm = reactive({
  id: '',
  dictType: '',
  description: '',
  systemFlag: '0',
  remarks: '',
  columns: [] as any,
});

const dataRules = reactive({
  dictType: [
    { validator: rule.overLength, trigger: 'blur' },
    { required: true, message: '类型不能为空', trigger: 'blur' },
    { validator: rule.validatorNameCn, trigger: 'blur' },
    {
      validator: (rule: any, value: any, callback: any) => {
        validateDictType(rule, value, callback, dataForm.id !== '');
      },
      trigger: 'blur',
    },
  ],
  systemFlag: [
    { required: true, message: '字典类型不能为空', trigger: 'blur' },
  ],
  description: [
    { validator: rule.overLength, trigger: 'blur' },
    {
      required: true,
      message: '描述不能为空',
      trigger: 'blur',
    },
  ],
  columns: [{ required: true, message: '字典项不能为空', trigger: 'blur' }],
});

// 打开弹窗
const openDialog = () => {
  visible.value = true;
  dataForm.id = '';
  nextTick(() => {
    dicDialogFormRef.value?.resetFields();
  });
};

// 提交
const onSubmit = async () => {
  const valid = await dicDialogFormRef.value.validate().catch(() => {});
  if (!valid) return false;

  try {
    loading.value = true;
    // 添加字典
    const { data } = await addObj(dataForm);
    // addItemObj

    dataForm.columns.forEach(async (item: any) => {
      item.dictId = data.id;
      item.dictType = dataForm.dictType;
      await addItemObj(item);
    });
    ElMessage.success($t('page.common.addSuccessText'));
    visible.value = false;
    emit('refresh', dataForm.dictType);
  } catch (error: any) {
    ElMessage.error(error.msg);
  } finally {
    loading.value = false;
  }
};

let index = 1;
const onAddItem = () => {
  dataForm.columns.push({ sortOrder: `${index++}` });
};

const handleDelete = (index: number, _row: any) => {
  dataForm.columns.splice(index, 1);
};

// 暴露变量
defineExpose({
  openDialog,
});
</script>

<template>
  <ElDialog title="新增字典" v-model="visible" width="600">
    <ElForm
      :model="dataForm"
      :rules="dataRules"
      label-width="100px"
      ref="dicDialogFormRef"
      v-loading="loading"
    >
      <ElFormItem :label="$t('dict.sysdict.systemFlag')" prop="systemFlag">
        <ElRadioGroup v-model="dataForm.systemFlag">
          <ElRadio
            border
            :value="item.value"
            v-for="(item, index1) in dict_type"
            :key="index1"
          >
            {{ item.label }}
          </ElRadio>
        </ElRadioGroup>
      </ElFormItem>
      <ElFormItem :label="$t('dict.sysdict.dictType')" prop="dictType">
        <ElInput
          :placeholder="$t('dict.sysdict.inputDictTypeTip')"
          :disabled="dataForm.id !== ''"
          clearable
          v-model="dataForm.dictType"
        />
      </ElFormItem>
      <ElFormItem :label="$t('dict.sysdict.description')" prop="description">
        <ElInput
          :placeholder="$t('dict.sysdict.inputDescriptionTip')"
          clearable
          v-model="dataForm.description"
        />
      </ElFormItem>
      <ElCol :span="24" class="mb20">
        <ElFormItem :label="$t('dict.dictItem.name')" prop="columns">
          <ElTable
            :data="dataForm.columns"
            border
            style="width: 100%"
            max-height="500"
          >
            <ElTableColumn
              type="index"
              :label="$t('dict.createTable.index')"
              width="50"
            >
              <template #header>
                <ElButton size="small" type="primary" circle @click="onAddItem">
                  <VbenIcon icon="ant-design:plus-outlined" />
                </ElButton>
              </template>
              <template #default="scope">
                <ElButton
                  size="small"
                  type="danger"
                  circle
                  @click="handleDelete(scope.$index, scope.row)"
                >
                  <VbenIcon icon="ant-design:minus-outlined" />
                </ElButton>
              </template>
            </ElTableColumn>
            <ElTableColumn
              prop="label"
              :label="$t('dict.dictItem.label')"
              show-overflow-tooltip
            >
              <template #default="scope">
                <ElInput
                  v-model="scope.row.label"
                  :placeholder="$t('dict.dictItem.inputLabelTip')"
                />
              </template>
            </ElTableColumn>
            <ElTableColumn
              prop="value"
              :label="$t('dict.dictItem.itemValue')"
              show-overflow-tooltip
            >
              <template #default="scope">
                <ElInput
                  v-model="scope.row.value"
                  :placeholder="$t('dict.dictItem.inputItemValueTip')"
                />
              </template>
            </ElTableColumn>
          </ElTable>
        </ElFormItem>
      </ElCol>
    </ElForm>
    <template #footer>
      <span class="dialog-footer">
        <ElButton @click="visible = false">{{
          $t('page.common.cancelButtonText')
        }}</ElButton>
        <ElButton @click="onSubmit" type="primary" :disabled="loading">{{
          $t('page.common.confirmButtonText')
        }}</ElButton>
      </span>
    </template>
  </ElDialog>
</template>
