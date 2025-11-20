<script setup lang="ts" name="tip">
import { VbenIcon } from '@vben/common-ui';

import { ElTooltip } from 'element-plus';

const props = defineProps({
  content: {
    type: String,
    default: '',
  },
  placement: {
    type: String,
    default: 'top-start',
  },
});
</script>

<template>
  <ElTooltip
    class="box-item"
    effect="dark"
    :content="props.content"
    :placement="props.placement"
  >
    <VbenIcon icon="ant-design:exclamation-circle-twotone" />
    <slot></slot>
  </ElTooltip>
</template>
