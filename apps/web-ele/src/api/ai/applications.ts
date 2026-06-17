import type { RequestResponse } from '@vben/request';

import type {
  AiQuery,
  ApplicationPayload,
  OrchestrationRequest,
} from './types';

import { requestClient } from '#/api/request';

const base = '/ai/api/applications';

export function pageApplications(query?: AiQuery) {
  return requestClient.get(`${base}/page`, { params: query });
}

export function listApplications() {
  return requestClient.get(`${base}/list`);
}

export function getApplication(id: number | string) {
  return requestClient.get(`${base}/${id}`);
}

export { getWorkflowDraft } from './application-workflow';

export function createApplication(data: ApplicationPayload) {
  return requestClient.post(base, data);
}

export function updateApplication(
  id: number | string,
  data: ApplicationPayload,
) {
  return requestClient.put(`${base}/${id}`, data);
}

export function deleteApplication(id: number | string) {
  return requestClient.delete(`${base}/${id}`);
}

export function batchDeleteApplications(ids: Array<number | string>) {
  return requestClient.delete(`${base}/batch`, { data: ids });
}

export function copyApplication(id: number | string) {
  return requestClient.post(`${base}/${id}/copy`);
}

export function moveApplication(
  id: number | string,
  data: OrchestrationRequest,
) {
  return requestClient.post(`${base}/${id}/move`, data);
}

function parseFilenameFromContentDisposition(
  disposition: null | string | undefined,
): string | undefined {
  if (!disposition) return undefined;
  // Try RFC 5987 filename* first (e.g. filename*=UTF-8''my%20file.json)
  const filenameStarMatch = /filename\*=(?:[^']*'')?([^;\n]+)/i.exec(
    disposition,
  );
  if (filenameStarMatch?.[1]) {
    try {
      return decodeURIComponent(
        filenameStarMatch[1].trim().replaceAll('"', ''),
      );
    } catch {
      return filenameStarMatch[1].trim().replaceAll('"', '');
    }
  }
  const filenameMatch = /filename\s*=\s*"?([^";\n]+)"?/i.exec(disposition);
  return filenameMatch?.[1]?.trim();
}

export async function exportApplication(id: number | string) {
  const response = await requestClient.download<RequestResponse<Blob>>(
    `${base}/${id}/export`,
    {
      responseReturn: 'raw',
    },
  );
  const blob = response.data;
  if (!blob || blob.size === 0) {
    throw new Error('导出内容为空');
  }
  const disposition =
    response.headers?.['content-disposition'] ??
    response.headers?.['Content-Disposition'];
  const filename =
    parseFilenameFromContentDisposition(
      typeof disposition === 'string' ? disposition : undefined,
    ) || `application-${id}.json`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function importApplication(
  file: File,
  folderId?: number | string,
  workspaceId?: string,
) {
  const formData = new FormData();
  formData.append('file', file);
  if (folderId !== undefined && folderId !== null && folderId !== '') {
    formData.append('folderId', String(folderId));
  }
  if (workspaceId) {
    formData.append('workspaceId', workspaceId);
  }
  return requestClient.post(`${base}/import`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}

export function textToSpeech(id: number | string, data: { text: string }) {
  return requestClient.download<Blob>(`${base}/${id}/text_to_speech`, {
    method: 'POST',
    data,
    responseReturn: 'body',
  });
}

export function speechToText(id: number | string, file: Blob | File) {
  // The default response interceptor unwraps `{code,data,message}` to `data`,
  // so the upload resolves directly to the transcribed string.
  return requestClient.upload<string>(`${base}/${id}/speech_to_text`, { file });
}

export function playDemoText(
  id: number | string,
  data?: Record<string, unknown>,
) {
  return requestClient.download<Blob>(`${base}/${id}/play_demo_text`, {
    method: 'POST',
    data: data ?? {},
    responseReturn: 'body',
  });
}

export function openApplicationChat(
  id: number | string,
  data?: { source?: string; title?: string },
) {
  return requestClient.post(`${base}/${id}/chats/open`, data || {});
}

export function pageApplicationChats(id: number | string, query?: AiQuery) {
  return requestClient.get(`${base}/${id}/chats/page`, { params: query });
}

export function pageApplicationChatRecords(
  id: number | string,
  chatId: number | string,
  query?: AiQuery,
) {
  return requestClient.get(`${base}/${id}/chats/${chatId}/records/page`, {
    params: query,
  });
}

export function listChatRecordAnnotations(
  id: number | string,
  chatId: number | string,
  chatRecordId: number | string,
) {
  return requestClient.get(
    `${base}/${id}/chats/${chatId}/records/${chatRecordId}/improve`,
  );
}

export function createChatRecordAnnotation(
  id: number | string,
  chatId: number | string,
  chatRecordId: number | string,
  knowledgeId: number | string,
  documentId: number | string,
  data?: { content?: string; title?: string },
) {
  return requestClient.put(
    `${base}/${id}/chats/${chatId}/records/${chatRecordId}/knowledge/${knowledgeId}/document/${documentId}/improve`,
    data || {},
  );
}

export function deleteChatRecordAnnotation(
  id: number | string,
  chatId: number | string,
  chatRecordId: number | string,
  knowledgeId: number | string,
  documentId: number | string,
  paragraphId: number | string,
) {
  return requestClient.delete(
    `${base}/${id}/chats/${chatId}/records/${chatRecordId}/knowledge/${knowledgeId}/document/${documentId}/paragraph/${paragraphId}/improve`,
  );
}

export function renameApplicationChat(
  id: number | string,
  chatId: number | string,
  title: string,
) {
  return requestClient.put(`${base}/${id}/chats/${chatId}`, { title });
}

export function deleteApplicationChat(
  id: number | string,
  chatId: number | string,
) {
  return requestClient.delete(`${base}/${id}/chats/${chatId}`);
}

export function clearApplicationChats(id: number | string) {
  return requestClient.delete(`${base}/${id}/chats`);
}

export function pageAccessTokens(
  applicationId: number | string,
  query?: AiQuery,
) {
  return requestClient.get(`${base}/${applicationId}/access-tokens/page`, {
    params: query,
  });
}

export function createAccessToken(
  applicationId: number | string,
  data?: OrchestrationRequest,
) {
  return requestClient.post(
    `${base}/${applicationId}/access-tokens`,
    data || {},
  );
}

export function toggleAccessToken(
  applicationId: number | string,
  tokenId: number | string,
  enabled?: boolean,
) {
  return requestClient.put(
    `${base}/${applicationId}/access-tokens/${tokenId}/toggle`,
    {
      enabled,
    },
  );
}

export function updateAccessToken(
  applicationId: number | string,
  tokenId: number | string,
  data: Record<string, unknown>,
) {
  return requestClient.put(
    `${base}/${applicationId}/access-tokens/${tokenId}`,
    data,
  );
}

export function deleteAccessToken(
  applicationId: number | string,
  tokenId: number | string,
) {
  return requestClient.delete(
    `${base}/${applicationId}/access-tokens/${tokenId}`,
  );
}

export function pageApplicationKeys(
  applicationId: number | string,
  query?: AiQuery,
) {
  return requestClient.get(`${base}/${applicationId}/keys/page`, {
    params: query,
  });
}

export function createApplicationKey(
  applicationId: number | string,
  data?: OrchestrationRequest,
) {
  return requestClient.post(`${base}/${applicationId}/keys`, data || {});
}

export function toggleApplicationKey(
  applicationId: number | string,
  keyId: number | string,
  enabled?: boolean,
) {
  return requestClient.put(`${base}/${applicationId}/keys/${keyId}/toggle`, {
    enabled,
  });
}

export function deleteApplicationKey(
  applicationId: number | string,
  keyId: number | string,
) {
  return requestClient.delete(`${base}/${applicationId}/keys/${keyId}`);
}

export function getApplicationSetting(id: number | string) {
  return requestClient.get(`${base}/${id}/setting`);
}

export function saveApplicationSetting(
  id: number | string,
  data: Record<string, unknown>,
) {
  return requestClient.put(`${base}/${id}/setting`, data);
}

export interface LongTermMemory {
  chatUserId: string;
  memory: string;
  updateTime?: string;
}

export function listLongTermMemories(applicationId: number | string) {
  return requestClient.get<LongTermMemory[]>(
    `${base}/${applicationId}/long-term-memory`,
  );
}

export function getLongTermMemory(
  applicationId: number | string,
  chatUserId: number | string,
) {
  return requestClient.get<LongTermMemory>(
    `${base}/${applicationId}/long-term-memory/${chatUserId}`,
  );
}

export function updateLongTermMemory(
  applicationId: number | string,
  chatUserId: number | string,
  memory: string,
) {
  return requestClient.put(
    `${base}/${applicationId}/long-term-memory/${chatUserId}`,
    { memory },
  );
}

export function deleteLongTermMemory(
  applicationId: number | string,
  chatUserId: number | string,
) {
  return requestClient.delete(
    `${base}/${applicationId}/long-term-memory/${chatUserId}`,
  );
}

export function clearLongTermMemories(applicationId: number | string) {
  return requestClient.delete(`${base}/${applicationId}/long-term-memory`);
}

export function triggerLongTermExtract(
  applicationId: number | string,
  data?: { historyLimit?: number },
) {
  return requestClient.post(
    `${base}/${applicationId}/long-term-memory/extract`,
    data || {},
  );
}
