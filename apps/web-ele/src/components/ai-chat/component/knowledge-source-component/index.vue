<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';

import { ArrowDown, ArrowUp, Document } from '@element-plus/icons-vue';
import {
  ElButton,
  ElCard,
  ElCol,
  ElCollapseTransition,
  ElDialog,
  ElDivider,
  ElIcon,
  ElRow,
  ElScrollbar,
} from 'element-plus';
import { cloneDeep } from 'lodash-es';

import { $t } from '#/locales';
import { arraySort } from '#/utils/array';
import { getFileUrl, getImgUrl } from '#/utils/common';
import { MsgInfo } from '#/utils/message';

import ExecutionDetailContent from './ExecutionDetailContent.vue';
import ParagraphDocumentContent from './ParagraphDocumentContent.vue';
import ParagraphSourceContent from './ParagraphSourceContent.vue';

const props = defineProps({
  data: {
    type: Object,
    default: () => {},
  },
  type: {
    type: String,
    default: '',
  },
  appType: {
    type: String,
    default: '',
  },
  executionIsRightPanel: {
    type: Boolean,
    required: false,
  },
  application: {
    type: Object,
    default: () => {},
  },
});

const emit = defineEmits([
  'openExecutionDetail',
  'openParagraph',
  'openParagraphDocument',
]);
const showPDF = (item: any) => {
  return (
    item.document_name.toLocaleLowerCase().endsWith('.pdf') &&
    item.meta?.source_file_id &&
    props.executionIsRightPanel
  );
};
const dialogVisible = ref(false);
const dialogTitle = ref('');
const currentComponent = shallowRef<any>(null);
const currentChatDetail = ref<any>(null);
const dialogType = ref('');
const inlineDetailExpanded = ref(false);

function handleExecutionDetail(details: any) {
  if (props.type === 'debug-ai-chat') {
    inlineDetailExpanded.value = !inlineDetailExpanded.value;
  } else {
    openExecutionDetail(details);
  }
}

function infoMessage(data: any) {
  if (data?.meta?.allow_download === false) {
    MsgInfo($t('aiChat.noPermissionDownload'));
  } else {
    MsgInfo($t('aiChat.noDocument'));
  }
}
function openParagraph(row: any, id?: string) {
  dialogTitle.value = $t('aiChat.KnowledgeSource.title');
  const obj = cloneDeep(row);
  obj.paragraph_list = id
    ? obj.paragraph_list.filter((v: any) => v.knowledge_id === id)
    : obj.paragraph_list;
  obj.paragraph_list = arraySort(obj.paragraph_list, 'similarity', true);
  if (props.executionIsRightPanel) {
    emit('openParagraph');
    return;
  }
  dialogType.value = '';
  currentComponent.value = ParagraphSourceContent;
  currentChatDetail.value = obj;
  dialogVisible.value = true;
}
function openExecutionDetail(row: any) {
  dialogTitle.value = $t('aiChat.executionDetails.title');
  if (props.executionIsRightPanel) {
    emit('openExecutionDetail');
    return;
  }
  dialogType.value = '';
  currentComponent.value = ExecutionDetailContent;
  currentChatDetail.value = row;
  dialogVisible.value = true;
}
function openParagraphDocument(row: any) {
  if (props.executionIsRightPanel) {
    emit('openParagraphDocument', row);
    return;
  }
  dialogType.value = 'pdfDocument';
  currentComponent.value = ParagraphDocumentContent;
  dialogTitle.value = row.document_name;
  currentChatDetail.value = row;
  dialogVisible.value = true;
}

const uniqueParagraphList = computed(() => {
  const seen = new Set();
  return (
    props.data.paragraph_list?.filter((paragraph: any) => {
      const key = paragraph.document_name.trim();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      // 判断如果 meta 属性不是 {} 需要json解析 转对象
      if (paragraph.meta && typeof paragraph.meta === 'string') {
        paragraph.meta = JSON.parse(paragraph.meta);
        paragraph.source_url = paragraph.meta.source_url;
      }
      return true;
    }) || []
  );
});
</script>
<template>
  <div class="chat-knowledge-source">
    <div
      class="align-center mt-4 flex"
      v-if="
        type === 'log' || type === 'debug-ai-chat'
          ? true
          : application.show_source
      "
    >
      <span class="color-secondary mr-1">{{
        $$t('aiChat.KnowledgeSource.title')
      }}</span>
      <ElDivider direction="vertical" />
      <ElButton type="primary" class="mr-2" link @click="openParagraph(data)">
        <AppIcon icon-name="app-reference-outlined" class="mr-1" />
        {{ $$t('aiChat.KnowledgeSource.referenceParagraph') }}
        {{ data.paragraph_list?.length || 0 }}
      </ElButton>
    </div>

    <div
      class="mt-2"
      v-if="
        type === 'log' || type === 'debug-ai-chat'
          ? true
          : application.show_source
      "
    >
      <ElRow :gutter="8" v-if="uniqueParagraphList?.length">
        <template v-for="(item, index) in uniqueParagraphList" :key="index">
          <ElCol :span="12" class="mb-2">
            <ElCard shadow="never" style="--el-card-padding: 8px">
              <div class="flex-between">
                <div class="align-center flex">
                  <img
                    src="#/assets/fileType/web-link-icon.svg"
                    alt=""
                    width="24"
                    v-if="item?.meta?.source_file_id || item?.meta?.source_url"
                  />
                  <img
                    v-else
                    :src="getImgUrl(item && item?.document_name)"
                    alt=""
                    width="24"
                  />
                  <div
                    class="ellipsis-1 ml-1"
                    :title="item?.document_name"
                    v-if="showPDF(item)"
                    @click="openParagraphDocument(item)"
                  >
                    <p>{{ item && item?.document_name }}</p>
                  </div>
                  <div
                    class="ml-1"
                    v-else-if="
                      item?.meta?.source_file_id || item?.meta?.source_url
                    "
                  >
                    <a
                      :href="
                        getFileUrl(item?.meta?.source_file_id) ||
                        item?.meta?.source_url
                      "
                      target="_blank"
                      class="ellipsis-1"
                      :title="item?.document_name?.trim()"
                    >
                      <span :title="item?.document_name?.trim()">{{
                        item?.document_name
                      }}</span>
                    </a>
                  </div>
                  <div v-else @click="infoMessage(item)">
                    <span
                      class="ellipsis-1 break-all"
                      :title="item?.document_name?.trim()"
                    >
                      {{ item?.document_name?.trim() }}
                    </span>
                  </div>
                </div>
              </div>
            </ElCard>
          </ElCol>
        </template>
      </ElRow>
    </div>

    <div
      v-if="
        type === 'log' || type === 'debug-ai-chat'
          ? true
          : application.show_exec
      "
      class="execution-details color-secondary flex-between mt-3 border-t"
      style="padding-top: 12px; padding-bottom: 8px"
    >
      <div>
        <span class="mr-2">
          {{ $$t('aiChat.KnowledgeSource.consume') }}:
          {{ data?.message_tokens + data?.answer_tokens }}
        </span>
        <span>
          {{ $$t('aiChat.KnowledgeSource.consumeTime') }}:
          {{ data?.run_time?.toFixed(2) }} s</span
        >
      </div>
      <ElButton
        type="primary"
        link
        @click="handleExecutionDetail(data.execution_details)"
        style="padding: 0"
      >
        <ElIcon class="mr-1"><Document /></ElIcon>
        {{ $$t('aiChat.executionDetails.title') }}
        <ElIcon v-if="type === 'debug-ai-chat'" class="ml-1">
          <ArrowUp v-if="inlineDetailExpanded" />
          <ArrowDown v-else />
        </ElIcon>
      </ElButton>
    </div>
    <!-- debug-ai-chat 模式：执行详情内联展示 -->
    <ElCollapseTransition>
      <div
        v-if="
          type === 'debug-ai-chat' &&
          inlineDetailExpanded &&
          data.execution_details
        "
        class="inline-execution-detail mt-2"
      >
        <ExecutionDetailContent
          :detail="data.execution_details"
          :app-type="appType"
        />
      </div>
    </ElCollapseTransition>
    <!-- 知识库引用/执行详情 dialog -->
    <ElDialog
      class="scrollbar-dialog"
      :title="dialogTitle"
      v-model="dialogVisible"
      destroy-on-close
      append-to-body
      align-center
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <template #header="{ titleId, titleClass }">
        <div class="flex-between">
          <span
            class="medium ellipsis"
            style="max-width: 300px"
            :title="dialogTitle"
            :id="titleId"
            :class="titleClass"
          >
            {{ dialogTitle }}
          </span>
          <!-- <div class="flex align-center mr-2" v-if="dialogType === 'pdfDocument'">
            <span class="mr-1">
              <el-button text>
                <el-icon> <Download /> </el-icon>
              </el-button>
            </span>
            <span>
              <el-button text> <app-icon iconName="app-export" size="20" /></el-button>
            </span>
            <el-divider direction="vertical" />
          </div> -->
        </div>
      </template>

      <ElScrollbar>
        <div class="mb-2 p-2" style="max-height: calc(100vh - 260px)">
          <component
            :is="currentComponent"
            :detail="currentChatDetail"
            :app-type="appType"
          />
        </div>
      </ElScrollbar>
    </ElDialog>
  </div>
</template>
<style lang="scss" scoped>
.inline-execution-detail {
  max-height: 400px;
  padding: 8px;
  overflow-y: auto;
  background: var(--el-fill-color-lighter, #f5f7fa);
  border-radius: 4px;
}

@media only screen and (max-width: 420px) {
  .chat-knowledge-source {
    .execution-details {
      display: block;
    }
  }
}
</style>
