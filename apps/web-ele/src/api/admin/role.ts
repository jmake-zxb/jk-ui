import { requestClient } from '#/api/request';

export const list = (params?: object) => {
  return requestClient.get('/admin/role/list', {
    params,
  });
};

export const pageList = (params?: object) => {
  return requestClient.get('/admin/role/page', {
    params,
  });
};

export const deptRoleList = () => {
  return requestClient.get('/admin/role/list');
};

export const getObj = (id: string) => {
  return requestClient.get(`/admin/role/details/${id}`);
};

export const getObjDetails = (obj: object) => {
  return requestClient.get('/admin/role/details', {
    params: obj,
  });
};

export const addObj = (obj: object) => {
  return requestClient.post('/admin/role', obj);
};

export const putObj = (obj: object) => {
  return requestClient.put('/admin/role', obj);
};

export const delObj = (ids: object) => {
  return requestClient.delete('/admin/role', {
    data: ids,
  });
};

export const permissionUpd = (roleId: string, menuIds: string) => {
  return requestClient.put('/admin/role/menu', {
    roleId,
    menuIds,
  });
};

export const fetchRoleTree = (roleId: string) => {
  return requestClient.get(`/admin/menu/tree/${roleId}`);
};

export function validateRoleCode(
  _rule: any,
  value: any,
  callback: any,
  isEdit: boolean,
) {
  if (isEdit) {
    return callback();
  }

  getObjDetails({ roleCode: value }).then((response) => {
    const result = response.data;
    if (result === null) {
      callback();
    } else {
      callback(new Error('角色标识已经存在'));
    }
  });
}

export function validateRoleName(
  _rule: any,
  value: any,
  callback: any,
  isEdit: boolean,
) {
  if (isEdit) {
    return callback();
  }

  getObjDetails({ roleName: value }).then((response) => {
    const result = response.data;
    if (result === null) {
      callback();
    } else {
      callback(new Error('角色名称已经存在'));
    }
  });
}
