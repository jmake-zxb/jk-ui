import { requestClient } from '#/api/request';

export const pageList = (params?: object) => {
  return requestClient.get('/admin/log/page', {
    params,
  });
};

export const delObj = (ids: object) => {
  return requestClient.delete('/admin/log', {
    data: ids,
  });
};
