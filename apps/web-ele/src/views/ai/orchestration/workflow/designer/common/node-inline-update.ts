import { cloneDeep, set } from 'lodash-es';

type WorkflowNodeModel = {
  graphModel?: {
    eventCenter?: {
      emit?: (eventName: string, payload: Record<string, unknown>) => void;
    };
  };
  id: string;
  properties?: Record<string, unknown>;
  refreshVueComponent?: () => void;
};

type SyncNodeOptions = {
  refreshComponent?: boolean;
};

function nodeProperties(nodeModel: WorkflowNodeModel) {
  if (!nodeModel.properties) set(nodeModel, 'properties', {});
  return nodeModel.properties as Record<string, unknown>;
}

export function emitNodeInlineUpdate(
  nodeModel: WorkflowNodeModel,
  fields: string[] = ['node_data'],
) {
  nodeModel.graphModel?.eventCenter?.emit?.('node:inline-update', {
    fields,
    id: nodeModel.id,
    properties: nodeModel.properties,
    source: 'vue-node',
  });
}

export function syncNodeProperties(
  nodeModel: WorkflowNodeModel,
  patch: Record<string, unknown>,
  fields: string[] = Object.keys(patch),
  options: SyncNodeOptions = {},
) {
  const properties = nodeProperties(nodeModel);
  Object.entries(patch).forEach(([key, value]) => {
    set(properties, key, cloneDeep(value));
  });
  if (options.refreshComponent) nodeModel.refreshVueComponent?.();
  emitNodeInlineUpdate(nodeModel, fields);
}
