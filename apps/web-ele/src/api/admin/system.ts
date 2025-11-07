import { requestClient } from '#/api/request';

// 系统缓存监控
export function systemCache() {
  return requestClient.get('/admin/system/cache');
}
