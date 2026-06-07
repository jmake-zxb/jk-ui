import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import VariableAggregationNode from './index.vue';

class VariableAggregationNodeView extends AppNode {
  constructor(props: any) {
    super(props, VariableAggregationNode as Component);
  }
}
export default {
  model: AppNodeModel,
  type: 'variable-aggregation-node',
  view: VariableAggregationNodeView,
};
