import { cloneDeep, isEqual, set } from 'lodash-es';

import { defaultUploadSetting } from '../base-node/component/upload-setting';

type FieldLike = { name?: string; value?: string };

export const START_NODE_GLOBAL_FIELDS = [
  { label: '当前时间', value: 'time' },
  { label: '历史对话', value: 'history_context' },
  { label: '会话 ID', value: 'chat_id' },
  { label: '用户 ID', value: 'chat_user_id' },
  { label: '用户类型', value: 'chat_user_type' },
  { label: '用户分组', value: 'chat_user_group' },
  { label: '用户', value: 'chat_user' },
];

const dynamicFileFieldValues = new Set([
  'audio',
  'document',
  'image',
  'other',
  'video',
]);

export function fieldValue(field: FieldLike) {
  return field.value || field.name || '';
}

function isDynamicFileField(field: FieldLike) {
  return dynamicFileFieldValues.has(fieldValue(field));
}

function baseNodes(startNodeModel: any) {
  return (
    startNodeModel.graphModel?.nodes?.filter(
      (node: any) => node.id === 'base-node',
    ) || []
  );
}

export function clearStartNodeDerivedFieldCaches(startNodeModel: any) {
  if (typeof startNodeModel.clear_next_node_field === 'function') {
    startNodeModel.clear_next_node_field(true);
    return;
  }
  startNodeModel.graphModel
    ?.getNodeOutgoingNode?.(startNodeModel.id)
    ?.forEach((node: any) => node.clear_next_node_field?.(true));
}

function updateConfig(
  startNodeModel: any,
  patch: Record<string, any>,
  notify = true,
) {
  if (!startNodeModel.properties) startNodeModel.properties = {};
  if (!startNodeModel.properties.config) startNodeModel.properties.config = {};
  const nextConfig = cloneDeep(startNodeModel.properties.config);
  for (const [key, value] of Object.entries(patch)) {
    set(nextConfig, key, cloneDeep(value));
  }
  const changedFields = Object.entries(patch)
    .filter(
      ([key]) =>
        !isEqual(startNodeModel.properties.config[key], nextConfig[key]),
    )
    .map(([key]) => `config.${key}`);
  if (changedFields.length === 0) return false;
  startNodeModel.properties.config = nextConfig;
  clearStartNodeDerivedFieldCaches(startNodeModel);
  startNodeModel.refreshAnchors?.();
  startNodeModel.refreshConnectedEdges?.();
  if (notify) startNodeModel.refreshVueComponent?.();
  startNodeModel.graphModel?.eventCenter?.emit?.('node:inline-update', {
    fields: changedFields,
    id: startNodeModel.id,
    properties: startNodeModel.properties,
    source: 'start-node',
  });
  return true;
}

export function getGlobalFieldList(startNodeModel: any) {
  const userInputFields = baseNodes(startNodeModel)
    .flatMap((node: any) => {
      const list = node.properties?.user_input_field_list;
      return Array.isArray(list) ? list : [];
    })
    .map((field: any) => {
      if (
        field.label &&
        typeof field.label === 'object' &&
        field.label.input_type === 'TooltipLabel'
      ) {
        return {
          label: field.label.label,
          value: field.field || field.variable,
        };
      }
      return {
        label: field.label || field.name,
        value: field.field || field.variable,
      };
    });
  const apiInputFields = baseNodes(startNodeModel)
    .flatMap((node: any) => {
      const list = node.properties?.api_input_field_list;
      return Array.isArray(list) ? list : [];
    })
    .map((field: any) => ({
      label: field.name || field.variable,
      value: field.variable,
    }));
  return [...START_NODE_GLOBAL_FIELDS, ...userInputFields, ...apiInputFields];
}

export function getChatFieldList(startNodeModel: any) {
  return baseNodes(startNodeModel)
    .flatMap((node: any) => {
      const list = node.properties?.chat_input_field_list;
      return Array.isArray(list) ? list : [];
    })
    .map((field: any) => ({ label: field.label, value: field.field }));
}

function getBaseNodeOutputFields(startNodeModel: any) {
  const userFields = baseNodes(startNodeModel)
    .flatMap((node: any) => {
      const list = node.properties?.user_input_field_list;
      return Array.isArray(list) ? list : [];
    })
    .map((field: any) => ({
      label:
        field.label?.label ||
        field.label ||
        field.name ||
        field.field ||
        field.variable,
      name: field.field || field.variable,
      source: 'base-node',
      type: field.type || 'string',
      value: field.field || field.variable,
    }));
  const apiFields = baseNodes(startNodeModel)
    .flatMap((node: any) => {
      const list = node.properties?.api_input_field_list;
      return Array.isArray(list) ? list : [];
    })
    .map((field: any) => ({
      label: field.name || field.variable,
      name: field.variable,
      source: 'base-node',
      type: field.type || 'string',
      value: field.variable,
    }));
  const chatFields = baseNodes(startNodeModel)
    .flatMap((node: any) => {
      const list = node.properties?.chat_input_field_list;
      return Array.isArray(list) ? list : [];
    })
    .map((field: any) => ({
      label: field.label || field.field,
      name: field.field,
      source: 'base-node',
      type: field.type || 'string',
      value: field.field,
    }));
  const seen = new Set<string>();
  return [...userFields, ...apiFields, ...chatFields].filter((field) => {
    const value = fieldValue(field);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function getFileUploadFields(startNodeModel: any) {
  const uploadSettings = baseNodes(startNodeModel)
    .filter((node: any) => node.properties?.node_data?.file_upload_enable)
    .map((node: any) => ({
      ...cloneDeep(defaultUploadSetting),
      ...node.properties?.node_data?.file_upload_setting,
    }));
  if (uploadSettings.length === 0) return [];

  const setting = uploadSettings[0];
  const fields: { label: string; name: string; type: string; value: string }[] =
    [];
  if (setting.document)
    fields.push({
      label: '文档',
      name: 'document',
      type: 'array',
      value: 'document',
    });
  if (setting.image)
    fields.push({
      label: '图片',
      name: 'image',
      type: 'array',
      value: 'image',
    });
  if (setting.audio)
    fields.push({
      label: '音频',
      name: 'audio',
      type: 'array',
      value: 'audio',
    });
  if (setting.video)
    fields.push({
      label: '视频',
      name: 'video',
      type: 'array',
      value: 'video',
    });
  if (setting.other)
    fields.push({
      label: '其他文件',
      name: 'other',
      type: 'array',
      value: 'other',
    });
  return fields;
}

function getLongTermFields(startNodeModel: any) {
  const enabled = baseNodes(startNodeModel).some(
    (node: any) => !!node.properties?.node_data?.long_term_enable,
  );
  return enabled
    ? [{ label: '长期记忆', name: 'memory', type: 'string', value: 'memory' }]
    : [];
}

function normalizedBaseOutputFields(startNodeModel: any) {
  const config = startNodeModel.properties?.config;
  let fields = Array.isArray(config?.fields) ? cloneDeep(config.fields) : [];
  fields = fields
    .map((item: any) => ({ ...item, value: item.value || item.name }))
    .filter(
      (item: any) =>
        !isDynamicFileField(item) &&
        fieldValue(item) !== 'memory' &&
        item.source !== 'base-node',
    );
  if (!fields.some((item: any) => fieldValue(item) === 'question')) {
    fields = [
      {
        label: '用户问题',
        name: 'question',
        type: 'string',
        value: 'question',
      },
      ...fields,
    ];
  }
  return fields;
}

export function ensureStartNodeProperties(startNodeModel: any) {
  if (!startNodeModel.properties) startNodeModel.properties = {};
  if (!startNodeModel.properties.config) startNodeModel.properties.config = {};
  if (!startNodeModel.properties.node_data)
    startNodeModel.properties.node_data = {};
  if (startNodeModel.properties.showNode === undefined) {
    set(startNodeModel.properties, 'showNode', true);
  }
  if (startNodeModel.properties.node_data.question === undefined) {
    set(
      startNodeModel.properties.node_data,
      'question',
      startNodeModel.properties.node_data.input || '{{input}}',
    );
  }
}

export function syncStartNodeConfigFromBaseNode(
  startNodeModel: any,
  notify = true,
) {
  if (!startNodeModel) return false;
  ensureStartNodeProperties(startNodeModel);
  return updateConfig(
    startNodeModel,
    {
      chatFields: getChatFieldList(startNodeModel),
      fields: getStartNodeFields(startNodeModel),
      globalFields: getGlobalFieldList(startNodeModel),
    },
    notify,
  );
}

export function getStartNodeFields(startNodeModel: any) {
  return [
    ...normalizedBaseOutputFields(startNodeModel),
    ...getBaseNodeOutputFields(startNodeModel),
    ...getFileUploadFields(startNodeModel),
    ...getLongTermFields(startNodeModel),
  ];
}
