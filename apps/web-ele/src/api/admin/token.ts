import { requestClient } from '#/api/request';

export function fetchList(query: object) {
  return requestClient.post('/admin/sys-token/page', query);
}

export function delObj(accessTokens: string[]) {
  return requestClient.delete('/admin/sys-token/delete', {
    data: accessTokens,
  });
}
