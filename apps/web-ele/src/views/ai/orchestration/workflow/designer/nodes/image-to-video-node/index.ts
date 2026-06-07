import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import ImageToVideoNode from './index.vue';

class ImageToVideoNodeView extends AppNode {
  constructor(props: any) {
    super(props, ImageToVideoNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'image-to-video-node',
  view: ImageToVideoNodeView,
};
