<script setup lang="ts" name="dict-tag">
import { computed } from 'vue';

import { ElTag } from 'element-plus';

const props = defineProps({
  // 数据
  options: {
    type: Array as any,
    default: null,
  },
  // 当前的值
  value: {
    type: [Number, String, Array],
    default: null,
  },
});

const values = computed(() => {
  if (props.value !== null && props.value !== undefined) {
    return Array.isArray(props.value) ? props.value : [String(props.value)];
  } else {
    return [];
  }
});
</script>

<template>
  <div>
    <template v-for="(item, index) in props.options">
      <template v-if="values.includes(item.value || item)">
        <span
          v-if="item.elTagType === 'default' || item.elTagType === ''"
          :key="index"
          :index="index"
          :class="item.elTagClass"
          >{{ item.label || item }}
        </span>
        <ElTag
          v-else
          :disable-transitions="true"
          :key="index * 2"
          :index="index"
          :type="item.elTagType === 'primary' ? '' : item.elTagType"
          :class="item.elTagClass"
        >
          {{ item.label || item }}
        </ElTag>
      </template>
    </template>
  </div>
</template>

<style scoped>
.el-tag + .el-tag {
  margin-left: 10px;
}
</style>
