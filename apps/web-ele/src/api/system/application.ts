import type { Ref } from 'vue';

import { requestClient } from '#/api/request';

const base = '/ai/api/system/resource-management/applications';

/**
 * 打开应用
 */
export function open(appId?: string, _loading?: Ref<boolean>) {
  return requestClient.post(`${base}/${appId}/open`);
}

/**
 * 获取应用详情
 */
export function getApplication(id: string) {
  return requestClient.get(`${base}/${id}`);
}

export default {
  open,
  getApplication,
};
