<script setup lang="ts">
import { WarningFilled } from '@element-plus/icons-vue';
import { ElIcon, ElTooltip } from 'element-plus';

defineProps<{
  label: any;
}>();
</script>
<template>
  <div class="align-center flex" style="display: inline-flex">
    <div class="flex-between mr-4">
      <span>{{ label.label }}</span>
    </div>
    <ElTooltip v-if="label.attrs?.tooltip" effect="dark" placement="right">
      <template #content>
        <div style="max-width: 200px">{{ label.attrs.tooltip }}</div>
      </template>
      <ElIcon style="flex-shrink: 0"><WarningFilled /></ElIcon>
    </ElTooltip>
  </div>
</template>
