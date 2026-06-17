<script setup lang="ts">
import { ElIcon, ElTooltip } from 'element-plus';

defineProps<{
  header: any;
}>();
</script>

<template>
  <div
    v-if="header"
    style="
      display: flex;
      align-items: center;
      padding: 2px 4px;
      font-size: 13px;
      color: #1f2329;
    "
  >
    <span>{{ header.label }}</span>
    <span v-if="header.required" style="margin-left: 4px; color: #f54a45">
      *
    </span>
    <ElTooltip v-if="header.tooltip" effect="dark" placement="right">
      <template #content>
        <div style="max-width: 200px">{{ header.tooltip }}</div>
      </template>
      <ElIcon style="flex-shrink: 0; margin-left: 4px">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
          />
        </svg>
      </ElIcon>
    </ElTooltip>
  </div>
</template>

<style>
.el-select-dropdown__header {
  padding: 4px 8px 0;
  border-bottom: none;
}
</style>
