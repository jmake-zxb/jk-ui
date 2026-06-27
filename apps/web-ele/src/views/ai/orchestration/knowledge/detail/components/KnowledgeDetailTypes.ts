export type Id = number | string;

export interface KnowledgeRecord extends Record<string, unknown> {
  appId?: string;
  appSecret?: string;
  app_id?: string;
  app_secret?: string;
  chunkConfigJson?: string;
  chunk_config_json?: string;
  description?: string;
  embeddingModelId?: Id;
  embedding_model_id?: Id;
  fileCountLimit?: number;
  fileSizeLimit?: number;
  file_count_limit?: number;
  file_size_limit?: number;
  folderId?: Id;
  folder_id?: Id;
  folderToken?: string;
  folder_token?: string;
  graphData?: string;
  graph_data?: string;
  id?: Id;
  metaJson?: string;
  meta_json?: string;
  name?: string;
  rerankModelId?: Id;
  rerank_model_id?: Id;
  searchConfigJson?: string;
  search_config_json?: string;
  selector?: string;
  sourceUrl?: string;
  source_url?: string;
  type?: string;
  workspaceId?: string;
  workspace_id?: string;
}

export interface KnowledgeDetailTabProps {
  folderId?: Id;
  knowledge?: KnowledgeRecord;
  knowledgeId: Id;
  type?: Id;
}

export interface PageRecord extends Record<string, unknown> {
  id?: Id;
}

export function idText(value: unknown, fallback = '') {
  if (typeof value === 'number') return `${value}`;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return idText(value[0], fallback);
  return fallback;
}

export function textOf(value: unknown, fallback = '') {
  if (value === undefined || value === null || value === '') return fallback;
  return `${value}`;
}

export function numberOf(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function booleanOf(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
}

export function dateText(value: unknown) {
  if (!value) return '-';
  const date = new Date(`${value}`);
  if (Number.isNaN(date.getTime())) return `${value}`;
  return date.toLocaleString('zh-CN');
}

export function countText(value: unknown) {
  return numberOf(value).toLocaleString('zh-CN');
}
