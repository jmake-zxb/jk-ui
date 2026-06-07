type ConnectionAnchor = {
  edgeAddable?: boolean;
  id?: string;
  type?: string;
};

type ConnectionNode = {
  getDefaultAnchor?: () => ConnectionAnchor[];
  id?: string;
  properties?: Record<string, any>;
  type?: string;
};

type ConnectionValidationInput = {
  graphModel: any;
  ignoredEdgeId?: string;
  sourceAnchor?: ConnectionAnchor;
  sourceNode?: ConnectionNode;
  targetAnchor?: ConnectionAnchor;
  targetNode?: ConnectionNode;
};

export type ConnectionValidationResult = {
  message?: string;
  valid: boolean;
};

function nodeId(node?: ConnectionNode) {
  return `${node?.id || ''}`;
}

function nodeType(node?: ConnectionNode) {
  return `${node?.type || node?.properties?.type || ''}`;
}

function edgeId(edge: any) {
  return `${edge?.id || ''}`;
}

function edgeSource(edge: any) {
  return `${edge?.sourceNodeId || edge?.source || ''}`;
}

function edgeTarget(edge: any) {
  return `${edge?.targetNodeId || edge?.target || ''}`;
}

function edgeSourceAnchor(edge: any) {
  return edge?.sourceAnchorId || edge?.properties?.sourceAnchorId;
}

function edgeTargetAnchor(edge: any) {
  return edge?.targetAnchorId || edge?.properties?.targetAnchorId;
}

function anchorById(node?: ConnectionNode, anchorId?: string) {
  if (!node || !anchorId) return undefined;
  return node.getDefaultAnchor?.().find((anchor) => anchor.id === anchorId);
}

function isNormalSourceAnchor(anchor?: ConnectionAnchor) {
  return !!anchor && anchor.type !== 'left' && anchor.edgeAddable !== false;
}

function isLoopBodyConnection(input: ConnectionValidationInput) {
  return (
    nodeType(input.sourceNode) === 'loop-node' &&
    nodeType(input.targetNode) === 'loop-body-node' &&
    input.sourceAnchor?.type === 'children' &&
    input.targetAnchor?.type === 'children'
  );
}

function usesLoopBodyAnchor(input: ConnectionValidationInput) {
  return (
    input.sourceAnchor?.type === 'children' ||
    input.targetAnchor?.type === 'children' ||
    input.sourceAnchor?.id?.endsWith('_children') ||
    input.targetAnchor?.id?.endsWith('_children') ||
    nodeType(input.sourceNode) === 'loop-body-node' ||
    nodeType(input.targetNode) === 'loop-body-node'
  );
}

function isTargetAnchor(anchor?: ConnectionAnchor) {
  return anchor?.type === 'left' || anchor?.type === 'children';
}

function hasDuplicateConnection(input: ConnectionValidationInput) {
  const sourceId = nodeId(input.sourceNode);
  const targetId = nodeId(input.targetNode);
  const sourceAnchorId = input.sourceAnchor?.id;
  const targetAnchorId = input.targetAnchor?.id;
  return (input.graphModel?.edges || []).some((edge: any) => {
    if (input.ignoredEdgeId && edgeId(edge) === input.ignoredEdgeId)
      return false;
    return (
      edgeSource(edge) === sourceId &&
      edgeTarget(edge) === targetId &&
      edgeSourceAnchor(edge) === sourceAnchorId &&
      edgeTargetAnchor(edge) === targetAnchorId
    );
  });
}

function hasPath(
  graphModel: any,
  fromNodeId: string,
  targetNodeId: string,
  ignoredEdgeId?: string,
) {
  const visited = new Set<string>();
  const visit = (currentNodeId: string): boolean => {
    if (!currentNodeId || visited.has(currentNodeId)) return false;
    visited.add(currentNodeId);
    const outgoing = (graphModel?.edges || []).filter((edge: any) => {
      if (ignoredEdgeId && edgeId(edge) === ignoredEdgeId) return false;
      return edgeSource(edge) === currentNodeId;
    });
    return outgoing.some((edge: any) => {
      const nextNodeId = edgeTarget(edge);
      return nextNodeId === targetNodeId || visit(nextNodeId);
    });
  };
  return visit(fromNodeId);
}

export function validateWorkflowConnection(
  input: ConnectionValidationInput,
): ConnectionValidationResult {
  const sourceId = nodeId(input.sourceNode);
  const targetId = nodeId(input.targetNode);
  if (!sourceId || !targetId || !input.sourceAnchor || !input.targetAnchor) {
    return { message: '连线锚点无效', valid: false };
  }
  if (sourceId === targetId) {
    return { message: '节点不能连接自身', valid: false };
  }
  if (usesLoopBodyAnchor(input) && !isLoopBodyConnection(input)) {
    return {
      message: '循环体连线只能从循环节点连接到循环体入口',
      valid: false,
    };
  }
  if (
    !isLoopBodyConnection(input) &&
    !isNormalSourceAnchor(input.sourceAnchor)
  ) {
    return { message: '连线只能从节点输出锚点发起', valid: false };
  }
  if (!isTargetAnchor(input.targetAnchor)) {
    return { message: '连线只能连接到节点输入锚点', valid: false };
  }
  if (hasDuplicateConnection(input)) {
    return { message: '相同锚点之间已存在连线', valid: false };
  }
  if (hasPath(input.graphModel, targetId, sourceId, input.ignoredEdgeId)) {
    return { message: '连线不能形成循环', valid: false };
  }
  return { valid: true };
}

export function validateLogicFlowEdge(
  graphModel: any,
  edgeData: any,
): ConnectionValidationResult {
  const sourceNodeId = edgeData?.sourceNodeId || edgeData?.source;
  const targetNodeId = edgeData?.targetNodeId || edgeData?.target;
  const sourceNode = graphModel?.getNodeModelById?.(sourceNodeId);
  const targetNode = graphModel?.getNodeModelById?.(targetNodeId);
  const sourceAnchorId =
    edgeData?.sourceAnchorId || edgeData?.properties?.sourceAnchorId;
  const targetAnchorId =
    edgeData?.targetAnchorId || edgeData?.properties?.targetAnchorId;
  return validateWorkflowConnection({
    graphModel,
    ignoredEdgeId: edgeData?.id,
    sourceAnchor: anchorById(sourceNode, sourceAnchorId),
    sourceNode,
    targetAnchor: anchorById(targetNode, targetAnchorId),
    targetNode,
  });
}
