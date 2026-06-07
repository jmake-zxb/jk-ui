import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import ApplicationNode from './index.vue';

class ApplicationNodeView extends AppNode {
  constructor(props: any) {
    super(props, ApplicationNode as Component);
  }
}
export default {
  model: AppNodeModel,
  type: 'application-node',
  view: ApplicationNodeView,
};
