import type {
  AiQuery,
  OrchestrationRequest,
  WorkflowDebugPayload,
  WorkflowDraftPayload,
} from './types';

import { requestClient } from '#/api/request';

const base = '/ai/api/applications';

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

export type { WorkflowDebugPayload, WorkflowDraftPayload };
