import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import ImageGenerateNode from './index.vue';

class ImageGenerateNodeView extends AppNode {
  constructor(props: any) {
    super(props, ImageGenerateNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'image-generate-node',
  view: ImageGenerateNodeView,
};
