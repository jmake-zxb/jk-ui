import type { PublicChatPayload } from './types';

import { useAppConfig } from '@vben/hooks';

import { requestClient } from '#/api/request';
import { adaptationUrl } from '#/utils/other';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

function publicHeaders(token?: string) {
  return token
    ? { Authorization: `Bearer ${token}`, skipToken: true }
    : { skipToken: true };
}

export interface PublicChatMessagePayload extends PublicChatPayload {
  audio_list?: unknown[];
  audioList?: unknown[];
  chatId?: number | string;
  chat_record_id?: number | string;
  chatRecordId?: number | string;
  child_node?: Record<string, unknown>;
  childNode?: Record<string, unknown>;
  document_list?: unknown[];
  documentList?: unknown[];
  form_data?: Record<string, unknown>;
  formData?: Record<string, unknown>;
  formDataJson?: string;
  image_list?: unknown[];
  imageList?: unknown[];
  node_data?: Record<string, unknown>;
  nodeData?: Record<string, unknown>;
  node_id?: string;
  nodeId?: string;
  other_list?: unknown[];
  otherList?: unknown[];
  re_chat?: boolean;
  reChat?: boolean;
  runtime_node_id?: string;
  runtimeNodeId?: string;
  stream?: boolean;
  video_list?: unknown[];
  videoList?: unknown[];
}

function normalizeChatPayload(data: PublicChatMessagePayload) {
  if (data.chatId === undefined || data.id !== undefined) return data;
  return { ...data, id: data.chatId };
}

/**
 * Public SSE chat stream — returns raw Response for manual stream reading.
 * Endpoint: POST /api/public/applications/{id}/chat/stream
 */
export function publicChatStream(
  applicationId: number | string,
  data: PublicChatMessagePayload,
  token: string,
): Promise<Response> {
  const url = `${apiURL}${adaptationUrl(`/ai/api/public/applications/${applicationId}/chat/stream`)}`;
  return fetch(url, {
    body: JSON.stringify(normalizeChatPayload(data)),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
}

export function publicChat(
  applicationId: number | string,
  data: PublicChatMessagePayload,
) {
  return requestClient.post(
    `/ai/api/public/applications/${applicationId}/chat`,
    normalizeChatPayload(data),
    {
      headers: publicHeaders(data.token),
    },
  );
}

export function getTokenApplicationProfile(token: string) {
  return requestClient.get(
    `/ai/api/public/chat/${encodeURIComponent(token)}/profile`,
    {
      headers: publicHeaders(),
    },
  );
}

export function openPublicTokenChat(
  token: string,
  data?: PublicChatMessagePayload,
) {
  return requestClient.post(
    `/ai/api/public/chat/${encodeURIComponent(token)}/open`,
    data || {},
    { headers: publicHeaders() },
  );
}

export function publicTokenChat(token: string, data: PublicChatMessagePayload) {
  return requestClient.post(
    `/ai/api/public/chat/${encodeURIComponent(token)}/chat`,
    normalizeChatPayload(data),
    { headers: publicHeaders() },
  );
}

export function publicTokenChatStream(
  token: string,
  data: PublicChatMessagePayload,
): Promise<Response> {
  const chatId = data.chatId ?? data.id;
  const encodedToken = encodeURIComponent(token);
  const path = chatId
    ? `/ai/api/public/chat/${encodedToken}/chat_message/${encodeURIComponent(`${chatId}`)}`
    : `/ai/api/public/chat/${encodedToken}/chat/stream`;
  const url = `${apiURL}${adaptationUrl(path)}`;
  return fetch(url, {
    body: JSON.stringify(normalizeChatPayload(data)),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
}

export function openPublicChat(
  applicationId: number | string,
  data?: PublicChatPayload,
) {
  return requestClient.post(
    `/ai/api/public/applications/${applicationId}/access-token/chats/open`,
    data || {},
    { headers: publicHeaders(data?.token) },
  );
}

export function votePublicRecord(
  applicationId: number | string,
  recordId: number | string,
  data: PublicChatPayload,
) {
  return requestClient.post(
    `/ai/api/public/applications/${applicationId}/records/${recordId}/vote`,
    data,
    { headers: publicHeaders(data.token) },
  );
}

export function createPublicShare(
  applicationId: number | string,
  chatId: number | string,
  data?: PublicChatPayload,
) {
  return requestClient.post(
    `/ai/api/public/applications/${applicationId}/chats/${chatId}/share`,
    data || {},
    { headers: publicHeaders(data?.token) },
  );
}

export function getPublicShare(shareToken: string) {
  return requestClient.get(`/ai/api/public/shares/${shareToken}`, {
    headers: publicHeaders(),
  });
}

export function getApplicationProfile(applicationId: number | string) {
  return requestClient.get(
    `/ai/api/public/applications/${applicationId}/profile`,
    { headers: publicHeaders() },
  );
}

export function openAiChatCompletion(
  applicationId: number | string,
  data: object,
  apiKey?: string,
) {
  return requestClient.post(
    `/ai/v1/applications/${applicationId}/chat/completions`,
    data,
    {
      headers: apiKey
        ? { Authorization: `Bearer ${apiKey}`, skipToken: true }
        : undefined,
    },
  );
}

export function publicTextToSpeech(
  applicationId: number | string,
  data: { text: string },
  token?: string,
) {
  return requestClient.download<Blob>(
    `/ai/api/public/applications/${applicationId}/text_to_speech`,
    {
      method: 'POST',
      data,
      responseReturn: 'body',
      headers: publicHeaders(token),
    },
  );
}

export function publicSpeechToText(
  applicationId: number | string,
  file: Blob | File,
  token?: string,
) {
  return requestClient.upload<string>(
    `/ai/api/public/applications/${applicationId}/speech_to_text`,
    { file },
    { headers: publicHeaders(token) },
  );
}

/**
 * Public token-path speech-to-text.
 * Endpoint: POST /api/public/chat/{token}/speech_to_text
 */
export function publicTokenSpeechToText(token: string, file: Blob | File) {
  const encodedToken = encodeURIComponent(token);
  return requestClient.upload<string>(
    `/ai/api/public/chat/${encodedToken}/speech_to_text`,
    { file },
    { headers: publicHeaders() },
  );
}

/**
 * Get a single chat-record detail (execution_details, paragraph_list, etc.)
 * Endpoint: GET /api/public/chat/{token}/records/{recordId}
 */
export function getPublicChatRecordDetail(
  token: string,
  recordId: number | string,
) {
  const encodedToken = encodeURIComponent(token);
  return requestClient.get<Record<string, any>>(
    `/ai/api/public/chat/${encodedToken}/records/${encodeURIComponent(`${recordId}`)}`,
    { headers: publicHeaders() },
  );
}

/**
 * Page chat records by public token.
 * Endpoint: GET /api/public/chat/{token}/chats/{chatId}/records/page
 */
export function pagePublicTokenChatRecords(
  token: string,
  chatId: number | string,
  query?: { current?: number; size?: number },
) {
  const encodedToken = encodeURIComponent(token);
  return requestClient.get(
    `/ai/api/public/chat/${encodedToken}/chats/${encodeURIComponent(`${chatId}`)}/records/page`,
    { params: query, headers: publicHeaders() },
  );
}

/**
 * Page chat sessions by public token.
 * Endpoint: GET /api/public/chat/{token}/chats/page
 */
export function pagePublicTokenChats(
  token: string,
  query?: { current?: number; size?: number },
) {
  const encodedToken = encodeURIComponent(token);
  return requestClient.get(`/ai/api/public/chat/${encodedToken}/chats/page`, {
    params: query,
    headers: publicHeaders(),
  });
}

/**
 * Fetch remote URL file info (server-side fetch with SSRF protection).
 * Endpoint: GET /api/public/chat/{token}/get-url?url=...
 */
export function getPublicUrlFile(token: string, url: string) {
  const encodedToken = encodeURIComponent(token);
  return requestClient.get<Record<string, any>>(
    `/ai/api/public/chat/${encodedToken}/get-url`,
    { params: { url }, headers: publicHeaders() },
  );
}

/**
 * Fetch remote URL file info (application path with Bearer token).
 * Endpoint: GET /api/public/applications/{applicationId}/get-url?url=...
 */
export function getApplicationUrlFile(
  applicationId: number | string,
  url: string,
  token?: string,
) {
  return requestClient.get<Record<string, any>>(
    `/ai/api/public/applications/${applicationId}/get-url`,
    { params: { url }, headers: publicHeaders(token) },
  );
}
