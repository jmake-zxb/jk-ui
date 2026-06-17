import { describe, expect, it } from 'vitest';

import { computeWorkflowToolbarPermissions } from './workflow-permissions';

/**
 * 工作流编辑器工具栏权限门控测试。
 *
 * 对齐 jk 后端 @HasPermission 注解(ApplicationWorkflowController):
 * - 保存草稿 / 发布 / 添加组件 / 恢复版本 → ai_application_edit
 * - 调试 → ai_application_debug
 * - 校验 / 查看版本 → ai_application_view
 *
 * 注:MaxKB 的 apiType(workspace/systemManage)依赖其特有双路由架构,
 * jk 无对应路由模型,故采用 jk 现有 useAccess/权限码门控替代。
 */

describe('computeWorkflowToolbarPermissions', () => {
  it('grants all operations when the user has every code', () => {
    const perms = computeWorkflowToolbarPermissions([
      'ai_application_view',
      'ai_application_edit',
      'ai_application_debug',
    ]);

    expect(perms).toEqual({
      canAddComponent: true,
      canDebug: true,
      canPublish: true,
      canRestoreVersion: true,
      canSave: true,
      canValidate: true,
      canViewVersions: true,
    });
  });

  it('gates edit operations behind ai_application_edit', () => {
    const perms = computeWorkflowToolbarPermissions([
      'ai_application_view',
      'ai_application_debug',
    ]);

    expect(perms.canSave).toBe(false);
    expect(perms.canPublish).toBe(false);
    expect(perms.canAddComponent).toBe(false);
    expect(perms.canRestoreVersion).toBe(false);
    // view/debug 仍可用
    expect(perms.canDebug).toBe(true);
    expect(perms.canValidate).toBe(true);
    expect(perms.canViewVersions).toBe(true);
  });

  it('gates debug behind ai_application_debug', () => {
    const perms = computeWorkflowToolbarPermissions([
      'ai_application_view',
      'ai_application_edit',
    ]);

    expect(perms.canDebug).toBe(false);
    expect(perms.canSave).toBe(true);
  });

  it('gates validate and version viewing behind ai_application_view', () => {
    const perms = computeWorkflowToolbarPermissions([
      'ai_application_edit',
      'ai_application_debug',
    ]);

    expect(perms.canValidate).toBe(false);
    expect(perms.canViewVersions).toBe(false);
    // edit/debug 仍可用
    expect(perms.canSave).toBe(true);
    expect(perms.canDebug).toBe(true);
  });

  it('denies everything for an empty permission set', () => {
    const perms = computeWorkflowToolbarPermissions([]);

    expect(perms).toEqual({
      canAddComponent: false,
      canDebug: false,
      canPublish: false,
      canRestoreVersion: false,
      canSave: false,
      canValidate: false,
      canViewVersions: false,
    });
  });

  it('treats a wildcard/super code as full access', () => {
    const perms = computeWorkflowToolbarPermissions(['*']);

    expect(perms.canSave).toBe(true);
    expect(perms.canPublish).toBe(true);
    expect(perms.canDebug).toBe(true);
    expect(perms.canValidate).toBe(true);
  });

  it('is tolerant of undefined/null input (denies all)', () => {
    expect(computeWorkflowToolbarPermissions(undefined as any).canSave).toBe(
      false,
    );
    expect(computeWorkflowToolbarPermissions(null as any).canDebug).toBe(false);
  });
});
