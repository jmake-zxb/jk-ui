<script setup lang="ts">
import type {
  Id,
  JsonRecord,
  SourceOption,
  TriggerRecord,
} from './trigger-utils';

import type {
  TriggerRequest,
  TriggerTaskRequest,
  TriggerTaskSourceValue,
  TriggerTypeValue,
} from '#/api/ai/triggers';

import { computed, reactive, ref } from 'vue';

import {
  ArrowDown,
  Bell,
  Clock,
  CopyDocument,
  Delete,
  Plus,
  Refresh,
} from '@element-plus/icons-vue';
import {
  ElButton,
  ElCard,
  ElCol,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElRadioButton,
  ElRadioGroup,
  ElRow,
  ElSelect,
  ElSwitch,
  ElTag,
} from 'element-plus';

import {
  getApplication,
  getWorkflowDraft,
  listApplications,
} from '#/api/ai/applications';
import { getToolWorkflow } from '#/api/ai/tool-workflow';
import { getTool, listTools } from '#/api/ai/tools';
import {
  createResourceTrigger,
  createTrigger,
  getResourceTrigger,
  getTrigger,
  updateResourceTrigger,
  updateTrigger,
  webhookTriggerUrl,
} from '#/api/ai/triggers';

import { recordsOf } from '../utils';
import ApplicationParameter from './component/ApplicationParameter.vue';
import ToolParameter from './component/ToolParameter.vue';
import {
  arrayValue,
  defaultParameter,
  normalizeSetting,
  normalizeSourceType,
  normalizeTask,
  normalizeTriggerRecord,
  normalizeTriggerType,
  objectValue,
  parseAny,
  parseListValue,
  scheduleLabel,
  sourceDisplayType,
  textValue,
  token,
} from './trigger-utils';

interface OpenOptions {
  applicationId?: Id;
  resourceId?: Id;
  resourceType?: TriggerTaskSourceValue;
  workspaceId?: string;
}

const props = withDefaults(
  defineProps<{
    workspaceId?: string;
  }>(),
  {
    workspaceId: 'default',
  },
);

const emit = defineEmits<{
  refresh: [];
}>();

const visible = ref(false);
const saving = ref(false);
const sourceLoading = ref(false);
const editingId = ref<Id>();
const resourceType = ref<TriggerTaskSourceValue>();
const resourceId = ref<Id>();
const expandedTaskKey = ref('');
const applicationSelect = ref<Id>();
const toolSelect = ref<Id>();

const applications = ref<SourceOption[]>([]);
const tools = ref<SourceOption[]>([]);

const form = reactive<any>(emptyForm());

const sourceOptions = computed(() => [...applications.value, ...tools.value]);
const applicationOptions = computed(() =>
  applications.value.filter((item) => !hasTask('APPLICATION', item.id)),
);
const toolOptions = computed(() =>
  tools.value.filter((item) => !hasTask('TOOL', item.id)),
);
const isResourceMode = computed(() =>
  Boolean(resourceType.value && resourceId.value),
);
const drawerTitle = computed(() =>
  editingId.value ? '编辑触发器' : '新建触发器',
);
const formWebhookUrl = computed(() =>
  editingId.value
    ? absoluteWebhookUrl(editingId.value)
    : '保存后生成 Webhook 地址',
);

function emptyForm() {
  return {
    desc: '',
    enabled: true,
    is_active: true,
    name: '',
    trigger_setting: {
      body: [],
      schedule_type: 'daily',
      time: ['09:00'],
      token: token(),
    },
    trigger_task: [] as TriggerTaskRequest[],
    trigger_type: 'SCHEDULED' as TriggerTypeValue,
    workspace_id: props.workspaceId,
  };
}

function resetForm(workspaceId = props.workspaceId) {
  Object.assign(form, emptyForm(), {
    workspace_id: workspaceId || 'default',
  });
  editingId.value = undefined;
  expandedTaskKey.value = '';
  applicationSelect.value = undefined;
  toolSelect.value = undefined;
}

async function open(row?: TriggerRecord | undefined, options?: OpenOptions) {
  const workspace = options?.workspaceId || props.workspaceId || 'default';
  resourceType.value = options?.resourceType;
  resourceId.value = options?.resourceId;
  resetForm(workspace);
  await loadSources();

  if (row?.id) {
    editingId.value = row.id;
    const raw = isResourceMode.value
      ? await getResourceTrigger(resourceType.value!, resourceId.value!, row.id)
      : await getTrigger(row.id);
    const detail = normalizeDetail(raw as JsonRecord);
    Object.assign(form, {
      desc: detail.desc || '',
      enabled: detail.is_active !== false,
      is_active: detail.is_active !== false,
      name: detail.name || '',
      trigger_setting: normalizeSetting(
        detail.trigger_type,
        detail.trigger_setting,
      ),
      trigger_task: detail.trigger_task || [],
      trigger_type: detail.trigger_type || 'SCHEDULED',
      workspace_id: detail.workspace_id || workspace,
    });
    await hydrateTaskSources();
  } else if (resourceType.value && resourceId.value) {
    await addSourceTask(resourceType.value, resourceId.value);
  } else if (options?.applicationId) {
    await addSourceTask('APPLICATION', options.applicationId);
  }

  visible.value = true;
}

function normalizeDetail(raw: JsonRecord) {
  const copy = { ...raw };
  if (copy.trigger_task && !Array.isArray(copy.trigger_task)) {
    copy.trigger_task = [copy.trigger_task];
  }
  return normalizeTriggerRecord(copy);
}

async function loadSources() {
  sourceLoading.value = true;
  try {
    const [appData, toolData] = await Promise.all([
      listApplications(),
      listTools({ size: 1000 }),
    ]);
    applications.value = recordsOf<JsonRecord>(appData).map((item) =>
      applicationOption(item),
    );
    tools.value = recordsOf<JsonRecord>(toolData).map((item) =>
      toolOption(item),
    );
  } finally {
    sourceLoading.value = false;
  }
}

function applicationOption(item: JsonRecord): SourceOption {
  return {
    description: textValue(item.description || item.desc),
    icon: textValue(item.icon),
    id: item.id,
    name: textValue(item.name, '未命名应用'),
    source_type: 'APPLICATION',
    type: textValue(item.type),
    work_flow: objectValue(item.work_flow || item.workFlow),
  };
}

function toolOption(item: JsonRecord): SourceOption {
  return {
    description: textValue(item.description || item.desc),
    icon: textValue(item.icon),
    id: item.id,
    input_field_list: parseListValue(
      item.input_field_list || item.inputFieldList,
    ),
    name: textValue(item.name, '未命名工具'),
    source_type: 'TOOL',
    type: textValue(item.tool_type || item.toolType || item.type),
    work_flow: objectValue(item.work_flow || item.workFlow),
  };
}

function hasTask(type: TriggerTaskSourceValue, id: Id) {
  return (form.trigger_task || []).some(
    (task: JsonRecord) =>
      normalizeSourceType(task.source_type || task.sourceType) === type &&
      String(task.source_id || task.sourceId) === String(id),
  );
}

async function addSourceTask(
  sourceType: TriggerTaskSourceValue,
  sourceId?: Id,
) {
  if (!sourceId || hasTask(sourceType, sourceId)) return;
  const source = await sourceDetail(sourceType, sourceId);
  const task: TriggerTaskRequest = {
    enabled: true,
    is_active: true,
    parameter: defaultParameter(sourceType, source),
    source_id: sourceId,
    source_type: sourceType,
  };
  form.trigger_task = [...(form.trigger_task || []), task];
  expandedTaskKey.value = taskKey(task);
}

function removeTask(index: number | string) {
  if (isResourceMode.value) return;
  const targetIndex = Number(index);
  form.trigger_task = [...(form.trigger_task || [])].filter(
    (_: unknown, i: number) => i !== targetIndex,
  );
}

async function hydrateTaskSources() {
  await Promise.all(
    (form.trigger_task || []).map(async (task: TriggerTaskRequest) => {
      const sourceType = normalizeSourceType(
        task.source_type || task.sourceType,
      );
      const sourceId = task.source_id || task.sourceId;
      if (sourceType && sourceId) await sourceDetail(sourceType, sourceId);
      task.parameter = objectValue(task.parameter);
    }),
  );
}

async function sourceDetail(sourceType: TriggerTaskSourceValue, sourceId: Id) {
  let existing = sourceOptions.value.find(
    (item) =>
      item.source_type === sourceType && String(item.id) === String(sourceId),
  );
  if (sourceType === 'TOOL' && existing?.input_field_list?.length) {
    await hydrateToolWorkflow(existing);
    return existing;
  }
  if (sourceType === 'APPLICATION' && existing?.work_flow?.nodes) {
    return existing;
  }

  if (sourceType === 'APPLICATION') {
    const detail = (await getApplication(sourceId)) as JsonRecord;
    existing = applicationOption(detail);
    await hydrateApplicationWorkflow(existing);
    upsertSource(applications.value, existing);
    return existing;
  }

  const detail = (await getTool(sourceId)) as JsonRecord;
  existing = toolOption(detail);
  await hydrateToolWorkflow(existing);
  upsertSource(tools.value, existing);
  return existing;
}

async function hydrateApplicationWorkflow(source: SourceOption) {
  if (source.work_flow?.nodes) return;
  try {
    const draft = (await getWorkflowDraft(source.id)) as JsonRecord;
    source.work_flow = objectValue(
      parseAny(draft.graphData || draft.graph_data || draft.work_flow),
    );
  } catch {
    source.work_flow = objectValue(source.work_flow);
  }
}

async function hydrateToolWorkflow(source: SourceOption) {
  if (source.work_flow?.nodes || source.type !== 'WORKFLOW') return;
  try {
    const workflow = (await getToolWorkflow(source.id)) as JsonRecord;
    source.work_flow = objectValue(
      parseAny(workflow.work_flow || workflow.workFlow || workflow.graphData),
    );
  } catch {
    source.work_flow = objectValue(source.work_flow);
  }
}

function upsertSource(list: SourceOption[], source: SourceOption) {
  const index = list.findIndex((item) => String(item.id) === String(source.id));
  if (index === -1) {
    list.push(source);
  } else {
    list[index] = source;
  }
}

function taskSource(task: JsonRecord) {
  const sourceType = normalizeSourceType(task.source_type || task.sourceType);
  const sourceId = task.source_id || task.sourceId;
  return sourceOptions.value.find(
    (item) =>
      item.source_type === sourceType && String(item.id) === String(sourceId),
  );
}

function taskName(task: JsonRecord) {
  return (
    taskSource(task)?.name ||
    task.name ||
    task.source_id ||
    task.sourceId ||
    '-'
  );
}

function taskKey(task: JsonRecord) {
  return `${task.source_type || task.sourceType}-${task.source_id || task.sourceId}`;
}

function changeTriggerType(type: unknown) {
  form.trigger_type = normalizeTriggerType(type);
  form.trigger_setting = normalizeSetting(
    form.trigger_type,
    form.trigger_setting,
  );
}

function scheduleTypeChange() {
  const setting = objectValue(form.trigger_setting);
  const type = textValue(setting.schedule_type, 'daily');
  switch (type) {
    case 'daily': {
      form.trigger_setting = {
        schedule_type: 'daily',
        time: setting.time || ['09:00'],
      };

      break;
    }
    case 'interval': {
      form.trigger_setting = {
        interval_unit: setting.interval_unit || 'minutes',
        interval_value: Number(setting.interval_value || 5),
        schedule_type: 'interval',
      };

      break;
    }
    case 'monthly': {
      form.trigger_setting = {
        days: setting.days || [1],
        schedule_type: 'monthly',
        time: setting.time || ['09:00'],
      };

      break;
    }
    case 'weekly': {
      form.trigger_setting = {
        days: setting.days || [1],
        schedule_type: 'weekly',
        time: setting.time || ['09:00'],
      };

      break;
    }
    default: {
      form.trigger_setting = {
        cron_expression: textValue(setting.cron_expression, '0 9 * * *'),
        schedule_type: 'cron',
      };
    }
  }
}

function addBodyField() {
  const setting = objectValue(form.trigger_setting);
  const body = arrayValue<JsonRecord>(setting.body);
  body.push({
    desc: '',
    field: `field_${body.length + 1}`,
    required: false,
    type: 'string',
  });
  form.trigger_setting = { ...setting, body };
}

function removeBodyField(index: number | string) {
  const setting = objectValue(form.trigger_setting);
  const body = arrayValue<JsonRecord>(setting.body);
  body.splice(Number(index), 1);
  form.trigger_setting = { ...setting, body };
}

function timeListModel() {
  const setting = objectValue(form.trigger_setting);
  const list = arrayValue(setting.time);
  if (list.length === 0) {
    setting.time = ['09:00'];
    form.trigger_setting = setting;
  }
  return setting.time;
}

function payload(): TriggerRequest {
  const tasks = (form.trigger_task || []).map((task: TriggerTaskRequest) => {
    const normalized = normalizeTask(task as JsonRecord);
    return {
      enabled: normalized.enabled !== false,
      is_active: normalized.enabled !== false,
      parameter: objectValue(normalized.parameter),
      source_id: normalized.source_id || normalized.sourceId,
      source_type: normalizeSourceType(
        normalized.source_type || normalized.sourceType,
      ),
    };
  });
  return {
    desc: textValue(form.desc),
    description: textValue(form.desc),
    enabled: form.enabled !== false,
    is_active: form.enabled !== false,
    name: textValue(form.name).trim(),
    parameter: objectValue(tasks[0]?.parameter),
    trigger_setting: objectValue(form.trigger_setting),
    trigger_task: tasks,
    trigger_type: normalizeTriggerType(form.trigger_type),
    workspaceId: textValue(form.workspace_id, props.workspaceId),
    workspace_id: textValue(form.workspace_id, props.workspaceId),
  };
}

function validateForm(data: TriggerRequest) {
  if (!data.name) {
    ElMessage.warning('请输入触发器名称');
    return false;
  }
  if (!data.trigger_task?.length) {
    ElMessage.warning('请至少选择一个执行任务');
    return false;
  }
  const setting = objectValue(data.trigger_setting);
  if (data.trigger_type === 'EVENT' && !setting.token) {
    ElMessage.warning('事件触发器需要 Bearer Token');
    return false;
  }
  if (data.trigger_type === 'SCHEDULED' && !setting.schedule_type) {
    ElMessage.warning('请选择定时周期');
    return false;
  }
  return true;
}

async function saveTrigger() {
  const data = payload();
  if (!validateForm(data)) return;
  saving.value = true;
  try {
    if (resourceType.value && resourceId.value) {
      await (editingId.value
        ? updateResourceTrigger(
            resourceType.value,
            resourceId.value,
            editingId.value,
            data,
          )
        : createResourceTrigger(resourceType.value, resourceId.value, data));
    } else if (editingId.value) {
      await updateTrigger(editingId.value, data);
    } else {
      await createTrigger(data);
    }
    ElMessage.success('保存成功');
    visible.value = false;
    emit('refresh');
  } finally {
    saving.value = false;
  }
}

async function copyText(text: string) {
  if (!text || text === '保存后生成 Webhook 地址') return;
  await navigator.clipboard.writeText(text);
  ElMessage.success('已复制');
}

function absoluteWebhookUrl(id: Id) {
  return `${window.location.origin}${webhookTriggerUrl(id)}`;
}

function handleApplicationSelect(value?: unknown) {
  void addSourceTask('APPLICATION', value as Id | undefined);
  applicationSelect.value = undefined;
}

function handleToolSelect(value?: unknown) {
  void addSourceTask('TOOL', value as Id | undefined);
  toolSelect.value = undefined;
}

defineExpose({ open });
</script>

<template>
  <ElDrawer
    v-model="visible"
    :title="drawerTitle"
    size="760px"
    destroy-on-close
  >
    <ElForm class="trigger-form" label-position="top" :model="form">
      <ElFormItem label="名称" required>
        <ElInput
          v-model="form.name"
          maxlength="64"
          show-word-limit
          @blur="form.name = form.name?.trim()"
        />
      </ElFormItem>
      <ElFormItem label="描述">
        <ElInput
          v-model="form.desc"
          type="textarea"
          maxlength="256"
          :rows="3"
          show-word-limit
        />
      </ElFormItem>

      <ElFormItem label="类型" required>
        <ElRadioGroup
          :model-value="form.trigger_type"
          @change="changeTriggerType"
        >
          <ElRadioButton value="SCHEDULED">定时触发</ElRadioButton>
          <ElRadioButton value="EVENT">事件触发</ElRadioButton>
        </ElRadioGroup>
      </ElFormItem>

      <ElCard
        v-if="form.trigger_type === 'SCHEDULED'"
        class="config-card"
        shadow="never"
      >
        <template #header>
          <div class="card-header">
            <ElIcon><Clock /></ElIcon>
            <span>{{ scheduleLabel(form.trigger_setting) }}</span>
          </div>
        </template>
        <ElFormItem label="触发周期">
          <ElSelect
            v-model="form.trigger_setting.schedule_type"
            class="full"
            @change="scheduleTypeChange"
          >
            <ElOption label="每天" value="daily" />
            <ElOption label="每周" value="weekly" />
            <ElOption label="每月" value="monthly" />
            <ElOption label="间隔" value="interval" />
            <ElOption label="Cron" value="cron" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem
          v-if="
            ['daily', 'weekly', 'monthly'].includes(
              form.trigger_setting.schedule_type,
            )
          "
          label="执行时间"
        >
          <ElSelect
            v-model="form.trigger_setting.time"
            class="full"
            multiple
            allow-create
            filterable
          >
            <ElOption
              v-for="item in timeListModel()"
              :key="item"
              :label="item"
              :value="item"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem
          v-if="form.trigger_setting.schedule_type === 'weekly'"
          label="星期"
        >
          <ElSelect v-model="form.trigger_setting.days" class="full" multiple>
            <ElOption label="周一" :value="1" />
            <ElOption label="周二" :value="2" />
            <ElOption label="周三" :value="3" />
            <ElOption label="周四" :value="4" />
            <ElOption label="周五" :value="5" />
            <ElOption label="周六" :value="6" />
            <ElOption label="周日" :value="7" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem
          v-if="form.trigger_setting.schedule_type === 'monthly'"
          label="日期"
        >
          <ElSelect v-model="form.trigger_setting.days" class="full" multiple>
            <ElOption
              v-for="day in 31"
              :key="day"
              :label="`${day} 日`"
              :value="day"
            />
          </ElSelect>
        </ElFormItem>
        <ElRow
          v-if="form.trigger_setting.schedule_type === 'interval'"
          :gutter="12"
        >
          <ElCol :span="12">
            <ElFormItem label="间隔值">
              <ElInputNumber
                v-model="form.trigger_setting.interval_value"
                :min="1"
                class="full"
              />
            </ElFormItem>
          </ElCol>
          <ElCol :span="12">
            <ElFormItem label="单位">
              <ElSelect
                v-model="form.trigger_setting.interval_unit"
                class="full"
              >
                <ElOption label="分钟" value="minutes" />
                <ElOption label="小时" value="hours" />
              </ElSelect>
            </ElFormItem>
          </ElCol>
        </ElRow>
        <ElFormItem
          v-if="form.trigger_setting.schedule_type === 'cron'"
          label="Cron 表达式"
        >
          <ElInput
            v-model="form.trigger_setting.cron_expression"
            placeholder="0 9 * * *"
          />
        </ElFormItem>
      </ElCard>

      <ElCard v-else class="config-card" shadow="never">
        <template #header>
          <div class="card-header">
            <ElIcon><Bell /></ElIcon>
            <span>事件请求配置</span>
          </div>
        </template>
        <ElFormItem label="Webhook 地址">
          <div class="copy-input">
            <ElInput :model-value="formWebhookUrl" readonly />
            <ElButton :icon="CopyDocument" @click="copyText(formWebhookUrl)" />
          </div>
        </ElFormItem>
        <ElFormItem label="Bearer Token">
          <div class="copy-input">
            <ElInput v-model="form.trigger_setting.token" readonly />
            <ElButton
              :icon="CopyDocument"
              @click="copyText(form.trigger_setting.token)"
            />
            <ElButton
              :icon="Refresh"
              @click="form.trigger_setting.token = token()"
            />
          </div>
        </ElFormItem>
        <ElFormItem label="请求参数">
          <div class="param-table">
            <div class="param-head">
              <span>字段</span>
              <span>类型</span>
              <span>描述</span>
              <span>必填</span>
              <span></span>
            </div>
            <div
              v-for="(item, index) in form.trigger_setting.body"
              :key="index"
              class="param-row"
            >
              <ElInput v-model="item.field" placeholder="字段名" />
              <ElSelect v-model="item.type">
                <ElOption label="string" value="string" />
                <ElOption label="int" value="int" />
                <ElOption label="float" value="float" />
                <ElOption label="boolean" value="boolean" />
                <ElOption label="dict" value="dict" />
                <ElOption label="array" value="array" />
              </ElSelect>
              <ElInput v-model="item.desc" placeholder="描述" />
              <ElSwitch v-model="item.required" />
              <ElButton
                :icon="Delete"
                text
                type="danger"
                @click="removeBodyField(index)"
              />
            </div>
            <ElButton :icon="Plus" text type="primary" @click="addBodyField">
              添加参数
            </ElButton>
          </div>
        </ElFormItem>
      </ElCard>

      <ElFormItem label="执行任务" required>
        <ElCard class="task-card" shadow="never">
          <div v-if="!isResourceMode" class="task-add">
            <ElSelect
              v-model="applicationSelect"
              :loading="sourceLoading"
              clearable
              filterable
              placeholder="添加应用"
              @change="handleApplicationSelect"
            >
              <ElOption
                v-for="item in applicationOptions"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </ElSelect>
            <ElSelect
              v-model="toolSelect"
              :loading="sourceLoading"
              clearable
              filterable
              placeholder="添加工具"
              @change="handleToolSelect"
            >
              <ElOption
                v-for="item in toolOptions"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </ElSelect>
          </div>

          <div v-if="!form.trigger_task?.length" class="empty-task">
            至少选择一个应用或工具作为触发器任务
          </div>
          <div
            v-for="(task, taskIndex) in form.trigger_task"
            :key="taskKey(task)"
            class="task-item"
          >
            <div class="task-item__head">
              <div
                class="task-title"
                @click="
                  expandedTaskKey =
                    expandedTaskKey === taskKey(task) ? '' : taskKey(task)
                "
              >
                <ElIcon
                  class="arrow-icon"
                  :class="{ expanded: expandedTaskKey === taskKey(task) }"
                >
                  <ArrowDown />
                </ElIcon>
                <ElTag
                  size="small"
                  :type="task.source_type === 'TOOL' ? 'success' : 'primary'"
                >
                  {{ sourceDisplayType(task.source_type) }}
                </ElTag>
                <span class="task-name">{{ taskName(task) }}</span>
              </div>
              <ElButton
                v-if="!isResourceMode"
                :icon="Delete"
                text
                type="danger"
                @click="removeTask(taskIndex)"
              />
            </div>
            <div
              v-if="expandedTaskKey === taskKey(task)"
              class="parameter-panel"
            >
              <ApplicationParameter
                v-if="task.source_type === 'APPLICATION'"
                v-model="task.parameter"
                :application="taskSource(task)"
                :trigger="form"
              />
              <ToolParameter
                v-else
                v-model="task.parameter"
                :tool="taskSource(task)"
                :trigger="form"
              />
            </div>
          </div>
        </ElCard>
      </ElFormItem>

      <ElFormItem label="启用">
        <ElSwitch v-model="form.enabled" />
      </ElFormItem>
    </ElForm>

    <template #footer>
      <ElButton @click="visible = false">取消</ElButton>
      <ElButton type="primary" :loading="saving" @click="saveTrigger">
        保存
      </ElButton>
    </template>
  </ElDrawer>
</template>

<style scoped lang="scss">
.trigger-form {
  padding-right: 8px;
}

.config-card,
.task-card {
  width: 100%;
  margin-bottom: 14px;
  border-radius: 6px;
}

.card-header {
  display: flex;
  gap: 8px;
  align-items: center;
}

.full {
  width: 100%;
}

.copy-input,
.task-add {
  display: flex;
  gap: 8px;
  width: 100%;
}

.copy-input .el-input,
.task-add .el-select {
  flex: 1;
}

.param-table {
  display: grid;
  gap: 8px;
  width: 100%;
}

.param-head,
.param-row {
  display: grid;
  grid-template-columns: minmax(110px, 1fr) 120px minmax(130px, 1fr) 64px 36px;
  gap: 8px;
  align-items: center;
}

.param-head {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.empty-task {
  padding: 20px;
  color: var(--el-text-color-secondary);
  text-align: center;
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
}

.task-item {
  padding: 10px;
  margin-top: 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.task-item__head,
.task-title {
  display: flex;
  align-items: center;
}

.task-item__head {
  justify-content: space-between;
}

.task-title {
  min-width: 0;
  cursor: pointer;
}

.task-name {
  margin-left: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  white-space: nowrap;
}

.arrow-icon {
  margin-right: 8px;
  transition: transform 0.18s ease;
}

.arrow-icon.expanded {
  transform: rotate(180deg);
}

.parameter-panel {
  padding-top: 10px;
  margin-top: 10px;
  border-top: 1px dashed var(--el-border-color-lighter);
}
</style>
