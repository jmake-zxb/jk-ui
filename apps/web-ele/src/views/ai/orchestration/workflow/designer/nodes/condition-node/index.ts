import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import ConditionNodeVue from './index.vue';

class ConditionNode extends AppNode {
  constructor(props: any) {
    super(props, ConditionNodeVue as Component);
  }
}

const get_up_index_height = (condition_list: Array<any>, index: number) => {
  return condition_list
    .filter((_item, i) => i < index)
    .map((item) => Number(item.height || 12) + 8)
    .reduce((x, y) => x + y, 0);
};

class ConditionModel extends AppNodeModel {
  override getDefaultAnchor() {
    const {
      id,
      x,
      y,
      width,
      height,
      properties: { branch_condition_list },
    } = this as any;
    if (this.height === undefined) {
      this.height = 200;
    }
    const showNode =
      this.properties.showNode === undefined ? true : this.properties.showNode;
    const collapsedY = this.getAnchorY();
    const anchors: any = [
      {
        x: x - width / 2 + 10,
        y: showNode ? y : collapsedY,
        id: `${id}_left`,
        edgeAddable: false,
        type: 'left',
      },
    ];

    if (branch_condition_list) {
      for (let index = 0; index < branch_condition_list.length; index++) {
        const element = branch_condition_list[index];
        const h = get_up_index_height(branch_condition_list, index);
        anchors.push({
          x: x + width / 2 - 10,
          y: showNode
            ? y - height / 2 + 75 + h + Number(element.height || 12) / 2
            : collapsedY,
          id: `${id}_${element.id}_right`,
          type: 'right',
        });
      }
    }

    return anchors;
  }

  refreshBranch() {
    this.refreshAnchors();
    this.incoming?.edges?.forEach((edge: any) => {
      edge.updatePathByAnchor?.();
    });
    this.outgoing?.edges?.forEach((edge: any) => {
      edge.updatePathByAnchor?.();
    });
  }
}

export default {
  type: 'condition-node',
  model: ConditionModel,
  view: ConditionNode,
};
