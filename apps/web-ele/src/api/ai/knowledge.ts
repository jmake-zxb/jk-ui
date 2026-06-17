import type { AiQuery, OrchestrationRequest } from './types';

import { requestClient } from '#/api/request';

const base = '/ai/api/knowledge';

type Id = number | string;

export type KnowledgeType = 'BASE' | 'WEB' | 'WORKFLOW';

export interface KnowledgeRequest extends OrchestrationRequest {
  clearFolder?: boolean;
  clear_folder?: boolean;
  embeddingModelId?: Id;
  embedding_model_id?: Id;
  fileCountLimit?: number;
  fileSizeLimit?: number;
  file_count_limit?: number;
  file_size_limit?: number;
  folderId?: Id;
  folder_id?: Id;
  idList?: Id[];
  id_list?: Id[];
  parentId?: Id;
  parent_id?: Id;
  selector?: string;
  sourceUrl?: string;
  source_url?: string;
  targetFolderId?: Id;
  type?: KnowledgeType | string;
  workFlow?: Record<string, unknown> | string;
  work_flow?: Record<string, unknown> | string;
  workspaceId?: string;
  workspace_id?: string;
}

export interface KnowledgeFolderRequest extends OrchestrationRequest {
  clearParent?: boolean;
  clear_parent?: boolean;
  description?: string;
  name?: string;
  parentId?: Id;
  parent_id?: Id;
  workspaceId?: string;
  workspace_id?: string;
}

export interface DocumentRequest extends OrchestrationRequest {
  fileId?: Id;
  fileUrl?: string;
  file_id?: Id;
  file_url?: string;
  isActive?: boolean;
  is_active?: boolean;
}

export interface KnowledgeTagRecord {
  id?: Id;
  key?: string;
  name?: string;
  title?: string;
  value?: string;
  [key: string]: unknown;
}

function withFolderPayload<T extends KnowledgeFolderRequest>(data: T) {
  const parentId = data.parentId ?? data.parent_id;
  const workspaceId = data.workspaceId ?? data.workspace_id;
  return {
    ...data,
    ...(parentId === undefined ? {} : { parentId, parent_id: parentId }),
    ...(workspaceId === undefined
      ? {}
      : { workspaceId, workspace_id: workspaceId }),
  };
}

function withKnowledgePayload<T extends KnowledgeRequest>(data: T) {
  const folderId = data.folderId ?? data.folder_id ?? data.targetFolderId;
  const workspaceId = data.workspaceId ?? data.workspace_id;
  return {
    ...data,
    ...(folderId === undefined
      ? {}
      : { folderId, folder_id: folderId, targetFolderId: folderId }),
    ...(workspaceId === undefined
      ? {}
      : { workspaceId, workspace_id: workspaceId }),
  };
}

export function pageKnowledge(query?: AiQuery) {
  return requestClient.get(`${base}/page`, { params: query });
}

export function listKnowledge(query?: AiQuery) {
  return requestClient.get(`${base}/list`, { params: query });
}

export function treeKnowledge(query?: AiQuery) {
  return requestClient.get(`${base}/tree`, { params: query });
}

export function listKnowledgeFolders(query?: AiQuery) {
  return requestClient.get(`${base}/folders`, { params: query });
}

export function createKnowledgeFolder(data: KnowledgeFolderRequest) {
  return requestClient.post(`${base}/folders`, withFolderPayload(data));
}

export function updateKnowledgeFolder(
  id: number | string,
  data: KnowledgeFolderRequest,
) {
  return requestClient.put(`${base}/folders/${id}`, withFolderPayload(data));
}

export function deleteKnowledgeFolder(id: number | string) {
  return requestClient.delete(`${base}/folders/${id}`);
}

export function getKnowledge(id: number | string) {
  return requestClient.get(`${base}/${id}`);
}

export function getKnowledgeStats(id: number | string) {
  return requestClient.get(`${base}/${id}/stats`);
}

export function createKnowledge(data: OrchestrationRequest) {
  return requestClient.post(base, withKnowledgePayload(data));
}

export function updateKnowledge(
  id: number | string,
  data: OrchestrationRequest,
) {
  return requestClient.put(`${base}/${id}`, withKnowledgePayload(data));
}

export function deleteKnowledge(id: number | string) {
  return requestClient.delete(`${base}/${id}`);
}

export function batchDeleteKnowledge(ids: Id[]) {
  return requestClient.put(`${base}/batch-delete`, {
    idList: ids,
    id_list: ids,
  });
}

export function batchMoveKnowledge(ids: Id[], folderId?: Id) {
  return requestClient.put(`${base}/batch-move`, {
    clearFolder: folderId === undefined,
    clear_folder: folderId === undefined,
    folderId,
    folder_id: folderId,
    idList: ids,
    id_list: ids,
    targetFolderId: folderId,
  });
}

export function importKnowledge(
  data: KnowledgeRequest | Record<string, unknown>,
) {
  return requestClient.post(`${base}/import`, withKnowledgePayload(data));
}

export function exportKnowledge(id: number | string) {
  return requestClient.get(`${base}/${id}/export`);
}

export function searchKnowledge(
  id: number | string,
  data: OrchestrationRequest,
) {
  return requestClient.post(`${base}/${id}/search`, data);
}

export function reembedKnowledge(id: number | string, asyncMode = true) {
  return requestClient.post(
    `${base}/${id}/${asyncMode ? 'reembed-async' : 'reembed'}`,
  );
}

export function reembedFailedKnowledge(id: number | string, asyncMode = true) {
  return requestClient.post(
    `${base}/${id}/${asyncMode ? 'reembed-failed-async' : 'reembed-failed'}`,
  );
}

export function pageDocuments(knowledgeId: number | string, query?: AiQuery) {
  return requestClient.get(`${base}/${knowledgeId}/documents/page`, {
    params: query,
  });
}

export function createDocument(
  knowledgeId: number | string,
  data: OrchestrationRequest,
) {
  return requestClient.post(`${base}/${knowledgeId}/documents`, data);
}

export function createDocumentFromFile(
  knowledgeId: number | string,
  data: OrchestrationRequest,
) {
  return requestClient.post(`${base}/${knowledgeId}/documents/from-file`, data);
}

export function updateDocument(
  knowledgeId: number | string,
  documentId: number | string,
  data: DocumentRequest,
) {
  return requestClient.put(
    `${base}/${knowledgeId}/documents/${documentId}`,
    data,
  );
}

export function deleteDocument(
  knowledgeId: number | string,
  documentId: number | string,
) {
  return requestClient.delete(`${base}/${knowledgeId}/documents/${documentId}`);
}

export function reparseDocument(
  knowledgeId: number | string,
  documentId: number | string,
  asyncMode = true,
) {
  return requestClient.post(
    `${base}/${knowledgeId}/documents/${documentId}/${asyncMode ? 'reparse-async' : 'reparse'}`,
  );
}

export function reembedDocument(
  knowledgeId: number | string,
  documentId: number | string,
  asyncMode = true,
) {
  return requestClient.post(
    `${base}/${knowledgeId}/documents/${documentId}/${asyncMode ? 'reembed-async' : 'reembed'}`,
  );
}

export function pageParagraphs(
  knowledgeId: number | string,
  documentId: number | string,
  query?: AiQuery,
) {
  return requestClient.get(
    `${base}/${knowledgeId}/documents/${documentId}/paragraphs/page`,
    { params: query },
  );
}

export function createParagraph(
  knowledgeId: number | string,
  documentId: number | string,
  data: OrchestrationRequest,
) {
  return requestClient.post(
    `${base}/${knowledgeId}/documents/${documentId}/paragraphs`,
    data,
  );
}

export function updateParagraph(
  knowledgeId: number | string,
  documentId: number | string,
  paragraphId: number | string,
  data: OrchestrationRequest,
) {
  return requestClient.put(
    `${base}/${knowledgeId}/documents/${documentId}/paragraphs/${paragraphId}`,
    data,
  );
}

export function deleteParagraph(
  knowledgeId: number | string,
  documentId: number | string,
  paragraphId: number | string,
) {
  return requestClient.delete(
    `${base}/${knowledgeId}/documents/${documentId}/paragraphs/${paragraphId}`,
  );
}

export function reembedParagraph(
  knowledgeId: number | string,
  documentId: number | string,
  paragraphId: number | string,
) {
  return requestClient.post(
    `${base}/${knowledgeId}/documents/${documentId}/paragraphs/${paragraphId}/reembed`,
  );
}

export function reembedFailedParagraphs(
  knowledgeId: number | string,
  documentId: number | string,
  asyncMode = true,
) {
  return requestClient.post(
    `${base}/${knowledgeId}/documents/${documentId}/paragraphs/${asyncMode ? 'reembed-failed-async' : 'reembed-failed'}`,
  );
}

export function pageProblems(knowledgeId: number | string, query?: AiQuery) {
  return requestClient.get(`${base}/${knowledgeId}/problems/page`, {
    params: query,
  });
}

export function createProblem(
  knowledgeId: number | string,
  data: OrchestrationRequest,
) {
  return requestClient.post(`${base}/${knowledgeId}/problems`, data);
}

export function updateProblem(
  knowledgeId: number | string,
  id: number | string,
  data: OrchestrationRequest,
) {
  return requestClient.put(`${base}/${knowledgeId}/problems/${id}`, data);
}

export function deleteProblem(
  knowledgeId: number | string,
  id: number | string,
) {
  return requestClient.delete(`${base}/${knowledgeId}/problems/${id}`);
}

export function pageTermbase(knowledgeId: number | string, query?: AiQuery) {
  return requestClient.get(`${base}/${knowledgeId}/termbase/page`, {
    params: query,
  });
}

export function createTerm(
  knowledgeId: number | string,
  data: OrchestrationRequest,
) {
  return requestClient.post(`${base}/${knowledgeId}/termbase`, data);
}

export function updateTerm(
  knowledgeId: number | string,
  id: number | string,
  data: OrchestrationRequest,
) {
  return requestClient.put(`${base}/${knowledgeId}/termbase/${id}`, data);
}

export function deleteTerm(knowledgeId: number | string, id: number | string) {
  return requestClient.delete(`${base}/${knowledgeId}/termbase/${id}`);
}

export function pageTags(knowledgeId: number | string, query?: AiQuery) {
  return requestClient.get(`${base}/${knowledgeId}/tags/page`, {
    params: query,
  });
}

export function listKnowledgeTags(
  knowledgeIds: Id[],
  query: AiQuery = {} as AiQuery,
) {
  const fullQuery = { page: 1, size: 1000, ...query };
  return Promise.all(
    knowledgeIds.map((knowledgeId) => pageTags(knowledgeId, fullQuery)),
  );
}

export function createTag(
  knowledgeId: number | string,
  data: OrchestrationRequest,
) {
  return requestClient.post(`${base}/${knowledgeId}/tags`, data);
}

export function updateTag(
  knowledgeId: number | string,
  id: number | string,
  data: OrchestrationRequest,
) {
  return requestClient.put(`${base}/${knowledgeId}/tags/${id}`, data);
}

export function deleteTag(knowledgeId: number | string, id: number | string) {
  return requestClient.delete(`${base}/${knowledgeId}/tags/${id}`);
}

export function bindDocumentTag(
  knowledgeId: number | string,
  documentId: number | string,
  tagId: number | string,
) {
  return requestClient.post(
    `${base}/${knowledgeId}/documents/${documentId}/tags/${tagId}`,
  );
}

export function listDocumentTags(
  knowledgeId: number | string,
  documentId: number | string,
) {
  return requestClient.get(
    `${base}/${knowledgeId}/documents/${documentId}/tags`,
  );
}

export function unbindDocumentTag(
  knowledgeId: number | string,
  documentId: number | string,
  tagId: number | string,
) {
  return requestClient.delete(
    `${base}/${knowledgeId}/documents/${documentId}/tags/${tagId}`,
  );
}

export function saveKnowledgeWorkflowDraft(
  knowledgeId: number | string,
  data: OrchestrationRequest,
) {
  return requestClient.put(`${base}/${knowledgeId}/workflow/draft`, data);
}

export function publishKnowledgeWorkflow(knowledgeId: number | string) {
  return requestClient.post(`${base}/${knowledgeId}/workflow/publish`);
}

export function pageKnowledgeWorkflowActions(
  knowledgeId: number | string,
  query?: AiQuery,
) {
  return requestClient.get(`${base}/${knowledgeId}/workflow/actions/page`, {
    params: query,
  });
}
