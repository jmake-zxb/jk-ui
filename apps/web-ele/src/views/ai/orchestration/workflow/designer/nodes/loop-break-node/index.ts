import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import LoopBreakNode from './index.vue';

class LoopBreakNodeView extends AppNode {
  constructor(props: any) {
    super(props, LoopBreakNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'loop-break-node',
  view: LoopBreakNodeView,
};
