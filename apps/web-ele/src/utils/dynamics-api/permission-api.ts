// 简化版 permission-api
// TODO: 完整实现权限检查逻辑

export function hasPermission(_permission: string): boolean {
  // 临时返回 true，允许所有操作
  return true;
}

export function checkPermissions(_permissions: string[]): boolean {
  // 临时返回 true，允许所有操作
  return true;
}

export default {
  hasPermission,
  checkPermissions,
};
