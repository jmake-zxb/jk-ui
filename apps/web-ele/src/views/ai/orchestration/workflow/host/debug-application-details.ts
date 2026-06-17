import { safeParseJson } from '../../utils';
import { normalizeBaseNodeApplicationInfo } from './base-node-application-info';

type AppDetails = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function findBaseNode(nodes: unknown[]) {
  return nodes.find((node) => {
    if (!isRecord(node)) return false;
    return node.id === 'base-node' || node.type === 'base-node';
  });
}

function baseNodePrologue(baseNode: unknown) {
  if (!isRecord(baseNode)) return undefined;
  const properties = baseNode.properties;
  if (!isRecord(properties)) return undefined;
  const nodeData = properties.node_data;
  if (!isRecord(nodeData)) return undefined;
  return nodeData.prologue;
}

export function buildDebugApplicationDetails(
  app: AppDetails,
  workflowGraphJson: string,
) {
  const graph = normalizeBaseNodeApplicationInfo(
    safeParseJson(workflowGraphJson, {}),
    app,
  );
  const nodes =
    isRecord(graph) && Array.isArray(graph.nodes) ? graph.nodes : [];
  const prologue = baseNodePrologue(findBaseNode(nodes));
  const workFlow = isRecord(app.work_flow) ? app.work_flow : {};

  return {
    ...app,
    prologue: prologue ?? app.prologue ?? '',
    work_flow: { ...workFlow, nodes },
  };
}
