import type { AiQuery } from './types';

import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import { requestClient } from '#/api/request';
import { adaptationUrl } from '#/utils/other';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

export type AiModelId = number | string;
export type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonObject | JsonPrimitive | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface ProviderConfigPayload {
  apiKey?: string;
  apiUrl?: string;
  isActive?: boolean;
  providerCode?: string;
  providerName?: string;
  providerType?: string;
  sortOrder?: number;
}

export interface ModelFormField extends Record<string, unknown> {
  defaultValue?: unknown;
  default_value?: unknown;
  desc?: string;
  field?: string;
  inputType?: string;
  input_type?: string;
  label?: string | { label?: string; name?: string };
  name?: string;
  optionList?: unknown;
  option_list?: unknown;
  options?: unknown;
  required?: boolean;
  type?: string;
}

export interface ModelConfigPayload {
  credential?: JsonObject;
  displayName?: string;
  isActive?: boolean;
  isDefault?: boolean;
  modelName?: string;
  modelParamsForm?: ModelFormField[];
  modelType?: string;
  providerCode?: string;
  providerId?: AiModelId;
  providerName?: string;
  providerType?: string;
  sortOrder?: number;
  status?: string;
}

export function listProviders() {
  return requestClient.get('/ai/api/providers');
}

export function pageProviders(query?: AiQuery) {
  return requestClient.get('/ai/api/providers/page', { params: query });
}

export function getProvider(id: number | string) {
  return requestClient.get(`/ai/api/providers/${id}`);
}

export function createProvider(data: ProviderConfigPayload) {
  return requestClient.post('/ai/api/providers', data);
}

export function updateProvider(
  id: number | string,
  data: ProviderConfigPayload,
) {
  return requestClient.put(`/ai/api/providers/${id}`, data);
}

export function deleteProvider(id: number | string) {
  return requestClient.delete(`/ai/api/providers/${id}`);
}

export function listModels() {
  return requestClient.get('/ai/api/models');
}

export function pageModels(query?: AiQuery) {
  return requestClient.get('/ai/api/models/page', { params: query });
}

export function getModel(id: number | string) {
  return requestClient.get(`/ai/api/models/${id}`);
}

export function createModel(data: ModelConfigPayload) {
  return requestClient.post('/ai/api/models', data);
}

export function updateModel(id: number | string, data: ModelConfigPayload) {
  return requestClient.put(`/ai/api/models/${id}`, data);
}

export function deleteModel(id: number | string) {
  return requestClient.delete(`/ai/api/models/${id}`);
}

export function listActiveModels(modelType = 'CHAT') {
  return requestClient.get('/ai/api/models/active', { params: { modelType } });
}

export function getDefaultModel(modelType = 'CHAT') {
  return requestClient.get('/ai/api/models/default', { params: { modelType } });
}

export function listProviderMetadata(modelType?: string) {
  return requestClient.get('/ai/api/providers/metadata', {
    params: modelType ? { modelType } : undefined,
  });
}

export function listProviderModelTypes(providerCode: string) {
  return requestClient.get(
    `/ai/api/providers/metadata/${providerCode}/model-types`,
  );
}

export function listProviderBaseModels(
  providerCode: string,
  modelType?: string,
) {
  return requestClient.get(
    `/ai/api/providers/metadata/${providerCode}/models`,
    { params: modelType ? { modelType } : undefined },
  );
}

export function listProviderCredentialFields(providerCode: string) {
  return requestClient.get(
    `/ai/api/providers/metadata/${providerCode}/credential-fields`,
  );
}

export function listProviderModelParamsForm(
  providerCode: string,
  modelType?: string,
) {
  return requestClient.get(
    `/ai/api/providers/metadata/${providerCode}/model-params-form`,
    { params: modelType ? { modelType } : undefined },
  );
}

export function getModelParamsForm(id: AiModelId) {
  return requestClient.get(`/ai/api/models/${id}/model-params-form`);
}

export function updateModelParamsForm(
  id: AiModelId,
  modelParamsForm: ModelFormField[],
) {
  return requestClient.put(`/ai/api/models/${id}/model-params-form`, {
    modelParamsForm,
  });
}

export function getModelMeta(id: AiModelId) {
  return requestClient.get(`/ai/api/models/${id}/meta`);
}

/**
 * 暂停模型下载，更新状态为 PAUSE_DOWNLOAD
 */
export function pauseDownload(id: AiModelId) {
  return requestClient.put(`/ai/api/models/${id}/pause-download`);
}

/**
 * 下拉选择模型列表（含共享模型）
 * 返回 { shared_model: [], model: [] } 结构并打 type 标签
 */
export async function getSelectModelList(data?: {
  modelType?: string;
  name?: string;
}) {
  const res: any = await requestClient.get('/ai/api/models/select-list', {
    params: data,
  });
  const shared = (res?.shared_model ?? res?.sharedModel ?? []).map(
    (m: any) => ({ ...m, type: 'share' }),
  );
  const own = (res?.model ?? []).map((m: any) => ({
    ...m,
    type: 'workspace',
  }));
  return [...shared, ...own];
}

/**
 * 按模型类型过滤供应商列表
 */
export function getProviderByModelType(modelType?: string) {
  return requestClient.get('/ai/api/providers', {
    params: modelType ? { modelType } : undefined,
  });
}

/**
 * 按供应商+模型类型+基础模型名获取凭证表单字段
 */
export function getModelCreateForm(
  providerCode: string,
  modelType: string,
  modelName: string,
) {
  return requestClient.get(
    `/ai/api/providers/metadata/${providerCode}/model-form`,
    {
      params: { modelType, modelName },
    },
  );
}

export interface PromptGenerateMessage {
  content?: string;
  role?: string;
}

export interface PromptGenerateRequest {
  applicationId?: string;
  application_id?: string;
  messages?: PromptGenerateMessage[];
  modelId?: AiModelId;
  model_id?: AiModelId;
  prompt?: string;
}

function formatPromptToken(token: null | string) {
  return token ? `Bearer ${token}` : '';
}

export async function generatePromptStream(
  id: AiModelId,
  data: PromptGenerateRequest,
  signal?: AbortSignal,
) {
  const accessStore = useAccessStore();
  const target = `/ai/api/models/${id}/prompt-generate`;
  const path = adaptationUrl(target) || target;
  const headers: HeadersInit = {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
  };
  const authorization = formatPromptToken(accessStore.accessToken);
  if (authorization) headers.Authorization = authorization;

  const response = await fetch(`${apiURL}${path}`, {
    body: JSON.stringify(data),
    headers,
    method: 'POST',
    signal,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `提示词生成请求失败：${response.status}`);
  }
  if (!response.body) throw new Error('提示词生成接口未返回流数据');
  return response.body;
}
