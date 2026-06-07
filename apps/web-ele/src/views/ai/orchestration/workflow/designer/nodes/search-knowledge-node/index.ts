import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import SearchKnowledgeNode from './index.vue';

class SearchKnowledgeNodeView extends AppNode {
  constructor(props: any) {
    super(props, SearchKnowledgeNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'search-knowledge-node',
  view: SearchKnowledgeNodeView,
};
