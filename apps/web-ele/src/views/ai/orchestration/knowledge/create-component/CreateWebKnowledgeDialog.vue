<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';

import { reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
} from 'element-plus';

import { createKnowledge } from '#/api/ai/knowledge';

import BaseForm from '../components/BaseForm.vue';

const emit = defineEmits<{ refresh: [] }>();

const router = useRouter();
const baseFormRef = ref<InstanceType<typeof BaseForm>>();
const knowledgeFormRef = ref<FormInstance>();
const currentFolder = ref<Record<string, any>>();
const dialogVisible = ref(false);
const loading = ref(false);
const knowledgeForm = reactive({
  selector: '',
  source_url: '',
});
const rules = reactive<FormRules>({
  source_url: [
    { message: '请输入 Web 根地址', required: true, trigger: 'blur' },
  ],
});

function open(folder?: Record<string, any>) {
  currentFolder.value = folder;
  knowledgeForm.selector = '';
  knowledgeForm.source_url = '';
  dialogVisible.value = true;
}

watch(dialogVisible, (visible) => {
  if (!visible) {
    knowledgeFormRef.value?.clearValidate();
  }
});

async function submitHandle() {
  await baseFormRef.value?.validate();
  await knowledgeFormRef.value?.validate();
  loading.value = true;
  try {
    const form = baseFormRef.value?.form;
    const result = (await createKnowledge({
      description: form?.description,
      embeddingModelId: form?.embedding_model_id,
      embedding_model_id: form?.embedding_model_id,
      folderId: currentFolder.value?.id,
      folder_id: currentFolder.value?.id,
      name: form?.name,
      selector: knowledgeForm.selector,
      sourceUrl: knowledgeForm.source_url,
      source_url: knowledgeForm.source_url,
      type: 'WEB',
    })) as Record<string, any>;
    ElMessage.success('创建成功');
    emit('refresh');
    dialogVisible.value = false;
    const id = result.id || result.data?.id;
    if (id) {
      router.push({
        name: 'KnowledgeDetail',
        params: {
          folderId: currentFolder.value?.id || 'shared',
          id,
          tab: 'document',
          type: 'WEB',
        },
      });
    }
  } finally {
    loading.value = false;
  }
}

defineExpose({ open });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    title="创建 Web 知识库"
    width="720"
    append-to-body
    :close-on-click-modal="false"
    :close-on-press-escape="false"
  >
    <BaseForm v-if="dialogVisible" ref="baseFormRef" />
    <ElForm
      ref="knowledgeFormRef"
      :model="knowledgeForm"
      :rules="rules"
      label-position="top"
      require-asterisk-position="right"
    >
      <ElFormItem label="Web 根地址" prop="source_url">
        <ElInput
          v-model="knowledgeForm.source_url"
          placeholder="请输入 Web 根地址"
          @blur="knowledgeForm.source_url = knowledgeForm.source_url.trim()"
        />
      </ElFormItem>
      <ElFormItem label="选择器">
        <ElInput
          v-model="knowledgeForm.selector"
          placeholder="请输入选择器，可为空"
          @blur="knowledgeForm.selector = knowledgeForm.selector.trim()"
        />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton :loading="loading" @click="dialogVisible = false">
        取消
      </ElButton>
      <ElButton type="primary" :loading="loading" @click="submitHandle">
        创建
      </ElButton>
    </template>
  </ElDialog>
</template>
