<script setup lang="ts">
import type { NodeTemplate, WorkflowGraphData } from './nodes';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
} from 'vue';

import LogicFlow from '@logicflow/core';
import { ElButton, ElDrawer, ElMessage } from 'element-plus';

import { validateLogicFlowEdge } from './common/connection-validation';
import DesignerNodeSearch from './common/DesignerNodeSearch.vue';
import {
  fromLogicFlowGraph,
  normalizeLoopBodyGraphData,
  toLogicFlowGraph,
} from './graph-data';
import {
  cloneValue,
  createDefaultLoopBodyGraphData,
  defaultProperties,
  groupedNodeTemplates,
} from './nodes';
import { registerWorkflowNodes } from './register';

const props = defineProps<{
  loopBody?: Partial<WorkflowGraphData>;
  loopNodeId?: string;
  loopNodeName?: string;
  modelValue: boolean;
  parentGraphModel?: any;
}>();

const emit = defineEmits<{
  save: [value: WorkflowGraphData];
  'update:loopBody': [value: WorkflowGraphData];
  'update:modelValue': [value: boolean];
}>();

const canvasRef = ref<HTMLDivElement>();
const nestedLfRef = shallowRef<any>();
const graphReady = ref(false);
const selectedBodyNodeId = ref('');
const selectedBodyEdgeId = ref('');
const currentLoopBody = ref<WorkflowGraphData>(normalizeLoopBodyGraphData({}));
const syncingInternally = ref(false);
const deniedNodeTypes = new Set(['loop-body-node', 'loop-node']);
const protectedNodeTypes = new Set(['loop-start-node']);
const canvasMeasureFrames = 30;
const nestedPaletteMode = computed(() =>
  props.parentGraphModel?.paletteMode === 'knowledge'
    ? 'knowledge-loop'
    : 'application-loop',
);
const paletteGroups = computed(() =>
  groupedNodeTemplates(nestedPaletteMode.value),
);
const selectedBodyElementId = computed(
  () => selectedBodyNodeId.value || selectedBodyEdgeId.value,
);

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

function closePanel() {
  emit('update:modelValue', false);
}

function syncFromNestedGraph() {
  const lf = nestedLfRef.value;
  if (!lf) return;
  removeDeniedNodes();
  ensureLoopStartNodeInCanvas();
  const normalized = normalizeLoopBodyGraphData(
    fromLogicFlowGraph(lf.getGraphData(), currentLoopBody.value),
  );
  currentLoopBody.value = normalized;
  syncingInternally.value = true;
  emit('update:loopBody', cloneValue(normalized));
  nextTick(() => {
    syncingInternally.value = false;
  });
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

async function renderLoopBody(fit = true) {
  const lf = nestedLfRef.value;
  if (!lf) return;
  const hasSize = await waitForElementSize(canvasRef.value);
  if (!hasSize) return;
  currentLoopBody.value = normalizeLoopBodyGraphData(props.loopBody || {});
  lf.render(toLogicFlowGraph(currentLoopBody.value));
  ensureLoopStartNodeInCanvas();
  clearNestedSelectionState();
  if (fit) nextTick(() => fitView());
}

function createLoopStartGraphNode() {
  return toLogicFlowGraph(
    createDefaultLoopBodyGraphData(`${props.loopNodeId || ''}`),
  ).nodes?.[0];
}

function ensureLoopStartNodeInCanvas() {
  const lf = nestedLfRef.value;
  if (!lf) return;
  const graph = lf.getGraphData?.();
  const hasLoopStart = graph?.nodes?.some(
    (node: any) =>
      `${node?.properties?.type || node?.type || ''}` === 'loop-start-node',
  );
  if (hasLoopStart) return;
  const loopStartNode = createLoopStartGraphNode();
  if (loopStartNode) lf.addNode?.(loopStartNode);
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
  lf.on('node:click', ({ data }: any) => {
    selectNestedNode(`${data?.id || ''}`);
  });
  lf.on('edge:click', ({ data }: any) => {
    selectNestedEdge(`${data?.id || ''}`);
  });
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
}

function parentLoopNodeModel() {
  if (!props.loopNodeId) return undefined;
  return props.parentGraphModel?.getNodeModelById?.(props.loopNodeId);
}

function installNestedGraphBridge(lf: any) {
  lf.graphModel.paletteMode = nestedPaletteMode.value;
  lf.graphModel.get_parent_nodes = () => props.parentGraphModel?.nodes || [];
  lf.graphModel.get_up_node_field_list = (
    containSelf = false,
    useCache = false,
  ) =>
    parentLoopNodeModel()?.get_up_node_field_list?.(containSelf, useCache) ||
    [];
  lf.graphModel.refresh_loop_fields = (fields: any[]) => {
    const loopNode = parentLoopNodeModel();
    if (!loopNode) return;
    loopNode.updateWorkflowProperties?.(
      {
        config: {
          ...loopNode.properties?.config,
          fields: cloneValue(fields),
        },
      },
      ['config'],
    );
    loopNode.clear_next_node_field?.(true);
  };
}

async function initNestedLogicFlow() {
  if (!canvasRef.value || nestedLfRef.value) return;
  const hasSize = await waitForElementSize(canvasRef.value);
  if (!hasSize || nestedLfRef.value) return;
  const lf = new LogicFlow({
    container: canvasRef.value,
    background: { backgroundColor: 'var(--el-fill-color-extra-light)' },
    edgeType: 'app-edge',
    grid: {
      config: { color: 'var(--el-border-color)', thickness: 1 },
      size: 20,
      type: 'dot',
      visible: true,
    },
    history: true,
    keyboard: { enabled: true },
    snapline: true,
  });
  installNestedGraphBridge(lf);
  registerWorkflowNodes(lf);
  nestedLfRef.value = lf;
  bindNestedEvents(lf);
  graphReady.value = true;
  await renderLoopBody(false);
}

function addBodyNode(item: NodeTemplate) {
  const lf = nestedLfRef.value;
  if (!lf || deniedNodeTypes.has(item.type)) return;
  const graph = lf.getGraphData();
  const index = graph?.nodes?.length || 0;
  const node = {
    id:
      ['base-node', 'start-node'].includes(item.type) &&
      !graph?.nodes?.some((candidate: any) => candidate.id === item.type)
        ? item.type
        : `${item.type}_${Date.now()}`,
    properties: defaultProperties(item.type, item.name),
    type: item.type,
    x: 160 + (index % 3) * 300,
    y: 140 + Math.floor(index / 3) * 170,
  };
  lf.clearSelectElements?.();
  const graphNode = lf.addNode(
    toLogicFlowGraph({ edges: [], nodes: [node] }).nodes?.[0],
  );
  if (graphNode?.id) {
    lf.selectElementById?.(graphNode.id, true);
    lf.toFront?.(graphNode.id);
    selectNestedNode(graphNode.id);
  }
  syncFromNestedGraph();
}

function deleteSelectedBodyElement() {
  const lf = nestedLfRef.value;
  const selectedId = selectedBodyElementId.value;
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
  lf.resetZoom?.();
  lf.resetTranslate?.();
  if (typeof lf.fitView === 'function') lf.fitView();
}

function saveLoopBody() {
  syncFromNestedGraph();
  emit('save', cloneValue(currentLoopBody.value));
}

watch(
  () => props.modelValue,
  async (visible) => {
    if (!visible) return;
    await nextTick();
    await initNestedLogicFlow();
    await renderLoopBody(true);
  },
);

watch(
  () => props.loopBody,
  () => {
    if (syncingInternally.value) return;
    if (props.modelValue) renderLoopBody(false);
  },
  { deep: true },
);

onBeforeUnmount(() => {
  const lf = nestedLfRef.value;
  if (lf) {
    (lf as any).clearThemeMode = () => {};
    lf.destroy?.();
  }
  nestedLfRef.value = undefined;
});
</script>

<template>
  <ElDrawer
    :model-value="modelValue"
    :title="`循环体编辑：${loopNodeName || loopNodeId || '未命名循环'}`"
    size="76%"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="loop-body-panel">
      <aside class="loop-body-panel__palette">
        <div class="loop-body-panel__title">循环体组件</div>
        <div class="loop-body-panel__hint">
          节点和连线只保存到当前循环节点的 loop_body
        </div>
        <div
          v-for="group in paletteGroups"
          :key="group.name"
          class="loop-body-panel__group"
        >
          <div class="loop-body-panel__group-title">{{ group.name }}</div>
          <button
            v-for="item in group.items"
            :key="item.type"
            class="loop-body-panel__item"
            type="button"
            @click="addBodyNode(item)"
          >
            <span>{{ item.name }}</span>
            <small>{{ item.description }}</small>
          </button>
        </div>
      </aside>

      <section class="loop-body-panel__workspace">
        <div class="loop-body-panel__toolbar">
          <div class="loop-body-panel__status">
            <strong>子画布</strong>
            <span>{{
              graphReady
                ? `节点 ${currentLoopBody.nodes.length} / 连线 ${currentLoopBody.edges.length}`
                : '初始化中'
            }}</span>
          </div>
          <div class="loop-body-panel__actions">
            <ElButton size="small" @click="fitView">适配</ElButton>
            <ElButton
              size="small"
              type="danger"
              :disabled="!selectedBodyElementId"
              @click="deleteSelectedBodyElement"
            >
              删除
            </ElButton>
          </div>
        </div>
        <div class="loop-body-panel__search-host">
          <DesignerNodeSearch
            :enabled="modelValue"
            :exclude-types="[]"
            :lf="nestedLfRef"
            @clear-selection="clearNestedSelectionState"
            @focus-node="selectNestedNode"
          />
        </div>
        <div ref="canvasRef" class="loop-body-panel__canvas"></div>
      </section>
    </div>

    <template #footer>
      <div class="loop-body-panel__footer">
        <ElButton @click="closePanel">取消</ElButton>
        <ElButton type="primary" @click="saveLoopBody">保存循环体</ElButton>
      </div>
    </template>
  </ElDrawer>
</template>

<style scoped lang="scss">
.loop-body-panel {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  height: calc(100vh - 128px);
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.loop-body-panel__palette {
  padding: 10px;
  overflow: auto;
  background: hsl(var(--card));
  border-right: 1px solid var(--el-border-color-lighter);
}

.loop-body-panel__title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.loop-body-panel__hint,
.loop-body-panel__group-title {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.loop-body-panel__group {
  margin-top: 12px;
}

.loop-body-panel__group-title {
  margin-bottom: 6px;
}

.loop-body-panel__item {
  display: grid;
  gap: 2px;
  width: 100%;
  padding: 8px 10px;
  margin-bottom: 6px;
  text-align: left;
  cursor: pointer;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-left: 4px solid var(--el-color-primary-light-3);
  border-radius: 6px;
  transition:
    background-color var(--el-transition-duration),
    border-color var(--el-transition-duration);
}

.loop-body-panel__item:hover {
  background: var(--el-fill-color-light);
  border-color: var(--el-color-primary-light-5);
}

.loop-body-panel__item span {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.loop-body-panel__item small {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.loop-body-panel__workspace {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--el-fill-color-extra-light);
}

.loop-body-panel__search-host {
  --designer-node-search-top: 56px;
}

.loop-body-panel__toolbar,
.loop-body-panel__footer,
.loop-body-panel__actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.loop-body-panel__toolbar {
  flex-shrink: 0;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.loop-body-panel__status strong {
  margin-right: 10px;
  font-size: 13px;
}

.loop-body-panel__status span {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.loop-body-panel__canvas {
  flex: 1;
  min-height: 0;
}

.loop-body-panel__footer {
  justify-content: flex-end;
}
</style>
