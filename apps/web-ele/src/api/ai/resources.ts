import type { AiQuery, OrchestrationRequest } from './types';

import { requestClient } from '#/api/request';

const base = '/ai/api/ai/resources';

export function pageResourceFolders(query?: AiQuery) {
  return requestClient.get(`${base}/folders/page`, { params: query });
}

export function listResourceFolders(query?: AiQuery) {
  return requestClient.get(`${base}/folders/list`, { params: query });
}

export function createResourceFolder(data: OrchestrationRequest) {
  return requestClient.post(`${base}/folders`, data);
}

export function updateResourceFolder(
  id: number | string,
  data: OrchestrationRequest,
) {
  return requestClient.put(`${base}/folders/${id}`, data);
}

export function deleteResourceFolder(id: number | string) {
  return requestClient.delete(`${base}/folders/${id}`);
}

export function saveResourceMapping(data: OrchestrationRequest) {
  return requestClient.post(`${base}/mappings`, data);
}

export function listResourceMappings(query: AiQuery) {
  return requestClient.get(`${base}/mappings/list`, { params: query });
}

export function saveResourceAuth(data: OrchestrationRequest) {
  return requestClient.post(`${base}/auth`, data);
}

export function listResourceAuth(query: AiQuery) {
  return requestClient.get(`${base}/auth/list`, { params: query });
}
