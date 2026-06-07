import type {
  AiQuery,
  ApplicationPayload,
  OrchestrationRequest,
  WorkflowDebugPayload,
  WorkflowDraftPayload,
} from './types';

import { requestClient } from '#/api/request';

const base = '/ai/api/applications';

export function pageApplications(query?: AiQuery) {
  return requestClient.get(`${base}/page`, { params: query });
}

export function listApplications() {
  return requestClient.get(`${base}/list`);
}

export function getApplication(id: number | string) {
  return requestClient.get(`${base}/${id}`);
}

export function createApplication(data: ApplicationPayload) {
  return requestClient.post(base, data);
}

export function updateApplication(
  id: number | string,
  data: ApplicationPayload,
) {
  return requestClient.put(`${base}/${id}`, data);
}

export function deleteApplication(id: number | string) {
  return requestClient.delete(`${base}/${id}`);
}

export function batchDeleteApplications(ids: Array<number | string>) {
  return requestClient.delete(`${base}/batch`, { data: ids });
}

export function copyApplication(id: number | string) {
  return requestClient.post(`${base}/${id}/copy`);
}

export function moveApplication(
  id: number | string,
  data: OrchestrationRequest,
) {
  return requestClient.post(`${base}/${id}/move`, data);
}

export function exportApplication(id: number | string) {
  return requestClient.get(`${base}/${id}/export`);
}

export function getWorkflowDraft(id: number | string) {
  return requestClient.get(`${base}/${id}/workflow/draft`);
}

export function saveWorkflowDraft(
  id: number | string,
  data: WorkflowDraftPayload,
) {
  return requestClient.put(`${base}/${id}/workflow/draft`, data);
}

export function validateWorkflowDraft(id: number | string) {
  return requestClient.post(`${base}/${id}/workflow/validate`);
}

export function publishWorkflow(
  id: number | string,
  data?: OrchestrationRequest,
) {
  return requestClient.post(`${base}/${id}/workflow/publish`, data || {});
}

export function pageWorkflowVersions(id: number | string, query?: AiQuery) {
  return requestClient.get(`${base}/${id}/workflow/versions/page`, {
    params: query,
  });
}

export function restoreWorkflowVersion(
  id: number | string,
  versionId: number | string,
) {
  return requestClient.post(
    `${base}/${id}/workflow/versions/${versionId}/restore`,
  );
}

export function pageWorkflowRuns(id: number | string, query?: AiQuery) {
  return requestClient.get(`${base}/${id}/workflow/runs/page`, {
    params: query,
  });
}

export function getWorkflowRun(id: number | string, runId: number | string) {
  return requestClient.get(`${base}/${id}/workflow/runs/${runId}`);
}

export function listWorkflowNodeRuns(
  id: number | string,
  runId: number | string,
) {
  return requestClient.get(`${base}/${id}/workflow/runs/${runId}/nodes`);
}

export function cancelWorkflowRun(id: number | string, runId: number | string) {
  return requestClient.post(`${base}/${id}/workflow/runs/${runId}/cancel`);
}

export function resumeWorkflowRun(
  id: number | string,
  runId: number | string,
  data: WorkflowDebugPayload,
) {
  return requestClient.post(
    `${base}/${id}/workflow/runs/${runId}/resume/stream`,
    data,
  );
}

export function openApplicationChat(
  id: number | string,
  data?: { source?: string; title?: string },
) {
  return requestClient.post(`${base}/${id}/chats/open`, data || {});
}

export function pageApplicationChats(id: number | string, query?: AiQuery) {
  return requestClient.get(`${base}/${id}/chats/page`, { params: query });
}

export function pageApplicationChatRecords(
  id: number | string,
  chatId: number | string,
  query?: AiQuery,
) {
  return requestClient.get(`${base}/${id}/chats/${chatId}/records/page`, {
    params: query,
  });
}

export function pageAccessTokens(
  applicationId: number | string,
  query?: AiQuery,
) {
  return requestClient.get(`${base}/${applicationId}/access-tokens/page`, {
    params: query,
  });
}

export function createAccessToken(
  applicationId: number | string,
  data?: OrchestrationRequest,
) {
  return requestClient.post(
    `${base}/${applicationId}/access-tokens`,
    data || {},
  );
}

export function toggleAccessToken(
  applicationId: number | string,
  tokenId: number | string,
  enabled?: boolean,
) {
  return requestClient.put(
    `${base}/${applicationId}/access-tokens/${tokenId}/toggle`,
    {
      enabled,
    },
  );
}

export function deleteAccessToken(
  applicationId: number | string,
  tokenId: number | string,
) {
  return requestClient.delete(
    `${base}/${applicationId}/access-tokens/${tokenId}`,
  );
}

export function pageApplicationKeys(
  applicationId: number | string,
  query?: AiQuery,
) {
  return requestClient.get(`${base}/${applicationId}/keys/page`, {
    params: query,
  });
}

export function createApplicationKey(
  applicationId: number | string,
  data?: OrchestrationRequest,
) {
  return requestClient.post(`${base}/${applicationId}/keys`, data || {});
}

export function toggleApplicationKey(
  applicationId: number | string,
  keyId: number | string,
  enabled?: boolean,
) {
  return requestClient.put(`${base}/${applicationId}/keys/${keyId}/toggle`, {
    enabled,
  });
}

export function deleteApplicationKey(
  applicationId: number | string,
  keyId: number | string,
) {
  return requestClient.delete(`${base}/${applicationId}/keys/${keyId}`);
}

export type { WorkflowDebugPayload };
