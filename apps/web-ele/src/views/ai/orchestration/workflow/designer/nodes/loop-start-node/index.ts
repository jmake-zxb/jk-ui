import type { Component } from 'vue';

import type { WorkflowFieldOption } from '../../common/app-node';

import { AppNode, AppNodeModel } from '../../common/app-node';
import LoopStartNode from './index.vue';

class LoopStartNodeView extends AppNode {
  constructor(props: any) {
    super(props, LoopStartNode as Component);
  }
}

function labelText(value: unknown) {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const source = value as Record<string, unknown>;
    if (
      source.input_type === 'TooltipLabel' &&
      typeof source.label === 'string'
    )
      return source.label;
    if (typeof source.label === 'string') return source.label;
    if (typeof source.name === 'string') return source.name;
  }
  return '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fieldValue(field: Record<string, unknown>) {
  return `${field.field || field.variable || field.value || field.name || ''}`.trim();
}

function sourceLoopInputFields(
  properties: Record<string, unknown> | undefined,
  nodeData: Record<string, unknown>,
) {
  if (Array.isArray(properties?.loop_input_field_list)) {
    return properties.loop_input_field_list;
  }
  if (Array.isArray(nodeData.loop_input_field_list)) {
    return nodeData.loop_input_field_list;
  }
  return [];
}

class LoopStartNodeModel extends AppNodeModel {
  override get_node_field_list(): WorkflowFieldOption[] {
    const nodeData = isRecord(this.properties?.node_data)
      ? this.properties.node_data
      : {};
    const sourceFields = sourceLoopInputFields(this.properties, nodeData);
    const children = sourceFields
      .map((field: Record<string, unknown>) => {
        const value = fieldValue(field);
        return {
          label:
            labelText(field.label) ||
            `${field.name || field.variable || value}`,
          type: `${field.type || 'string'}`,
          value,
        };
      })
      .filter((field: WorkflowFieldOption) => field.value);
    return [
      { children, label: '循环变量', type: 'loop', value: 'loop' },
      ...super.get_node_field_list(),
    ];
  }
}

export default {
  model: LoopStartNodeModel,
  type: 'loop-start-node',
  view: LoopStartNodeView,
};
