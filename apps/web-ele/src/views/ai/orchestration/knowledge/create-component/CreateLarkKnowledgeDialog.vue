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

import { createLarkKnowledge } from '#/api/ai/knowledge';

import BaseForm from '../components/BaseForm.vue';

defineOptions({ name: 'CreateLarkKnowledgeDialog' });

const emit = defineEmits<{ refresh: [] }>();

const router = useRouter();
const baseFormRef = ref<InstanceType<typeof BaseForm>>();
const knowledgeFormRef = ref<FormInstance>();
const currentFolder = ref<Record<string, any>>();
const dialogVisible = ref(false);
const loading = ref(false);
const knowledgeForm = reactive({
  app_id: '',
  app_secret: '',
  folder_token: '',
});
const rules = reactive<FormRules>({
  app_id: [{ message: '请输入 App ID', required: true, trigger: 'blur' }],
  app_secret: [
    { message: '请输入 App Secret', required: true, trigger: 'blur' },
  ],
  folder_token: [
    { message: '请输入 Folder Token', required: true, trigger: 'blur' },
  ],
});

watch(dialogVisible, (visible) => {
  if (!visible) {
    knowledgeForm.app_id = '';
    knowledgeForm.app_secret = '';
    knowledgeForm.folder_token = '';
    knowledgeFormRef.value?.clearValidate();
  }
});

function open(folder?: Record<string, any>) {
  currentFolder.value = folder;
  dialogVisible.value = true;
}

async function submitHandle() {
  await baseFormRef.value?.validate();
  await knowledgeFormRef.value?.validate();
  loading.value = true;
  try {
    const form = baseFormRef.value?.form;
    const result = (await createLarkKnowledge({
      appId: knowledgeForm.app_id,
      app_id: knowledgeForm.app_id,
      appSecret: knowledgeForm.app_secret,
      app_secret: knowledgeForm.app_secret,
      description: form?.description,
      embeddingModelId: form?.embedding_model_id,
      embedding_model_id: form?.embedding_model_id,
      folderId: currentFolder.value?.id,
      folder_id: currentFolder.value?.id,
      folderToken: knowledgeForm.folder_token,
      folder_token: knowledgeForm.folder_token,
      name: form?.name,
      type: 'LARK',
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
          type: 'LARK',
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
    title="创建 Lark 知识库"
    width="800"
    append-to-body
    destroy-on-close
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
      <ElFormItem label="App ID" prop="app_id">
        <ElInput
          v-model="knowledgeForm.app_id"
          placeholder="请输入 App ID"
          @blur="knowledgeForm.app_id = knowledgeForm.app_id.trim()"
        />
      </ElFormItem>
      <ElFormItem label="App Secret" prop="app_secret">
        <ElInput
          v-model="knowledgeForm.app_secret"
          type="password"
          show-password
          placeholder="请输入 App Secret"
          @blur="knowledgeForm.app_secret = knowledgeForm.app_secret.trim()"
        />
      </ElFormItem>
      <ElFormItem label="Folder Token" prop="folder_token">
        <ElInput
          v-model="knowledgeForm.folder_token"
          placeholder="请输入 Folder Token"
          @blur="knowledgeForm.folder_token = knowledgeForm.folder_token.trim()"
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
