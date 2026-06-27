/**
 * 判断应用类型是否为工作流
 */
export function isWorkFlow(type: string | undefined) {
  return type?.toUpperCase() === 'WORK_FLOW';
}
