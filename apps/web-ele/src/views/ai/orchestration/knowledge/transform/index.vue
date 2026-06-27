<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ElButton, ElCard, ElMessage, ElMessageBox } from 'element-plus';

import {
  getKnowledge,
  saveKnowledgeWorkflowDraft,
  updateKnowledge,
} from '#/api/ai/knowledge';
import { DEFAULT_KNOWLEDGE_GRAPH_DATA } from '#/views/ai/orchestration/workflow/designer/nodes';

// TODO: add workflow-demo.png asset

const route = useRoute();
const router = useRouter();

const knowledgeId = computed(() => `${route.params.id || ''}`);
const folderId = computed(() => `${route.params.folderId || 'shared'}`);
const knowledgeType = computed(() => `${route.params.type || 'BASE'}`);

async function transform() {
  if (!knowledgeId.value) return;
  try {
    await ElMessageBox.confirm(
      '确认将当前知识库转换为工作流知识库？此操作不可撤销。',
      '提示',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );
  } catch {
    // 用户取消，不执行转换
    return;
  }
  const detail = await getKnowledge(knowledgeId.value);
  await updateKnowledge(knowledgeId.value, {
    description: detail?.description,
    embeddingModelId: detail?.embeddingModelId,
    folderId: detail?.folderId,
    name: detail?.name,
    rerankModelId: detail?.rerankModelId,
    searchConfigJson: detail?.searchConfigJson,
    selector: detail?.selector,
    sourceUrl: detail?.sourceUrl,
    type: 'WORKFLOW',
    workspaceId: detail?.workspaceId,
  });
  await saveKnowledgeWorkflowDraft(knowledgeId.value, {
    graphData: DEFAULT_KNOWLEDGE_GRAPH_DATA,
    workFlow: DEFAULT_KNOWLEDGE_GRAPH_DATA,
    work_flow: DEFAULT_KNOWLEDGE_GRAPH_DATA,
  });
  ElMessage.success('已转换为工作流知识库');
  router.push({
    name: 'KnowledgeWorkflow',
    params: { folderId: folderId.value, id: knowledgeId.value },
  });
}
</script>

<template>
  <div style="padding: 24px">
    <ElCard>
      <div style="display: flex; gap: 24px; align-items: center; height: 100%">
        <div style="display: grid; flex: 1; gap: 16px">
          <div>
            <h2 style="margin: 0 0 8px">转换为工作流知识库</h2>
            <div
              style="line-height: 22px; color: var(--el-text-color-secondary)"
            >
              将当前知识库切换为工作流知识库，并进入工作流编排页。<br />
              转换后可在工作流编排页配置文档处理流程。
            </div>
          </div>
          <div>
            <ElButton type="primary" @click="transform">开始转换</ElButton>
            <ElButton
              @click="
                router.push({
                  name: 'KnowledgeDetail',
                  params: {
                    folderId,
                    id: knowledgeId,
                    tab: 'setting',
                    type: knowledgeType,
                  },
                })
              "
            >
              返回
            </ElButton>
          </div>
        </div>
        <!-- TODO: add workflow-demo.png asset -->
        <!-- <img src="@/assets/workflow-demo.png" alt="工作流演示" width="708" /> -->
      </div>
    </ElCard>
  </div>
</template>
