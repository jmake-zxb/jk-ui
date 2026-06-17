type AppDetails = Record<string, unknown>;
type JsonRecord = Record<string, unknown>;

const CURRENT_DEFAULT_PROLOGUE = '您好，我是您的 AI 助手，请问有什么可以帮您？';
const LEGACY_MAXKB_DEFAULT_PROLOGUE =
  '您好，我是 XXX 小助手，您可以向我提出 XXX 使用问题。\n- XXX 主要功能有什么？\n- XXX 如何收费？\n- 需要转人工服务';
const LEGACY_MAXKB_DEFAULT_NAME = '知识库问答助手';
const LEGACY_MAXKB_DEFAULT_DESC = '模板';

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim();
    }
  }
  return '';
}

function findBaseNode(nodes: unknown[]) {
  return nodes.find((node) => {
    if (!isRecord(node)) return false;
    return node.id === 'base-node' || node.type === 'base-node';
  });
}

function ensureRecordField(parent: JsonRecord, key: string) {
  const current = parent[key];
  if (isRecord(current)) return current;
  const next: JsonRecord = {};
  parent[key] = next;
  return next;
}

function isDefaultText(value: string, defaults: string[]) {
  return defaults.includes(value.trim());
}

function isDefaultPrologue(value: unknown) {
  if (typeof value !== 'string') return false;
  return isDefaultText(value, [
    CURRENT_DEFAULT_PROLOGUE,
    LEGACY_MAXKB_DEFAULT_PROLOGUE,
  ]);
}

function defaultPrologueForApplication(applicationName: string) {
  if (!applicationName) return CURRENT_DEFAULT_PROLOGUE;
  return `您好，我是${applicationName}小助手，您可以向我提出${applicationName}使用问题。\n- ${applicationName}主要功能有什么？\n- ${applicationName}如何收费？\n- 需要转人工服务`;
}

export function normalizeBaseNodeApplicationInfo(
  graphData: unknown,
  app: AppDetails,
) {
  if (!isRecord(graphData) || !Array.isArray(graphData.nodes)) return graphData;
  const baseNode = findBaseNode(graphData.nodes);
  if (!isRecord(baseNode)) return graphData;

  const properties = ensureRecordField(baseNode, 'properties');
  const nodeData = ensureRecordField(properties, 'node_data');
  const applicationName = textValue(
    app.name,
    app.title,
    app.applicationName,
    app.application_name,
  );
  const applicationDesc = textValue(app.description, app.desc);
  const nodeName = textValue(nodeData.name);
  const nodeDesc = textValue(nodeData.desc);

  if (
    applicationName &&
    (!nodeName || isDefaultText(nodeName, [LEGACY_MAXKB_DEFAULT_NAME]))
  ) {
    nodeData.name = applicationName;
  }
  if (
    applicationDesc &&
    (!nodeDesc || isDefaultText(nodeDesc, [LEGACY_MAXKB_DEFAULT_DESC]))
  ) {
    nodeData.desc = applicationDesc;
  }

  if (isDefaultPrologue(nodeData.prologue)) {
    nodeData.prologue = defaultPrologueForApplication(applicationName);
  }

  return graphData;
}

export const legacyMaxKbDefaultPrologue = LEGACY_MAXKB_DEFAULT_PROLOGUE;
