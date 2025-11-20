import { requestClient } from '#/api/request';

export function fetchList(query?: object) {
  return requestClient.get('/admin/client/page', {
    params: query,
  });
}

export function addObj(obj?: object) {
  return requestClient.post('/admin/client', obj);
}

export function getObj(id?: string) {
  return requestClient.get(`/admin/client/${id}`);
}

export function delObj(ids?: object) {
  return requestClient.delete('/admin/client', {
    data: ids,
  });
}

export function putObj(obj?: object) {
  return requestClient.put('/admin/client', obj);
}

export function refreshCache() {
  return requestClient.put('/admin/client/sync');
}

export function getDetails(obj: object) {
  return requestClient.get(`/admin/client/getClientDetailsById/${obj}`);
}

export function exportData(obj: object) {
  return requestClient.get('/admin/client/export', { params: obj });
}

export function validateclientId(value: any, callback: any, isEdit: boolean) {
  if (isEdit) {
    return callback();
  }
  getDetails(value).then((res) => {
    const result = res.data;
    if (result === null) {
      callback();
    } else {
      callback(new Error('编号已经存在'));
    }
  });
}
