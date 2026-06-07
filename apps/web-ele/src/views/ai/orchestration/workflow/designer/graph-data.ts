import type {
  LogicFlowGraph,
  WorkflowEdge,
  WorkflowFoundationMode,
  WorkflowGraphData,
  WorkflowNode,
} from './nodes';

import { cloneDeep, set } from 'lodash-es';

import {
  createDefaultLoopBodyGraphData,
  createDefaultToolWorkflowNodes,
  createDefaultWorkflowNodes,
  DEFAULT_BASE_NODE_POSITION,
  DEFAULT_START_NODE_POSITION,
  defaultProperties,
  isWorkflowSingletonNode,
  nodeMeta,
  normalizeProperties,
} from './nodes';

const TRANSIENT_LOOP_NODE_TYPES = new Set(['loop-body-node']);
const NESTED_LOOP_DENY_TYPES = new Set(['loop-body-node', 'loop-node']);

function isPlainObject(value: any) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEmptyGraph(value: WorkflowGraphData) {
  return value.nodes.length === 0 && value.edges.length === 0;
}

function isNodeType(node: any, type: string) {
  return `${node?.type || node?.id || ''}` === type;
}

function isDefaultApplicationFoundation(nodes: any[], edges: any[]) {
  if (edges.length > 0 || nodes.length === 0 || nodes.length > 2) return false;
  const nodeTypes = new Set(
    nodes.map((node) => `${node?.type || node?.id || ''}`),
  );
  return [...nodeTypes].every((type) =>
    ['base-node', 'start-node'].includes(type),
  );
}

function toolFoundationNodesForGraph(nodes: any[], edges: any[]) {
  if (nodes.length === 0 || isDefaultApplicationFoundation(nodes, edges)) {
    return createDefaultToolWorkflowNodes();
  }
  const foundationNodes: WorkflowNode[] = [];
  if (!nodes.some((node) => isNodeType(node, 'tool-base-node'))) {
    foundationNodes.push({
      id: 'tool-base-node',
      name: '工具基础',
      properties: defaultProperties('tool-base-node', '工具基础'),
      type: 'tool-base-node',
      ...DEFAULT_BASE_NODE_POSITION,
    });
  }
  if (!nodes.some((node) => isNodeType(node, 'tool-start-node'))) {
    foundationNodes.push({
      id: 'tool-start-node',
      name: '工具开始',
      properties: defaultProperties('tool-start-node', '工具开始'),
      type: 'tool-start-node',
      ...DEFAULT_START_NODE_POSITION,
    });
  }
  return [...foundationNodes, ...nodes];
}

function foundationNodesForEmptyGraph(
  nodes: any[],
  edges: any[],
  foundationMode: WorkflowFoundationMode,
) {
  if (foundationMode === 'tool')
    return toolFoundationNodesForGraph(nodes, edges);
  if (nodes.length === 0) return createDefaultWorkflowNodes();
  if (!nodes.some((node) => isNodeType(node, 'base-node'))) {
    return [
      {
        id: 'base-node',
        name: '基本信息',
        properties: defaultProperties('base-node', '基本信息'),
        type: 'base-node',
        ...DEFAULT_BASE_NODE_POSITION,
      },
      ...nodes,
    ];
  }
  const firstNodeType = `${nodes[0]?.type || nodes[0]?.id || ''}`;
  if (
    nodes.length === 1 &&
    firstNodeType === 'start-node' &&
    edges.length === 0
  ) {
    return [
      {
        id: 'base-node',
        name: '基本信息',
        properties: defaultProperties('base-node', '基本信息'),
        type: 'base-node',
        ...DEFAULT_BASE_NODE_POSITION,
      },
      {
        ...nodes[0],
        id: nodes[0]?.id || 'start-node',
        type: 'start-node',
        x: Number(nodes[0]?.x || DEFAULT_START_NODE_POSITION.x),
        y: Number(nodes[0]?.y || DEFAULT_START_NODE_POSITION.y),
      },
    ];
  }
  return nodes;
}

function edgeTouchesTransientNode(
  edge: WorkflowEdge,
  transientNodeIds: Set<string>,
) {
  return (
    (!!edge.source && transientNodeIds.has(edge.source)) ||
    (!!edge.target && transientNodeIds.has(edge.target))
  );
}

function normalizedLoopBodyForNode(
  artifact:
    | undefined
    | { loop?: { x: number; y: number }; workflow: WorkflowGraphData },
  currentBody: WorkflowGraphData,
  nodeId: string,
) {
  if (artifact && !isEmptyGraph(artifact.workflow)) return artifact.workflow;
  if (isEmptyGraph(currentBody)) return createDefaultLoopBodyGraphData(nodeId);
  return normalizeLoopBodyGraphData(currentBody);
}

export function normalizeGraphData(
  value: any,
  includeDefaultFoundation = true,
  seedLoopBodies = true,
  foundationMode: WorkflowFoundationMode = 'application',
): WorkflowGraphData {
  const rawNodes = Array.isArray(value?.nodes) ? value.nodes : [];
  const edges = Array.isArray(value?.edges) ? value.edges : [];
  const nodes = includeDefaultFoundation
    ? foundationNodesForEmptyGraph(rawNodes, edges, foundationMode)
    : rawNodes;
  return {
    version: value?.version || '1.0',
    mode: value?.mode || 'APPLICATION',
    global:
      typeof value?.global === 'object' && value.global !== null
        ? value.global
        : {},
    nodes: nodes.map((node: any, index: number) => {
      const type = `${node?.type || 'base-node'}`;
      const meta = nodeMeta(type);
      const singletonId = isWorkflowSingletonNode(type) ? type : undefined;
      const properties = normalizeProperties(
        node?.properties || node?.config || {},
        type,
        node?.name,
      );
      if (seedLoopBodies && type === 'loop-node') {
        properties.node_data = {
          ...properties.node_data,
          loop_body: normalizeLoopBodyGraphData(
            properties.node_data?.loop_body,
          ),
        };
      }
      return {
        id: `${node?.id || singletonId || `${type}_${Date.now()}_${index}`}`,
        type,
        x: Number(node?.x || properties.x || 160 + index * 220),
        y: Number(node?.y || properties.y || 140 + (index % 3) * 150),
        name: node?.name || properties.stepName || meta.name,
        properties,
      };
    }),
    edges: edges
      .map((edge: any, index: number) => ({
        id: `${edge?.id || `edge_${Date.now()}_${index}`}`,
        source: `${edge?.source || edge?.sourceNodeId || ''}`,
        sourceAnchorId: edge?.sourceAnchorId,
        sourceAnchorType: edge?.sourceAnchorType || edge?.sourceAnchorTypeId,
        target: `${edge?.target || edge?.targetNodeId || ''}`,
        targetAnchorId: edge?.targetAnchorId,
        targetAnchorType: edge?.targetAnchorType || edge?.targetAnchorTypeId,
        type: edge?.type || 'app-edge',
      }))
      .filter((edge: WorkflowEdge) => edge.source && edge.target),
  };
}

export function normalizeLoopBodyGraphData(
  value: any,
  seedDefault = true,
): WorkflowGraphData {
  const graphData = normalizeGraphData(value || {}, false, false);
  const nodes = graphData.nodes.filter(
    (node) => !NESTED_LOOP_DENY_TYPES.has(node.type),
  );
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = graphData.edges
    .filter((edge) => edge.type !== 'loop-edge')
    .filter(
      (edge) =>
        !!edge.source &&
        !!edge.target &&
        nodeIds.has(edge.source) &&
        nodeIds.has(edge.target),
    )
    .map((edge) => ({ ...edge, type: 'app-edge' }));

  const normalized = {
    edges,
    global: {},
    mode: graphData.mode || 'APPLICATION',
    nodes,
    version: graphData.version || '1.0',
  };
  return seedDefault && isEmptyGraph(normalized)
    ? createDefaultLoopBodyGraphData()
    : normalized;
}

export function toLogicFlowGraph(graphData: WorkflowGraphData): LogicFlowGraph {
  const nodeById = new Map(graphData.nodes.map((node) => [node.id, node]));
  const defaultAnchorId = (
    nodeId: string | undefined,
    side: 'left' | 'right',
  ) => {
    if (!nodeId) return undefined;
    const node = nodeById.get(nodeId);
    if (!node) return undefined;
    return side === 'left' ? `${nodeId}_left` : `${nodeId}_right`;
  };
  return {
    nodes: graphData.nodes.map((node) => {
      const properties = normalizeProperties(
        node.properties || {},
        node.type,
        node.name,
      );
      return {
        id: node.id,
        type: node.type,
        x: node.x,
        y: node.y,
        properties: {
          ...properties,
          height: properties.height || 220,
          width: properties.width || 340,
        },
      };
    }),
    edges: graphData.edges.map((edge) => ({
      id: edge.id,
      type: edge.type || 'app-edge',
      sourceNodeId: edge.source,
      targetNodeId: edge.target,
      sourceAnchorId:
        edge.sourceAnchorId || defaultAnchorId(edge.source, 'right'),
      targetAnchorId:
        edge.targetAnchorId || defaultAnchorId(edge.target, 'left'),
      properties: {
        sourceAnchorId:
          edge.sourceAnchorId || defaultAnchorId(edge.source, 'right'),
        sourceAnchorType: edge.sourceAnchorType,
        targetAnchorId:
          edge.targetAnchorId || defaultAnchorId(edge.target, 'left'),
        targetAnchorType: edge.targetAnchorType,
      },
    })),
  };
}

export function fromLogicFlowGraph(
  graph: LogicFlowGraph,
  currentGraphData?: WorkflowGraphData,
  foundationMode: WorkflowFoundationMode = 'application',
): WorkflowGraphData {
  const current = normalizeGraphData(
    currentGraphData || {},
    true,
    true,
    foundationMode,
  );
  const graphNodes = graph.nodes || [];
  const normalizedNodes = graphNodes.map((node: any) => {
    const backendType = node?.properties?.type || node?.type || 'base-node';
    const nodeProperties = node?.properties || {};
    const name =
      nodeProperties.stepName ||
      nodeProperties.name ||
      node?.text?.value ||
      node?.text;
    const properties = normalizeProperties(nodeProperties, backendType, name);
    delete properties.backendType;
    delete properties.height;
    delete properties.width;
    delete properties.style;
    delete properties.textStyle;
    delete properties.x;
    delete properties.y;
    return {
      id: `${node.id}`,
      type: backendType,
      x: Number(node.x || 0),
      y: Number(node.y || 0),
      properties,
    };
  });
  const normalizedEdges = (graph.edges || [])
    .map((edge: any, index: number) => ({
      id: `${edge.id || `edge_${index}`}`,
      source: `${edge.sourceNodeId || edge.source || ''}`,
      sourceAnchorId: edge.sourceAnchorId || edge.properties?.sourceAnchorId,
      sourceAnchorType: edge.properties?.sourceAnchorType,
      target: `${edge.targetNodeId || edge.target || ''}`,
      targetAnchorId: edge.targetAnchorId || edge.properties?.targetAnchorId,
      targetAnchorType: edge.properties?.targetAnchorType,
      type: edge.type || 'app-edge',
    }))
    .filter((edge: WorkflowEdge) => edge.source && edge.target);
  const transientNodeIds = new Set(
    normalizedNodes
      .filter((node) => TRANSIENT_LOOP_NODE_TYPES.has(node.type))
      .map((node) => node.id),
  );
  const loopBodyByLoopNodeId = new Map<
    string,
    { loop?: { x: number; y: number }; workflow: WorkflowGraphData }
  >();

  normalizedNodes
    .filter((node) => TRANSIENT_LOOP_NODE_TYPES.has(node.type))
    .forEach((bodyNode) => {
      const bodyData = isPlainObject(bodyNode.properties?.node_data)
        ? bodyNode.properties?.node_data
        : {};
      const loopNodeId = `${bodyNode.properties?.loop_node_id || bodyNode.properties?.loopNodeId || bodyData.loop_node_id || bodyData.loopNodeId || ''}`;
      if (!loopNodeId) return;
      const rawBody =
        bodyData.loop_body ||
        bodyData.workflow ||
        bodyNode.properties?.workflow;
      loopBodyByLoopNodeId.set(loopNodeId, {
        loop: { x: Number(bodyNode.x || 0), y: Number(bodyNode.y || 0) },
        workflow: normalizeLoopBodyGraphData(rawBody),
      });
    });

  normalizedEdges.forEach((edge) => {
    if (
      edge.type !== 'loop-edge' &&
      !edge.sourceAnchorId?.endsWith('_children')
    )
      return;
    const bodyNode = normalizedNodes.find(
      (node) =>
        node.id === edge.target && TRANSIENT_LOOP_NODE_TYPES.has(node.type),
    );
    if (!bodyNode || !edge.source) return;
    const bodyData = bodyNode.properties?.node_data || {};
    const rawBody =
      bodyData.loop_body || bodyData.workflow || bodyNode.properties?.workflow;
    loopBodyByLoopNodeId.set(edge.source, {
      loop: { x: Number(bodyNode.x || 0), y: Number(bodyNode.y || 0) },
      workflow: normalizeLoopBodyGraphData(rawBody),
    });
  });

  const nodes = normalizedNodes
    .filter((node) => !TRANSIENT_LOOP_NODE_TYPES.has(node.type))
    .map((node: WorkflowNode) => {
      if (node.type !== 'loop-node') return node;
      const nodeData = isPlainObject(node.properties?.node_data)
        ? cloneDeep(node.properties?.node_data)
        : {};
      const currentBody = normalizeLoopBodyGraphData(nodeData.loop_body, false);
      const artifact = loopBodyByLoopNodeId.get(node.id);
      const loopBody = normalizedLoopBodyForNode(
        artifact,
        currentBody,
        node.id,
      );
      set(nodeData, 'loop_body', cloneDeep(loopBody));
      if (artifact?.loop) set(nodeData, 'loop', cloneDeep(artifact.loop));
      return {
        ...node,
        properties: {
          ...node.properties,
          node_data: nodeData,
        },
      };
    });

  return {
    version: current.version || '1.0',
    mode: current.mode || 'APPLICATION',
    global: current.global || {},
    nodes,
    edges: normalizedEdges
      .filter((edge) => edge.type !== 'loop-edge')
      .filter((edge) => !edgeTouchesTransientNode(edge, transientNodeIds)),
  };
}
