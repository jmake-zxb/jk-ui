<script setup lang="ts">
import type { ToolNodeStep } from './ExecutionDetailCard.vue';

import { computed, ref, watch } from 'vue';

import { Back } from '@element-plus/icons-vue';
import { ElButton, ElCard, ElDrawer, ElIcon, ElScrollbar } from 'element-plus';

import { getToolRun, listToolRunNodes } from '#/api/ai/tool-workflow';

import { safeParseJson } from '../../utils';
import ExecutionDetailCard from './ExecutionDetailCard.vue';

interface ToolRunRecord {
  createTime?: string;
  create_time?: string;
  id?: number | string;
  runTime?: number;
  run_time?: number;
  state?: string;
  status?: string;
}

interface Props {
  currentId?: number | string;
  currentRecord?: ToolRunRecord;
  next: () => void;
  nextDisabled: boolean;
  pre: () => void;
  preDisabled: boolean;
  toolId?: number | string;
}

const props = defineProps<Props>();
const emit = defineEmits(['update:currentId', 'update:currentRecord']);

const visible = ref(false);
const loading = ref(false);
const nodeSteps = ref<ToolNodeStep[]>([]);
const runDetail = ref<any>();

const open = () => {
  visible.value = true;
  loadDetail();
};

const close = () => {
  visible.value = false;
  nodeSteps.value = [];
  runDetail.value = undefined;
};

const loadDetail = async () => {
  if (!props.toolId || !props.currentId) return;
  loading.value = true;
  try {
    const [runData, nodesData] = await Promise.all([
      getToolRun(props.toolId, props.currentId),
      listToolRunNodes(props.toolId, props.currentId),
    ]);
    runDetail.value = runData;
    nodeSteps.value = normalizeNodeSteps(nodesData);
  } finally {
    loading.value = false;
  }
};

const normalizeNodeSteps = (data: any): ToolNodeStep[] => {
  let nodes: any[] = [];
  if (Array.isArray(data)) {
    nodes = data;
  } else if (Array.isArray(data?.data)) {
    nodes = data.data;
  } else if (Array.isArray(data?.records)) {
    nodes = data.records;
  }

  return nodes.map((node: any) => ({
    completionTokens: node.completion_tokens ?? node.completionTokens,
    content: node.content ?? node.answer ?? '',
    errorMessage: node.error_message ?? node.errorMessage ?? node.error,
    expanded: false,
    inputJson: normalizeJson(node.input_json ?? node.inputJson ?? node.input),
    nodeName: node.node_name ?? node.nodeName ?? node.name ?? '未命名节点',
    nodeType: node.node_type ?? node.nodeType ?? node.type ?? 'unknown',
    output: normalizeOutput(node.output ?? node.result),
    outputJson: normalizeJson(
      node.output_json ?? node.outputJson ?? node.output,
    ),
    promptTokens: node.prompt_tokens ?? node.promptTokens,
    runTime: node.run_time ?? node.runTime ?? node.duration,
    status: normalizeStatus(node.state ?? node.status),
  }));
};

const normalizeJson = (value: any): string | undefined => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return JSON.stringify(value, null, 2);
  return undefined;
};

const normalizeOutput = (value: any): Record<string, any> | undefined => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') return safeParseJson(value, undefined);
  return undefined;
};

const normalizeStatus = (
  state?: string,
): 'FAILED' | 'RUNNING' | 'SUCCESS' | 'WARNING' => {
  const normalized = (state || '').toUpperCase();
  if (normalized === 'SUCCESS') return 'SUCCESS';
  if (normalized === 'FAILURE' || normalized === 'FAILED') return 'FAILED';
  if (normalized === 'RUNNING' || normalized === 'STARTED') return 'RUNNING';
  if (normalized === 'WARNING') return 'WARNING';
  return 'FAILED';
};

const toggleStep = (index: number) => {
  if (nodeSteps.value[index]) {
    nodeSteps.value[index].expanded = !nodeSteps.value[index].expanded;
  }
};

const statusText = computed(() => {
  const state = (
    props.currentRecord?.state ??
    props.currentRecord?.status ??
    ''
  ).toUpperCase();
  if (state === 'SUCCESS') return '成功';
  if (state === 'FAILURE' || state === 'FAILED') return '失败';
  if (state === 'RUNNING' || state === 'STARTED') return '运行中';
  return state || '未知';
});

const runTimeText = computed(() => {
  const time = props.currentRecord?.run_time ?? props.currentRecord?.runTime;
  if (typeof time !== 'number') return '-';
  return time >= 1000 ? `${(time / 1000).toFixed(2)}s` : `${time}ms`;
});

const createTimeText = computed(() => {
  return (
    props.currentRecord?.create_time ?? props.currentRecord?.createTime ?? '-'
  );
});

watch(
  () => props.currentId,
  (newId) => {
    if (newId && visible.value) loadDetail();
  },
);

watch(visible, (newVisible) => {
  if (!newVisible) {
    emit('update:currentId', undefined);
    emit('update:currentRecord', undefined);
  }
});

defineExpose({ open, close });
</script>

<template>
  <ElDrawer
    v-model="visible"
    size="800px"
    :modal="false"
    destroy-on-close
    :before-close="close"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
  >
    <template #header>
      <div style="display: flex; align-items: center; margin-left: -8px">
        <ElButton class="cursor" style="margin-right: 12px" link @click="close">
          <ElIcon :size="20">
            <Back />
          </ElIcon>
        </ElButton>
        <h4>执行详情</h4>
      </div>
    </template>

    <ElScrollbar v-loading="loading">
      <h4 style="margin-top: 4px; margin-bottom: 16px">执行记录</h4>
      <ElCard
        shadow="never"
        style="
          --el-card-padding: 12px 16px;

          margin-bottom: 24px;
        "
      >
        <div
          style="
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
          "
        >
          <div>
            <p
              style="margin-bottom: 4px; color: var(--el-text-color-secondary)"
            >
              状态
            </p>
            <p>{{ statusText }}</p>
          </div>
          <div>
            <p
              style="margin-bottom: 4px; color: var(--el-text-color-secondary)"
            >
              耗时
            </p>
            <p>{{ runTimeText }}</p>
          </div>
          <div>
            <p
              style="margin-bottom: 4px; color: var(--el-text-color-secondary)"
            >
              执行时间
            </p>
            <p>{{ createTimeText }}</p>
          </div>
        </div>
      </ElCard>

      <h4 style="margin-top: 4px; margin-bottom: 16px">执行详情</h4>
      <ExecutionDetailCard
        v-for="(step, index) in nodeSteps"
        :key="index"
        :data="step"
        @toggle="toggleStep(index)"
      />
    </ElScrollbar>

    <template #footer>
      <div>
        <ElButton :disabled="preDisabled || loading" @click="pre">
          上一条
        </ElButton>
        <ElButton :disabled="nextDisabled || loading" @click="next">
          下一条
        </ElButton>
      </div>
    </template>
  </ElDrawer>
</template>
