import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import ToolLibNode from './index.vue';

class ToolLibNodeView extends AppNode {
  constructor(props: any) {
    super(props, ToolLibNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'tool-lib-node',
  view: ToolLibNodeView,
};
