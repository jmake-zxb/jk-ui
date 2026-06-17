/**
 * 发布前逐节点校验（纯逻辑，可独立单测）。
 *
 * 对齐 MaxKB 发布链路对每个节点实例调用 node.validate?.():
 * - jk node index.vue 通过 set(nodeModel, 'validate', fn) 挂载校验函数,
 *   返回 Promise,reject 携带中文错误消息(或同步抛错)。
 * - 逐节点 await,收集 reject/throw 节点,聚合为「节点名: 原因」错误列表。
 * - label 优先级:stepName → name → id。
 * - 无 validate 的节点视为通过。
 */

/** 可校验的节点模型(仅取校验所需字段)。 */
export interface ValidatableNodeModel {
  id: string;
  properties?: {
    [key: string]: any;
    name?: string;
    stepName?: string;
  };
  type?: string;
  /** 节点自挂的校验函数,返回 Promise 或同步抛错。 */
  validate?: () => Promise<unknown> | unknown;
}

/** 取节点展示名:stepName → name → id。 */
function nodeLabel(node: ValidatableNodeModel): string {
  const stepName = `${node.properties?.stepName ?? ''}`.trim();
  if (stepName) return stepName;
  const name = `${node.properties?.name ?? ''}`.trim();
  if (name) return name;
  return node.id;
}

/** 从 reject/throw 的原因提取可读消息。 */
function reasonText(reason: unknown): string {
  if (typeof reason === 'string') return reason;
  if (reason instanceof Error) return reason.message;
  if (
    reason !== null &&
    typeof reason === 'object' &&
    'message' in reason &&
    typeof (reason as { message: unknown }).message === 'string'
  ) {
    return (reason as { message: string }).message;
  }
  return `${reason}`;
}

/**
 * 逐节点执行 validate(),收集失败节点的「节点名: 原因」列表。
 * 无 validate 或 resolve 的节点视为通过。
 */
export async function collectNodeValidationErrors(
  nodes: ValidatableNodeModel[],
): Promise<string[]> {
  const errors: string[] = [];
  for (const node of nodes) {
    if (typeof node.validate !== 'function') continue;
    try {
      await node.validate();
    } catch (error) {
      errors.push(`${nodeLabel(node)}: ${reasonText(error)}`);
    }
  }
  return errors;
}
