import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import KnowledgeBaseNode from './index.vue';

class KnowledgeBaseNodeView extends AppNode {
  constructor(props: any) {
    super(props, KnowledgeBaseNode as Component);
  }
}

class KnowledgeBaseNodeModel extends AppNodeModel {
  override setAttributes() {
    super.setAttributes();
    this.width = 600;
    this.properties.width = 600;
  }
}

export default {
  model: KnowledgeBaseNodeModel,
  type: 'knowledge-base-node',
  view: KnowledgeBaseNodeView,
};
