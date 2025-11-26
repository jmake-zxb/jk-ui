<script setup lang="ts">
import type { PropType } from 'vue';

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

interface Shortcut {
  value: string;
  text: string;
}

// 允许 number | undefined，以兼容 input-number 清空时的行为
interface BasicConfig {
  type: string;
  range: { end: number | undefined; start: number | undefined };
  loop: { end: number | undefined; start: number | undefined };
  appoint: string[];
}

interface WeekConfig {
  type: string;
  range: { end: string; start: string };
  loop: { end: string; start: number | undefined };
  last: string;
  appoint: string[];
}

interface YearConfig {
  type: string;
  range: { end: number | undefined; start: number | undefined };
  loop: { end: number | undefined; start: number | undefined };
  appoint: string[];
}

interface CronValue {
  second: BasicConfig;
  minute: BasicConfig;
  hour: BasicConfig;
  day: BasicConfig;
  month: BasicConfig;
  week: WeekConfig;
  year: YearConfig;
}

const props = defineProps({
  modelValue: {
    type: String,
    default: '* * * * * ?',
  },
  shortcuts: {
    type: Array as PropType<Shortcut[]>,
    default: () => [],
  },
});

const emit = defineEmits(['update:modelValue']);

const defaultValue = ref('');
const dialogVisible = ref(false);

const getYear = (): number[] => {
  const v: number[] = [];
  const y = new Date().getFullYear();
  for (let i = 0; i < 11; i++) {
    v.push(y + i);
  }
  return v;
};

const value = reactive<CronValue>({
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
    range: { start: getYear()[0], end: getYear()[1] },
    loop: { start: getYear()[0], end: 1 },
    appoint: [],
  },
});

const dateOptions = reactive({
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
  hour: [
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12',
    '13',
    '14',
    '15',
    '16',
    '17',
    '18',
    '19',
    '20',
    '21',
    '22',
    '23',
  ],
  day: [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12',
    '13',
    '14',
    '15',
    '16',
    '17',
    '18',
    '19',
    '20',
    '21',
    '22',
    '23',
    '24',
    '25',
    '26',
    '27',
    '28',
    '29',
    '30',
    '31',
  ],
  month: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
  week: [
    { value: '1', label: '周日' },
    { value: '2', label: '周一' },
    { value: '3', label: '周二' },
    { value: '4', label: '周三' },
    { value: '5', label: '周四' },
    { value: '6', label: '周五' },
    { value: '7', label: '周六' },
  ],
  year: getYear(),
});

const getRangeStr = (v: BasicConfig | YearConfig) => {
  return `${v.range.start ?? 0}-${v.range.end ?? 0}`;
};

const getLoopStr = (v: BasicConfig | YearConfig) => {
  return `${v.loop.start ?? 0}/${v.loop.end ?? 0}`;
};

// Computed properties
const value_second = computed(() => {
  const v = value.second;
  if (v.type === '0') return '*';
  if (v.type === '1') return getRangeStr(v);
  if (v.type === '2') return getLoopStr(v);
  if (v.type === '3') return v.appoint.length > 0 ? v.appoint.join(',') : '*';
  return '*';
});

const value_minute = computed(() => {
  const v = value.minute;
  if (v.type === '0') return '*';
  if (v.type === '1') return getRangeStr(v);
  if (v.type === '2') return getLoopStr(v);
  if (v.type === '3') return v.appoint.length > 0 ? v.appoint.join(',') : '*';
  return '*';
});

const value_hour = computed(() => {
  const v = value.hour;
  if (v.type === '0') return '*';
  if (v.type === '1') return getRangeStr(v);
  if (v.type === '2') return getLoopStr(v);
  if (v.type === '3') return v.appoint.length > 0 ? v.appoint.join(',') : '*';
  return '*';
});

const value_day = computed(() => {
  const v = value.day;
  if (v.type === '0') return '*';
  if (v.type === '1') return getRangeStr(v);
  if (v.type === '2') return getLoopStr(v);
  if (v.type === '3') return v.appoint.length > 0 ? v.appoint.join(',') : '*';
  if (v.type === '4') return 'L';
  if (v.type === '5') return '?';
  return '*';
});

const value_month = computed(() => {
  const v = value.month;
  if (v.type === '0') return '*';
  if (v.type === '1') return getRangeStr(v);
  if (v.type === '2') return getLoopStr(v);
  if (v.type === '3') return v.appoint.length > 0 ? v.appoint.join(',') : '*';
  return '*';
});

const value_week = computed(() => {
  const v = value.week;
  if (v.type === '0') return '*';
  if (v.type === '1') return `${v.range.start}-${v.range.end}`;
  if (v.type === '2') return `${v.loop.end}#${v.loop.start ?? 1}`;
  if (v.type === '3') return v.appoint.length > 0 ? v.appoint.join(',') : '*';
  if (v.type === '4') return `${v.last}L`;
  if (v.type === '5') return '?';
  return '*';
});

const value_year = computed(() => {
  const v = value.year;
  if (v.type === '-1') return '';
  if (v.type === '0') return '*';
  if (v.type === '1') return getRangeStr(v);
  if (v.type === '2') return getLoopStr(v);
  if (v.type === '3') return v.appoint.length > 0 ? v.appoint.join(',') : '';
  return '';
});

// Watchers
watch(
  () => value.week.type,
  (val) => {
    if (val !== '5') {
      value.day.type = '5';
    }
  },
);

watch(
  () => value.day.type,
  (val) => {
    if (val !== '5') {
      value.week.type = '5';
    }
  },
);

watch(
  () => props.modelValue,
  () => {
    defaultValue.value = props.modelValue;
  },
);

// Methods
const set = () => {
  defaultValue.value = props.modelValue;
  // 使用正则分割以处理多个空格的情况
  let arr: string[] = (props.modelValue || '* * * * * ?').trim().split(/\s+/);

  // 简单检查，如果不足6位，重置为默认
  if (arr.length < 6) {
    ElMessage.warning('cron表达式错误，已转换为默认表达式');
    arr = ['*', '*', '*', '*', '*', '?'];
  }

  // 使用解构赋值提供默认值，彻底解决 "undefined" 类型报错
  // year (index 6) 是可选的，所以这里允许 undefined
  const [
    sec = '*',
    min = '*',
    hour = '*',
    day = '*',
    month = '*',
    week = '?',
    year,
  ] = arr;

  // 秒
  if (sec === '*') {
    value.second.type = '0';
  } else if (sec.includes('-')) {
    value.second.type = '1';
    value.second.range.start = Number(sec.split('-')[0]);
    value.second.range.end = Number(sec.split('-')[1]);
  } else if (sec.includes('/')) {
    value.second.type = '2';
    value.second.loop.start = Number(sec.split('/')[0]);
    value.second.loop.end = Number(sec.split('/')[1]);
  } else {
    value.second.type = '3';
    value.second.appoint = sec.split(',');
  }

  // 分
  if (min === '*') {
    value.minute.type = '0';
  } else if (min.includes('-')) {
    value.minute.type = '1';
    value.minute.range.start = Number(min.split('-')[0]);
    value.minute.range.end = Number(min.split('-')[1]);
  } else if (min.includes('/')) {
    value.minute.type = '2';
    value.minute.loop.start = Number(min.split('/')[0]);
    value.minute.loop.end = Number(min.split('/')[1]);
  } else {
    value.minute.type = '3';
    value.minute.appoint = min.split(',');
  }

  // 小时
  if (hour === '*') {
    value.hour.type = '0';
  } else if (hour.includes('-')) {
    value.hour.type = '1';
    value.hour.range.start = Number(hour.split('-')[0]);
    value.hour.range.end = Number(hour.split('-')[1]);
  } else if (hour.includes('/')) {
    value.hour.type = '2';
    value.hour.loop.start = Number(hour.split('/')[0]);
    value.hour.loop.end = Number(hour.split('/')[1]);
  } else {
    value.hour.type = '3';
    value.hour.appoint = hour.split(',');
  }

  // 日
  switch (day) {
    case '*': {
      value.day.type = '0';

      break;
    }
    case '?': {
      value.day.type = '5';

      break;
    }
    case 'L': {
      value.day.type = '4';

      break;
    }
    default: {
      if (day.includes('-')) {
        value.day.type = '1';
        value.day.range.start = Number(day.split('-')[0]);
        value.day.range.end = Number(day.split('-')[1]);
      } else if (day.includes('/')) {
        value.day.type = '2';
        value.day.loop.start = Number(day.split('/')[0]);
        value.day.loop.end = Number(day.split('/')[1]);
      } else {
        value.day.type = '3';
        value.day.appoint = day.split(',');
      }
    }
  }

  // 月
  if (month === '*') {
    value.month.type = '0';
  } else if (month.includes('-')) {
    value.month.type = '1';
    value.month.range.start = Number(month.split('-')[0]);
    value.month.range.end = Number(month.split('-')[1]);
  } else if (month.includes('/')) {
    value.month.type = '2';
    value.month.loop.start = Number(month.split('/')[0]);
    value.month.loop.end = Number(month.split('/')[1]);
  } else {
    value.month.type = '3';
    value.month.appoint = month.split(',');
  }

  // 周
  if (week === '*') {
    value.week.type = '0';
  } else if (week === '?') {
    value.week.type = '5';
  } else if (week.includes('-')) {
    value.week.type = '1';
    value.week.range.start = week.split('-')[0] || '';
    value.week.range.end = week.split('-')[1] || '';
  } else if (week.includes('#')) {
    value.week.type = '2';
    // 安全处理 Number 转换
    value.week.loop.start = Number(week.split('#')[1]);
    value.week.loop.end = week.split('#')[0] || '';
  } else if (week.includes('L')) {
    value.week.type = '4';
    value.week.last = week.split('L')[0] || '';
  } else {
    value.week.type = '3';
    value.week.appoint = week.split(',');
  }

  // 年 (Optional)
  if (!year) {
    value.year.type = '-1';
  } else if (year === '*') {
    value.year.type = '0';
  } else if (year.includes('-')) {
    value.year.type = '1';
    value.year.range.start = Number(year.split('-')[0]);
    value.year.range.end = Number(year.split('-')[1]);
  } else if (year.includes('/')) {
    value.year.type = '2';
    value.year.loop.start = Number(year.split('/')[0]);
    value.year.loop.end = Number(year.split('/')[1]);
  } else {
    value.year.type = '3';
    value.year.appoint = year.split(',');
  }
};

const open = () => {
  set();
  dialogVisible.value = true;
};

const submit = () => {
  const year = value_year.value ? ` ${value_year.value}` : '';
  defaultValue.value = `${value_second.value} ${value_minute.value} ${
    value_hour.value
  } ${value_day.value} ${value_month.value} ${value_week.value}${year}`;
  emit('update:modelValue', defaultValue.value);
  dialogVisible.value = false;
};

const handleShortcuts = (command: string) => {
  if (command === 'custom') {
    open();
  } else {
    defaultValue.value = command;
    emit('update:modelValue', defaultValue.value);
  }
};

const handleClear = () => {
  defaultValue.value = '';
  emit('update:modelValue', '');
};

onMounted(() => {
  defaultValue.value = props.modelValue;
});
</script>

<template>
  <ElInput v-model="defaultValue" v-bind="$attrs">
    <!-- 手动实现 clearable -->
    <template #suffix>
      {{ defaultValue }}
      <VbenIcon
        v-if="defaultValue && defaultValue !== ''"
        icon="ant-design:close-circle-twotone"
        @click="handleClear"
      />
    </template>
    <template #append>
      <ElDropdown size="medium" @command="handleShortcuts">
        <ElButton>
          <VbenIcon icon="ant-design:down-outlined" />
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
            <ElDropdownItem divided command="custom">
              <VbenIcon icon="ant-design:plus-outlined" />
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
                <ElRadioButton value="0">任意值</ElRadioButton>
                <ElRadioButton value="1">范围</ElRadioButton>
                <ElRadioButton value="2">间隔</ElRadioButton>
                <ElRadioButton value="3">指定</ElRadioButton>
              </ElRadioGroup>
            </ElFormItem>
            <ElFormItem label="范围" v-if="value.second.type === '1'">
              <ElInputNumber
                v-model="value.second.range.start"
                :min="0"
                :max="59"
                controls-position="right"
              />
              <span style="padding: 0 15px">-</span>
              <ElInputNumber
                v-model="value.second.range.end"
                :min="0"
                :max="59"
                controls-position="right"
              />
            </ElFormItem>
            <ElFormItem label="间隔" v-if="value.second.type === '2'">
              <ElInputNumber
                v-model="value.second.loop.start"
                :min="0"
                :max="59"
                controls-position="right"
              />
              秒开始，每
              <ElInputNumber
                v-model="value.second.loop.end"
                :min="0"
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
                  v-for="(item, index) in dateOptions.second"
                  :key="index"
                  :label="item"
                  :value="item"
                />
              </ElSelect>
            </ElFormItem>
          </ElForm>
        </ElTabPane>
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
                <ElRadioButton value="0">任意值</ElRadioButton>
                <ElRadioButton value="1">范围</ElRadioButton>
                <ElRadioButton value="2">间隔</ElRadioButton>
                <ElRadioButton value="3">指定</ElRadioButton>
              </ElRadioGroup>
            </ElFormItem>
            <ElFormItem label="范围" v-if="value.minute.type === '1'">
              <ElInputNumber
                v-model="value.minute.range.start"
                :min="0"
                :max="59"
                controls-position="right"
              />
              <span style="padding: 0 15px">-</span>
              <ElInputNumber
                v-model="value.minute.range.end"
                :min="0"
                :max="59"
                controls-position="right"
              />
            </ElFormItem>
            <ElFormItem label="间隔" v-if="value.minute.type === '2'">
              <ElInputNumber
                v-model="value.minute.loop.start"
                :min="0"
                :max="59"
                controls-position="right"
              />
              分钟开始，每
              <ElInputNumber
                v-model="value.minute.loop.end"
                :min="0"
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
                  v-for="(item, index) in dateOptions.minute"
                  :key="index"
                  :label="item"
                  :value="item"
                />
              </ElSelect>
            </ElFormItem>
          </ElForm>
        </ElTabPane>
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
                <ElRadioButton value="0">任意值</ElRadioButton>
                <ElRadioButton value="1">范围</ElRadioButton>
                <ElRadioButton value="2">间隔</ElRadioButton>
                <ElRadioButton value="3">指定</ElRadioButton>
              </ElRadioGroup>
            </ElFormItem>
            <ElFormItem label="范围" v-if="value.hour.type === '1'">
              <ElInputNumber
                v-model="value.hour.range.start"
                :min="0"
                :max="23"
                controls-position="right"
              />
              <span style="padding: 0 15px">-</span>
              <ElInputNumber
                v-model="value.hour.range.end"
                :min="0"
                :max="23"
                controls-position="right"
              />
            </ElFormItem>
            <ElFormItem label="间隔" v-if="value.hour.type === '2'">
              <ElInputNumber
                v-model="value.hour.loop.start"
                :min="0"
                :max="23"
                controls-position="right"
              />
              小时开始，每
              <ElInputNumber
                v-model="value.hour.loop.end"
                :min="0"
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
                  v-for="(item, index) in dateOptions.hour"
                  :key="index"
                  :label="item"
                  :value="item"
                />
              </ElSelect>
            </ElFormItem>
          </ElForm>
        </ElTabPane>
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
                <ElRadioButton value="0">任意值</ElRadioButton>
                <ElRadioButton value="1">范围</ElRadioButton>
                <ElRadioButton value="2">间隔</ElRadioButton>
                <ElRadioButton value="3">指定</ElRadioButton>
                <ElRadioButton value="4">本月最后一天</ElRadioButton>
                <ElRadioButton value="5">不指定</ElRadioButton>
              </ElRadioGroup>
            </ElFormItem>
            <ElFormItem label="范围" v-if="value.day.type === '1'">
              <ElInputNumber
                v-model="value.day.range.start"
                :min="1"
                :max="31"
                controls-position="right"
              />
              <span style="padding: 0 15px">-</span>
              <ElInputNumber
                v-model="value.day.range.end"
                :min="1"
                :max="31"
                controls-position="right"
              />
            </ElFormItem>
            <ElFormItem label="间隔" v-if="value.day.type === '2'">
              <ElInputNumber
                v-model="value.day.loop.start"
                :min="1"
                :max="31"
                controls-position="right"
              />
              号开始，每
              <ElInputNumber
                v-model="value.day.loop.end"
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
                  v-for="(item, index) in dateOptions.day"
                  :key="index"
                  :label="item"
                  :value="item"
                />
              </ElSelect>
            </ElFormItem>
          </ElForm>
        </ElTabPane>
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
                <ElRadioButton value="0">任意值</ElRadioButton>
                <ElRadioButton value="1">范围</ElRadioButton>
                <ElRadioButton value="2">间隔</ElRadioButton>
                <ElRadioButton value="3">指定</ElRadioButton>
              </ElRadioGroup>
            </ElFormItem>
            <ElFormItem label="范围" v-if="value.month.type === '1'">
              <ElInputNumber
                v-model="value.month.range.start"
                :min="1"
                :max="12"
                controls-position="right"
              />
              <span style="padding: 0 15px">-</span>
              <ElInputNumber
                v-model="value.month.range.end"
                :min="1"
                :max="12"
                controls-position="right"
              />
            </ElFormItem>
            <ElFormItem label="间隔" v-if="value.month.type === '2'">
              <ElInputNumber
                v-model="value.month.loop.start"
                :min="1"
                :max="12"
                controls-position="right"
              />
              月开始，每
              <ElInputNumber
                v-model="value.month.loop.end"
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
                  v-for="(item, index) in dateOptions.month"
                  :key="index"
                  :label="item"
                  :value="item"
                />
              </ElSelect>
            </ElFormItem>
          </ElForm>
        </ElTabPane>
        <ElTabPane>
          <template #label>
            <div class="sc-cron-num">
              <h2>周</h2>
              <h4>{{ value_week }}</h4>
            </div>
          </template>
          <ElForm>
            <ElForm>
              <ElFormItem label="类型">
                <ElRadioGroup v-model="value.week.type">
                  <ElRadioButton value="0">任意值</ElRadioButton>
                  <ElRadioButton value="1">范围</ElRadioButton>
                  <ElRadioButton value="2">间隔</ElRadioButton>
                  <ElRadioButton value="3">指定</ElRadioButton>
                  <ElRadioButton value="4">本月最后一周</ElRadioButton>
                  <ElRadioButton value="5">不指定</ElRadioButton>
                </ElRadioGroup>
              </ElFormItem>
              <ElFormItem label="范围" v-if="value.week.type === '1'">
                <ElSelect v-model="value.week.range.start">
                  <ElOption
                    v-for="(item, index) in dateOptions.week"
                    :key="index"
                    :label="item.label"
                    :value="item.value"
                  />
                </ElSelect>
                <span style="padding: 0 15px">-</span>
                <ElSelect v-model="value.week.range.end">
                  <ElOption
                    v-for="(item, index) in dateOptions.week"
                    :key="index"
                    :label="item.label"
                    :value="item.value"
                  />
                </ElSelect>
              </ElFormItem>
              <ElFormItem label="间隔" v-if="value.week.type === '2'">
                第
                <ElInputNumber
                  v-model="value.week.loop.start"
                  :min="1"
                  :max="4"
                  controls-position="right"
                />
                周的星期
                <ElSelect v-model="value.week.loop.end">
                  <ElOption
                    v-for="(item, index) in dateOptions.week"
                    :key="index"
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
                    v-for="(item, index) in dateOptions.week"
                    :key="index"
                    :label="item.label"
                    :value="item.value"
                  />
                </ElSelect>
              </ElFormItem>
              <ElFormItem label="最后一周" v-if="value.week.type === '4'">
                <ElSelect v-model="value.week.last">
                  <ElOption
                    v-for="(item, index) in dateOptions.week"
                    :key="index"
                    :label="item.label"
                    :value="item.value"
                  />
                </ElSelect>
              </ElFormItem>
            </ElForm>
          </ElForm>
        </ElTabPane>
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
                <ElRadioButton value="-1">忽略</ElRadioButton>
                <ElRadioButton value="0">任意值</ElRadioButton>
                <ElRadioButton value="1">范围</ElRadioButton>
                <ElRadioButton value="2">间隔</ElRadioButton>
                <ElRadioButton value="3">指定</ElRadioButton>
              </ElRadioGroup>
            </ElFormItem>
            <ElFormItem label="范围" v-if="value.year.type === '1'">
              <ElInputNumber
                v-model="value.year.range.start"
                controls-position="right"
              />
              <span style="padding: 0 15px">-</span>
              <ElInputNumber
                v-model="value.year.range.end"
                controls-position="right"
              />
            </ElFormItem>
            <ElFormItem label="间隔" v-if="value.year.type === '2'">
              <ElInputNumber
                v-model="value.year.loop.start"
                controls-position="right"
              />
              年开始，每
              <ElInputNumber
                v-model="value.year.loop.end"
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
                  v-for="(item, index) in dateOptions.year"
                  :key="index"
                  :label="item"
                  :value="item"
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
