<script setup lang="ts">
import { computed, ref } from 'vue';

import { ElCol, ElPopover, ElProgress, ElRow } from 'element-plus';
import { get } from 'lodash-es';

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
const rowRef = ref<any>();

function evalF(text: string, row: any) {
  rowRef.value = row;
  const path = text.replace(/^rowRef\.value\./, '');
  return get(row, path);
}
const props_info = computed(() => {
  return props.column.props_info || {};
});
const text_field = computed(() => {
  return props.column.text_field || 'key';
});
const value_field = computed(() => {
  return props.column.value_field || 'value';
});

const value_html = (view_card_item: any) => {
  return view_card_item.type === 'eval'
    ? evalF(view_card_item.value_field, props.row)
    : props.row[view_card_item.value_field];
};

const view_card = computed(() => {
  return props_info.value.view_card || [];
});
</script>
<template>
  <div class="progress-table-item">
    <ElPopover
      placement="top-start"
      :title="row[text_field]"
      :width="200"
      trigger="hover"
      :persistent="false"
    >
      <template #reference>
        <ElProgress v-bind="$attrs" :percentage="row[value_field]" />
      </template>
      <div>
        <ElRow v-for="(item, index) in view_card" :key="index">
          <ElCol :span="6">{{ item.title }}</ElCol>
          <ElCol :span="18">
            <span class="value" :innerHTML="value_html(item)"></span>
          </ElCol>
        </ElRow>
      </div>
    </ElPopover>
  </div>
</template>
<style lang="scss" scoped>
.progress-table-item {
  .value {
    float: right;
    height: 22px;
    font-size: 12px;
    font-weight: 500;
    line-height: 22px;
    color: var(--el-text-color-primary);
  }
}
</style>
