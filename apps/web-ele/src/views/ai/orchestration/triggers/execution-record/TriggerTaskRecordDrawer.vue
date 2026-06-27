<script setup lang="ts">
import type { JsonRecord, TriggerRecord } from '../trigger-utils';

import { computed, reactive, ref } from 'vue';

import { Search } from '@element-plus/icons-vue';
import {
  ElButton,
  ElDrawer,
  ElInput,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';

import { pageTriggerRecords } from '#/api/ai/triggers';

import { recordsOf, statusType, totalOf } from '../../utils';
import {
  recordRunTime,
  sourceDisplayType,
  statusLabel,
} from '../trigger-utils';
import ExecutionDetailDrawer from './ExecutionDetailDrawer.vue';

type RecordSearchType = 'name' | 'source_type' | 'state';

const visible = ref(false);
const loading = ref(false);
const activeTrigger = ref<TriggerRecord>();
const rows = ref<JsonRecord[]>([]);
const currentRecord = ref<JsonRecord>();
const detailDrawerRef = ref<InstanceType<typeof ExecutionDetailDrawer>>();

const pageState = reactive({
  page: 1,
  size: 20,
  total: 0,
});
const searchType = ref<RecordSearchType>('name');
const search = reactive<Record<RecordSearchType, string>>({
  name: '',
  source_type: '',
  state: '',
});

const preDisabled = computed(() => {
  const index = rows.value.findIndex(
    (item) => item.id === currentRecord.value?.id,
  );
  return index <= 0 && pageState.page === 1;
});
const nextDisabled = computed(() => {
  const index = rows.value.findIndex(
    (item) => item.id === currentRecord.value?.id,
  );
  return (
    index >= rows.value.length - 1 &&
    pageState.page * pageState.size >= pageState.total
  );
});

function open(trigger: TriggerRecord) {
  activeTrigger.value = trigger;
  pageState.page = 1;
  visible.value = true;
  loadRecords();
}

function close() {
  visible.value = false;
  activeTrigger.value = undefined;
  rows.value = [];
  currentRecord.value = undefined;
}

async function loadRecords() {
  const trigger = activeTrigger.value;
  if (!trigger?.id) return;
  loading.value = true;
  try {
    const params: JsonRecord = {
      page: pageState.page,
      size: pageState.size,
    };
    const value = search[searchType.value];
    if (value) params[searchType.value] = value;
    const data = await pageTriggerRecords(trigger.id, params);
    rows.value = recordsOf<JsonRecord>(data);
    pageState.total = totalOf(data);
  } finally {
    loading.value = false;
  }
}

function searchTypeChange() {
  Object.assign(search, {
    name: '',
    source_type: '',
    state: '',
  });
}

function openDetail(row: JsonRecord) {
  currentRecord.value = row;
  detailDrawerRef.value?.open(row);
}

async function preRecord() {
  const index = rows.value.findIndex(
    (item) => item.id === currentRecord.value?.id,
  );
  if (index > 0) {
    currentRecord.value = rows.value[index - 1];
    return currentRecord.value;
  }
  if (pageState.page <= 1) return undefined;
  pageState.page -= 1;
  await loadRecords();
  currentRecord.value = rows.value[rows.value.length - 1];
  return currentRecord.value;
}

async function nextRecord() {
  const index = rows.value.findIndex(
    (item) => item.id === currentRecord.value?.id,
  );
  if (index !== -1 && index < rows.value.length - 1) {
    currentRecord.value = rows.value[index + 1];
    return currentRecord.value;
  }
  if (pageState.page * pageState.size >= pageState.total) return undefined;
  pageState.page += 1;
  await loadRecords();
  currentRecord.value = rows.value[0];
  return currentRecord.value;
}

defineExpose({ close, open });
</script>

<template>
  <ElDrawer
    v-model="visible"
    :title="`${activeTrigger?.name || ''} 执行记录`"
    size="860px"
    :before-close="close"
  >
    <div class="record-toolbar">
      <ElSelect
        v-model="searchType"
        class="search-type"
        @change="searchTypeChange"
      >
        <ElOption label="任务名称" value="name" />
        <ElOption label="资源类型" value="source_type" />
        <ElOption label="状态" value="state" />
      </ElSelect>
      <ElInput
        v-if="searchType === 'name'"
        v-model="search.name"
        class="search-input"
        clearable
        placeholder="搜索任务"
        @keyup.enter="loadRecords"
      />
      <ElSelect
        v-else-if="searchType === 'source_type'"
        v-model="search.source_type"
        class="search-input"
        clearable
        @change="loadRecords"
      >
        <ElOption label="应用" value="APPLICATION" />
        <ElOption label="工具" value="TOOL" />
      </ElSelect>
      <ElSelect
        v-else
        v-model="search.state"
        class="search-input"
        clearable
        @change="loadRecords"
      >
        <ElOption label="成功" value="SUCCESS" />
        <ElOption label="运行中" value="STARTED" />
        <ElOption label="失败" value="FAILURE" />
      </ElSelect>
      <ElButton :icon="Search" @click="loadRecords">查询</ElButton>
    </div>

    <ElTable v-loading="loading" :data="rows" height="calc(100vh - 260px)">
      <ElTableColumn label="任务" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.source_name || row.source_id || '-' }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="类型" width="100">
        <template #default="{ row }">
          {{ sourceDisplayType(row.source_type) }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="状态" width="120">
        <template #default="{ row }">
          <ElTag :type="statusType(row.state || row.status)" size="small">
            {{ statusLabel(row.state || row.status) }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="耗时" width="100">
        <template #default="{ row }">{{ recordRunTime(row) }}</template>
      </ElTableColumn>
      <ElTableColumn prop="create_time" label="创建时间" width="180" />
      <ElTableColumn label="操作" width="90">
        <template #default="{ row }">
          <ElButton link type="primary" @click="openDetail(row)">详情</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <footer class="pagination-footer">
      <ElPagination
        v-model:current-page="pageState.page"
        v-model:page-size="pageState.size"
        :page-sizes="[10, 20, 50]"
        :total="pageState.total"
        layout="total, sizes, prev, pager, next"
        @current-change="loadRecords"
        @size-change="loadRecords"
      />
    </footer>

    <ExecutionDetailDrawer
      ref="detailDrawerRef"
      :next="nextRecord"
      :next-disabled="nextDisabled"
      :pre="preRecord"
      :pre-disabled="preDisabled"
    />
  </ElDrawer>
</template>

<style scoped lang="scss">
.record-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding-bottom: 12px;
}

.search-type {
  width: 112px;
}

.search-input {
  width: 240px;
}

.pagination-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
}
</style>
