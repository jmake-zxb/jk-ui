<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

import { ElOption, ElOptionGroup, ElSelect } from 'element-plus';

import { listActiveModels } from '#/api/ai/models';

const props = withDefaults(
  defineProps<{
    modelType?: string;
    modelValue?: number | string;
    placeholder?: string;
  }>(),
  {
    modelType: 'CHAT',
    modelValue: undefined,
    placeholder: '请选择模型',
  },
);

const emit = defineEmits<{
  change: [value: number | string | undefined, model?: Record<string, any>];
  'update:modelValue': [value: number | string | undefined];
}>();

const loading = ref(false);
const models = ref<Record<string, any>[]>([]);

function recordsOf(value: any): Record<string, any>[] {
  const data = value?.data ?? value;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.list)) return data.list;
  return [];
}

function modelId(model: Record<string, any>) {
  return model.id ?? model.modelId ?? model.model_id ?? model.value;
}

function modelLabel(model: Record<string, any>) {
  return (
    model.name ||
    model.modelName ||
    model.model_name ||
    model.label ||
    modelId(model)
  );
}

function providerName(model: Record<string, any>) {
  return model.providerName || model.provider_name || model.provider || '默认';
}

function groupedModels() {
  const groups = new Map<string, Record<string, any>[]>();
  models.value.forEach((model) => {
    const group = providerName(model);
    groups.set(group, [...(groups.get(group) || []), model]);
  });
  return [...groups.entries()].map(([label, options]) => ({ label, options }));
}

function apiModelType() {
  return props.modelType === 'LLM' ? 'CHAT' : props.modelType;
}

async function loadModels() {
  loading.value = true;
  try {
    models.value = recordsOf(await listActiveModels(apiModelType()));
  } finally {
    loading.value = false;
  }
}

function updateValue(value: number | string | undefined) {
  emit('update:modelValue', value);
  emit(
    'change',
    value,
    models.value.find((model) => modelId(model) === value),
  );
}

watch(() => props.modelType, loadModels);
onMounted(loadModels);
</script>

<template>
  <ElSelect
    :model-value="modelValue"
    :loading="loading"
    :placeholder="placeholder"
    clearable
    filterable
    size="small"
    @update:model-value="updateValue"
  >
    <ElOptionGroup
      v-for="group in groupedModels()"
      :key="group.label"
      :label="group.label"
    >
      <ElOption
        v-for="model in group.options"
        :key="modelId(model)"
        :label="modelLabel(model)"
        :value="modelId(model)"
      />
    </ElOptionGroup>
    <template #empty>
      <div class="local-model-select__empty">
        暂无可用 {{ apiModelType() }} 模型
      </div>
    </template>
  </ElSelect>
</template>

<style scoped lang="scss">
.local-model-select__empty {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
</style>
