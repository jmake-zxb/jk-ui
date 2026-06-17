<script setup lang="ts">
import { ref } from 'vue';

import { Close, MoreFilled, User } from '@element-plus/icons-vue';
import {
  ElAvatar,
  ElButton,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElIcon,
  ElTag,
} from 'element-plus';

const props = defineProps<{
  canRestore?: boolean;
  loading?: boolean;
  title?: string;
  versions: any[];
}>();

const emit = defineEmits<{
  close: [];
  restore: [row: any];
}>();

const hoveredId = ref<null | string>(null);
const editingId = ref<null | string>(null);
const editingName = ref('');

function formatTime(value: any) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return `${value}`;
  return date.toLocaleString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    year: 'numeric',
  });
}

function startRename(row: any) {
  editingId.value = row.id;
  editingName.value = row.name || '';
}

function finishRename() {
  if (editingId.value) {
    const row = props.versions.find((v) => v.id === editingId.value);
    if (row) row.name = editingName.value;
  }
  editingId.value = null;
}
</script>

<template>
  <div class="publish-history-sidebar">
    <div class="ph-header">
      <div class="ph-header__title">{{ title || '发布历史' }}</div>
      <ElButton text size="small" :icon="Close" @click="emit('close')" />
    </div>
    <div class="ph-body" v-loading="loading">
      <div v-if="versions.length === 0" class="ph-empty">暂无历史版本</div>
      <div
        v-for="(item, index) in versions"
        :key="item.id"
        class="ph-item"
        @mouseenter="hoveredId = item.id"
        @mouseleave="hoveredId = null"
      >
        <div class="ph-item__main">
          <div class="ph-item__head">
            <div class="ph-item__name-row">
              <template v-if="editingId === item.id">
                <input
                  v-model="editingName"
                  class="ph-rename-input"
                  autofocus
                  @blur="finishRename"
                  @keyup.enter="finishRename"
                />
              </template>
              <template v-else>
                <span
                  class="ph-item__name"
                  :class="{ 'ph-item__name--latest': index === 0 }"
                >
                  {{
                    item.name || formatTime(item.updateTime || item.update_time)
                  }}
                </span>
              </template>
              <ElTag
                v-if="index === 0"
                size="small"
                type="primary"
                class="ph-tag-latest"
              >
                最新发布
              </ElTag>
            </div>
            <div class="ph-item__meta">
              <ElAvatar
                :size="16"
                style="background: var(--el-fill-color-dark)"
              >
                <ElIcon :size="10"><User /></ElIcon>
              </ElAvatar>
              <span>{{
                item.publishUserName || item.publish_user_name || '系统'
              }}</span>
            </div>
          </div>
          <div v-if="hoveredId === item.id" class="ph-item__actions">
            <ElDropdown trigger="click" size="small">
              <ElButton text size="small">
                <ElIcon><MoreFilled /></ElIcon>
              </ElButton>
              <template #dropdown>
                <ElDropdownMenu>
                  <ElDropdownItem @click="startRename(item)">
                    重命名
                  </ElDropdownItem>
                  <ElDropdownItem
                    v-if="canRestore"
                    @click="emit('restore', item)"
                  >
                    恢复此版本
                  </ElDropdownItem>
                </ElDropdownMenu>
              </template>
            </ElDropdown>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.publish-history-sidebar {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  width: 320px;
  background: hsl(var(--card));
  border-left: 1px solid var(--el-border-color-lighter);
  box-shadow: -2px 0 8px rgb(0 0 0 / 6%);
}

.ph-header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.ph-header__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.ph-body {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
}

.ph-empty {
  padding: 32px 16px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.ph-item {
  padding: 10px 12px;
  cursor: pointer;
  border-radius: 6px;
  transition: background-color 0.15s;

  &:hover {
    background: var(--el-fill-color-light);
  }
}

.ph-item__main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.ph-item__head {
  flex: 1;
  min-width: 0;
}

.ph-item__name-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.ph-item__name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.ph-item__name--latest {
  color: var(--el-color-primary);
}

.ph-tag-latest {
  flex-shrink: 0;
}

.ph-item__meta {
  display: flex;
  gap: 4px;
  align-items: center;
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.ph-item__actions {
  flex-shrink: 0;
  margin-left: 8px;
}

.ph-rename-input {
  width: 180px;
  padding: 2px 6px;
  font-size: 13px;
  outline: none;
  border: 1px solid var(--el-color-primary);
  border-radius: 4px;
}
</style>
