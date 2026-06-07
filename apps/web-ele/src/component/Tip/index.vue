<script setup lang="ts" name="tip">
import type { Placement } from 'element-plus';

import { VbenIcon } from '@vben/common-ui';

import { ElTooltip } from 'element-plus';

const props = withDefaults(
  defineProps<{
    content?: string;
    placement?: Placement;
  }>(),
  {
    content: '',
    placement: 'top-start',
  },
);
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
