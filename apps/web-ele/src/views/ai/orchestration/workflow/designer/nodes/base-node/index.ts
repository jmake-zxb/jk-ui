import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import BaseNode from './index.vue';

class BaseNodeView extends AppNode {
  constructor(props: any) {
    super(props, BaseNode as Component);
  }
}

class BaseNodeModel extends AppNodeModel {
  override setAttributes() {
    super.setAttributes();
    this.width = 600;
    this.properties.width = 600;
  }
}

export default {
  model: BaseNodeModel,
  type: 'base-node',
  view: BaseNodeView,
};
