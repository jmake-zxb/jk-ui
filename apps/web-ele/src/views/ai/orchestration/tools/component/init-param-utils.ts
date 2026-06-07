import type { ToolFieldSchema } from '#/api/ai/tools';

export type InitParamOptionValue = boolean | number | string;
export type InitParamValue =
  | InitParamOptionValue
  | InitParamOptionValue[]
  | null
  | Record<string, unknown>
  | undefined
  | unknown[];
export type InitParamValues = Record<string, InitParamValue>;

export interface InitParamOption {
  key: string;
  label: string;
  value: InitParamOptionValue;
}

export interface NormalizedInitField {
  attrs: Record<string, unknown>;
  defaultValue: unknown;
  desc: string;
  inputType: string;
  key: string;
  label: string;
  options: InitParamOption[];
  raw: ToolFieldSchema;
  required: boolean;
  showDefaultValue: boolean;
  type: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = '') {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return `${value}`;
  return fallback;
}

function booleanValue(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'on', 'true', 'y', 'yes'].includes(`${value}`.toLowerCase());
}

function optionValue(value: unknown): InitParamOptionValue {
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  return stringValue(value);
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function parseJsonArray(value: unknown): unknown[] {
  const source = typeof value === 'string' ? safeParseJson(value) : value;
  return Array.isArray(source) ? source : [];
}

function parseJsonRecord(value: unknown): Record<string, unknown> {
  const source = typeof value === 'string' ? safeParseJson(value) : value;
  return isRecord(source) ? { ...source } : {};
}

function normalizeInputType(value: unknown) {
  const inputType = stringValue(value, 'TextInput').trim() || 'TextInput';
  if (inputType === 'SliderInput') return 'Slider';
  return inputType;
}

function labelFromUnknown(value: unknown, fallback: string) {
  if (isRecord(value)) {
    return stringValue(value.label ?? value.value ?? value.name, fallback);
  }
  return stringValue(value, fallback);
}

function normalizeOptions(fieldKey: string, value: unknown): InitParamOption[] {
  return parseJsonArray(value)
    .map((option, index) => {
      if (!isRecord(option)) {
        const value = optionValue(option);
        return {
          key: `${fieldKey}-${index}-${value}`,
          label: stringValue(option, `选项 ${index + 1}`),
          value,
        };
      }
      const rawValue =
        option.value ??
        option.key ??
        option.id ??
        option.name ??
        option.label ??
        '';
      const value = optionValue(rawValue);
      return {
        key: `${fieldKey}-${index}-${value}`,
        label: stringValue(
          option.label ?? option.name ?? option.text ?? option.key ?? rawValue,
          `选项 ${index + 1}`,
        ),
        value,
      };
    })
    .filter((option) => option.label || `${option.value}`.length > 0);
}

function fieldDefaultValue(field: NormalizedInitField): InitParamValue {
  if (!field.showDefaultValue) return undefined;
  if (field.defaultValue !== undefined && field.defaultValue !== null) {
    return toInitParamValue(field.defaultValue);
  }
  if (field.inputType === 'SwitchInput') return false;
  if (field.inputType === 'MultiSelect') return [];
  if (field.inputType === 'Slider') {
    const min = Number(field.attrs.min ?? 0);
    return Number.isFinite(min) ? min : 0;
  }
  return undefined;
}

function toInitParamValue(value: unknown): InitParamValue {
  if (
    value === undefined ||
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string' ||
    Array.isArray(value) ||
    isRecord(value)
  ) {
    return value;
  }
  return `${value}`;
}

export function normalizeInitFields(
  fields: ToolFieldSchema[],
): NormalizedInitField[] {
  const seenKeys = new Set<string>();
  const normalized: NormalizedInitField[] = [];
  fields.forEach((field) => {
    const key = stringValue(field.field ?? field.name).trim();
    if (!key || seenKeys.has(key)) return;
    seenKeys.add(key);
    const label = labelFromUnknown(
      field.label,
      stringValue(field.name ?? field.field, key),
    );
    const inputType = normalizeInputType(field.input_type ?? field.inputType);
    normalized.push({
      attrs: parseJsonRecord(field.attrs),
      defaultValue: field.default_value ?? field.defaultValue,
      desc: stringValue(field.desc ?? field.description ?? field.tooltip),
      inputType,
      key,
      label,
      options: normalizeOptions(
        key,
        field.option_list ?? field.optionList ?? field.options,
      ),
      raw: field,
      required: booleanValue(field.required ?? field.is_required, false),
      showDefaultValue: booleanValue(
        field.show_default_value ?? field.showDefaultValue,
        true,
      ),
      type: stringValue(field.type).toLowerCase(),
    });
  });
  return normalized;
}

export function parseInitParamsText(text: string): InitParamValues | undefined {
  const trimmed = text.trim();
  if (!trimmed) return {};
  const parsed = safeParseJson(trimmed);
  if (!isRecord(parsed)) return undefined;
  return Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [
      key,
      toInitParamValue(value),
    ]),
  );
}

export function parseInitParams(value: unknown): InitParamValues {
  if (typeof value === 'string') return parseInitParamsText(value) || {};
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, toInitParamValue(item)]),
  );
}

export function seedInitParams(
  fields: ToolFieldSchema[],
  existingParams: unknown,
): InitParamValues {
  const seeded: InitParamValues = {};
  normalizeInitFields(fields).forEach((field) => {
    seeded[field.key] = fieldDefaultValue(field);
  });
  return {
    ...seeded,
    ...parseInitParams(existingParams),
  };
}

export function isEmptyInitParamValue(value: unknown) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function parseJsonInputValue(value: InitParamValue): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = safeParseJson(trimmed);
  return parsed === undefined ? value : parsed;
}

export function isInvalidJsonInputValue(value: InitParamValue) {
  if (typeof value !== 'string' || !value.trim()) return false;
  return safeParseJson(value.trim()) === undefined;
}

export function normalizeInitParamsForPayload(
  fields: ToolFieldSchema[],
  values: InitParamValues,
): Record<string, unknown> {
  const normalizedFields = normalizeInitFields(fields);
  const fieldKeys = new Set(normalizedFields.map((field) => field.key));
  const payload: Record<string, unknown> = {};
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && !fieldKeys.has(key)) payload[key] = value;
  });
  normalizedFields.forEach((field) => {
    const value = values[field.key];
    if (value === undefined) {
      return;
    }
    if (field.inputType === 'JsonInput') {
      const parsed = parseJsonInputValue(value);
      if (parsed !== undefined) payload[field.key] = parsed;
      return;
    }
    payload[field.key] = value;
  });
  return payload;
}

export function stringifyInitParamsForPayload(
  fields: ToolFieldSchema[],
  values: InitParamValues,
) {
  return JSON.stringify(normalizeInitParamsForPayload(fields, values), null, 2);
}

export function validateInitParamValues(
  fields: ToolFieldSchema[],
  values: InitParamValues,
) {
  const errors: string[] = [];
  normalizeInitFields(fields).forEach((field) => {
    const value = values[field.key];
    if (field.required && isEmptyInitParamValue(value)) {
      errors.push(`请配置初始化参数：${field.label}`);
      return;
    }
    if (field.inputType === 'JsonInput' && isInvalidJsonInputValue(value)) {
      errors.push(`${field.label} 必须是合法 JSON`);
    }
  });
  return errors;
}
