<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';

import { reactive, ref, watch } from 'vue';

import { ElForm, ElFormItem, ElInput } from 'element-plus';

import LocalModelSelect from '../../workflow/designer/nodes/base-node/component/LocalModelSelect.vue';

const props = defineProps<{
  data?: Record<string, any>;
}>();

const form = reactive({
  description: '',
  embedding_model_id: '' as number | string | undefined,
  name: '',
  desc: '',
});
const formRef = ref<FormInstance>();

const rules = reactive<FormRules>({
  desc: [{ message: '请输入知识库描述', required: true, trigger: 'blur' }],
  embedding_model_id: [
    { message: '请选择向量模型', required: true, trigger: 'change' },
  ],
  name: [{ message: '请输入知识库名称', required: true, trigger: 'blur' }],
});

// Keep `description` in sync with `desc` for backward compatibility.
// Consumer dialogs access `form?.description`.
watch(
  () => form.desc,
  (val) => {
    form.description = val;
  },
);

watch(
  () => props.data,
  (value) => {
    if (!value) return;
    form.name = value.name || '';
    form.desc = value.description || value.desc || '';
    form.description = form.desc;
    form.embedding_model_id =
      value.embedding_model_id || value.embeddingModelId || undefined;
  },
  { immediate: true },
);

async function validate() {
  return formRef.value?.validate();
}

defineExpose({ form, validate });
</script>

<template>
  <ElForm
    ref="formRef"
    :model="form"
    :rules="rules"
    label-position="top"
    require-asterisk-position="right"
  >
    <ElFormItem label="知识库名称" prop="name">
      <ElInput
        v-model="form.name"
        maxlength="64"
        placeholder="请输入知识库名称"
        show-word-limit
        @blur="form.name = form.name.trim()"
      />
    </ElFormItem>
    <ElFormItem label="知识库描述" prop="desc">
      <ElInput
        v-model="form.desc"
        type="textarea"
        maxlength="256"
        placeholder="描述知识库的内容，详尽的描述将帮助AI能深入理解该知识库的内容，能更准确的检索到内容，提高该知识库的命中率。"
        show-word-limit
        :autosize="{ minRows: 3 }"
        @blur="form.desc = form.desc.trim()"
      />
    </ElFormItem>
    <ElFormItem label="向量模型" prop="embedding_model_id">
      <LocalModelSelect
        v-model="form.embedding_model_id"
        model-type="EMBEDDING"
        placeholder="请选择向量模型"
        show-footer
      />
    </ElFormItem>
  </ElForm>
</template>
