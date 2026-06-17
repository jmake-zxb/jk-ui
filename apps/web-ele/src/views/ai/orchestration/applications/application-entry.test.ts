import { describe, expect, it } from 'vitest';

import {
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
      path: '/ai/orchestration/applications/101/workflow',
      query: {},
    });
  });

  it('routes agent applications to the MaxKB-style detail overview', () => {
    for (const type of ['CHAT', 'SIMPLE']) {
      expect(isWorkflowApplication(type)).toBe(false);
      expect(applicationPrimaryEntry({ id: 'app-1', type })).toMatchObject({
        kind: 'detail',
        label: '概览',
        path: '/ai/orchestration/applications/detail/index',
        query: { applicationId: 'app-1', tab: 'overview' },
      });
    }
  });

  it('builds explicit detail entries for application actions', () => {
    expect(applicationDetailEntry({ id: 102 }, 'setting')).toMatchObject({
      kind: 'detail',
      label: '设置',
      path: '/ai/orchestration/applications/detail/index',
      query: { applicationId: 102, tab: 'setting' },
    });
  });
});
