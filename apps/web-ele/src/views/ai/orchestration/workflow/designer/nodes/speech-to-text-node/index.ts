import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import SpeechToTextNode from './index.vue';

class SpeechToTextNodeView extends AppNode {
  constructor(props: any) {
    super(props, SpeechToTextNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'speech-to-text-node',
  view: SpeechToTextNodeView,
};
