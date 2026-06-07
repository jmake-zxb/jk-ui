import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import TextToVideoNode from './index.vue';

class TextToVideoNodeView extends AppNode {
  constructor(props: any) {
    super(props, TextToVideoNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'text-to-video-node',
  view: TextToVideoNodeView,
};
