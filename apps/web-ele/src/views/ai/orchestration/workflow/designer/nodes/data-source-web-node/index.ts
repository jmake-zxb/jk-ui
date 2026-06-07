import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import DataSourceWebNode from './index.vue';

class DataSourceWebNodeView extends AppNode {
  constructor(props: any) {
    super(props, DataSourceWebNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'data-source-web-node',
  view: DataSourceWebNodeView,
};
