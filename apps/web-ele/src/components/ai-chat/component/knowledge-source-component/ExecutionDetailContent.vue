<script setup lang="ts">
import { computed } from 'vue';

import { MdPreview } from 'md-editor-v3';

import ExecutionDetailCard from '#/components/execution-detail-card/index.vue';
import { isWorkFlow } from '#/utils/application';
import { arraySort } from '#/utils/array';

import 'md-editor-v3/lib/preview.css';

const props = defineProps<{
  appType?: string;
  detail?: Array<Record<string, any>>;
}>();

/** 工作流模式：按 index 排序后交给 ExecutionDetailCard 逐条渲染 */
const sortedDetail = computed(() => arraySort(props.detail ?? [], 'index'));

// ---- 以下为简单对话模式（非工作流）的计算属性 ----

/** 错误步骤信息 */
const errStepMsg = computed(() => {
  const errStep = props.detail?.find((item) => item.status === 500);
  if (errStep) {
    return `${errStep.step_type || errStep.type}: ${errStep.err_message}`;
  }
  return undefined;
});

/** chat_step 类型的步骤（简单对话模式才存在） */
const messageList = computed(() => {
  const chatStep = props.detail?.find((item) => item.step_type === 'chat_step');
  return chatStep?.message_list ?? [];
});

const problemPadding = computed(() =>
  props.detail?.find((item) => item.step_type === 'problem_padding'),
);

const paddedProblem = computed(() => {
  if (problemPadding.value) {
    return problemPadding.value.padding_problem_text ?? '';
  }
  return '';
});

const problem = computed(() => {
  if (problemPadding.value) {
    return problemPadding.value.problem_text ?? '';
  }
  const userList = messageList.value.filter(
    (item: any) => item.role === 'user',
  );
  if (userList.length > 0) {
    return userList[userList.length - 1].content;
  }
  return '';
});

const system = computed(() => {
  const sysMsgs = messageList.value.filter(
    (item: any) => item.role === 'system',
  );
  if (sysMsgs.length > 0) {
    return sysMsgs[sysMsgs.length - 1].content;
  }
  return '';
});

const historyRecord = computed(() => {
  const messages = messageList.value.filter(
    (item: any) => item.role !== 'system',
  );
  if (messages.length > 2) {
    return messages.slice(0, -2);
  }
  return [];
});

const currentChat = computed(() => {
  const messages = messageList.value.filter(
    (item: any) => item.role !== 'system',
  );
  return messages.slice(-2, -1);
});

const aiResponse = computed(() => {
  const messages = messageList.value.filter(
    (item: any) => item.role !== 'system',
  );
  return messages.slice(-1);
});
</script>

<template>
  <div class="execution-details">
    <!-- 工作流模式：逐节点渲染 -->
    <div v-if="isWorkFlow(appType) || sortedDetail.length > 0">
      <template v-for="(item, index) in sortedDetail" :key="index">
        <ExecutionDetailCard :data="item" />
      </template>
    </div>

    <!-- 简单对话模式 -->
    <template v-else>
      <div v-if="!detail?.length" class="empty-message">暂无执行详情</div>
      <template v-else>
        <div class="detail-card">
          <h5 class="detail-section-title">问题</h5>
          <div class="detail-section-body">
            <span class="g-mb-8">user: {{ problem }}</span>
          </div>
        </div>
        <div v-if="paddedProblem" class="detail-card">
          <h5 class="detail-section-title">优化后问题</h5>
          <div class="detail-section-body">
            <span class="g-mb-8">user: {{ paddedProblem }}</span>
          </div>
        </div>
        <div v-if="system" class="detail-card">
          <h5 class="detail-section-title">角色设定</h5>
          <div class="detail-section-body">
            <span class="g-mb-8">{{ system }}</span>
          </div>
        </div>
        <div class="detail-card">
          <h5 class="detail-section-title">历史记录</h5>
          <div class="detail-section-body">
            <template v-if="historyRecord.length > 0">
              <div
                v-for="(msg, index) in historyRecord"
                :key="index"
                class="g-mb-4"
              >
                <span class="color-secondary g-mr-4">{{ msg.role }}:</span>
                <span>{{ msg.content }}</span>
              </div>
            </template>
            <template v-else> -</template>
          </div>
        </div>
        <div class="detail-card">
          <h5 class="detail-section-title">当前对话</h5>
          <div class="detail-section-body">
            <div class="g-mb-8">已知信息:</div>
            <div v-for="(msg, index) in currentChat" :key="index">
              <span>{{ msg.content }}</span>
            </div>
          </div>
        </div>
        <div class="detail-card">
          <h5 class="detail-section-title">回答</h5>
          <div class="detail-section-body">
            <div v-for="(msg, index) in aiResponse" :key="index">
              <MdPreview
                v-if="msg.content"
                :editor-id="`exec-answer-${index}`"
                :model-value="msg.content"
                no-iconfont
                no-prettier
                :code-foldable="false"
              />
              <template v-else> -</template>
            </div>
          </div>
        </div>
        <div v-if="errStepMsg" class="detail-card is-error">
          <h5 class="detail-section-title">错误日志</h5>
          <div class="detail-section-body">
            <span>{{ errStepMsg }}</span>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.execution-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 100px;
}

.execution-details :deep(.md-editor-preview) {
  background: none !important;
}

.empty-message {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.detail-card {
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.detail-card + .detail-card {
  margin-top: 8px;
}

.detail-section-title {
  padding: 8px 12px;
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px dashed var(--el-border-color-lighter);
}

.detail-section-body {
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
  overflow-wrap: break-word;
  white-space: pre-wrap;
}

.g-mb-4 {
  margin-bottom: 4px;
}

.g-mb-8 {
  margin-bottom: 8px;
}

.g-mr-4 {
  margin-right: 4px;
}

.color-secondary {
  color: var(--el-text-color-secondary);
}

.is-error {
  color: var(--el-color-danger);
}
</style>
