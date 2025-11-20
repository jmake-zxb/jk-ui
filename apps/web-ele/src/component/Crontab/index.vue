<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';

import { VbenIcon } from '@vben/common-ui';

import {
  ElButton,
  ElDialog,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElRadioButton,
  ElRadioGroup,
  ElSelect,
  ElTabPane,
  ElTabs,
} from 'element-plus';

// =============== 类型定义 ===============
interface Shortcut {
  value: string;
  text: string;
}

interface Range {
  start: number | string;
  end: number | string;
}

interface Loop {
  start: number | string;
  end: number | string;
}

interface ValueItem {
  type: string;
  range: Range;
  loop: Loop;
  last?: string;
  appoint: string[];
}

interface DataItem {
  second: string[];
  minute: string[];
  hour: string[];
  day: string[];
  month: string[];
  week: { label: string; value: string }[];
  year: number[];
}

// =============== Props & Emits ===============
const props = withDefaults(
  defineProps<{
    modelValue?: string;
    shortcuts?: Shortcut[];
  }>(),
  {
    modelValue: '* * * * * ?',
    shortcuts: () => [],
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

// =============== Refs ===============
const defaultValue = ref<string>(props.modelValue);
const dialogVisible = ref<boolean>(false);

// =============== 工具函数 ===============
function getYear(): number[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 11 }, (_, i) => currentYear + i);
}

// =============== 初始化数据 ===============
const yearList = getYear();
const initialYearStart = yearList[0] ?? 2025; // 提供默认值
const initialYearEnd = yearList[1] ?? 2026; // 提供默认值

const data = reactive<DataItem>({
  second: [
    '0',
    '5',
    '15',
    '20',
    '25',
    '30',
    '35',
    '40',
    '45',
    '50',
    '55',
    '59',
  ],
  minute: [
    '0',
    '5',
    '15',
    '20',
    '25',
    '30',
    '35',
    '40',
    '45',
    '50',
    '55',
    '59',
  ],
  hour: Array.from({ length: 24 }, (_, i) => String(i)),
  day: Array.from({ length: 31 }, (_, i) => String(i + 1)),
  month: Array.from({ length: 12 }, (_, i) => String(i + 1)),
  week: [
    { value: '1', label: '周日' },
    { value: '2', label: '周一' },
    { value: '3', label: '周二' },
    { value: '4', label: '周三' },
    { value: '5', label: '周四' },
    { value: '6', label: '周五' },
    { value: '7', label: '周六' },
  ],
  year: yearList,
});

const value = reactive<{
  day: ValueItem;
  hour: ValueItem;
  minute: ValueItem;
  month: ValueItem;
  second: ValueItem;
  week: ValueItem;
  year: ValueItem;
}>({
  second: {
    type: '0',
    range: { start: 1, end: 2 },
    loop: { start: 0, end: 1 },
    appoint: [],
  },
  minute: {
    type: '0',
    range: { start: 1, end: 2 },
    loop: { start: 0, end: 1 },
    appoint: [],
  },
  hour: {
    type: '0',
    range: { start: 1, end: 2 },
    loop: { start: 0, end: 1 },
    appoint: [],
  },
  day: {
    type: '0',
    range: { start: 1, end: 2 },
    loop: { start: 1, end: 1 },
    appoint: [],
  },
  month: {
    type: '0',
    range: { start: 1, end: 2 },
    loop: { start: 1, end: 1 },
    appoint: [],
  },
  week: {
    type: '5',
    range: { start: '2', end: '3' },
    loop: { start: 0, end: '2' },
    last: '2',
    appoint: [],
  },
  year: {
    type: '-1',
    range: { start: initialYearStart, end: initialYearEnd },
    loop: { start: initialYearStart, end: 1 },
    appoint: [],
  },
});

// =============== Computed ===============
const value_second = computed<string>(() =>
  formatCronField(value.second, 'second'),
);
const value_minute = computed<string>(() =>
  formatCronField(value.minute, 'minute'),
);
const value_hour = computed<string>(() => formatCronField(value.hour, 'hour'));
const value_day = computed<string>(() => formatCronField(value.day, 'day'));
const value_month = computed<string>(() =>
  formatCronField(value.month, 'month'),
);
const value_week = computed<string>(() => formatCronField(value.week, 'week'));
const value_year = computed<string>(() => formatCronField(value.year, 'year'));

function formatCronField(
  item: ValueItem,
  field: 'day' | 'hour' | 'minute' | 'month' | 'second' | 'week' | 'year',
): string {
  switch (item.type) {
    case '-1': {
      return '';
    }
    case '0': {
      return field === 'year' ? '' : '*';
    }
    case '1': {
      return `${item.range.start}-${item.range.end}`;
    }
    case '2': {
      if (field === 'week') {
        return `${item.loop.end}#${item.loop.start}`;
      }
      return `${item.loop.start}/${item.loop.end}`;
    }
    case '3': {
      if (item.appoint.length > 0) {
        return item.appoint.join(',');
      } else if (field === 'year') {
        return '';
      } else {
        return '*';
      }
    }
    case '4': {
      if (field === 'day') return 'L';
      if (field === 'week' && typeof item.last === 'string')
        return `${item.last}L`;
      return '*';
    }
    case '5': {
      return '?';
    }
    default: {
      return field === 'year' ? '' : '*';
    }
  }
}

// =============== Watchers ===============
watch(
  () => value.week.type,
  (val: string) => {
    if (val !== '5') {
      value.day.type = '5';
    }
  },
);

watch(
  () => value.day.type,
  (val: string) => {
    if (val !== '5') {
      value.week.type = '5';
    }
  },
);

watch(
  () => props.modelValue,
  (newVal: string) => {
    defaultValue.value = newVal;
  },
);

// =============== Methods ===============
function handleShortcuts(command: string) {
  if (command === 'custom') {
    open();
  } else {
    defaultValue.value = command;
    emit('update:modelValue', defaultValue.value);
  }
}

function open() {
  set();
  dialogVisible.value = true;
}

function set() {
  const cronStr = props.modelValue; // 类型为 string
  const arr: string[] = cronStr.split(' ') as string[]; // 强制类型转换

  if (arr.length < 6) {
    ElMessage.warning('cron表达式错误，已转换为默认表达式');
    const defaultArr: string[] = '* * * * * ?'.split(' ') as string[];
    parseField(defaultArr[0]!, value.second, 'second');
    parseField(defaultArr[1]!, value.minute, 'minute');
    parseField(defaultArr[2]!, value.hour, 'hour');
    parseField(defaultArr[3]!, value.day, 'day');
    parseField(defaultArr[4]!, value.month, 'month');
    parseField(defaultArr[5]!, value.week, 'week');
    value.year.type = '-1';
    return;
  }

  parseField(arr[0]!, value.second, 'second');
  parseField(arr[1]!, value.minute, 'minute');
  parseField(arr[2]!, value.hour, 'hour');
  parseField(arr[3]!, value.day, 'day');
  parseField(arr[4]!, value.month, 'month');
  parseField(arr[5]!, value.week, 'week');

  if (arr[6] === undefined) {
    value.year.type = '-1';
  } else {
    parseField(arr[6]!, value.year, 'year');
  }
}

function parseField(
  cronPart: string,
  target: ValueItem,
  field: 'day' | 'hour' | 'minute' | 'month' | 'second' | 'week' | 'year',
) {
  switch (cronPart) {
    case '*': {
      target.type = '0';

      break;
    }
    case '?': {
      target.type = '5';

      break;
    }
    case 'L': {
      target.type = '4';
      if (field === 'week' && target.last === undefined) {
        target.last = '1';
      }

      break;
    }
    default: {
      if (cronPart.includes('-')) {
        target.type = '1';
        const parts = cronPart.split('-');
        const start = parts[0];
        const end = parts[1];

        if (start !== undefined && end !== undefined) {
          if (field === 'week') {
            target.range.start = start;
            target.range.end = end;
          } else {
            target.range.start = Number(start);
            target.range.end = Number(end);
          }
        } else {
          // 默认值，避免 undefined
          if (field === 'week') {
            target.range.start = '1';
            target.range.end = '2';
          } else {
            target.range.start = 1;
            target.range.end = 2;
          }
        }
      } else if (cronPart.includes('/')) {
        target.type = '2';
        const parts = cronPart.split('/');
        const start = parts[0];
        const step = parts[1];

        if (start !== undefined && step !== undefined) {
          target.loop.start = Number(start);
          target.loop.end = Number(step);
        } else {
          target.loop.start = 0;
          target.loop.end = 1;
        }
      } else if (cronPart.includes('#') && field === 'week') {
        target.type = '2';
        const parts = cronPart.split('#');
        const day = parts[0];
        const nth = parts[1];

        if (day !== undefined && nth !== undefined) {
          target.loop.end = day;
          target.loop.start = Number(nth);
        } else {
          target.loop.end = '1';
          target.loop.start = 1;
        }
      } else if (cronPart.includes('L') && field === 'week') {
        target.type = '4';
        target.last = cronPart.replace('L', '');
      } else {
        target.type = '3';
        target.appoint = cronPart.split(',');
      }
    }
  }
}

function submit() {
  const yearStr = value_year.value ? ` ${value_year.value}` : '';
  const cron = `${value_second.value} ${value_minute.value} ${value_hour.value} ${value_day.value} ${value_month.value} ${value_week.value}${yearStr}`;
  defaultValue.value = cron;
  emit('update:modelValue', cron);
  dialogVisible.value = false;
}

// =============== Lifecycle ===============
onMounted(() => {
  defaultValue.value = props.modelValue;
});
</script>

<!-- 模板部分保持不变 -->
<template>
  <ElInput v-model="defaultValue" v-bind="$attrs">
    <template #append>
      <ElDropdown size="medium" @command="handleShortcuts">
        <ElButton>
          <template #icon>
            <VbenIcon icon="ant-design:down-outlined" />
          </template>
        </ElButton>
        <template #dropdown>
          <ElDropdownMenu>
            <ElDropdownItem command="0 * * * * ?">每分钟</ElDropdownItem>
            <ElDropdownItem command="0 0 * * * ?">每小时</ElDropdownItem>
            <ElDropdownItem command="0 0 0 * * ?">每天零点</ElDropdownItem>
            <ElDropdownItem command="0 0 0 1 * ?">
              每月一号零点
            </ElDropdownItem>
            <ElDropdownItem command="0 0 0 L * ?">
              每月最后一天零点
            </ElDropdownItem>
            <ElDropdownItem command="0 0 0 ? * 1">
              每周星期日零点
            </ElDropdownItem>
            <ElDropdownItem
              v-for="(item, index) in shortcuts"
              :key="item.value"
              :divided="index === 0"
              :command="item.value"
            >
              {{ item.text }}
            </ElDropdownItem>
            <ElDropdownItem icon="el-icon-plus" divided command="custom">
              自定义
            </ElDropdownItem>
          </ElDropdownMenu>
        </template>
      </ElDropdown>
    </template>
  </ElInput>

  <ElDialog
    title="cron规则生成器"
    v-model="dialogVisible"
    :width="580"
    destroy-on-close
    append-to-body
  >
    <div class="sc-cron">
      <ElTabs>
        <!-- 秒 -->
        <ElTabPane>
          <template #label>
            <div class="sc-cron-num">
              <h2>秒</h2>
              <h4>{{ value_second }}</h4>
            </div>
          </template>
          <ElForm>
            <ElFormItem label="类型">
              <ElRadioGroup v-model="value.second.type">
                <ElRadioButton label="0">任意值</ElRadioButton>
                <ElRadioButton label="1">范围</ElRadioButton>
                <ElRadioButton label="2">间隔</ElRadioButton>
                <ElRadioButton label="3">指定</ElRadioButton>
              </ElRadioGroup>
            </ElFormItem>
            <ElFormItem label="范围" v-if="value.second.type === '1'">
              <ElInputNumber
                v-model.number="value.second.range.start"
                :min="0"
                :max="59"
                controls-position="right"
              />
              <span style="padding: 0 15px">-</span>
              <ElInputNumber
                v-model.number="value.second.range.end"
                :min="0"
                :max="59"
                controls-position="right"
              />
            </ElFormItem>
            <ElFormItem label="间隔" v-if="value.second.type === '2'">
              <ElInputNumber
                v-model.number="value.second.loop.start"
                :min="0"
                :max="59"
                controls-position="right"
              />
              秒开始，每
              <ElInputNumber
                v-model.number="value.second.loop.end"
                :min="1"
                :max="59"
                controls-position="right"
              />
              秒执行一次
            </ElFormItem>
            <ElFormItem label="指定" v-if="value.second.type === '3'">
              <ElSelect
                v-model="value.second.appoint"
                multiple
                style="width: 100%"
              >
                <ElOption
                  v-for="item in data.second"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </ElSelect>
            </ElFormItem>
          </ElForm>
        </ElTabPane>

        <!-- 分 -->
        <ElTabPane>
          <template #label>
            <div class="sc-cron-num">
              <h2>分钟</h2>
              <h4>{{ value_minute }}</h4>
            </div>
          </template>
          <ElForm>
            <ElFormItem label="类型">
              <ElRadioGroup v-model="value.minute.type">
                <ElRadioButton label="0">任意值</ElRadioButton>
                <ElRadioButton label="1">范围</ElRadioButton>
                <ElRadioButton label="2">间隔</ElRadioButton>
                <ElRadioButton label="3">指定</ElRadioButton>
              </ElRadioGroup>
            </ElFormItem>
            <ElFormItem label="范围" v-if="value.minute.type === '1'">
              <ElInputNumber
                v-model.number="value.minute.range.start"
                :min="0"
                :max="59"
                controls-position="right"
              />
              <span style="padding: 0 15px">-</span>
              <ElInputNumber
                v-model.number="value.minute.range.end"
                :min="0"
                :max="59"
                controls-position="right"
              />
            </ElFormItem>
            <ElFormItem label="间隔" v-if="value.minute.type === '2'">
              <ElInputNumber
                v-model.number="value.minute.loop.start"
                :min="0"
                :max="59"
                controls-position="right"
              />
              分钟开始，每
              <ElInputNumber
                v-model.number="value.minute.loop.end"
                :min="1"
                :max="59"
                controls-position="right"
              />
              分钟执行一次
            </ElFormItem>
            <ElFormItem label="指定" v-if="value.minute.type === '3'">
              <ElSelect
                v-model="value.minute.appoint"
                multiple
                style="width: 100%"
              >
                <ElOption
                  v-for="item in data.minute"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </ElSelect>
            </ElFormItem>
          </ElForm>
        </ElTabPane>

        <!-- 小时 -->
        <ElTabPane>
          <template #label>
            <div class="sc-cron-num">
              <h2>小时</h2>
              <h4>{{ value_hour }}</h4>
            </div>
          </template>
          <ElForm>
            <ElFormItem label="类型">
              <ElRadioGroup v-model="value.hour.type">
                <ElRadioButton label="0">任意值</ElRadioButton>
                <ElRadioButton label="1">范围</ElRadioButton>
                <ElRadioButton label="2">间隔</ElRadioButton>
                <ElRadioButton label="3">指定</ElRadioButton>
              </ElRadioGroup>
            </ElFormItem>
            <ElFormItem label="范围" v-if="value.hour.type === '1'">
              <ElInputNumber
                v-model.number="value.hour.range.start"
                :min="0"
                :max="23"
                controls-position="right"
              />
              <span style="padding: 0 15px">-</span>
              <ElInputNumber
                v-model.number="value.hour.range.end"
                :min="0"
                :max="23"
                controls-position="right"
              />
            </ElFormItem>
            <ElFormItem label="间隔" v-if="value.hour.type === '2'">
              <ElInputNumber
                v-model.number="value.hour.loop.start"
                :min="0"
                :max="23"
                controls-position="right"
              />
              小时开始，每
              <ElInputNumber
                v-model.number="value.hour.loop.end"
                :min="1"
                :max="23"
                controls-position="right"
              />
              小时执行一次
            </ElFormItem>
            <ElFormItem label="指定" v-if="value.hour.type === '3'">
              <ElSelect
                v-model="value.hour.appoint"
                multiple
                style="width: 100%"
              >
                <ElOption
                  v-for="item in data.hour"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </ElSelect>
            </ElFormItem>
          </ElForm>
        </ElTabPane>

        <!-- 日 -->
        <ElTabPane>
          <template #label>
            <div class="sc-cron-num">
              <h2>日</h2>
              <h4>{{ value_day }}</h4>
            </div>
          </template>
          <ElForm>
            <ElFormItem label="类型">
              <ElRadioGroup v-model="value.day.type">
                <ElRadioButton label="0">任意值</ElRadioButton>
                <ElRadioButton label="1">范围</ElRadioButton>
                <ElRadioButton label="2">间隔</ElRadioButton>
                <ElRadioButton label="3">指定</ElRadioButton>
                <ElRadioButton label="4">本月最后一天</ElRadioButton>
                <ElRadioButton label="5">不指定</ElRadioButton>
              </ElRadioGroup>
            </ElFormItem>
            <ElFormItem label="范围" v-if="value.day.type === '1'">
              <ElInputNumber
                v-model.number="value.day.range.start"
                :min="1"
                :max="31"
                controls-position="right"
              />
              <span style="padding: 0 15px">-</span>
              <ElInputNumber
                v-model.number="value.day.range.end"
                :min="1"
                :max="31"
                controls-position="right"
              />
            </ElFormItem>
            <ElFormItem label="间隔" v-if="value.day.type === '2'">
              <ElInputNumber
                v-model.number="value.day.loop.start"
                :min="1"
                :max="31"
                controls-position="right"
              />
              号开始，每
              <ElInputNumber
                v-model.number="value.day.loop.end"
                :min="1"
                :max="31"
                controls-position="right"
              />
              天执行一次
            </ElFormItem>
            <ElFormItem label="指定" v-if="value.day.type === '3'">
              <ElSelect
                v-model="value.day.appoint"
                multiple
                style="width: 100%"
              >
                <ElOption
                  v-for="item in data.day"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </ElSelect>
            </ElFormItem>
          </ElForm>
        </ElTabPane>

        <!-- 月 -->
        <ElTabPane>
          <template #label>
            <div class="sc-cron-num">
              <h2>月</h2>
              <h4>{{ value_month }}</h4>
            </div>
          </template>
          <ElForm>
            <ElFormItem label="类型">
              <ElRadioGroup v-model="value.month.type">
                <ElRadioButton label="0">任意值</ElRadioButton>
                <ElRadioButton label="1">范围</ElRadioButton>
                <ElRadioButton label="2">间隔</ElRadioButton>
                <ElRadioButton label="3">指定</ElRadioButton>
              </ElRadioGroup>
            </ElFormItem>
            <ElFormItem label="范围" v-if="value.month.type === '1'">
              <ElInputNumber
                v-model.number="value.month.range.start"
                :min="1"
                :max="12"
                controls-position="right"
              />
              <span style="padding: 0 15px">-</span>
              <ElInputNumber
                v-model.number="value.month.range.end"
                :min="1"
                :max="12"
                controls-position="right"
              />
            </ElFormItem>
            <ElFormItem label="间隔" v-if="value.month.type === '2'">
              <ElInputNumber
                v-model.number="value.month.loop.start"
                :min="1"
                :max="12"
                controls-position="right"
              />
              月开始，每
              <ElInputNumber
                v-model.number="value.month.loop.end"
                :min="1"
                :max="12"
                controls-position="right"
              />
              月执行一次
            </ElFormItem>
            <ElFormItem label="指定" v-if="value.month.type === '3'">
              <ElSelect
                v-model="value.month.appoint"
                multiple
                style="width: 100%"
              >
                <ElOption
                  v-for="item in data.month"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </ElSelect>
            </ElFormItem>
          </ElForm>
        </ElTabPane>

        <!-- 周 -->
        <ElTabPane>
          <template #label>
            <div class="sc-cron-num">
              <h2>周</h2>
              <h4>{{ value_week }}</h4>
            </div>
          </template>
          <ElForm>
            <ElFormItem label="类型">
              <ElRadioGroup v-model="value.week.type">
                <ElRadioButton label="0">任意值</ElRadioButton>
                <ElRadioButton label="1">范围</ElRadioButton>
                <ElRadioButton label="2">间隔</ElRadioButton>
                <ElRadioButton label="3">指定</ElRadioButton>
                <ElRadioButton label="4">本月最后一周</ElRadioButton>
                <ElRadioButton label="5">不指定</ElRadioButton>
              </ElRadioGroup>
            </ElFormItem>
            <ElFormItem label="范围" v-if="value.week.type === '1'">
              <ElSelect v-model="value.week.range.start" style="width: 120px">
                <ElOption
                  v-for="item in data.week"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </ElSelect>
              <span style="padding: 0 15px">-</span>
              <ElSelect v-model="value.week.range.end" style="width: 120px">
                <ElOption
                  v-for="item in data.week"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="间隔" v-if="value.week.type === '2'">
              第
              <ElInputNumber
                v-model.number="value.week.loop.start"
                :min="1"
                :max="5"
                controls-position="right"
              />
              周的星期
              <ElSelect v-model="value.week.loop.end" style="width: 100px">
                <ElOption
                  v-for="item in data.week"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </ElSelect>
              执行一次
            </ElFormItem>
            <ElFormItem label="指定" v-if="value.week.type === '3'">
              <ElSelect
                v-model="value.week.appoint"
                multiple
                style="width: 100%"
              >
                <ElOption
                  v-for="item in data.week"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="最后一周" v-if="value.week.type === '4'">
              <ElSelect v-model="value.week.last" style="width: 120px">
                <ElOption
                  v-for="item in data.week"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </ElSelect>
            </ElFormItem>
          </ElForm>
        </ElTabPane>

        <!-- 年 -->
        <ElTabPane>
          <template #label>
            <div class="sc-cron-num">
              <h2>年</h2>
              <h4>{{ value_year }}</h4>
            </div>
          </template>
          <ElForm>
            <ElFormItem label="类型">
              <ElRadioGroup v-model="value.year.type">
                <ElRadioButton label="-1">忽略</ElRadioButton>
                <ElRadioButton label="0">任意值</ElRadioButton>
                <ElRadioButton label="1">范围</ElRadioButton>
                <ElRadioButton label="2">间隔</ElRadioButton>
                <ElRadioButton label="3">指定</ElRadioButton>
              </ElRadioGroup>
            </ElFormItem>
            <ElFormItem label="范围" v-if="value.year.type === '1'">
              <ElInputNumber
                v-model.number="value.year.range.start"
                :min="yearList[0]"
                :max="yearList[yearList.length - 1]"
                controls-position="right"
              />
              <span style="padding: 0 15px">-</span>
              <ElInputNumber
                v-model.number="value.year.range.end"
                :min="yearList[0]"
                :max="yearList[yearList.length - 1]"
                controls-position="right"
              />
            </ElFormItem>
            <ElFormItem label="间隔" v-if="value.year.type === '2'">
              <ElInputNumber
                v-model.number="value.year.loop.start"
                :min="yearList[0]"
                :max="yearList[yearList.length - 1]"
                controls-position="right"
              />
              年开始，每
              <ElInputNumber
                v-model.number="value.year.loop.end"
                :min="1"
                controls-position="right"
              />
              年执行一次
            </ElFormItem>
            <ElFormItem label="指定" v-if="value.year.type === '3'">
              <ElSelect
                v-model="value.year.appoint"
                multiple
                style="width: 100%"
              >
                <ElOption
                  v-for="item in data.year"
                  :key="item"
                  :label="item"
                  :value="String(item)"
                />
              </ElSelect>
            </ElFormItem>
          </ElForm>
        </ElTabPane>
      </ElTabs>
    </div>

    <template #footer>
      <ElButton @click="dialogVisible = false">取 消</ElButton>
      <ElButton type="primary" @click="submit()">确 认</ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.sc-cron:deep(.el-tabs__item) {
  height: auto;
  padding: 0 7px;
  line-height: 1;
  vertical-align: bottom;
}

.sc-cron-num {
  width: 100%;
  margin-bottom: 15px;
  text-align: center;
}

.sc-cron-num h2 {
  margin-bottom: 15px;
  font-size: 12px;
  font-weight: normal;
}

.sc-cron-num h4 {
  display: block;
  width: 100%;
  height: 32px;
  padding: 0 15px;
  font-size: 12px;
  line-height: 30px;
  background: var(--el-color-primary-light-9);
  border-radius: 4px;
}

.sc-cron:deep(.el-tabs__item.is-active) .sc-cron-num h4 {
  color: #fff;
  background: var(--el-color-primary);
}

[data-theme='dark'] .sc-cron-num h4 {
  background: var(--el-color-white);
}
</style>
