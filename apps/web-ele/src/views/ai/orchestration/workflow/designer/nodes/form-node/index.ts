import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import FormNode from './index.vue';

class FormNodeView extends AppNode {
  constructor(props: any) {
    super(props, FormNode as Component);
  }
}
export default { model: AppNodeModel, type: 'form-node', view: FormNodeView };
