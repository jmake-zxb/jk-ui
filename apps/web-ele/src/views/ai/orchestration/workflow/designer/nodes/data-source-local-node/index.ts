import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import DataSourceLocalNode from './index.vue';

class DataSourceLocalNodeView extends AppNode {
  constructor(props: any) {
    super(props, DataSourceLocalNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'data-source-local-node',
  view: DataSourceLocalNodeView,
};
