<script setup lang="ts">
import type { FormField } from '#/components/dynamics-form/type';

import { computed, ref } from 'vue';

import { ElButton } from 'element-plus';

import DynamicsForm from '#/components/dynamics-form/index.vue';

const props = withDefaults(
  defineProps<{
    chatRecordId?: string;
    childNode?: unknown;
    disabled?: boolean;
    formSetting?: string;
    runtimeNodeId?: string;
    sendMessage?: (
      question: string,
      type: 'new' | 'old',
      otherParamsData?: unknown,
    ) => void;
  }>(),
  {
    chatRecordId: '',
    childNode: undefined,
    disabled: false,
    formSetting: '',
    runtimeNodeId: '',
    sendMessage: undefined,
  },
);

const _submit = ref<boolean>(false);
const dynamicsFormRef = ref<InstanceType<typeof DynamicsForm>>();

const formSettingData = computed(() => {
  if (props.formSetting) {
    try {
      return JSON.parse(props.formSetting);
    } catch {
      return {};
    }
  }
  return {};
});

const formFieldList = computed<FormField[]>(() => {
  return formSettingData.value.form_field_list || [];
});

const isSubmit = computed(() => {
  if (_submit.value) return true;
  return formSettingData.value.is_submit || false;
});

const _formData = ref<Record<string, any>>({});

const formData = computed({
  get: () => {
    if (formSettingData.value.is_submit) {
      return formSettingData.value.form_data || {};
    }
    return _formData.value;
  },
  set: (v) => {
    _formData.value = v;
  },
});

function submit() {
  dynamicsFormRef.value
    ?.validate()
    .then(() => {
      _submit.value = true;
      if (props.sendMessage) {
        // console.log(
        //   '[FormRander] submitting with chatRecordId:',
        //   props.chatRecordId,
        //   'runtimeNodeId:',
        //   props.runtimeNodeId,
        // );
        props.sendMessage('', 'old', {
          child_node: props.childNode,
          form_data: formData.value,
          node_data: formData.value,
          runtime_node_id: props.runtimeNodeId,
          chat_record_id: props.chatRecordId,
        });
      }
    })
    .catch(() => {
      // Validation failed — ElForm already shows field-level errors
    });
}
</script>

<template>
  <div>
    <DynamicsForm
      ref="dynamicsFormRef"
      v-model="formData"
      :disabled="isSubmit || disabled"
      label-position="top"
      label-suffix=":"
      require-asterisk-position="right"
      :render-fields="formFieldList"
    />
    <ElButton
      :disabled="isSubmit || disabled"
      :type="isSubmit ? 'info' : 'primary'"
      @click="submit"
    >
      提交
    </ElButton>
  </div>
</template>

<style scoped>
.form-render {
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
}
</style>
