import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import LoopBodyNode from './index.vue';

class LoopBodyNodeView extends AppNode {
  constructor(props: any) {
    super(props, LoopBodyNode as Component);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class LoopBodyNodeModel extends AppNodeModel {
  override get_up_node_field_list(containSelf = false): any[] {
    const nodeData = isRecord(this.properties?.node_data)
      ? this.properties.node_data
      : {};
    const loopNodeId = `${this.properties?.loop_node_id || this.properties?.loopNodeId || nodeData.loop_node_id || nodeData.loopNodeId || ''}`;
    const loopNode = loopNodeId
      ? this.graphModel?.getNodeModelById?.(loopNodeId)
      : undefined;
    if (typeof loopNode?.get_up_node_field_list === 'function') {
      return loopNode.get_up_node_field_list(containSelf);
    }
    return super.get_up_node_field_list(containSelf);
  }

  override getDefaultAnchor() {
    const { height, id, x, y } = this;
    const anchorY =
      this.properties?.showNode === false
        ? this.getAnchorY()
        : y - height / 2 + 10;
    return [
      {
        edgeAddable: false,
        id: `${id}_children`,
        name: 'loop-body',
        type: 'children',
        x,
        y: anchorY,
      },
    ];
  }

  refreshBranch() {
    this.refreshAnchors();
    this.incoming?.edges?.forEach((edge: any) => edge.updatePathByAnchor?.());
    this.outgoing?.edges?.forEach((edge: any) => edge.updatePathByAnchor?.());
  }

  override setHeight(height: number) {
    this.properties.height = height;
    this.refreshBranch();
  }
}

export default {
  model: LoopBodyNodeModel,
  type: 'loop-body-node',
  view: LoopBodyNodeView,
};
