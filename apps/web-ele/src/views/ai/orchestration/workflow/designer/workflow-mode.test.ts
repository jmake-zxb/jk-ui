import { describe, expect, it } from 'vitest';

import { normalizeGraphData } from './graph-data';
import {
  createDefaultKnowledgeWorkflowNodes,
  createDefaultToolWorkflowNodes,
  createDefaultWorkflowNodes,
  DEFAULT_GRAPH_DATA,
  DEFAULT_KNOWLEDGE_GRAPH_DATA,
  DEFAULT_TOOL_GRAPH_DATA,
  defaultProperties,
  groupedNodeTemplates,
} from './nodes';
import { validateWorkflow } from './validation';

describe('workflow designer tool mode', () => {
  it('uses tool foundation nodes for the default tool graph', () => {
    const graph = JSON.parse(DEFAULT_TOOL_GRAPH_DATA);
    const nodeTypes = graph.nodes.map((node: any) => node.type);

    expect(nodeTypes).toEqual(['tool-base-node', 'tool-start-node']);
    expect(nodeTypes).not.toContain('base-node');
    expect(nodeTypes).not.toContain('start-node');
  });

  it('normalizes empty or app-default graphs to tool foundation nodes in tool mode', () => {
    const emptyGraph = normalizeGraphData({}, true, true, 'tool');
    const appDefaultGraph = normalizeGraphData(
      JSON.parse(DEFAULT_GRAPH_DATA),
      true,
      true,
      'tool',
    );

    expect(emptyGraph.nodes.map((node) => node.type)).toEqual([
      'tool-base-node',
      'tool-start-node',
    ]);
    expect(appDefaultGraph.nodes.map((node) => node.type)).toEqual([
      'tool-base-node',
      'tool-start-node',
    ]);
  });

  it('keeps application foundation nodes unchanged in application mode', () => {
    const graph = normalizeGraphData({}, true, true, 'application');

    expect(graph.nodes.map((node) => node.type)).toEqual(
      createDefaultWorkflowNodes().map((node) => node.type),
    );
  });

  it('uses knowledge foundation nodes for the default knowledge graph', () => {
    const graph = JSON.parse(DEFAULT_KNOWLEDGE_GRAPH_DATA);

    expect(graph.nodes.map((node: any) => node.type)).toEqual([
      'knowledge-base-node',
    ]);
  });

  it('normalizes empty or app-default graphs to knowledge foundation nodes in knowledge mode', () => {
    const emptyGraph = normalizeGraphData({}, true, true, 'knowledge');
    const appDefaultGraph = normalizeGraphData(
      JSON.parse(DEFAULT_GRAPH_DATA),
      true,
      true,
      'knowledge',
    );

    expect(emptyGraph.nodes.map((node) => node.type)).toEqual(
      createDefaultKnowledgeWorkflowNodes().map((node) => node.type),
    );
    expect(appDefaultGraph.nodes.map((node) => node.type)).toEqual(
      createDefaultKnowledgeWorkflowNodes().map((node) => node.type),
    );
  });

  it('exposes tool-specific node templates in the tool palette', () => {
    const toolTypes = groupedNodeTemplates('tool').flatMap((group) =>
      group.items.map((item) => item.type),
    );

    expect(toolTypes).toContain('tool-node');
    expect(toolTypes).not.toContain('tool-lib-node');
    expect(toolTypes).not.toContain('tool-workflow-lib-node');
    expect(toolTypes).not.toContain('base-node');
    expect(toolTypes).not.toContain('start-node');
  });

  it('exposes knowledge-specific node templates in the knowledge palette', () => {
    const knowledgeTypes = groupedNodeTemplates('knowledge').flatMap((group) =>
      group.items.map((item) => item.type),
    );

    expect(knowledgeTypes).toContain('data-source-local-node');
    expect(knowledgeTypes).toContain('knowledge-write-node');
    expect(knowledgeTypes).not.toContain('start-node');
    expect(knowledgeTypes).not.toContain('search-knowledge-node');
  });

  it('validates tool workflows against tool-start-node instead of start-node', () => {
    const graph = normalizeGraphData(
      {
        edges: [
          {
            id: 'edge_tool_start_to_tool',
            source: 'tool-start-node',
            sourceAnchorId: 'tool-start-node_right',
            target: 'tool-node_1',
            targetAnchorId: 'tool-node_1_left',
            type: 'app-edge',
          },
        ],
        nodes: [
          ...createDefaultToolWorkflowNodes(),
          {
            id: 'tool-node_1',
            properties: defaultProperties('tool-node', '工具'),
            type: 'tool-node',
            x: 1020,
            y: 140,
          },
        ],
      },
      true,
      true,
      'tool',
    );

    expect(validateWorkflow(graph, 'tool').errors).toEqual([]);
    expect(validateWorkflow(graph, 'application').errors).toContain(
      '工作流必须且只能包含一个 start-node',
    );
  });

  it('validates knowledge workflows against data-source entry nodes', () => {
    const graph = normalizeGraphData(
      {
        edges: [
          {
            id: 'edge_data_source_to_split',
            source: 'data-source-local-node_1',
            sourceAnchorId: 'data-source-local-node_1_right',
            target: 'document-split-node_1',
            targetAnchorId: 'document-split-node_1_left',
            type: 'app-edge',
          },
        ],
        nodes: [
          ...createDefaultKnowledgeWorkflowNodes(),
          {
            id: 'data-source-local-node_1',
            properties: defaultProperties('data-source-local-node', '文本文件'),
            type: 'data-source-local-node',
            x: 620,
            y: 140,
          },
          {
            id: 'document-split-node_1',
            properties: defaultProperties('document-split-node', '文档分段'),
            type: 'document-split-node',
            x: 1020,
            y: 140,
          },
        ],
      },
      true,
      true,
      'knowledge',
    );

    expect(validateWorkflow(graph, 'knowledge').errors).toEqual([]);
    expect(validateWorkflow(graph, 'application').errors).toContain(
      '工作流必须且只能包含一个 start-node',
    );
  });
});
