<script setup lang="ts">
import type { Id, JsonRecord, TriggerRecord } from './trigger-utils';

import type { TriggerRequest } from '#/api/ai/triggers';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';

import { confirm, Page } from '@vben/common-ui';

import {
  Bell,
  Clock,
  CopyDocument,
  Delete,
  EditPen,
  Link,
  Plus,
  Refresh,
  Search,
  SwitchButton,
  Tickets,
  VideoPlay,
} from '@element-plus/icons-vue';
import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElMessage,
  ElOption,
  ElPagination,
  ElPopover,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag,
  ElTooltip,
} from 'element-plus';

import {
  batchActivateTriggers,
  batchDeleteTriggers,
  deleteTrigger,
  pageTriggers,
  testRunTrigger,
  toggleTrigger,
  webhookTriggerUrl,
} from '#/api/ai/triggers';

import { prettyJson, recordsOf, totalOf } from '../utils';
import TriggerTaskRecordDrawer from './execution-record/TriggerTaskRecordDrawer.vue';
import {
  normalizeTriggerRecord,
  scheduleLabel,
  sourceDisplayType,
  textValue,
  triggerTypeLabel,
} from './trigger-utils';
import TriggerDrawer from './TriggerDrawer.vue';

type SearchType = 'create_user' | 'is_active' | 'name' | 'task' | 'type';

const route = useRoute();

const workspaceId = computed(() => {
  const raw = route.query.workspaceId || route.query.workspace_id;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? String(value) : 'default';
});

const queryApplicationId = computed(() => {
  const raw = route.query.applicationId || route.query.application_id;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? String(value) : undefined;
});

const loading = ref(false);
const selection = ref<TriggerRecord[]>([]);
const triggerRows = ref<TriggerRecord[]>([]);
const activeTrigger = ref<TriggerRecord>();
const testOpen = ref(false);
const testLoading = ref(false);
const testInput = ref('{\n  "source": "manual"\n}');
const testResult = ref<unknown>();

const triggerDrawerRef = ref<InstanceType<typeof TriggerDrawer>>();
const recordDrawerRef = ref<InstanceType<typeof TriggerTaskRecordDrawer>>();

const pageState = reactive({
  page: 1,
  size: 20,
  total: 0,
});

const search = reactive<Record<SearchType, any>>({
  create_user: '',
  is_active: '',
  name: '',
  task: '',
  type: '',
});
const searchType = ref<SearchType>('name');

function currentQuery() {
  const params: JsonRecord = {
    page: pageState.page,
    size: pageState.size,
    workspaceId: workspaceId.value,
    workspace_id: workspaceId.value,
  };
  if (queryApplicationId.value) {
    params.applicationId = queryApplicationId.value;
  }
  const value = search[searchType.value];
  if (value !== '' && value !== undefined && value !== null) {
    params[searchType.value] =
      searchType.value === 'is_active' ? value === 'true' : value;
  }
  return params;
}

async function loadTriggers(reset = false) {
  if (reset) pageState.page = 1;
  loading.value = true;
  try {
    const data = await pageTriggers(currentQuery());
    triggerRows.value = recordsOf<TriggerRecord>(data).map((item) =>
      normalizeTriggerRecord(item),
    );
    pageState.total = totalOf(data);
  } finally {
    loading.value = false;
  }
}

function searchTypeChange() {
  Object.assign(search, {
    create_user: '',
    is_active: '',
    name: '',
    task: '',
    type: '',
  });
}

function setSelection(rows: TriggerRecord[]) {
  selection.value = rows;
}

function openDrawer(row?: TriggerRecord) {
  triggerDrawerRef.value?.open(row, {
    applicationId: queryApplicationId.value,
    workspaceId: workspaceId.value,
  });
}

function openRecords(row: TriggerRecord) {
  recordDrawerRef.value?.open(row);
}

async function toggleRow(row: TriggerRecord) {
  await toggleTrigger(row.id, row.is_active === false);
  await loadTriggers();
}

function removeTrigger(row: TriggerRecord) {
  confirm(`确认删除触发器 ${row.name || row.id}？`).then(async () => {
    await deleteTrigger(row.id);
    ElMessage.success('删除成功');
    await loadTriggers();
  });
}

async function batchEnable(enabled: boolean) {
  const ids = selection.value.map((item) => item.id);
  if (ids.length === 0) return;
  await batchActivateTriggers({
    idList: ids,
    id_list: ids,
    isActive: enabled,
    is_active: enabled,
  });
  ElMessage.success(enabled ? '已启用' : '已停用');
  await loadTriggers();
}

function batchRemove() {
  const ids = selection.value.map((item) => item.id);
  if (ids.length === 0) return;
  confirm(`确认删除选中的 ${ids.length} 个触发器？`).then(async () => {
    await batchDeleteTriggers(ids);
    ElMessage.success('删除成功');
    selection.value = [];
    await loadTriggers();
  });
}

function openTest(row: TriggerRecord) {
  activeTrigger.value = row;
  testInput.value = '{\n  "source": "manual"\n}';
  testResult.value = undefined;
  testOpen.value = true;
}

async function runTest() {
  const trigger = activeTrigger.value;
  if (!trigger?.id) return;
  testLoading.value = true;
  try {
    const data: TriggerRequest = {
      inputJson: testInput.value,
      message: '触发器测试',
    };
    testResult.value = await testRunTrigger(trigger.id, data);
    ElMessage.success('测试执行完成');
  } finally {
    testLoading.value = false;
  }
}

function absoluteWebhookUrl(id: Id) {
  return `${window.location.origin}${webhookTriggerUrl(id)}`;
}

async function copyText(text: string) {
  if (!text) return;
  await navigator.clipboard.writeText(text);
  ElMessage.success('已复制');
}

function taskTypeCount(row: TriggerRecord, type: string) {
  return (row.trigger_task || []).filter((item) => item.source_type === type)
    .length;
}

function taskName(task: JsonRecord) {
  return textValue(task.name || task.source_name || task.source_id, '-');
}

onMounted(() => {
  loadTriggers();
});
</script>

<template>
  <Page auto-content-height>
    <div class="trigger-page">
      <header class="trigger-toolbar">
        <div class="toolbar-left">
          <ElButton type="primary" :icon="Plus" @click="openDrawer()">
            新建触发器
          </ElButton>
          <ElButton
            :disabled="selection.length === 0"
            :icon="SwitchButton"
            @click="batchEnable(true)"
          >
            启用
          </ElButton>
          <ElButton
            :disabled="selection.length === 0"
            :icon="SwitchButton"
            @click="batchEnable(false)"
          >
            停用
          </ElButton>
          <ElButton
            :disabled="selection.length === 0"
            :icon="Delete"
            plain
            type="danger"
            @click="batchRemove"
          >
            删除
          </ElButton>
        </div>
        <div class="toolbar-right">
          <ElSelect
            v-model="searchType"
            class="search-type"
            @change="searchTypeChange"
          >
            <ElOption label="名称" value="name" />
            <ElOption label="类型" value="type" />
            <ElOption label="任务" value="task" />
            <ElOption label="状态" value="is_active" />
            <ElOption label="创建人" value="create_user" />
          </ElSelect>
          <ElInput
            v-if="searchType === 'name' || searchType === 'task'"
            v-model="search[searchType]"
            class="search-input"
            clearable
            placeholder="搜索"
            @clear="loadTriggers(true)"
            @keyup.enter="loadTriggers(true)"
          >
            <template #prefix><Search /></template>
          </ElInput>
          <ElSelect
            v-else-if="searchType === 'type'"
            v-model="search.type"
            class="search-input"
            clearable
            @change="loadTriggers(true)"
          >
            <ElOption label="定时" value="SCHEDULED" />
            <ElOption label="事件" value="EVENT" />
          </ElSelect>
          <ElSelect
            v-else-if="searchType === 'is_active'"
            v-model="search.is_active"
            class="search-input"
            clearable
            @change="loadTriggers(true)"
          >
            <ElOption label="启用" value="true" />
            <ElOption label="停用" value="false" />
          </ElSelect>
          <ElInput
            v-else
            v-model="search.create_user"
            class="search-input"
            clearable
            placeholder="创建人 ID"
            @clear="loadTriggers(true)"
            @keyup.enter="loadTriggers(true)"
          />
          <ElButton :icon="Search" @click="loadTriggers(true)">查询</ElButton>
          <ElButton :icon="Refresh" @click="loadTriggers()">刷新</ElButton>
        </div>
      </header>

      <ElTable
        v-loading="loading"
        :data="triggerRows"
        class="trigger-table"
        height="100%"
        row-key="id"
        @selection-change="setSelection"
      >
        <ElTableColumn type="selection" width="46" />
        <ElTableColumn label="名称" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="name-cell">
              <ElIcon
                class="name-icon"
                :class="row.trigger_type === 'EVENT' ? 'event' : ''"
              >
                <Bell v-if="row.trigger_type === 'EVENT'" />
                <Clock v-else />
              </ElIcon>
              <div>
                <div class="name-title">{{ row.name || '-' }}</div>
                <div class="name-desc">{{ row.desc || '无描述' }}</div>
              </div>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="类型" width="110">
          <template #default="{ row }">
            <ElTag
              :type="row.trigger_type === 'EVENT' ? 'warning' : 'primary'"
              size="small"
            >
              {{ triggerTypeLabel(row.trigger_type) }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="触发周期" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.trigger_type === 'SCHEDULED'">
              {{ scheduleLabel(row.trigger_setting) }}
            </span>
            <span v-else class="mono-line">{{
              absoluteWebhookUrl(row.id)
            }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="执行任务" width="180">
          <template #default="{ row }">
            <ElPopover placement="top-start" trigger="hover" width="260">
              <template #reference>
                <div class="task-tags">
                  <ElTag v-if="taskTypeCount(row, 'APPLICATION')" size="small">
                    应用 {{ taskTypeCount(row, 'APPLICATION') }}
                  </ElTag>
                  <ElTag
                    v-if="taskTypeCount(row, 'TOOL')"
                    size="small"
                    type="success"
                  >
                    工具 {{ taskTypeCount(row, 'TOOL') }}
                  </ElTag>
                </div>
              </template>
              <div class="popover-list">
                <div
                  v-for="task in row.trigger_task"
                  :key="task.id || `${task.source_type}-${task.source_id}`"
                >
                  <b>{{ sourceDisplayType(task.source_type || task.type) }}</b>
                  <span>{{ taskName(task) }}</span>
                </div>
              </div>
            </ElPopover>
          </template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="110">
          <template #default="{ row }">
            <ElSwitch
              :model-value="row.is_active !== false"
              active-text="启"
              inactive-text="停"
              inline-prompt
              @change="toggleRow(row)"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn prop="create_user" label="创建人" width="130" />
        <ElTableColumn prop="create_time" label="创建时间" width="180" />
        <ElTableColumn label="操作" fixed="right" width="230">
          <template #default="{ row }">
            <ElTooltip content="编辑" placement="top">
              <ElButton
                link
                type="primary"
                :icon="EditPen"
                @click="openDrawer(row)"
              />
            </ElTooltip>
            <ElTooltip content="测试运行" placement="top">
              <ElButton
                link
                type="primary"
                :icon="VideoPlay"
                @click="openTest(row)"
              />
            </ElTooltip>
            <ElTooltip content="执行记录" placement="top">
              <ElButton
                link
                type="primary"
                :icon="Tickets"
                @click="openRecords(row)"
              />
            </ElTooltip>
            <ElTooltip
              v-if="row.trigger_type === 'EVENT'"
              content="复制 Webhook"
              placement="top"
            >
              <ElButton
                link
                type="primary"
                :icon="Link"
                @click="copyText(absoluteWebhookUrl(row.id))"
              />
            </ElTooltip>
            <ElTooltip content="删除" placement="top">
              <ElButton
                link
                type="danger"
                :icon="Delete"
                @click="removeTrigger(row)"
              />
            </ElTooltip>
          </template>
        </ElTableColumn>
      </ElTable>

      <footer class="pagination-footer">
        <ElPagination
          v-model:current-page="pageState.page"
          v-model:page-size="pageState.size"
          :page-sizes="[10, 20, 50, 100]"
          :total="pageState.total"
          layout="total, sizes, prev, pager, next"
          @current-change="loadTriggers()"
          @size-change="loadTriggers(true)"
        />
      </footer>

      <TriggerDrawer
        ref="triggerDrawerRef"
        :workspace-id="workspaceId"
        @refresh="loadTriggers"
      />
      <TriggerTaskRecordDrawer ref="recordDrawerRef" />

      <ElDialog v-model="testOpen" title="测试运行" width="680px">
        <ElForm label-position="top">
          <ElFormItem label="触发器">
            <ElInput :model-value="activeTrigger?.name || ''" disabled />
          </ElFormItem>
          <ElFormItem
            v-if="activeTrigger?.trigger_type === 'EVENT'"
            label="Webhook"
          >
            <div class="copy-input">
              <ElInput
                :model-value="
                  activeTrigger?.id ? absoluteWebhookUrl(activeTrigger.id) : ''
                "
                readonly
              />
              <ElButton
                :icon="CopyDocument"
                @click="
                  copyText(
                    activeTrigger?.id
                      ? absoluteWebhookUrl(activeTrigger.id)
                      : '',
                  )
                "
              />
            </div>
          </ElFormItem>
          <ElFormItem label="输入 JSON">
            <ElInput v-model="testInput" type="textarea" :rows="7" />
          </ElFormItem>
          <ElFormItem label="执行结果">
            <pre class="result-box">{{
              prettyJson(testResult, '暂无测试结果')
            }}</pre>
          </ElFormItem>
        </ElForm>
        <template #footer>
          <ElButton @click="testOpen = false">关闭</ElButton>
          <ElButton type="primary" :loading="testLoading" @click="runTest">
            测试运行
          </ElButton>
        </template>
      </ElDialog>
    </div>
  </Page>
</template>

<style scoped lang="scss">
.trigger-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.trigger-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  gap: 8px;
  align-items: center;
}

.search-type {
  width: 112px;
}

.search-input {
  width: 240px;
}

.trigger-table {
  flex: 1;
  min-height: 0;
}

.pagination-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
}

.name-cell {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.name-icon {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 6px;
}

.name-icon.event {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
}

.name-title,
.name-desc {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name-desc {
  max-width: 260px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.mono-line {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: nowrap;
}

.task-tags,
.copy-input {
  display: flex;
  gap: 8px;
  align-items: center;
}

.copy-input {
  width: 100%;
}

.copy-input .el-input {
  flex: 1;
}

.popover-list {
  display: grid;
  gap: 8px;
}

.popover-list div {
  display: flex;
  gap: 8px;
  min-width: 0;
}

.result-box {
  width: 100%;
  min-height: 120px;
  max-height: 260px;
  padding: 10px;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
</style>
