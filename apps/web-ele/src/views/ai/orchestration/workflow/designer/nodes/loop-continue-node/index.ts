import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import LoopContinueNode from './index.vue';

class LoopContinueNodeView extends AppNode {
  constructor(props: any) {
    super(props, LoopContinueNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'loop-continue-node',
  view: LoopContinueNodeView,
};
