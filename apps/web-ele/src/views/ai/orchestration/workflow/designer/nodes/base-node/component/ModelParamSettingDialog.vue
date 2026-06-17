<script setup lang="ts">
import type { FormField } from '#/components/dynamics-form/type';

import { nextTick, ref } from 'vue';

import { ElButton, ElDialog } from 'element-plus';

import { getModelParamsForm } from '#/api/ai/models';
import DynamicsForm from '#/components/dynamics-form/index.vue';

const emit = defineEmits<{ refresh: [value: Record<string, any>] }>();

const dialogVisible = ref(false);
const loading = ref(false);
const form_data = ref<Record<string, any>>({});
const dynamicsFormRef = ref<InstanceType<typeof DynamicsForm>>();

function open(model_id: string, model_setting_data?: Record<string, any>) {
  dialogVisible.value = true;
  form_data.value = {};
  loading.value = true;
  getModelParamsForm(model_id)
    .then((res: any) => {
      const fields: FormField[] = res.data || res;
      nextTick(() => {
        dynamicsFormRef.value?.render(fields, model_setting_data);
      });
    })
    .finally(() => {
      loading.value = false;
    });
}

function reset_default(model_id: string) {
  getModelParamsForm(model_id).then((res: any) => {
    const fields: FormField[] = res.data || res;
    const defaults = Object.fromEntries(
      fields.map((item: any) =>
        item.show_default_value === false
          ? [item.field, undefined]
          : [item.field, item.default_value],
      ),
    );
    emit('refresh', defaults);
  });
}

function close() {
  dialogVisible.value = false;
}

function submit() {
  dynamicsFormRef.value?.validate().then(() => {
    emit('refresh', form_data.value);
    dialogVisible.value = false;
  });
}

defineExpose({ open, reset_default, close });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    title="参数设置"
    width="550px"
    append-to-body
    :close-on-click-modal="false"
    :close-on-press-escape="false"
  >
    <DynamicsForm
      :render-fields="[]"
      v-model="form_data"
      ref="dynamicsFormRef"
    />
    <template #footer>
      <ElButton @click="close">取消</ElButton>
      <ElButton type="primary" :loading="loading" @click="submit">
        确认
      </ElButton>
    </template>
  </ElDialog>
</template>
