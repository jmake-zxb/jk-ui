import type {
  BranchConfig,
  WorkflowEdge,
  WorkflowFoundationMode,
  WorkflowGraphData,
} from './nodes';

import { END_NODE_TYPES, normalizeProperties } from './nodes';

const EMPTY_VALUE_OPERATORS = new Set([
  'is_not_null',
  'is_not_true',
  'is_null',
  'is_true',
]);
const CONFIG_NODE_TYPES = new Set([
  'base-node',
  'knowledge-base-node',
  'tool-base-node',
]);

export type ValidationState = {
  errors: string[];
  warnings: string[];
};

export function validateWorkflow(
  graphData: WorkflowGraphData,
  foundationMode: WorkflowFoundationMode = 'application',
): ValidationState {
  const errors: string[] = [];
  const warnings: string[] = [];
  const idSet = new Set<string>();
  let entryNodeType = 'start-node';
  if (foundationMode === 'tool') {
    entryNodeType = 'tool-start-node';
  } else if (foundationMode === 'knowledge') {
    entryNodeType = 'data-source';
  }
  let configNodeType = 'base-node';
  if (foundationMode === 'tool') {
    configNodeType = 'tool-base-node';
  } else if (foundationMode === 'knowledge') {
    configNodeType = 'knowledge-base-node';
  }

  graphData.nodes.forEach((node) => {
    if (!node.id) errors.push('节点 ID 不能为空');
    if (idSet.has(node.id)) errors.push(`节点 ID 重复: ${node.id}`);
    idSet.add(node.id);
  });

  const startNodes =
    foundationMode === 'knowledge'
      ? graphData.nodes.filter(
          (node) =>
            (node.properties as Record<string, any> | undefined)?.kind ===
            'data-source',
        )
      : graphData.nodes.filter(
          (node) => node.type === entryNodeType || node.id === entryNodeType,
        );
  if (foundationMode === 'knowledge') {
    if (startNodes.length === 0)
      errors.push('工作流必须至少包含一个 data-source');
  } else if (startNodes.length !== 1) {
    errors.push(`工作流必须且只能包含一个 ${entryNodeType}`);
  }
  const baseNodes = graphData.nodes.filter(
    (node) => node.type === configNodeType || node.id === configNodeType,
  );
  if (baseNodes.length === 0)
    errors.push(`工作流必须包含一个 ${configNodeType}`);
  else if (baseNodes.length > 1)
    errors.push(`工作流只能包含一个 ${configNodeType}`);

  graphData.edges.forEach((edge) => {
    if (!edge.source || !idSet.has(edge.source))
      errors.push(`连线 source 节点不存在: ${edge.source || edge.id}`);
    if (!edge.target || !idSet.has(edge.target))
      errors.push(`连线 target 节点不存在: ${edge.target || edge.id}`);
    if (edge.source && edge.source === edge.target)
      errors.push(`连线不能指向自身: ${edge.id}`);
  });

  const outgoing = new Map<string, WorkflowEdge[]>();
  const incoming = new Map<string, WorkflowEdge[]>();
  graphData.edges.forEach((edge) => {
    const sourceEdges = outgoing.get(edge.source || '') || [];
    sourceEdges.push(edge);
    outgoing.set(edge.source || '', sourceEdges);
    const targetEdges = incoming.get(edge.target || '') || [];
    targetEdges.push(edge);
    incoming.set(edge.target || '', targetEdges);
  });

  const reachable = new Set<string>();
  const queue = startNodes
    .map((node) => node.id)
    .filter((id): id is string => !!id);
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId) continue;
    if (reachable.has(nodeId)) continue;
    reachable.add(nodeId);
    outgoing.get(nodeId)?.forEach((edge) => {
      if (edge.target) queue.push(edge.target);
    });
  }

  graphData.nodes.forEach((node) => {
    const edges = outgoing.get(node.id) || [];
    const properties = normalizeProperties(
      node.properties || {},
      node.type,
      node.name,
    );
    const isConfigNode = CONFIG_NODE_TYPES.has(node.type);
    // 节点运行时可用性检查(对齐 MaxKB is_valid_node):raw properties.status
    // 为数字且非 200 表示节点不可用(如 500 模型已删除)。字符串 status(调色板
    // 分类如 'ai'/'input')由 normalizeProperties 注入,不参与可用性判断。
    const rawStatus = (node.properties || {}).status;
    if (typeof rawStatus === 'number' && rawStatus !== 200) {
      errors.push(`节点不可用: ${properties.stepName || node.id}`);
    }
    const isKnowledgeEntryNode =
      foundationMode === 'knowledge' &&
      (node.properties as Record<string, any> | undefined)?.kind ===
        'data-source';
    if (
      node.type !== entryNodeType &&
      !isKnowledgeEntryNode &&
      !isConfigNode &&
      !reachable.has(node.id)
    ) {
      errors.push(`节点不可达: ${properties.stepName || node.id}`);
    }
    if (!isConfigNode && !END_NODE_TYPES.has(node.type) && edges.length === 0) {
      errors.push(`节点缺少后续连线: ${properties.stepName || node.id}`);
    }
    if (node.type === 'condition-node') {
      const branches = Array.isArray(properties.node_data?.branch)
        ? properties.node_data.branch
        : [];
      if (branches.length === 0)
        errors.push(`条件节点缺少分支配置: ${node.id}`);
      const anchors = new Set(edges.map((edge) => edge.sourceAnchorId));
      branches.forEach((branch: BranchConfig) => {
        if (!branch.id) errors.push(`条件节点分支 ID 不能为空: ${node.id}`);
        const expected = `${node.id}_${branch.id}_right`;
        if (branch.id && !anchors.has(expected))
          errors.push(`条件节点分支缺少连线: ${expected}`);
      });
    }
    if (node.type === 'ai-chat-node') {
      validateAiChatNode(properties, errors);
    }
    if (node.type === 'reply-node') {
      validateReplyNode(properties, errors);
    }
    if (node.type === 'loop-node') {
      validateLoopNode(
        node,
        properties,
        graphData.nodes,
        graphData.edges,
        reachable,
        errors,
        warnings,
      );
    }
    if (['loop-break-node', 'loop-continue-node'].includes(node.type)) {
      validateLoopControlNode(node, incoming, errors, warnings);
    }
  });

  return { errors, warnings };
}

function validateAiChatNode(properties: Record<string, any>, errors: string[]) {
  const data = properties.node_data || {};
  const label = properties.stepName || properties.name || 'AI 对话';
  const modelType = data.model_id_type || 'custom';
  if (
    modelType === 'reference'
      ? !hasReference(data.model_id_reference)
      : !hasText(data.model_id || data.modelId)
  ) {
    errors.push(`AI 对话缺少模型 ID: ${label}`);
  }
  if (!hasText(data.prompt)) {
    errors.push(`AI 对话缺少用户提示词: ${label}`);
  }
}

function validateReplyNode(properties: Record<string, any>, errors: string[]) {
  const data = properties.node_data || {};
  const label = properties.stepName || properties.name || '回复';
  if (data.reply_type === 'referencing') {
    if (!hasReference(data.fields) || data.fields.length < 2) {
      errors.push(`回复节点缺少引用字段: ${label}`);
    }
    return;
  }
  if (!hasText(data.content)) {
    errors.push(`回复节点缺少回复内容: ${label}`);
  }
}

function validateLoopNode(
  node: WorkflowGraphData['nodes'][number],
  properties: Record<string, any>,
  nodes: WorkflowGraphData['nodes'],
  edges: WorkflowEdge[],
  reachable: Set<string>,
  errors: string[],
  warnings: string[],
) {
  const data = properties.node_data || {};
  const label = properties.stepName || node.id;
  const loopType = data.loop_type || data.loopType || 'NUMBER';
  if (!['ARRAY', 'LOOP', 'NUMBER'].includes(loopType)) {
    errors.push(`循环节点类型无效: ${label}`);
  }
  if (
    loopType === 'ARRAY' &&
    (!Array.isArray(data.array) || data.array.length === 0)
  ) {
    errors.push(`数组循环缺少数组变量: ${label}`);
  }
  if (
    loopType === 'NUMBER' &&
    !isPositiveNumber(data.number || data.maxLoop || data.iterations)
  ) {
    errors.push(`次数循环必须配置正整数: ${label}`);
  }

  const loopBody = data.loop_body;
  if (
    loopBody !== undefined &&
    (!isPlainObject(loopBody) ||
      !Array.isArray(loopBody.nodes) ||
      !Array.isArray(loopBody.edges))
  ) {
    errors.push(`循环体数据格式无效: ${label}`);
  }

  const bodyNodeIds = new Set<string>();
  if (isPlainObject(loopBody) && Array.isArray(loopBody.nodes)) {
    loopBody.nodes.forEach((bodyNode: any) => {
      if (bodyNode?.id) bodyNodeIds.add(`${bodyNode.id}`);
      if (bodyNode?.type === 'loop-body-node') {
        errors.push(`循环体不能包含循环体占位节点: ${label}`);
      }
      if (bodyNode?.type === 'loop-node') {
        errors.push(`循环体暂不支持嵌套循环节点: ${label}`);
      }
      if (bodyNode?.type === 'loop-start-node') {
        validateLoopStartFields(bodyNode, label, errors);
      }
    });
  }
  if (isPlainObject(loopBody) && Array.isArray(loopBody.edges)) {
    loopBody.edges.forEach((bodyEdge: any) => {
      if (bodyEdge?.type === 'loop-edge') {
        errors.push(`循环体内部连线必须使用 app-edge: ${label}`);
      }
    });
  }
  edges.forEach((edge) => {
    if (
      edge.source === node.id &&
      edge.sourceAnchorId === `${node.id}_children` &&
      edge.target
    )
      bodyNodeIds.add(edge.target);
  });
  nodes.forEach((candidate) => {
    const candidateData =
      normalizeProperties(
        candidate.properties || {},
        candidate.type,
        candidate.name,
      ).node_data || {};
    if (
      candidateData.loopNodeId === node.id ||
      candidateData.loop_id === node.id
    )
      bodyNodeIds.add(candidate.id);
  });

  const hasReachableBreak = nodes.some(
    (candidate) =>
      candidate.type === 'loop-break-node' &&
      bodyNodeIds.has(candidate.id) &&
      reachable.has(candidate.id),
  );
  const hasNestedBreak =
    isPlainObject(loopBody) &&
    Array.isArray(loopBody.nodes) &&
    loopBody.nodes.some(
      (bodyNode: any) => bodyNode?.type === 'loop-break-node',
    );
  if (loopType === 'LOOP' && !hasReachableBreak && !hasNestedBreak) {
    errors.push(`无限循环必须配置可达的跳出循环节点: ${label}`);
  }
  if (
    isPlainObject(loopBody) &&
    Array.isArray(loopBody.nodes) &&
    loopBody.nodes.length > 0 &&
    !hasLoopBodyEntry(loopBody)
  ) {
    warnings.push(`循环体已配置节点但缺少循环体连线: ${label}`);
  }
}

function validateLoopControlNode(
  node: WorkflowGraphData['nodes'][number],
  incoming: Map<string, WorkflowEdge[]>,
  errors: string[],
  warnings: string[],
) {
  const incomingEdges = incoming.get(node.id) || [];
  const hasLoopContext =
    incomingEdges.some(
      (edge) =>
        edge.type === 'loop-edge' || edge.sourceAnchorId?.endsWith('_children'),
    ) || getLoopContextId(node.properties?.node_data);
  if (!hasLoopContext) {
    warnings.push(`循环控制节点未检测到循环上下文: ${node.name || node.id}`);
  }
  const data = node.properties?.node_data || {};
  const conditions = Array.isArray(data.condition_list)
    ? data.condition_list
    : [];
  conditions.forEach((condition: any, index: number) => {
    if (!hasFieldReference(condition.field)) {
      errors.push(
        `循环控制条件缺少变量: ${node.name || node.id} #${index + 1}`,
      );
    }
    if (!condition.compare) {
      errors.push(
        `循环控制条件缺少比较方式: ${node.name || node.id} #${index + 1}`,
      );
    }
    if (operatorNeedsValue(condition.compare) && !hasText(condition.value)) {
      errors.push(
        `循环控制条件缺少比较值: ${node.name || node.id} #${index + 1}`,
      );
    }
  });
}

function validateLoopStartFields(
  node: any,
  loopLabel: string,
  errors: string[],
) {
  const properties = normalizeProperties(
    node.properties || {},
    node.type,
    node.name,
  );
  const data = properties.node_data || {};
  let fields = [];
  if (Array.isArray(data.loop_input_field_list)) {
    fields = data.loop_input_field_list;
  } else if (Array.isArray(data.loopFields)) {
    fields = data.loopFields;
  }
  const keys = new Set<string>();
  fields.forEach((field: any, index: number) => {
    const key =
      `${field?.field || field?.name || field?.variable || field?.value || ''}`.trim();
    if (!key) {
      errors.push(`循环体字段名不能为空: ${loopLabel} #${index + 1}`);
      return;
    }
    if (keys.has(key)) {
      errors.push(`循环体字段名重复: ${loopLabel} ${key}`);
      return;
    }
    keys.add(key);
  });
}

function getLoopContextId(data: any) {
  return data?.loopNodeId || data?.loop_id || data?.loopId;
}

function hasLoopBodyEntry(loopBody: any) {
  return (
    Array.isArray(loopBody.edges) &&
    loopBody.edges.some((edge: any) => edge?.source || edge?.target)
  );
}

function hasReference(value: any) {
  if (Array.isArray(value)) return value.some((item) => hasText(item));
  return hasText(value);
}

function hasFieldReference(value: any) {
  return (
    Array.isArray(value) && value.filter((item) => hasText(item)).length >= 2
  );
}

function hasText(value: any) {
  return value !== undefined && value !== null && `${value}`.trim() !== '';
}

function operatorNeedsValue(compare: any) {
  return hasText(compare) && !EMPTY_VALUE_OPERATORS.has(compare);
}

function isPlainObject(value: any) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveNumber(value: any) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0;
}
