import { requestClient } from '#/api/request';

export const deptTree = (params?: object) => {
  return requestClient.get('/admin/dept/tree', {
    params,
  });
};

export const addObj = (obj: object) => {
  return requestClient.post('/admin/dept', obj);
};

export const getObj = (id: string) => {
  return requestClient.get(`/admin/dept/${id}`);
};

export const delObj = (id: string) => {
  return requestClient.delete(`/admin/dept/${id}`);
};

export const putObj = (obj: object) => {
  return requestClient.put('/admin/dept', obj);
};

export const syncUser = () => {
  return requestClient.post('/admin/connect/sync/ding/user');
};

export const syncDept = () => {
  return requestClient.post('/admin/connect/sync/ding/dept');
};

export const syncCpUser = () => {
  return requestClient.post('/admin/connect/sync/cp/user');
};

export const syncCpDept = () => {
  return requestClient.post('/admin/connect/sync/cp/dept');
};
