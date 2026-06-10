<script setup lang="ts">
/**
 * 工作流调试 — 单条消息（user 气泡 / assistant 气泡）。
 *
 * assistant：
 *   - 流式中（write_ed=false）顶部显示进度指示卡（最新 RUNNING 步骤）。
 *   - 遍历 nodeSteps → 每个 ExecutionDetailCard。
 *   - error → 红色错误块。
 *   - write_ed 后底部：tokens 合计 + 总耗时。
 * 仅服务工作流调试面板。
 */
import type { DebugChatMessage, NodeStep } from './types';

import { computed } from 'vue';

import { ElIcon } from 'element-plus';

import { nodeTypeIcon } from '../../designer/common/node-type-icons';
import ExecutionDetailCard from './ExecutionDetailCard.vue';

const props = defineProps<{ message: DebugChatMessage }>();

/** 进度指示：最新一个 RUNNING 步骤（流式中显示）。 */
const runningStep = computed<NodeStep | undefined>(() =>
  [...props.message.nodeSteps].toReversed().find((s) => s.status === 'RUNNING'),
);

const progressIcon = computed(() =>
  runningStep.value ? nodeTypeIcon(runningStep.value.nodeType) : undefined,
);

const showProgress = computed(
  () => !props.message.write_ed && !!runningStep.value,
);

const totalRunTimeText = computed(() => {
  const ms = props.message.totalRunTime;
  if (typeof ms !== 'number' || ms <= 0) return undefined;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
});

const showSummary = computed(
  () =>
    props.message.write_ed &&
    !props.message.error &&
    ((props.message.totalTokens ?? 0) > 0 || !!totalRunTimeText.value),
);

function toggleStep(step: NodeStep) {
  step.expanded = !step.expanded;
}
</script>

<template>
  <div
    class="debug-message"
    :class="message.role === 'user' ? 'is-user' : 'is-assistant'"
  >
    <!-- 用户消息 -->
    <div v-if="message.role === 'user'" class="dm-bubble dm-user">
      {{ message.problemText }}
    </div>

    <!-- 助手消息 -->
    <div v-else class="dm-bubble dm-assistant">
      <!-- 进度指示卡 -->
      <div v-if="showProgress" class="dm-progress">
        <ElIcon class="dm-progress-icon">
          <component :is="progressIcon" />
        </ElIcon>
        <span class="dm-progress-text">
          执行中: {{ runningStep?.nodeName }}
        </span>
      </div>

      <!-- 节点执行详情卡列表 -->
      <ExecutionDetailCard
        v-for="(step, index) in message.nodeSteps"
        :key="`${step.nodeId}-${index}`"
        :step="step"
        @toggle="toggleStep(step)"
      />

      <!-- 空态（尚无节点且非错误） -->
      <div
        v-if="
          message.nodeSteps.length === 0 && !message.error && message.write_ed
        "
        class="dm-empty"
      >
        无执行结果
      </div>

      <!-- 错误块 -->
      <div v-if="message.error" class="dm-error">
        {{ message.errorMessage || '工作流执行失败' }}
      </div>

      <!-- 合计 -->
      <div v-if="showSummary" class="dm-summary">
        <span v-if="(message.totalTokens ?? 0) > 0">
          合计 {{ message.totalTokens }} tokens
        </span>
        <span v-if="totalRunTimeText">耗时 {{ totalRunTimeText }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.debug-message {
  display: flex;
  margin-bottom: 12px;
}

.debug-message.is-user {
  justify-content: flex-end;
}

.debug-message.is-assistant {
  justify-content: flex-start;
}

.dm-bubble {
  max-width: 92%;
  border-radius: 8px;
}

.dm-user {
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.6;
  color: #fff;
  white-space: pre-wrap;
  background: var(--el-color-primary);
}

.dm-assistant {
  width: 100%;
  max-width: 100%;
}

.dm-progress {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 8px 10px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 6px;
}

.dm-progress-icon {
  font-size: 14px;
}

.dm-progress-text {
  font-weight: 600;
}

.dm-empty {
  padding: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.dm-error {
  padding: 8px 10px;
  font-size: 12px;
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
  border: 1px solid var(--el-color-danger-light-7);
  border-radius: 6px;
}

.dm-summary {
  display: flex;
  gap: 12px;
  padding: 6px 2px 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
