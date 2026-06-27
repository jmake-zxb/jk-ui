<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';

import type {
  Id,
  KnowledgeDetailTabProps,
  KnowledgeRecord,
} from './KnowledgeDetailTypes';

import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Rank, Reading, Tickets, Warning } from '@element-plus/icons-vue';
import {
  ElButton,
  ElCard,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElSlider,
  ElTooltip,
} from 'element-plus';

import {
  getKnowledge,
  reembedKnowledge,
  updateKnowledge,
} from '#/api/ai/knowledge';

import LocalModelSelect from '../../../workflow/designer/nodes/base-node/component/LocalModelSelect.vue';
import { numberOf, textOf } from './KnowledgeDetailTypes';

const props = defineProps<KnowledgeDetailTabProps>();
const emit = defineEmits<{
  refresh: [detail: KnowledgeRecord];
}>();

const router = useRouter();
const loading = ref(false);
const formRef = ref<FormInstance>();
const form = reactive({
  appId: '',
  appSecret: '',
  description: '',
  embeddingModelId: '' as Id,
  fileCountLimit: 50,
  fileSizeLimit: 100,
  folderToken: '',
  name: '',
  rerankModelId: '' as Id,
  searchConfigJson: '',
  selector: '',
  sourceUrl: '',
  type: 'BASE',
  workspaceId: '',
});
const originalEmbeddingModelId = ref<Id>('');

const isLark = computed(() => form.type === 'LARK' || form.type === '2');
const isWeb = computed(() => form.type === 'WEB' || form.type === '1');
const isWorkflow = computed(
  () => form.type === 'WORKFLOW' || form.type === '4',
);

const rules = reactive<FormRules>({
  appId: [{ message: '请输入 App ID', required: true, trigger: 'blur' }],
  appSecret: [
    { message: '请输入 App Secret', required: true, trigger: 'blur' },
  ],
  folderToken: [
    { message: '请输入 Folder Token', required: true, trigger: 'blur' },
  ],
  name: [{ message: '请输入知识库名称', required: true, trigger: 'blur' }],
  sourceUrl: [
    { message: '请输入 Web 源地址', required: true, trigger: 'blur' },
  ],
});

const typeLabel = computed(() => {
  if (isWeb.value) return 'Web 知识库';
  if (isWorkflow.value) return '工作流知识库';
  if (isLark.value) return '飞书知识库';
  return '基础知识库';
});
const typeIcon = computed(() => {
  if (isWeb.value) return Reading;
  if (isWorkflow.value) return Rank;
  return Tickets;
});

function parseLarkMeta(detail: KnowledgeRecord): {
  appId: string;
  appSecret: string;
  folderToken: string;
} {
  const raw =
    (detail.metaJson as string | undefined) ??
    (detail.meta_json as string | undefined);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return {
        appId: textOf(parsed.app_id ?? parsed.appId, ''),
        appSecret: textOf(parsed.app_secret ?? parsed.appSecret, ''),
        folderToken: textOf(parsed.folder_token ?? parsed.folderToken, ''),
      };
    } catch {
      // fall through to flattened fields
    }
  }
  return {
    appId: textOf(detail.app_id ?? detail.appId, ''),
    appSecret: textOf(detail.app_secret ?? detail.appSecret, ''),
    folderToken: textOf(detail.folder_token ?? detail.folderToken, ''),
  };
}

function loadForm(detail?: KnowledgeRecord) {
  if (!detail) return;
  form.name = textOf(detail.name, '');
  form.description = textOf(detail.description, '');
  form.embeddingModelId = textOf(
    detail.embedding_model_id ?? detail.embeddingModelId,
    '',
  );
  form.rerankModelId = textOf(
    detail.rerank_model_id ?? detail.rerankModelId,
    '',
  );
  form.sourceUrl = textOf(detail.source_url ?? detail.sourceUrl, '');
  form.selector = textOf(detail.selector, '');
  form.searchConfigJson = textOf(
    detail.search_config_json ?? detail.searchConfigJson,
    '',
  );
  form.fileCountLimit = numberOf(
    detail.file_count_limit ?? detail.fileCountLimit,
    50,
  );
  form.fileSizeLimit = numberOf(
    detail.file_size_limit ?? detail.fileSizeLimit,
    100,
  );
  form.type = textOf(detail.type, 'BASE');
  form.workspaceId = textOf(detail.workspace_id ?? detail.workspaceId, '');
  const lark = parseLarkMeta(detail);
  form.appId = lark.appId;
  form.appSecret = lark.appSecret;
  form.folderToken = lark.folderToken;
  originalEmbeddingModelId.value = form.embeddingModelId;
}

async function reload() {
  loading.value = true;
  try {
    const detail = (await getKnowledge(props.knowledgeId)) as KnowledgeRecord;
    loadForm(detail);
    emit('refresh', detail);
  } finally {
    loading.value = false;
  }
}

function buildPayload() {
  return {
    appId: isLark.value ? form.appId.trim() : undefined,
    appSecret: isLark.value ? form.appSecret.trim() : undefined,
    description: form.description.trim(),
    embeddingModelId: form.embeddingModelId || undefined,
    embedding_model_id: form.embeddingModelId || undefined,
    fileCountLimit: form.fileCountLimit,
    fileSizeLimit: form.fileSizeLimit,
    file_count_limit: form.fileCountLimit,
    file_size_limit: form.fileSizeLimit,
    folderId: props.folderId,
    folder_id: props.folderId,
    folderToken: isLark.value ? form.folderToken.trim() : undefined,
    name: form.name.trim(),
    rerankModelId: form.rerankModelId || undefined,
    rerank_model_id: form.rerankModelId || undefined,
    searchConfigJson: form.searchConfigJson,
    search_config_json: form.searchConfigJson,
    selector: form.selector.trim(),
    sourceUrl: form.sourceUrl.trim(),
    source_url: form.sourceUrl.trim(),
    type: form.type,
    workspaceId: form.workspaceId || undefined,
    workspace_id: form.workspaceId || undefined,
  };
}

async function persistUpdate() {
  await updateKnowledge(props.knowledgeId, buildPayload());
}

async function persistUpdateAndReembed() {
  await persistUpdate();
  await reembedKnowledge(props.knowledgeId);
}

async function submit() {
  if (!form.name.trim()) {
    ElMessage.warning('请输入知识库名称');
    return;
  }
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  const embeddingChanged =
    !!originalEmbeddingModelId.value &&
    originalEmbeddingModelId.value !== form.embeddingModelId;
  loading.value = true;
  try {
    if (embeddingChanged) {
      try {
        await ElMessageBox.confirm(
          '修改向量模型后将重新向量化知识库，确定修改吗？',
          '提示',
          {
            confirmButtonText: '向量化',
            cancelButtonText: '取消',
            type: 'warning',
          },
        );
      } catch {
        return;
      }
      await persistUpdateAndReembed();
    } else {
      await persistUpdate();
    }
    ElMessage.success('保存成功');
    await reload();
  } finally {
    loading.value = false;
  }
}

function toWorkflowSetting() {
  router.push({
    name: 'KnowledgeWorkflowSetting',
    params: {
      folderId: props.folderId || 'shared',
      id: props.knowledgeId,
      type: props.type || form.type,
    },
  });
}

function toWorkflow() {
  router.push({
    name: 'KnowledgeWorkflow',
    params: {
      folderId: props.folderId || 'shared',
      id: props.knowledgeId,
    },
  });
}

watch(
  () => props.knowledge,
  (detail) => loadForm(detail),
  { immediate: true },
);

onMounted(() => {
  if (!props.knowledge?.id) reload();
});
</script>

<template>
  <section class="knowledge-setting-panel" v-loading="loading">
    <header class="knowledge-detail-panel__header">
      <div>
        <h2>设置</h2>
        <span>迁移 MaxKB 知识库基础信息、类型信息和其他设置</span>
      </div>
      <div class="knowledge-detail-panel__actions">
        <ElButton v-if="!isWorkflow" @click="toWorkflowSetting">
          转换为工作流知识库
        </ElButton>
        <ElButton v-else :icon="Rank" @click="toWorkflow">工作流编排</ElButton>
        <ElButton type="primary" @click="submit">保存</ElButton>
      </div>
    </header>

    <ElForm
      ref="formRef"
      class="knowledge-setting-form"
      :model="form"
      :rules="rules"
      label-position="top"
    >
      <h4>基础信息</h4>
      <ElFormItem label="名称" prop="name" required>
        <ElInput
          v-model="form.name"
          maxlength="64"
          placeholder="请输入知识库名称"
          show-word-limit
        />
      </ElFormItem>
      <ElFormItem label="描述">
        <ElInput
          v-model="form.description"
          :autosize="{ minRows: 3, maxRows: 6 }"
          maxlength="256"
          placeholder="请输入知识库描述"
          show-word-limit
          type="textarea"
        />
      </ElFormItem>
      <ElFormItem label="知识库类型">
        <ElCard shadow="never" class="knowledge-type-card">
          <ElIcon><component :is="typeIcon" /></ElIcon>
          <div>
            <strong>{{ typeLabel }}</strong>
            <span>当前类型来自 MaxKB 知识库类型配置</span>
          </div>
        </ElCard>
      </ElFormItem>

      <template v-if="isWeb">
        <h4>Web 配置</h4>
        <ElFormItem label="源地址" prop="sourceUrl" required>
          <ElInput v-model="form.sourceUrl" placeholder="请输入 Web 源地址" />
        </ElFormItem>
        <ElFormItem label="选择器">
          <ElInput v-model="form.selector" placeholder="请输入选择器" />
        </ElFormItem>
      </template>

      <template v-if="isLark">
        <h4>飞书配置</h4>
        <ElFormItem label="App ID" prop="appId" required>
          <ElInput v-model="form.appId" placeholder="请输入飞书应用 App ID" />
        </ElFormItem>
        <ElFormItem label="App Secret" prop="appSecret" required>
          <ElInput
            v-model="form.appSecret"
            placeholder="请输入飞书应用 App Secret"
            show-password
            type="password"
          />
        </ElFormItem>
        <ElFormItem label="Folder Token" prop="folderToken" required>
          <ElInput
            v-model="form.folderToken"
            placeholder="请输入飞书文件夹 Folder Token"
          />
        </ElFormItem>
      </template>

      <h4>模型配置</h4>
      <ElFormItem label="向量模型">
        <LocalModelSelect
          v-model="form.embeddingModelId"
          model-type="EMBEDDING"
          placeholder="请选择向量模型"
          show-footer
        />
      </ElFormItem>
      <ElFormItem label="重排模型 ID">
        <ElInput v-model="form.rerankModelId" placeholder="请输入重排模型 ID" />
      </ElFormItem>
      <ElFormItem label="检索配置 JSON">
        <ElInput
          v-model="form.searchConfigJson"
          :autosize="{ minRows: 3, maxRows: 8 }"
          placeholder="请输入检索配置 JSON"
          type="textarea"
        />
      </ElFormItem>

      <h4>其他设置</h4>
      <ElFormItem label="单次上传文件数量上限">
        <ElSlider
          v-model="form.fileCountLimit"
          :max="1000"
          :min="1"
          :show-input-controls="false"
          class="setting-slider"
          show-input
        />
      </ElFormItem>
      <ElFormItem>
        <template #label>
          <div class="setting-label-with-tip">
            <span>单文件大小上限 MB</span>
            <ElTooltip
              content="单个文件大小超过该值将无法上传"
              effect="dark"
              placement="right"
            >
              <ElIcon class="setting-label-tip-icon"><Warning /></ElIcon>
            </ElTooltip>
          </div>
        </template>
        <ElSlider
          v-model="form.fileSizeLimit"
          :max="1000"
          :min="1"
          :show-input-controls="false"
          class="setting-slider"
          show-input
        />
      </ElFormItem>
    </ElForm>
  </section>
</template>

<style lang="scss" scoped>
.setting-slider {
  width: 100%;
}

.setting-label-with-tip {
  display: flex;
  gap: 4px;
  align-items: center;
}

.setting-label-tip-icon {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  cursor: help;
}
</style>
