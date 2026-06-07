<script setup lang="ts">
import type { InitParamValues } from './init-param-utils';

import type { ToolFieldSchema } from '#/api/ai/tools';

import { computed, ref, watch } from 'vue';

import {
  ElAlert,
  ElButton,
  ElDrawer,
  ElEmpty,
  ElInput,
  ElMessage,
  ElTabPane,
  ElTabs,
} from 'element-plus';

import DynamicInitForm from './DynamicInitForm.vue';
import {
  normalizeInitFields,
  normalizeInitParamsForPayload,
  parseInitParamsText,
  seedInitParams,
  stringifyInitParamsForPayload,
  validateInitParamValues,
} from './init-param-utils';

const props = withDefaults(
  defineProps<{
    fields?: ToolFieldSchema[];
    loading?: boolean;
    modelValue: boolean;
    params?: InitParamValues;
    rawText?: string;
    toolName?: string;
  }>(),
  {
    fields: () => [],
    loading: false,
    params: () => ({}),
    rawText: '{}',
    toolName: '',
  },
);

const emit = defineEmits<{
  save: [params: Record<string, unknown>];
  'update:modelValue': [value: boolean];
  'update:params': [value: InitParamValues];
  'update:rawText': [value: string];
}>();

const formRef = ref<InstanceType<typeof DynamicInitForm>>();
const activeTab = ref<'form' | 'raw'>('form');

const drawerVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});
const normalizedFields = computed(() => normalizeInitFields(props.fields));
const hasFields = computed(() => normalizedFields.value.length > 0);
const drawerTitle = computed(() =>
  props.toolName ? `配置启动参数：${props.toolName}` : '配置启动参数',
);

function syncRawFromParams() {
  emit(
    'update:rawText',
    stringifyInitParamsForPayload(props.fields, props.params),
  );
}

function syncParamsFromRaw(showWarning = false) {
  const parsed = parseInitParamsText(props.rawText || '{}');
  if (!parsed) {
    if (showWarning) ElMessage.warning('初始化参数 JSON 必须是对象');
    return false;
  }
  emit('update:params', seedInitParams(props.fields, parsed));
  return true;
}

function handleTabChange(tabName: number | string) {
  if (tabName === 'raw') syncRawFromParams();
  if (tabName === 'form') syncParamsFromRaw(false);
}

function handleParamsUpdate(value: InitParamValues) {
  emit('update:params', value);
  emit('update:rawText', stringifyInitParamsForPayload(props.fields, value));
}

async function submit() {
  if (activeTab.value === 'raw') {
    const parsed = parseInitParamsText(props.rawText || '{}');
    if (!parsed) {
      ElMessage.warning('初始化参数 JSON 必须是对象');
      return;
    }
    const errors = validateInitParamValues(props.fields, parsed);
    if (errors.length > 0) {
      ElMessage.warning(errors[0]);
      return;
    }
    emit('update:params', seedInitParams(props.fields, parsed));
    emit('save', normalizeInitParamsForPayload(props.fields, parsed));
    return;
  }

  const valid = await formRef.value?.validate();
  if (valid === false) return;
  const errors = validateInitParamValues(props.fields, props.params);
  if (errors.length > 0) {
    ElMessage.warning(errors[0]);
    return;
  }
  syncRawFromParams();
  emit('save', normalizeInitParamsForPayload(props.fields, props.params));
}

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return;
    activeTab.value = hasFields.value ? 'form' : 'raw';
    syncRawFromParams();
  },
);
</script>

<template>
  <ElDrawer
    v-model="drawerVisible"
    append-to-body
    :title="drawerTitle"
    size="560px"
  >
    <div class="init-param-drawer">
      <ElAlert
        :closable="false"
        show-icon
        title="该工具声明了启动参数，启用前需要先完成配置。"
        type="info"
      />
      <ElTabs
        v-model="activeTab"
        class="init-param-drawer__tabs"
        @tab-change="handleTabChange"
      >
        <ElTabPane v-if="hasFields" label="参数表单" name="form">
          <DynamicInitForm
            ref="formRef"
            :fields="fields"
            :model-value="params"
            @update:model-value="handleParamsUpdate"
          />
        </ElTabPane>
        <ElTabPane label="原始 JSON" name="raw">
          <div class="init-param-drawer__raw-hint">
            高级编辑入口。需要提交 JSON 对象，保存时仍会校验必填启动参数。
          </div>
          <ElInput
            :model-value="rawText"
            class="init-param-drawer__raw-input"
            type="textarea"
            :rows="12"
            @blur="syncParamsFromRaw(false)"
            @update:model-value="(value) => emit('update:rawText', value)"
          />
        </ElTabPane>
      </ElTabs>
      <ElEmpty
        v-if="!hasFields"
        description="当前工具未声明启动参数，可直接使用原始 JSON"
        :image-size="48"
      />
    </div>
    <template #footer>
      <ElButton @click="drawerVisible = false">取消</ElButton>
      <ElButton :loading="loading" type="primary" @click="submit">
        保存并启用
      </ElButton>
    </template>
  </ElDrawer>
</template>

<style scoped lang="scss">
.init-param-drawer {
  --init-param-drawer-space-2: 8px;
  --init-param-drawer-space-3: 12px;

  display: flex;
  flex-direction: column;
  gap: var(--init-param-drawer-space-3);
}

.init-param-drawer__tabs {
  min-height: 0;
}

.init-param-drawer__raw-hint {
  margin-bottom: var(--init-param-drawer-space-2);
  font-size: calc(var(--font-size-base) * 0.75);
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.init-param-drawer__raw-input :deep(.el-textarea__inner) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
</style>
