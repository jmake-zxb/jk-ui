import { describe, expect, it } from 'vitest';

import {
  applicationChatEntry,
  applicationDetailEntry,
  applicationPrimaryEntry,
  isWorkflowApplication,
  normalizeApplicationType,
} from './application-entry';

describe('application primary entry', () => {
  it('routes workflow applications to the workflow canvas', () => {
    expect(isWorkflowApplication('WORK_FLOW')).toBe(true);
    expect(isWorkflowApplication('WORKFLOW')).toBe(true);
    expect(normalizeApplicationType()).toBe('WORK_FLOW');

    expect(
      applicationPrimaryEntry({ id: 101, type: 'WORK_FLOW' }),
    ).toMatchObject({
      kind: 'workflow',
      label: '工作流',
      path: '/ai/orchestration/workflow/index',
      query: { applicationId: 101 },
    });
  });

  it('routes agent applications to the MaxKB-style detail overview', () => {
    for (const type of ['CHAT', 'SIMPLE']) {
      expect(isWorkflowApplication(type)).toBe(false);
      expect(applicationPrimaryEntry({ id: 'app-1', type })).toMatchObject({
        kind: 'detail',
        label: '概览',
        path: '/ai/orchestration/applications/detail',
        query: { applicationId: 'app-1', tab: 'overview' },
      });
    }
  });

  it('builds explicit detail and chat entries for application actions', () => {
    expect(applicationDetailEntry({ id: 102 }, 'setting')).toMatchObject({
      kind: 'detail',
      label: '设置',
      path: '/ai/orchestration/applications/detail',
      query: { applicationId: 102, tab: 'setting' },
    });

    expect(applicationChatEntry({ id: 102 })).toMatchObject({
      kind: 'chat',
      label: '对话调试',
      path: '/ai/orchestration/public-chat/index',
      query: { applicationId: 102, mode: 'debug' },
    });
  });
});
