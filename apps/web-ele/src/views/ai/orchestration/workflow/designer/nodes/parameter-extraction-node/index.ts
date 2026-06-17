import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import ParameterExtractionNode from './index.vue';

class ParameterExtractionNodeView extends AppNode {
  constructor(props: any) {
    super(props, ParameterExtractionNode as Component);
  }

  getConfig(props: any) {
    return props.model.properties.config;
  }
}
export default {
  model: AppNodeModel,
  type: 'parameter-extraction-node',
  view: ParameterExtractionNodeView,
};
