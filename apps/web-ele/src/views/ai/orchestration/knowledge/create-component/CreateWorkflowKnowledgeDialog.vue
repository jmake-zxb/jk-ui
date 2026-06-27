<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { ElButton, ElDialog, ElMessage } from 'element-plus';

import {
  createKnowledge,
  saveKnowledgeWorkflowDraft,
} from '#/api/ai/knowledge';
import { DEFAULT_KNOWLEDGE_GRAPH_DATA } from '#/views/ai/orchestration/workflow/designer/nodes';

import BaseForm from '../components/BaseForm.vue';

const emit = defineEmits<{ refresh: [] }>();

const router = useRouter();
const baseFormRef = ref<InstanceType<typeof BaseForm>>();
const currentFolder = ref<Record<string, any>>();
const workflowTemplate = ref<Record<string, any>>();
const dialogVisible = ref(false);
const loading = ref(false);

function open(folder?: Record<string, any>, workflow?: Record<string, any>) {
  currentFolder.value = folder;
  workflowTemplate.value = workflow;
  dialogVisible.value = true;
}

async function submitHandle() {
  await baseFormRef.value?.validate();
  loading.value = true;
  try {
    const form = baseFormRef.value?.form;
    const result = (await createKnowledge({
      description: form?.description,
      embeddingModelId: form?.embedding_model_id,
      embedding_model_id: form?.embedding_model_id,
      folderId: currentFolder.value?.id,
      folder_id: currentFolder.value?.id,
      graphData: DEFAULT_KNOWLEDGE_GRAPH_DATA,
      name: form?.name,
      type: 'WORKFLOW',
      workFlow: DEFAULT_KNOWLEDGE_GRAPH_DATA,
      work_flow: DEFAULT_KNOWLEDGE_GRAPH_DATA,
      ...(workflowTemplate.value
        ? {
            workFlowTemplate: workflowTemplate.value,
            work_flow_template: workflowTemplate.value,
          }
        : {}),
    })) as Record<string, any>;
    const id = result.id || result.data?.id;
    if (id) {
      await saveKnowledgeWorkflowDraft(id, {
        graphData: DEFAULT_KNOWLEDGE_GRAPH_DATA,
        workFlow: DEFAULT_KNOWLEDGE_GRAPH_DATA,
        work_flow: DEFAULT_KNOWLEDGE_GRAPH_DATA,
      });
    }
    ElMessage.success('创建成功');
    emit('refresh');
    dialogVisible.value = false;
    if (id) {
      router.push({
        name: 'KnowledgeWorkflow',
        params: {
          folderId: currentFolder.value?.id || 'shared',
          id,
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
    title="创建工作流知识库"
    width="720"
    append-to-body
    :close-on-click-modal="false"
    :close-on-press-escape="false"
  >
    <BaseForm v-if="dialogVisible" ref="baseFormRef" />
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
