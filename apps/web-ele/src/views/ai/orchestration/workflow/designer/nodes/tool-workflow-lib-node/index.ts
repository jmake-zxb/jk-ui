import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import ToolWorkflowLibNode from './index.vue';

class ToolWorkflowLibNodeView extends AppNode {
  constructor(props: any) {
    super(props, ToolWorkflowLibNode as Component);
  }

  getConfig(props: { model: { properties?: Record<string, unknown> } }) {
    return props.model.properties?.config;
  }
}

export default {
  model: AppNodeModel,
  type: 'tool-workflow-lib-node',
  view: ToolWorkflowLibNodeView,
};
