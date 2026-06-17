<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  /**
   *表单渲染Item column
   */
  column: any;
  /**
   * 这一行数据
   */
  row: any;
}>();

const attrs = computed(() => {
  return props.column.attrs || {};
});
</script>
<template>
  <component :is="column.property" v-bind="attrs" :column="column" :row="row" />
</template>
