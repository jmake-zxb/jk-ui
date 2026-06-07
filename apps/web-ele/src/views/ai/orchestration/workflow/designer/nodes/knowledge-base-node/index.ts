import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import KnowledgeBaseNode from './index.vue';

class KnowledgeBaseNodeView extends AppNode {
  constructor(props: any) {
    super(props, KnowledgeBaseNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'knowledge-base-node',
  view: KnowledgeBaseNodeView,
};
