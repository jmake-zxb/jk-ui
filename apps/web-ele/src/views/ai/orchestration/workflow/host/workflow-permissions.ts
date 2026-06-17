/**
 * 工作流编辑器工具栏权限门控（纯逻辑，可独立单测）。
 *
 * 对齐 jk 后端 @HasPermission 注解（ApplicationWorkflowController）：
 * - 保存草稿 / 发布 / 添加组件 / 恢复版本 → ai_application_edit
 * - 调试 → ai_application_debug
 * - 校验 / 查看版本 → ai_application_view
 *
 * 注：MaxKB 的 apiType（workspace/systemManage）依赖其特有的双路由架构
 * （resource-management 路径），jk 无对应路由模型，故不移植 apiType 概念，
 * 改用 jk 现有 useAccess/权限码门控达成等价的操作级权限控制。
 */

const CODE_EDIT = 'ai_application_edit';
const CODE_DEBUG = 'ai_application_debug';
const CODE_VIEW = 'ai_application_view';
const WILDCARD = '*';

/** 工具栏各操作的可用性。 */
export interface WorkflowToolbarPermissions {
  /** 添加组件（编辑图）。 */
  canAddComponent: boolean;
  /** 调试当前草稿。 */
  canDebug: boolean;
  /** 发布工作流。 */
  canPublish: boolean;
  /** 恢复历史版本。 */
  canRestoreVersion: boolean;
  /** 保存草稿。 */
  canSave: boolean;
  /** 校验工作流。 */
  canValidate: boolean;
  /** 查看版本/历史。 */
  canViewVersions: boolean;
}

/**
 * 根据用户权限码集合计算工具栏操作可用性。
 *
 * @param codes 当前用户的权限码集合（来自 useAccess/accessStore）。
 *   `*` 视为超级权限，全部放开；undefined/null 视为无权限，全部拒绝。
 */
export function computeWorkflowToolbarPermissions(
  codes: null | string[] | undefined,
): WorkflowToolbarPermissions {
  const codeSet = new Set(Array.isArray(codes) ? codes : []);
  const has = (code: string) => codeSet.has(WILDCARD) || codeSet.has(code);

  const canEdit = has(CODE_EDIT);
  const canDebug = has(CODE_DEBUG);
  const canView = has(CODE_VIEW);

  return {
    canAddComponent: canEdit,
    canDebug,
    canPublish: canEdit,
    canRestoreVersion: canEdit,
    canSave: canEdit,
    canValidate: canView,
    canViewVersions: canView,
  };
}
