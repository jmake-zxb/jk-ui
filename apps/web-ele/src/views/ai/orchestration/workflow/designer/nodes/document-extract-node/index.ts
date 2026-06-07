import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import DocumentExtractNode from './index.vue';

class DocumentExtractNodeView extends AppNode {
  constructor(props: any) {
    super(props, DocumentExtractNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'document-extract-node',
  view: DocumentExtractNodeView,
};
