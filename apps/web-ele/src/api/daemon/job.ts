import { requestClient } from '#/api/request';

export function fetchList(query?: object) {
  return requestClient.get('/job/sys-job/page', {
    params: query,
  });
}

export function addObj(obj?: object) {
  return requestClient.post('/job/sys-job', obj);
}

export function getObj(id?: string) {
  return requestClient.get(`/job/sys-job/${id}`);
}

export function delObj(id?: string) {
  return requestClient.delete(`/job/sys-job/${id}`);
}

export function putObj(obj?: object) {
  return requestClient.put('/job/sys-job', obj);
}

export function startJobRa(jobId: string) {
  return requestClient.post(`/job/sys-job/start-job/${jobId}`);
}

export function runJobRa(jobId: string) {
  return requestClient.post(`/job/sys-job/run-job/${jobId}`);
}

export function shutDownJobRa(jobId: string) {
  return requestClient.post(`/job/sys-job/shutdown-job/${jobId}`);
}
