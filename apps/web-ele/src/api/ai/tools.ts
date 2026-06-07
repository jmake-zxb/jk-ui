import type { AiQuery, OrchestrationRequest } from './types';

import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import { requestClient } from '#/api/request';
import { adaptationUrl } from '#/utils/other';

const base = '/ai/api/tools';
const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

export type AiToolType =
  | 'CUSTOM'
  | 'DATA_SOURCE'
  | 'HTTP'
  | 'INTERNAL'
  | 'MCP'
  | 'MOCK'
  | 'SKILL'
  | 'WORKFLOW';

export interface ToolFieldSchema {
  attrs?: Record<string, unknown> | string;
  defaultValue?: unknown;
  default_value?: unknown;
  desc?: string;
  description?: string;
  field?: string;
  inputType?: string;
  input_type?: string;
  is_required?: boolean;
  label?: Record<string, unknown> | string;
  name?: string;
  optionList?: Array<Record<string, unknown>> | string;
  options?: Array<Record<string, unknown>> | string;
  option_list?: Array<Record<string, unknown>> | string;
  required?: boolean;
  showDefaultValue?: boolean;
  show_default_value?: boolean;
  source?: string;
  tooltip?: string;
  type?: string;
  [key: string]: unknown;
}

export interface ToolRequest extends OrchestrationRequest {
  config_json?: string;
  content_base64?: string;
  content_type?: string;
  desc?: string;
  file_name?: string;
  folder_id?: number | string;
  graph_data?: string;
  icon?: string;
  id_list?: Array<number | string>;
  init_field_list?: string | ToolFieldSchema[];
  initParams?: Record<string, unknown> | string;
  init_params?: Record<string, unknown> | string;
  input_field_list?: string | ToolFieldSchema[];
  input_json?: string;
  isActive?: boolean;
  is_active?: boolean;
  label?: string;
  mcp_servers?: Record<string, unknown> | string;
  scope?: string;
  template_id?: number | string;
  tool_type?: AiToolType | string;
  version?: string;
  work_flow?: Record<string, unknown> | string;
  workspace_id?: string;
}

export interface ToolFolderRequest extends OrchestrationRequest {
  clearParent?: boolean;
  clear_parent?: boolean;
  description?: string;
  parent_id?: number | string;
  workspace_id?: string;
}

export interface ToolFilePayload extends ToolRequest {
  content_base64: string;
  content_type?: string;
  file_name: string;
}

export interface ToolGenerateCodeMessage {
  content?: string;
  role?: 'ai' | 'assistant' | 'system' | 'user' | string;
}

export interface ToolGenerateCodeRequest {
  initFieldList?: string | ToolFieldSchema[];
  init_field_list?: string | ToolFieldSchema[];
  inputFieldList?: string | ToolFieldSchema[];
  input_field_list?: string | ToolFieldSchema[];
  messages?: ToolGenerateCodeMessage[];
  modelId?: number | string;
  modelParamsSetting?: unknown;
  model_id?: number | string;
  model_params_setting?: unknown;
  prompt?: string;
  userInput?: unknown;
  user_input?: unknown;
}

function formatToken(token: null | string) {
  return token ? `Bearer ${token}` : '';
}

export async function generateToolCodeStream(
  data: ToolGenerateCodeRequest,
  signal?: AbortSignal,
) {
  const accessStore = useAccessStore();
  const path =
    adaptationUrl(`${base}/generate-code`) || `${base}/generate-code`;
  const headers: HeadersInit = {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
  };
  const authorization = formatToken(accessStore.accessToken);
  if (authorization) headers.Authorization = authorization;

  const response = await fetch(`${apiURL}${path}`, {
    body: JSON.stringify(data),
    headers,
    method: 'POST',
    signal,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `代码生成请求失败：${response.status}`);
  }
  if (!response.body) throw new Error('代码生成接口未返回流数据');
  return response.body;
}

export function pageTools(query?: AiQuery) {
  return requestClient.get(`${base}/page`, { params: query });
}

export function listTools(query?: AiQuery) {
  return requestClient.get(`${base}/list`, { params: query });
}

export function treeTools(query?: AiQuery) {
  return requestClient.get(`${base}/tree`, { params: query });
}

export function listToolFolders(query?: AiQuery) {
  return requestClient.get(`${base}/folders`, { params: query });
}

export function createToolFolder(data: ToolFolderRequest) {
  return requestClient.post(`${base}/folders`, data);
}

export function updateToolFolder(id: number | string, data: ToolFolderRequest) {
  return requestClient.put(`${base}/folders/${id}`, data);
}

export function deleteToolFolder(id: number | string) {
  return requestClient.delete(`${base}/folders/${id}`);
}

export function getTool(id: number | string) {
  return requestClient.get(`${base}/${id}`);
}

export function getMcpTools(mcpServers: Record<string, unknown> | string) {
  return requestClient.post(`${base}/mcp-tools`, { mcp_servers: mcpServers });
}

export function getToolMcpTools(
  id: number | string,
  mcpServers: Record<string, unknown> | string,
) {
  return requestClient.post(`${base}/${id}/mcp-tools`, {
    mcp_servers: mcpServers,
  });
}

export function createTool(data: ToolRequest) {
  return requestClient.post(base, data);
}

export function updateTool(id: number | string, data: ToolRequest) {
  return requestClient.put(`${base}/${id}`, data);
}

export function deleteTool(id: number | string) {
  return requestClient.delete(`${base}/${id}`);
}

export function batchDeleteTools(ids: Array<number | string>) {
  return requestClient.put(`${base}/batch-delete`, {
    id_list: ids,
    idList: ids,
  });
}

export function batchMoveTools(
  ids: Array<number | string>,
  folderId?: number | string,
) {
  return requestClient.put(`${base}/batch-move`, {
    folder_id: folderId,
    folderId,
    id_list: ids,
    idList: ids,
    targetFolderId: folderId,
  });
}

export function debugDraftTool(data?: ToolRequest) {
  return requestClient.post(`${base}/debug`, data || {});
}

export function debugTool(id: number | string, data?: ToolRequest) {
  return requestClient.post(`${base}/${id}/debug`, data || {});
}

export function pylintTool(code: string) {
  return requestClient.post(`${base}/pylint`, { code });
}

export function testToolConnection(data: ToolRequest) {
  return requestClient.post(`${base}/test-connection`, data);
}

export function importTool(data: Record<string, unknown> | ToolRequest) {
  return requestClient.post(`${base}/import`, data);
}

export function exportTool(id: number | string) {
  return requestClient.get(`${base}/${id}/export`);
}

export function editToolIcon(id: number | string, data: ToolRequest) {
  return requestClient.put(`${base}/${id}/edit-icon`, data);
}

export function uploadSkillFile(data: ToolFilePayload) {
  return requestClient.put(`${base}/upload-skill-file`, data);
}

export function downloadSkillFile(id: number | string) {
  return requestClient.get(`${base}/${id}/download-skill-file`);
}

export function listInternalTools(query?: AiQuery) {
  return requestClient.get(`${base}/internal`, { params: query });
}

export function listStoreTools(query?: AiQuery) {
  return requestClient.get(`${base}/store`, { params: query });
}

export function addInternalTool(id: number | string, data: ToolRequest) {
  return requestClient.post(`${base}/${id}/add-internal-tool`, data);
}

export function addStoreTool(id: number | string, data: ToolRequest) {
  return requestClient.post(`${base}/${id}/add-store-tool`, data);
}

export function updateStoreTool(id: number | string, data: ToolRequest) {
  return requestClient.post(`${base}/${id}/update-store-tool`, data);
}

export function getToolWorkflow(id: number | string) {
  return requestClient.get(`${base}/${id}/workflow`);
}

export function saveToolWorkflow(id: number | string, data: ToolRequest) {
  return requestClient.put(`${base}/${id}/workflow`, data);
}

export function publishToolWorkflow(id: number | string, data?: ToolRequest) {
  return requestClient.put(`${base}/${id}/publish`, data || {});
}

export function listToolVersions(id: number | string, query?: AiQuery) {
  return requestClient.get(`${base}/${id}/tool-version`, { params: query });
}

export function pageToolVersions(id: number | string, query?: AiQuery) {
  return requestClient.get(`${base}/${id}/tool-version/page`, {
    params: query,
  });
}

export function getToolVersion(
  id: number | string,
  versionId: number | string,
) {
  return requestClient.get(`${base}/${id}/tool-version/${versionId}`);
}

export function updateToolVersion(
  id: number | string,
  versionId: number | string,
  data: ToolRequest,
) {
  return requestClient.put(`${base}/${id}/tool-version/${versionId}`, data);
}

export function pageToolRecords(id: number | string, query?: AiQuery) {
  return requestClient.get(`${base}/${id}/records/page`, { params: query });
}
