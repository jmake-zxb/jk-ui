import { cloneDeep } from 'lodash-es';

export type ResourceRecord = Record<string, unknown>;
export type FieldSource = 'custom' | 'reference';

export function isRecord(value: unknown): value is ResourceRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasField(data: ResourceRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(data, key);
}

export function textOf(value: unknown) {
  return `${value ?? ''}`.trim();
}

export function recordsOf(value: unknown): ResourceRecord[] {
  const root = isRecord(value) && hasField(value, 'data') ? value.data : value;
  if (Array.isArray(root)) return root.filter((item) => isRecord(item));
  if (!isRecord(root)) return [];
  if (Array.isArray(root.data)) {
    return root.data.filter((item) => isRecord(item));
  }
  for (const key of ['records', 'list', 'items', 'tools']) {
    const list = root[key];
    if (Array.isArray(list)) return list.filter((item) => isRecord(item));
  }
  return [];
}

export function recordOf(value: unknown): ResourceRecord | undefined {
  const root = isRecord(value) && hasField(value, 'data') ? value.data : value;
  if (isRecord(root) && !Array.isArray(root.records)) return root;
  return recordsOf(value)[0];
}

export function idOf(record: ResourceRecord): number | string {
  const value =
    record.id ??
    record.toolId ??
    record.tool_id ??
    record.value ??
    record.tool_lib_id ??
    record.toolLibId;
  return typeof value === 'number' || typeof value === 'string'
    ? value
    : `${value || ''}`;
}

export function nameOf(record: ResourceRecord) {
  return textOf(
    record.name ??
      record.toolName ??
      record.tool_name ??
      record.title ??
      idOf(record),
  );
}

export function descriptionOf(record: ResourceRecord) {
  return textOf(record.description ?? record.desc ?? record.remark);
}

export function typeOf(record: ResourceRecord) {
  return textOf(
    record.toolType ?? record.tool_type ?? record.type ?? record.category,
  ).toUpperCase();
}

export function isEnabled(record: ResourceRecord) {
  if (hasField(record, 'is_active')) return record.is_active !== false;
  if (hasField(record, 'isActive')) return record.isActive !== false;
  if (hasField(record, 'active')) return record.active !== false;
  if (hasField(record, 'enabled')) return record.enabled !== false;
  if (hasField(record, 'status')) {
    const status = textOf(record.status).toUpperCase();
    if (['DISABLED', 'INACTIVE', 'OFFLINE', 'STOPPED'].includes(status)) {
      return false;
    }
  }
  return true;
}

export function filterTools(
  records: ResourceRecord[],
  types: string[],
  options: { excludeId?: number | string; includeUnknown?: boolean } = {},
) {
  const typeSet = new Set(types.map((item) => item.toUpperCase()));
  return records.filter((record) => {
    if (!isEnabled(record)) return false;
    if (
      options.excludeId !== undefined &&
      `${idOf(record)}` === `${options.excludeId}`
    ) {
      return false;
    }
    const toolType = typeOf(record);
    return toolType ? typeSet.has(toolType) : options.includeUnknown !== false;
  });
}

export function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

export function fieldKey(field: ResourceRecord, index = 0) {
  return (
    textOf(field.field ?? field.name ?? field.value ?? field.key) ||
    `param_${index + 1}`
  );
}

function fieldLabel(field: ResourceRecord, index = 0) {
  const label = field.label;
  if (typeof label === 'string' || typeof label === 'number') {
    return textOf(label);
  }
  if (isRecord(label)) {
    return textOf(label.label ?? label.value ?? label.name);
  }
  return fieldKey(field, index);
}

function normalizeFieldSource(
  value: unknown,
  fallback: FieldSource,
): FieldSource {
  if (value === 'custom') return 'custom';
  if (value === 'reference') return 'reference';
  return fallback;
}

function defaultValueForType(type: unknown, source: FieldSource) {
  if (source === 'reference') return [];
  if (`${type}` === 'boolean') return false;
  return '';
}

function inputFieldsFrom(value: unknown): ResourceRecord[] {
  const parsed = parseMaybeJson(value);
  return Array.isArray(parsed) ? parsed.filter((item) => isRecord(item)) : [];
}

export function toolInputFields(record: ResourceRecord): ResourceRecord[] {
  return inputFieldsFrom(record.input_field_list ?? record.inputFieldList);
}

export function mergeToolInputFields(
  nextFields: ResourceRecord[],
  oldFields: ResourceRecord[],
  fallbackSource: FieldSource,
) {
  return nextFields.map((field, index) => {
    const key = fieldKey(field, index);
    const source = normalizeFieldSource(field.source, fallbackSource);
    const type = textOf(field.type ?? field.input_type) || 'string';
    const oldField = oldFields.find((item) => fieldKey(item) === key);
    const oldSource = oldField
      ? normalizeFieldSource(oldField.source, source)
      : source;
    const preserveValue = oldField && oldSource === source;
    return {
      ...cloneDeep(field),
      desc: textOf(field.desc ?? field.description),
      field: textOf(field.field) || key,
      is_required: field.is_required === true || field.required === true,
      label: fieldLabel(field, index),
      name: textOf(field.name ?? field.field) || key,
      source,
      type,
      value: preserveValue
        ? cloneDeep(oldField?.value)
        : defaultValueForType(type, source),
    };
  });
}

export function workflowGraphOf(
  record: ResourceRecord,
): ResourceRecord | undefined {
  if (Array.isArray(record.nodes)) return record;
  const raw =
    record.work_flow ??
    record.workFlow ??
    record.workflow ??
    record.graph_data ??
    record.graphData;
  const parsed = parseMaybeJson(raw);
  return isRecord(parsed) ? parsed : undefined;
}

export function workflowToolShape(record: ResourceRecord) {
  const graph = workflowGraphOf(record);
  const nodes = Array.isArray(graph?.nodes)
    ? graph.nodes.filter((item) => isRecord(item))
    : [];
  const baseNode = nodes.find((node) => {
    const type = textOf(node.type ?? node.id);
    return type === 'tool-base-node';
  });
  const properties = isRecord(baseNode?.properties) ? baseNode.properties : {};
  const nodeData = isRecord(properties.node_data) ? properties.node_data : {};
  const inputFields = inputFieldsFrom(
    nodeData.input_field_list ??
      nodeData.user_input_field_list ??
      properties.input_field_list ??
      properties.user_input_field_list,
  );
  const outputFields = inputFieldsFrom(
    nodeData.output_field_list ??
      nodeData.user_output_field_list ??
      properties.output_field_list ??
      properties.user_output_field_list ??
      (isRecord(properties.config) ? properties.config.fields : undefined),
  );
  return {
    inputFields,
    inputTitle:
      textOf(
        nodeData.input_title ??
          (isRecord(properties.user_input_config)
            ? properties.user_input_config.title
            : undefined),
      ) || '输入参数',
    outputFields,
    outputTitle:
      textOf(
        nodeData.output_title ??
          (isRecord(properties.user_output_config)
            ? properties.user_output_config.title
            : undefined),
      ) || '输出参数',
  };
}

export function outputConfigFields(fields: ResourceRecord[]) {
  return fields.map((field, index) => {
    const value = fieldKey(field, index);
    return {
      label: fieldLabel(field, index),
      name: value,
      type: textOf(field.type) || 'string',
      value,
    };
  });
}
