import type { AiQuery, OrchestrationRequest } from './types';

import { requestClient } from '#/api/request';

const base = '/ai/api';

export type TriggerTypeValue = 'EVENT' | 'MANUAL' | 'SCHEDULE' | 'SCHEDULED';
export type TriggerTaskSourceValue = 'APPLICATION' | 'TOOL';

export interface TriggerTaskRequest extends OrchestrationRequest {
  id?: number | string;
  parameter?: Record<string, unknown>;
  sourceId?: number | string;
  sourceType?: TriggerTaskSourceValue;
  source_id?: number | string;
  source_type?: TriggerTaskSourceValue;
  enabled?: boolean;
  isActive?: boolean;
  is_active?: boolean;
  meta?: Record<string, unknown>;
}

export interface TriggerRequest extends OrchestrationRequest {
  applicationId?: number | string;
  configJson?: string;
  desc?: string;
  description?: string;
  enabled?: boolean;
  isActive?: boolean;
  is_active?: boolean;
  meta?: Record<string, unknown>;
  parameter?: Record<string, unknown>;
  triggerSetting?: Record<string, unknown>;
  triggerTask?: TriggerTaskRequest[];
  triggerType?: TriggerTypeValue;
  trigger_setting?: Record<string, unknown>;
  trigger_task?: TriggerTaskRequest[];
  trigger_type?: TriggerTypeValue;
  workspaceId?: string;
  workspace_id?: string;
}

const triggerBase = `${base}/triggers`;

function queryParams(query?: AiQuery & Record<string, unknown>) {
  return query || {};
}

export function pageTriggers(query?: AiQuery & Record<string, unknown>) {
  return requestClient.get(`${triggerBase}/page`, {
    params: queryParams(query),
  });
}

export function getTrigger(id: number | string) {
  return requestClient.get(`${triggerBase}/${id}`);
}

export function createTrigger(data: TriggerRequest) {
  return requestClient.post(triggerBase, data);
}

export function updateTrigger(id: number | string, data: TriggerRequest) {
  return requestClient.put(`${triggerBase}/${id}`, data);
}

export function toggleTrigger(id: number | string, enabled?: boolean) {
  return requestClient.put(`${triggerBase}/${id}/toggle`, { enabled });
}

export function batchActivateTriggers(data: {
  id_list?: Array<number | string>;
  idList?: Array<number | string>;
  is_active?: boolean;
  isActive?: boolean;
}) {
  return requestClient.put(`${triggerBase}/batch-activate`, data);
}

export function batchDeleteTriggers(ids: Array<number | string>) {
  return requestClient.put(`${triggerBase}/batch-delete`, {
    idList: ids,
    id_list: ids,
    ids,
  });
}

export function deleteTrigger(id: number | string) {
  return requestClient.delete(`${triggerBase}/${id}`);
}

export function testRunTrigger(id: number | string, data?: TriggerRequest) {
  return requestClient.post(`${triggerBase}/${id}/test-run`, data || {});
}

export function webhookTriggerUrl(id: number | string) {
  return `${base}/trigger/v1/webhook/${id}`;
}

export function pageTriggerRecords(
  id: number | string,
  query?: AiQuery & Record<string, unknown>,
) {
  return requestClient.get(`${triggerBase}/${id}/task-records/page`, {
    params: queryParams(query),
  });
}

export function getTriggerRecord(
  id: number | string,
  taskId: number | string,
  recordId: number | string,
) {
  return requestClient.get(
    `${triggerBase}/${id}/tasks/${taskId}/records/${recordId}`,
  );
}

export function pageApplicationTriggers(
  applicationId: number | string,
  query?: AiQuery,
) {
  return requestClient.get(
    `${base}/applications/${applicationId}/triggers/page`,
    { params: queryParams(query) },
  );
}

export function createApplicationTrigger(
  applicationId: number | string,
  data: TriggerRequest,
) {
  return requestClient.post(
    `${base}/applications/${applicationId}/triggers`,
    data,
  );
}

export function updateApplicationTrigger(
  applicationId: number | string,
  id: number | string,
  data: TriggerRequest,
) {
  return requestClient.put(
    `${base}/applications/${applicationId}/triggers/${id}`,
    data,
  );
}

export function toggleApplicationTrigger(
  applicationId: number | string,
  id: number | string,
  enabled?: boolean,
) {
  return requestClient.put(
    `${base}/applications/${applicationId}/triggers/${id}/toggle`,
    { enabled },
  );
}

export function testRunApplicationTrigger(
  applicationId: number | string,
  id: number | string,
  data?: TriggerRequest,
) {
  return requestClient.post(
    `${base}/applications/${applicationId}/triggers/${id}/test-run`,
    data || {},
  );
}

export function pageApplicationTriggerRecords(
  applicationId: number | string,
  id: number | string,
  query?: AiQuery,
) {
  return requestClient.get(
    `${base}/applications/${applicationId}/triggers/${id}/records/page`,
    { params: queryParams(query) },
  );
}

export function getApplicationTriggerRecord(
  applicationId: number | string,
  id: number | string,
  recordId: number | string,
) {
  return requestClient.get(
    `${base}/applications/${applicationId}/triggers/${id}/records/${recordId}`,
  );
}

export function deleteApplicationTrigger(
  applicationId: number | string,
  id: number | string,
) {
  return requestClient.delete(
    `${base}/applications/${applicationId}/triggers/${id}`,
  );
}

export function listResourceTriggers(
  sourceType: TriggerTaskSourceValue,
  sourceId: number | string,
  workspaceId = 'default',
) {
  return requestClient.get(`${base}/${sourceType}/${sourceId}/triggers`, {
    params: { workspaceId, workspace_id: workspaceId },
  });
}

export function getResourceTrigger(
  sourceType: TriggerTaskSourceValue,
  sourceId: number | string,
  id: number | string,
) {
  return requestClient.get(`${base}/${sourceType}/${sourceId}/triggers/${id}`);
}

export function createResourceTrigger(
  sourceType: TriggerTaskSourceValue,
  sourceId: number | string,
  data: TriggerRequest,
) {
  return requestClient.post(`${base}/${sourceType}/${sourceId}/triggers`, data);
}

export function updateResourceTrigger(
  sourceType: TriggerTaskSourceValue,
  sourceId: number | string,
  id: number | string,
  data: TriggerRequest,
) {
  return requestClient.put(
    `${base}/${sourceType}/${sourceId}/triggers/${id}`,
    data,
  );
}

export function deleteResourceTrigger(
  sourceType: TriggerTaskSourceValue,
  sourceId: number | string,
  id: number | string,
) {
  return requestClient.delete(
    `${base}/${sourceType}/${sourceId}/triggers/${id}`,
  );
}
