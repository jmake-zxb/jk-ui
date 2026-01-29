import { requestClient } from '#/api/request';

/**
 * 查询历史对话
 * @param query - 查询参数对象
 * @returns Promise<分页数据>
 */
export function fetchList(query?: object) {
  return requestClient.get('/ai/api/history', {
    params: query,
  });
}
