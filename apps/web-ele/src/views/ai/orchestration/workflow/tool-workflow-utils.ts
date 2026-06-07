const TOOL_EDITOR_TO_BACKEND_NODE_IDS: Record<string, string> = {
  'tool-base-node': 'base-node',
  'tool-start-node': 'start-node',
};

const TOOL_BACKEND_TO_EDITOR_NODE_IDS: Record<string, string> = {
  'base-node': 'tool-base-node',
  'start-node': 'tool-start-node',
};

function errorMessageFromRecord(record: Record<string, any>) {
  const directMessage = record.msg || record.message;
  if (typeof directMessage === 'string' && directMessage.trim()) {
    return directMessage;
  }

  const data = record.data || record.response?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (data && typeof data === 'object') {
    const dataMessage = data.msg || data.message;
    if (typeof dataMessage === 'string' && dataMessage.trim()) {
      return dataMessage;
    }
  }

  return '';
}

export function isMissingToolWorkflowError(error: unknown) {
  if (typeof error === 'string') return error.includes('工具工作流不存在');
  if (error instanceof Error && error.message.includes('工具工作流不存在')) {
    return true;
  }
  if (error && typeof error === 'object') {
    return errorMessageFromRecord(error as Record<string, any>).includes(
      '工具工作流不存在',
    );
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapeRegExp(value: string) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function rewriteNodeIdReferences(
  value: string,
  nodeIdMap: Record<string, string>,
) {
  let result = value;
  Object.entries(nodeIdMap).forEach(([sourceId, targetId]) => {
    const sourcePattern = escapeRegExp(sourceId);
    result = result.replaceAll(
      new RegExp(`(^|[^A-Za-z0-9-])${sourcePattern}(?=$|[^A-Za-z0-9-])`, 'g'),
      `$1${targetId}`,
    );
  });
  return result;
}

function rewriteToolWorkflowGraphValue<T>(
  value: T,
  nodeIdMap: Record<string, string>,
): T {
  if (typeof value === 'string') {
    return rewriteNodeIdReferences(value, nodeIdMap) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      rewriteToolWorkflowGraphValue(item, nodeIdMap),
    ) as T;
  }
  if (isRecord(value)) {
    const result: Record<string, unknown> = {};
    Object.entries(value).forEach(([key, item]) => {
      result[rewriteNodeIdReferences(key, nodeIdMap)] =
        rewriteToolWorkflowGraphValue(item, nodeIdMap);
    });
    return result as T;
  }
  return value;
}

export function toBackendToolWorkflowGraphData<T>(graphData: T): T {
  return rewriteToolWorkflowGraphValue(
    graphData,
    TOOL_EDITOR_TO_BACKEND_NODE_IDS,
  );
}

export function toEditorToolWorkflowGraphData<T>(graphData: T): T {
  return rewriteToolWorkflowGraphValue(
    graphData,
    TOOL_BACKEND_TO_EDITOR_NODE_IDS,
  );
}
