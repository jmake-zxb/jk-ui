import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import ToolNode from './index.vue';

class ToolNodeView extends AppNode {
  constructor(props: any) {
    super(props, ToolNode as Component);
  }
}

export default { model: AppNodeModel, type: 'tool-node', view: ToolNodeView };
