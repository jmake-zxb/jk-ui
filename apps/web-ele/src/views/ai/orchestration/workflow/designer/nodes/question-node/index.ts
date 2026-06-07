import type { Component } from 'vue';

import { AppNode, AppNodeModel } from '../../common/app-node';
import QuestionNode from './index.vue';

class QuestionNodeView extends AppNode {
  constructor(props: any) {
    super(props, QuestionNode as Component);
  }
}

export default {
  model: AppNodeModel,
  type: 'question-node',
  view: QuestionNodeView,
};
