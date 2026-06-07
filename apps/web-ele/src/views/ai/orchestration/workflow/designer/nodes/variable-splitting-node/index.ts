import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import VariableSplittingNode from './index.vue';

class VariableSplittingNodeView extends AppNode {
  constructor(props: any) {
    super(props, VariableSplittingNode as Component);
  }
}
export default {
  model: AppNodeModel,
  type: 'variable-splitting-node',
  view: VariableSplittingNodeView,
};
