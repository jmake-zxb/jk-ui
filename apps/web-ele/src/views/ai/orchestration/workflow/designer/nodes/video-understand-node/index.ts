import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import VideoUnderstandNode from './index.vue';

class VideoUnderstandNodeView extends AppNode {
  constructor(props: any) {
    super(props, VideoUnderstandNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'video-understand-node',
  view: VideoUnderstandNodeView,
};
