import { BezierEdge } from '@logicflow/core';

import { AppEdgeModel } from './edge';

class LoopEdgeModel extends AppEdgeModel {
  override getArrowStyle() {
    const style = super.getArrowStyle();
    style.offset = 0;
    style.verticalLength = 0;
    return style;
  }

  override getEdgeStyle() {
    const style = super.getEdgeStyle();
    style.stroke = 'var(--el-border-color-darker)';
    style.strokeWidth = 2;
    style.offset = 0;
    return style;
  }

  override updatePathByAnchor() {
    super.updatePathByAnchor();
    this.updateStartPoint({ x: this.startPoint.x, y: this.startPoint.y - 10 });
    this.updateEndPoint({ x: this.endPoint.x, y: this.endPoint.y + 3 });
    this.pointsList = [];
    this.initPoints();
  }
}

export default { model: LoopEdgeModel, type: 'loop-edge', view: BezierEdge };
