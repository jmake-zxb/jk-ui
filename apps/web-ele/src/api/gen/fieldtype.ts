import { requestClient } from '#/api/request';

export function fetchList(query?: object) {
  return requestClient.get('/gen/fieldtype/page', {
    params: query,
  });
}

export function list(query?: object) {
  return requestClient.get('/gen/fieldtype/list', {
    params: query,
  });
}

export function addObj(obj?: object) {
  return requestClient.post('/gen/fieldtype', obj);
}

export function getObj(id?: string) {
  return requestClient.get(`/gen/fieldtype/details/${id}`);
}

export function getObjDetails(obj?: object) {
  return requestClient.get('/gen/fieldtype/details', {
    params: obj,
  });
}

export function delObj(ids?: object) {
  return requestClient.delete('/gen/fieldtype', {
    data: ids,
  });
}

export function putObj(obj?: object) {
  return requestClient.put('/gen/fieldtype', obj);
}

export function validateColumnType(
  _rule: any,
  value: any,
  callback: any,
  isEdit: boolean,
) {
  if (isEdit) {
    return callback();
  }

  getObjDetails({ columnType: value }).then((response: any) => {
    const result = response;
    if (result === null) {
      callback();
    } else {
      callback(new Error('类型已经存在'));
    }
  });
}
