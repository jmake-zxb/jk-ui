import { requestClient } from '#/api/request';

const base = '/ai/api';

/**
 * 获取对话记录详情
 */
export function getChatRecordDetails(
  applicationId: string,
  chatId: string,
  recordId: string,
  _loading?: any,
) {
  return requestClient.get(
    `${base}/applications/${applicationId}/chat/${chatId}/records/${recordId}`,
  );
}

/**
 * 对话记录提交至知识库
 */
export function postChatLogAddKnowledge(
  applicationId: string,
  data: any,
  _loading?: any,
) {
  return requestClient.post(
    `${base}/applications/${applicationId}/add_knowledge`,
    data,
  );
}

/**
 * 对话日志列表
 */
export function getChatLog(
  applicationId: string,
  page: { current_page: number; page_size: number },
  param: any,
  _loading?: any,
) {
  return requestClient.get(`${base}/applications/${applicationId}/chat`, {
    params: {
      ...param,
      page: page.current_page,
      size: page.page_size,
    },
  });
}

/**
 * 获得对话日志记录
 */
export function getChatRecordLog(
  applicationId: string,
  chatId: string,
  page: { current_page: number; page_size: number },
  loading?: any,
  orderAsc?: boolean,
) {
  return requestClient.get(
    `${base}/applications/${applicationId}/chat/${chatId}/records`,
    {
      params: {
        page: page.current_page,
        size: page.page_size,
        order_asc: orderAsc === undefined ? true : orderAsc,
      },
    },
  );
}

export default {
  getChatRecordDetails,
  postChatLogAddKnowledge,
  getChatLog,
  getChatRecordLog,
};
