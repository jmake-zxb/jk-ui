import type { App } from 'vue';

import { createApp, h as vh } from 'vue';

import { BezierEdge, BezierEdgeModel, h } from '@logicflow/core';

import EdgeDeleteButton from './EdgeDeleteButton.vue';
import { connect, disconnect, isActive } from './teleport';

function isMouseInElement(element: any, e: any) {
  const rect = element.getBoundingClientRect();
  return (
    e.clientX >= rect.left &&
    e.clientX <= rect.right &&
    e.clientY >= rect.top &&
    e.clientY <= rect.bottom
  );
}

const DEFAULT_WIDTH = 32;
const DEFAULT_HEIGHT = 32;

function anchorById(nodeModel: any, anchorId?: string) {
  if (!nodeModel || !anchorId) return undefined;
  return nodeModel
    .getDefaultAnchor?.()
    .find((anchor: any) => anchor.id === anchorId);
}

function fallbackAnchor(nodeModel: any, type: 'source' | 'target') {
  const anchors = nodeModel?.getDefaultAnchor?.() || [];
  if (type === 'target')
    return anchors.find((anchor: any) => anchor.type === 'left');
  return anchors.find((anchor: any) => anchor.type === 'right');
}

function queryElementById(id: string) {
  return document.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
}

class AppEdge extends BezierEdge {
  edgeApp?: App;
  isMounted: boolean;
  root?: HTMLElement;

  constructor() {
    super();
    this.isMounted = false;
    (this as any).handleMouseUp = (e: any) => {
      this.props.graphModel.clearSelectElements();
      this.props.model.isSelected = true;
      const element = e.target.parentNode.parentNode.querySelector(
        '.lf-custom-edge-wrapper',
      );
      if (element && isMouseInElement(element, e)) {
        this.props.model.graphModel.deleteEdgeById(this.props.model.id);
      }
    };
  }

  override componentWillUnmount() {
    if (super.componentWillUnmount) {
      super.componentWillUnmount();
    }
    if (isActive()) {
      disconnect(this.targetId());
    }
    this.unmountVueComponent();
  }

  override getEdge() {
    const { model } = this.props;
    const id = model.id;
    const { customWidth = DEFAULT_WIDTH, customHeight = DEFAULT_HEIGHT } =
      model.getProperties();
    const { startPoint, endPoint, path, isAnimation, arrowConfig } = model;
    const animationStyle = model.getEdgeAnimationStyle();
    const {
      strokeDasharray,
      stroke,
      strokeDashoffset,
      animationName,
      animationDuration,
      animationIterationCount,
      animationTimingFunction,
      animationDirection,
    } = animationStyle;
    const positionData = {
      x: (startPoint.x + endPoint.x - customWidth) / 2,
      y: (startPoint.y + endPoint.y - customHeight) / 2,
      width: customWidth,
      height: customHeight,
    };
    const style = model.getEdgeStyle();
    const wrapperStyle = {
      width: customWidth,
      height: customHeight,
    };

    setTimeout(() => {
      const s = queryElementById(id);
      if (s && !this.isMounted) {
        this.isMounted = true;
        this.renderVueComponent(s);
      }
      // Update delete button visibility based on current hover/selected state
      if (s) {
        const btn = s.querySelector(
          '.workflow-edge-delete',
        ) as HTMLElement | null;
        if (btn) {
          btn.style.display =
            (model as any).isHovered || (model as any).isSelected ? '' : 'none';
        }
      }
    }, 0);

    delete style.stroke;

    return h('g', {}, [
      h(
        'style' as any,
        { type: 'text/css' },
        '.lf-edge{stroke:var(--el-border-color-darker)}.lf-edge:hover{stroke: var(--el-color-primary);}',
      ),
      h('path', {
        d: path,
        ...style,
        ...arrowConfig,
        ...(isAnimation
          ? {
              strokeDasharray,
              stroke,
              style: {
                strokeDashoffset,
                animationName,
                animationDuration,
                animationIterationCount,
                animationTimingFunction,
                animationDirection,
              },
            }
          : {}),
      }),
      h(
        'foreignObject',
        {
          ...positionData,
          y: positionData.y + 5,
          x: positionData.x + 5,
          style: {},
        },
        [
          h('div', {
            id,
            style: { ...wrapperStyle },
            className: 'lf-custom-edge-wrapper',
          }),
        ],
      ),
    ]);
  }

  protected renderVueComponent(root: HTMLElement) {
    this.unmountVueComponent();
    this.root = root;
    const { graphModel } = this.props;
    if (root) {
      if (isActive()) {
        connect(
          this.targetId(),
          EdgeDeleteButton,
          root as HTMLDivElement,
          this.props.model,
          graphModel,
          (node: any, _graph: any) => {
            return { model: node };
          },
        );
      } else {
        this.edgeApp = createApp({
          render: () => vh(EdgeDeleteButton, { model: this.props.model }),
        });
        this.edgeApp.mount(root);
      }
    }
  }

  protected targetId() {
    return `${this.props.graphModel.flowId}:${this.props.model.id}`;
  }

  protected unmountVueComponent() {
    if (this.edgeApp) {
      this.edgeApp.unmount();
      this.edgeApp = undefined;
    }
    if (this.root) {
      this.root.innerHTML = '';
    }
  }
}

export class AppEdgeModel extends BezierEdgeModel {
  override getArrowStyle() {
    const arrowStyle = super.getArrowStyle();
    arrowStyle.offset = 1;
    arrowStyle.verticalLength = 0;
    return arrowStyle;
  }

  /**
   * 重写此方法，使保存数据时能带上锚点数据。
   */
  override getData() {
    const data: any = super.getData();
    if (data) {
      data.sourceAnchorId = this.sourceAnchorId;
      data.targetAnchorId = this.targetAnchorId;
      data.properties = {
        ...data.properties,
        sourceAnchorId: this.sourceAnchorId,
        targetAnchorId: this.targetAnchorId,
      };
    }
    return data;
  }

  override getEdgeStyle() {
    const style = super.getEdgeStyle();
    style.strokeWidth = 2;
    style.stroke = 'var(--el-border-color-darker)';
    style.offset = 0;
    return style;
  }

  override setAttributes(): void {
    super.setAttributes();
    this.isHitable = true;
    this.zIndex = 0;
    const properties = this.getProperties?.() || {};
    if (properties.sourceAnchorId && !this.sourceAnchorId)
      this.sourceAnchorId = properties.sourceAnchorId;
    if (properties.targetAnchorId && !this.targetAnchorId)
      this.targetAnchorId = properties.targetAnchorId;
    this.updatePathByAnchor();
  }

  override setHovered(isHovered: boolean) {
    super.setHovered(isHovered);
    this.syncDeleteButtonVisibility();
  }

  override setSelected(isSelected: boolean) {
    (this as any).isSelected = isSelected;
    this.syncDeleteButtonVisibility();
  }

  /**
   * 基于锚点位置更新边的路径
   */
  updatePathByAnchor() {
    const sourceNodeModel = this.graphModel.getNodeModelById(this.sourceNodeId);
    const targetNodeModel = this.graphModel.getNodeModelById(this.targetNodeId);
    const sourceAnchor =
      anchorById(sourceNodeModel, this.sourceAnchorId) ||
      fallbackAnchor(sourceNodeModel, 'source');
    const targetAnchor =
      anchorById(targetNodeModel, this.targetAnchorId) ||
      fallbackAnchor(targetNodeModel, 'target');

    if (sourceAnchor) {
      this.sourceAnchorId = sourceAnchor.id;
      this.updateStartPoint({ x: sourceAnchor.x, y: sourceAnchor.y });
    }
    if (targetAnchor) {
      this.targetAnchorId = targetAnchor.id;
      this.updateEndPoint({ x: targetAnchor.x, y: targetAnchor.y });
    }

    // 清空 pointsList 触发 bezier 自动计算 control 点
    this.pointsList = [];
    this.initPoints();
  }

  private syncDeleteButtonVisibility() {
    const el = queryElementById(this.id);
    if (!el) return;
    const btn = el.querySelector('.workflow-edge-delete') as HTMLElement | null;
    if (btn) {
      btn.style.display =
        (this as any).isHovered || (this as any).isSelected ? '' : 'none';
    }
  }
}

export default { model: AppEdgeModel, type: 'app-edge', view: AppEdge };
