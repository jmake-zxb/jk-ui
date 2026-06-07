import type { AiQuery, OrchestrationRequest } from './types';

import { requestClient } from '#/api/request';

const path = (applicationId: number | string) =>
  `/ai/api/applications/${applicationId}/triggers`;

export function pageTriggers(applicationId: number | string, query?: AiQuery) {
  return requestClient.get(`${path(applicationId)}/page`, { params: query });
}

export function createTrigger(
  applicationId: number | string,
  data: OrchestrationRequest,
) {
  return requestClient.post(path(applicationId), data);
}

export function updateTrigger(
  applicationId: number | string,
  id: number | string,
  data: OrchestrationRequest,
) {
  return requestClient.put(`${path(applicationId)}/${id}`, data);
}

export function toggleTrigger(
  applicationId: number | string,
  id: number | string,
  enabled?: boolean,
) {
  return requestClient.put(`${path(applicationId)}/${id}/toggle`, { enabled });
}

export function testRunTrigger(
  applicationId: number | string,
  id: number | string,
  data?: OrchestrationRequest,
) {
  return requestClient.post(
    `${path(applicationId)}/${id}/test-run`,
    data || {},
  );
}

export function pageTriggerRecords(
  applicationId: number | string,
  id: number | string,
  query?: AiQuery,
) {
  return requestClient.get(`${path(applicationId)}/${id}/records/page`, {
    params: query,
  });
}

export function getTriggerRecord(
  applicationId: number | string,
  id: number | string,
  recordId: number | string,
) {
  return requestClient.get(`${path(applicationId)}/${id}/records/${recordId}`);
}

export function deleteTrigger(
  applicationId: number | string,
  id: number | string,
) {
  return requestClient.delete(`${path(applicationId)}/${id}`);
}

export function webhookTriggerUrl(
  applicationId: number | string,
  id: number | string,
) {
  return `/ai/api/applications/${applicationId}/triggers/${id}/webhook`;
}
