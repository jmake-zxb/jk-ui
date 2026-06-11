<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

import { CircleClose, Loading, SuccessFilled } from '@element-plus/icons-vue';
import {
  ElButton,
  ElDrawer,
  ElIcon,
  ElPagination,
  ElTable,
  ElTableColumn,
  ElText,
} from 'element-plus';

import { pageToolRuns } from '#/api/ai/tool-workflow';

import { recordsOf, totalOf } from '../../utils';
import ExecutionRecordDetailDrawer from './ExecutionRecordDetailDrawer.vue';

interface ToolRunRecord {
  createTime?: string;
  create_time?: string;
  id?: number | string;
  runTime?: number;
  run_time?: number;
  state?: string;
  status?: string;
}

const drawer = ref(false);
const loading = ref(false);
const tableData = ref<ToolRunRecord[]>([]);
const currentToolId = ref<number | string>();
const paginationConfig = reactive({
  current: 1,
  page: 1,
  size: 20,
  total: 0,
});

const detailDrawerRef = ref<InstanceType<typeof ExecutionRecordDetailDrawer>>();
const currentRecordId = ref<number | string>();
const currentRecord = ref<ToolRunRecord>();

const open = (toolId: number | string) => {
  currentToolId.value = toolId;
  paginationConfig.current = 1;
  paginationConfig.page = 1;
  drawer.value = true;
  loadRecords();
};

const close = () => {
  drawer.value = false;
  tableData.value = [];
  paginationConfig.total = 0;
  currentToolId.value = undefined;
};

const loadRecords = async () => {
  if (!currentToolId.value) return;
  loading.value = true;
  try {
    const data = await pageToolRuns(currentToolId.value, {
      current: paginationConfig.current,
      page: paginationConfig.page,
      size: paginationConfig.size,
    });
    tableData.value = recordsOf<ToolRunRecord>(data);
    paginationConfig.total = totalOf(data);
  } finally {
    loading.value = false;
  }
};

const handlePageChange = (page: number) => {
  paginationConfig.current = page;
  paginationConfig.page = page;
  loadRecords();
};

const handleSizeChange = (size: number) => {
  paginationConfig.size = size;
  paginationConfig.current = 1;
  paginationConfig.page = 1;
  loadRecords();
};

const viewDetail = (row: ToolRunRecord) => {
  if (!currentToolId.value || !row.id) return;
  currentRecord.value = row;
  currentRecordId.value = row.id;
  detailDrawerRef.value?.open();
};

const statusText = (row: ToolRunRecord) => {
  const state = (row.state || row.status || '').toUpperCase();
  if (state === 'SUCCESS') return '成功';
  if (state === 'FAILURE' || state === 'FAILED') return '失败';
  if (state === 'RUNNING' || state === 'STARTED') return '运行中';
  return state || '未知';
};

const statusIcon = (row: ToolRunRecord) => {
  const state = (row.state || row.status || '').toUpperCase();
  if (state === 'SUCCESS')
    return { component: SuccessFilled, color: 'success' };
  if (state === 'FAILURE' || state === 'FAILED')
    return { component: CircleClose, color: 'danger' };
  if (state === 'RUNNING' || state === 'STARTED')
    return { component: Loading, color: 'primary' };
  return { component: CircleClose, color: 'info' };
};

const runTimeText = (row: ToolRunRecord) => {
  const time = row.run_time ?? row.runTime;
  if (typeof time !== 'number') return '-';
  return time >= 1000 ? `${(time / 1000).toFixed(2)}s` : `${time}ms`;
};

const createTimeText = (row: ToolRunRecord) => {
  return row.create_time ?? row.createTime ?? '-';
};

const preDisabled = computed(() => {
  const index = tableData.value.findIndex(
    (item) => item.id === currentRecordId.value,
  );
  return index === 0 && paginationConfig.current === 1;
});

const nextDisabled = computed(() => {
  const index = tableData.value.findIndex(
    (item) => item.id === currentRecordId.value,
  );
  return (
    index >= tableData.value.length - 1 &&
    paginationConfig.current * paginationConfig.size >= paginationConfig.total
  );
});

const preRecord = () => {
  const index = tableData.value.findIndex(
    (item) => item.id === currentRecordId.value,
  );
  if (index > 0) {
    const record = tableData.value[index - 1];
    if (!record) return;
    currentRecord.value = record;
    currentRecordId.value = record.id;
  } else if (paginationConfig.current > 1) {
    paginationConfig.current -= 1;
    paginationConfig.page -= 1;
    loadRecords().then(() => {
      if (tableData.value.length > 0) {
        const record = tableData.value[tableData.value.length - 1];
        if (!record) return;
        currentRecord.value = record;
        currentRecordId.value = record.id;
      }
    });
  }
};

const nextRecord = () => {
  const index = tableData.value.findIndex(
    (item) => item.id === currentRecordId.value,
  );
  if (index < tableData.value.length - 1) {
    const record = tableData.value[index + 1];
    if (!record) return;
    currentRecord.value = record;
    currentRecordId.value = record.id;
  } else if (
    paginationConfig.current * paginationConfig.size <
    paginationConfig.total
  ) {
    paginationConfig.current += 1;
    paginationConfig.page += 1;
    loadRecords().then(() => {
      if (tableData.value.length > 0) {
        const record = tableData.value[0];
        if (!record) return;
        currentRecord.value = record;
        currentRecordId.value = record.id;
      }
    });
  }
};

defineExpose({ open, close });
</script>

<template>
  <ElDrawer
    v-model="drawer"
    title="执行记录"
    direction="rtl"
    size="800px"
    :before-close="close"
  >
    <ElTable
      v-loading="loading"
      :data="tableData"
      :default-sort="{ prop: 'create_time', order: 'descending' }"
      style="width: 100%"
    >
      <ElTableColumn prop="create_time" label="执行时间" width="180" sortable>
        <template #default="{ row }">
          {{ createTimeText(row) }}
        </template>
      </ElTableColumn>

      <ElTableColumn prop="state" label="状态" width="120">
        <template #default="{ row }">
          <ElText>
            <ElIcon :class="`color-${statusIcon(row).color}`">
              <component :is="statusIcon(row).component" />
            </ElIcon>
            {{ statusText(row) }}
          </ElText>
        </template>
      </ElTableColumn>

      <ElTableColumn prop="run_time" label="耗时" width="120">
        <template #default="{ row }">
          {{ runTimeText(row) }}
        </template>
      </ElTableColumn>

      <ElTableColumn label="操作" width="100">
        <template #default="{ row }">
          <ElButton type="primary" text @click="viewDetail(row)">
            查看详情
          </ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <div style="margin-top: 16px; text-align: center">
      <ElPagination
        v-model:current-page="paginationConfig.current"
        v-model:page-size="paginationConfig.size"
        :page-sizes="[10, 20, 50, 100]"
        :total="paginationConfig.total"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>

    <ExecutionRecordDetailDrawer
      ref="detailDrawerRef"
      v-model:current-id="currentRecordId"
      v-model:current-record="currentRecord"
      :tool-id="currentToolId"
      :pre="preRecord"
      :next="nextRecord"
      :pre-disabled="preDisabled"
      :next-disabled="nextDisabled"
    />
  </ElDrawer>
</template>
