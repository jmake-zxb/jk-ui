<script setup lang="ts">
import type {
  NodeTemplate,
  PaletteMode,
  WorkflowEdge,
  WorkflowFoundationMode,
  WorkflowGraphData,
  WorkflowNode,
} from './nodes';
import type { ValidationState } from './validation';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue';

import { Search } from '@element-plus/icons-vue';
import LogicFlow from '@logicflow/core';
import {
  ElButton,
  ElCollapseTransition,
  ElEmpty,
  ElIcon,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElPopover,
  ElScrollbar,
  ElTabPane,
  ElTabs,
  ElTag,
} from 'element-plus';
import { cloneDeep } from 'lodash-es';

import { prettyJson, safeParseJson } from '../../utils';
import { validateLogicFlowEdge } from './common/connection-validation';
import DesignerCanvasControl from './common/DesignerCanvasControl.vue';
import DesignerNodeSearch from './common/DesignerNodeSearch.vue';
import {
  fromLogicFlowGraph,
  normalizeGraphData,
  toLogicFlowGraph,
} from './graph-data';
import {
  cloneValue,
  DEFAULT_GRAPH_DATA,
  DEFAULT_TOOL_GRAPH_DATA,
  defaultProperties,
  groupedNodeTemplates,
  isProtectedWorkflowActionNode,
  isWorkflowSingletonNode,
  normalizeProperties,
} from './nodes';
import { syncStartNodeConfigFromBaseNode } from './nodes/start-node/start-node-utils';
import { registerWorkflowNodes } from './register';
import { validateWorkflow } from './validation';

import '@logicflow/core/dist/index.css';

const props = withDefaults(
  defineProps<{
    foundationMode?: WorkflowFoundationMode;
    paletteMode?: PaletteMode;
  }>(),
  {
    foundationMode: 'application',
    paletteMode: 'application',
  },
);
const emit = defineEmits<{
  debug: [];
  localValidationChange: [value: ValidationState];
  rawDebug: [];
}>();
const workflowGraphData = defineModel<string>('graphData', {
  default: DEFAULT_GRAPH_DATA,
});
const localValidation = ref<ValidationState>({ errors: [], warnings: [] });
const canvasRef = ref<HTMLDivElement>();
const lfRef = shallowRef<any>();
const canvasDragMode = ref(true);
const selectedNode = ref<WorkflowNode>();
const selectedEdge = ref<WorkflowEdge>();
const selectedNodeDataForm = ref<Record<string, any>>({});
const graphReady = ref(false);
let copiedGraphData: any;
let unbindCanvasMouse: (() => void) | undefined;
let unbindDocumentPaste: (() => void) | undefined;
let persistingLoopBodies = false;
const lastCanvasMouse = { hasValue: false, x: 0, y: 0 };
const canvasMeasureFrames = 30;
const basicQaChainIds = [
  'start-node',
  'search-knowledge-node',
  'ai-chat-node',
  'reply-node',
] as const;
const basicQaChainPrompt =
  '请根据用户问题和知识库检索结果回答。\n\n用户问题：{{start-node.question}}\n\n知识库检索结果：\n{{search-knowledge-node.data}}\n\n如果检索结果不足以回答，请说明无法从现有知识中确认。';

const activeFoundationMode = computed<WorkflowFoundationMode>(() =>
  props.foundationMode === 'tool' ? 'tool' : 'application',
);
const activePaletteMode = computed<PaletteMode>(
  () =>
    props.paletteMode ||
    (activeFoundationMode.value === 'tool' ? 'tool' : 'application'),
);
const defaultGraphData = computed(() =>
  activeFoundationMode.value === 'tool'
    ? DEFAULT_TOOL_GRAPH_DATA
    : DEFAULT_GRAPH_DATA,
);
const fallbackNodeType = computed(() =>
  activeFoundationMode.value === 'tool' ? 'tool-base-node' : 'base-node',
);

const nodeMenuTabs = [
  { categories: ['业务逻辑'], label: '基础组件', name: 'base' },
  { categories: ['AI能力'], label: 'AI能力', name: 'ai' },
  { categories: ['知识库'], label: '知识库', name: 'knowledge' },
  { categories: ['工具/其他'], label: '工具应用', name: 'tool' },
  { categories: ['数据处理', '数据源'], label: '数据处理', name: 'data' },
];
const canvasAddMenuOpen = ref(false);
const activeCanvasMenuTab = ref('base');
const canvasMenuSearchKeyword = ref('');
const groupedPalette = computed(() =>
  groupedNodeTemplates(activePaletteMode.value),
);
const canvasTabbedMenuGroups = computed(() => {
  const keyword = canvasMenuSearchKeyword.value.trim().toLowerCase();
  return nodeMenuTabs.map((tab) => {
    const groups = groupedPalette.value
      .filter((group) => tab.categories.includes(group.name))
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (isWorkflowSingletonNode(item.type)) return false;
          if (!keyword) return true;
          return `${item.name} ${item.type} ${item.description}`
            .toLowerCase()
            .includes(keyword);
        }),
      }))
      .filter((group) => group.items.length > 0);
    return { ...tab, groups };
  });
});
const activeCanvasMenuGroups = computed(
  () =>
    canvasTabbedMenuGroups.value.find(
      (tab) => tab.name === activeCanvasMenuTab.value,
    )?.groups || [],
);
const parsedGraphData = computed<WorkflowGraphData>(() =>
  normalizeGraphData(
    safeParseJson(workflowGraphData.value, {}),
    true,
    true,
    activeFoundationMode.value,
  ),
);
const localValidationTotal = computed(
  () =>
    localValidation.value.errors.length + localValidation.value.warnings.length,
);
const localValidationPreview = computed(() => {
  const items = [
    ...localValidation.value.errors.map((message) => ({
      message,
      type: 'error',
    })),
    ...localValidation.value.warnings.map((message) => ({
      message,
      type: 'warning',
    })),
  ];
  return items.slice(0, 6);
});
const localValidationHiddenCount = computed(() =>
  Math.max(0, localValidationTotal.value - localValidationPreview.value.length),
);
const canRepairBasicQaChain = computed(() => {
  if (activeFoundationMode.value !== 'application') return false;
  const nodeIds = new Set(parsedGraphData.value.nodes.map((node) => node.id));
  return basicQaChainIds.every((id) => nodeIds.has(id));
});

function resetSelectionForms() {
  selectedNodeDataForm.value = {};
}

function clearSelectionState() {
  selectedNode.value = undefined;
  selectedEdge.value = undefined;
  resetSelectionForms();
}

function persistTransientLoopBodies(lf: any) {
  persistingLoopBodies = true;
  try {
    lf?.graphModel?.nodes?.forEach((node: any) => {
      if (
        node.type === 'loop-body-node' &&
        typeof node.set_loop_body === 'function'
      ) {
        node.set_loop_body();
      }
    });
  } finally {
    persistingLoopBodies = false;
  }
}

function syncGraphData() {
  const lf = lfRef.value;
  if (!lf) return;
  if (activeFoundationMode.value === 'application') {
    syncStartNodeConfigFromBaseNode(lf.getNodeModelById?.('start-node'));
  }
  persistTransientLoopBodies(lf);
  workflowGraphData.value = prettyJson(
    fromLogicFlowGraph(
      lf.getGraphData(),
      parsedGraphData.value,
      activeFoundationMode.value,
    ),
  );
}

function getGraphData() {
  syncGraphData();
  return workflowGraphData.value;
}

function hasText(value: any) {
  return value !== undefined && value !== null && `${value}`.trim() !== '';
}

function hasReference(value: any) {
  return Array.isArray(value) && value.some((item) => hasText(item));
}

function isPlainObject(value: any) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function primitiveTextToString(value: unknown) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return '';
}

function isPrimitiveText(value: unknown) {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function textValueToString(value: unknown) {
  if (isPrimitiveText(value)) return primitiveTextToString(value);
  if (!isPlainObject(value)) return '';
  const source = value as Record<string, unknown>;
  if (isPrimitiveText(source.value)) return primitiveTextToString(source.value);
  if (isPrimitiveText(source.text)) return primitiveTextToString(source.text);
  if (isPrimitiveText(source.label)) return primitiveTextToString(source.label);
  return '';
}

function createBasicQaEdge(
  source: string,
  target: string,
  suffix = Date.now(),
) {
  return {
    id: `edge_${source}_${target}_${suffix}`,
    source,
    sourceAnchorId: `${source}_right`,
    target,
    targetAnchorId: `${target}_left`,
    type: 'app-edge',
  };
}

function patchNodeData(
  graphData: WorkflowGraphData,
  nodeId: string,
  patcher: (nodeData: Record<string, any>) => Record<string, any>,
) {
  const node = graphData.nodes.find((item) => item.id === nodeId);
  if (!node) return;
  const properties = normalizeProperties(
    node.properties || {},
    node.type,
    node.name,
  );
  node.properties = {
    ...properties,
    node_data: patcher(cloneValue(properties.node_data || {})),
  };
}

function repairBasicQaGraphData(graphData: WorkflowGraphData) {
  const repaired = normalizeGraphData(
    cloneValue(graphData),
    true,
    true,
    'application',
  );
  const existingEdgeByPair = new Map(
    repaired.edges.map((edge) => [`${edge.source}->${edge.target}`, edge]),
  );
  const requiredPairs = [
    ['start-node', 'search-knowledge-node'],
    ['search-knowledge-node', 'ai-chat-node'],
    ['ai-chat-node', 'reply-node'],
  ];

  requiredPairs.forEach(([source, target], index) => {
    const key = `${source}->${target}`;
    const edge = existingEdgeByPair.get(key);
    if (edge) {
      edge.sourceAnchorId = `${source}_right`;
      edge.targetAnchorId = `${target}_left`;
      edge.type = 'app-edge';
      return;
    }
    repaired.edges.push(createBasicQaEdge(source!, target!, index));
  });

  patchNodeData(repaired, 'start-node', (nodeData) => ({
    ...nodeData,
    question: hasText(nodeData.question) ? nodeData.question : '{{input}}',
  }));

  patchNodeData(repaired, 'search-knowledge-node', (nodeData) => {
    const setting = isPlainObject(nodeData.knowledge_setting)
      ? { ...nodeData.knowledge_setting }
      : {};
    return {
      ...nodeData,
      knowledge_setting: {
        ...setting,
        max_paragraph_char_number: hasText(setting.max_paragraph_char_number)
          ? setting.max_paragraph_char_number
          : 5000,
        search_mode: hasText(setting.search_mode)
          ? setting.search_mode
          : 'embedding',
        similarity: hasText(setting.similarity) ? setting.similarity : 0.6,
        top_n: hasText(setting.top_n) ? setting.top_n : 3,
      },
      question_reference_address: hasReference(
        nodeData.question_reference_address,
      )
        ? nodeData.question_reference_address
        : ['start-node', 'question'],
      search_scope_reference: Array.isArray(nodeData.search_scope_reference)
        ? nodeData.search_scope_reference
        : [],
      search_scope_source: hasText(nodeData.search_scope_source)
        ? nodeData.search_scope_source
        : 'knowledge',
      search_scope_type: hasText(nodeData.search_scope_type)
        ? nodeData.search_scope_type
        : 'custom',
      show_knowledge:
        nodeData.show_knowledge === undefined ? false : nodeData.show_knowledge,
    };
  });

  patchNodeData(repaired, 'ai-chat-node', (nodeData) => ({
    ...nodeData,
    prompt: hasText(nodeData.prompt) ? nodeData.prompt : basicQaChainPrompt,
  }));

  patchNodeData(repaired, 'reply-node', (nodeData) => {
    if (nodeData.reply_type !== 'referencing' && hasText(nodeData.content)) {
      return nodeData;
    }
    return {
      ...nodeData,
      fields: hasReference(nodeData.fields)
        ? nodeData.fields
        : ['ai-chat-node', 'answer'],
      reply_type: 'referencing',
    };
  });

  return repaired;
}

async function repairBasicQaChain() {
  if (activeFoundationMode.value !== 'application') return;
  syncGraphData();
  const graphData = normalizeGraphData(
    safeParseJson(workflowGraphData.value, {}),
    true,
    true,
    'application',
  );
  const nodeIds = new Set(graphData.nodes.map((node) => node.id));
  if (!basicQaChainIds.every((id) => nodeIds.has(id))) {
    ElMessage.warning('未检测到完整的基础问答节点');
    return;
  }
  workflowGraphData.value = prettyJson(repairBasicQaGraphData(graphData));
  await renderGraphData(undefined, true);
  const passed = runLocalValidation(false);
  ElMessage.success(
    passed ? '已补齐基础问答链路' : '已补齐基础问答链路，请继续配置剩余必填项',
  );
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitForElementSize(
  element: HTMLElement | undefined,
  maxFrames = canvasMeasureFrames,
) {
  if (!element) return false;
  for (let index = 0; index < maxFrames; index += 1) {
    const { height, width } = element.getBoundingClientRect();
    if (width > 0 && height > 0) return true;
    await nextFrame();
  }
  return false;
}

function getNodeMeasureSignature() {
  const nodes = lfRef.value?.graphModel?.nodes || [];
  return nodes
    .map(
      (node: any) =>
        `${node.id}:${Math.round(node.width || 0)}x${Math.round(node.height || 0)}`,
    )
    .join('|');
}

function refreshNodeConnections() {
  lfRef.value?.graphModel?.nodes?.forEach((node: any) => {
    node.refreshAnchors?.();
    node.refreshConnectedEdges?.();
  });
}

async function waitForNodeMeasure(maxFrames = 30) {
  await nextTick();
  let lastSignature = '';
  let stableFrames = 0;
  for (let index = 0; index < maxFrames; index += 1) {
    await nextFrame();
    refreshNodeConnections();
    const signature = getNodeMeasureSignature();
    if (signature && signature === lastSignature) stableFrames += 1;
    else stableFrames = 0;
    lastSignature = signature;
    if (index >= 8 && stableFrames >= 3) break;
  }
  refreshNodeConnections();
}

async function fitViewAfterNodeMeasure() {
  await waitForNodeMeasure();
  fitView();
}

function refreshRenderedNodeComponents() {
  lfRef.value?.graphModel?.nodes?.forEach((node: any) => {
    node.ensureWorkflowProperties?.();
    node.refreshVueComponent?.();
  });
}

async function renderGraphData(data?: string, fit = true) {
  if (data !== undefined) {
    workflowGraphData.value = prettyJson(
      normalizeGraphData(
        safeParseJson(data, {}),
        true,
        true,
        activeFoundationMode.value,
      ),
      defaultGraphData.value,
    );
  }
  const lf = lfRef.value;
  if (!lf) return;
  const hasSize = await waitForElementSize(canvasRef.value);
  if (!hasSize) return;
  lf.render(toLogicFlowGraph(parsedGraphData.value));
  refreshRenderedNodeComponents();
  clearSelectionState();
  if (fit) nextTick(() => fitViewAfterNodeMeasure());
}

function selectNode(data: any) {
  const backendType =
    data?.properties?.backendType ||
    data?.properties?.type ||
    fallbackNodeType.value;
  const nodeText = textValueToString(data?.text);
  const properties = normalizeProperties(
    data?.properties || {},
    backendType,
    nodeText || undefined,
  );
  const selectedName = textValueToString(
    properties.stepName || properties.name,
  );
  selectedNode.value = {
    id: `${data.id}`,
    type: backendType,
    x: data.x,
    y: data.y,
    name: selectedName,
    properties,
  };
  selectedEdge.value = undefined;
  selectedNodeDataForm.value = cloneValue(properties.node_data || {});
}

function selectEdge(data: any) {
  selectedEdge.value = {
    id: `${data.id}`,
    source: `${data.sourceNodeId || ''}`,
    sourceAnchorId: data.sourceAnchorId || data.properties?.sourceAnchorId,
    target: `${data.targetNodeId || ''}`,
    targetAnchorId: data.targetAnchorId || data.properties?.targetAnchorId,
    type: data.type || 'polyline',
  };
  selectedNode.value = undefined;
  resetSelectionForms();
}

function focusNodeModel(id: string) {
  if (!id) return;
  lfRef.value?.toFront?.(id);
}

function selectNodeAndFocus(data: any) {
  selectNode(data);
  focusNodeModel(`${data?.id || ''}`);
}

function selectNodeById(id: string) {
  const nodeModel = lfRef.value?.getNodeModelById?.(id);
  if (!nodeModel) return;
  selectNode({
    id: nodeModel.id,
    properties: nodeModel.properties,
    text: nodeModel.text,
    x: nodeModel.x,
    y: nodeModel.y,
  });
  focusNodeModel(id);
}

function rejectEdge(data: any, message?: string) {
  const lf = lfRef.value;
  if (!lf || !data?.id) return;
  if (typeof lf.deleteEdgeById === 'function') lf.deleteEdgeById(data.id);
  else lf.deleteElement?.(data.id);
  clearSelectionState();
  if (message) ElMessage.warning(message);
  nextTick(syncGraphData);
}

function validateAndNormalizeEdge(data: any) {
  const lf = lfRef.value;
  if (!lf || !data?.id) return false;
  const result = validateLogicFlowEdge(lf.graphModel, data);
  if (!result.valid) {
    rejectEdge(data, result.message);
    return false;
  }
  ensureLoopEdgeType(data);
  return true;
}

function bindLogicFlowEvents(lf: any) {
  lf.on('node:click', ({ data }: any) => selectNodeAndFocus(data));
  lf.on('edge:click', ({ data }: any) => selectEdge(data));
  lf.on('blank:click', clearSelectionState);
  lf.on('edge:add', ({ data }: any) => {
    if (validateAndNormalizeEdge(data)) nextTick(syncGraphData);
  });
  [
    'node:drop',
    'node:delete',
    'edge:delete',
    'edge:adjust',
    'text:update',
  ].forEach((eventName) => {
    lf.on(eventName, () => nextTick(syncGraphData));
  });
  lf.on('node:inline-update', ({ id }: any) => {
    if (persistingLoopBodies) return;
    nextTick(() => {
      syncGraphData();
      const nodeModel = lf.getNodeModelById?.(id);
      if (nodeModel && selectedNode.value?.id === id) {
        selectNode({
          id: nodeModel.id,
          properties: nodeModel.properties,
          text: nodeModel.text,
          x: nodeModel.x,
          y: nodeModel.y,
        });
      }
    });
  });
}

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tagName = element.tagName?.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    element.isContentEditable
  );
}

function getSelectedElements(includeEdge = true) {
  const lf = lfRef.value;
  const graph = lf?.graphModel;
  const selected = graph?.getSelectElements?.(includeEdge);
  return {
    edges: selected?.edges || [],
    nodes: selected?.nodes || [],
  };
}

function bindCanvasShortcuts(lf: any) {
  const updateMouse = (event: MouseEvent) => {
    lastCanvasMouse.x = event.clientX;
    lastCanvasMouse.y = event.clientY;
    lastCanvasMouse.hasValue = true;
  };
  lf.container?.addEventListener?.('mousemove', updateMouse);
  lf.container?.addEventListener?.('mousedown', () => lf.container?.focus?.());
  unbindCanvasMouse = () =>
    lf.container?.removeEventListener?.('mousemove', updateMouse);

  const pasteHandler = (event: ClipboardEvent) => {
    if (isEditableTarget(event.target)) return;
    const text = event.clipboardData?.getData('text/plain') || '';
    if (!text.trim()) return;
    const pasted = pasteGraphData(text);
    if (pasted) event.preventDefault();
  };
  document.addEventListener('paste', pasteHandler);
  unbindDocumentPaste = () =>
    document.removeEventListener('paste', pasteHandler);

  lf.keyboard?.on?.(['cmd + c', 'ctrl + c'], () => copySelectedGraphData());
  lf.keyboard?.on?.(['backspace', 'delete'], () => {
    deleteSelected();
    return false;
  });
  lf.keyboard?.on?.(['cmd + v', 'ctrl + v'], () => false);
}

function cloneGraphSelection(elements: { edges: any[]; nodes: any[] }) {
  return cloneDeep(elements);
}

function rewritePastedIds(data: any) {
  const idMap = new Map<string, string>();
  const nextId = (id: string) => {
    if (!idMap.has(id)) idMap.set(id, `${id}_copy_${Date.now()}_${idMap.size}`);
    return idMap.get(id)!;
  };
  data.nodes?.forEach((node: any) => {
    const oldId = `${node.id}`;
    node.id = nextId(oldId);
    if (node.properties?.stepName)
      node.properties.stepName = `${node.properties.stepName} 副本`;
  });
  data.edges?.forEach((edge: any) => {
    const oldSource = `${edge.sourceNodeId || edge.source || ''}`;
    const oldTarget = `${edge.targetNodeId || edge.target || ''}`;
    edge.id = nextId(`${edge.id || `edge_${oldSource}_${oldTarget}`}`);
    edge.sourceNodeId = nextId(oldSource);
    edge.targetNodeId = nextId(oldTarget);
    if (edge.sourceAnchorId)
      edge.sourceAnchorId = `${edge.sourceAnchorId}`.replace(
        oldSource,
        edge.sourceNodeId,
      );
    if (edge.targetAnchorId)
      edge.targetAnchorId = `${edge.targetAnchorId}`.replace(
        oldTarget,
        edge.targetNodeId,
      );
    edge.properties = {
      ...edge.properties,
      sourceAnchorId: edge.sourceAnchorId,
      targetAnchorId: edge.targetAnchorId,
    };
  });
  return data;
}

function movePastedDataToMouse(data: any) {
  const nodes = data.nodes || [];
  if (nodes.length === 0) return data;
  const bounds = {
    maxX: Number(nodes[0]?.x || 0),
    maxY: Number(nodes[0]?.y || 0),
    minX: Number(nodes[0]?.x || 0),
    minY: Number(nodes[0]?.y || 0),
  };
  nodes.forEach((node: any) => {
    const x = Number(node.x || 0);
    const y = Number(node.y || 0);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
  });
  let targetX = (bounds.minX + bounds.maxX) / 2 + 40;
  let targetY = (bounds.minY + bounds.maxY) / 2 + 40;
  if (lastCanvasMouse.hasValue) {
    const point = lfRef.value?.graphModel?.getPointByClient?.({
      x: lastCanvasMouse.x,
      y: lastCanvasMouse.y,
    });
    targetX = point?.canvasOverlayPosition?.x || targetX;
    targetY = point?.canvasOverlayPosition?.y || targetY;
  }
  const offsetX = targetX - (bounds.minX + bounds.maxX) / 2;
  const offsetY = targetY - (bounds.minY + bounds.maxY) / 2;
  data.nodes?.forEach((node: any) => {
    node.x = Number(node.x || 0) + offsetX;
    node.y = Number(node.y || 0) + offsetY;
  });
  data.edges?.forEach((edge: any) => {
    ['startPoint', 'endPoint', 'text'].forEach((field) => {
      if (edge[field]) {
        edge[field].x += offsetX;
        edge[field].y += offsetY;
      }
    });
    if (Array.isArray(edge.pointsList))
      edge.pointsList = edge.pointsList.map((point: any) => ({
        ...point,
        x: point.x + offsetX,
        y: point.y + offsetY,
      }));
  });
  return data;
}

function copySelectedGraphData() {
  if (isEditableTarget(document.activeElement)) return true;
  const elements = getSelectedElements(true);
  if (elements.nodes.length === 0 && elements.edges.length === 0) return true;
  const blocked = elements.nodes.find((node: any) =>
    isProtectedWorkflowActionNode(node.type),
  );
  if (blocked) {
    ElMessage.warning(
      `${blocked.properties?.stepName || blocked.id} 不允许复制`,
    );
    return false;
  }
  copiedGraphData = cloneGraphSelection(elements);
  navigator.clipboard?.writeText(JSON.stringify(copiedGraphData));
  ElMessage.success('已复制选中节点');
  return false;
}

function pasteGraphData(text?: string) {
  const lf = lfRef.value;
  if (!lf) return false;
  const sourceText = text || JSON.stringify(copiedGraphData || {});
  const source = safeParseJson(sourceText, undefined);
  if (!source || !Array.isArray(source.nodes) || !Array.isArray(source.edges))
    return false;
  const blocked = source.nodes.find((node: any) =>
    isProtectedWorkflowActionNode(node?.type || node?.properties?.type),
  );
  if (blocked) {
    ElMessage.warning(
      `${blocked.properties?.stepName || blocked.id} 不允许复制`,
    );
    return false;
  }
  const data = movePastedDataToMouse(
    rewritePastedIds(cloneGraphSelection(source)),
  );
  lf.clearSelectElements?.();
  if (typeof lf.addElements === 'function') {
    lf.addElements(data);
  } else {
    data.nodes.forEach((node: any) => lf.addNode?.(node));
    data.edges.forEach((edge: any) => lf.addEdge?.(edge));
  }
  data.nodes.forEach((node: any) => lf.selectElementById?.(node.id, true));
  data.edges.forEach((edge: any) => lf.selectElementById?.(edge.id, true));
  clearSelectionState();
  syncGraphData();
  ElMessage.success('已粘贴到画布');
  return true;
}

function isLoopChildConnection(
  sourceAnchorId?: string,
  targetAnchorId?: string,
  sourceType?: string,
  targetType?: string,
) {
  return (
    sourceAnchorId?.endsWith('_children') ||
    targetAnchorId?.endsWith('_children') ||
    (sourceType === 'loop-node' && targetType === 'loop-body-node')
  );
}

function edgeTypeForConnection(
  sourceAnchorId?: string,
  targetAnchorId?: string,
  sourceType?: string,
  targetType?: string,
) {
  return isLoopChildConnection(
    sourceAnchorId,
    targetAnchorId,
    sourceType,
    targetType,
  )
    ? 'loop-edge'
    : 'app-edge';
}

function ensureLoopEdgeType(edgeData: any) {
  const lf = lfRef.value;
  if (!lf || !edgeData?.id) return;
  const sourceNode = lf.getNodeModelById?.(edgeData.sourceNodeId);
  const targetNode = lf.getNodeModelById?.(edgeData.targetNodeId);
  const edgeType = edgeTypeForConnection(
    edgeData.sourceAnchorId || edgeData.properties?.sourceAnchorId,
    edgeData.targetAnchorId || edgeData.properties?.targetAnchorId,
    sourceNode?.type,
    targetNode?.type,
  );
  if (edgeData.type === edgeType) return;
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
    type: edgeType,
  };
  lf.deleteEdgeById?.(edgeData.id);
  lf.addEdge?.(nextEdge);
}

async function initLogicFlow() {
  if (!canvasRef.value || lfRef.value) return;
  const hasSize = await waitForElementSize(canvasRef.value);
  if (!hasSize || lfRef.value) return;
  const lf = new LogicFlow({
    adjustEdge: false,
    adjustEdgeStartAndEnd: false,
    container: canvasRef.value,
    background: { backgroundColor: '#f5f6f7' },
    edgeType: 'app-edge',
    grid: {
      config: { color: '#DEE0E3', thickness: 1 },
      size: 10,
      type: 'dot',
      visible: true,
    },
    history: true,
    keyboard: { enabled: true },
    snapline: true,
    textEdit: false,
  });
  registerWorkflowNodes(lf);
  lf.graphModel.paletteMode = activePaletteMode.value;
  lfRef.value = lf;
  bindLogicFlowEvents(lf);
  bindCanvasShortcuts(lf);
  graphReady.value = true;
  await renderGraphData(undefined, false);
}

function createNode(item: NodeTemplate, x: number, y: number) {
  const existing = parsedGraphData.value.nodes.some(
    (node) => node.id === item.type,
  );
  const id =
    isWorkflowSingletonNode(item.type) && !existing
      ? item.type
      : `${item.type}_${Date.now()}`;
  return {
    id,
    type: item.type,
    x,
    y,
    properties: defaultProperties(item.type, item.name),
  };
}

function addNode(item: NodeTemplate) {
  if (isWorkflowSingletonNode(item.type)) {
    ElMessage.warning('基础节点不支持重复添加');
    canvasAddMenuOpen.value = false;
    canvasMenuSearchKeyword.value = '';
    return;
  }
  const lf = lfRef.value;
  if (!lf) return;
  lf.clearSelectElements?.();
  const virtualRect = lf.graphModel?.getVirtualRectSize?.();
  const x = virtualRect?.virtualRectCenterPositionX || 320;
  const y = virtualRect
    ? virtualRect.virtualRectCenterPositionY - lf.graphModel.height / 2
    : 180;
  const node = createNode(item, x, y);
  const graphNode = lf.addNode(
    toLogicFlowGraph({ edges: [], nodes: [node] }).nodes?.[0],
  );
  if (graphNode?.id) {
    lf.selectElementById?.(graphNode.id, true);
    lf.toFront?.(graphNode.id);
  }
  canvasAddMenuOpen.value = false;
  canvasMenuSearchKeyword.value = '';
  syncGraphData();
}

async function confirmDeleteSelection(nodeCount: number, edgeCount: number) {
  const summary =
    nodeCount > 0
      ? `确认删除选中的 ${nodeCount} 个节点${edgeCount > 0 ? `和 ${edgeCount} 条连线` : ''}？`
      : `确认删除选中的 ${edgeCount} 条连线？`;
  try {
    await ElMessageBox.confirm(summary, '删除确认', {
      cancelButtonText: '取消',
      confirmButtonText: '删除',
      type: 'warning',
    });
    return true;
  } catch {
    return false;
  }
}

async function deleteSelected() {
  const lf = lfRef.value;
  if (!lf) return;
  const elements = getSelectedElements(true);
  if (elements.nodes.length > 0 || elements.edges.length > 0) {
    const blockedNode = elements.nodes.find((node: any) =>
      isProtectedWorkflowActionNode(node.type),
    );
    if (blockedNode) {
      ElMessage.warning('基础节点不允许在主画布删除');
      return false;
    }
    const blockedEdge = elements.edges.find(
      (edge: any) => edge.type === 'loop-edge',
    );
    if (blockedEdge) {
      ElMessage.warning('循环体连线不允许在主画布删除');
      return false;
    }
    const confirmed = await confirmDeleteSelection(
      elements.nodes.length,
      elements.edges.length,
    );
    if (!confirmed) return false;
    lf.clearSelectElements?.();
    elements.edges.forEach(
      (edge: any) => lf.deleteElement?.(edge.id) || lf.deleteEdge?.(edge.id),
    );
    elements.nodes.forEach(
      (node: any) => lf.deleteElement?.(node.id) || lf.deleteNode?.(node.id),
    );
    clearSelectionState();
    syncGraphData();
    return false;
  }
  const id = selectedNode.value?.id || selectedEdge.value?.id;
  if (!id) {
    ElMessage.warning('请选择节点或连线');
    return true;
  }
  if (
    selectedNode.value &&
    isProtectedWorkflowActionNode(selectedNode.value.type)
  ) {
    ElMessage.warning('基础节点不允许在主画布删除');
    return false;
  }
  if (selectedEdge.value?.type === 'loop-edge') {
    ElMessage.warning('循环体连线不允许在主画布删除');
    return false;
  }
  const confirmed = await confirmDeleteSelection(
    selectedNode.value ? 1 : 0,
    selectedEdge.value ? 1 : 0,
  );
  if (!confirmed) return false;
  lf.deleteElement(id);
  clearSelectionState();
  syncGraphData();
  return false;
}

function fitView() {
  const lf = lfRef.value;
  if (!lf) return;
  if (typeof lf.fitView === 'function') lf.fitView(40, 40);
  else lf.resetZoom();
  const scale = Number(lf.graphModel?.transformModel?.SCALE_X || 1);
  if (scale > 1) {
    lf.resetZoom();
    lf.translateCenter?.();
  }
}

function zoomCanvas(zoomIn: boolean) {
  lfRef.value?.zoom?.(zoomIn, [0, 0]);
}

function resetView() {
  const lf = lfRef.value;
  if (!lf) return;
  lf.resetZoom();
  lf.translateCenter?.();
}

function toggleCanvasDragMode(value: boolean) {
  const lf = lfRef.value;
  canvasDragMode.value = value;
  const container = lf?.container as HTMLElement | undefined;
  if (container) container.style.cursor = value ? 'default' : 'grab';
  if (value) lf?.openSelectionSelect?.();
  else lf?.closeSelectionSelect?.();
}

function setAllNodeCollapsed(collapsed: boolean) {
  const lf = lfRef.value;
  if (!lf) return;
  lf.graphModel?.nodes?.forEach((node: any) => {
    if (typeof node.setCollapsed === 'function') node.setCollapsed(collapsed);
    else node.setProperties?.({ ...node.properties, showNode: !collapsed });
  });
  syncGraphData();
}

function layoutWorkflowGraphData(graphData: WorkflowGraphData) {
  const nodes = graphData.nodes;
  if (nodes.length === 0) return graphData;
  const nodeIds = new Set(nodes.map((node) => node.id));
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  nodes.forEach((node) => {
    outgoing.set(node.id, []);
    indegree.set(node.id, 0);
  });
  graphData.edges.forEach((edge) => {
    if (
      !edge.source ||
      !edge.target ||
      !nodeIds.has(edge.source) ||
      !nodeIds.has(edge.target)
    )
      return;
    outgoing.get(edge.source)?.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1);
  });

  const preferredRoots = nodes
    .filter((node) =>
      [
        'base-node',
        'knowledge-base-node',
        'start-node',
        'tool-start-node',
      ].includes(node.type),
    )
    .map((node) => node.id);
  const zeroIndegree = nodes
    .filter(
      (node) =>
        (indegree.get(node.id) || 0) === 0 && !preferredRoots.includes(node.id),
    )
    .toSorted(
      (left, right) =>
        (left.y || 0) - (right.y || 0) || (left.x || 0) - (right.x || 0),
    )
    .map((node) => node.id);
  const queue = [...preferredRoots, ...zeroIndegree].filter(
    (id, index, source) => source.indexOf(id) === index,
  );
  const layerById = new Map<string, number>();
  queue.forEach((id) => layerById.set(id, 0));

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor]!;
    const nextLayer = (layerById.get(id) || 0) + 1;
    (outgoing.get(id) || []).forEach((target) => {
      const current = layerById.get(target);
      if (current === undefined || nextLayer > current)
        layerById.set(target, nextLayer);
      indegree.set(target, Math.max(0, (indegree.get(target) || 0) - 1));
      if ((indegree.get(target) || 0) === 0 && !queue.includes(target))
        queue.push(target);
    });
  }

  nodes.forEach((node) => {
    if (layerById.has(node.id)) return;
    const incomingLayers = graphData.edges
      .filter(
        (edge) =>
          edge.target === node.id && edge.source && layerById.has(edge.source),
      )
      .map((edge) => layerById.get(edge.source!) || 0);
    layerById.set(
      node.id,
      incomingLayers.length > 0 ? Math.max(...incomingLayers) + 1 : 0,
    );
  });

  const layers = new Map<number, WorkflowNode[]>();
  nodes.forEach((node) => {
    const layer = layerById.get(node.id) || 0;
    const layerNodes = layers.get(layer) || [];
    layerNodes.push(node);
    layers.set(layer, layerNodes);
  });

  const arrangedNodes = new Map<string, WorkflowNode>();
  [...layers.entries()].forEach(([layer, layerNodes]) => {
    layerNodes
      .toSorted((left, right) => {
        const parentY = (nodeId: string) => {
          const parents = graphData.edges.filter(
            (edge) =>
              edge.target === nodeId &&
              edge.source &&
              arrangedNodes.has(edge.source),
          );
          if (parents.length === 0) return 0;
          let parentYTotal = 0;
          parents.forEach((edge) => {
            if (edge.source)
              parentYTotal += arrangedNodes.get(edge.source)?.y || 0;
          });
          return parentYTotal / parents.length;
        };
        return (
          parentY(left.id) - parentY(right.id) ||
          (left.y || 0) - (right.y || 0) ||
          (left.x || 0) - (right.x || 0)
        );
      })
      .forEach((node, index) => {
        arrangedNodes.set(node.id, {
          ...node,
          x: 180 + layer * 420,
          y: 140 + index * 240,
        });
      });
  });

  return {
    ...graphData,
    nodes: nodes.map((node) => arrangedNodes.get(node.id) || node),
  };
}

function arrangeNodes() {
  const graphData = normalizeGraphData(
    fromLogicFlowGraph(
      lfRef.value?.getGraphData?.() || parsedGraphData.value,
      parsedGraphData.value,
      activeFoundationMode.value,
    ),
    true,
    true,
    activeFoundationMode.value,
  );
  workflowGraphData.value = prettyJson(layoutWorkflowGraphData(graphData));
  renderGraphData(undefined, true);
}

function refreshGraphData() {
  const nextGraphData = safeParseJson(workflowGraphData.value, undefined);
  if (nextGraphData === undefined) {
    ElMessage.warning('Graph JSON 格式不正确');
    return;
  }
  workflowGraphData.value = prettyJson(
    normalizeGraphData(nextGraphData, true, true, activeFoundationMode.value),
  );
  renderGraphData(undefined, true);
}

function runLocalValidation(showMessage = true) {
  syncGraphData();
  const graphData = normalizeGraphData(
    safeParseJson(workflowGraphData.value, {}),
    true,
    true,
    activeFoundationMode.value,
  );
  localValidation.value = validateWorkflow(
    graphData,
    activeFoundationMode.value,
  );
  emit('localValidationChange', localValidation.value);
  if (showMessage) {
    if (localValidation.value.errors.length > 0)
      ElMessage.error(
        `本地校验未通过：${localValidation.value.errors.length} 个错误`,
      );
    else if (localValidation.value.warnings.length > 0)
      ElMessage.warning(
        `本地校验有 ${localValidation.value.warnings.length} 个提醒`,
      );
    else ElMessage.success('本地校验通过');
  }
  return localValidation.value.errors.length === 0;
}

function toggleAddMenu(open?: boolean) {
  canvasAddMenuOpen.value = open ?? !canvasAddMenuOpen.value;
}

watch(activePaletteMode, (mode) => {
  if (!lfRef.value?.graphModel) return;
  lfRef.value.graphModel.paletteMode = mode;
  refreshRenderedNodeComponents();
});

onMounted(async () => {
  await nextTick();
  await initLogicFlow();
});

onBeforeUnmount(() => {
  unbindCanvasMouse?.();
  unbindDocumentPaste?.();
  lfRef.value?.destroy?.();
  lfRef.value = undefined;
});

defineExpose({
  fitView,
  getGraphData,
  refreshFromDsl: refreshGraphData,
  refreshGraphData,
  renderGraphData,
  renderGraphFromDsl: (fit = true) => renderGraphData(undefined, fit),
  runLocalValidation,
  syncGraphData,
  syncGraphToDsl: syncGraphData,
  toggleAddMenu,
});
</script>

<template>
  <div class="workflow-designer">
    <section class="canvas-pane">
      <div class="canvas-add-entry">
        <ElCollapseTransition>
          <div
            v-if="canvasAddMenuOpen"
            class="canvas-add-menu"
            @mousedown.stop
            @click.stop
            @wheel.stop
          >
            <div class="canvas-add-menu__search">
              <ElInput
                v-model="canvasMenuSearchKeyword"
                clearable
                placeholder="搜索节点名称 / 类型 / 描述"
              >
                <template #suffix>
                  <ElIcon><Search /></ElIcon>
                </template>
              </ElInput>
            </div>
            <ElTabs v-model="activeCanvasMenuTab" class="canvas-add-menu__tabs">
              <ElTabPane
                v-for="tab in canvasTabbedMenuGroups"
                :key="tab.name"
                :label="tab.label"
                :name="tab.name"
              />
            </ElTabs>
            <ElScrollbar height="390px">
              <div
                v-if="activeCanvasMenuGroups.length > 0"
                class="canvas-add-menu__content"
              >
                <section
                  v-for="group in activeCanvasMenuGroups"
                  :key="group.name"
                  class="canvas-add-menu__group"
                >
                  <div class="canvas-add-menu__title">{{ group.name }}</div>
                  <div class="canvas-add-menu__grid">
                    <ElPopover
                      v-for="item in group.items"
                      :key="item.type"
                      placement="right"
                      :persistent="false"
                      :show-after="350"
                      :teleported="false"
                      width="280"
                    >
                      <template #reference>
                        <button
                          type="button"
                          class="canvas-add-menu__item"
                          :class="`is-${item.status}`"
                          @click="addNode(item)"
                        >
                          <span class="canvas-add-menu__icon">{{
                            item.name.slice(0, 1)
                          }}</span>
                          <span class="canvas-add-menu__main">
                            <strong>{{ item.name }}</strong>
                            <small>{{ item.description }}</small>
                          </span>
                          <ElTag
                            v-if="item.stub"
                            size="small"
                            type="warning"
                            effect="light"
                          >
                            Stub
                          </ElTag>
                        </button>
                      </template>
                      <div class="canvas-add-menu__preview">
                        <strong>{{ item.name }}</strong>
                        <small>{{ item.type }}</small>
                        <p>{{ item.description }}</p>
                      </div>
                    </ElPopover>
                  </div>
                </section>
              </div>
              <ElEmpty v-else description="未找到匹配节点" :image-size="72" />
            </ElScrollbar>
          </div>
        </ElCollapseTransition>
      </div>

      <DesignerNodeSearch
        :lf="lfRef"
        @clear-selection="clearSelectionState"
        @focus-node="selectNodeById"
      />
      <div ref="canvasRef" class="logicflow-canvas"></div>
      <DesignerCanvasControl
        class="canvas-floating-control"
        :drag-mode="canvasDragMode"
        @arrange="arrangeNodes"
        @collapse="setAllNodeCollapsed(true)"
        @expand="setAllNodeCollapsed(false)"
        @fit="fitView"
        @reset="resetView"
        @toggle-drag="toggleCanvasDragMode"
        @zoom-in="zoomCanvas(true)"
        @zoom-out="zoomCanvas(false)"
      />
      <div
        v-if="
          localValidation.errors.length > 0 ||
          localValidation.warnings.length > 0
        "
        class="canvas-validation"
      >
        <div class="canvas-validation__header">
          <div>
            <strong>本地校验未通过</strong>
            <span>
              {{ localValidation.errors.length }} 个错误 /
              {{ localValidation.warnings.length }} 个提醒
            </span>
          </div>
          <ElButton
            v-if="canRepairBasicQaChain"
            size="small"
            type="primary"
            @click="repairBasicQaChain"
          >
            修复问答链路
          </ElButton>
        </div>
        <ElScrollbar max-height="180px" class="canvas-validation__scrollbar">
          <div class="canvas-validation__list">
            <div
              v-for="item in localValidationPreview"
              :key="`${item.type}-${item.message}`"
              class="validation-line"
              :class="`is-${item.type}`"
            >
              {{ item.message }}
            </div>
            <div
              v-if="localValidationHiddenCount > 0"
              class="validation-line is-muted"
            >
              还有
              {{ localValidationHiddenCount }}
              条校验信息，请修复上方问题后再次保存。
            </div>
          </div>
        </ElScrollbar>
        <div class="canvas-validation__hint">
          保存会继续阻止无效工作流；可先使用修复按钮补齐基础问答链路。
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.workflow-page {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  overflow: hidden;
}

.toolbar {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: center;
}

.editor-header {
  justify-content: space-between;
  padding: 8px 10px;
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.header-left,
.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.header-left {
  min-width: 0;
}

.page-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.auto-save-switch {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 0 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.toolbar .el-select {
  width: 260px;
}

.graph-meter {
  margin-left: auto;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.debug-drawer {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 96px);
}

.drawer-events {
  min-height: 0;
}

.workflow-designer {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.panel-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.hint-line,
.group-title,
.field-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.field-label {
  margin-top: 8px;
}

.palette-group + .palette-group {
  margin-top: 12px;
}

.palette-item {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 8px 10px;
  margin-bottom: 6px;
  text-align: left;
  cursor: pointer;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-left-width: 4px;
  border-radius: 6px;
  transition:
    background-color var(--el-transition-duration),
    border-color var(--el-transition-duration);
}

.palette-item:hover {
  background: var(--el-fill-color-light);
  border-color: var(--el-color-primary-light-5);
}

.palette-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.palette-main em {
  font-size: 11px;
  font-style: normal;
  color: var(--el-text-color-secondary);
}

.palette-desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.is-ai {
  border-left-color: var(--el-color-info);
}

.is-data {
  border-left-color: var(--el-color-primary-light-3);
}

.is-input {
  border-left-color: var(--el-color-success);
}

.is-logic {
  border-left-color: var(--el-color-primary);
}

.is-output {
  border-left-color: var(--el-color-warning);
}

.is-resource {
  border-left-color: var(--el-color-success-light-3);
}

.is-tool {
  border-left-color: var(--el-text-color-secondary);
}

.canvas-pane {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.canvas-add-entry {
  position: absolute;
  top: 8px;
  right: 16px;
  z-index: 10;
}

.canvas-add-menu {
  width: 640px;
  max-width: min(640px, calc(100vw - 96px));
  margin-top: 8px;
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  box-shadow: var(--el-box-shadow);
}

.canvas-add-menu__search {
  padding: 12px 12px 8px;
}

.canvas-add-menu__tabs {
  --el-tabs-header-height: 38px;
}

.canvas-add-menu__tabs :deep(.el-tabs__header) {
  padding: 0 12px;
  margin: 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.canvas-add-menu__tabs :deep(.el-tabs__item) {
  padding: 0 16px;
  font-size: 14px;
  font-weight: 600;
}

.canvas-add-menu__content {
  padding: 12px;
}

.canvas-add-menu__group + .canvas-add-menu__group {
  margin-top: 12px;
}

.canvas-add-menu__title {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.canvas-add-menu__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.canvas-add-menu__item {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  width: 100%;
  min-height: 62px;
  padding: 9px 10px;
  text-align: left;
  cursor: pointer;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  transition:
    background-color var(--el-transition-duration),
    border-color var(--el-transition-duration),
    box-shadow var(--el-transition-duration);
}

.canvas-add-menu__item:hover {
  background: var(--el-bg-color);
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-9);
}

.canvas-add-menu__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  font-size: 13px;
  font-weight: 800;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: 6px;
}

.canvas-add-menu__item.is-ai .canvas-add-menu__icon {
  color: var(--el-color-info);
  background: var(--el-color-info-light-9);
  border-color: var(--el-color-info-light-5);
}

.canvas-add-menu__item.is-data .canvas-add-menu__icon,
.canvas-add-menu__item.is-input .canvas-add-menu__icon {
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-5);
}

.canvas-add-menu__item.is-output .canvas-add-menu__icon,
.canvas-add-menu__item.is-resource .canvas-add-menu__icon {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning-light-5);
}

.canvas-add-menu__main {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.canvas-add-menu__main strong {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.canvas-add-menu__main small,
.canvas-add-menu__preview small,
.canvas-add-menu__preview p {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.canvas-add-menu__preview {
  display: grid;
  gap: 6px;
}

.canvas-add-menu__preview p {
  margin: 0;
  line-height: 1.5;
  white-space: normal;
}

.edge-actions,
.branch-header,
.debug-title {
  display: flex;
  gap: 6px;
  align-items: center;
}

.branch-header,
.debug-title {
  justify-content: space-between;
  margin-top: 8px;
}

.logicflow-canvas {
  position: relative;
  z-index: 1;
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.logicflow-canvas :deep(.lf-hide-default) {
  display: none;
}

.logicflow-canvas :deep(.lf-node-content) {
  overflow: visible;
}

.logicflow-canvas :deep(.lf-node-anchor) {
  transition: opacity 0.2s;
}

.canvas-floating-control {
  position: absolute;
  bottom: 24px;
  left: 24px;
  z-index: 3;
}

.inspector-pane {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.inspector-section {
  padding-bottom: 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.grow-section {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  border-bottom: 0;
}

.node-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.node-chip span {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.typed-form {
  padding: 8px;
  margin-top: 10px;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.form-grid {
  display: grid;
  gap: 8px;
}

.two-cols {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.full-span {
  grid-column: 1 / -1;
}

.compact-label {
  margin-top: 0;
}

.switch-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.loop-body-inspector {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.loop-body-inspector strong,
.loop-body-inspector span {
  display: block;
}

.loop-body-inspector strong {
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.loop-body-inspector span {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.branch-row {
  display: grid;
  grid-template-columns: 1fr 1fr 78px auto;
  gap: 6px;
  align-items: center;
  margin-bottom: 6px;
}

.branch-card {
  padding: 8px;
  margin-bottom: 8px;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-left: 3px solid var(--el-color-warning);
  border-radius: 6px;
}

.branch-mode {
  width: 78px;
}

.condition-row {
  display: grid;
  grid-template-columns: 98px 1fr auto;
  gap: 6px;
  align-items: center;
  margin-bottom: 6px;
}

.advanced-json {
  margin-top: 10px;
}

.advanced-json :deep(.el-collapse-item__header) {
  height: 34px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.empty-state,
.edge-readout,
.validation-line {
  padding: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.validation-line + .validation-line {
  margin-top: 6px;
}

.validation-line.is-error {
  color: var(--el-color-danger);
  border-color: var(--el-color-danger-light-7);
}

.validation-line.is-warning {
  color: var(--el-color-warning-dark-2);
  border-color: var(--el-color-warning-light-7);
}

.canvas-validation {
  position: absolute;
  right: 24px;
  bottom: 24px;
  z-index: 4;
  width: min(420px, calc(100% - 48px));
  padding: 12px;
  pointer-events: auto;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  box-shadow: var(--el-box-shadow);
}

.canvas-validation__header {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  justify-content: space-between;
}

.canvas-validation__header strong,
.canvas-validation__header span {
  display: block;
}

.canvas-validation__header strong {
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.canvas-validation__header span,
.canvas-validation__hint {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.canvas-validation__scrollbar {
  margin-top: 10px;
}

.canvas-validation__list {
  padding-right: 4px;
}

.canvas-validation__hint {
  padding-top: 8px;
  margin-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.canvas-validation .validation-line {
  line-height: 1.5;
  background: var(--el-fill-color-extra-light);
}

.canvas-validation .validation-line.is-muted {
  color: var(--el-text-color-placeholder);
  border-style: dashed;
}

.full-action {
  width: 100%;
  margin-top: 8px;
}

.mt8 {
  margin-top: 8px;
}

.run-events {
  flex: 1;
  min-height: 120px;
  margin-top: 8px;
  overflow: auto;
}

.run-event {
  display: grid;
  grid-template-columns: 82px 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 8px;
  margin-bottom: 6px;
  font-size: 12px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-left-width: 4px;
  border-radius: 6px;
}

.run-event strong {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.run-event small,
.run-event span {
  color: var(--el-text-color-secondary);
}

.run-event.is-running {
  border-left-color: var(--el-color-primary);
}

.run-event.is-stream {
  border-left-color: var(--el-color-info);
}

.run-event.is-success {
  border-left-color: var(--el-color-success);
}

.run-event.is-warning {
  border-left-color: var(--el-color-warning);
}

.run-event.is-failed {
  border-left-color: var(--el-color-danger);
}

.stream-box {
  height: 100%;
  padding: 8px;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.stream-box pre {
  margin: 0 0 8px;
  white-space: pre-wrap;
}

.raw-stream {
  height: calc(100vh - 110px);
}

.drawer-grid {
  display: grid;
  gap: 12px;
}

:deep(.workflow-html-node) {
  box-sizing: border-box;
  width: 300px;
  height: 226px;
  overflow: hidden;
  color: var(--el-text-color-primary);
  pointer-events: auto;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-top: 5px solid var(--node-accent);
  border-radius: 8px;
  box-shadow: 0 10px 24px rgb(15 23 42 / 8%);
}

:deep(.workflow-html-node__header) {
  display: grid;
  grid-template-columns: 30px 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 9px 10px 6px;
  background: linear-gradient(
    180deg,
    var(--node-accent-soft),
    var(--el-bg-color)
  );
}

:deep(.workflow-html-node__badge) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  font-size: 11px;
  font-weight: 800;
  color: var(--node-accent-text);
  background: var(--el-bg-color);
  border: 1px solid var(--node-accent);
  border-radius: 6px;
}

:deep(.workflow-html-node__title-input),
:deep(.workflow-html-node__input),
:deep(.workflow-html-node__branch-input),
:deep(.workflow-html-node__select) {
  box-sizing: border-box;
  min-width: 0;
  height: 24px;
  padding: 0 6px;
  font-size: 12px;
  color: var(--el-text-color-primary);
  outline: none;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 5px;
}

:deep(.workflow-html-node__title-input) {
  font-weight: 700;
}

:deep(.workflow-html-node__title-input:focus),
:deep(.workflow-html-node__input:focus),
:deep(.workflow-html-node__branch-input:focus),
:deep(.workflow-html-node__select:focus),
:deep(.workflow-html-node__textarea:focus) {
  border-color: var(--node-accent);
}

:deep(.workflow-html-node__textarea) {
  height: auto;
  min-height: 38px;
  padding: 4px 6px;
  resize: vertical;
}

:deep(.workflow-html-node__checkbox) {
  width: 14px;
  height: 14px;
  accent-color: var(--node-accent);
}

:deep(.workflow-html-node__type) {
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  font-weight: 700;
  color: var(--node-accent-text);
  white-space: nowrap;
}

:deep(.workflow-html-node__body) {
  display: grid;
  gap: 5px;
  max-height: 132px;
  padding: 6px 10px;
  overflow: auto;
}

:deep(.workflow-html-node__summary) {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

:deep(.workflow-html-node__field) {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 6px;
  align-items: center;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

:deep(.workflow-html-node__field.is-wide) {
  grid-template-columns: 1fr;
  gap: 3px;
}

:deep(.workflow-html-node__branches) {
  display: grid;
  gap: 5px;
}

:deep(.workflow-html-node__branch-row) {
  display: grid;
  grid-template-columns: 1fr 64px 1fr;
  gap: 4px;
}

:deep(.workflow-html-node__mini-button) {
  height: 24px;
  font-size: 11px;
  color: var(--node-accent-text);
  cursor: pointer;
  background: var(--node-accent-soft);
  border: 1px solid var(--node-accent);
  border-radius: 5px;
}

:deep(.workflow-html-node__outputs) {
  display: flex;
  gap: 5px;
  padding: 2px 10px 7px;
  overflow: hidden;
}

:deep(.workflow-html-node__chip) {
  max-width: 84px;
  padding: 2px 7px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 999px;
}

:deep(.workflow-html-node__chip.is-muted) {
  color: var(--el-text-color-placeholder);
}

:deep(.workflow-html-node__footer) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px 9px;
  border-top: 1px solid var(--el-border-color-lighter);
}

:deep(.workflow-html-node__check) {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

:deep(.workflow-html-node__marker) {
  padding: 2px 7px;
  font-size: 10px;
  font-weight: 700;
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 999px;
}

:deep(.workflow-html-node__marker.is-ok) {
  color: var(--el-color-success-dark-2);
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-5);
}
</style>
