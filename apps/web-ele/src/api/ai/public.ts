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

/**
 * Public SSE chat stream — returns raw Response for manual stream reading.
 * Endpoint: POST /api/public/applications/{id}/chat/stream
 */
export function publicChatStream(
  applicationId: number | string,
  data: { chatId?: number | string; message: string },
  token: string,
): Promise<Response> {
  const url = `${apiURL}${adaptationUrl(`/ai/api/public/applications/${applicationId}/chat/stream`)}`;
  return fetch(url, {
    body: JSON.stringify(data),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
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
