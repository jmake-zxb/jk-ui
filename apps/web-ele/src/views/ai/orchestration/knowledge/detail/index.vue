<script setup lang="ts">
import type { Id, KnowledgeRecord } from './components/KnowledgeDetailTypes';

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  ArrowLeft,
  ChatLineRound,
  Files,
  Setting,
  Tickets,
  Tools,
} from '@element-plus/icons-vue';
import {
  ElButton,
  ElIcon,
  ElSkeleton,
  ElTabPane,
  ElTabs,
  ElTag,
} from 'element-plus';

import { getKnowledge } from '#/api/ai/knowledge';

import DocumentTab from './components/DocumentTab.vue';
import HitTestTab from './components/HitTestTab.vue';
import { idText, textOf } from './components/KnowledgeDetailTypes';
import ProblemTab from './components/ProblemTab.vue';
import SettingTab from './components/SettingTab.vue';
import TermbaseTab from './components/TermbaseTab.vue';

const props = defineProps<{
  folderId?: Id;
  id?: Id;
  tab?: string;
  type?: Id;
}>();

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const detail = ref<KnowledgeRecord>();

const knowledgeId = computed(() => props.id || idText(route.params.id));
const folderId = computed(
  () => props.folderId || idText(route.params.folderId, 'shared'),
);
const knowledgeType = computed(
  () =>
    props.type || idText(route.params.type, textOf(detail.value?.type, 'BASE')),
);
const activeTab = computed({
  get: () => idText(route.params.tab, props.tab || 'document'),
  set: (tab: string) => {
    router.push({
      name: 'KnowledgeDetail',
      params: {
        folderId: folderId.value || 'shared',
        id: knowledgeId.value,
        tab,
        type: knowledgeType.value || detail.value?.type || 'BASE',
      },
    });
  },
});
const title = computed(() => textOf(detail.value?.name, '知识库详情'));
const description = computed(() =>
  textOf(detail.value?.description, '暂无描述'),
);
const normalizedType = computed(() =>
  textOf(detail.value?.type ?? knowledgeType.value, 'BASE'),
);

function typeLabel(type: string) {
  if (type === 'WEB' || type === '1') return 'Web 知识库';
  if (type === 'WORKFLOW' || type === '4') return '工作流知识库';
  return '基础知识库';
}

async function loadDetail() {
  if (!knowledgeId.value) return;
  loading.value = true;
  try {
    detail.value = (await getKnowledge(knowledgeId.value)) as KnowledgeRecord;
  } finally {
    loading.value = false;
  }
}

function backToList() {
  router.push({ name: 'KnowledgeIndex' });
}

function refreshDetail(next: KnowledgeRecord) {
  detail.value = next;
}

watch(knowledgeId, loadDetail);
onMounted(loadDetail);
</script>

<template>
  <Page auto-content-height>
    <section class="knowledge-detail">
      <header class="knowledge-detail__topbar">
        <ElButton :icon="ArrowLeft" @click="backToList">返回</ElButton>
        <ElSkeleton v-if="loading && !detail" animated :rows="2" />
        <div v-else class="knowledge-detail__title">
          <div>
            <h1>{{ title }}</h1>
            <span>{{ description }}</span>
          </div>
          <ElTag effect="plain">{{ typeLabel(normalizedType) }}</ElTag>
        </div>
      </header>

      <ElTabs v-model="activeTab" class="knowledge-detail__tabs">
        <ElTabPane name="document">
          <template #label>
            <span class="tab-label"
              ><ElIcon><Files /></ElIcon>文档</span
            >
          </template>
          <DocumentTab
            :folder-id="folderId"
            :knowledge="detail"
            :knowledge-id="knowledgeId"
            :type="knowledgeType"
          />
        </ElTabPane>
        <ElTabPane name="problem">
          <template #label>
            <span class="tab-label"
              ><ElIcon><ChatLineRound /></ElIcon>问题</span
            >
          </template>
          <ProblemTab
            :folder-id="folderId"
            :knowledge="detail"
            :knowledge-id="knowledgeId"
            :type="knowledgeType"
          />
        </ElTabPane>
        <ElTabPane name="termbase">
          <template #label>
            <span class="tab-label"
              ><ElIcon><Tickets /></ElIcon>术语库</span
            >
          </template>
          <TermbaseTab
            :folder-id="folderId"
            :knowledge="detail"
            :knowledge-id="knowledgeId"
            :type="knowledgeType"
          />
        </ElTabPane>
        <ElTabPane name="hit-test">
          <template #label>
            <span class="tab-label"
              ><ElIcon><Tools /></ElIcon>命中测试</span
            >
          </template>
          <HitTestTab
            :folder-id="folderId"
            :knowledge="detail"
            :knowledge-id="knowledgeId"
            :type="knowledgeType"
          />
        </ElTabPane>
        <ElTabPane name="setting">
          <template #label>
            <span class="tab-label"
              ><ElIcon><Setting /></ElIcon>设置</span
            >
          </template>
          <SettingTab
            :folder-id="folderId"
            :knowledge="detail"
            :knowledge-id="knowledgeId"
            :type="knowledgeType"
            @refresh="refreshDetail"
          />
        </ElTabPane>
      </ElTabs>
    </section>
  </Page>
</template>

<style scoped lang="scss">
.knowledge-detail {
  --kb-space-2: 8px;
  --kb-space-3: 12px;
  --kb-space-4: 16px;
  --kb-border-color: var(--el-border-color-lighter);
  --kb-panel-bg: hsl(var(--card));
  --kb-radius: 6px;

  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--kb-panel-bg);
  border: 1px solid var(--kb-border-color);
  border-radius: var(--kb-radius);
}

.knowledge-detail__topbar {
  display: flex;
  flex-shrink: 0;
  gap: var(--kb-space-4);
  align-items: center;
  padding: var(--kb-space-4) var(--kb-space-4);
  border-bottom: 1px solid var(--kb-border-color);
}

.knowledge-detail__title {
  display: flex;
  flex: 1;
  gap: var(--kb-space-3);
  align-items: flex-start;
  justify-content: space-between;
  min-width: 0;
}

.knowledge-detail__title > div {
  flex: 1;
  min-width: 0;
}

.knowledge-detail__title :deep(.el-tag) {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  margin-top: 2px;
}

.knowledge-detail__title h1 {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--el-font-size-large);
  font-weight: var(--el-font-weight-primary);
  line-height: 28px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.knowledge-detail__title span {
  display: block;
  margin-top: var(--kb-space-1, 4px);
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.knowledge-detail__tabs {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: 0 var(--kb-space-4) var(--kb-space-4);
}

.knowledge-detail__tabs :deep(.el-tabs__header) {
  margin-bottom: var(--kb-space-4);
}

.knowledge-detail__tabs :deep(.el-tabs__item) {
  font-size: var(--el-font-size-base);
  font-weight: 500;
}

.knowledge-detail__tabs :deep(.el-tabs__item.is-active) {
  font-weight: 600;
}

.knowledge-detail__tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
}

.knowledge-detail__tabs :deep(.el-tab-pane) {
  height: 100%;
  min-height: 0;
}

.tab-label {
  display: inline-flex;
  gap: var(--kb-space-2);
  align-items: center;
}

:deep(.knowledge-detail-panel),
:deep(.knowledge-hit-test),
:deep(.knowledge-setting-panel) {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

:deep(.knowledge-detail-panel__header) {
  display: flex;
  flex-shrink: 0;
  gap: var(--kb-space-4);
  align-items: flex-start;
  justify-content: space-between;
  padding: 0 0 var(--kb-space-4);
  margin-bottom: var(--kb-space-4);
  border-bottom: 1px solid var(--kb-border-color);
}

:deep(.knowledge-detail-panel__header > div:first-child) {
  display: grid;
  gap: var(--kb-space-1, 4px);
}

:deep(.knowledge-detail-panel__header h2) {
  margin: 0;
  font-size: var(--el-font-size-large);
  font-weight: var(--el-font-weight-primary);
  line-height: 26px;
  color: var(--el-text-color-primary);
}

:deep(.knowledge-detail-panel__header span) {
  font-size: var(--el-font-size-extra-small);
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

:deep(.knowledge-detail-panel__actions) {
  display: flex;
  flex-wrap: wrap;
  gap: var(--kb-space-2);
  align-items: center;
  justify-content: flex-end;
}

:deep(.knowledge-detail-panel__actions .el-button) {
  color: var(--el-button-text-color);
}

:deep(.knowledge-detail-panel__actions .el-button--primary) {
  color: var(--el-color-white);
}

:deep(.knowledge-detail-table) {
  flex: 1;
  min-height: 0;
}

:deep(.knowledge-detail-table .el-table__row) {
  cursor: pointer;
  transition: background-color var(--el-transition-duration);
}

:deep(.knowledge-detail-panel__footer) {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding-top: var(--kb-space-3);
  margin-top: var(--kb-space-3);
  border-top: 1px solid var(--kb-border-color);
}

:deep(.knowledge-detail-panel__batch) {
  display: flex;
  gap: var(--kb-space-2);
  align-items: center;
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}

:deep(.table-title) {
  display: grid;
  gap: var(--kb-space-1, 4px);
}

:deep(.table-title strong) {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

:deep(.table-title span) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

:deep(.line-clamp-2) {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

:deep(.knowledge-hit-test__main) {
  flex: 1;
  min-height: 0;
  padding: var(--kb-space-4);
  overflow: hidden;
  border: 1px solid var(--kb-border-color);
  border-radius: var(--kb-radius);
}

:deep(.knowledge-hit-test__question) {
  display: flex;
  gap: var(--kb-space-2);
  align-items: center;
  margin-bottom: var(--kb-space-3);
}

:deep(.knowledge-hit-test__scroll) {
  height: calc(100% - 40px);
}

:deep(.hit-card-col) {
  margin-bottom: var(--kb-space-4);
}

:deep(.hit-card) {
  height: 230px;
  padding: var(--kb-space-4);
  background: var(--kb-panel-bg);
  border: 1px solid var(--kb-border-color);
  border-radius: var(--kb-radius);
  transition:
    border-color var(--el-transition-duration),
    box-shadow var(--el-transition-duration);
}

:deep(.hit-card:hover) {
  border-color: var(--el-color-primary-light-5);
  box-shadow: var(--el-box-shadow-light);
}

:deep(.hit-card__header) {
  display: flex;
  gap: var(--kb-space-2);
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--kb-space-3);
}

:deep(.hit-card__header span:first-child) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

:deep(.hit-card p) {
  display: -webkit-box;
  height: 105px;
  margin: 0 0 var(--kb-space-3);
  overflow: hidden;
  -webkit-line-clamp: 5;
  font-size: 14px;
  line-height: 21px;
  color: var(--el-text-color-regular);
  -webkit-box-orient: vertical;
}

:deep(.hit-card footer) {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

:deep(.knowledge-hit-test__operate) {
  display: flex;
  flex-shrink: 0;
  gap: var(--kb-space-2);
  align-items: flex-end;
  padding-top: var(--kb-space-3);
}

:deep(.knowledge-hit-test__operate .el-textarea) {
  flex: 1;
}

:deep(.popover-footer) {
  display: flex;
  gap: var(--kb-space-2);
  justify-content: flex-end;
}

:deep(.knowledge-setting-form) {
  width: min(760px, 100%);
  padding: var(--kb-space-2) 0 var(--kb-space-4);
  overflow: auto;
}

:deep(.knowledge-setting-form h4) {
  margin: var(--kb-space-4) 0 var(--kb-space-3);
  font-size: calc(var(--el-font-size-base) * 1.125);
  font-weight: 600;
  color: var(--el-text-color-primary);
}

:deep(.knowledge-setting-form h4:first-child) {
  margin-top: 0;
}

:deep(.knowledge-type-card) {
  border: 1px solid var(--kb-border-color);
  border-radius: var(--kb-radius);
  transition:
    border-color var(--el-transition-duration),
    box-shadow var(--el-transition-duration);
}

:deep(.knowledge-type-card:hover) {
  border-color: var(--el-color-primary-light-5);
  box-shadow: var(--el-box-shadow-light);
}

:deep(.knowledge-type-card .el-card__body) {
  display: flex;
  gap: var(--kb-space-3);
  align-items: center;
}

:deep(.knowledge-type-card .el-icon) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: var(--kb-radius);
}

:deep(.knowledge-type-card strong),
:deep(.knowledge-type-card span) {
  display: block;
}

:deep(.knowledge-type-card strong) {
  font-size: var(--el-font-size-base);
  font-weight: var(--el-font-weight-primary);
  color: var(--el-text-color-primary);
}

:deep(.knowledge-type-card span) {
  margin-top: var(--kb-space-1, 4px);
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}
</style>
