import type { AiQuery } from './types';

import { requestClient } from '#/api/request';

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
