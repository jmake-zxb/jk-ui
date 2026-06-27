<script setup lang="ts">
import {
  Aim,
  Expand,
  Fold,
  MagicStick,
  Mouse,
  Pointer,
  ZoomIn,
  ZoomOut,
} from '@element-plus/icons-vue';
import { ElButton, ElCard, ElDivider, ElTooltip } from 'element-plus';

defineProps<{
  dragMode?: boolean;
}>();

const emit = defineEmits<{
  arrange: [];
  collapse: [];
  expand: [];
  fit: [];
  toggleDrag: [value: boolean];
  zoomIn: [];
  zoomOut: [];
}>();
</script>

<template>
  <ElCard class="designer-canvas-control" shadow="always">
    <div class="designer-canvas-control__group">
      <ElTooltip content="选择" placement="top">
        <ElButton
          text
          size="small"
          :class="{ 'is-active': dragMode }"
          :icon="Mouse"
          @click="emit('toggleDrag', true)"
        />
      </ElTooltip>
      <ElTooltip content="拖动画布" placement="top">
        <ElButton
          text
          size="small"
          :class="{ 'is-active': !dragMode }"
          :icon="Pointer"
          @click="emit('toggleDrag', false)"
        />
      </ElTooltip>
    </div>
    <ElDivider direction="vertical" />
    <div class="designer-canvas-control__group">
      <ElTooltip content="缩小" placement="top">
        <ElButton text size="small" :icon="ZoomOut" @click="emit('zoomOut')" />
      </ElTooltip>
      <ElTooltip content="放大" placement="top">
        <ElButton text size="small" :icon="ZoomIn" @click="emit('zoomIn')" />
      </ElTooltip>
      <ElTooltip content="适配视图" placement="top">
        <ElButton text size="small" :icon="Aim" @click="emit('fit')" />
      </ElTooltip>
    </div>
    <ElDivider direction="vertical" />
    <div class="designer-canvas-control__group">
      <ElTooltip content="收起节点" placement="top">
        <ElButton text size="small" :icon="Fold" @click="emit('collapse')" />
      </ElTooltip>
      <ElTooltip content="展开节点" placement="top">
        <ElButton text size="small" :icon="Expand" @click="emit('expand')" />
      </ElTooltip>
      <ElTooltip content="自动排列" placement="top">
        <ElButton
          text
          size="small"
          :icon="MagicStick"
          @click="emit('arrange')"
        />
      </ElTooltip>
    </div>
  </ElCard>
</template>

<style scoped lang="scss">
.designer-canvas-control {
  --el-card-padding: 8px 12px;
  --el-card-border-radius: 8px;

  pointer-events: auto;
  border-color: var(--el-border-color-lighter);
  box-shadow: var(--el-box-shadow-light);
}

.designer-canvas-control :deep(.el-card__body),
.designer-canvas-control__group {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}

.designer-canvas-control :deep(.el-button) {
  height: 24px;
  padding: 4px 6px;
  border: 0;
}

.designer-canvas-control :deep(.el-button.is-active) {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
</style>
