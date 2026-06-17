import { describe, expect, it } from 'vitest';

import { validateWorkflow } from './validation';

/**
 * 发布前结构校验测试。
 *
 * 对齐 MaxKB WorkFlowInstance.is_valid()(ui/src/workflow/common/validate.ts):
 * - base 节点缺失 → error(jk 旧行为：不报错）。
 * - base 节点重复 → error(jk 旧行为：仅 warning）。
 * - 节点 properties.status 不可用(500 / 非 200)→ error
 *   (MaxKB is_valid_node:207-229）。
 */

function startNode(extra: Record<string, any> = {}) {
  return {
    id: 'start-node',
    type: 'start-node',
    properties: { stepName: '开始', ...extra },
  };
}

function baseNode(id = 'base-node', extra: Record<string, any> = {}) {
  return {
    id,
    type: 'base-node',
    properties: { stepName: '基础配置', ...extra },
  };
}

function replyNode(extra: Record<string, any> = {}) {
  return {
    id: 'reply-node',
    type: 'reply-node',
    properties: {
      stepName: '回复',
      node_data: { content: '你好', reply_type: 'content' },
      ...extra,
    },
  };
}

function edge(source: string, target: string) {
  return { id: `${source}->${target}`, source, target };
}

describe('validateWorkflow base-node presence (MaxKB parity)', () => {
  it('reports an error when the base node is missing', () => {
    const result = validateWorkflow({
      nodes: [startNode(), replyNode()],
      edges: [edge('start-node', 'reply-node')],
    } as any);

    expect(result.errors.some((e) => e.includes('base-node'))).toBe(true);
  });

  it('reports an error when there are multiple base nodes', () => {
    const result = validateWorkflow({
      nodes: [
        startNode(),
        baseNode('base-node'),
        baseNode('base-node-2'),
        replyNode(),
      ],
      edges: [edge('start-node', 'reply-node')],
    } as any);

    expect(result.errors.some((e) => e.includes('base-node'))).toBe(true);
  });

  it('passes base-node presence when exactly one exists', () => {
    const result = validateWorkflow({
      nodes: [startNode(), baseNode(), replyNode()],
      edges: [edge('start-node', 'reply-node')],
    } as any);

    expect(result.errors.some((e) => e.includes('base-node'))).toBe(false);
  });
});

describe('validateWorkflow node availability status (MaxKB parity)', () => {
  it('reports an error when a node status is 500 (unavailable)', () => {
    const result = validateWorkflow({
      nodes: [startNode(), baseNode(), replyNode({ status: 500 })],
      edges: [edge('start-node', 'reply-node')],
    } as any);

    expect(
      result.errors.some((e) => e.includes('回复') && e.includes('不可用')),
    ).toBe(true);
  });

  it('reports an error when a node status is a non-200 value', () => {
    const result = validateWorkflow({
      nodes: [startNode(), baseNode(), replyNode({ status: 400 })],
      edges: [edge('start-node', 'reply-node')],
    } as any);

    expect(
      result.errors.some((e) => e.includes('回复') && e.includes('不可用')),
    ).toBe(true);
  });

  it('passes when node status is 200 (available)', () => {
    const result = validateWorkflow({
      nodes: [startNode(), baseNode(), replyNode({ status: 200 })],
      edges: [edge('start-node', 'reply-node')],
    } as any);

    expect(result.errors.some((e) => e.includes('不可用'))).toBe(false);
  });

  it('passes when node has no status field (status check is opt-in)', () => {
    const result = validateWorkflow({
      nodes: [startNode(), baseNode(), replyNode()],
      edges: [edge('start-node', 'reply-node')],
    } as any);

    expect(result.errors.some((e) => e.includes('不可用'))).toBe(false);
  });
});
