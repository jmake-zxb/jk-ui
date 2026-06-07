import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import TextToSpeechNode from './index.vue';

class TextToSpeechNodeView extends AppNode {
  constructor(props: any) {
    super(props, TextToSpeechNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'text-to-speech-node',
  view: TextToSpeechNodeView,
};
