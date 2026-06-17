<script setup lang="ts">
import type { FormField } from '#/components/dynamics-form/type';

import { computed, ref } from 'vue';

import {
  ElBreadcrumb,
  ElBreadcrumbItem,
  ElButton,
  ElDialog,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
} from 'element-plus';

import {
  getModel,
  listProviderBaseModels,
  listProviderModelTypes,
  updateModel,
} from '#/api/ai/models';
import DynamicsForm from '#/components/dynamics-form/index.vue';

defineOptions({ name: 'EditModelDialog' });

const emit = defineEmits<{
  submit: [];
}>();

interface Provider {
  icon?: string;
  name: string;
  provider: string;
}

interface Model {
  credential?: Record<string, any>;
  id: number | string;
  model_name: string;
  model_type: string;
  name: string;
  provider: string;
}

const dialogVisible = ref(false);
const loading = ref(false);
const formLoading = ref(false);
const modelTypeLoading = ref(false);
const baseModelLoading = ref(false);

const providerValue = ref<Provider>();
const modelValue = ref<Model>();

const dynamicsFormRef = ref<InstanceType<typeof DynamicsForm>>();
const modelTypeList = ref<Array<{ key: string; value: string }>>([]);
const baseModelList = ref<Array<{ name: string }>>([]);
const modelFormField = ref<Array<FormField>>([]);

const baseFormData = ref<{
  model_name: string;
  model_type: string;
  name: string;
}>({
  name: '',
  model_type: '',
  model_name: '',
});

const credentialFormData = ref<Record<string, any>>({});

const formData = computed({
  get: () => ({
    ...credentialFormData.value,
    ...baseFormData.value,
  }),
  set: (event: any) => {
    credentialFormData.value = event;
  },
});

function open(provider: Provider, model: Model) {
  modelValue.value = model;
  providerValue.value = provider;
  dialogVisible.value = true;
  formLoading.value = true;

  getModel(model.id)
    .then((res: any) => {
      const detail = res?.data ?? res;
      if (detail) {
        modelValue.value = { ...model, ...detail };
        baseFormData.value = {
          name: detail.name ?? detail.displayName ?? '',
          model_type: detail.model_type ?? detail.modelType ?? '',
          model_name: detail.model_name ?? detail.modelName ?? '',
        };
        credentialFormData.value = detail.credential ?? {};
      }
      if (providerValue.value) {
        listProviderModelTypes(providerValue.value.provider).then(
          (res2: any) => {
            modelTypeList.value = Array.isArray(res2)
              ? res2
              : (res2?.data ?? []);
          },
        );
        listProviderBaseModels(
          providerValue.value.provider,
          baseFormData.value.model_type,
        ).then((res2: any) => {
          baseModelList.value = Array.isArray(res2) ? res2 : (res2?.data ?? []);
        });
        getModelForm();
      }
    })
    .finally(() => {
      formLoading.value = false;
    });
}

function getModelForm() {
  if (!providerValue.value) return;
  // 使用 listProviderCredentialFields 获取凭证表单字段
  import('#/api/ai/models').then(({ listProviderCredentialFields }) => {
    listProviderCredentialFields(providerValue.value!.provider).then(
      (res: any) => {
        modelFormField.value = Array.isArray(res) ? res : (res?.data ?? []);
        if (modelValue.value?.credential) {
          dynamicsFormRef.value?.render(
            modelFormField.value,
            modelValue.value.credential,
          );
        }
      },
    );
  });
}

function close() {
  baseFormData.value = { name: '', model_type: '', model_name: '' };
  credentialFormData.value = {};
  modelFormField.value = [];
  baseModelList.value = [];
  dialogVisible.value = false;
}

function submit() {
  dynamicsFormRef.value
    ?.validate()
    .then(() => {
      if (!modelValue.value) return;
      loading.value = true;
      updateModel(modelValue.value.id, {
        displayName: baseFormData.value.name,
        modelType: baseFormData.value.model_type,
        modelName: baseFormData.value.model_name,
        credential: credentialFormData.value,
      } as any)
        .then(() => {
          ElMessage.success('更新成功');
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
  >
    <template #header>
      <ElBreadcrumb separator=">">
        <ElBreadcrumbItem>
          <span class="active-breadcrumb">编辑 {{ providerValue?.name }}</span>
        </ElBreadcrumbItem>
      </ElBreadcrumb>
    </template>

    <DynamicsForm
      v-loading="formLoading"
      v-model="formData"
      :render-fields="modelFormField"
      ref="dynamicsFormRef"
      label-position="top"
      require-asterisk-position="right"
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
            disabled
            v-loading="modelTypeLoading"
            v-model="baseFormData.model_type"
            class="w-full"
            placeholder="请选择模型类型"
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

    <template #footer>
      <ElButton @click="close">取消</ElButton>
      <ElButton :loading="loading" type="primary" @click="submit">
        修改
      </ElButton>
    </template>
  </ElDialog>
</template>

<style lang="scss" scoped>
.active-breadcrumb {
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.w-full {
  width: 100%;
}
</style>
