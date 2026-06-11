<script setup lang="ts">
import { computed, reactive } from 'vue';

import { ElButton, ElForm, ElFormItem, ElInput } from 'element-plus';

import { parseJsonLike } from '#/components/ai-chat/utils/markdown';

interface FormField {
  default_value?: unknown;
  field: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
}

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

const formData = reactive<Record<string, any>>({});

const fields = computed<FormField[]>(() => {
  const parsed = parseJsonLike(props.form_setting);
  const source =
    parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {};
  const rawFields =
    source.fields ||
    source.field_list ||
    source.form_field_list ||
    source.forms;
  if (!Array.isArray(rawFields)) return [];
  return rawFields
    .map((item) =>
      item && typeof item === 'object'
        ? (item as Record<string, unknown>)
        : undefined,
    )
    .filter((item): item is Record<string, unknown> => item !== undefined)
    .map((item, index) => {
      const field = `${item.field || item.name || `field_${index}`}`;
      if (!(field in formData)) formData[field] = item.default_value ?? '';
      return {
        default_value: item.default_value,
        field,
        label: `${item.label || item.name || field}`,
        placeholder: `${item.placeholder || '请输入'}`,
        required: item.required === true || item.is_required === true,
        type: `${item.type || 'text'}`,
      };
    });
});

function submit() {
  props.sendMessage?.('', 'old', {
    chat_record_id: props.chat_record_id,
    child_node: props.child_node,
    form_data: { ...formData },
    runtime_node_id: props.runtime_node_id,
  });
}
</script>

<template>
  <ElForm
    v-if="fields.length > 0"
    class="form-render"
    label-position="top"
    :model="formData"
  >
    <ElFormItem
      v-for="field in fields"
      :key="field.field"
      :label="field.label"
      :required="field.required"
    >
      <ElInput
        v-model="formData[field.field]"
        :disabled="disabled"
        :placeholder="field.placeholder"
        :rows="field.type === 'textarea' ? 4 : undefined"
        :type="field.type === 'textarea' ? 'textarea' : 'text'"
      />
    </ElFormItem>
    <ElButton v-if="!disabled" type="primary" @click="submit">提交</ElButton>
  </ElForm>
  <pre v-else class="form-json">{{ form_setting }}</pre>
</template>

<style scoped>
.form-render {
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
}

.form-json {
  padding: 10px 12px;
  white-space: pre-wrap;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}
</style>
