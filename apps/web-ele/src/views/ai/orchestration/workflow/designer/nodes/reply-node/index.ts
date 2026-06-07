import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import ReplyNode from './index.vue';

class ReplyNodeView extends AppNode {
  constructor(props: any) {
    super(props, ReplyNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'reply-node',
  view: ReplyNodeView,
};
