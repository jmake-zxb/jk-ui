<script setup lang="ts">
import { ElTreeSelect } from 'element-plus';

import SelectHeader from '../common/SelectHeader.vue';
</script>
<template>
  <ElTreeSelect v-bind="$attrs">
    <template v-if="($attrs as any).popperHeader" #header>
      <SelectHeader :header="($attrs as any).popperHeader" />
    </template>
  </ElTreeSelect>
</template>
