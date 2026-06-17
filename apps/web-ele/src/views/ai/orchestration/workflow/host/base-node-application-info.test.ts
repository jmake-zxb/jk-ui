import { describe, expect, it } from 'vitest';

import {
  legacyMaxKbDefaultPrologue,
  normalizeBaseNodeApplicationInfo,
} from './base-node-application-info';

function graph(nodeData: Record<string, unknown>) {
  return {
    edges: [],
    nodes: [
      {
        id: 'base-node',
        properties: { node_data: { ...nodeData } },
        type: 'base-node',
      },
    ],
  };
}

function baseNodeData(source: ReturnType<typeof graph>) {
  return source.nodes[0]?.properties.node_data;
}

describe('normalizeBaseNodeApplicationInfo', () => {
  it('fills blank base-node name and description from application config', () => {
    const source = graph({ desc: '', name: '' });

    normalizeBaseNodeApplicationInfo(source, {
      description: '手动保存',
      name: '高级智能体2',
    });

    expect(baseNodeData(source)).toMatchObject({
      desc: '手动保存',
      name: '高级智能体2',
    });
  });

  it('replaces legacy placeholder name description and prologue', () => {
    const source = graph({
      desc: '模板',
      name: '知识库问答助手',
      prologue: legacyMaxKbDefaultPrologue,
    });

    normalizeBaseNodeApplicationInfo(source, {
      description: '应用描述',
      name: '高级智能体2',
    });

    expect(baseNodeData(source)).toMatchObject({
      desc: '应用描述',
      name: '高级智能体2',
      prologue:
        '您好，我是高级智能体2小助手，您可以向我提出高级智能体2使用问题。\n- 高级智能体2主要功能有什么？\n- 高级智能体2如何收费？\n- 需要转人工服务',
    });
  });

  it('preserves custom base-node name description and prologue', () => {
    const source = graph({
      desc: '自定义描述',
      name: '自定义名称',
      prologue: '自定义开场白',
    });

    normalizeBaseNodeApplicationInfo(source, {
      description: '应用描述',
      name: '应用名称',
    });

    expect(baseNodeData(source)).toMatchObject({
      desc: '自定义描述',
      name: '自定义名称',
      prologue: '自定义开场白',
    });
  });

  it('replaces the legacy MaxKB XXX prologue template with application text', () => {
    const source = graph({ prologue: legacyMaxKbDefaultPrologue });

    normalizeBaseNodeApplicationInfo(source, { name: '高级智能体2' });

    expect(baseNodeData(source)?.prologue).toBe(
      '您好，我是高级智能体2小助手，您可以向我提出高级智能体2使用问题。\n- 高级智能体2主要功能有什么？\n- 高级智能体2如何收费？\n- 需要转人工服务',
    );
  });

  it('replaces the current frontend default prologue with application text', () => {
    const source = graph({
      prologue: '您好，我是您的 AI 助手，请问有什么可以帮您？',
    });

    normalizeBaseNodeApplicationInfo(source, { name: '高级智能体2' });

    expect(baseNodeData(source)?.prologue).toBe(
      '您好，我是高级智能体2小助手，您可以向我提出高级智能体2使用问题。\n- 高级智能体2主要功能有什么？\n- 高级智能体2如何收费？\n- 需要转人工服务',
    );
  });

  it('preserves intentionally empty prologue', () => {
    const source = graph({ prologue: '' });

    normalizeBaseNodeApplicationInfo(source, { name: '高级智能体2' });

    expect(baseNodeData(source)?.prologue).toBe('');
  });
});
