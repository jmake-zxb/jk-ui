import { describe, expect, it } from 'vitest';

import { normalizeGraphData } from './designer/graph-data';
import {
  isMissingToolWorkflowError,
  toBackendToolWorkflowGraphData,
  toEditorToolWorkflowGraphData,
} from './tool-workflow-utils';

describe('tool workflow route fallback helpers', () => {
  it('recognizes missing workflow errors from common API error shapes', () => {
    expect(isMissingToolWorkflowError('工具工作流不存在: 42')).toBe(true);
    expect(isMissingToolWorkflowError(new Error('工具工作流不存在: 42'))).toBe(
      true,
    );
    expect(isMissingToolWorkflowError({ msg: '工具工作流不存在: 42' })).toBe(
      true,
    );
    expect(
      isMissingToolWorkflowError({
        response: { data: { message: '工具工作流不存在: 42' } },
      }),
    ).toBe(true);
  });

  it('does not treat unrelated tool workflow errors as missing records', () => {
    expect(isMissingToolWorkflowError(new Error('网络错误'))).toBe(false);
    expect(isMissingToolWorkflowError({ msg: '工具不存在: 42' })).toBe(false);
    expect(
      isMissingToolWorkflowError({
        response: { data: { message: '权限不足' } },
      }),
    ).toBe(false);
  });
});

describe('tool workflow graph conversion helpers', () => {
  it('serializes editor tool foundation nodes as backend-compatible app foundation nodes', () => {
    const backendGraph = toBackendToolWorkflowGraphData({
      edges: [
        {
          id: 'edge_tool-start-node_to_tool-node_1',
          source: 'tool-start-node',
          sourceAnchorId: 'tool-start-node_right',
          target: 'tool-node_1',
          targetAnchorId: 'tool-node_1_left',
          type: 'app-edge',
        },
      ],
      global: {
        input: '{{tool-start-node.input}}',
        loopEntry: 'loop-start-node',
        outputOwner: 'tool-base-node',
      },
      nodes: [
        {
          id: 'tool-base-node',
          properties: {
            node_data: {
              input_field_list: [{ value: ['tool-start-node', 'input'] }],
              output_field_list: [{ value: '{{tool-start-node.input}}' }],
            },
            type: 'tool-base-node',
          },
          type: 'tool-base-node',
        },
        {
          id: 'tool-start-node',
          properties: {
            config: { fields: [{ value: 'tool-start-node.input' }] },
            node_data: { input: '{{tool-start-node.input}}' },
            type: 'tool-start-node',
          },
          type: 'tool-start-node',
        },
        {
          id: 'loop-start-node',
          properties: { node_data: { loop: 'loop-start-node' } },
          type: 'loop-start-node',
        },
      ],
    });
    const payloadJson = JSON.stringify(backendGraph);
    const payload = {
      graphData: payloadJson,
      graph_data: payloadJson,
      work_flow: payloadJson,
    };

    expect(payload.work_flow).not.toContain('tool-start-node');
    expect(payload.work_flow).not.toContain('tool-base-node');
    expect(payload.graphData).toBe(payload.work_flow);
    expect(payload.graph_data).toBe(payload.work_flow);
    expect(backendGraph.nodes.map((node) => node.id)).toContain('start-node');
    expect(backendGraph.nodes.map((node) => node.type)).toContain('base-node');
    expect(backendGraph.edges[0]?.source).toBe('start-node');
    expect(backendGraph.edges[0]?.sourceAnchorId).toBe('start-node_right');
    expect(backendGraph.global.input).toBe('{{start-node.input}}');
    expect(backendGraph.global.loopEntry).toBe('loop-start-node');
  });

  it('loads backend app foundation nodes as tool editor foundation nodes', () => {
    const editorGraph = toEditorToolWorkflowGraphData({
      edges: [
        {
          id: 'edge_start-node_to_tool-node_1',
          source: 'start-node',
          sourceAnchorId: 'start-node_right',
          target: 'tool-node_1',
          targetAnchorId: 'tool-node_1_left',
          type: 'app-edge',
        },
      ],
      global: {
        input: '{{start-node.question}}',
        loopEntry: 'loop-start-node',
        outputOwner: 'base-node',
      },
      nodes: [
        {
          id: 'base-node',
          properties: {
            node_data: { name: 'Existing Tool' },
            type: 'base-node',
          },
          type: 'base-node',
        },
        {
          id: 'start-node',
          properties: {
            config: { fields: [{ value: 'start-node.question' }] },
            node_data: { question: '{{start-node.question}}' },
            type: 'start-node',
          },
          type: 'start-node',
        },
        {
          id: 'loop-start-node',
          properties: { node_data: { loop: 'loop-start-node' } },
          type: 'loop-start-node',
        },
      ],
    });
    const normalizedEditorGraph = normalizeGraphData(
      editorGraph,
      true,
      true,
      'tool',
    );

    expect(editorGraph.nodes.map((node) => node.id)).toContain(
      'tool-start-node',
    );
    expect(editorGraph.nodes.map((node) => node.type)).toContain(
      'tool-base-node',
    );
    expect(editorGraph.nodes.map((node) => node.id)).not.toContain(
      'start-node',
    );
    expect(editorGraph.nodes.map((node) => node.type)).not.toContain(
      'base-node',
    );
    expect(editorGraph.edges[0]?.source).toBe('tool-start-node');
    expect(editorGraph.edges[0]?.sourceAnchorId).toBe('tool-start-node_right');
    expect(editorGraph.global.input).toBe('{{tool-start-node.question}}');
    expect(editorGraph.global.outputOwner).toBe('tool-base-node');
    expect(editorGraph.global.loopEntry).toBe('loop-start-node');
    expect(
      editorGraph.nodes.find((node) => node.id === 'loop-start-node')?.type,
    ).toBe('loop-start-node');
    expect(normalizedEditorGraph.nodes.map((node) => node.id)).toContain(
      'tool-start-node',
    );
    expect(normalizedEditorGraph.nodes.map((node) => node.id)).not.toContain(
      'start-node',
    );
  });
});
