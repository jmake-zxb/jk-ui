import { requestClient } from '#/api/request';

export function getDashboardStats() {
  return requestClient.get('/ai/api/ai/dashboard/stats');
}

export function getApplicationStats(applicationId: number | string) {
  return requestClient.get(
    `/ai/api/ai/dashboard/applications/${applicationId}/stats`,
  );
}
