import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import AiChatNode from './index.vue';

class AiChatNodeView extends AppNode {
  constructor(props: any) {
    super(props, AiChatNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'ai-chat-node',
  view: AiChatNodeView,
};
