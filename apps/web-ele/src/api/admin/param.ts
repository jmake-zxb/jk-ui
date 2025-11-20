import { requestClient } from '#/api/request';

export function fetchList(query?: object) {
  return requestClient.get('/admin/param/page', {
    params: query,
  });
}

export function addObj(obj?: object) {
  return requestClient.post('/admin/param', obj);
}

export function getObj(id?: string) {
  return requestClient.get(`/admin/param/details/${id}`);
}

export function delObj(ids?: object) {
  return requestClient.delete('/admin/param', { data: ids });
}

export function putObj(obj?: object) {
  return requestClient.put('/admin/param', obj);
}

export function refreshCache() {
  return requestClient.put('/admin/param/sync');
}

export function getObjDetails(obj?: object) {
  return requestClient.get('/admin/param/details', {
    params: obj,
  });
}

export function validateParamsCode(
  _rule: any,
  value: any,
  callback: any,
  isEdit: boolean,
) {
  if (isEdit) {
    return callback();
  }

  getObjDetails({ publicKey: value }).then((response) => {
    const result = response.data;
    if (result === null) {
      callback();
    } else {
      callback(new Error('参数编码已经存在'));
    }
  });
}

export function validateParamsName(
  _rule: any,
  value: any,
  callback: any,
  isEdit: boolean,
) {
  if (isEdit) {
    return callback();
  }

  getObjDetails({ publicName: value }).then((response) => {
    const result = response.data;
    if (result === null) {
      callback();
    } else {
      callback(new Error('参数名称已经存在'));
    }
  });
}
