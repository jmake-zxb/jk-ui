<script setup lang="ts">
const props = defineProps<{
  model: any;
}>();

function deleteEdge() {
  props.model.graphModel?.deleteEdgeById?.(props.model.id);
}
</script>

<template>
  <div
    class="workflow-edge-delete"
    style="display: none"
    @click.stop="deleteEdge"
    @mouseup.stop
  >
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 23C5.925 23 1 18.075 1 12C1 5.925 5.925 1 12 1C18.075 1 23 5.925 23 12C23 18.075 18.075 23 12 23Z"
        fill="var(--el-color-primary)"
      />
      <path
        d="M9.025 7.611L12 10.586L14.975 7.611C15.069 7.518 15.196 7.465 15.329 7.465C15.461 7.465 15.589 7.518 15.682 7.611L16.389 8.318C16.483 8.412 16.536 8.539 16.536 8.672C16.536 8.804 16.483 8.931 16.389 9.025L13.414 12L16.389 14.975C16.483 15.069 16.536 15.196 16.536 15.329C16.536 15.461 16.483 15.589 16.389 15.682L15.682 16.389C15.589 16.483 15.461 16.536 15.329 16.536C15.196 16.536 15.069 16.483 14.975 16.389L12 13.414L9.025 16.389C8.931 16.483 8.804 16.536 8.672 16.536C8.539 16.536 8.412 16.483 8.318 16.389L7.611 15.682C7.518 15.589 7.465 15.461 7.465 15.329C7.465 15.196 7.518 15.069 7.611 14.975L10.586 12L7.611 9.025C7.518 8.931 7.465 8.804 7.465 8.672C7.465 8.539 7.518 8.412 7.611 8.318L8.318 7.611C8.412 7.518 8.539 7.465 8.672 7.465C8.804 7.465 8.931 7.518 9.025 7.611Z"
        fill="white"
      />
    </svg>
  </div>
</template>

<style lang="scss">
.workflow-edge-delete {
  position: absolute;
  z-index: 100000;
  color: var(--el-color-primary);
  pointer-events: all;
  cursor: pointer;
  stroke: none;
}
</style>
