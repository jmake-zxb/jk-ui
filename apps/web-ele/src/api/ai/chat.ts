import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import { requestClient } from '#/api/request';
import { adaptationUrl } from '#/utils/other';

const base = '/ai/api';

/**
 * SSE 流式对话
 * 后端: POST /api/applications/{id}/chat/message/stream
 * @param applicationId 应用ID
 * @param data 消息数据 (message, conversationId, inputJson, form_data 等)
 */
export function chatSSE(applicationId: string, data: Record<string, any>) {
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
  const accessToken = useAccessStore().accessToken;
  const url = `${apiURL}${adaptationUrl(`${base}/applications/${applicationId}/chat/message/stream`)}`;
  return fetch(url, {
    body: JSON.stringify(data),
    headers: {
      Authorization: accessToken ? `Bearer ${accessToken}` : '',
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
}

/**
 * 工作流调试 SSE（跑草稿、无 chatId）。
 * 后端: POST /api/applications/{id}/workflow/debug/stream
 *
 * 与 chatSSE 不同：返回原始 fetch Response（含 body.getReader()），
 * 供 AiChat debug-ai-chat 模式通过 getWriteDebug 消费。
 * 事件格式：node_start / node_chunk / node_end / node_reasoning_chunk /
 *           node_interrupt / done / error / canceled。
 */
export function workflowDebugSSE(
  applicationId: number | string,
  data: {
    chatId?: number | string;
    chatRecordId?: number | string;
    childNode?: Record<string, any>;
    formData?: Record<string, any>;
    formDataJson?: string;
    inputJson?: string;
    message: string;
    nodeData?: Record<string, any>;
    runtimeNodeId?: string;
  },
) {
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
  const accessToken = useAccessStore().accessToken;
  const url = `${apiURL}${adaptationUrl(`${base}/applications/${applicationId}/workflow/debug/stream`)}`;
  return fetch(url, {
    body: JSON.stringify(data),
    headers: {
      Authorization: accessToken ? `Bearer ${accessToken}` : '',
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
}

/**
 * 工作流恢复 SSE（表单提交后恢复中断的工作流运行）。
 * 后端: POST /api/applications/{id}/workflow/runs/{runId}/resume/stream
 *
 * 与 workflowDebugSSE 不同：传入 runId 定位已中断的工作流运行，
 * 后端从中断节点之后恢复执行，不会从头重跑。
 * 事件格式同 workflowDebugSSE。
 *
 * @deprecated 表单恢复已统一到 workflowDebugSSE（传入 chatId + runtimeNodeId + formDataJson），
 * 后端在 workflowDebugSSE 端点内自动判断是否为恢复请求。
 * 此函数保留以备兼容，新代码请勿使用。
 */
export function workflowResumeSSE(
  applicationId: number | string,
  runId: number | string,
  data: { formDataJson: string; message?: string },
) {
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
  const accessToken = useAccessStore().accessToken;
  const url = `${apiURL}${adaptationUrl(`${base}/applications/${applicationId}/workflow/runs/${runId}/resume/stream`)}`;
  return fetch(url, {
    body: JSON.stringify(data),
    headers: {
      Authorization: accessToken ? `Bearer ${accessToken}` : '',
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
}

/**
 * 开启会话
 * 后端: POST /api/applications/{id}/chats/open
 * @param applicationId 应用ID
 * @param data 可选参数
 * @param data.title 会话标题
 * @param data.source 来源
 */
export function openChat(
  applicationId: string,
  data?: { source?: string; title?: string },
) {
  return requestClient.post<{ id: number; title: string }>(
    `${base}/applications/${applicationId}/chats/open`,
    data || {},
  );
}

/**
 * 分页查询对话记录
 * 后端: GET /api/applications/{id}/chats/{chatId}/records/page
 * @param applicationId 应用ID
 * @param chatId 对话ID
 * @param query 分页参数
 * @param query.current 当前页码
 * @param query.size 每页条数
 */
export function pageChatRecords(
  applicationId: string,
  chatId: string,
  query?: { current?: number; size?: number },
) {
  return requestClient.get(
    `${base}/applications/${applicationId}/chats/${chatId}/records/page`,
    { params: query },
  );
}

/**
 * 点赞/点踩
 * 后端: POST /api/public/applications/{id}/records/{recordId}/vote
 * @param applicationId 应用ID
 * @param recordId 记录ID
 * @param voteStatus 状态: '0'=点赞, '1'=点踩, '-1'=取消
 * @param voteReason 原因
 * @param voteOtherContent 其他内容
 */
export function vote(
  applicationId: string,
  recordId: string,
  voteStatus: string,
  voteReason?: string,
  voteOtherContent?: string,
) {
  const data: Record<string, any> = { type: voteStatus };
  if (voteReason !== undefined) data.vote_reason = voteReason;
  if (voteOtherContent !== undefined) data.content = voteOtherContent;
  return requestClient.post(
    `${base}/public/applications/${applicationId}/records/${recordId}/vote`,
    data,
  );
}

/**
 * 生成分享链接
 * 后端: POST /api/public/applications/{id}/chats/{chatId}/share
 * @param applicationId 应用ID
 * @param chatId 对话ID
 * @param data 分享配置
 * @param data.chat_record_ids 聊天记录ID列表
 * @param data.enabled 是否启用
 * @param data.is_current_all 是否当前全部
 * @param data.secret 密钥
 */
export function postShareChat(
  applicationId: string,
  chatId: string,
  data?: {
    chat_record_ids?: string[];
    enabled?: boolean;
    is_current_all?: boolean;
    secret?: string;
  },
) {
  return requestClient.post<{ shareToken: string }>(
    `${base}/public/applications/${applicationId}/chats/${chatId}/share`,
    data || { enabled: true },
  );
}

/**
 * 获取分享链接内容
 * 后端: GET /api/public/shares/{shareToken}
 * @param shareToken 分享令牌
 */
export function getShareLink(shareToken: string) {
  return requestClient.get(`${base}/public/shares/${shareToken}`);
}

/**
 * 上传文件
 * @param file 文件对象
 * @param sourceId 资源ID
 * @param sourceType 资源类型
 */
export function postUploadFile(
  file: File,
  sourceId: string,
  sourceType:
    | 'APPLICATION'
    | 'CHAT'
    | 'KNOWLEDGE'
    | 'TEMPORARY_1_DAY'
    | 'TEMPORARY_30_MINUTE'
    | 'TEMPORARY_120_MINUTE',
) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('source_id', sourceId);
  fd.append('source_type', sourceType);
  return requestClient.post<string>(`${base}/oss/file`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

/**
 * 获取文件URL
 * @param applicationId 应用ID
 * @param params 查询参数
 * @param params.url 文件URL
 */
export function getFileUrl(applicationId: string, params: { url: string }) {
  return requestClient.get(`${base}/oss/get_url/${applicationId}`, {
    params,
  });
}

/**
 * 语音转文字
 * 后端: POST /api/applications/{id}/speech_to_text
 * @param applicationId 应用ID
 * @param formData FormData 包含音频文件
 */
export function speechToText(applicationId: string, formData: FormData) {
  return requestClient.post<string>(
    `${base}/applications/${applicationId}/speech_to_text`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
}

/**
 * 文本转语音
 * 后端: POST /api/applications/{id}/text_to_speech
 * @param applicationId 应用ID
 * @param data 请求参数
 * @param data.text 文本内容
 */
export function textToSpeech(applicationId: string, data: { text: string }) {
  return requestClient.download<Blob>(
    `${base}/applications/${applicationId}/text_to_speech`,
    { data, method: 'POST', responseReturn: 'body' },
  );
}

/**
 * 获取应用公开配置
 * 后端: GET /api/public/applications/{id}/profile
 * @param applicationId 应用ID
 */
export function applicationProfile(applicationId: string) {
  return requestClient.get(
    `${base}/public/applications/${applicationId}/profile`,
    { headers: { skipToken: true } },
  );
}

/**
 * 匿名认证
 * @param accessToken 访问令牌
 */
export function anonymousAuth(accessToken: string) {
  return requestClient.post(
    `${base}/public/auth/anonymous`,
    { access_token: accessToken },
    { headers: { skipToken: true } },
  );
}

/**
 * 密码认证
 * @param accessToken 访问令牌
 * @param password 密码
 */
export function passwordAuth(accessToken: string, password: string) {
  return requestClient.post(
    `${base}/public/auth/password`,
    { access_token: accessToken, password },
    { headers: { skipToken: true } },
  );
}

/**
 * 获取历史对话列表
 * 后端: GET /api/chat/conversations
 */
export function pageChats(query?: { current?: number; size?: number }) {
  return requestClient.get(`${base}/chat/conversations`, { params: query });
}

/**
 * 获取对话记录详情
 * 后端: GET /api/chat/history?conversationId=xxx
 * @param conversationId 会话ID
 */
export function getChatHistory(conversationId: string) {
  return requestClient.get(`${base}/chat/history`, {
    params: { conversationId },
  });
}

/**
 * 删除对话
 * 后端: DELETE /api/applications/{id}/chats/{chatId}
 * @param applicationId 应用ID
 * @param chatId 对话ID
 */
export function deleteChat(applicationId: string, chatId: string) {
  return requestClient.delete(
    `${base}/applications/${applicationId}/chats/${chatId}`,
  );
}

/**
 * 清空对话历史
 * 后端: DELETE /api/applications/{id}/chats
 * @param applicationId 应用ID
 */
export function clearChats(applicationId: string) {
  return requestClient.delete(`${base}/applications/${applicationId}/chats`);
}

/**
 * 重命名对话
 * 后端: PUT /api/applications/{id}/chats/{chatId}
 * @param applicationId 应用ID
 * @param chatId 对话ID
 * @param title 新标题
 */
export function renameChat(
  applicationId: string,
  chatId: string,
  title: string,
) {
  return requestClient.put(
    `${base}/applications/${applicationId}/chats/${chatId}`,
    { title },
  );
}

/**
 * 获取用户资料
 * 后端: GET /api/chat_user/profile
 */
export function getChatUserProfile() {
  return requestClient.get(`${base}/chat_user/profile`);
}

/**
 * 重置密码
 * @param data 密码数据
 * @param data.old_password 旧密码
 * @param data.new_password 新密码
 */
export function resetPassword(data: {
  new_password: string;
  old_password: string;
}) {
  return requestClient.post(`${base}/chat_user/current/reset_password`, data);
}
