<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import type { ToolNodeStep } from './ExecutionDetailCard.vue';

import { computed, ref } from 'vue';

import { Back, VideoPause } from '@element-plus/icons-vue';
import {
  ElAlert,
  ElButton,
  ElCard,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElScrollbar,
  ElSwitch,
  ElTabPane,
  ElTabs,
  ElTag,
} from 'element-plus';

import { getToolRun, listToolRunNodes } from '#/api/ai/tool-workflow';
import { getTool } from '#/api/ai/tools';
import AnswerContent from '#/components/ai-chat/component/answer-content/index.vue';
import { ChatManagement } from '#/components/ai-chat/types/application';
import { createDebugChatRecord } from '#/components/ai-chat/utils/chat';
import JsonInput from '#/components/dynamics-form/items/JsonInput.vue';

import { safeParseJson } from '../../utils';
import { workflowToolShape } from '../../workflow/designer/common/tool-resource-utils';
import { useToolDebugChat } from '../composables/useToolDebugChat';
import ExecutionDetailCard from './ExecutionDetailCard.vue';

interface InputField {
  field: string;
  label?: string;
  type: string;
  is_required?: boolean;
}

type JsonRecord = Record<string, unknown>;

const props = defineProps<{
  onNodeStatus?: (
    nodeId: string,
    status: ToolNodeStep['status'] | undefined,
  ) => void;
}>();

const inputDrawerVisible = ref(false);
const resultDrawerVisible = ref(false);
const activeTab = ref('output');
const formRef = ref<FormInstance>();

const toolId = ref<number | string>();
const inputFieldList = ref<InputField[]>([]);
const inputForm = ref<Record<string, any>>({});
const currentChat = ref(createDebugChatRecord());

const { debug, result, resume, running, stop } = useToolDebugChat({
  getChatRecord: () => currentChat.value,
  getToolId: () => toolId.value!,
  onNodeStatus: (nodeId, status) => props.onNodeStatus?.(nodeId, status),
});

const toolRun = ref<any>();
const toolRunNodes = ref<ToolNodeStep[]>([]);

const answerApplication = computed(() => ({
  id: toolId.value,
  show_avatar: false,
  show_exec: true,
  show_source: true,
  show_user_avatar: false,
  type: 'WORK_FLOW',
}));

const answerLoading = computed(
  () => running.value || !currentChat.value.write_ed,
);

const isSuccess = computed(() => {
  if (toolRun.value) {
    return toolRun.value.status !== 'FAILURE';
  }
  if (result.value.error) return false;
  return undefined;
});

const output = computed(() => {
  const value = toolRun.value?.outputJson ?? result.value.finalOutput;
  if (value) {
    try {
      const parsed = safeParseJson(value, undefined);
      if (parsed !== undefined && parsed !== null) {
        return JSON.stringify(parsed, null, 2);
      }
      return value;
    } catch {
      return value;
    }
  }
  const lastStep = toolRunNodes.value.at(-1) ?? result.value.nodeSteps.at(-1);
  if (lastStep?.outputJson) return lastStep.outputJson;
  if (lastStep?.content) return lastStep.content;
  return undefined;
});

const executionDetails = computed(() =>
  toolRunNodes.value.length > 0 ? toolRunNodes.value : result.value.nodeSteps,
);

function resetToolRun() {
  toolRun.value = undefined;
  toolRunNodes.value = [];
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textValue(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') {
    return `${value}`.trim();
  }
  return '';
}

function labelValue(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') {
    return textValue(value);
  }
  if (isRecord(value)) {
    return textValue(value.label ?? value.value ?? value.name);
  }
  return '';
}

function normalizeInputFields(fields: JsonRecord[]): InputField[] {
  return fields.map((field, index) => {
    const key =
      textValue(field.field ?? field.name ?? field.value ?? field.key) ||
      `param_${index + 1}`;
    return {
      field: key,
      is_required: field.is_required === true || field.required === true,
      label: labelValue(field.label) || key,
      type: textValue(field.type ?? field.input_type) || 'string',
    };
  });
}

function resumeFormDataFrom(params: JsonRecord): JsonRecord | undefined {
  const formData = params.node_data ?? params.form_data;
  return isRecord(formData) ? formData : undefined;
}

function toggleStep(index: number) {
  const steps = executionDetails.value;
  const step = steps[index];
  if (step) step.expanded = !step.expanded;
}

function closeInputDrawer() {
  inputDrawerVisible.value = false;
  inputForm.value = {};
}

function closeResultDrawer() {
  if (running.value) stop();
  ChatManagement.close(currentChat.value.id);
  resultDrawerVisible.value = false;
  resetToolRun();
}

async function runDebug() {
  await (inputFieldList.value.length === 0
    ? executeDebug()
    : formRef.value?.validate(async (valid) => {
        if (valid) {
          await executeDebug();
        }
      }));
}

async function executeDebug() {
  if (!toolId.value) return;

  try {
    resetToolRun();
    currentChat.value = createDebugChatRecord(
      JSON.stringify(inputForm.value, null, 2),
    );
    inputDrawerVisible.value = false;
    resultDrawerVisible.value = true;
    activeTab.value = 'output';
    await debug(inputForm.value);
    await fetchToolRunRecord();
  } catch (error: any) {
    ElMessage.error(error?.message || '工作流调试失败');
  }
}

async function fetchToolRunRecord() {
  const runId = result.value.runId;
  if (!toolId.value || !runId) return;
  try {
    const [runData, nodesData] = await Promise.all([
      getToolRun(toolId.value, runId),
      listToolRunNodes(toolId.value, runId),
    ]);
    toolRun.value = runData;
    toolRunNodes.value = normalizeNodeSteps(nodesData);
  } catch {
    // 服务端补齐记录失败时仍展示 SSE 已收集的数据。
  }
}

function normalizeNodeSteps(data: any): ToolNodeStep[] {
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
}

function normalizeJson(value: any): string | undefined {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return JSON.stringify(value, null, 2);
  return undefined;
}

function normalizeOutput(value: any): Record<string, any> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') return safeParseJson(value, undefined);
  return undefined;
}

function normalizeStatus(
  state?: string,
): 'FAILED' | 'RUNNING' | 'SUCCESS' | 'WARNING' {
  const normalized = (state || '').toUpperCase();
  if (normalized === 'SUCCESS') return 'SUCCESS';
  if (normalized === 'FAILURE' || normalized === 'FAILED') return 'FAILED';
  if (normalized === 'RUNNING' || normalized === 'STARTED') return 'RUNNING';
  if (normalized === 'WARNING') return 'WARNING';
  return 'FAILED';
}

async function sendMessage(
  question: string,
  otherParamsData?: unknown,
  _chatRecord?: unknown,
) {
  const params = isRecord(otherParamsData) ? otherParamsData : {};

  // 表单提交：FormRander 通过 sendMessage('', 'old', { node_data/form_data, ... }) 触发。
  // 此时应 resume 续跑（在当前 run 上提交表单数据），而非从头重跑 debug。
  const formData = resumeFormDataFrom(params);
  if (formData !== undefined && result.value.runId !== undefined) {
    try {
      resetToolRun();
      await resume(result.value.runId, formData);
      await fetchToolRunRecord();
    } catch (error: any) {
      ElMessage.error(error?.message || '表单提交失败');
    }
    return true;
  }

  // 其余场景（如重新发起对话）：从头重跑。
  const rerunParams = { ...inputForm.value, ...params };
  if (question?.trim()) rerunParams.message = question;
  resetToolRun();
  currentChat.value = createDebugChatRecord(
    question || JSON.stringify(rerunParams, null, 2),
  );
  await debug(rerunParams);
  await fetchToolRunRecord();
  return true;
}

async function open(id: number | string) {
  toolId.value = id;
  inputForm.value = {};
  resetToolRun();
  currentChat.value = createDebugChatRecord();

  try {
    const detail: unknown = await getTool(id);
    inputFieldList.value = isRecord(detail)
      ? normalizeInputFields(workflowToolShape(detail).inputFields)
      : [];
    inputDrawerVisible.value = true;
  } catch (error: any) {
    ElMessage.error(error?.message || '获取工具详情失败');
  }
}

defineExpose({ open });
</script>

<template>
  <!-- 输入参数抽屉 -->
  <ElDrawer
    v-model="inputDrawerVisible"
    title="调试"
    size="800px"
    :before-close="closeInputDrawer"
  >
    <h4 v-if="inputFieldList.length > 0" class="mb-4 font-medium">输入参数</h4>

    <ElForm
      v-if="inputFieldList.length > 0"
      ref="formRef"
      :model="inputForm"
      label-position="top"
      require-asterisk-position="right"
      hide-required-asterisk
      @submit.prevent
    >
      <template v-for="(field, index) in inputFieldList" :key="index">
        <ElFormItem
          :label="field.label || field.field"
          :prop="field.field"
          :rules="{
            required: field.is_required,
            message: `请输入${field.label}`,
            trigger: 'blur',
          }"
        >
          <template #label>
            <div class="flex items-center">
              <span>
                {{ field.label || field.field }}
                <span v-if="field.is_required" class="text-red-500">*</span>
              </span>
              <ElTag type="info" size="small" class="ml-2">
                {{ field.type }}
              </ElTag>
            </div>
          </template>

          <ElInput
            v-if="['string'].includes(field.type)"
            v-model="inputForm[field.field]"
            placeholder="请输入"
          />
          <JsonInput
            v-else-if="['array', 'dict'].includes(field.type)"
            v-model="inputForm[field.field]"
          />
          <ElInputNumber
            v-else-if="['int', 'float'].includes(field.type)"
            v-model="inputForm[field.field]"
            class="w-full"
          />
          <ElSwitch
            v-else-if="['boolean'].includes(field.type)"
            v-model="inputForm[field.field]"
          />
        </ElFormItem>
      </template>
    </ElForm>

    <template #footer>
      <ElButton :disabled="running" @click="closeInputDrawer">取消</ElButton>
      <ElButton type="primary" :loading="running" @click="runDebug">
        运行
      </ElButton>
    </template>
  </ElDrawer>

  <!-- 调试结果抽屉 -->
  <ElDrawer
    v-model="resultDrawerVisible"
    append-to-body
    direction="rtl"
    size="800px"
    :modal="false"
    :before-close="closeResultDrawer"
    class="tool-debug-result-drawer"
  >
    <template #header>
      <div class="flex items-center justify-between" style="width: 100%">
        <div class="flex items-center" style="margin-left: -8px">
          <ElButton
            class="mr-4 cursor-pointer"
            link
            @click.prevent="closeResultDrawer"
          >
            <ElIcon :size="20">
              <Back />
            </ElIcon>
          </ElButton>
          <h4>调试结果</h4>
        </div>
        <ElButton
          v-if="running"
          type="danger"
          :icon="VideoPause"
          size="small"
          @click="stop"
        >
          停止
        </ElButton>
      </div>
    </template>

    <ElTabs v-model="activeTab" style="margin-top: -10px">
      <ElTabPane label="输出" name="output">
        <div class="scrollbar-height">
          <h4 class="mb-4 mt-2 font-medium">回复内容</h4>
          <AnswerContent
            v-model:chat-record="currentChat"
            :application="answerApplication"
            :chat-management="ChatManagement"
            :execution-is-right-panel="false"
            :loading="answerLoading"
            :selection="true"
            :send-message="sendMessage"
            type="debug-ai-chat"
            @open-execution-detail="activeTab = 'details'"
            @open-paragraph="() => {}"
            @open-paragraph-document="() => {}"
          />

          <div
            v-if="
              !running &&
              (toolRun || result.finalOutput !== undefined || result.error)
            "
          >
            <h4 class="mb-4 mt-6 font-medium">输出参数</h4>
            <div v-if="isSuccess !== undefined" class="mb-4">
              <ElAlert
                v-if="isSuccess"
                title="运行成功"
                type="success"
                show-icon
                :closable="false"
              />
              <ElAlert
                v-else
                :title="result.errorMessage || '运行失败'"
                type="error"
                show-icon
                :closable="false"
              />
            </div>
            <ElCard shadow="never">
              <pre
                class="output-pre whitespace-pre-wrap break-words"
                v-text="output || '{}'"
              ></pre>
            </ElCard>
          </div>
        </div>
      </ElTabPane>

      <ElTabPane label="执行详情" name="details">
        <ElScrollbar>
          <div class="scrollbar-height">
            <div
              v-if="executionDetails.length === 0 && !running"
              class="py-8 text-center text-gray-400"
            >
              无执行详情
            </div>
            <ExecutionDetailCard
              v-for="(step, index) in executionDetails"
              :key="index"
              :data="step"
              @toggle="toggleStep(index)"
            />
          </div>
        </ElScrollbar>
      </ElTabPane>
    </ElTabs>
  </ElDrawer>
</template>

<style scoped lang="scss">
.tool-debug-result-drawer {
  :deep(.el-drawer__body) {
    padding: 16px !important;
  }

  .scrollbar-height {
    max-height: calc(100vh - 134px);
    overflow: auto;
  }

  .output-pre {
    padding: 12px;
    margin: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 14px;
    background: var(--el-fill-color-light);
    border-radius: 6px;
  }
}
</style>
