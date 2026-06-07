import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import ToolStartNode from './index.vue';

class ToolStartNodeView extends AppNode {
  constructor(props: any) {
    super(props, ToolStartNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'tool-start-node',
  view: ToolStartNodeView,
};
