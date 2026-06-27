<script setup lang="ts">
import type { WorkflowGraphData, WorkflowNode } from '../../nodes';

import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue';

import { usePreferences } from '@vben/preferences';

import LogicFlow from '@logicflow/core';
import { ElMessage } from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

import { validateLogicFlowEdge } from '../../common/connection-validation';
import { disconnectByFlow } from '../../common/teleport';
import {
  fromLogicFlowGraph,
  normalizeLoopBodyGraphData,
  toLogicFlowGraph,
} from '../../graph-data';
import { createDefaultLoopBodyGraphData } from '../../nodes';
import { registerLoopWorkflowNodes } from '../../register';
import LoopBodyContainer from './LoopBodyContainer.vue';

type LoopField = {
  field?: string;
  label?: string | { input_type?: string; label?: string };
  name?: string;
  type?: string;
  value?: string;
  variable?: string;
};

type NestedNodeEvent = { kw?: string; node?: WorkflowNode };
type NestedNodeTarget = NestedNodeEvent | WorkflowNode;

const props = defineProps<{
  nodeModel: any;
  renderVersion?: number;
}>();

const canvasRef = ref<HTMLDivElement>();
const loopBodyContainerRef = ref<InstanceType<typeof LoopBodyContainer>>();
const nestedLfRef = shallowRef<any>();
const selectedBodyNodeId = ref('');
const selectedBodyEdgeId = ref('');
const deniedNodeTypes = new Set(['loop-body-node', 'loop-node']);
const protectedNodeTypes = new Set(['loop-start-node']);
const currentLoopBody = ref<WorkflowGraphData>(
  normalizeLoopBodyForParent(bodyDataFromProperties()),
);
let fitTimer = 0;
const { isDark } = usePreferences();

function isEmptyGraphData(value: WorkflowGraphData) {
  return value.nodes.length === 0 && value.edges.length === 0;
}

function nodeData() {
  return props.nodeModel.properties?.node_data || {};
}

function loopNodeId() {
  const data = nodeData();
  return `${props.nodeModel.properties?.loop_node_id || props.nodeModel.properties?.loopNodeId || data.loop_node_id || data.loopNodeId || ''}`;
}

function parentLoopNode() {
  const id = loopNodeId();
  return id ? props.nodeModel.graphModel?.getNodeModelById?.(id) : undefined;
}

function bodyDataFromProperties() {
  const data = nodeData();
  const parentNode = parentLoopNode();
  return (
    data.loop_body ||
    data.workflow ||
    props.nodeModel.properties?.workflow ||
    parentNode?.properties?.node_data?.loop_body ||
    {}
  );
}

function labelValue(label: LoopField['label'], fallback: string) {
  if (typeof label === 'object' && label?.input_type === 'TooltipLabel')
    return label.label || fallback;
  return `${label || fallback}`;
}

function fieldKey(field: LoopField) {
  return `${field.field || field.variable || field.value || field.name || ''}`.trim();
}

function normalizeLoopFields(fields: LoopField[]) {
  return fields
    .map((field) => {
      const value = fieldKey(field);
      return {
        field: value,
        label: labelValue(field.label, `${field.name || value}`),
        name: value,
        type: field.type || (value === 'index' ? 'number' : 'string'),
        value,
      };
    })
    .filter((field) => field.value);
}

function loopFieldsFromNode(node: WorkflowNode) {
  const properties = node.properties || {};
  const data = properties.node_data || {};
  const fields = resolveLoopInputFields(properties, data);
  return normalizeLoopFields(fields);
}

function resolveLoopInputFields(
  properties: Record<string, any>,
  data: Record<string, any>,
) {
  if (Array.isArray(properties.loop_input_field_list)) {
    return properties.loop_input_field_list;
  }
  if (Array.isArray(data.loop_input_field_list)) {
    return data.loop_input_field_list;
  }
  return [];
}

function defaultLoopStartNode() {
  return createDefaultLoopBodyGraphData(loopNodeId()).nodes[0]!;
}

function outputFieldsFromLoopFields(
  fields: ReturnType<typeof normalizeLoopFields>,
) {
  return fields.map((field) => ({
    label: field.label,
    name: field.value,
    type: field.type || 'string',
    value: field.value,
  }));
}

function withLoopStartContext(node: WorkflowNode) {
  const defaultNode = defaultLoopStartNode();
  const defaultFields = loopFieldsFromNode(defaultNode);
  const nextFields =
    loopFieldsFromNode(node).length > 0
      ? loopFieldsFromNode(node)
      : defaultFields;
  const defaultConfig = (defaultNode.properties || {}).config || {};
  const nodeConfig = (node.properties || {}).config || {};
  const configFields =
    Array.isArray(nodeConfig.fields) && nodeConfig.fields.length > 0
      ? nodeConfig.fields
      : defaultConfig.fields || [];
  const sourceNodeData = {
    ...(defaultNode.properties || {}).node_data,
    ...(node.properties || {}).node_data,
  };
  delete sourceNodeData.loop_input_field_list;
  const properties = {
    ...defaultNode.properties,
    ...node.properties,
    config: {
      ...defaultConfig,
      ...nodeConfig,
      fields: cloneDeep(configFields),
    },
    loop_input_field_list: cloneDeep(nextFields),
    node_data: sourceNodeData,
    loop_node_id: loopNodeId(),
    loopNodeId: loopNodeId(),
    showNode: (node.properties || {}).showNode !== false,
    stepName: (node.properties || {}).stepName || '循环开始',
  };
  return {
    ...defaultNode,
    ...node,
    id: node.id || 'loop-start-node',
    name: node.name || '循环开始',
    properties,
    type: 'loop-start-node',
  };
}

function normalizeLoopBodyForParent(value: unknown): WorkflowGraphData {
  const normalized = normalizeLoopBodyGraphData(value, false);
  const base = isEmptyGraphData(normalized)
    ? createDefaultLoopBodyGraphData(loopNodeId())
    : normalized;
  const nodes = base.nodes.filter((node) => !deniedNodeTypes.has(node.type));
  const hasLoopStart = nodes.some((node) => node.type === 'loop-start-node');
  const nextNodes = (
    hasLoopStart ? nodes : [defaultLoopStartNode(), ...nodes]
  ).map((node) =>
    node.type === 'loop-start-node' ? withLoopStartContext(node) : node,
  );
  const nodeIds = new Set(nextNodes.map((node) => node.id));
  return {
    edges: base.edges
      .filter((edge) => edge.type !== 'loop-edge')
      .filter(
        (edge) =>
          !!edge.source &&
          !!edge.target &&
          nodeIds.has(edge.source) &&
          nodeIds.has(edge.target),
      )
      .map((edge) => ({ ...edge, type: 'app-edge' })),
    global: base.global || {},
    mode: base.mode || 'APPLICATION',
    nodes: nextNodes,
    version: base.version || '1.0',
  };
}

function loopFieldsFromWorkflow(bodyWorkflow: WorkflowGraphData) {
  const loopStart = bodyWorkflow.nodes.find(
    (node) => node.type === 'loop-start-node',
  );
  return loopStart
    ? loopFieldsFromNode(loopStart)
    : loopFieldsFromNode(defaultLoopStartNode());
}

function emitInlineUpdate(id: string, fields: string[]) {
  props.nodeModel.graphModel?.eventCenter?.emit?.('node:inline-update', {
    fields,
    id,
    properties: props.nodeModel.properties,
    source: 'loop-body-node',
  });
}

function syncBodyNodeWorkflow(bodyWorkflow: WorkflowGraphData) {
  const normalized = normalizeLoopBodyForParent(bodyWorkflow);
  currentLoopBody.value = normalized;
  set(props.nodeModel.properties, 'workflow', cloneDeep(normalized));
  set(props.nodeModel.properties, 'node_data.loop_body', cloneDeep(normalized));
  set(props.nodeModel.properties, 'node_data.workflow', cloneDeep(normalized));
  set(props.nodeModel.properties, 'node_data.loop_node_id', loopNodeId());
  set(props.nodeModel.properties, 'node_data.loopNodeId', loopNodeId());
  return normalized;
}

function refreshLoopFields(fields: LoopField[]) {
  const parentNode = parentLoopNode();
  if (!parentNode) return;
  const normalizedFields = outputFieldsFromLoopFields(
    normalizeLoopFields(fields),
  );
  set(parentNode.properties, 'config.fields', cloneDeep(normalizedFields));
  parentNode.clear_next_node_field?.(true);
  parentNode.refreshVueComponent?.();
  emitInlineUpdate(parentNode.id, ['config']);
}

function setLoopBody(nextWorkflow: WorkflowGraphData = currentLoopBody.value) {
  const normalized = syncBodyNodeWorkflow(nextWorkflow);
  const parentNode = parentLoopNode();
  if (parentNode) {
    set(parentNode.properties, 'node_data.loop', {
      x: Number(props.nodeModel.x || 0),
      y: Number(props.nodeModel.y || 0),
    });
    set(parentNode.properties, 'node_data.loop_body', cloneDeep(normalized));
    refreshLoopFields(loopFieldsFromWorkflow(normalized));
    emitInlineUpdate(parentNode.id, ['node_data', 'config']);
  }
  emitInlineUpdate(props.nodeModel.id, ['node_data', 'workflow']);
  return normalized;
}

function clearNestedSelectionState() {
  selectedBodyNodeId.value = '';
  selectedBodyEdgeId.value = '';
}

function selectNestedNode(id: string) {
  selectedBodyNodeId.value = id;
  selectedBodyEdgeId.value = '';
  nestedLfRef.value?.toFront?.(id);
}

function selectNestedEdge(id: string) {
  selectedBodyEdgeId.value = id;
  selectedBodyNodeId.value = '';
}

function removeDeniedNodes() {
  const lf = nestedLfRef.value;
  const graph = lf?.getGraphData?.();
  if (!lf || !graph?.nodes) return;
  graph.nodes
    .filter((node: any) =>
      deniedNodeTypes.has(node?.properties?.type || node?.type),
    )
    .forEach((node: any) => lf.deleteNode?.(node.id));
}

function createLoopStartGraphNode() {
  return toLogicFlowGraph(createDefaultLoopBodyGraphData(loopNodeId()))
    .nodes?.[0];
}

function ensureLoopStartNodeInCanvas() {
  const lf = nestedLfRef.value;
  if (!lf) return false;
  const graph = lf.getGraphData?.();
  const hasLoopStart = graph?.nodes?.some(
    (node: any) =>
      `${node?.properties?.type || node?.type || ''}` === 'loop-start-node',
  );
  if (hasLoopStart) return false;
  const loopStartNode = createLoopStartGraphNode();
  if (!loopStartNode) return false;
  lf.addNode?.(loopStartNode);
  return true;
}

function syncFromNestedGraph() {
  const lf = nestedLfRef.value;
  if (!lf) return;
  removeDeniedNodes();
  const insertedLoopStart = ensureLoopStartNodeInCanvas();
  const normalized = normalizeLoopBodyForParent(
    fromLogicFlowGraph(lf.getGraphData(), currentLoopBody.value),
  );
  setLoopBody(normalized);
  if (insertedLoopStart) queueFitView();
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitForElementSize(
  element: HTMLElement | undefined,
  maxFrames = 30,
) {
  if (!element) return false;
  for (let index = 0; index < maxFrames; index += 1) {
    const { height, width } = element.getBoundingClientRect();
    if (width > 0 && height > 0) return true;
    await nextFrame();
  }
  return false;
}

async function renderLoopBody(fit = true) {
  const lf = nestedLfRef.value;
  if (!lf) return;
  const hasSize = await waitForElementSize(canvasRef.value);
  if (!hasSize) return;
  const normalized = normalizeLoopBodyForParent(bodyDataFromProperties());
  currentLoopBody.value = normalized;
  lf.render(toLogicFlowGraph(normalized));
  ensureLoopStartNodeInCanvas();
  syncFromNestedGraph();
  clearNestedSelectionState();
  if (fit) queueFitView();
}

function queueFitView(delay = 500) {
  window.clearTimeout(fitTimer);
  fitTimer = window.setTimeout(() => {
    fitTimer = 0;
    fitView();
  }, delay);
}

function installNestedPointBridge(lf: any) {
  const transformModel = lf.graphModel?.transformModel;
  const parentTransformModel = props.nodeModel.graphModel?.transformModel;
  if (!transformModel || !parentTransformModel) return;
  transformModel.HtmlPointToCanvasPoint = (point: number[]) => {
    let scaleX = Number(transformModel.SCALE_X || 1);
    let scaleY = Number(transformModel.SCALE_Y || 1);
    let translateX = Number(transformModel.TRANSLATE_X || 0);
    let translateY = Number(transformModel.TRANSLATE_Y || 0);
    const [x = 0, y = 0] = point;
    scaleX *= Number(parentTransformModel.SCALE_X || 1);
    scaleY *= Number(parentTransformModel.SCALE_Y || 1);
    translateX *= Number(parentTransformModel.SCALE_X || 1);
    translateY *= Number(parentTransformModel.SCALE_Y || 1);
    return [(x - translateX) / scaleX, (y - translateY) / scaleY];
  };
}

function fieldGroupKey(item: any) {
  return `${item?.type || ''}:${item?.value || item?.label || ''}`;
}

function dedupeFieldGroups(items: any[]) {
  const result: any[] = [];
  const usedKeys = new Set<string>();
  items.forEach((item) => {
    if (!item?.children?.length) return;
    const key = fieldGroupKey(item);
    if (usedKeys.has(key)) return;
    usedKeys.add(key);
    result.push(item);
  });
  return result;
}

function nestedLoopStartFields(lf: any) {
  const loopStartNode =
    lf.graphModel?.getNodeModelById?.('loop-start-node') ||
    lf.graphModel?.nodes?.find(
      (node: any) =>
        `${node?.type || node?.properties?.type || ''}` === 'loop-start-node',
    );
  return typeof loopStartNode?.get_node_field_list === 'function'
    ? loopStartNode.get_node_field_list()
    : [];
}

function installNestedGraphBridge(lf: any) {
  lf.graphModel.paletteMode = 'application-loop';
  lf.graphModel.get_provide = (node: any, graph: any) => ({
    getGraph: () => graph,
    getNode: () => node,
    workflowMode: 'application-loop',
  });
  lf.graphModel.get_parent_nodes = () =>
    props.nodeModel.graphModel?.nodes || [];
  lf.graphModel.get_up_node_field_list = (
    containSelf = false,
    useCache = false,
  ) => {
    const parentFields =
      parentLoopNode()?.get_up_node_field_list?.(containSelf, useCache) || [];
    return dedupeFieldGroups([...nestedLoopStartFields(lf), ...parentFields]);
  };
  lf.graphModel.refresh_loop_fields = (fields: LoopField[]) =>
    refreshLoopFields(fields);
  lf.graphModel.set_loop_body = () => setLoopBody();
  installNestedPointBridge(lf);
}

function ensureAppEdge(edgeData: any) {
  const lf = nestedLfRef.value;
  if (!lf || !edgeData?.id || edgeData.type === 'app-edge') return;
  const nextEdge = {
    id: edgeData.id,
    properties: {
      ...edgeData.properties,
      sourceAnchorId:
        edgeData.sourceAnchorId || edgeData.properties?.sourceAnchorId,
      targetAnchorId:
        edgeData.targetAnchorId || edgeData.properties?.targetAnchorId,
    },
    sourceAnchorId:
      edgeData.sourceAnchorId || edgeData.properties?.sourceAnchorId,
    sourceNodeId: edgeData.sourceNodeId,
    targetAnchorId:
      edgeData.targetAnchorId || edgeData.properties?.targetAnchorId,
    targetNodeId: edgeData.targetNodeId,
    type: 'app-edge',
  };
  lf.deleteEdgeById?.(edgeData.id);
  lf.addEdge?.(nextEdge);
}

function rejectNestedEdge(data: any, message?: string) {
  const lf = nestedLfRef.value;
  if (!lf || !data?.id) return;
  if (typeof lf.deleteEdgeById === 'function') lf.deleteEdgeById(data.id);
  else lf.deleteElement?.(data.id);
  clearNestedSelectionState();
  if (message) ElMessage.warning(message);
  nextTick(syncFromNestedGraph);
}

function validateAndNormalizeNestedEdge(data: any) {
  const lf = nestedLfRef.value;
  if (!lf || !data?.id) return false;
  const result = validateLogicFlowEdge(lf.graphModel, data);
  if (!result.valid) {
    rejectNestedEdge(data, result.message);
    return false;
  }
  ensureAppEdge(data);
  return true;
}

function bindNestedEvents(lf: any) {
  lf.on('node:click', ({ data }: any) => selectNestedNode(`${data?.id || ''}`));
  lf.on('edge:click', ({ data }: any) => selectNestedEdge(`${data?.id || ''}`));
  lf.on('blank:click', clearNestedSelectionState);
  lf.on('edge:add', ({ data }: any) => {
    if (validateAndNormalizeNestedEdge(data)) nextTick(syncFromNestedGraph);
  });
  [
    'node:add',
    'node:drop',
    'node:delete',
    'edge:delete',
    'edge:adjust',
    'text:update',
    'node:inline-update',
  ].forEach((eventName) => {
    lf.on(eventName, () => nextTick(syncFromNestedGraph));
  });
  lf.graphModel?.eventCenter?.on?.('delete_edge', (idList: string[]) => {
    idList.forEach((id) => lf.deleteEdge?.(id));
    nextTick(syncFromNestedGraph);
  });
  lf.graphModel?.eventCenter?.on?.('anchor:drop', (data: any) => {
    data?.nodeModel?.clear_next_node_field?.(false);
  });
  lf.keyboard?.on?.(['backspace', 'delete'], () => {
    deleteSelectedBodyElement();
    return false;
  });
}

async function initNestedLogicFlow() {
  if (!canvasRef.value || nestedLfRef.value) return;
  const hasSize = await waitForElementSize(canvasRef.value);
  if (!hasSize || nestedLfRef.value) return;
  const bgColor = isDark.value ? '#1d1e1f' : '#f5f6f7';
  const gridColor = isDark.value ? '#4a4a4a' : '#DEE0E3';
  const lf = new LogicFlow({
    adjustEdge: false,
    adjustEdgeStartAndEnd: false,
    background: { backgroundColor: bgColor },
    container: canvasRef.value,
    edgeType: 'app-edge',
    grid: {
      config: { color: gridColor, thickness: 1 },
      size: 10,
      type: 'dot',
      visible: true,
    },
    history: true,
    keyboard: { enabled: true },
    snapline: true,
    textEdit: false,
  });
  installNestedGraphBridge(lf);
  registerLoopWorkflowNodes(lf);
  nestedLfRef.value = lf;
  bindNestedEvents(lf);
  await renderLoopBody();
}

watch(isDark, (dark) => {
  if (!nestedLfRef.value) return;
  const bgColor = dark ? '#1d1e1f' : '#f5f6f7';
  const gridColor = dark ? '#4a4a4a' : '#DEE0E3';
  nestedLfRef.value.graphModel.background = { backgroundColor: bgColor };
  nestedLfRef.value.graphModel.grid = {
    config: { color: gridColor, thickness: 1 },
    size: 10,
    type: 'dot',
    visible: true,
  };
});

function deleteSelectedBodyElement() {
  const lf = nestedLfRef.value;
  const selectedId = selectedBodyNodeId.value || selectedBodyEdgeId.value;
  if (!lf || !selectedId) return;
  const selectedNode = lf.getNodeModelById?.(selectedId);
  if (
    selectedNode &&
    protectedNodeTypes.has(
      `${selectedNode.type || selectedNode.properties?.type || ''}`,
    )
  ) {
    ElMessage.warning('循环开始节点不允许删除');
    return;
  }
  lf.deleteElement?.(selectedId);
  clearNestedSelectionState();
  syncFromNestedGraph();
}

function fitView() {
  const lf = nestedLfRef.value;
  if (!lf) return;
  if (typeof lf.fitView === 'function') lf.fitView();
  else lf.resetZoom?.();
}

function validate() {
  const normalized = setLoopBody();
  const validations = (nestedLfRef.value?.graphModel?.nodes || [])
    .map((node: any) => node?.validate?.())
    .filter(Boolean);
  return Promise.all(validations)
    .then(() => {
      const parentNode = parentLoopNode();
      const loopType = parentNode?.properties?.node_data?.loop_type;
      const hasBreakNode = normalized.nodes.some(
        (node) => node.type === 'loop-break-node',
      );
      if (loopType === 'LOOP' && !hasBreakNode) {
        throw Object.assign(new Error('无限循环必须配置跳出循环节点'), {
          node: parentNode || props.nodeModel,
          errMessage: '无限循环必须配置跳出循环节点',
        });
      }
      return {};
    })
    .catch((error) => {
      props.nodeModel.graphModel?.selectNodeById?.(props.nodeModel.id);
      props.nodeModel.graphModel?.transformModel?.focusOn?.(
        props.nodeModel.x,
        props.nodeModel.y,
        props.nodeModel.width,
        props.nodeModel.height,
      );
      throw error;
    });
}

function getSelectNodes(keyword: string) {
  const graph = nestedLfRef.value?.getGraphData?.() || currentLoopBody.value;
  return (graph.nodes || []).filter((node: any) =>
    `${node.properties?.stepName || node.properties?.name || node.name || ''}`.includes(
      keyword,
    ),
  );
}

function isNestedNodeEvent(event: NestedNodeTarget): event is NestedNodeEvent {
  return Object.prototype.hasOwnProperty.call(event, 'node');
}

function nestedEventNode(event: NestedNodeTarget) {
  return isNestedNodeEvent(event) ? event.node : event;
}

function nestedEventKeyword(event: NestedNodeTarget) {
  return isNestedNodeEvent(event) ? event.kw || '' : '';
}

function focusNestedNode(event: NestedNodeTarget) {
  const node = nestedEventNode(event);
  const keyword = nestedEventKeyword(event);
  if (!node?.id) return;
  nestedLfRef.value?.graphModel?.transformModel?.focusOn?.(
    node.x || 0,
    node.y || 0,
    nestedLfRef.value?.container?.clientWidth || 0,
    nestedLfRef.value?.container?.clientHeight || 0,
  );
  nestedLfRef.value?.graphModel
    ?.getNodeModelById?.(node.id)
    ?.focusOn?.(keyword);
}

function selectNestedNodeByEvent(event: NestedNodeTarget) {
  const node = nestedEventNode(event);
  const keyword = nestedEventKeyword(event);
  if (!node?.id) return;
  nestedLfRef.value?.graphModel
    ?.getNodeModelById?.(node.id)
    ?.selectOn?.(keyword);
}

function clearNestedNodeByEvent(event: NestedNodeTarget) {
  const node = nestedEventNode(event);
  const keyword = nestedEventKeyword(event);
  if (!node?.id) return;
  nestedLfRef.value?.graphModel
    ?.getNodeModelById?.(node.id)
    ?.clearSelectOn?.(keyword);
}

onMounted(() => {
  syncBodyNodeWorkflow(currentLoopBody.value);
  set(props.nodeModel, 'validate', validate);
  set(props.nodeModel, 'set_loop_body', setLoopBody);
  set(props.nodeModel, 'refresh_loop_fields', refreshLoopFields);
  set(props.nodeModel, 'loopLayout', () => {
    loopBodyContainerRef.value?.zoom();
    queueFitView(0);
  });
  set(props.nodeModel, 'getSelectNodes', getSelectNodes);
  set(props.nodeModel, 'focusOn', focusNestedNode);
  set(props.nodeModel, 'selectOn', selectNestedNodeByEvent);
  set(props.nodeModel, 'clearSelectOn', clearNestedNodeByEvent);
  set(props.nodeModel, 'clearSelectElements', () =>
    nestedLfRef.value?.graphModel?.clearSelectElements?.(),
  );
  nextTick(initNestedLogicFlow);
});

onBeforeUnmount(() => {
  window.clearTimeout(fitTimer);
  setLoopBody();
  const lf = nestedLfRef.value;
  const flowId = lf?.graphModel?.flowId;
  if (lf) {
    (lf as any).clearThemeMode = () => {};
    lf.destroy?.();
  }
  if (flowId) disconnectByFlow(flowId);
  nestedLfRef.value = undefined;
});
</script>

<template>
  <LoopBodyContainer ref="loopBodyContainerRef" :node-model="nodeModel">
    <div
      ref="canvasRef"
      class="workflow-loop-body-node__canvas"
      @wheel.stop
    ></div>
  </LoopBodyContainer>
</template>

<style scoped lang="scss">
.workflow-loop-body-node__canvas {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.workflow-loop-body-node__canvas :deep(.lf-canvas-overlay),
.workflow-loop-body-node__canvas :deep(.lf-html-overlay) {
  overflow: hidden !important;
}

.workflow-loop-body-node__canvas :deep(.el-select__popper),
.workflow-loop-body-node__canvas :deep(.el-cascader__dropdown) {
  z-index: calc(var(--el-z-index-popper) + 30);
}
</style>
