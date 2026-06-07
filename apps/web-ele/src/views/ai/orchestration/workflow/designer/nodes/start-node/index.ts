import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import StartNode from './index.vue';

class StartNodeView extends AppNode {
  constructor(props: any) {
    super(props, StartNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'start-node',
  view: StartNodeView,
};
