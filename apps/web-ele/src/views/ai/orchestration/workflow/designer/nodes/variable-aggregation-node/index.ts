import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import VariableAggregationNode from './index.vue';

class VariableAggregationNodeView extends AppNode {
  constructor(props: any) {
    super(props, VariableAggregationNode as Component);
  }
}

class VariableAggregationNodeModel extends AppNodeModel {
  override setAttributes() {
    super.setAttributes();
    this.width = 450;
    this.properties.width = 450;
  }
}

export default {
  model: VariableAggregationNodeModel,
  type: 'variable-aggregation-node',
  view: VariableAggregationNodeView,
};
