import { requestClient } from '#/api/request';

export function fetchList(query?: object) {
  return requestClient.get('/gen/group/page', {
    params: query,
  });
}

export function addObj(obj?: object) {
  return requestClient.post('/gen/group', obj);
}

export function getObj(id?: string) {
  return requestClient.get(`/gen/group/${id}`);
}

export function delObjs(ids?: object) {
  return requestClient.delete('/gen/group', {
    data: ids,
  });
}

export function putObj(obj?: object) {
  return requestClient.put('/gen/group', obj);
}

export function list() {
  return requestClient.get('/gen/group/list');
}
