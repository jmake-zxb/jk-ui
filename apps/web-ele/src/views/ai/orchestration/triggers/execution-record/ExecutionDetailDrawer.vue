<script setup lang="ts">
import type { JsonRecord } from '../trigger-utils';

import { ref } from 'vue';

import {
  ElAlert,
  ElButton,
  ElCard,
  ElCol,
  ElDrawer,
  ElRow,
} from 'element-plus';

import { getTriggerRecord } from '#/api/ai/triggers';

import { prettyJson } from '../../utils';
import {
  recordRunTime,
  sourceDisplayType,
  statusLabel,
} from '../trigger-utils';

defineProps<{
  next?: () => JsonRecord | Promise<JsonRecord | undefined> | undefined;
  nextDisabled?: boolean;
  pre?: () => JsonRecord | Promise<JsonRecord | undefined> | undefined;
  preDisabled?: boolean;
}>();

const visible = ref(false);
const loading = ref(false);
const currentRecord = ref<JsonRecord>();
const detail = ref<JsonRecord>();

async function open(row: JsonRecord) {
  currentRecord.value = row;
  visible.value = true;
  await loadDetail(row);
}

async function loadDetail(row: JsonRecord) {
  const triggerId = row.trigger_id;
  const taskId = row.trigger_task_id;
  if (!triggerId || !taskId || !row.id) return;
  loading.value = true;
  try {
    detail.value = (await getTriggerRecord(
      triggerId,
      taskId,
      row.id,
    )) as JsonRecord;
  } finally {
    loading.value = false;
  }
}

async function navigate(
  loader?: () => JsonRecord | Promise<JsonRecord | undefined> | undefined,
) {
  if (!loader) return;
  const row = await loader();
  if (row) await open(row);
}

defineExpose({ open });
</script>

<template>
  <ElDrawer v-model="visible" title="执行详情" size="760px" destroy-on-close>
    <div v-loading="loading" class="detail-body">
      <ElAlert
        v-if="detail?.err_message || detail?.error_message"
        :title="detail.err_message || detail.error_message"
        type="error"
        show-icon
      />
      <ElCard shadow="never" class="detail-card">
        <template #header>执行记录</template>
        <ElRow :gutter="16">
          <ElCol :span="6">任务：{{ currentRecord?.source_name || '-' }}</ElCol>
          <ElCol :span="6">
            类型：{{ sourceDisplayType(currentRecord?.source_type) }}
          </ElCol>
          <ElCol :span="6">
            状态：{{
              statusLabel(currentRecord?.state || currentRecord?.status)
            }}
          </ElCol>
          <ElCol :span="6">
            耗时：{{ recordRunTime(currentRecord || {}) }}
          </ElCol>
        </ElRow>
      </ElCard>
      <ElCard shadow="never" class="detail-card">
        <template #header>输入</template>
        <pre>{{
          prettyJson(
            detail?.input_json ||
              detail?.inputJson ||
              currentRecord?.input_json,
            '{}',
          )
        }}</pre>
      </ElCard>
      <ElCard shadow="never" class="detail-card">
        <template #header>输出</template>
        <pre>{{
          prettyJson(
            detail?.output_json ||
              detail?.outputJson ||
              currentRecord?.output_json,
            '{}',
          )
        }}</pre>
      </ElCard>
      <ElCard shadow="never" class="detail-card">
        <template #header>详情</template>
        <pre>{{ prettyJson(detail?.details || detail?.meta, '{}') }}</pre>
      </ElCard>
    </div>
    <template #footer>
      <ElButton :disabled="preDisabled || loading" @click="navigate(pre)">
        上一条
      </ElButton>
      <ElButton :disabled="nextDisabled || loading" @click="navigate(next)">
        下一条
      </ElButton>
    </template>
  </ElDrawer>
</template>

<style scoped lang="scss">
.detail-body {
  display: grid;
  gap: 12px;
}

.detail-card {
  border-radius: 6px;
}

.detail-card pre {
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
