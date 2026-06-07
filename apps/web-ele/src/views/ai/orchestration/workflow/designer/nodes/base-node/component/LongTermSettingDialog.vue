<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';

import {
  ElButton,
  ElCard,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElOption,
  ElSelect,
} from 'element-plus';

const emit = defineEmits<{
  refresh: [
    value: { trigger_setting: Record<string, any>; trigger_type: string },
  ];
}>();

const dialogVisible = ref(false);
const form = ref({
  trigger_setting: {
    cron_expression: '',
    interval_unit: 'day',
    interval_value: 1,
    rounds: 10,
    schedule_type: 'daily',
    time: '00:00',
  } as Record<string, any>,
  trigger_type: 'ROUND',
});

const scheduleLabel = computed(() =>
  form.value.trigger_setting.schedule_type === 'cron'
    ? 'Cron 表达式'
    : '触发周期',
);

function defaultScheduleSetting() {
  return {
    cron_expression: '',
    interval_unit: 'day',
    interval_value: 1,
    schedule_type: 'daily',
    time: '00:00',
  };
}

function open(type?: string, setting?: Record<string, any>) {
  const triggerType = type || 'ROUND';
  form.value = {
    trigger_setting:
      triggerType === 'SCHEDULED'
        ? { ...defaultScheduleSetting(), ...setting }
        : { rounds: Number(setting?.rounds || 10) },
    trigger_type: triggerType,
  };
  dialogVisible.value = true;
}

function close() {
  dialogVisible.value = false;
}

function changeTriggerType(type: string) {
  form.value.trigger_type = type;
  form.value.trigger_setting =
    type === 'SCHEDULED' ? defaultScheduleSetting() : { rounds: 10 };
}

function switchScheduleType() {
  const setting = form.value.trigger_setting;
  if (setting.schedule_type === 'cron') {
    form.value.trigger_setting = {
      ...defaultScheduleSetting(),
      schedule_type: 'daily',
    };
    return;
  }
  form.value.trigger_setting = {
    cron_expression: setting.cron_expression || '',
    schedule_type: 'cron',
  };
}

async function submit() {
  const data = {
    trigger_setting: { ...form.value.trigger_setting },
    trigger_type: form.value.trigger_type,
  };
  dialogVisible.value = false;
  await nextTick();
  emit('refresh', data);
}

defineExpose({ open });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    title="长期记忆设置"
    append-to-body
    width="560"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
  >
    <ElForm :model="form" label-position="top" @submit.prevent>
      <ElFormItem label="触发方式" required>
        <div class="long-term-setting__cards">
          <ElCard
            shadow="never"
            class="long-term-setting__card"
            :class="{ 'is-active': form.trigger_type === 'ROUND' }"
            @click="changeTriggerType('ROUND')"
          >
            <strong>轮次触发</strong>
            <small>累计对话达到指定轮数后总结长期记忆</small>
          </ElCard>
          <ElCard
            shadow="never"
            class="long-term-setting__card"
            :class="{ 'is-active': form.trigger_type === 'SCHEDULED' }"
            @click="changeTriggerType('SCHEDULED')"
          >
            <strong>定时触发</strong>
            <small>按周期或 Cron 表达式总结长期记忆</small>
          </ElCard>
        </div>
      </ElFormItem>

      <ElFormItem
        v-if="form.trigger_type === 'ROUND'"
        label="触发间隔"
        required
      >
        <ElInputNumber
          v-model="form.trigger_setting.rounds"
          :min="5"
          :max="100"
          controls-position="right"
        />
      </ElFormItem>

      <template v-if="form.trigger_type === 'SCHEDULED'">
        <ElFormItem :label="scheduleLabel" required>
          <div class="long-term-setting__schedule-head">
            <ElButton
              size="small"
              text
              type="primary"
              @click="switchScheduleType"
            >
              {{
                form.trigger_setting.schedule_type === 'cron'
                  ? '切换周期'
                  : '切换 Cron'
              }}
            </ElButton>
          </div>
          <ElInput
            v-if="form.trigger_setting.schedule_type === 'cron'"
            v-model="form.trigger_setting.cron_expression"
            placeholder="例如 0 0 * * *"
          />
          <div v-else class="long-term-setting__schedule-grid">
            <ElSelect v-model="form.trigger_setting.schedule_type" size="small">
              <ElOption label="每天" value="daily" />
              <ElOption label="每周" value="weekly" />
              <ElOption label="每月" value="monthly" />
              <ElOption label="间隔" value="interval" />
            </ElSelect>
            <ElInput v-model="form.trigger_setting.time" placeholder="00:00" />
            <ElInputNumber
              v-if="form.trigger_setting.schedule_type === 'interval'"
              v-model="form.trigger_setting.interval_value"
              :min="1"
              controls-position="right"
            />
          </div>
        </ElFormItem>
      </template>
    </ElForm>
    <template #footer>
      <ElButton @click="close">取消</ElButton>
      <ElButton type="primary" @click="submit">保存</ElButton>
    </template>
  </ElDialog>
</template>

<style scoped lang="scss">
.long-term-setting__cards,
.long-term-setting__schedule-grid {
  display: grid;
  gap: 8px;
  width: 100%;
}

.long-term-setting__card {
  cursor: pointer;
  border-color: var(--el-border-color-lighter);
}

.long-term-setting__card.is-active {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-9);
}

.long-term-setting__card strong,
.long-term-setting__card small {
  display: block;
}

.long-term-setting__card small {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
}

.long-term-setting__schedule-head {
  display: flex;
  justify-content: flex-end;
  width: 100%;
  margin-bottom: 6px;
}

.long-term-setting__schedule-grid {
  grid-template-columns: minmax(0, 1fr) 96px auto;
}
</style>
