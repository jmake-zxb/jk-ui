import { describe, expect, it } from 'vitest';

import { normalizeGraphData } from './graph-data';
import {
  createDefaultToolWorkflowNodes,
  createDefaultWorkflowNodes,
  DEFAULT_GRAPH_DATA,
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
});
