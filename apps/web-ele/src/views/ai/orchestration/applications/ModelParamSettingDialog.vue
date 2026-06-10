<script setup lang="ts">
import type { InitParamValues } from '../tools/component/init-param-utils';

import type { ModelFormField } from '#/api/ai/models';
import type { ToolFieldSchema } from '#/api/ai/tools';

import { computed, ref, watch } from 'vue';

import { ElButton, ElDialog, ElEmpty, ElMessage } from 'element-plus';
import { cloneDeep } from 'lodash-es';

import { getModelParamsForm } from '#/api/ai/models';

import DynamicInitForm from '../tools/component/DynamicInitForm.vue';
import {
  normalizeInitParamsForPayload,
  seedInitParams,
} from '../tools/component/init-param-utils';

type JsonRecord = Record<string, unknown>;

const props = withDefaults(
  defineProps<{
    modelId?: number | string;
    modelValue: boolean;
    setting?: JsonRecord;
  }>(),
  {
    modelId: '',
    setting: () => ({}),
  },
);

const emit = defineEmits<{
  refresh: [value: JsonRecord];
  'update:modelValue': [value: boolean];
}>();

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const loading = ref(false);
const fields = ref<ToolFieldSchema[]>([]);
const formValues = ref<InitParamValues>({});

const hasFields = computed(() => fields.value.length > 0);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function normalizeFields(value: unknown): ToolFieldSchema[] {
  const source = typeof value === 'string' ? safeParseJson(value) : value;
  if (!Array.isArray(source)) return [];
  return source
    .filter((item): item is ModelFormField => isRecord(item))
    .map((item) => cloneDeep(item) as ToolFieldSchema);
}

async function loadForm() {
  if (!props.modelId) {
    fields.value = [];
    formValues.value = {};
    return;
  }
  loading.value = true;
  try {
    const response = await getModelParamsForm(props.modelId);
    fields.value = normalizeFields(response);
    formValues.value = seedInitParams(fields.value, props.setting);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '加载模型参数表单失败';
    ElMessage.error(message);
    fields.value = [];
    formValues.value = {};
  } finally {
    loading.value = false;
  }
}

function patchValues(value: InitParamValues) {
  formValues.value = value;
}

function resetDefault() {
  formValues.value = seedInitParams(fields.value, {});
}

function submit() {
  const payload = normalizeInitParamsForPayload(fields.value, formValues.value);
  emit('refresh', payload);
  dialogVisible.value = false;
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) loadForm();
  },
);
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    align-center
    append-to-body
    destroy-on-close
    title="模型参数设置"
    width="550px"
  >
    <div v-loading="loading" class="model-param-setting-dialog">
      <DynamicInitForm
        v-if="hasFields"
        :fields="fields"
        :model-value="formValues"
        :show-empty="false"
        @update:model-value="patchValues"
      />
      <ElEmpty
        v-else-if="!loading"
        description="当前模型暂无可配置参数"
        :image-size="48"
      />
    </div>

    <template #footer>
      <ElButton @click="dialogVisible = false">取消</ElButton>
      <ElButton :disabled="!hasFields" @click="resetDefault">
        恢复默认
      </ElButton>
      <ElButton type="primary" :disabled="!hasFields" @click="submit">
        确定
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped lang="scss">
.model-param-setting-dialog {
  min-height: 80px;
}
</style>
