import { cloneDeep } from 'lodash-es';

import { defaultUploadSetting } from './upload-setting';

export { defaultUploadSetting };

export type BaseInputKind = 'api' | 'chat' | 'user';

export type WorkflowField = Record<string, any>;

type UpdateOptions = {
  refresh?: boolean;
};

export const defaultPrologue = '您好，我是您的 AI 助手，请问有什么可以帮您？';

export const inputTypeList = [
  { label: '文本', value: 'TextInput' },
  { label: '密码', value: 'PasswordInput' },
  { label: '单选下拉', value: 'SingleSelect' },
  { label: '多选下拉', value: 'MultiSelect' },
  { label: '单选卡片', value: 'RadioCard' },
  { label: '日期', value: 'DatePicker' },
  { label: '开关', value: 'SwitchInput' },
  { label: '单选行', value: 'RadioRow' },
  { label: '多行文本', value: 'TextareaInput' },
  { label: '多行输入', value: 'MultiRow' },
  { label: '模型', value: 'Model' },
  { label: '知识库', value: 'Knowledge' },
  { label: '树选择', value: 'TreeSelect' },
];

export const exposedInputTypes = [
  'TextInput',
  'PasswordInput',
  'SingleSelect',
  'MultiSelect',
  'RadioCard',
  'DatePicker',
  'SwitchInput',
  'RadioRow',
  'TextareaInput',
];

export const optionInputTypes = new Set([
  'MultiSelect',
  'RadioCard',
  'RadioRow',
  'SingleSelect',
]);

export const compareOptions = [
  { label: '等于', value: 'eq' },
  { label: '不等于', value: 'not_eq' },
  { label: '包含', value: 'contain' },
  { label: '不包含', value: 'not_contain' },
  { label: '为空', value: 'is_null' },
  { label: '不为空', value: 'is_not_null' },
];

export const documentExtensions = [
  'TXT',
  'MD',
  'DOCX',
  'HTML',
  'CSV',
  'XLSX',
  'XLS',
  'PDF',
];
export const imageExtensions = ['JPG', 'JPEG', 'PNG', 'GIF'];
export const audioExtensions = ['MP3', 'WAV', 'OGG', 'ACC', 'M4A'];
export const videoExtensions = ['MP4', 'AVI', 'MKV', 'MOV', 'FLV', 'WMV'];

export function normalizeList(value: any): WorkflowField[] {
  return Array.isArray(value) ? value : [];
}

export function cloneValue<T>(value: T): T {
  return value === undefined ? value : cloneDeep(value);
}

export function fieldLabel(field: WorkflowField) {
  if (typeof field?.label === 'string') return field.label;
  if (field?.label?.label) return field.label.label;
  return field?.name || field?.field || field?.variable || '';
}

export function fieldName(field: WorkflowField) {
  return field?.field || field?.variable || field?.name || '';
}

export function inputTypeLabel(value: string) {
  return (
    inputTypeList.find((item) => item.value === value)?.label || value || '文本'
  );
}

export function defaultValueLabel(field: WorkflowField) {
  if (field.input_type === 'PasswordInput')
    return field.default_value ? '******' : '';
  if (Array.isArray(field.default_value)) {
    return field.default_value
      .map(
        (value: any) =>
          field.option_list?.find((item: any) => item.value === value)?.label ||
          value,
      )
      .join(', ');
  }
  const optionLabel = field.option_list?.find(
    (item: any) => item.value === field.default_value,
  )?.label;
  return optionLabel || field.default_value;
}

export function updateProperties(
  nodeModel: any,
  patch: Record<string, any>,
  fields: string[],
  options: UpdateOptions = {},
) {
  if (!nodeModel.properties) nodeModel.properties = {};
  Object.assign(nodeModel.properties, patch);
  if (options.refresh) nodeModel.refreshVueComponent?.();
  nodeModel.graphModel?.eventCenter?.emit?.('node:inline-update', {
    fields,
    id: nodeModel.id,
    properties: nodeModel.properties,
    source: 'base-node',
  });
}

export function emitGraphEvent(nodeModel: any, name: string) {
  nodeModel.graphModel?.eventCenter?.emit?.(name);
  const eventFields: Record<string, string[]> = {
    chatFieldList: ['chat_input_field_list'],
    refreshFieldList: [
      'api_input_field_list',
      'input_field_list',
      'user_input_config',
      'user_input_field_list',
      'user_input_field_list_setting',
    ],
    refreshFileUploadConfig: ['node_data'],
    refreshLongTermConfig: ['node_data'],
  };
  nodeModel.graphModel?.eventCenter?.emit?.('node:inline-update', {
    fields: eventFields[name] || [name],
    id: nodeModel.id,
    properties: nodeModel.properties,
    source: 'base-node',
  });
}

export function syncInputFieldList(
  nodeModel: any,
  fields: string[] = ['input_field_list'],
) {
  const userFields = normalizeList(nodeModel.properties?.user_input_field_list);
  const apiFields = normalizeList(nodeModel.properties?.api_input_field_list);
  updateProperties(
    nodeModel,
    { input_field_list: [...userFields, ...apiFields] },
    fields,
  );
}

export function ensureBaseNodeProperties(nodeModel: any) {
  if (!nodeModel.properties) nodeModel.properties = {};
  const properties = nodeModel.properties;
  properties.node_data = {
    desc: '',
    file_upload_enable: false,
    long_term_enable: false,
    name: '',
    prologue: defaultPrologue,
    stt_autosend: false,
    stt_model_enable: false,
    tts_autoplay: false,
    tts_model_enable: false,
    tts_type: 'BROWSER',
    ...properties.node_data,
  };
  if (
    properties.node_data.file_upload_enable &&
    !properties.node_data.file_upload_setting
  ) {
    properties.node_data.file_upload_setting = cloneValue(defaultUploadSetting);
  }
  properties.api_input_field_list = normalizeList(
    properties.api_input_field_list,
  );
  properties.chat_input_field_list = normalizeList(
    properties.chat_input_field_list,
  );
  properties.input_field_list = normalizeList(properties.input_field_list);
  properties.user_input_config = properties.user_input_config || {
    title: '用户输入',
  };
  properties.user_input_field_list = normalizeList(
    properties.user_input_field_list,
  );
  properties.width = 600;
}
