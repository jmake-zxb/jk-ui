import type { App, Component } from 'vue';

import { createApp, h, shallowReactive } from 'vue';

import { h as lfH } from '@logicflow/core';
import { HtmlResize } from '@logicflow/extension';
import ElementPlus from 'element-plus';

import {
  cloneValue,
  DEFAULT_CONFIG,
  defaultProperties,
  nodeMeta,
  normalizeProperties,
} from '../nodes';
import { validateWorkflowConnection } from './connection-validation';

type LogicFlowNodeProps = {
  graphModel: any;
  model: AppNodeModel;
};

type VueMountState = {
  graphModel: any;
  model: any;
  version: number;
};

function canOpenNodeMenuFromAnchor(anchorData: any) {
  if (!anchorData || anchorData.edgeAddable === false) return false;
  const type = `${anchorData.type || ''}`;
  const id = `${anchorData.id || ''}`;
  return type === 'right' || id.endsWith('_right');
}

function isPlainObject(value: any): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergePropertiesInPlace(
  target: Record<string, any>,
  source: Record<string, any>,
) {
  Object.entries(source).forEach(([key, value]) => {
    if (isPlainObject(target[key]) && isPlainObject(value)) {
      mergePropertiesInPlace(target[key], value);
      return;
    }
    target[key] = value;
  });
  return target;
}

export type WorkflowFieldOption = {
  children?: WorkflowFieldOption[];
  label: string;
  type?: string;
  value: string;
};

export class AppNode extends HtmlResize.view {
  // Keep mounted nodeModel callbacks here because Vue receives a new model instead of remounting.
  private static readonly MODEL_CALLBACK_KEYS = [
    'clearSelectElements',
    'clearSelectOn',
    'focusOn',
    'getSelectNodes',
    'loopLayout',
    'openNodeMenu',
    'queueNodeResize',
    'refresh_loop_fields',
    'selectOn',
    'setCollapsed',
    'set_loop_body',
    'shouldKeepHovered',
    'validate',
  ];

  private app?: App;
  private component: Component;
  private root?: HTMLElement;
  private vueState?: VueMountState;

  constructor(props: LogicFlowNodeProps, component: Component) {
    super(props);
    this.component = component;
    props.model.ensureWorkflowProperties();
  }

  override componentWillUnmount() {
    this.unmountVueComponent();
    super.componentWillUnmount?.();
  }

  override getAnchorShape(anchorData: any) {
    const liveAnchorData = this.resolveLiveAnchorData(anchorData);
    const { id, x, y, type } = liveAnchorData;
    const isConnect =
      type === 'left'
        ? this.props.graphModel.edges.some(
            (edge: any) => edge.targetAnchorId === id,
          )
        : this.props.graphModel.edges.some(
            (edge: any) => edge.sourceAnchorId === id,
          );
    const anchorColor = id?.endsWith('_exception_right')
      ? '#FF8800'
      : '#3370FF';

    return lfH(
      'foreignObject',
      {
        ...liveAnchorData,
        x: x - 10,
        y: y - 12,
        width: 30,
        height: 30,
      },
      [
        lfH('div', {
          style: { zIndex: 0 },
          onClick: () => {
            const clickAnchorData = this.resolveLiveAnchorData(anchorData);
            if (canOpenNodeMenuFromAnchor(clickAnchorData)) {
              this.props.model.openNodeMenu?.(clickAnchorData);
            }
          },
          dangerouslySetInnerHTML: {
            __html: isConnect
              ? `<svg width="100%" height="100%" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg"><g filter="url(#filter0_d_5119_232585)"><path d="M20.9998 29.8333C28.0875 29.8333 33.8332 24.0876 33.8332 17C33.8332 9.91231 28.0875 4.16663 20.9998 4.16663C13.9122 4.16663 8.1665 9.91231 8.1665 17C8.1665 24.0876 13.9122 29.8333 20.9998 29.8333Z" fill="white"/><path fill-rule="evenodd" clip-rule="evenodd" d="M20.9998 27.5C26.7988 27.5 31.4998 22.799 31.4998 17C31.4998 11.201 26.7988 6.49996 20.9998 6.49996C15.2008 6.49996 10.4998 11.201 10.4998 17C10.4998 22.799 15.2008 27.5 20.9998 27.5ZM33.8332 17C33.8332 24.0876 28.0875 29.8333 20.9998 29.8333C13.9122 29.8333 8.1665 24.0876 8.1665 17C8.1665 9.91231 13.9122 4.16663 20.9998 4.16663C28.0875 4.16663 33.8332 9.91231 33.8332 17Z" fill="${anchorColor}"/></g><defs><filter id="filter0_d_5119_232585" x="-1" y="-1" width="44" height="44" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/><feOffset dy="4"/><feGaussianBlur stdDeviation="4"/><feComposite in2="hardAlpha" operator="out"/><feColorMatrix type="matrix" values="0 0 0 0 0.2 0 0 0 0 0.439216 0 0 0 0 1 0 0 0 0.1 0"/><feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_5119_232585"/><feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_5119_232585" result="shape"/></filter></defs></svg>`
              : `<svg width="100%" height="100%" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg"><g filter="url(#filter0_d_5199_166905)"><path d="M20.9998 29.8333C28.0875 29.8333 33.8332 24.0876 33.8332 17C33.8332 9.91231 28.0875 4.16663 20.9998 4.16663C13.9122 4.16663 8.1665 9.91231 8.1665 17C8.1665 24.0876 13.9122 29.8333 20.9998 29.8333Z" fill="${anchorColor}"/><path d="M19.8332 11.75C19.8332 11.4278 20.0943 11.1666 20.4165 11.1666H21.5832C21.9053 11.1666 22.1665 11.4278 22.1665 11.75V15.8333H26.2498C26.572 15.8333 26.8332 16.0945 26.8332 16.4166V17.5833C26.8332 17.9055 26.572 18.1666 26.2498 18.1666H22.1665V22.25C22.1665 22.5721 21.9053 22.8333 21.5832 22.8333H20.4165C20.0943 22.8333 19.8332 22.5721 19.8332 22.25V18.1666H15.7498C15.4277 18.1666 15.1665 17.9055 15.1665 17.5833V16.4166C15.1665 16.0945 15.4277 15.8333 15.7498 15.8333H19.8332V11.75Z" fill="white"/></g><defs><filter id="filter0_d_5199_166905" x="-1" y="-1" width="44" height="44" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/><feOffset dy="4"/><feGaussianBlur stdDeviation="4"/><feComposite in2="hardAlpha" operator="out"/><feColorMatrix type="matrix" values="0 0 0 0 0.2 0 0 0 0 0.439216 0 0 0 0 1 0 0 0 0.1 0"/><feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_5199_166905"/><feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_5199_166905" result="shape"/></filter></defs></svg>`,
          },
        }),
      ],
    );
  }

  override getText() {
    return null;
  }

  override setHtml(rootEl: SVGForeignObjectElement) {
    if (!this.root) {
      this.root = document.createElement('div');
      rootEl.innerHTML = '';
      rootEl.append(this.root);
      this.mountVueComponent();
      return;
    }
    this.syncVueMountState();
  }

  private attachRefreshVueComponent(model: any) {
    model.refreshVueComponent = this.bumpVueVersion;
  }

  private bumpVueVersion = () => {
    if (!this.vueState) return;
    const previousModel = this.vueState.model;
    const liveModel = this.resolveLiveModel(previousModel);
    if (liveModel !== previousModel) {
      this.transferModelCallbacks(previousModel, liveModel);
      this.clearRefreshVueComponent(previousModel);
      this.vueState.model = liveModel;
      this.attachRefreshVueComponent(liveModel);
    }
    this.vueState.graphModel = this.props.graphModel;
    this.vueState.version += 1;
  };

  private clearRefreshVueComponent(model?: any) {
    if (model?.refreshVueComponent === this.bumpVueVersion) {
      model.refreshVueComponent = undefined;
    }
  }

  private currentProvide() {
    const state = this.vueState;
    if (!state) return {};
    const customProvide =
      state.graphModel.get_provide?.(state.model, state.graphModel) || {};
    return {
      ...customProvide,
      getGraph: () => this.vueState?.graphModel,
      getNode: () => this.vueState?.model,
    };
  }

  private mountVueComponent() {
    if (!this.root) return;
    this.unmountVueComponent();
    const component = this.component;
    const model = this.resolveLiveModel();
    const state = shallowReactive<VueMountState>({
      graphModel: this.props.graphModel,
      model,
      version: 0,
    });
    this.vueState = state;
    this.attachRefreshVueComponent(state.model);
    this.app = createApp({
      provide: () => this.currentProvide(),
      render: () =>
        h(component, {
          graphModel: state.graphModel,
          nodeModel: state.model,
          properties: state.model.properties,
          renderVersion: state.version,
        }),
    });
    this.app.use(ElementPlus);
    this.app.mount(this.root);
  }

  private resolveLiveAnchorData(anchorData: any) {
    const model = this.props.model as any;
    const liveAnchor =
      model.getAnchorInfo?.(anchorData?.id) ||
      model.anchors?.find((anchor: any) => anchor.id === anchorData?.id);
    if (!liveAnchor) return anchorData;
    Object.assign(anchorData, {
      ...anchorData,
      ...liveAnchor,
      id: liveAnchor.id ?? anchorData.id,
      type: liveAnchor.type ?? anchorData.type,
      x: liveAnchor.x ?? anchorData.x,
      y: liveAnchor.y ?? anchorData.y,
    });
    return anchorData;
  }

  private resolveLiveModel(model = this.props.model) {
    if (!model?.id) return model;
    return this.props.graphModel?.getNodeModelById?.(model.id) || model;
  }

  private syncVueMountState() {
    const nextModel = this.resolveLiveModel();
    const nextGraphModel = this.props.graphModel;
    nextModel.ensureWorkflowProperties();
    if (!this.vueState) return;

    const previousModel = this.vueState.model;
    const modelChanged = previousModel !== nextModel;
    const graphModelChanged = this.vueState.graphModel !== nextGraphModel;

    if (modelChanged) {
      this.transferModelCallbacks(previousModel, nextModel);
      this.clearRefreshVueComponent(previousModel);
    }

    this.vueState.model = nextModel;
    this.vueState.graphModel = nextGraphModel;
    this.attachRefreshVueComponent(nextModel);

    if (modelChanged || graphModelChanged) {
      this.vueState.version += 1;
    }
  }

  private transferModelCallbacks(source?: any, target?: any) {
    if (!source || !target || source === target) return;
    const sourceRecord = source as any;
    const targetRecord = target as any;
    AppNode.MODEL_CALLBACK_KEYS.forEach((key) => {
      const sourceCallback = sourceRecord[key];
      if (typeof sourceCallback !== 'function') return;
      if (!targetRecord[key]) {
        targetRecord[key] = sourceCallback;
      }
      sourceRecord[key] = undefined;
    });
  }

  private unmountVueComponent() {
    this.clearRefreshVueComponent(this.vueState?.model);
    this.clearRefreshVueComponent(this.props.model);
    this.vueState = undefined;
    if (this.app) {
      this.app.unmount();
      this.app = undefined;
    }
    if (this.root) this.root.innerHTML = '';
  }
}

export class AppNodeModel extends HtmlResize.model {
  private static readonly ANCHORLESS_NODE_TYPES = new Set([
    'base-node',
    'knowledge-base-node',
    'tool-base-node',
  ]);
  private static readonly INPUTLESS_NODE_TYPES = new Set([
    'loop-start-node',
    'start-node',
    'tool-start-node',
  ]);

  override isHovered = false;
  openNodeMenu?: (anchorData: any) => void;
  refreshVueComponent?: () => void;
  shouldKeepHovered?: () => boolean;
  private upNodeFieldDict?: Record<string, WorkflowFieldOption[]>;
  private workflowConnectionRulesApplied = false;

  clear_next_node_field(containSelf = true) {
    this.graphModel
      ?.getNodeOutgoingNode?.(this.id)
      ?.forEach((node: any) => node.clear_next_node_field?.(true));
    if (containSelf) this.upNodeFieldDict = undefined;
  }

  ensureWorkflowProperties() {
    const propertiesSource = (this.properties || {}) as Record<string, any>;
    const type = `${(this as any).type || propertiesSource.type || 'base-node'}`;
    const textValue =
      typeof this.text?.value === 'string' ? this.text.value : undefined;
    const properties = normalizeProperties(
      propertiesSource,
      type,
      propertiesSource.stepName || propertiesSource.name || textValue,
    );
    const next = { ...properties, type };
    if (!this.properties) this.properties = {} as any;
    mergePropertiesInPlace(this.properties as Record<string, any>, next);
    this.syncNodeTextName();
  }

  get_node_field_list(): WorkflowFieldOption[] {
    const type = `${(this as any).type || (this.properties as Record<string, any> | undefined)?.type || 'base-node'}`;
    const properties = (this.properties ||
      defaultProperties(type, nodeMeta(type).name)) as Record<string, any>;
    const config = (properties.config || DEFAULT_CONFIG) as Record<string, any>;
    const fields = Array.isArray(config.fields)
      ? config.fields
      : DEFAULT_CONFIG.fields;
    const children = fields.map((field: any) => ({
      label: field.label || field.name || field.value,
      type: field.type || 'string',
      value: field.value || field.name,
    }));
    if (type === 'start-node') {
      return [
        {
          children: cloneValue(config.globalFields || []),
          label: '全局变量',
          type: 'global',
          value: 'global',
        },
        {
          children: cloneValue(
            config.chatFields || [{ label: '用户输入', value: 'input' }],
          ),
          label: '会话变量',
          type: 'chat',
          value: 'chat',
        },
        {
          children,
          label: `${properties.stepName || '开始'}`,
          type,
          value: this.id,
        },
      ].filter((item) => item.children && item.children.length > 0);
    }
    return [
      {
        children,
        label: `${properties.stepName || nodeMeta(type).name}`,
        type,
        value: this.id,
      },
    ];
  }

  get_up_node_field_dict(
    containSelf = false,
    useCache = false,
  ): Record<string, WorkflowFieldOption[]> {
    if (!this.upNodeFieldDict || !useCache) {
      const incoming = this.graphModel?.getNodeIncomingNode?.(this.id) || [];
      const nextFieldDict: Record<string, WorkflowFieldOption[]> = {};
      incoming
        .filter(
          (node: any) =>
            !['loop-start-node', 'start-node'].includes(
              `${node.id || node.type || ''}`,
            ),
        )
        .forEach((node: any) => {
          if (typeof node.get_up_node_field_dict === 'function') {
            Object.assign(
              nextFieldDict,
              node.get_up_node_field_dict(true, useCache),
            );
            return;
          }
          if (typeof node.get_node_field_list === 'function') {
            nextFieldDict[node.id] = node.get_node_field_list();
          }
        });
      this.upNodeFieldDict = nextFieldDict;
    }
    if (containSelf) {
      return {
        ...this.upNodeFieldDict,
        [this.id]: this.get_node_field_list(),
      };
    }
    return this.upNodeFieldDict || {};
  }

  get_up_node_field_list(
    containSelf = false,
    useCache = false,
  ): WorkflowFieldOption[] {
    const result = Object.values(
      this.get_up_node_field_dict(containSelf, useCache),
    ).flat();
    const startNode =
      this.graphModel?.getNodeModelById?.('start-node') ||
      this.graphModel?.getNodeModelById?.('loop-start-node');
    const startNodeFields =
      typeof startNode?.get_node_field_list === 'function'
        ? startNode.get_node_field_list()
        : [];
    const knowledgeBaseNode = this.graphModel?.getNodeModelById?.(
      'knowledge-base-node',
    );
    const knowledgeBaseFields =
      typeof knowledgeBaseNode?.get_node_field_list === 'function'
        ? knowledgeBaseNode.get_node_field_list()
        : [];
    return [...knowledgeBaseFields, ...startNodeFields, ...result].filter(
      (item) => item.children && item.children.length > 0,
    );
  }

  override getAnchorStyle(anchorInfo: any) {
    const style = super.getAnchorStyle(anchorInfo);
    if (anchorInfo.type === 'left') {
      style.fill = 'red';
      style.hover = {
        ...style.hover,
        fill: 'transparent',
        stroke: 'transparent',
      };
      style.className = 'lf-hide-default';
    } else {
      style.fill = 'green';
    }
    return style;
  }

  getAnchorY() {
    const showNode = this.properties?.showNode !== false;
    return showNode ? this.y : this.y - 15;
  }

  override getControlPointStyle() {
    const style = super.getControlPointStyle();
    style.fill = 'none';
    style.stroke = 'none';
    return style;
  }

  override getDefaultAnchor() {
    const { height, id, properties, width, x, y } = this;
    const anchors: any[] = [];
    const type = this.getWorkflowNodeType();
    const anchorY = this.getAnchorY();
    if (!this.canUseWorkflowAnchors(type)) {
      return anchors;
    }
    if (this.canUseInputAnchor(type)) {
      anchors.push({
        edgeAddable: false,
        id: `${id}_left`,
        name: 'input',
        type: 'left',
        x: x - width / 2 + 10,
        y: anchorY,
      });
    }
    if (properties?.enableException) {
      const exceptionAnchorY =
        properties.showNode === false ? anchorY : y + height / 2 - 80;
      anchors.push({
        id: `${id}_exception_right`,
        name: 'exception',
        type: 'right',
        x: x + width / 2 - 10,
        y: exceptionAnchorY,
      });
    }
    anchors.push({
      id: `${id}_right`,
      name: 'output',
      type: 'right',
      x: x + width / 2 - 10,
      y: anchorY,
    });
    return anchors;
  }

  override getNodeStyle() {
    const style = super.getNodeStyle();
    return {
      ...style,
      fill: 'transparent',
      overflow: 'visible',
      stroke: 'transparent',
      strokeWidth: 0,
    };
  }

  override getOutlineStyle() {
    const style = super.getOutlineStyle();
    style.stroke = 'transparent';
    if ((style as any).hover) (style as any).hover.stroke = 'transparent';
    return style;
  }

  override getResizeOutlineStyle() {
    const style = super.getResizeOutlineStyle();
    style.stroke = 'none';
    return style;
  }

  refreshAnchors() {
    if (this.isHovered) {
      this.setIsShowAnchor(false);
      this.setIsShowAnchor(true);
    } else {
      this.setIsShowAnchor(false);
    }
    this.refreshConnectedEdges();
  }

  refreshConnectedEdges() {
    this.incoming?.edges?.forEach((edge: any) => edge.updatePathByAnchor?.());
    this.outgoing?.edges?.forEach((edge: any) => edge.updatePathByAnchor?.());
  }

  override setAttributes() {
    super.setAttributes?.();
    this.ensureWorkflowProperties();
    this.width = Number(this.properties?.width || 340);
    this.height = Number(this.properties?.height || 220);
    this.text.editable = false;
    this.applyWorkflowConnectionRules();
  }

  setHeight(height: number) {
    this.syncNodeSize(height);
  }

  override setHovered(hovered: boolean) {
    if (this.isHovered === hovered) return;
    this.isHovered = hovered;
    this.setIsShowAnchor(hovered);
    this.refreshVueComponent?.();
    this.graphModel?.eventCenter?.emit?.('node:hover-state-change', {
      id: this.id,
      isHovered: hovered,
    });
  }

  syncNodeSize(height: number) {
    if (!height) return false;
    const sourceHeight = this.height;
    const targetHeight = height + 100;
    if (targetHeight === sourceHeight) {
      this.refreshAnchors();
      return false;
    }
    this.resize({
      deltaX: 0,
      deltaY: targetHeight - sourceHeight,
      height: targetHeight,
      width: this.width,
    });
    this.refreshAnchors();
    this.refreshVueComponent?.();
    return true;
  }

  updateWorkflowProperties(
    patch: Record<string, any>,
    fields: string[] = Object.keys(patch),
  ) {
    const propertiesSource = (this.properties || {}) as Record<string, any>;
    const type = `${(this as any).type || propertiesSource.type || 'base-node'}`;
    const nextName = patch.stepName || patch.name || propertiesSource.stepName;
    const source = { ...propertiesSource, ...patch };
    if (
      isPlainObject(propertiesSource.node_data) &&
      isPlainObject(patch.node_data)
    ) {
      source.node_data = { ...propertiesSource.node_data, ...patch.node_data };
    }
    if (isPlainObject(propertiesSource.config) && isPlainObject(patch.config)) {
      source.config = { ...propertiesSource.config, ...patch.config };
    }
    const next = normalizeProperties(source, type, nextName);
    if (!this.properties) this.properties = {} as any;
    mergePropertiesInPlace(this.properties as Record<string, any>, next);
    if ('stepName' in patch || 'name' in patch) {
      const name =
        `${patch.stepName || patch.name || next.stepName || next.name || ''}`.trim();
      if (name) {
        this.properties.stepName = name;
        this.properties.name = name;
        this.syncNodeTextName(name);
      }
    } else {
      this.syncNodeTextName();
    }
    if (
      fields.some((field) =>
        ['enableException', 'node_data', 'node_data.branch'].includes(field),
      )
    ) {
      this.refreshAnchors();
    }
    this.refreshVueComponent?.();
    this.graphModel?.eventCenter?.emit?.('node:inline-update', {
      fields,
      id: this.id,
      properties: this.properties,
      source: 'vue-node',
    });
  }

  private applyWorkflowConnectionRules() {
    if (this.workflowConnectionRulesApplied) return;
    this.workflowConnectionRulesApplied = true;
    (this as any).sourceRules?.push?.({
      message: '不允许无效、重复或循环连线',
      validate: (
        sourceNode: any,
        targetNode: any,
        sourceAnchor: any,
        targetAnchor: any,
      ) =>
        validateWorkflowConnection({
          graphModel: this.graphModel,
          sourceAnchor,
          sourceNode,
          targetAnchor,
          targetNode,
        }).valid,
    });
    (this as any).targetRules?.push?.({
      message: '连线只能连接到节点输入锚点',
      validate: (
        sourceNode: any,
        targetNode: any,
        sourceAnchor: any,
        targetAnchor: any,
      ) =>
        validateWorkflowConnection({
          graphModel: this.graphModel,
          sourceAnchor,
          sourceNode,
          targetAnchor,
          targetNode,
        }).valid,
    });
  }

  private canUseInputAnchor(type: string) {
    return (
      this.canUseWorkflowAnchors(type) &&
      !AppNodeModel.INPUTLESS_NODE_TYPES.has(type)
    );
  }

  private canUseWorkflowAnchors(type: string) {
    return !AppNodeModel.ANCHORLESS_NODE_TYPES.has(type);
  }

  private getWorkflowNodeType() {
    return `${(this as any).type || (this.properties as Record<string, any> | undefined)?.type || 'base-node'}`;
  }

  private syncNodeTextName(
    name = `${this.properties?.stepName || this.properties?.name || ''}`,
  ) {
    const nextName = `${name || ''}`.trim();
    if (nextName) {
      this.properties.stepName = nextName;
      this.properties.name = nextName;
    }
    if (this.text) this.text.value = '';
  }
}
