import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import VariableAssignNode from './index.vue';

class VariableAssignNodeView extends AppNode {
  constructor(props: any) {
    super(props, VariableAssignNode as Component);
  }
}
export default {
  model: AppNodeModel,
  type: 'variable-assign-node',
  view: VariableAssignNodeView,
};
