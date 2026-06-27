import type {
  TriggerTaskRequest,
  TriggerTaskSourceValue,
  TriggerTypeValue,
} from '#/api/ai/triggers';

export type Id = number | string;
export type JsonRecord = Record<string, any>;

export interface SourceOption {
  description?: string;
  icon?: string;
  id: Id;
  input_field_list?: JsonRecord[];
  name: string;
  source_type: TriggerTaskSourceValue;
  type?: string;
  work_flow?: JsonRecord;
}

export interface TriggerRecord extends JsonRecord {
  desc?: string;
  enabled?: boolean;
  id: Id;
  is_active?: boolean;
  name?: string;
  trigger_setting?: JsonRecord;
  trigger_task?: JsonRecord[];
  trigger_type?: TriggerTypeValue;
}

export function token() {
  return crypto.randomUUID().replaceAll('-', '');
}

export function textValue(value: unknown, fallback = '') {
  return value === undefined || value === null || value === ''
    ? fallback
    : String(value);
}

export function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function arrayValue<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function objectValue(value: unknown): JsonRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      return objectValue(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return {};
}

export function parseListValue(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value as JsonRecord[];
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function parseAny(value: unknown) {
  if (typeof value !== 'string') return value;
  if (!value.trim()) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function normalizeBool(value: unknown, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

export function normalizeSourceType(
  value: unknown,
): TriggerTaskSourceValue | undefined {
  const text = String(value || '').toUpperCase();
  return text === 'APPLICATION' || text === 'TOOL'
    ? (text as TriggerTaskSourceValue)
    : undefined;
}

export function normalizeTriggerType(value: unknown): TriggerTypeValue {
  const text = String(value || '').toUpperCase();
  if (text === 'EVENT' || text === 'WEBHOOK') return 'EVENT';
  return 'SCHEDULED';
}

export function normalizeTask(task: JsonRecord): TriggerTaskRequest {
  const sourceType = normalizeSourceType(task.source_type || task.sourceType);
  const sourceId = task.source_id || task.sourceId;
  return {
    ...task,
    enabled: normalizeBool(task.enabled ?? task.is_active, true),
    is_active: normalizeBool(task.is_active ?? task.enabled, true),
    parameter: objectValue(task.parameter),
    source_id: sourceId,
    source_type: sourceType,
  };
}

export function normalizeTriggerRecord(row: JsonRecord): TriggerRecord {
  const setting = objectValue(
    row.trigger_setting || row.triggerSetting || row.configJson,
  );
  const tasks = arrayValue<JsonRecord>(row.trigger_task || row.triggerTask).map(
    (item) => normalizeTask(item),
  );
  return {
    ...row,
    id: row.id as Id,
    desc: textValue(row.desc || row.description),
    enabled: normalizeBool(row.enabled ?? row.is_active, true),
    is_active: normalizeBool(row.is_active ?? row.enabled, true),
    trigger_setting: setting,
    trigger_task: tasks,
    trigger_type: normalizeTriggerType(row.trigger_type || row.triggerType),
  };
}

export function normalizeSetting(type: unknown, raw: unknown) {
  const setting = objectValue(raw);
  if (normalizeTriggerType(type) === 'EVENT') {
    return {
      body: arrayValue(setting.body),
      token: textValue(setting.token, token()),
      ...setting,
    };
  }
  return {
    schedule_type: 'daily',
    time: ['09:00'],
    ...setting,
  };
}

export function eventBodyFields(setting?: JsonRecord) {
  return arrayValue<JsonRecord>(setting?.body).filter((item) => item?.field);
}

export function triggerTypeLabel(type?: unknown) {
  return normalizeTriggerType(type) === 'EVENT' ? '事件' : '定时';
}

export function scheduleLabel(setting?: JsonRecord) {
  const safe = objectValue(setting);
  const scheduleType = textValue(safe.schedule_type, 'daily');
  if (scheduleType === 'daily')
    return `每天 ${arrayValue(safe.time).join(', ')}`;
  if (scheduleType === 'weekly') {
    return `每周 ${arrayValue(safe.days).join(', ')} ${arrayValue(safe.time).join(', ')}`;
  }
  if (scheduleType === 'monthly') {
    return `每月 ${arrayValue(safe.days).join(', ')} 日 ${arrayValue(safe.time).join(', ')}`;
  }
  if (scheduleType === 'interval') {
    return `每 ${safe.interval_value || 1} ${safe.interval_unit || 'minutes'}`;
  }
  if (scheduleType === 'cron') return `Cron ${safe.cron_expression || ''}`;
  return '-';
}

export function statusLabel(status?: string) {
  const value = textValue(status).toUpperCase();
  if (value === 'SUCCESS') return '成功';
  if (value === 'FAILURE' || value === 'FAILED') return '失败';
  if (value === 'STARTED' || value === 'RUNNING') return '运行中';
  if (value === 'REVOKED') return '已取消';
  return value || '-';
}

export function recordRunTime(row: JsonRecord) {
  const value = row.run_time;
  return value === undefined || value === null
    ? '-'
    : `${Number(value).toFixed(2)}s`;
}

export function sourceDisplayType(sourceType?: unknown) {
  return normalizeSourceType(sourceType) === 'TOOL' ? '工具' : '应用';
}

function baseNode(source?: SourceOption) {
  return arrayValue<JsonRecord>(source?.work_flow?.nodes).find((node) =>
    ['base-node', 'start-node', 'tool-base-node'].includes(String(node.type)),
  );
}

function fieldName(field: JsonRecord) {
  return field.variable || field.field || field.name;
}

function fieldDefault(field: JsonRecord) {
  return field.default_value ?? field.defaultValue ?? '';
}

export function defaultParameter(
  sourceType: TriggerTaskSourceValue,
  source?: SourceOption,
) {
  const result: JsonRecord = {};
  if (sourceType === 'APPLICATION') {
    result.question = { source: 'custom', value: '' };
    const node = baseNode(source);
    const apiFields = arrayValue<JsonRecord>(
      node?.properties?.api_input_field_list,
    );
    const userFields = arrayValue<JsonRecord>(
      node?.properties?.user_input_field_list,
    );
    if (apiFields.length > 0) result.api_input_field_list = {};
    if (userFields.length > 0) result.user_input_field_list = {};
    for (const field of apiFields) {
      const name = fieldName(field);
      if (name) {
        result.api_input_field_list[name] = {
          source: 'custom',
          value: fieldDefault(field),
        };
      }
    }
    for (const field of userFields) {
      const name = fieldName(field);
      if (name) {
        result.user_input_field_list[name] = {
          source: 'custom',
          value: fieldDefault(field),
        };
      }
    }
    return result;
  }
  for (const field of source?.input_field_list || []) {
    const name = fieldName(field);
    if (name) result[name] = { source: 'custom', value: fieldDefault(field) };
  }
  const toolNode = baseNode(source);
  const userFields = arrayValue<JsonRecord>(
    toolNode?.properties?.user_input_field_list,
  );
  if (userFields.length > 0) result.user_input_field_list = {};
  for (const field of userFields) {
    const name = fieldName(field);
    if (name) {
      result.user_input_field_list[name] = {
        source: 'custom',
        value: fieldDefault(field),
      };
    }
  }
  return result;
}
