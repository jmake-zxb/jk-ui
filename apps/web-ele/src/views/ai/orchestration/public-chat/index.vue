<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
} from 'element-plus';

import {
  listApplications,
  pageApplicationChatRecords,
} from '#/api/ai/applications';
import {
  createPublicShare,
  getPublicShare,
  openAiChatCompletion,
  openPublicChat,
  publicChat,
  votePublicRecord,
} from '#/api/ai/public';

import { prettyJson, recordsOf } from '../utils';

const applications = ref<any[]>([]);
const applicationId = ref<number | string>();
const activeTab = ref('chat');
const token = ref('');
const apiKey = ref('');
const chatId = ref<number | string>();
const recordId = ref<number | string>();
const message = ref('你好');
const chatResult = ref<any>();
const records = ref<any[]>([]);
const shareToken = ref('');
const shareResult = ref<any>();
const openAiBody = reactive({
  model: 'application',
  messages: '[{"role":"user","content":"你好"}]',
});
const openAiResult = ref<any>();

async function loadApplications() {
  applications.value = recordsOf(await listApplications());
  if (!applicationId.value && applications.value.length > 0)
    applicationId.value = applications.value[0].id;
}

async function openChat() {
  const chat = await openPublicChat(applicationId.value!, {
    token: token.value,
    title: '前端公开会话',
  });
  chatId.value = chat.id;
  ElMessage.success('会话已打开');
}

async function sendChat() {
  chatResult.value = await publicChat(applicationId.value!, {
    token: token.value,
    id: chatId.value,
    message: message.value,
  });
  if (chatId.value)
    records.value = recordsOf(
      await pageApplicationChatRecords(applicationId.value!, chatId.value, {
        current: 1,
        page: 1,
        size: 20,
      }),
    );
}

async function vote(type: string) {
  if (!recordId.value) {
    ElMessage.warning('请输入记录 ID');
    return;
  }
  await votePublicRecord(applicationId.value!, recordId.value, {
    token: token.value,
    type,
    content: '前端反馈',
  });
  ElMessage.success('投票成功');
}

async function createShare() {
  if (!chatId.value) {
    ElMessage.warning('请先打开会话');
    return;
  }
  shareResult.value = await createPublicShare(
    applicationId.value!,
    chatId.value,
    { token: token.value, enabled: true },
  );
  shareToken.value =
    shareResult.value?.shareToken || shareResult.value?.token || '';
}

async function loadShare() {
  shareResult.value = await getPublicShare(shareToken.value);
}

async function sendOpenAi() {
  const messages = JSON.parse(openAiBody.messages);
  openAiResult.value = await openAiChatCompletion(
    applicationId.value!,
    { model: openAiBody.model, messages },
    apiKey.value,
  );
}

onMounted(loadApplications);
</script>

<template>
  <Page auto-content-height>
    <div class="public-page">
      <div class="toolbar">
        <ElSelect v-model="applicationId" filterable placeholder="应用">
          <ElOption
            v-for="item in applications"
            :key="item.id"
            :label="item.name || item.id"
            :value="item.id"
          />
        </ElSelect>
        <ElInput v-model="token" placeholder="访问令牌 aat_..." />
        <ElInput v-model="apiKey" placeholder="API Key ak_..." />
      </div>
      <ElTabs v-model="activeTab" class="fill-tabs">
        <ElTabPane label="公开聊天" name="chat">
          <div class="two-col">
            <section class="panel">
              <div class="panel-title">会话与消息</div>
              <ElButton type="primary" @click="openChat">打开会话</ElButton>
              <ElInput v-model="chatId" class="mt8" placeholder="Chat ID" />
              <ElInput
                v-model="message"
                class="mt8"
                type="textarea"
                :rows="7"
              />
              <ElButton class="mt8" type="primary" @click="sendChat">
                发送
              </ElButton>
              <pre class="result-box">{{
                prettyJson(chatResult, '暂无响应')
              }}</pre>
            </section>
            <section class="panel">
              <div class="panel-title">聊天记录</div>
              <ElTable :data="records" height="100%" size="small">
                <ElTableColumn prop="id" label="ID" width="100" />
                <ElTableColumn prop="messageType" label="类型" width="100" />
                <ElTableColumn prop="messageContent" label="内容" />
              </ElTable>
            </section>
          </div>
        </ElTabPane>
        <ElTabPane label="投票/分享" name="share">
          <div class="two-col">
            <section class="panel">
              <div class="panel-title">记录投票</div>
              <ElInput v-model="recordId" placeholder="Record ID" />
              <div class="mt8">
                <ElButton @click="vote('LIKE')">赞同</ElButton>
                <ElButton @click="vote('DISLIKE')">反对</ElButton>
              </div>
              <div class="panel-title mt16">分享</div>
              <ElInput v-model="shareToken" placeholder="分享 Token" />
              <div class="mt8">
                <ElButton type="primary" @click="createShare">
                  创建分享
                </ElButton>
                <ElButton @click="loadShare">查询分享</ElButton>
              </div>
            </section>
            <section class="panel">
              <pre class="result-box tall">{{
                prettyJson(shareResult, '暂无分享数据')
              }}</pre>
            </section>
          </div>
        </ElTabPane>
        <ElTabPane label="OpenAI 兼容" name="openai">
          <div class="two-col">
            <section class="panel">
              <div class="panel-title">Chat Completions</div>
              <ElInput v-model="openAiBody.model" placeholder="model" />
              <ElInput
                v-model="openAiBody.messages"
                class="mt8"
                type="textarea"
                :rows="8"
              />
              <ElButton class="mt8" type="primary" @click="sendOpenAi">
                发送兼容请求
              </ElButton>
            </section>
            <section class="panel">
              <pre class="result-box tall">{{
                prettyJson(openAiResult, '暂无 OpenAI 响应')
              }}</pre>
            </section>
          </div>
        </ElTabPane>
      </ElTabs>
    </div>
  </Page>
</template>

<style scoped lang="scss">
.public-page {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  overflow: hidden;
}

.toolbar {
  display: grid;
  grid-template-columns: 260px 1fr 1fr;
  gap: 8px;
}

.fill-tabs,
.fill-tabs :deep(.el-tabs__content),
.fill-tabs :deep(.el-tab-pane) {
  height: 100%;
}

.two-col {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 12px;
  height: 100%;
}

.panel {
  padding: 12px;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.panel-title {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
}

.mt8 {
  margin-top: 8px;
}

.mt16 {
  margin-top: 16px;
}

.result-box {
  max-height: 260px;
  padding: 8px;
  overflow: auto;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.tall {
  height: calc(100% - 16px);
  max-height: none;
}
</style>
