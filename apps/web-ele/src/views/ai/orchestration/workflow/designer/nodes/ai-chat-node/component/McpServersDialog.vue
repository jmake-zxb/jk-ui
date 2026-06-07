<script setup lang="ts">
import { computed, ref } from 'vue';

import {
  ElAvatar,
  ElButton,
  ElCheckbox,
  ElCheckboxGroup,
  ElDialog,
  ElEmpty,
  ElInput,
  ElMessage,
  ElRadio,
  ElRadioGroup,
  ElTag,
} from 'element-plus';
import { cloneDeep } from 'lodash-es';

type ResourceRecord = Record<string, unknown>;

const props = withDefaults(
  defineProps<{
    records?: ResourceRecord[];
  }>(),
  {
    records: () => [],
  },
);

const emit = defineEmits<{
  refresh: [
    value: {
      mcp_servers: string;
      mcp_source: string;
      mcp_tool_ids: Array<number | string>;
    },
  ];
}>();

const dialogVisible = ref(false);
const keyword = ref('');
const customMcpPlaceholder =
  '{"server":{"url":"https://example.com/sse","transport":"sse"}}';
const mcpSource = ref('referencing');
const selectedIds = ref<Array<number | string>>([]);
const customJson = ref('');

function idOf(record: ResourceRecord): number | string {
  const value = record.id ?? record.toolId ?? record.tool_id ?? record.value;
  return typeof value === 'number' || typeof value === 'string'
    ? value
    : `${value || ''}`;
}

function nameOf(record: ResourceRecord) {
  return `${record.name || record.toolName || record.tool_name || record.title || idOf(record) || ''}`;
}

function descriptionOf(record: ResourceRecord) {
  return `${record.description || record.desc || record.remark || ''}`;
}

function typeOf(record: ResourceRecord) {
  return `${record.toolType || record.tool_type || record.type || 'MCP'}`.toUpperCase();
}

function iconOf(record: ResourceRecord) {
  const icon = record.icon || record.logo || record.avatar;
  return typeof icon === 'string' ? icon : '';
}

const filteredRecords = computed(() => {
  const value = keyword.value.trim().toLowerCase();
  return props.records.filter((record) => {
    if (!value) return true;
    return `${nameOf(record)} ${descriptionOf(record)} ${idOf(record) || ''}`
      .toLowerCase()
      .includes(value);
  });
});

function open(config?: {
  mcp_servers?: unknown;
  mcp_source?: unknown;
  mcp_tool_ids?: unknown;
}) {
  mcpSource.value = `${config?.mcp_source || 'referencing'}`;
  selectedIds.value = Array.isArray(config?.mcp_tool_ids)
    ? cloneDeep(config.mcp_tool_ids)
    : [];
  customJson.value = `${config?.mcp_servers || ''}`;
  keyword.value = '';
  dialogVisible.value = true;
}

function close() {
  dialogVisible.value = false;
}

function validateCustomJson() {
  const text = customJson.value.trim();
  if (!text) return true;
  try {
    JSON.parse(text);
    return true;
  } catch {
    ElMessage.warning('自定义 MCP Server 必须是合法 JSON');
    return false;
  }
}

function submit() {
  if (!validateCustomJson()) return;
  dialogVisible.value = false;
  emit('refresh', {
    mcp_servers: customJson.value,
    mcp_source: mcpSource.value,
    mcp_tool_ids: cloneDeep(selectedIds.value),
  });
}

defineExpose({ open });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    title="MCP"
    append-to-body
    :close-on-click-modal="false"
    width="680"
  >
    <div class="mcp-servers-dialog">
      <ElRadioGroup v-model="mcpSource">
        <ElRadio value="referencing">引用 MCP 工具</ElRadio>
        <ElRadio value="custom">自定义 MCP Server</ElRadio>
      </ElRadioGroup>

      <div
        v-if="mcpSource === 'referencing'"
        class="mcp-servers-dialog__section"
      >
        <ElInput v-model="keyword" clearable placeholder="搜索 MCP 工具" />
        <ElCheckboxGroup v-model="selectedIds" class="mcp-servers-dialog__list">
          <label
            v-for="record in filteredRecords"
            :key="`${idOf(record)}`"
            class="mcp-servers-dialog__item"
          >
            <ElCheckbox :value="idOf(record)" />
            <ElAvatar
              v-if="iconOf(record)"
              :size="28"
              shape="square"
              :src="iconOf(record)"
            />
            <ElTag v-else size="small" type="primary">{{
              typeOf(record)
            }}</ElTag>
            <span class="mcp-servers-dialog__body">
              <strong>{{ nameOf(record) }}</strong>
              <small>{{ descriptionOf(record) || idOf(record) }}</small>
            </span>
          </label>
        </ElCheckboxGroup>
        <ElEmpty
          v-if="filteredRecords.length === 0"
          description="暂无 MCP 工具"
          :image-size="52"
        />
      </div>

      <div v-else class="mcp-servers-dialog__section">
        <ElInput
          v-model="customJson"
          type="textarea"
          :rows="12"
          :placeholder="customMcpPlaceholder"
        />
      </div>
    </div>
    <template #footer>
      <ElButton @click="close">取消</ElButton>
      <ElButton type="primary" @click="submit">保存</ElButton>
    </template>
  </ElDialog>
</template>

<style scoped lang="scss">
.mcp-servers-dialog {
  --mcp-dialog-space-sm: 6px;
  --mcp-dialog-space-md: 8px;
  --mcp-dialog-radius: 6px;

  display: grid;
  gap: var(--mcp-dialog-space-md);
}

.mcp-servers-dialog__section,
.mcp-servers-dialog__list {
  display: grid;
  gap: var(--mcp-dialog-space-sm);
}

.mcp-servers-dialog__list {
  max-height: 340px;
  overflow: auto;
}

.mcp-servers-dialog__item {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  gap: var(--mcp-dialog-space-md);
  align-items: center;
  padding: var(--mcp-dialog-space-md);
  cursor: pointer;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--mcp-dialog-radius);
}

.mcp-servers-dialog__body {
  display: grid;
  min-width: 0;
}

.mcp-servers-dialog__body strong,
.mcp-servers-dialog__body small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mcp-servers-dialog__body strong {
  font-size: var(--el-font-size-base);
  color: var(--el-text-color-primary);
}

.mcp-servers-dialog__body small {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-placeholder);
}
</style>
