import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import RerankerNode from './index.vue';

class RerankerNodeView extends AppNode {
  constructor(props: any) {
    super(props, RerankerNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'reranker-node',
  view: RerankerNodeView,
};
