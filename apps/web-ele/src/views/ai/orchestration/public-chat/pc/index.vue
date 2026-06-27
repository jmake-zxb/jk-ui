<script setup lang="ts">
import type { PublicChatTemplateProps } from '../types';

import { computed, nextTick, onMounted, provide, ref } from 'vue';

import {
  ArrowLeftBold,
  ArrowRightBold,
  Close,
  Document,
} from '@element-plus/icons-vue';
import { ElButton, ElIcon, ElScrollbar } from 'element-plus';
import { cloneDeep } from 'lodash-es';

import {
  getPublicChatRecordDetail,
  pagePublicTokenChatRecords,
  pagePublicTokenChats,
} from '#/api/ai/public';
import ExecutionDetailContent from '#/components/ai-chat/component/knowledge-source-component/ExecutionDetailContent.vue';
import ParagraphDocumentContent from '#/components/ai-chat/component/knowledge-source-component/ParagraphDocumentContent.vue';
import ParagraphSourceContent from '#/components/ai-chat/component/knowledge-source-component/ParagraphSourceContent.vue';
import AiChat from '#/components/ai-chat/index.vue';

import {
  getPublicChatBackgroundStyle,
  getPublicChatThemeStyle,
} from '../utils';
import HistoryPanel from './HistoryPanel.vue';

const props = defineProps<PublicChatTemplateProps>();

const AiChatRef = ref();
const loading = ref(false);
const left_loading = ref(false);
const isPcCollapse = ref(false);
const showSelection = ref(false);

const applicationDetail = computed({
  get: () => props.application_profile,
  set: () => {},
});

const applicationAvailable = computed(() => props.applicationAvailable ?? true);
const publicToken = computed(() => props.publicToken);
const publicInputJson = computed(() => props.publicInputJson);

// --- Theme ---
const shellStyle = computed(() =>
  applicationDetail.value
    ? getPublicChatThemeStyle(applicationDetail.value)
    : {},
);

const backgroundStyle = computed(() =>
  applicationDetail.value
    ? getPublicChatBackgroundStyle(applicationDetail.value)
    : {},
);

// --- History ---
const chatLogData = ref<any[]>([]);
const currentChatId = ref('new');
const currentChatName = ref('新对话');

const chatLogPagination = ref({
  total: 0,
  page_size: 20,
  current_page: 1,
});

const paginationConfig = ref({
  current_page: 1,
  page_size: 20,
  total: 0,
});

const currentRecordList = ref<any[]>([]);

const showHistory = computed(
  () => applicationDetail.value?.show_history !== false,
);

provide('scrollData', loadInfiniteScroll);
provide('chatLogPagination', () => chatLogPagination);

// --- History functions ---
async function getChatLog(refresh?: boolean) {
  if (!publicToken.value) return;
  left_loading.value = true;
  try {
    const res = await pagePublicTokenChats(publicToken.value, {
      current: chatLogPagination.value.current_page,
      size: chatLogPagination.value.page_size,
    });
    const data = res?.data ?? res;
    let records: unknown[] = [];
    if (Array.isArray(data?.records)) {
      records = data.records;
    } else if (Array.isArray(data)) {
      records = data;
    }
    chatLogPagination.value.total = data?.total || Math.max(records.length, 0);
    chatLogData.value = [...chatLogData.value, ...records];
    if (refresh) {
      currentChatName.value =
        chatLogData.value?.[0]?.abstract ||
        chatLogData.value?.[0]?.title ||
        '新对话';
    } else {
      paginationConfig.value.current_page = 1;
      paginationConfig.value.total = 0;
      currentRecordList.value = [];
      currentChatId.value = 'new';
      currentChatName.value = '新对话';
    }
  } catch {
    chatLogData.value = [];
  } finally {
    left_loading.value = false;
  }
}

function loadInfiniteScroll() {
  getChatLog(true);
}

async function getChatRecord() {
  if (!publicToken.value || currentChatId.value === 'new') return;
  loading.value = true;
  try {
    const res = await pagePublicTokenChatRecords(
      publicToken.value,
      currentChatId.value,
      {
        current: paginationConfig.value.current_page,
        size: paginationConfig.value.page_size,
      },
    );
    const data = res?.data ?? res;
    paginationConfig.value.total = data?.total || 0;
    const list = (Array.isArray(data?.records) ? data.records : []).map(
      (v: any) => ({
        ...v,
        write_ed: true,
        record_id: v.id || v.record_id,
      }),
    );
    currentRecordList.value = [...list, ...currentRecordList.value].toSorted(
      (a: any, b: any) =>
        (a.create_time || '').localeCompare(b.create_time || ''),
    );
    if (paginationConfig.value.current_page === 1) {
      nextTick(() => {
        AiChatRef.value?.setScrollBottom?.();
      });
    }
  } catch {
    // ignore
  } finally {
    loading.value = false;
  }
}

function handleScroll(event: any) {
  if (
    currentChatId.value !== 'new' &&
    event.scrollTop === 0 &&
    paginationConfig.value.total > currentRecordList.value.length
  ) {
    const history_height = event.dialogScrollbar?.offsetHeight || 0;
    paginationConfig.value.current_page += 1;
    getChatRecord().then(() => {
      event.scrollDiv?.setScrollTop?.(
        event.dialogScrollbar?.offsetHeight - history_height,
      );
    });
  }
}

function newChat() {
  showSelection.value = false;
  if (chatLogData.value.some((v) => v.id === 'new')) {
    paginationConfig.value.current_page = 1;
    paginationConfig.value.total = 0;
    currentRecordList.value = [];
  } else {
    paginationConfig.value.current_page = 1;
    paginationConfig.value.total = 0;
    currentRecordList.value = [];
    chatLogData.value.unshift({ id: 'new', abstract: '新对话' });
  }
  closeExecutionDetail();
  currentChatId.value = 'new';
  currentChatName.value = '新对话';
}

function clickListHandle(item: any) {
  if (item.id !== currentChatId.value) {
    showSelection.value = false;
    paginationConfig.value.current_page = 1;
    paginationConfig.value.total = 0;
    currentRecordList.value = [];
    currentChatId.value = item.id;
    currentChatName.value = item.abstract || item.title || '新对话';
    closeExecutionDetail();
    if (currentChatId.value !== 'new') {
      getChatRecord();
    }
  }
}

function deleteLog(row: any) {
  // TODO: call delete API when available
  if (currentChatId.value === row.id) {
    currentChatId.value = 'new';
    currentChatName.value = '新对话';
    paginationConfig.value.current_page = 1;
    paginationConfig.value.total = 0;
    currentRecordList.value = [];
  }
  chatLogData.value = chatLogData.value.filter((item) => item.id !== row.id);
}

function clearChat() {
  // TODO: call clear API when available
  currentChatId.value = 'new';
  currentChatName.value = '新对话';
  paginationConfig.value.current_page = 1;
  paginationConfig.value.total = 0;
  currentRecordList.value = [];
  chatLogPagination.value.current_page = 1;
  chatLogData.value = [];
  getChatLog();
}

function refreshFieldTitle(chatId: string, abstract: string) {
  const find = chatLogData.value.find((item: any) => item.id === chatId);
  if (find) {
    find.abstract = abstract;
  }
}

function refresh(id: string) {
  currentChatId.value = id;
  chatLogPagination.value.current_page = 1;
  chatLogData.value = [];
  getChatLog(true);
}

// --- Share ---
function clickShareHandle() {
  showSelection.value = true;
}

// --- Right panel ---
type RightPanelType =
  | ''
  | 'executionDetail'
  | 'knowledgeSource'
  | 'paragraphDocument';

const rightPanelSize = ref(0);
const rightPanelTitle = ref('');
const rightPanelType = ref<RightPanelType>('');
const rightPanelLoading = ref(false);
const executionDetail = ref<any[]>([]);
const rightPanelDetail = ref<any>();

async function openExecutionDetail(row: any) {
  rightPanelSize.value = 400;
  rightPanelTitle.value = '执行详情';
  rightPanelType.value = 'executionDetail';
  if (row.execution_details) {
    executionDetail.value = cloneDeep(row.execution_details);
  } else {
    rightPanelLoading.value = true;
    try {
      const recordId = row.record_id || row.id;
      if (recordId && publicToken.value) {
        const res = await getPublicChatRecordDetail(
          publicToken.value,
          recordId,
        );
        const data = res?.data ?? res;
        executionDetail.value = cloneDeep(data?.execution_details || []);
      }
    } catch (error) {
      executionDetail.value = [];
      console.error('[openExecutionDetail] failed to fetch details:', error);
    } finally {
      rightPanelLoading.value = false;
    }
  }
}

async function openKnowledgeSource(row: any) {
  rightPanelTitle.value = '知识来源';
  rightPanelType.value = 'knowledgeSource';
  rightPanelDetail.value = row;
  rightPanelSize.value = 400;
}

function openParagraphDocument(detail: any, row: any) {
  rightPanelTitle.value = row.document_name || '文档详情';
  rightPanelType.value = 'paragraphDocument';
  rightPanelSize.value = 400;
  rightPanelDetail.value = row;
}

function closeExecutionDetail() {
  rightPanelSize.value = 0;
}

onMounted(() => {
  getChatLog();
});
</script>

<template>
  <div
    v-if="applicationDetail"
    class="chat-pc"
    :class="{ hideLeft: isPcCollapse, openLeft: !isPcCollapse }"
    v-loading="loading"
    :style="shellStyle"
  >
    <div class="flex h-full w-full">
      <div class="chat-pc__left">
        <HistoryPanel
          :application-detail="applicationDetail"
          :chat-log-data="chatLogData"
          :chat-loading="AiChatRef?.loading"
          :left-loading="left_loading"
          :current-chat-id="currentChatId"
          :is-pc-collapse="isPcCollapse"
          :show-history="showHistory"
          @new-chat="newChat"
          @click-log="clickListHandle"
          @delete-log="deleteLog"
          @clear-chat="clearChat"
          @click-share="clickShareHandle"
          @edit-log-title="(row) => refreshFieldTitle(row.id, row.abstract)"
        />
        <ElButton
          class="pc-collapse cursor"
          circle
          @click="isPcCollapse = !isPcCollapse"
        >
          <ElIcon>
            <ArrowRightBold v-if="isPcCollapse" />
            <ArrowLeftBold v-else />
          </ElIcon>
        </ElButton>
      </div>
      <div
        class="chat-pc__right chat-background"
        :style="{
          ...backgroundStyle,
          '--execution-detail-panel-width': `${rightPanelSize}px`,
        }"
      >
        <div
          style="
            flex: 1;
            width: calc(100% - var(--execution-detail-panel-width));
          "
        >
          <div class="p-16-24 flex-between">
            <h4 class="ellipsis-1" style="width: 66%; font-size: 14px">
              {{ currentChatName }}
            </h4>
          </div>
          <div class="right-height chat-width">
            <AiChat
              ref="AiChatRef"
              v-model:application-details="applicationDetail"
              :available="applicationAvailable"
              type="ai-chat"
              :app-id="applicationDetail?.id"
              :record="currentRecordList"
              :chat-id="currentChatId"
              :execution-is-right-panel="true"
              :public-input-json="publicInputJson"
              :public-token="publicToken"
              @refresh="refresh"
              @scroll="handleScroll"
              @open-execution-detail="openExecutionDetail"
              @open-paragraph="openKnowledgeSource"
              @open-paragraph-document="openParagraphDocument"
              v-model:selection="showSelection"
            />
          </div>
        </div>
        <div class="execution-detail-panel" :resizable="false" collapsible>
          <div class="flex-between border-b p-16">
            <h4
              class="medium ellipsis"
              style="max-width: 300px; font-size: 14px"
              :title="rightPanelTitle"
            >
              {{ rightPanelTitle }}
            </h4>

            <div class="align-center flex">
              <span v-if="rightPanelType === 'paragraphDocument'" class="mr-4">
                <a
                  :href="
                    rightPanelDetail?.meta?.source_file_id
                      ? `/admin/sys-file/details?id=${rightPanelDetail.meta.source_file_id}`
                      : rightPanelDetail?.meta?.source_url
                  "
                  target="_blank"
                  class="ellipsis-1"
                  :title="rightPanelDetail?.document_name?.trim()"
                >
                  <ElButton text>
                    <ElIcon><Document /></ElIcon>
                  </ElButton>
                </a>
              </span>
              <span>
                <ElButton text @click="closeExecutionDetail">
                  <ElIcon size="20"><Close /></ElIcon>
                </ElButton>
              </span>
            </div>
          </div>

          <div
            class="execution-detail-content mb-8"
            v-loading="rightPanelLoading"
          >
            <ElScrollbar>
              <ParagraphSourceContent
                v-if="rightPanelType === 'knowledgeSource'"
                :detail="rightPanelDetail"
              />
              <ExecutionDetailContent
                v-if="rightPanelType === 'executionDetail'"
                :detail="executionDetail"
                :app-type="applicationDetail?.type"
              />
              <ParagraphDocumentContent
                v-if="rightPanelType === 'paragraphDocument'"
                :detail="rightPanelDetail"
              />
            </ElScrollbar>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.chat-pc {
  height: 100%;
  overflow: hidden;
  background: var(--el-bg-color-page);

  &__left {
    position: relative;
    z-index: 11;

    .pc-collapse {
      position: absolute;
      top: 20px;
      right: -13px;
      z-index: 1;
      width: 24px;
      height: 24px;
      box-shadow: 0 5px 10px 0 rgb(var(--el-text-color-primary-rgb), 0.1);
    }
  }

  &__right {
    --execution-detail-panel-width: 400px;

    position: relative;
    box-sizing: border-box;
    display: flex;
    flex: 1;
    width: calc(100vw - 280px);
    overflow: hidden;

    .right-height {
      height: calc(100vh - 60px);
    }

    :deep(.execution-detail-panel) {
      width: var(--execution-detail-panel-width, 400px);
      height: 100%;
      overflow: hidden;
      background: var(--el-bg-color);
      transition: width 0.4s;

      .execution-detail-content {
        flex: 1;
        height: calc(100% - 45px);
        overflow: hidden;

        .execution-details {
          padding: 16px;
          word-break: break-all;
        }
      }
    }
  }
}

.chat-background {
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
}

.flex {
  display: flex;
}

.h-full {
  height: 100%;
}

.w-full {
  width: 100%;
}

.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.p-16 {
  padding: 16px;
}

.p-16-24 {
  padding: 16px 24px;
}

.mb-8 {
  margin-bottom: 8px;
}

.mr-4 {
  margin-right: 4px;
}

.border-b {
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.medium {
  font-weight: 500;
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ellipsis-1 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cursor {
  cursor: pointer;
}

.align-center {
  align-items: center;
}

.chat-width {
  max-width: 80%;
  margin: 0 auto;
}
</style>
