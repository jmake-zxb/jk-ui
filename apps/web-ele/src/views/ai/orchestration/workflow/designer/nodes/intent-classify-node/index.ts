import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import IntentClassifyNode from './index.vue';

class IntentClassifyNodeView extends AppNode {
  constructor(props: any) {
    super(props, IntentClassifyNode as Component);
  }
}

function resolveBranches(data: Record<string, any>) {
  if (Array.isArray(data.branch)) return data.branch;
  if (Array.isArray(data.intents)) return data.intents;
  return [];
}

class IntentClassifyNodeModel extends AppNodeModel {
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
        x: x - width / 2 + 8,
        y: anchorY,
      },
    ];
    const data =
      (properties as Record<string, any> | undefined)?.node_data || {};
    const branches = resolveBranches(data);
    if (branches.length > 0) {
      branches.forEach((branch: any, index: number) => {
        anchors.push({
          id: `${id}_${branch.id || index}_right`,
          name:
            branch.content || branch.name || branch.id || `intent_${index + 1}`,
          type: 'branch',
          x: x + width / 2 - 8,
          y: showNode ? y - height / 2 + 92 + index * 48 : anchorY,
        });
      });
    } else {
      anchors.push({
        id: `${id}_right`,
        name: 'output',
        type: 'right',
        x: x + width / 2 - 8,
        y: anchorY,
      });
    }
    if ((properties as Record<string, any> | undefined)?.enableException) {
      anchors.push({
        id: `${id}_exception_right`,
        name: 'exception',
        type: 'exception',
        x: x + width / 2 - 8,
        y: showNode ? y + height / 2 - 32 : anchorY,
      });
    }
    return anchors;
  }
}

export default {
  model: IntentClassifyNodeModel,
  type: 'intent-classify-node',
  view: IntentClassifyNodeView,
};
