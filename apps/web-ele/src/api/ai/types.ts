export interface AiPage<T = AiRecord> {
  records?: T[];
  total?: number;
  size?: number;
  current?: number;
  pages?: number;
  items?: T[];
}

export interface AiRecord {
  id?: number | string;
  name?: string;
  title?: string;
  code?: string;
  type?: string;
  description?: string;
  content?: string;
  enabled?: boolean;
  status?: string;
  createTime?: string;
  updateTime?: string;
  [key: string]: any;
}

export interface AiQuery {
  current?: number;
  page?: number;
  size?: number;
  [key: string]: any;
}

export interface OrchestrationRequest {
  id?: number | string;
  applicationId?: number | string;
  knowledgeId?: number | string;
  documentId?: number | string;
  tagId?: number | string;
  targetFolderId?: number | string;
  name?: string;
  title?: string;
  code?: string;
  token?: string;
  secret?: string;
  description?: string;
  content?: string;
  source?: string;
  sourceType?: string;
  sourceUrl?: string;
  type?: string;
  toolType?: string;
  triggerType?: string;
  enabled?: boolean;
  configJson?: string;
  inputJson?: string;
  graphData?: string;
  metaJson?: string;
  splitConfig?: string;
  message?: string;
  query?: string;
  queryText?: string;
  query_text?: string;
  searchMode?: string;
  search_mode?: string;
  similarity?: number;
  topK?: number;
  top_number?: number;
  similarityThreshold?: number;
  knowledgeIds?: Array<number | string>;
  documentIds?: Array<number | string>;
}

export interface ApplicationPayload {
  name?: string;
  description?: string;
  icon?: string;
  type?: string;
  tenantId?: number | string;
  workspaceId?: string;
  folderId?: number | string;
  accessEnabled?: boolean;
  showSource?: boolean;
  showHistory?: boolean;
  showGuide?: boolean;
}

export interface WorkflowDraftPayload {
  graphData: string;
  applicationConfig?: string;
}

export interface WorkflowDebugPayload {
  message?: string;
  inputJson?: string;
  modelId?: number | string;
  chatId?: number | string;
  formDataJson?: string;
}

export interface PublicChatPayload extends OrchestrationRequest {
  token?: string;
}
