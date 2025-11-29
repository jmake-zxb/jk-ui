import { requestClient } from '#/api/request';

export const getDicts = (type: string) => {
  return requestClient.get(`/admin/dict/type/${type}`);
};

export function fetchList(query: any) {
  return requestClient.get('/admin/dict/list', {
    params: query,
  });
}

export function fetchPage(query: any) {
  return requestClient.get('/admin/dict/page', {
    params: query,
  });
}

export function fetchItemList(query: any) {
  return requestClient.get('/admin/dict/item/page', {
    params: query,
  });
}

export function addItemObj(obj: any) {
  return requestClient.post('/admin/dict/item', obj);
}

export function getItemObj(id: string) {
  return requestClient.get(`/admin/dict/item/details/${id}`);
}

export function getItemDetails(obj: object) {
  return requestClient.get('/admin/dict/item/details', {
    params: obj,
  });
}

export function delItemObj(id: string) {
  return requestClient.delete(`/admin/dict/item/${id}`);
}

export function putItemObj(obj: any) {
  return requestClient.put('/admin/dict/item', obj);
}

export function addObj(obj: any) {
  return requestClient.post('/admin/dict', obj);
}

export function getObj(id: string) {
  return requestClient.get(`/admin/dict/details/${id}`);
}

export function getObjDetails(obj: object) {
  return requestClient.get('/admin/dict/details', {
    params: obj,
  });
}

export function delObj(ids: object) {
  return requestClient.delete('/admin/dict', {
    data: ids,
  });
}

export function putObj(obj: any) {
  return requestClient.put('/admin/dict', obj);
}

export function refreshCache() {
  return requestClient.put('/admin/dict/sync');
}

export function validateDictType(
  _rule: any,
  value: any,
  callback: any,
  isEdit: boolean,
) {
  if (isEdit) {
    return callback();
  }

  getObjDetails(value).then((data) => {
    const result = data;
    if (result === null) {
      callback();
    } else {
      callback(new Error('字典类型已经存在'));
    }
  });
}

export function validateDictItemLabel(
  _rule: any,
  value: any,
  callback: any,
  type: string,
  isEdit: boolean,
) {
  if (isEdit) {
    return callback();
  }

  getItemDetails({ dictType: type, label: value }).then((response) => {
    const result = response.data;
    if (result === null) {
      callback();
    } else {
      callback(new Error('标签已经存在'));
    }
  });
}
