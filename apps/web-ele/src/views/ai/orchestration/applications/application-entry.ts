export const APPLICATION_DETAIL_PATH = '/ai/orchestration/applications/detail';

export type ApplicationDetailTab =
  | 'access'
  | 'chat-log'
  | 'chat-user'
  | 'overview'
  | 'setting';
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
    access: '访问设置',
    'chat-log': '对话日志',
    'chat-user': '对话用户',
    overview: '概览',
    setting: '设置',
  };
  const id = application.id ?? '';
  return {
    kind: 'detail',
    label: labelMap[tab],
    path: `${APPLICATION_DETAIL_PATH}/${id}/${tab}`,
    query: {},
  };
}

export function applicationPrimaryEntry(
  application: ApplicationLike,
): ApplicationPrimaryEntry {
  const workflow = isWorkflowApplication(application.type);
  if (!workflow) return applicationDetailEntry(application, 'overview');
  return {
    kind: 'workflow',
    label: '工作流',
    path: `/ai/orchestration/applications/${application.id}/workflow`,
    query: {},
  };
}
