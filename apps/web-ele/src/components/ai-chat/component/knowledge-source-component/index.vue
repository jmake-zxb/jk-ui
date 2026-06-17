<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';

import { Document, Link, Tickets } from '@element-plus/icons-vue';
import {
  ElButton,
  ElCard,
  ElCol,
  ElDialog,
  ElDivider,
  ElIcon,
  ElMessage,
  ElRow,
  ElScrollbar,
} from 'element-plus';
import { cloneDeep } from 'lodash-es';

import { getImgUrl } from '#/utils/file-util';

import ExecutionDetailContent from './ExecutionDetailContent.vue';
import ParagraphDocumentContent from './ParagraphDocumentContent.vue';
import ParagraphSourceContent from './ParagraphSourceContent.vue';

const props = withDefaults(
  defineProps<{
    application?: Record<string, any>;
    appType?: string;
    data?: Record<string, any>;
    executionIsRightPanel?: boolean;
    type?: string;
  }>(),
  {
    appType: '',
    application: () => ({}),
    data: () => ({}),
    executionIsRightPanel: false,
    type: '',
  },
);

const emit = defineEmits<{
  openExecutionDetail: [value: unknown];
  openParagraph: [value: Record<string, any>];
  openParagraphDocument: [value: Record<string, any>];
}>();

const dialogVisible = ref(false);
const dialogTitle = ref('');
const currentComponent = shallowRef<unknown>(null);
const currentChatDetail = ref<unknown>(null);

const showSourceBlock = computed(() =>
  props.type === 'log' || props.type === 'debug-ai-chat'
    ? true
    : props.application?.show_source,
);

const showExecBlock = computed(() =>
  props.type === 'log' || props.type === 'debug-ai-chat'
    ? true
    : props.application?.show_exec,
);

function parseMeta(value: unknown): Record<string, any> {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' ? value : {};
}

function documentName(item: Record<string, any>) {
  const meta = parseMeta(item.meta ?? item.metadata);
  return `${
    item.document_name ||
    item.documentName ||
    meta.document_name ||
    meta.source_file_name ||
    item.title ||
    '知识段落'
  }`;
}

function metaOf(item: Record<string, any>): Record<string, any> {
  const meta = parseMeta(item.meta ?? item.metadata);
  return {
    ...meta,
    source_file_id:
      meta.source_file_id ?? meta.sourceFileId ?? item.source_file_id,
    source_url: meta.source_url ?? meta.sourceUrl ?? item.source_url,
  };
}

function getFileUrl(fileId?: number | string) {
  if (!fileId) return '';
  return `/admin/sys-file/details?id=${encodeURIComponent(`${fileId}`)}`;
}

function showPDF(item: Record<string, any>) {
  if (!props.executionIsRightPanel) return false;
  return (
    documentName(item).toLowerCase().endsWith('.pdf') &&
    !!metaOf(item).source_file_id
  );
}

function infoMessage(data: Record<string, any>) {
  if (metaOf(data).allow_download === false)
    ElMessage.info('暂无权限下载该文档');
  else ElMessage.info('暂无可预览文档');
}

function openParagraph(row: Record<string, any>, id?: string) {
  dialogTitle.value = '知识来源';
  const obj = cloneDeep(row);
  const list = Array.isArray(obj.paragraph_list) ? obj.paragraph_list : [];
  obj.paragraph_list = (
    id ? list.filter((v: any) => v.knowledge_id === id) : list
  ).toSorted(
    (a: any, b: any) =>
      Number(b.similarity ?? b.score ?? 0) -
      Number(a.similarity ?? a.score ?? 0),
  );
  if (props.executionIsRightPanel) {
    emit('openParagraph', obj);
    return;
  }
  currentComponent.value = ParagraphSourceContent;
  currentChatDetail.value = obj;
  dialogVisible.value = true;
}

function openExecutionDetail(row: unknown) {
  dialogTitle.value = '执行详情';
  if (props.executionIsRightPanel) {
    emit('openExecutionDetail', row);
    return;
  }
  currentComponent.value = ExecutionDetailContent;
  currentChatDetail.value = row;
  dialogVisible.value = true;
}

function openParagraphDocument(row: Record<string, any>) {
  if (props.executionIsRightPanel) {
    emit('openParagraphDocument', row);
    return;
  }
  currentComponent.value = ParagraphDocumentContent;
  dialogTitle.value = documentName(row);
  currentChatDetail.value = row;
  dialogVisible.value = true;
}

const uniqueParagraphList = computed(() => {
  const seen = new Set<string>();
  const list = Array.isArray(props.data?.paragraph_list)
    ? props.data.paragraph_list
    : [];
  return list.filter((item: Record<string, any>) => {
    const key = documentName(item).trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});

function toFiniteNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

const totalTokens = computed(
  () =>
    toFiniteNumber(props.data?.message_tokens) +
    toFiniteNumber(props.data?.answer_tokens),
);
const runTime = computed(() => {
  const seconds = toFiniteNumber(props.data?.run_time);
  if (seconds < 0.01) {
    return `${Math.round(seconds * 1000)} ms`;
  }
  return `${seconds.toFixed(2)} s`;
});
</script>

<template>
  <div class="chat-knowledge-source">
    <div v-if="showSourceBlock" class="source-title-row">
      <span class="secondary-text">知识来源</span>
      <ElDivider direction="vertical" />
      <ElButton type="primary" link @click="openParagraph(data)">
        <ElIcon class="g-mr-4"><Tickets /></ElIcon>
        引用分段 {{ data.paragraph_list?.length || 0 }}
      </ElButton>
    </div>

    <div v-if="showSourceBlock" class="source-list">
      <ElRow v-if="uniqueParagraphList?.length" :gutter="8">
        <ElCol
          v-for="(item, index) in uniqueParagraphList"
          :key="index"
          :span="12"
          class="g-mb-8"
        >
          <ElCard shadow="never" class="source-card">
            <div class="source-card-inner">
              <ElIcon v-if="metaOf(item).source_url" :size="22">
                <Link />
              </ElIcon>
              <img
                v-else
                :src="getImgUrl(documentName(item))"
                alt=""
                width="24"
              />
              <button
                v-if="showPDF(item)"
                class="doc-link"
                type="button"
                @click="openParagraphDocument(item)"
              >
                {{ documentName(item) }}
              </button>
              <a
                v-else-if="
                  metaOf(item).source_file_id || metaOf(item).source_url
                "
                class="doc-link"
                :href="
                  getFileUrl(metaOf(item).source_file_id) ||
                  metaOf(item).source_url
                "
                target="_blank"
                rel="noopener noreferrer"
                :title="documentName(item).trim()"
              >
                {{ documentName(item) }}
              </a>
              <button
                v-else
                class="doc-link"
                type="button"
                @click="infoMessage(item)"
              >
                {{ documentName(item) }}
              </button>
            </div>
          </ElCard>
        </ElCol>
      </ElRow>
    </div>

    <div v-if="showExecBlock" class="execution-details">
      <div class="execution-summary">
        <span class="g-mr-8">消耗 tokens: {{ totalTokens }}</span>
        <span>耗时: {{ runTime }}</span>
      </div>
      <ElButton
        class="execution-detail-button"
        type="primary"
        link
        @click="openExecutionDetail(data)"
      >
        <ElIcon class="g-mr-4"><Document /></ElIcon>
        执行详情
      </ElButton>
    </div>

    <ElDialog
      v-model="dialogVisible"
      append-to-body
      destroy-on-close
      class="scrollbar-dialog"
      :title="dialogTitle"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <ElScrollbar>
        <div class="dialog-content">
          <component
            :is="currentComponent"
            :app-type="appType"
            :detail="currentChatDetail"
          />
        </div>
      </ElScrollbar>
    </ElDialog>
  </div>
</template>

<style scoped>
.source-title-row,
.execution-details,
.source-card-inner {
  display: flex;
  align-items: center;
}

.source-title-row {
  margin-top: 16px;
}

.secondary-text {
  color: var(--el-text-color-secondary);
}

.source-list {
  margin-top: 8px;
}

.source-card :deep(.el-card__body) {
  padding: 8px;
}

.source-card-inner {
  gap: 6px;
  min-width: 0;
}

.doc-link {
  min-width: 0;
  padding: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--el-color-primary);
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.execution-details {
  justify-content: space-between;
  padding-top: 12px;
  padding-bottom: 8px;
  margin-top: 12px;
  color: var(--el-text-color-secondary);
  border-top: 1px solid var(--el-border-color-lighter);
}

.execution-summary {
  display: flex;
  flex-wrap: wrap;
  row-gap: 4px;
  min-width: 0;
}

.execution-detail-button {
  padding: 0;
}

.dialog-content {
  max-height: calc(100vh - 260px);
  padding: 8px;
}

.g-mr-4 {
  margin-right: 4px;
}

.g-mr-8 {
  margin-right: 8px;
}

.g-mb-8 {
  margin-bottom: 8px;
}

@media only screen and (max-width: 420px) {
  .execution-details {
    display: block;
  }
}
</style>
