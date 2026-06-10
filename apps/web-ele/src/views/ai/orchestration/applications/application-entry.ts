export const WORKFLOW_EDITOR_PATH = '/ai/orchestration/workflow/agent/index';
export const APPLICATION_CHAT_PATH = '/ai/orchestration/public-chat/index';
export const APPLICATION_DETAIL_PATH =
  '/ai/orchestration/applications/detail/index';

export type ApplicationDetailTab = 'chat-log' | 'overview' | 'setting';
export type ApplicationEntryKind = 'chat' | 'detail' | 'workflow';

export interface ApplicationLike {
  id?: number | string;
  type?: string;
}

export interface ApplicationPrimaryEntry {
  kind: ApplicationEntryKind;
  label: string;
  path: string;
  query: Record<string, number | string>;
}

export function normalizeApplicationType(type?: string) {
  const value = `${type || 'WORK_FLOW'}`.toUpperCase();
  return value === 'WORKFLOW' ? 'WORK_FLOW' : value;
}

export function isWorkflowApplication(type?: string) {
  return normalizeApplicationType(type) === 'WORK_FLOW';
}

export function applicationDetailEntry(
  application: ApplicationLike,
  tab: ApplicationDetailTab = 'overview',
): ApplicationPrimaryEntry {
  const labelMap: Record<ApplicationDetailTab, string> = {
    'chat-log': '对话日志',
    overview: '概览',
    setting: '设置',
  };
  const query: Record<string, number | string> = { tab };
  if (application.id !== undefined && application.id !== null) {
    query.applicationId = application.id;
  }
  return {
    kind: 'detail',
    label: labelMap[tab],
    path: APPLICATION_DETAIL_PATH,
    query,
  };
}

export function applicationChatEntry(
  application: ApplicationLike,
): ApplicationPrimaryEntry {
  const query: Record<string, number | string> = { mode: 'debug' };
  if (application.id !== undefined && application.id !== null) {
    query.applicationId = application.id;
  }
  return {
    kind: 'chat',
    label: '对话调试',
    path: APPLICATION_CHAT_PATH,
    query,
  };
}

export function applicationPrimaryEntry(
  application: ApplicationLike,
): ApplicationPrimaryEntry {
  const workflow = isWorkflowApplication(application.type);
  if (!workflow) return applicationDetailEntry(application, 'overview');
  const query: Record<string, number | string> = {};
  if (application.id !== undefined && application.id !== null) {
    query.applicationId = application.id;
  }
  return {
    kind: 'workflow',
    label: '工作流',
    path: WORKFLOW_EDITOR_PATH,
    query,
  };
}
