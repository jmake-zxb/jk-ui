<script setup lang="ts">
import type { FormField } from '../../type';

import { computed, ref, watch } from 'vue';

import { Search } from '@element-plus/icons-vue';
import { ElButton, ElInput, ElTable, ElTableColumn } from 'element-plus';
import { get, head } from 'lodash-es';

import TableColumn from './TableColumn.vue';

const props = defineProps<{
  field: string;
  formField: FormField;
  formfieldList?: Array<FormField>;
  formValue?: any;
  // 选中的值
  modelValue?: any;
  otherParams: any;
  view?: boolean;
}>();
const emit = defineEmits(['update:modelValue', 'change']);
const filterText = ref<string>('');
const rowTemp = ref<any>();
const evalF = (text: string, row: any) => {
  rowTemp.value = row;
  const path = text.replace(/^rowTemp\.value\./, '');
  return get(row, path);
};
const _data = computed({
  get() {
    return props.modelValue;
  },
  set(value) {
    emit('update:modelValue', value);
    emit('change', props.formField);
  },
});

const propsInfo = computed(() => {
  return props.formField.props_info || {};
});

const activeMsg = computed(() => {
  return propsInfo.value.active_msg || '';
});
const title = computed(() => {
  return propsInfo.value.title || '';
});
const tableColumns = computed(() => {
  return propsInfo.value.table_columns || [];
});

const option_list = computed(() => {
  return props.formField.option_list || [];
});

const textField = computed(() => {
  return props.formField.text_field || 'key';
});

const valueField = computed(() => {
  return props.formField.value_field || 'value';
});

const tableData = computed(() => {
  if (option_list.value) {
    return filterText.value
      ? option_list.value.filter((item: any) =>
          tableColumns.value.some((c: any) => {
            let v = '';
            if (c.type === 'eval') {
              v = evalF(c.property, item);
            } else if (c.type === 'component') {
              return false;
            } else {
              v = item[c.property];
            }
            return typeof v === 'string' ? v.includes(filterText.value) : false;
          }),
        )
      : option_list.value.filter((item: any) => item[valueField.value]);
  }
  return [];
});

/**
 * 监听表格数据，设置默认值
 */
watch(
  () => tableData.value,
  () => {
    if (tableData.value && tableData.value.length > 0) {
      const defaultItem = head(tableData.value);
      let defaultItemValue = get(defaultItem, valueField.value);
      if (props.modelValue) {
        const row = option_list.value.find(
          (f: any) => f[valueField.value] === props.modelValue,
        );
        if (row) {
          defaultItemValue = row[valueField.value];
        }
      }
      emit('update:modelValue', defaultItemValue);
    } else {
      emit('update:modelValue', undefined);
    }
    emit('change', props.formField);
  },
);

const activeText = computed(() => {
  if (props.modelValue) {
    const row = option_list.value.find(
      (f: any) => f[valueField.value] === props.modelValue,
    );
    return row[textField.value];
  }
  return props.modelValue;
});
</script>
<template>
  <div class="table-radio">
    <div class="header">
      <div class="title">{{ title }}</div>

      <ElInput
        v-model="filterText"
        :validate-event="false"
        placeholder="搜索"
        class="input-with-select"
        style="

--el-color-danger: #c0c4cc"
        clearable
      >
        <template #prepend>
          <ElButton :icon="Search" />
        </template>
      </ElInput>
    </div>

    <ElTable
      :data="tableData"
      highlight-current-row
      style="

        --el-bg-color: #f5f6f7;

        width: 100%;
        height: 100%;
      "
      @current-change="_data = $event[valueField]"
    >
      <ElTableColumn width="50px">
        <template #default="scope">
          <input type="radio" :checked="_data === scope.row[valueField]" />
        </template>
      </ElTableColumn>
      <ElTableColumn
        v-for="(column, index) in tableColumns"
        v-bind="column"
        :label="column.label"
        :key="index"
      >
        <template #default="scope">
          <template v-if="column.type === 'component'">
            <TableColumn :column="column" :row="scope.row" />
          </template>
          <template v-else-if="column.type === 'eval'">
            <span v-html="evalF(column.property, scope.row)"></span>
          </template>
          <template v-else>
            <span>{{ scope.row[column.property] }}</span>
          </template>
        </template>
      </ElTableColumn>
    </ElTable>
    <div class="msg" v-show="props.modelValue">
      {{ activeMsg }}
      <span class="active">
        {{ activeText }}
      </span>
    </div>
  </div>
</template>
<style lang="scss" scoped>
.table-radio {
  .header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 16px;

    .title {
      font-size: 14px;
      font-weight: 400;
      line-height: 22px;
      color: var(--el-text-color-primary);
    }

    .input-with-select {
      width: 45%;
    }
  }

  .msg {
    margin-top: 12px;
    color: rgb(100 106 115 / 100%);

    .active {
      margin-left: 3px;
      color: var(--el-color-primary);
    }
  }
}
</style>
