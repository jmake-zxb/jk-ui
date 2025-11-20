<script lang="ts" setup>
import { onMounted, reactive, ref, watch } from 'vue';

import { confirm } from '@vben/common-ui';

import {
  ElCol,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElRadio,
  ElRadioGroup,
  ElRow,
  ElSelect,
} from 'element-plus';

import { list as groupList } from '#/api/gen/group';
import { putObj, useTableApi } from '#/api/gen/table';
import { checkVersion, online } from '#/api/gen/template';
import Tip from '#/component/Tip/index.vue';
import { Local } from '#/utils/storage';
import { rule } from '#/utils/validate';

const props = defineProps({
  tableName: {
    type: String,
    default: '',
  },
  dsName: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['refreshDataList']);
const visible = ref(false);
const loading = ref(false);
const dataFormRef = ref();
const childForm = ref();
const tableNameStr = ref('');
const dataForm = reactive({
  id: '',
  generatorType: '0',
  formLayout: 1,
  backendPath: '',
  frontendPath: '',
  packageName: '',
  email: '',
  author: '',
  version: '',
  moduleName: '',
  functionName: '',
  className: '',
  tableComment: '',
  tableName: '' as string,
  dsName: '' as string,
  style: '', //  默认风格 element-plus
  childTableName: '',
});

const groupDataList: Record<string, any> = ref([]);
const getTable = (dsName: string, tableName: string) => {
  loading.value = true;
  useTableApi(dsName, tableName)
    .then((res) => {
      Object.assign(dataForm, res);
      const list = res.groupList;
      dataForm.style = list[0]?.id;

      // 如果是保存路径的形式，有限使用本地配置项
      const frontendPath = Local.get('frontendPath');
      const backendPath = Local.get('backendPath');

      if (frontendPath && backendPath) {
        dataForm.frontendPath = frontendPath;
        dataForm.backendPath = backendPath;
      }
    })
    .finally(() => {
      loading.value = false;
    });
};

const dataRules = ref({
  tableName: [
    { validator: rule.overLength, trigger: 'blur' },
    {
      required: true,
      message: '必填项不能为空',
      trigger: 'blur',
    },
  ],
  tableComment: [
    { validator: rule.overLength, trigger: 'blur' },
    {
      required: true,
      message: '必填项不能为空',
      trigger: 'blur',
    },
  ],
  className: [
    { validator: rule.overLength, trigger: 'blur' },
    {
      required: true,
      message: '必填项不能为空',
      trigger: 'blur',
    },
  ],
  packageName: [
    { validator: rule.overLength, trigger: 'blur' },
    {
      required: true,
      message: '必填项不能为空',
      trigger: 'blur',
    },
  ],
  author: [
    { validator: rule.overLength, trigger: 'blur' },
    { required: true, message: '必填项不能为空', trigger: 'blur' },
  ],
  moduleName: [
    { validator: rule.overLength, trigger: 'blur' },
    {
      required: true,
      message: '必填项不能为空',
      trigger: 'blur',
    },
  ],
  functionName: [
    { validator: rule.overLength, trigger: 'blur' },
    {
      required: true,
      message: '必填项不能为空',
      trigger: 'blur',
    },
  ],
  generatorType: [
    { validator: rule.overLength, trigger: 'blur' },
    {
      required: true,
      message: '必填项不能为空',
      trigger: 'blur',
    },
  ],
  formLayout: [
    { validator: rule.overLength, trigger: 'blur' },
    {
      required: true,
      message: '必填项不能为空',
      trigger: 'blur',
    },
  ],
  backendPath: [
    { validator: rule.overLength, trigger: 'blur' },
    {
      required: true,
      message: '必填项不能为空',
      trigger: 'blur',
    },
  ],
  frontendPath: [
    { validator: rule.overLength, trigger: 'blur' },
    {
      required: true,
      message: '必填项不能为空',
      trigger: 'blur',
    },
  ],
  style: [{ required: true, message: '必填项不能为空', trigger: 'blur' }],
});

// 保存
const submitHandle = async () => {
  try {
    const valid = await dataFormRef.value.validate(); // 表单校验
    if (!valid) return false;

    loading.value = true;
    await putObj(Object.assign(dataForm, childForm.value));
    visible.value = false;
    emit('refreshDataList');
    return dataForm;
  } catch {
    throw error;
  } finally {
    // 保存路径至Local 中方便下次使用
    if (dataForm.generatorType === '1') {
      Local.set('frontendPath', dataForm.frontendPath);
      Local.set('backendPath', dataForm.backendPath);
    }
    loading.value = false;
  }
};

const genGroupList = () => {
  groupList().then((data) => {
    if (data && data.length > 0) {
      groupDataList.value = data;
    }
  });
};

/**
 * 检查模板版本
 */
const checkTemplateVersion = async () => {
  checkVersion().then((data) => {
    if (!data) {
      confirm('模板发现新版本，是否更新？')
        .then(() => {
          // 更新模板
          online().then(() => {
            ElMessage.success('更新成功');
            genGroupList();
          });
        })
        .catch(() => {});
    }
  });
};

watch(
  () => childForm,
  () => {
    const { childTableName } = childForm.value || {};
    tableNameStr.value = childTableName
      ? `${props.tableName} + ${childTableName}`
      : props.tableName;
  },
  { deep: true, immediate: true },
);

onMounted(() => {
  // 重置表单数据
  if (dataFormRef.value) {
    dataFormRef.value.resetFields();
  }
  dataForm.id = '';
  dataForm.tableName = String(props.tableName);
  dataForm.dsName = String(props.dsName);

  getTable(dataForm.dsName, dataForm.tableName);
  genGroupList();
  checkTemplateVersion();
});

defineExpose({
  submitHandle,
});
</script>

<template>
  <ElForm
    :model="dataForm"
    :rules="dataRules"
    label-width="120px"
    ref="dataFormRef"
    v-loading="loading"
  >
    <ElRow>
      <ElCol :span="12" class="mb20">
        <ElFormItem label="表名" prop="tableName">
          <ElInput disabled placeholder="表名" :value="tableNameStr" />
        </ElFormItem>
      </ElCol>
      <ElCol :span="12" class="mb20">
        <ElFormItem prop="tableComment">
          <template #label>
            <span>注释</span>
            <Tip content="注释" />
          </template>
          <ElInput placeholder="说明" v-model="dataForm.tableComment" />
        </ElFormItem>
      </ElCol>
    </ElRow>
    <ElRow>
      <ElCol :span="12" class="mb20">
        <ElFormItem label="类名" prop="className">
          <ElInput placeholder="类名" v-model="dataForm.className" />
        </ElFormItem>
      </ElCol>
      <ElCol :span="12" class="mb20">
        <ElFormItem label="作者" prop="author">
          <ElInput placeholder="默认作者" v-model="dataForm.author" />
        </ElFormItem>
      </ElCol>
    </ElRow>
    <ElRow>
      <ElCol :span="12" class="mb20">
        <ElFormItem label="项目包名" prop="packageName">
          <ElInput placeholder="项目包名" v-model="dataForm.packageName" />
        </ElFormItem>
      </ElCol>
      <ElCol :span="12" class="mb20">
        <ElFormItem prop="moduleName">
          <template #label>
            <span>模块名</span>
            <Tip
              content="所属微服务模块名称，对应微服务路由前缀 （单体固定 admin）"
            />
          </template>
          <ElInput placeholder="模块名" v-model="dataForm.moduleName" />
        </ElFormItem>
      </ElCol>
    </ElRow>
    <ElRow>
      <ElCol :span="12" class="mb20">
        <ElFormItem prop="functionName">
          <template #label>
            <span>功能名</span>
            <Tip content="对应生成的Controller @RequestMapping 请求路径" />
          </template>
          <ElInput placeholder="功能名" v-model="dataForm.functionName" />
        </ElFormItem>
      </ElCol>
      <ElCol :span="12" class="mb20">
        <ElFormItem label="代码风格" prop="style">
          <ElSelect v-model="dataForm.style">
            <ElOption
              :key="index"
              :label="item.groupName"
              :value="item.id"
              v-for="(item, index) in groupDataList"
            />
          </ElSelect>
        </ElFormItem>
      </ElCol>
    </ElRow>
    <ElRow>
      <ElCol :span="12" class="mb20">
        <ElFormItem label="表单布局" prop="formLayout">
          <ElRadioGroup v-model="dataForm.formLayout">
            <ElRadio border :value="1">一列</ElRadio>
            <ElRadio border :value="2">两列</ElRadio>
          </ElRadioGroup>
        </ElFormItem>
      </ElCol>
      <ElCol :span="12" class="mb20">
        <ElFormItem label="生成方式" prop="generatorType">
          <ElRadioGroup v-model="dataForm.generatorType">
            <ElRadio border value="1">自定义路径</ElRadio>
            <ElRadio border value="0">ZIP 压缩包</ElRadio>
          </ElRadioGroup>
        </ElFormItem>
      </ElCol>
      <ElCol :span="24" class="mb20">
        <ElFormItem prop="backendPath" v-if="dataForm.generatorType === '1'">
          <template #label>
            <span>后端生成路径</span>
            <Tip
              content="后端模块biz所在文件全路径比如：D:\data\jk\jk-upms\jk-upms-biz"
            />
          </template>
          <ElInput placeholder="后端生成路径" v-model="dataForm.backendPath" />
        </ElFormItem>
        <ElFormItem prop="frontendPath" v-if="dataForm.generatorType === '1'">
          <template #label>
            <span>前端生成路径</span>
            <Tip content="前端所在文件全路径比如：D:\data\jk-ui" />
          </template>
          <ElInput placeholder="前端生成路径" v-model="dataForm.frontendPath" />
        </ElFormItem>
      </ElCol>
    </ElRow>
  </ElForm>
</template>

<style lang="scss" scoped>
.generator-code .el-dialog__body {
  padding: 15px 30px 0 20px;
}

:deep(.el-form-item__label) {
  align-items: center;
}
</style>
