import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import SearchDocumentNode from './index.vue';

class SearchDocumentNodeView extends AppNode {
  constructor(props: any) {
    super(props, SearchDocumentNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'search-document-node',
  view: SearchDocumentNodeView,
};
