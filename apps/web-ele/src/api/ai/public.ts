import type { PublicChatPayload } from './types';

import { requestClient } from '#/api/request';

function publicHeaders(token?: string) {
  return token
    ? { Authorization: `Bearer ${token}`, skipToken: true }
    : { skipToken: true };
}

export function publicChat(
  applicationId: number | string,
  data: PublicChatPayload,
) {
  return requestClient.post(
    `/ai/api/public/applications/${applicationId}/chat`,
    data,
    {
      headers: publicHeaders(data.token),
    },
  );
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
