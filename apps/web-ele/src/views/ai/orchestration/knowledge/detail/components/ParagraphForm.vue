<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';

import { onUnmounted, reactive, ref, watch } from 'vue';

import { ElForm, ElFormItem, ElInput } from 'element-plus';
import { MdEditor } from 'md-editor-v3';

import 'md-editor-v3/lib/style.css';

const props = defineProps<{
  data?: Record<string, any>;
  isEdit?: boolean;
  knowledgeId?: string;
}>();

const form = ref<Record<string, any>>({
  title: '',
  content: '',
});

const rules = reactive<FormRules>({
  content: [
    { required: true, message: '请输入分段内容', trigger: 'blur' },
    { max: 100_000, message: '分段内容不能超过100000个字符', trigger: 'blur' },
  ],
});

const paragraphFormRef = ref<FormInstance>();

const toolbars = [
  'bold',
  'underline',
  'italic',
  'strikeThrough',
  'sub',
  'sup',
  'quote',
  'unorderedList',
  'orderedList',
  'task',
  'codeRow',
  'code',
  'link',
  'image',
  'table',
  'revoke',
  'next',
  'preview',
] as const;

watch(
  () => props.data,
  (value) => {
    if (value && JSON.stringify(value) !== '{}') {
      form.value.title = value.title;
      form.value.content = value.content;
    }
  },
  {
    immediate: true,
  },
);

watch(
  () => props.isEdit,
  (value) => {
    if (!value) {
      paragraphFormRef.value?.clearValidate();
    }
  },
  {
    immediate: true,
  },
);

function validate() {
  if (!paragraphFormRef.value) return;
  return paragraphFormRef.value.validate((valid: any) => {
    return valid;
  });
}

onUnmounted(() => {
  form.value = {
    title: '',
    content: '',
  };
});

defineExpose({
  validate,
  form,
});
</script>

<template>
  <ElForm
    ref="paragraphFormRef"
    :model="form"
    label-position="top"
    require-asterisk-position="right"
    :rules="rules"
    @submit.prevent
  >
    <ElFormItem label="分段标题">
      <ElInput
        v-if="isEdit"
        v-model="form.title"
        placeholder="请输入分段标题"
        maxlength="256"
        show-word-limit
      />
      <span v-else class="lighter">{{ form.title || '-' }}</span>
    </ElFormItem>
    <ElFormItem label="分段内容" prop="content">
      <MdEditor
        v-if="isEdit"
        v-model="form.content"
        :toolbars="toolbars"
        :preview="false"
        style="height: 360px"
      />
      <span v-else class="lighter">{{ form.content || '-' }}</span>
    </ElFormItem>
  </ElForm>
</template>

<style scoped lang="scss">
.lighter {
  color: var(--el-text-color-secondary);
  word-break: break-all;
}
</style>
