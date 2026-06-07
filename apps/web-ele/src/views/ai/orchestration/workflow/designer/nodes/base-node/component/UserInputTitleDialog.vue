<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import { computed, nextTick, reactive, ref, watch } from 'vue';

import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElOption,
  ElSelect,
  ElTooltip,
} from 'element-plus';

import {
  exposedInputTypes,
  fieldLabel,
  normalizeList,
} from './base-node-utils';

const emit = defineEmits<{
  refresh: [setting: Record<string, any>];
}>();

const dialogVisible = ref(false);
const fieldFormRef = ref<FormInstance>();
const fieldOptions = ref<any[]>([]);
const form = ref({
  exposed_fields: [] as string[],
  menu_title: '更多设置',
  title: '用户输入',
});
const rules = reactive({
  menu_title: [{ message: '请输入菜单标题', required: true, trigger: 'blur' }],
  title: [{ message: '请输入用户输入标题', required: true, trigger: 'blur' }],
});

const selectableFieldOptions = computed(() =>
  fieldOptions.value.filter((item) =>
    exposedInputTypes.includes(item.input_type),
  ),
);

watch(dialogVisible, (visible) => {
  if (visible) return;
  form.value = {
    exposed_fields: [],
    menu_title: '更多设置',
    title: '用户输入',
  };
});

function open(fields?: any[], setting?: any, legacyTitle?: string) {
  form.value = {
    exposed_fields: Array.isArray(setting?.exposed_fields)
      ? setting.exposed_fields
      : [],
    menu_title: setting?.menu_title || '更多设置',
    title: legacyTitle || setting?.title || '用户输入',
  };
  fieldOptions.value = normalizeList(fields);
  dialogVisible.value = true;
}

function close() {
  dialogVisible.value = false;
}

async function submit(formEl?: FormInstance) {
  if (!formEl) return;
  try {
    await formEl.validate();
  } catch {
    return;
  }
  const data = {
    exposed_fields: form.value.exposed_fields,
    menu_title: form.value.menu_title.trim(),
    title: form.value.title.trim(),
  };
  dialogVisible.value = false;
  await nextTick();
  emit('refresh', data);
}

defineExpose({ close, open });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    title="用户输入设置"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    append-to-body
  >
    <ElForm
      ref="fieldFormRef"
      :model="form"
      :rules="rules"
      label-position="top"
      @submit.prevent
    >
      <ElFormItem label="标题" prop="title">
        <ElInput
          v-model="form.title"
          maxlength="64"
          show-word-limit
          @blur="form.title = form.title.trim()"
        />
      </ElFormItem>
      <ElFormItem prop="exposed_fields">
        <template #label>
          <div class="base-node-dialog-label">
            <span>对话入口展示字段</span>
            <ElTooltip
              content="最多选择 3 个字段直接展示，其余字段折叠到更多设置中。"
              placement="right"
            >
              <span class="base-node-dialog-label__tip">?</span>
            </ElTooltip>
          </div>
        </template>
        <ElSelect
          v-model="form.exposed_fields"
          multiple
          :teleported="false"
          placeholder="选择展示字段"
        >
          <ElOption
            v-for="item in selectableFieldOptions"
            :key="item.field"
            :disabled="
              form.exposed_fields.length >= 3 &&
              !form.exposed_fields.includes(item.field)
            "
            :label="fieldLabel(item)"
            :value="item.field"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="更多设置菜单标题" prop="menu_title">
        <ElInput
          v-model="form.menu_title"
          maxlength="64"
          show-word-limit
          @blur="form.menu_title = form.menu_title.trim()"
        />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="close">取消</ElButton>
      <ElButton type="primary" @click="submit(fieldFormRef)">保存</ElButton>
    </template>
  </ElDialog>
</template>

<style scoped lang="scss">
.base-node-dialog-label {
  display: flex;
  gap: 6px;
  align-items: center;
}

.base-node-dialog-label__tip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 11px;
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 50%;
}
</style>
