import { requestClient } from '#/api/request';

export function fetchList(query?: object) {
  return requestClient.get('/gen/dsconf/page', {
    params: query,
  });
}

export function list(query?: object) {
  return requestClient.get('/gen/dsconf/list', {
    params: query,
  });
}

export function listTable(query?: object) {
  return requestClient.get('/gen/dsconf/table/list', {
    params: query,
  });
}

export function addObj(obj?: object) {
  return requestClient.post('/gen/dsconf', obj);
}

export function getObj(id?: string) {
  return requestClient.get(`/gen/dsconf/${id}`);
}

export function delObj(ids?: object) {
  return requestClient.delete('/gen/dsconf', {
    data: ids,
  });
}

export function putObj(obj?: object) {
  return requestClient.put('/gen/dsconf', obj);
}
