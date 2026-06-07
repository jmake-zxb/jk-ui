import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import KnowledgeWriteNode from './index.vue';

class KnowledgeWriteNodeView extends AppNode {
  constructor(props: any) {
    super(props, KnowledgeWriteNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'knowledge-write-node',
  view: KnowledgeWriteNodeView,
};
