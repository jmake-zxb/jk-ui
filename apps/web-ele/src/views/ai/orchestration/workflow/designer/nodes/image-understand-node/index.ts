import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import ImageUnderstandNode from './index.vue';

class ImageUnderstandNodeView extends AppNode {
  constructor(props: any) {
    super(props, ImageUnderstandNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'image-understand-node',
  view: ImageUnderstandNodeView,
};
