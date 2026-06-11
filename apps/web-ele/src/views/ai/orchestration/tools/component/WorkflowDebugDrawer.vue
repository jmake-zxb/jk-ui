<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import { computed, ref } from 'vue';

import { Back, VideoPause } from '@element-plus/icons-vue';
import {
  ElAlert,
  ElButton,
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

import { getTool } from '#/api/ai/tools';
import AnswerContent from '#/components/ai-chat/component/answer-content/index.vue';
import { ChatManagement } from '#/components/ai-chat/types/application';
import { createDebugChatRecord } from '#/components/ai-chat/utils/chat';

import { useToolDebugChat } from '../composables/useToolDebugChat';
import ExecutionDetailCard from './ExecutionDetailCard.vue';

interface InputField {
  field: string;
  label?: string;
  type: string;
  is_required?: boolean;
}

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
});

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
  if (result.value.error) return false;
  if (result.value.nodeSteps.some((s) => s.status === 'FAILED')) return false;
  return result.value.nodeSteps.length > 0;
});

const output = computed(() => {
  if (result.value.finalOutput) {
    try {
      const parsed = JSON.parse(result.value.finalOutput);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return result.value.finalOutput;
    }
  }
  const lastStep = result.value.nodeSteps.at(-1);
  if (lastStep?.outputJson) return lastStep.outputJson;
  if (lastStep?.content) return lastStep.content;
  return '无输出';
});

function toggleStep(index: number) {
  const step = result.value.nodeSteps[index];
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
    currentChat.value = createDebugChatRecord(
      JSON.stringify(inputForm.value, null, 2),
    );
    inputDrawerVisible.value = false;
    resultDrawerVisible.value = true;
    activeTab.value = 'output';
    await debug(inputForm.value);
  } catch (error: any) {
    ElMessage.error(error?.message || '工作流调试失败');
  }
}

async function sendMessage(question: string, otherParamsData?: unknown) {
  const params =
    otherParamsData && typeof otherParamsData === 'object'
      ? (otherParamsData as Record<string, any>)
      : {};

  // 表单提交：FormRander 通过 sendMessage('', 'old', { form_data, ... }) 触发。
  // 此时应 resume 续跑（在当前 run 上提交表单数据），而非从头重跑 debug。
  if (params.form_data !== undefined && result.value.runId !== undefined) {
    try {
      await resume(result.value.runId, JSON.stringify(params.form_data));
    } catch (error: any) {
      ElMessage.error(error?.message || '表单提交失败');
    }
    return true;
  }

  // 其余场景（如重新发起对话）：从头重跑。
  const rerunParams = { ...inputForm.value, ...params };
  if (question?.trim()) rerunParams.message = question;
  currentChat.value = createDebugChatRecord(
    question || JSON.stringify(rerunParams, null, 2),
  );
  await debug(rerunParams);
  return true;
}

async function open(id: number | string) {
  toolId.value = id;
  inputForm.value = {};
  currentChat.value = createDebugChatRecord();

  try {
    const detail: any = await getTool(id);
    // Extract user_input_field_list from work_flow.nodes.tool-base-node
    const toolBaseNode = detail?.work_flow?.nodes?.find(
      (n: any) => n.id === 'tool-base-node',
    );
    inputFieldList.value =
      toolBaseNode?.properties?.user_input_field_list || [];
    inputDrawerVisible.value = true;
  } catch (error: any) {
    ElMessage.error(error?.message || '获取工具详情失败');
  }
}

defineExpose({ open });
</script>

<template>
  <!-- Input Params Drawer -->
  <ElDrawer
    v-model="inputDrawerVisible"
    append-to-body
    title="调试"
    size="800px"
    :before-close="closeInputDrawer"
    :show-close="false"
  >
    <template #header>
      <div class="flex items-center" style="margin-left: -8px">
        <ElButton class="mr-4" link @click.prevent="closeInputDrawer">
          <ElIcon :size="20">
            <Back />
          </ElIcon>
        </ElButton>
        <h4>调试</h4>
      </div>
    </template>

    <h4 class="mb-4 font-medium" v-if="inputFieldList.length > 0">输入参数</h4>

    <ElForm
      v-if="inputFieldList.length > 0"
      ref="formRef"
      :model="inputForm"
      label-position="top"
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
              <span
                >{{ field.label || field.field }}
                <span class="text-red-500" v-if="field.is_required">*</span>
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
          <ElInputNumber
            v-else-if="['int', 'float'].includes(field.type)"
            v-model="inputForm[field.field]"
            class="w-full"
          />
          <ElSwitch
            v-else-if="['boolean'].includes(field.type)"
            v-model="inputForm[field.field]"
          />
          <ElInput
            v-else-if="['array', 'dict'].includes(field.type)"
            v-model="inputForm[field.field]"
            type="textarea"
            :rows="3"
            placeholder="请输入JSON格式"
          />
          <ElInput
            v-else
            v-model="inputForm[field.field]"
            placeholder="请输入"
          />
        </ElFormItem>
      </template>
    </ElForm>

    <template #footer>
      <ElButton @click="closeInputDrawer" :disabled="running">取消</ElButton>
      <ElButton type="primary" @click="runDebug" :loading="running">
        运行
      </ElButton>
    </template>
  </ElDrawer>

  <!-- Result Drawer -->
  <ElDrawer
    v-model="resultDrawerVisible"
    append-to-body
    title="调试结果"
    size="800px"
    :modal="false"
    :before-close="closeResultDrawer"
    :show-close="false"
  >
    <template #header>
      <div class="flex items-center justify-between" style="width: 100%">
        <div class="flex items-center" style="margin-left: -8px">
          <ElButton class="mr-4" link @click.prevent="closeResultDrawer">
            <ElIcon :size="20">
              <Back />
            </ElIcon>
          </ElButton>
          <h4>工作流调试结果</h4>
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

    <ElTabs v-model="activeTab">
      <ElTabPane label="输出" name="output">
        <div class="mb-4">
          <h4 class="mb-4 font-medium">回复内容</h4>
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
        </div>

        <div v-if="!running">
          <h4 class="mb-4 font-medium">输出参数</h4>
          <ElAlert
            v-if="result.errorMessage"
            :title="result.errorMessage"
            type="error"
            show-icon
            :closable="false"
            class="mb-4"
          />
          <ElAlert
            v-else-if="isSuccess"
            title="运行成功"
            type="success"
            show-icon
            :closable="false"
            class="mb-4"
          />
          <ElCard shadow="never" :class="{ 'text-red-500': !isSuccess }">
            <pre class="output-pre whitespace-pre-wrap break-words">{{
              output || '{}'
            }}</pre>
          </ElCard>
        </div>
      </ElTabPane>

      <ElTabPane label="执行详情" name="details">
        <ElScrollbar height="600px">
          <div
            v-if="result.nodeSteps.length === 0 && !running"
            class="py-8 text-center text-gray-400"
          >
            无执行详情
          </div>
          <ExecutionDetailCard
            v-for="(step, index) in result.nodeSteps"
            :key="index"
            :data="step"
            @toggle="toggleStep(index)"
          />
        </ElScrollbar>
      </ElTabPane>
    </ElTabs>

    <template #footer>
      <ElButton @click="closeResultDrawer">关闭</ElButton>
    </template>
  </ElDrawer>
</template>

<style scoped lang="scss">
.output-pre {
  padding: 12px;
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 14px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}
</style>
