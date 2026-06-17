import type { ValidatableNodeModel } from './node-validation';

import { describe, expect, it } from 'vitest';

import { collectNodeValidationErrors } from './node-validation';

/**
 * 发布前逐节点校验测试。
 *
 * 对齐 MaxKB 发布链路对每个节点实例调用 node.validate?.():
 * - jk node index.vue 通过 set(nodeModel, 'validate', fn) 挂载校验函数,
 *   返回 Promise,reject 携带中文错误消息。
 * - 收集所有 reject 节点,按「节点名: 原因」聚合为错误列表。
 * - 无 validate 的节点视为通过。
 * - resolve 的节点视为通过。
 */

function node(
  partial: Partial<ValidatableNodeModel> & { id: string },
): ValidatableNodeModel {
  return {
    type: 'ai-chat-node',
    properties: { stepName: '节点' },
    ...partial,
  };
}

describe('collectNodeValidationErrors', () => {
  it('returns empty when all nodes validate successfully', async () => {
    const errors = await collectNodeValidationErrors([
      node({ id: 'a', validate: () => Promise.resolve() }),
      node({ id: 'b', validate: () => Promise.resolve() }),
    ]);

    expect(errors).toEqual([]);
  });

  it('collects rejection messages prefixed by node step name', async () => {
    const errors = await collectNodeValidationErrors([
      node({
        id: 'a',
        properties: { stepName: 'AI 对话' },
        validate: () => Promise.reject(new Error('请选择模型')),
      }),
    ]);

    expect(errors).toEqual(['AI 对话: 请选择模型']);
  });

  it('treats nodes without a validate function as valid', async () => {
    const errors = await collectNodeValidationErrors([
      node({ id: 'a', validate: undefined }),
    ]);

    expect(errors).toEqual([]);
  });

  it('aggregates multiple failing nodes and keeps passing ones out', async () => {
    const errors = await collectNodeValidationErrors([
      node({
        id: 'a',
        properties: { stepName: 'AI 对话' },
        validate: () => Promise.reject(new Error('请选择模型')),
      }),
      node({ id: 'b', validate: () => Promise.resolve() }),
      node({
        id: 'c',
        properties: { stepName: '回复' },
        validate: () => Promise.reject(new Error('请输入回复内容')),
      }),
    ]);

    expect(errors).toEqual(['AI 对话: 请选择模型', '回复: 请输入回复内容']);
  });

  it('falls back to name then id when stepName is absent', async () => {
    const errors = await collectNodeValidationErrors([
      node({
        id: 'node-1',
        properties: { name: '语音转文字' },
        validate: () => Promise.reject(new Error('缺少模型')),
      }),
      node({
        id: 'node-2',
        properties: {},
        validate: () => Promise.reject(new Error('缺少配置')),
      }),
    ]);

    expect(errors).toEqual(['语音转文字: 缺少模型', 'node-2: 缺少配置']);
  });

  it('handles string rejection reasons and plain error objects', async () => {
    const stringReason: unknown = '原始字符串错误';
    const objectReason: unknown = { message: '对象消息' };
    const errors = await collectNodeValidationErrors([
      node({
        id: 'a',
        properties: { stepName: '节点A' },
        validate: () => Promise.reject(stringReason),
      }),
      node({
        id: 'b',
        properties: { stepName: '节点B' },
        validate: () => Promise.reject(objectReason),
      }),
    ]);

    expect(errors).toEqual(['节点A: 原始字符串错误', '节点B: 对象消息']);
  });

  it('awaits synchronous validate functions that throw', async () => {
    const errors = await collectNodeValidationErrors([
      node({
        id: 'a',
        properties: { stepName: '同步节点' },
        validate: () => {
          throw new Error('同步抛错');
        },
      }),
    ]);

    expect(errors).toEqual(['同步节点: 同步抛错']);
  });
});
