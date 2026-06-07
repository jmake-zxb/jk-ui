import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import ToolBaseNode from './index.vue';

class ToolBaseNodeView extends AppNode {
  constructor(props: any) {
    super(props, ToolBaseNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'tool-base-node',
  view: ToolBaseNodeView,
};
