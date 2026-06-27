<script setup lang="ts">
withDefaults(
  defineProps<{
    showIcon?: boolean;
    title?: string;
  }>(),
  {
    showIcon: false,
    title: '',
  },
);
</script>

<template>
  <div class="card-box">
    <div v-if="title || $slots.tag" class="card-box-head">
      <div class="card-box-title" :title="title">{{ title }}</div>
      <slot name="tag"></slot>
    </div>
    <div class="card-box-body">
      <slot></slot>
    </div>
    <div v-if="$slots.footer" class="card-box-footer">
      <slot name="footer"></slot>
    </div>
  </div>
</template>

<style scoped>
.card-box {
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.card-box-head {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.card-box-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.card-box-body {
  padding: 8px 12px;
}

.card-box-footer {
  padding: 0 12px 8px;
}
</style>
