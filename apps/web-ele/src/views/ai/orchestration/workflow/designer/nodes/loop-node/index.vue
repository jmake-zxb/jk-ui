<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import type { WorkflowGraphData } from '../../nodes';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

import {
  ElCard,
  ElForm,
  ElFormItem,
  ElInputNumber,
  ElOption,
  ElSelect,
} from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';
import { normalizeLoopBodyGraphData } from '../../graph-data';
import { createDefaultLoopBodyGraphData, defaultProperties } from '../../nodes';

type LoopNodeData = {
  array: any[];
  is_result?: boolean;
  loop?: { x: number; y: number };
  loop_body: WorkflowGraphData;
  loop_type: 'ARRAY' | 'LOOP' | 'NUMBER';
  number: number;
};

const props = defineProps<{
  nodeModel: any;
  renderVersion?: number;
}>();

const loopNodeFormRef = ref<FormInstance>();
const nodeCascaderRef = ref<{ validate?: () => Promise<unknown> }>();
const formData = ref<LoopNodeData>(
  normalizeLoopNodeData(props.nodeModel.properties?.node_data),
);
let mountTimer = 0;

function trackRenderVersion() {
  return props.renderVersion;
}

const showNode = computed(() => {
  trackRenderVersion();
  return props.nodeModel.properties?.showNode !== false;
});

function defaultLoopNodeData(): LoopNodeData {
  return {
    array: [],
    loop_body: createDefaultLoopBodyGraphData(`${props.nodeModel.id || ''}`),
    loop_type: 'ARRAY',
    number: 1,
  };
}

function normalizeLoopNodeData(
  value: Record<string, any> | undefined,
): LoopNodeData {
  const defaults = defaultLoopNodeData();
  const source = value && typeof value === 'object' ? value : {};
  const loopType = `${source.loop_type || source.loopType || defaults.loop_type}`;
  const numberValue = Number(source.number ?? defaults.number);
  return {
    array: Array.isArray(source.array) ? cloneDeep(source.array) : [],
    ...(source.is_result === undefined
      ? {}
      : { is_result: !!source.is_result }),
    ...(source.loop && typeof source.loop === 'object'
      ? { loop: cloneDeep(source.loop) }
      : {}),
    loop_body: normalizeLoopBodyGraphData(
      source.loop_body || source.workflow || defaults.loop_body,
    ),
    loop_type: ['ARRAY', 'LOOP', 'NUMBER'].includes(loopType)
      ? (loopType as LoopNodeData['loop_type'])
      : 'ARRAY',
    number: Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 1,
  };
}

function emitInlineUpdate(fields: string[]) {
  props.nodeModel.graphModel?.eventCenter?.emit?.('node:inline-update', {
    fields,
    id: props.nodeModel.id,
    properties: props.nodeModel.properties,
    source: 'vue-node',
  });
}

function syncNodeData(fields = ['node_data'], preserveCurrentLoopBody = false) {
  if (!props.nodeModel.properties) set(props.nodeModel, 'properties', {});
  const currentData = props.nodeModel.properties?.node_data || {};
  const nextData = {
    ...cloneDeep(currentData),
    ...cloneDeep(formData.value),
  };
  if (preserveCurrentLoopBody) {
    if (currentData.loop_body)
      set(nextData, 'loop_body', cloneDeep(currentData.loop_body));
    if (currentData.loop) set(nextData, 'loop', cloneDeep(currentData.loop));
  }
  set(props.nodeModel.properties, 'node_data', nextData);
  emitInlineUpdate(fields);
}

function patchData<K extends keyof LoopNodeData>(
  key: K,
  value: LoopNodeData[K],
) {
  set(formData.value, key, cloneDeep(value));
  syncNodeData(['node_data'], true);
}

function findLoopBodyNode() {
  const outgoing =
    props.nodeModel.graphModel?.getNodeOutgoingNode?.(props.nodeModel.id) || [];
  return outgoing.find((node: any) => {
    const nodeData = node.properties?.node_data || {};
    return (
      node.type === 'loop-body-node' &&
      `${node.properties?.loop_node_id || nodeData.loop_node_id || nodeData.loopNodeId || ''}` ===
        `${props.nodeModel.id}`
    );
  });
}

function bodyWorkflowFromNode(bodyNode: any) {
  const nodeData = bodyNode?.properties?.node_data || {};
  return normalizeLoopBodyGraphData(
    nodeData.loop_body ||
      nodeData.workflow ||
      bodyNode?.properties?.workflow ||
      props.nodeModel.properties?.node_data?.loop_body ||
      formData.value.loop_body,
  );
}

function syncLoopBodyFromTransientNode(bodyNode: any) {
  if (!bodyNode) return;
  set(formData.value, 'loop', {
    x: Number(bodyNode.x || 0),
    y: Number(bodyNode.y || 0),
  });
  set(formData.value, 'loop_body', bodyWorkflowFromNode(bodyNode));
  syncNodeData(['node_data']);
}

function mountLoopBodyNode() {
  const graphModel = props.nodeModel.graphModel;
  if (!graphModel || props.nodeModel.virtual || findLoopBodyNode()) return;
  const sourceData = normalizeLoopNodeData(
    props.nodeModel.properties?.node_data,
  );
  const workflow = normalizeLoopBodyGraphData(sourceData.loop_body);
  const savedPosition = sourceData.loop;
  const x = Number(savedPosition?.x || props.nodeModel.x || 0);
  const y = Number(savedPosition?.y || Number(props.nodeModel.y || 0) + 350);
  const properties = defaultProperties('loop-body-node', '循环体');
  const nodeData = {
    ...properties.node_data,
    loop_body: cloneDeep(workflow),
    loop_node_id: props.nodeModel.id,
    loopNodeId: props.nodeModel.id,
    workflow: cloneDeep(workflow),
  };
  const bodyNode = graphModel.addNode?.({
    properties: {
      ...properties,
      loop_node_id: props.nodeModel.id,
      loopNodeId: props.nodeModel.id,
      node_data: nodeData,
      workflow: cloneDeep(workflow),
    },
    type: 'loop-body-node',
    x,
    y,
  });
  if (!bodyNode) return;
  graphModel.addEdge?.({
    id: `edge_${props.nodeModel.id}_${bodyNode.id}_loop_body`,
    properties: {
      sourceAnchorId: `${props.nodeModel.id}_children`,
      targetAnchorId: `${bodyNode.id}_children`,
    },
    sourceAnchorId: `${props.nodeModel.id}_children`,
    sourceNodeId: props.nodeModel.id,
    targetAnchorId: `${bodyNode.id}_children`,
    targetNodeId: bodyNode.id,
    type: 'loop-edge',
    virtual: true,
  });
  props.nodeModel.refreshBranch?.();
  emitInlineUpdate(['loop-body-node']);
}

function queueMountLoopBodyNode() {
  window.clearTimeout(mountTimer);
  mountTimer = window.setTimeout(() => mountLoopBodyNode(), 80);
}

function destroyLoopBodyNode() {
  window.clearTimeout(mountTimer);
  const bodyNode = findLoopBodyNode();
  if (!bodyNode) return;
  if (typeof bodyNode.set_loop_body === 'function') bodyNode.set_loop_body();
  else syncLoopBodyFromTransientNode(bodyNode);
  props.nodeModel.graphModel?.deleteNode?.(bodyNode.id);
  props.nodeModel.refreshBranch?.();
  emitInlineUpdate(['node_data', 'loop-body-node']);
}

const validate = () => {
  const validations: Array<Promise<unknown> | undefined> = [
    loopNodeFormRef.value?.validate(),
  ];
  if (formData.value.loop_type === 'ARRAY' && nodeCascaderRef.value?.validate) {
    validations.push(nodeCascaderRef.value.validate());
  }
  return Promise.all(validations.filter(Boolean)).catch((error) => {
    throw Object.assign(new Error(`${error}`), {
      node: props.nodeModel,
      errMessage: error,
    });
  });
};

watch(showNode, (visible) => {
  if (visible) queueMountLoopBodyNode();
  else destroyLoopBodyNode();
});

onMounted(() => {
  formData.value = normalizeLoopNodeData(props.nodeModel.properties?.node_data);
  set(props.nodeModel, 'validate', validate);
  if (showNode.value) nextTick(queueMountLoopBodyNode);
});

onBeforeUnmount(() => {
  window.clearTimeout(mountTimer);
  const bodyNode = findLoopBodyNode();
  if (bodyNode) syncLoopBodyFromTransientNode(bodyNode);
});
</script>

<template>
  <NodeContainer :node-model="nodeModel" :render-version="renderVersion">
    <ElCard shadow="never" class="workflow-loop-node-card">
      <ElForm
        ref="loopNodeFormRef"
        :model="formData"
        label-position="top"
        require-asterisk-position="right"
        label-width="auto"
        @submit.prevent
      >
        <ElFormItem
          label="循环类型"
          prop="loop_type"
          :rules="{
            required: true,
            message: '请选择循环类型',
            trigger: 'change',
          }"
        >
          <ElSelect
            :model-value="formData.loop_type"
            :teleported="false"
            @update:model-value="patchData('loop_type', $event)"
          >
            <ElOption label="数组循环" value="ARRAY" />
            <ElOption label="次数循环" value="NUMBER" />
            <ElOption label="无限循环" value="LOOP" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem
          v-if="formData.loop_type === 'ARRAY'"
          label="循环数组"
          prop="array"
          :rules="{
            type: 'array',
            required: true,
            message: '请选择循环数组',
            trigger: 'change',
          }"
        >
          <NodeCascader
            ref="nodeCascaderRef"
            :model-value="formData.array"
            :node-model="nodeModel"
            class="w-full"
            placeholder="请选择循环数组"
            @update:model-value="patchData('array', $event)"
          />
        </ElFormItem>
        <ElFormItem
          v-else-if="formData.loop_type === 'NUMBER'"
          label="循环次数"
          prop="number"
          :rules="{
            required: true,
            message: '请输入循环次数',
            trigger: 'blur',
          }"
        >
          <ElInputNumber
            :min="1"
            :model-value="formData.number"
            @update:model-value="patchData('number', Number($event || 1))"
          />
        </ElFormItem>
      </ElForm>
    </ElCard>
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-loop-node-card {
  --el-card-padding: 12px;

  overflow: visible;
  border-color: var(--el-border-color-lighter);
}

.workflow-loop-node-card :deep(.el-card__body) {
  overflow: visible;
}

.w-full {
  width: 100%;
}
</style>
