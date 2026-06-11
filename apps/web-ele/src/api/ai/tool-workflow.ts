import type { ToolRequest } from './tools';
import type { AiQuery } from './types';

import { requestClient } from '#/api/request';

const base = '/ai/api/tools';

export function getToolWorkflow(id: number | string) {
  return requestClient.get(`${base}/${id}/workflow`);
}

export function saveToolWorkflow(id: number | string, data: ToolRequest) {
  return requestClient.put(`${base}/${id}/workflow`, data);
}

export function publishToolWorkflow(id: number | string, data?: ToolRequest) {
  return requestClient.put(`${base}/${id}/workflow/publish`, data || {});
}

export function listToolVersions(id: number | string, query?: AiQuery) {
  return requestClient.get(`${base}/${id}/workflow/versions`, {
    params: query,
  });
}

export function pageToolVersions(id: number | string, query?: AiQuery) {
  return requestClient.get(`${base}/${id}/workflow/versions/page`, {
    params: query,
  });
}

export function getToolVersion(
  id: number | string,
  versionId: number | string,
) {
  return requestClient.get(`${base}/${id}/workflow/versions/${versionId}`);
}

export function updateToolVersion(
  id: number | string,
  versionId: number | string,
  data: ToolRequest,
) {
  return requestClient.put(
    `${base}/${id}/workflow/versions/${versionId}`,
    data,
  );
}

export function debugToolWorkflowStream(id: number | string) {
  return `${base}/${id}/workflow/debug/stream`;
}

export function resumeToolWorkflowStream(
  id: number | string,
  runId: number | string,
) {
  return `${base}/${id}/workflow/runs/${runId}/resume/stream`;
}

export function pageToolRuns(id: number | string, query?: AiQuery) {
  return requestClient.get(`${base}/${id}/workflow/runs/page`, {
    params: query,
  });
}

export function getToolRun(id: number | string, runId: number | string) {
  return requestClient.get(`${base}/${id}/workflow/runs/${runId}`);
}

export function listToolRunNodes(id: number | string, runId: number | string) {
  return requestClient.get(`${base}/${id}/workflow/runs/${runId}/nodes`);
}
