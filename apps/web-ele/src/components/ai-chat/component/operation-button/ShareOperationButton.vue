<script setup lang="ts">
import { ElButton, ElText, ElTooltip } from 'element-plus';

import { copyClick } from '#/utils/clipboard';
import { datetimeFormat } from '#/utils/time';

defineProps({
  data: {
    type: Object,
    default: () => {},
  },
});
</script>
<template>
  <div>
    <div class="flex-between mt-2">
      <div>
        <ElText type="info">
          <span class="ml-1">{{ datetimeFormat(data.create_time) }}</span>
        </ElText>
      </div>
      <div>
        <ElTooltip effect="dark" :content="$$t('common.copy')" placement="top">
          <ElButton text @click="copyClick(data?.answer_text)">
            <AppIcon icon-name="app-copy" class="color-secondary" />
          </ElButton>
        </ElTooltip>
      </div>
    </div>
  </div>
</template>
<style lang="scss" scoped></style>
