import type { AiQuery, OrchestrationRequest } from './types';

import { requestClient } from '#/api/request';

const base = '/ai/api/knowledge';

type Id = number | string;

export type KnowledgeType = 'BASE' | 'LARK' | 'WEB' | 'WORKFLOW';

export interface KnowledgeRequest extends OrchestrationRequest {
  appId?: string;
  app_id?: string;
  appSecret?: string;
  app_secret?: string;
  clearFolder?: boolean;
  clear_folder?: boolean;
  embeddingModelId?: Id;
  embedding_model_id?: Id;
  fileCountLimit?: number;
  fileSizeLimit?: number;
  file_count_limit?: number;
  file_size_limit?: number;
  folderToken?: string;
  folder_token?: string;
  folderId?: Id;
  folder_id?: Id;
  idList?: Id[];
  id_list?: Id[];
  parentId?: Id;
  parent_id?: Id;
  rerankModelId?: Id;
  rerank_model_id?: Id;
  searchConfigJson?: string;
  search_config_json?: string;
  selector?: string;
  sourceUrl?: string;
  source_url?: string;
  targetFolderId?: Id;
  type?: KnowledgeType | string;
  workFlow?: Record<string, unknown> | string;
  work_flow?: Record<string, unknown> | string;
  workFlowTemplate?: Record<string, unknown>;
  work_flow_template?: Record<string, unknown>;
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

export function createKnowledge(data: KnowledgeRequest) {
  return requestClient.post(base, withKnowledgePayload(data));
}

export function createLarkKnowledge(data: KnowledgeRequest) {
  return requestClient.post(`${base}/lark`, withKnowledgePayload(data));
}

export function updateKnowledge(id: number | string, data: KnowledgeRequest) {
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

export function exportZipKnowledge(id: number | string) {
  return requestClient.get(`${base}/${id}/export-zip`, {
    responseType: 'blob',
  });
}

export function exportKnowledgeBundle(id: number | string) {
  return requestClient.get(`${base}/${id}/export-knowledge`, {
    responseType: 'blob',
  });
}

export function syncKnowledge(id: number | string, method: string) {
  return requestClient.put(`${base}/${id}/sync`, { method });
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
  data: DocumentRequest,
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
  data: KnowledgeRequest,
) {
  return requestClient.put(`${base}/${knowledgeId}/workflow/draft`, data);
}

export function publishKnowledgeWorkflow(knowledgeId: number | string) {
  return requestClient.post(`${base}/${knowledgeId}/workflow/publish`);
}

export function exportKnowledgeWorkflow(knowledgeId: number | string) {
  return requestClient.get(`${base}/${knowledgeId}/workflow/export`);
}

export function importKnowledgeWorkflow(
  knowledgeId: number | string,
  data: FormData,
) {
  return requestClient.post(`${base}/${knowledgeId}/workflow/import`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function debugKnowledgeWorkflow(
  knowledgeId: number | string,
  data: KnowledgeRequest,
) {
  return requestClient.post(`${base}/${knowledgeId}/workflow/debug`, data);
}

export function uploadKnowledgeWorkflowDocument(
  knowledgeId: number | string,
  data: KnowledgeRequest,
) {
  return requestClient.post(
    `${base}/${knowledgeId}/workflow/upload-document`,
    data,
  );
}

export function getKnowledgeWorkflowFormList(
  knowledgeId: number | string,
  type: 'local' | 'tool',
  id: string,
  data: Record<string, unknown> = {},
) {
  return requestClient.post(
    `${base}/${knowledgeId}/workflow/datasource/${type}/${id}/form_list`,
    data,
  );
}

export function workflowUploadDocument(
  knowledgeId: number | string,
  data: Record<string, unknown>,
) {
  return requestClient.post(
    `${base}/${knowledgeId}/workflow/upload_document`,
    data,
  );
}

export function pageKnowledgeWorkflowActions(
  knowledgeId: number | string,
  query?: AiQuery,
) {
  return requestClient.get(`${base}/${knowledgeId}/workflow/actions/page`, {
    params: query,
  });
}

export function getKnowledgeWorkflowAction(
  knowledgeId: number | string,
  actionId: number | string,
) {
  return requestClient.get(
    `${base}/${knowledgeId}/workflow/actions/${actionId}`,
  );
}

// ---------------------------------------------------------------------------
// Document functions
// ---------------------------------------------------------------------------

export function getDocument(
  knowledgeId: number | string,
  documentId: number | string,
) {
  return requestClient.get(`${base}/${knowledgeId}/documents/${documentId}`);
}

export function createWebDocument(
  knowledgeId: number | string,
  data: {
    content?: string;
    name?: string;
    selector?: string;
    source_url?: string;
    sourceUrl?: string;
  },
) {
  return requestClient.post(`${base}/${knowledgeId}/documents/web`, data);
}

export function downloadSourceFile(
  knowledgeId: number | string,
  documentId: number | string,
) {
  return requestClient.get(
    `${base}/${knowledgeId}/documents/${documentId}/download-source-file`,
    { responseType: 'blob' },
  );
}

export function replaceSourceFile(
  knowledgeId: number | string,
  documentId: number | string,
  file: File,
) {
  const formData = new FormData();
  formData.append('file', file);
  return requestClient.post(
    `${base}/${knowledgeId}/documents/${documentId}/replace-source-file`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
}

export function cancelDocumentTask(
  knowledgeId: number | string,
  documentId: number | string,
) {
  return requestClient.put(
    `${base}/${knowledgeId}/documents/${documentId}/cancel-task`,
  );
}

export function batchCancelDocumentTask(
  knowledgeId: number | string,
  ids: Id[],
) {
  return requestClient.put(
    `${base}/${knowledgeId}/documents/batch-cancel-task`,
    {
      idList: ids,
      id_list: ids,
    },
  );
}

export function batchHitHandling(
  knowledgeId: number | string,
  ids: Id[],
  hitHandlingMethod: string,
) {
  return requestClient.put(
    `${base}/${knowledgeId}/documents/batch-hit-handling`,
    {
      hitHandlingMethod,
      hit_handling_method: hitHandlingMethod,
      idList: ids,
      id_list: ids,
    },
  );
}

export function tokenizeDocument(
  knowledgeId: number | string,
  documentId: number | string,
) {
  return requestClient.put(
    `${base}/${knowledgeId}/documents/${documentId}/tokenize`,
  );
}

export function batchTokenizeDocuments(
  knowledgeId: number | string,
  ids: Id[],
) {
  return requestClient.put(`${base}/${knowledgeId}/documents/batch-tokenize`, {
    idList: ids,
    id_list: ids,
  });
}

export function syncWebDocument(
  knowledgeId: number | string,
  documentId: number | string,
) {
  return requestClient.put(
    `${base}/${knowledgeId}/documents/${documentId}/sync`,
  );
}

export function batchGenerateRelatedDocuments(
  knowledgeId: number | string,
  ids: Id[],
) {
  return requestClient.post(
    `${base}/${knowledgeId}/documents/batch-generate-related`,
    {
      idList: ids,
      id_list: ids,
    },
  );
}

// ---------------------------------------------------------------------------
// Paragraph functions
// ---------------------------------------------------------------------------

export function listParagraphProblems(
  knowledgeId: number | string,
  documentId: number | string,
  paragraphId: number | string,
) {
  return requestClient.get(
    `${base}/${knowledgeId}/documents/${documentId}/paragraphs/${paragraphId}/problems`,
  );
}

export function createParagraphProblem(
  knowledgeId: number | string,
  documentId: number | string,
  paragraphId: number | string,
  data: OrchestrationRequest,
) {
  return requestClient.post(
    `${base}/${knowledgeId}/documents/${documentId}/paragraphs/${paragraphId}/problems`,
    data,
  );
}

export function associateProblemToParagraph(
  knowledgeId: number | string,
  documentId: number | string,
  paragraphId: number | string,
  problemId: number | string,
) {
  return requestClient.put(
    `${base}/${knowledgeId}/documents/${documentId}/paragraphs/association`,
    null,
    {
      params: {
        paragraphId,
        paragraph_id: paragraphId,
        problemId,
        problem_id: problemId,
      },
    },
  );
}

export function unassociateProblemFromParagraph(
  knowledgeId: number | string,
  documentId: number | string,
  paragraphId: number | string,
  problemId: number | string,
) {
  return requestClient.put(
    `${base}/${knowledgeId}/documents/${documentId}/paragraphs/unassociation`,
    null,
    {
      params: {
        paragraphId,
        paragraph_id: paragraphId,
        problemId,
        problem_id: problemId,
      },
    },
  );
}

export function adjustParagraphPosition(
  knowledgeId: number | string,
  documentId: number | string,
  paragraphId: number | string,
  position: number | string,
) {
  return requestClient.put(
    `${base}/${knowledgeId}/documents/${documentId}/paragraphs/adjust-position`,
    null,
    { params: { paragraphId, paragraph_id: paragraphId, position } },
  );
}

// ---------------------------------------------------------------------------
// Problem functions
// ---------------------------------------------------------------------------

export function batchDeleteProblems(knowledgeId: number | string, ids: Id[]) {
  return requestClient.delete(`${base}/${knowledgeId}/problems/batch-delete`, {
    data: { idList: ids, id_list: ids },
  });
}

export function batchAssociateProblems(
  knowledgeId: number | string,
  problemIds: Id[],
  paragraphIds: Id[],
) {
  return requestClient.post(
    `${base}/${knowledgeId}/problems/batch-association`,
    {
      idList: problemIds,
      id_list: problemIds,
      paragraphIdList: paragraphIds,
      paragraph_id_list: paragraphIds,
    },
  );
}

export function getProblemParagraphs(
  knowledgeId: number | string,
  problemId: number | string,
) {
  return requestClient.get(
    `${base}/${knowledgeId}/problems/${problemId}/paragraphs`,
  );
}

// ---------------------------------------------------------------------------
// Tag functions
// ---------------------------------------------------------------------------

export function batchDeleteTags(knowledgeId: number | string, ids: Id[]) {
  return requestClient.delete(`${base}/${knowledgeId}/tags/batch-delete`, {
    data: { idList: ids, id_list: ids },
  });
}

export function batchAddDocumentTag(
  knowledgeId: number | string,
  documentIds: Id[],
  tagId: number | string,
) {
  return requestClient.post(`${base}/${knowledgeId}/documents/batch-add-tag`, {
    idList: documentIds,
    id_list: documentIds,
    tagId,
  });
}

export function batchDeleteDocumentTags(
  knowledgeId: number | string,
  documentId: number | string,
  tagIds: Id[],
) {
  return requestClient.delete(
    `${base}/${knowledgeId}/documents/${documentId}/tags/batch-delete`,
    { data: { idList: tagIds, id_list: tagIds } },
  );
}

export function deleteTagFromDocs(
  knowledgeId: number | string,
  tagId: number | string,
) {
  return requestClient.delete(`${base}/${knowledgeId}/tags/${tagId}/docs`);
}

// ---------------------------------------------------------------------------
// Workflow functions
// ---------------------------------------------------------------------------

export function transformKnowledgeToWorkflow(knowledgeId: number | string) {
  return requestClient.post(`${base}/${knowledgeId}/transform-workflow`);
}

export function cancelWorkflowAction(
  knowledgeId: number | string,
  actionId: number | string,
) {
  return requestClient.post(
    `${base}/${knowledgeId}/workflow/actions/${actionId}/cancel`,
  );
}

export function generateRelatedKnowledge(knowledgeId: number | string) {
  return requestClient.post(`${base}/${knowledgeId}/generate-related`);
}

export function generateRelatedKnowledgeAsync(knowledgeId: number | string) {
  return requestClient.post(`${base}/${knowledgeId}/generate-related-async`);
}
