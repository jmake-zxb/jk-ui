import { describe, expect, it } from 'vitest';

import {
  buildSimpleApplicationGraph,
  createDefaultSimpleApplicationSettings,
  parseSimpleApplicationSettings,
  simpleApplicationSettingSections,
} from './simple-application-settings';

describe('simple application settings', () => {
  it('exposes MaxKB simple-agent setting sections only for simple applications', () => {
    expect(
      simpleApplicationSettingSections('SIMPLE').map((item) => item.id),
    ).toEqual([
      'basic',
      'model',
      'knowledge',
      'skills',
      'conversation',
      'voice',
    ]);
    expect(
      simpleApplicationSettingSections('WORK_FLOW').map((item) => item.id),
    ).toEqual(['basic']);
  });

  it('builds a runnable MaxKB-style simple-agent graph from settings', () => {
    const settings = createDefaultSimpleApplicationSettings({
      description: '回答售后问题',
      id: 'app-1',
      name: '售后助手',
      type: 'SIMPLE',
    });
    settings.model_id = '1001';
    settings.model_setting.system = '你是售后助手';
    settings.model_setting.prompt = '结合知识库回答：{question}';
    settings.model_setting.no_references_prompt = '直接回答：{question}';
    settings.knowledge_id_list = ['kb-1'];
    settings.knowledge_setting.top_n = 5;
    settings.prologue = '您好，请描述售后问题';
    settings.tool_ids = ['tool-1'];

    const graph = buildSimpleApplicationGraph(settings);

    expect(graph.nodes.map((node) => node.id)).toEqual([
      'base-node',
      'start-node',
      'simple-search-knowledge-node',
      'simple-ai-chat-node',
    ]);
    expect(graph.edges.map((edge) => `${edge.source}->${edge.target}`)).toEqual(
      [
        'start-node->simple-search-knowledge-node',
        'simple-search-knowledge-node->simple-ai-chat-node',
      ],
    );
    expect(graph.nodes[0]?.properties?.node_data).toMatchObject({
      desc: '回答售后问题',
      name: '售后助手',
      prologue: '您好，请描述售后问题',
    });
    expect(graph.nodes[2]?.properties?.node_data).toMatchObject({
      knowledge_id_list: ['kb-1'],
      knowledge_setting: expect.objectContaining({ top_n: 5 }),
      question_reference_address: ['start-node', 'question'],
    });
    expect(graph.nodes[3]?.properties?.node_data).toMatchObject({
      model_id: '1001',
      prompt: '结合知识库回答：{{start-node.question}}',
      system: '你是售后助手',
      tool_ids: ['tool-1'],
    });
  });

  it('round-trips settings from a saved simple-agent graph', () => {
    const settings = createDefaultSimpleApplicationSettings({
      description: '初始描述',
      name: '初始名称',
      type: 'SIMPLE',
    });
    settings.model_id = '1001';
    settings.knowledge_id_list = ['kb-1'];
    settings.model_setting.reasoning_content_enable = true;

    const parsed = parseSimpleApplicationSettings(
      JSON.stringify(buildSimpleApplicationGraph(settings)),
      { description: '列表描述', name: '列表名称', type: 'SIMPLE' },
    );

    expect(parsed.name).toBe('初始名称');
    expect(parsed.desc).toBe('初始描述');
    expect(parsed.model_id).toBe('1001');
    expect(parsed.knowledge_id_list).toEqual(['kb-1']);
    expect(parsed.model_setting.reasoning_content_enable).toBe(true);
  });
});
