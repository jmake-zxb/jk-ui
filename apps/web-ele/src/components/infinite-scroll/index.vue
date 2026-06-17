<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    loading?: boolean;
    pageSize?: number;
    size: number;
    total: number;
  }>(),
  {
    loading: false,
    pageSize: 20,
  },
);

const emit = defineEmits<{
  load: [];
}>();

const currentPage = defineModel<number>('current_page', { default: 1 });

const sentinelRef = ref<HTMLDivElement>();
const observer = ref<IntersectionObserver>();

function checkAndLoad() {
  if (props.loading) return;
  if (props.size >= props.total) return;
  currentPage.value += 1;
  emit('load');
}

onMounted(() => {
  if (!sentinelRef.value) return;
  observer.value = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        checkAndLoad();
      }
    },
    { threshold: 0.1 },
  );
  observer.value.observe(sentinelRef.value);
});

onUnmounted(() => {
  observer.value?.disconnect();
});

watch(
  () => props.size,
  () => {
    if (props.size < props.total && sentinelRef.value) {
      observer.value?.observe(sentinelRef.value);
    }
  },
);
</script>

<template>
  <div class="infinite-scroll">
    <slot></slot>
    <div ref="sentinelRef" class="infinite-scroll__sentinel"></div>
    <div v-if="loading" class="infinite-scroll__loading">
      <slot name="loading">
        <span>加载中...</span>
      </slot>
    </div>
    <div
      v-else-if="size >= total && total > 0"
      class="infinite-scroll__finished"
    >
      <slot name="finished">
        <span>没有更多了</span>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.infinite-scroll {
  position: relative;
}

.infinite-scroll__sentinel {
  height: 1px;
}

.infinite-scroll__loading,
.infinite-scroll__finished {
  padding: 8px 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
}
</style>
