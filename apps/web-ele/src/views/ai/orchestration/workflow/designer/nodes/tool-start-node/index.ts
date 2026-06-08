import type { Component } from 'vue';

import type { WorkflowFieldOption } from '../../common/app-node';

import { AppNode, AppNodeModel } from '../../common/app-node';
import ToolStartNode from './index.vue';

class ToolStartNodeView extends AppNode {
  constructor(props: any) {
    super(props, ToolStartNode as Component);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function labelText(value: unknown) {
  if (typeof value === 'string') return value;
  if (isRecord(value)) {
    if (typeof value.label === 'string') return value.label;
    if (typeof value.name === 'string') return value.name;
  }
  return '';
}

function fieldValue(field: Record<string, unknown>) {
  return `${field.field || field.value || field.name || ''}`.trim();
}

function sourceOutputFields(properties: Record<string, unknown> | undefined) {
  const nodeData = isRecord(properties?.node_data) ? properties.node_data : {};
  if (Array.isArray(nodeData.output_field_list))
    return nodeData.output_field_list;
  if (Array.isArray(nodeData.outputFields)) return nodeData.outputFields;
  if (Array.isArray(properties?.output_field_list)) {
    return properties.output_field_list;
  }
  if (Array.isArray(properties?.user_output_field_list)) {
    return properties.user_output_field_list;
  }
  return [];
}

class ToolStartNodeModel extends AppNodeModel {
  override get_node_field_list(): WorkflowFieldOption[] {
    const config = isRecord(this.properties?.config)
      ? this.properties.config
      : {};
    const globalFields = Array.isArray(config.globalFields)
      ? config.globalFields
      : [];
    const toolBaseNode = this.graphModel?.getNodeModelById?.('tool-base-node');
    const outputFields = sourceOutputFields(toolBaseNode?.properties)
      .map((field: Record<string, unknown>) => {
        const value = fieldValue(field);
        return {
          label: labelText(field.label) || labelText(field.name) || value,
          type: `${field.type || 'string'}`,
          value,
        };
      })
      .filter((field: WorkflowFieldOption) => field.value);

    return [
      {
        children: globalFields,
        label: '全局变量',
        type: 'global',
        value: 'global',
      },
      {
        children: outputFields,
        label: '参数输出',
        type: 'output',
        value: 'output',
      },
    ].filter((field) => field.children.length > 0);
  }
}

export default {
  model: ToolStartNodeModel,
  type: 'tool-start-node',
  view: ToolStartNodeView,
};
