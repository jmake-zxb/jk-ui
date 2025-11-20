import { requestClient } from '#/api/request';

export function fetchList(query?: object) {
  return requestClient.get('/admin/post/page', {
    params: query,
  });
}

export const list = (params?: object) => {
  return requestClient.get('/admin/post/list', {
    params,
  });
};

export function addObj(obj?: object) {
  return requestClient.post('/admin/post', obj);
}

export function getObj(id?: string) {
  return requestClient.get(`/admin/post/details/${id}`);
}

export function getObjDetails(obj?: object) {
  return requestClient.get('/admin/post/details', {
    params: obj,
  });
}

export function delObj(ids?: object) {
  return requestClient.delete('/admin/post', {
    data: ids,
  });
}

export function putObj(obj?: object) {
  return requestClient.put('/admin/post', obj);
}

export function validatePostName(
  _rule: any,
  value: any,
  callback: any,
  isEdit: boolean,
) {
  if (isEdit) {
    return callback();
  }

  getObjDetails({ postName: value }).then((response) => {
    const result = response.data;
    if (result === null) {
      callback();
    } else {
      callback(new Error('岗位名称已经存在'));
    }
  });
}

export function validatePostCode(
  _rule: any,
  value: any,
  callback: any,
  isEdit: boolean,
) {
  if (isEdit) {
    return callback();
  }

  getObjDetails({ postCode: value }).then((response) => {
    const result = response.data;
    if (result === null) {
      callback();
    } else {
      callback(new Error('岗位编码已经存在'));
    }
  });
}
