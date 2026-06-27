<script setup lang="ts">
import type { Id, JsonRecord, TriggerRecord } from './trigger-utils';

import type { TriggerTaskSourceValue } from '#/api/ai/triggers';

import { ref } from 'vue';

import { confirm } from '@vben/common-ui';

import { Close, EditPen, Plus } from '@element-plus/icons-vue';
import {
  ElButton,
  ElDrawer,
  ElEmpty,
  ElIcon,
  ElMessage,
  ElTag,
} from 'element-plus';

import { deleteResourceTrigger, listResourceTriggers } from '#/api/ai/triggers';

import {
  normalizeTriggerRecord,
  scheduleLabel,
  triggerTypeLabel,
} from './trigger-utils';
import TriggerDrawer from './TriggerDrawer.vue';

const props = withDefaults(
  defineProps<{
    source: TriggerTaskSourceValue;
    workspaceId?: string;
  }>(),
  {
    workspaceId: 'default',
  },
);

const emit = defineEmits<{
  refresh: [];
}>();

const visible = ref(false);
const loading = ref(false);
const resource = ref<JsonRecord>();
const rows = ref<TriggerRecord[]>([]);
const triggerDrawerRef = ref<InstanceType<typeof TriggerDrawer>>();
const workspaceId = ref(props.workspaceId);

function resourceId() {
  return resource.value?.id as Id | undefined;
}

async function loadTriggers() {
  const id = resourceId();
  if (!id) return;
  loading.value = true;
  try {
    const data = await listResourceTriggers(
      props.source,
      id,
      props.workspaceId,
    );
    rows.value = Array.isArray(data)
      ? data.map((item) => normalizeTriggerRecord(item as JsonRecord))
      : [];
  } finally {
    loading.value = false;
  }
}

function open(data: JsonRecord) {
  resource.value = data;
  visible.value = true;
  loadTriggers();
}

function openCreate() {
  const id = resourceId();
  if (!id) return;
  triggerDrawerRef.value?.open(undefined, {
    resourceId: id,
    resourceType: props.source,
    workspaceId: props.workspaceId,
  });
}

function openEdit(row: TriggerRecord) {
  const id = resourceId();
  if (!id) return;
  triggerDrawerRef.value?.open(row, {
    resourceId: id,
    resourceType: props.source,
    workspaceId: props.workspaceId,
  });
}

function remove(row: TriggerRecord) {
  const id = resourceId();
  if (!id) return;
  confirm(`确认删除触发器 ${row.name || row.id}？`).then(async () => {
    await deleteResourceTrigger(props.source, id, row.id);
    ElMessage.success('删除成功');
    await loadTriggers();
    emit('refresh');
  });
}

function refresh() {
  loadTriggers();
  emit('refresh');
}

defineExpose({ open });
</script>

<template>
  <ElDrawer v-model="visible" title="触发器" size="620px" destroy-on-close>
    <div class="resource-head">
      <h4>{{ resource?.name || '触发器' }}</h4>
      <ElButton type="primary" link :icon="Plus" @click="openCreate">
        添加
      </ElButton>
    </div>

    <div v-loading="loading" class="resource-list">
      <div v-for="item in rows" :key="item.id" class="resource-row">
        <div class="resource-main">
          <ElTag
            :type="item.trigger_type === 'EVENT' ? 'warning' : 'primary'"
            size="small"
          >
            {{ triggerTypeLabel(item.trigger_type) }}
          </ElTag>
          <div class="resource-text">
            <div class="resource-title">{{ item.name }}</div>
            <div class="resource-desc">
              {{
                item.trigger_type === 'SCHEDULED'
                  ? scheduleLabel(item.trigger_setting)
                  : item.desc || '事件触发'
              }}
            </div>
          </div>
        </div>
        <div class="resource-actions">
          <ElButton
            link
            type="primary"
            :icon="EditPen"
            @click="openEdit(item)"
          />
          <ElButton link type="danger" @click="remove(item)">
            <ElIcon><Close /></ElIcon>
          </ElButton>
        </div>
      </div>
      <ElEmpty v-if="rows.length === 0 && !loading" description="暂无触发器" />
    </div>

    <TriggerDrawer
      ref="triggerDrawerRef"
      :workspace-id="workspaceId"
      @refresh="refresh"
    />
  </ElDrawer>
</template>

<style scoped lang="scss">
.resource-head,
.resource-row,
.resource-main,
.resource-actions {
  display: flex;
  align-items: center;
}

.resource-head {
  justify-content: space-between;
  margin-bottom: 12px;
}

.resource-list {
  display: grid;
  gap: 8px;
}

.resource-row {
  justify-content: space-between;
  padding: 8px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.resource-main {
  gap: 10px;
  min-width: 0;
}

.resource-text {
  min-width: 0;
}

.resource-title,
.resource-desc {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
