import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import McpNode from './index.vue';

class McpNodeView extends AppNode {
  constructor(props: any) {
    super(props, McpNode as Component);
  }
}

export default { model: AppNodeModel, type: 'mcp-node', view: McpNodeView };
