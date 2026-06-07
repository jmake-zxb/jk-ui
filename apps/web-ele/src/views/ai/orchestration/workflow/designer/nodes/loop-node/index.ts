import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import LoopNode from './index.vue';

const LOOP_CHILD_ANCHOR_BOTTOM_OFFSET = 25;

class LoopNodeView extends AppNode {
  constructor(props: any) {
    super(props, LoopNode as Component);
  }
}

class LoopNodeModel extends AppNodeModel {
  override getDefaultAnchor() {
    const { height, id, properties, width, x, y } = this;
    const showNode = properties?.showNode !== false;
    const anchorY = this.getAnchorY();
    const anchors: any[] = [
      {
        edgeAddable: false,
        id: `${id}_left`,
        name: 'input',
        type: 'left',
        x: x - width / 2 + 10,
        y: showNode ? y : anchorY,
      },

      {
        id: `${id}_right`,
        name: 'output',
        type: 'right',
        x: x + width / 2 - 10,
        y: showNode ? y : anchorY,
      },
      {
        id: `${id}_children`,
        name: 'loop-body',
        type: 'children',
        x,
        y: y + height / 2 - LOOP_CHILD_ANCHOR_BOTTOM_OFFSET,
      },
    ];
    return anchors;
  }

  refreshBranch() {
    this.refreshAnchors();
    this.incoming?.edges?.forEach((edge: any) => edge.updatePathByAnchor?.());
    this.outgoing?.edges?.forEach((edge: any) => edge.updatePathByAnchor?.());
  }
}

export default {
  model: LoopNodeModel,
  type: 'loop-node',
  view: LoopNodeView,
};
