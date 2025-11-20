import { requestClient } from '#/api/request';

export function fetchList(query: any) {
  return requestClient.get('/job/sys-job-log/page', {
    params: query,
  });
}

export function delObjs(ids: object) {
  return requestClient.delete('/job/sys-job-log', {
    data: ids,
  });
}
