import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import DocumentSplitNode from './index.vue';

class DocumentSplitNodeView extends AppNode {
  constructor(props: any) {
    super(props, DocumentSplitNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'document-split-node',
  view: DocumentSplitNodeView,
};
