import type { Ref } from 'vue';

import { requestClient } from '#/api/request';

const base = '/ai/api/system/resource-management';

/**
 * 获取对话记录详情
 */
export function getChatRecordDetails(
  applicationId: string,
  chatId: string,
  recordId: string,
  _loading?: Ref<boolean>,
) {
  return requestClient.get(
    `${base}/applications/${applicationId}/chat/${chatId}/records/${recordId}`,
  );
}

export default {
  getChatRecordDetails,
};
