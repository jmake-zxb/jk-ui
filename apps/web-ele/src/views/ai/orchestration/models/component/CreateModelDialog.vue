<script setup lang="ts">
import type { FormField } from '#/components/dynamics-form/type';

import { computed, ref } from 'vue';

import {
  ElBreadcrumb,
  ElBreadcrumbItem,
  ElButton,
  ElDialog,
  ElEmpty,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
  ElTag,
} from 'element-plus';
import { cloneDeep } from 'lodash-es';

import {
  createModel,
  getModelCreateForm,
  listProviderBaseModels,
  listProviderCredentialFields,
  listProviderModelParamsForm,
  listProviderModelTypes,
} from '#/api/ai/models';
import { input_type_list } from '#/components/dynamics-form/constructor/data';
import DynamicsForm from '#/components/dynamics-form/index.vue';

import AddParamDrawer from './AddParamDrawer.vue';

defineOptions({ name: 'CreateModelDialog' });

const emit = defineEmits<{
  change: [];
  submit: [];
}>();

interface Provider {
  icon?: string;
  name: string;
  provider: string;
}

interface BaseModel {
  desc?: string;
  name: string;
}

interface KeyValue {
  key: string;
  value: string;
}

const dialogVisible = ref(false);
const loading = ref(false);
const activeName = ref('base-info');
const providerValue = ref<Provider>();

const dynamicsFormRef = ref<InstanceType<typeof DynamicsForm>>();
const modelTypeLoading = ref(false);
const baseModelLoading = ref(false);

const modelTypeList = ref<Array<KeyValue>>([]);
const baseModelList = ref<Array<BaseModel>>([]);
const modelFormField = ref<Array<FormField>>([]);
const credentialFields = ref<Array<FormField>>([]);

const addParamRef = ref<InstanceType<typeof AddParamDrawer>>();

const baseFormData = ref<{
  model_name: string;
  model_params_form: any[];
  model_type: string;
  name: string;
}>({
  name: '',
  model_type: '',
  model_name: '',
  model_params_form: [],
});

const credentialFormData = ref<Record<string, any>>({});

const formData = computed({
  get: () => ({
    ...credentialFormData.value,
    name: baseFormData.value.name,
    model_type: baseFormData.value.model_type,
    model_name: baseFormData.value.model_name,
    model_params_form: baseFormData.value.model_params_form,
  }),
  set: (event: any) => {
    credentialFormData.value = event;
  },
});

function open(provider: Provider, modelType?: string) {
  providerValue.value = provider;
  dialogVisible.value = true;
  baseFormData.value = {
    name: '',
    model_type: '',
    model_name: '',
    model_params_form: [],
  };
  credentialFormData.value = {};
  modelFormField.value = [];
  baseModelList.value = [];
  activeName.value = 'base-info';

  listProviderModelTypes(provider.provider).then((res: any) => {
    modelTypeList.value = Array.isArray(res) ? res : (res?.data ?? []);
  });

  if (modelType) {
    baseFormData.value.model_type = modelType;
    listBaseModel(modelType);
  }
}

function close() {
  baseFormData.value = {
    name: '',
    model_type: '',
    model_name: '',
    model_params_form: [],
  };
  credentialFormData.value = {};
  modelFormField.value = [];
  baseModelList.value = [];
  loading.value = false;
  dialogVisible.value = false;
}

function listBaseModel(modelType: string, change?: boolean) {
  if (change) {
    baseFormData.value.model_name = '';
    baseFormData.value.model_params_form = [];
  }
  if (!providerValue.value || !modelType) return;
  listProviderBaseModels(providerValue.value.provider, modelType).then(
    (res: any) => {
      baseModelList.value = Array.isArray(res) ? res : (res?.data ?? []);
    },
  );
}

function onModelTypeChange(modelType: string) {
  baseFormData.value.model_name = '';
  baseFormData.value.model_params_form = [];
  listBaseModel(modelType, true);
}

function onModelNameChange(modelName: string) {
  if (!providerValue.value) return;
  getModelCreateForm(
    providerValue.value.provider,
    baseFormData.value.model_type,
    modelName,
  ).then((res: any) => {
    modelFormField.value = Array.isArray(res) ? res : (res?.data ?? []);
    dynamicsFormRef.value?.render(modelFormField.value, undefined);
  });
  listProviderCredentialFields(providerValue.value.provider).then(
    (res: any) => {
      credentialFields.value = Array.isArray(res) ? res : (res?.data ?? []);
    },
  );
  listProviderModelParamsForm(
    providerValue.value.provider,
    baseFormData.value.model_type,
  ).then((res: any) => {
    baseFormData.value.model_params_form = Array.isArray(res)
      ? res
      : (res?.data ?? []);
  });
}

function toSelectProvider() {
  close();
  emit('change');
}

function openAddDrawer(data?: any, index?: number) {
  addParamRef.value?.open(data, index);
}

function deleteParam(index: number) {
  baseFormData.value.model_params_form.splice(index, 1);
}

function fieldLabel(field: any): string {
  if (!field.label) return '';
  if (
    typeof field.label === 'object' &&
    field.label.input_type === 'TooltipLabel'
  ) {
    return field.label.label ?? '';
  }
  return String(field.label);
}

function fieldTypeTag(field: any): string {
  const found = input_type_list.find((item) => item.value === field.input_type);
  return found?.label ?? field.input_type ?? '';
}

function refresh(data: any, index: null | number) {
  for (let i = 0; i < baseFormData.value.model_params_form.length; i++) {
    const existingField = baseFormData.value.model_params_form[i].field;
    if (existingField === data.field && index !== i) {
      ElMessage.error(`字段已存在: ${data.field}`);
      return;
    }
  }
  if (index === null) {
    baseFormData.value.model_params_form.push(data);
  } else {
    baseFormData.value.model_params_form.splice(index, 1, data);
  }
}

function submit() {
  dynamicsFormRef.value
    ?.validate()
    .then(() => {
      if (!providerValue.value) return;
      loading.value = true;
      createModel({
        displayName: baseFormData.value.name,
        modelType: baseFormData.value.model_type,
        modelName: baseFormData.value.model_name,
        credential: credentialFormData.value,
        providerCode: providerValue.value.provider,
        modelParamsForm: cloneDeep(baseFormData.value.model_params_form),
      } as any)
        .then(() => {
          ElMessage.success('创建成功');
          close();
          emit('submit');
        })
        .finally(() => {
          loading.value = false;
        });
    })
    .catch(() => {
      ElMessage.error('请完善表单信息');
    });
}

defineExpose({ open, close });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    width="600px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :destroy-on-close="true"
    :before-close="close"
    append-to-body
  >
    <template #header>
      <ElBreadcrumb separator=">">
        <ElBreadcrumbItem>
          <span class="select-provider" @click="toSelectProvider"
            >选择供应商</span
          >
        </ElBreadcrumbItem>
        <ElBreadcrumbItem>
          <span class="active-breadcrumb">添加 {{ providerValue?.name }}</span>
        </ElBreadcrumbItem>
      </ElBreadcrumb>
    </template>

    <ElTabs v-model="activeName">
      <ElTabPane label="基础信息" name="base-info">
        <DynamicsForm
          v-model="formData"
          :render-fields="modelFormField"
          ref="dynamicsFormRef"
          label-position="top"
          require-asterisk-position="right"
          label-width="auto"
        >
          <template #default>
            <ElFormItem prop="name" required>
              <template #label>模型名称</template>
              <ElInput
                v-model="baseFormData.name"
                maxlength="64"
                show-word-limit
                placeholder="请输入模型名称"
              />
            </ElFormItem>
            <ElFormItem prop="model_type" required>
              <template #label>模型类型</template>
              <ElSelect
                v-loading="modelTypeLoading"
                v-model="baseFormData.model_type"
                class="w-full"
                placeholder="请选择模型类型"
                @change="onModelTypeChange"
              >
                <ElOption
                  v-for="item in modelTypeList"
                  :key="item.value"
                  :label="item.key"
                  :value="item.value"
                />
              </ElSelect>
            </ElFormItem>
            <ElFormItem prop="model_name" required>
              <template #label>基础模型</template>
              <ElSelect
                v-loading="baseModelLoading"
                v-model="baseFormData.model_name"
                class="w-full"
                placeholder="请选择或输入基础模型"
                filterable
                allow-create
                default-first-option
                @change="onModelNameChange"
              >
                <ElOption
                  v-for="item in baseModelList"
                  :key="item.name"
                  :value="item.name"
                  :label="item.name"
                />
              </ElSelect>
            </ElFormItem>
          </template>
        </DynamicsForm>
      </ElTabPane>

      <ElTabPane label="高级信息" name="advanced-info">
        <ElEmpty
          v-if="!baseFormData.model_type || !baseFormData.model_name"
          description="请先选择模型类型和基础模型"
        />
        <ElEmpty
          v-else-if="baseFormData.model_type === 'RERANKER'"
          description="重排模型暂无参数配置"
        />
        <template v-else>
          <div class="flex-between mb-8">
            <h5>模型参数</h5>
            <ElButton type="primary" text @click.stop="openAddDrawer()">
              新增
            </ElButton>
          </div>
          <ElTable
            v-if="baseFormData.model_params_form.length > 0"
            :data="baseFormData.model_params_form"
            class="mb-16"
          >
            <ElTableColumn prop="label" label="名称" show-overflow-tooltip>
              <template #default="{ row }">{{ fieldLabel(row) }}</template>
            </ElTableColumn>
            <ElTableColumn
              prop="field"
              label="字段"
              show-overflow-tooltip
              width="95px"
            />
            <ElTableColumn label="控件类型" width="110">
              <template #default="{ row }">
                <ElTag size="small" type="info">{{ fieldTypeTag(row) }}</ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn
              prop="default_value"
              label="默认值"
              show-overflow-tooltip
            />
            <ElTableColumn label="必填" width="80">
              <template #default="{ row }">
                <ElSwitch disabled size="small" :model-value="row.required" />
              </template>
            </ElTableColumn>
            <ElTableColumn label="操作" width="100">
              <template #default="{ row, $index }">
                <ElButton
                  type="primary"
                  text
                  @click.stop="openAddDrawer(row, $index)"
                >
                  编辑
                </ElButton>
                <ElButton type="primary" text @click="deleteParam($index)">
                  删除
                </ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </template>
      </ElTabPane>
    </ElTabs>

    <template #footer>
      <ElButton @click="close">取消</ElButton>
      <ElButton :loading="loading" type="primary" @click="submit">
        保存
      </ElButton>
    </template>

    <AddParamDrawer ref="addParamRef" @refresh="refresh" />
  </ElDialog>
</template>

<style lang="scss" scoped>
.select-provider {
  font-size: 16px;
  font-weight: 400;
  color: rgb(100 106 115 / 100%);
  cursor: pointer;

  &:hover {
    color: var(--el-color-primary);
  }
}

.active-breadcrumb {
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.w-full {
  width: 100%;
}

.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mb-8 {
  margin-bottom: 8px;
}

.mb-16 {
  margin-bottom: 16px;
}
</style>
