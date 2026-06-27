<script setup lang="ts">
import { WarningFilled } from '@element-plus/icons-vue';
import { ElIcon, ElTooltip } from 'element-plus';

const fileTooltip = JSON.stringify(
  [
    {
      name: 'File Name',
      url: '/admin/sys-file/local/example.pdf',
      file_id: '1234567890123456789',
    },
  ],
  null,
  2,
);
</script>

<template>
  <ElTooltip effect="dark" placement="right">
    <template #content>
      <pre class="workflow-file-tooltip__content">{{ fileTooltip }}</pre>
    </template>
    <ElIcon class="workflow-file-tooltip__icon">
      <WarningFilled />
    </ElIcon>
  </ElTooltip>
</template>

<style scoped lang="scss">
.workflow-file-tooltip__content {
  margin: 0;
  font-family: monospace;
  white-space: pre-wrap;
}

.workflow-file-tooltip__icon {
  color: var(--el-color-warning);
  cursor: help;
}
</style>
