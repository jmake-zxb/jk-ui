<script setup lang="ts">
import type { ApplicationDetailTab } from '../application-entry';
import type { SimpleApplicationSettings } from '../simple-application-settings';

import type { ApplicationPayload } from '#/api/ai/types';

import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import {
  ArrowLeft,
  ChatDotRound,
  Connection,
  CopyDocument,
  Delete,
  Document,
  Key,
  Lock,
  Operation,
  Promotion,
  Setting,
  TrendCharts,
  View,
} from '@element-plus/icons-vue';
import {
  ElButton,
  ElCheckbox,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDrawer,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElPagination,
  ElScrollbar,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag,
  ElTooltip,
} from 'element-plus';

import {
  getWorkflowDraft,
  publishWorkflow,
  saveWorkflowDraft,
} from '#/api/ai/application-workflow';
import {
  clearApplicationChats,
  createAccessToken,
  createApplicationKey,
  deleteApplicationChat,
  deleteApplicationKey,
  getApplication,
  openApplicationChat,
  pageAccessTokens,
  pageApplicationChatRecords,
  pageApplicationChats,
  pageApplicationKeys,
  renameApplicationChat,
  toggleAccessToken,
  toggleApplicationKey,
  updateAccessToken,
  updateApplication,
} from '#/api/ai/applications';
import { getApplicationStats } from '#/api/ai/dashboard';
import MdRenderer from '#/components/markdown/MdRenderer.vue';
import { adaptationUrl } from '#/utils/other';

import {
  prettyJson,
  recordsOf,
  safeParseJson,
  statusType,
  totalOf,
} from '../../utils';
import {
  APPLICATION_DETAIL_PATH,
  isWorkflowApplication,
} from '../application-entry';
import DisplaySettingDialog from '../DisplaySettingDialog.vue';
import EmbedDialog from '../EmbedDialog.vue';
import {
  createDefaultSimpleApplicationSettings,
  parseSimpleApplicationSettings,
  serializeSimpleApplicationGraph,
} from '../simple-application-settings';
import SimpleApplicationSettingsPanel from '../SimpleApplicationSettings.vue';
import AnnotationDialog from './AnnotationDialog.vue';

type Id = number | string;
type JsonRecord = Record<string, unknown>;

interface ChatMessage {
  content: string;
  id: number;
  pending?: boolean;
  role: 'assistant' | 'user';
}

interface ApplicationRecord extends ApplicationPayload, JsonRecord {
  create_time?: string;
  createTime?: string;
  current_publish_id?: Id;
  currentPublishId?: Id;
  desc?: string;
  id?: Id;
  publish_status?: string;
  publishStatus?: string;
  update_time?: string;
  updateTime?: string;
}

const route = useRoute();
const router = useRouter();
const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
const accessStore = useAccessStore();

const loading = ref(false);
const settingsLoading = ref(false);
const overviewLoading = ref(false);
const chatLogLoading = ref(false);
const application = ref<ApplicationRecord>();
const activeTab = ref<ApplicationDetailTab>(routeTab());
const stats = ref<JsonRecord>({});
const accessTokens = ref<JsonRecord[]>([]);
const appKeys = ref<JsonRecord[]>([]);
const apiKeyDialogOpen = ref(false);
const embedDialogRef = ref<InstanceType<typeof EmbedDialog>>();
const accessLimitDialogOpen = ref(false);
const displaySettingDialogOpen = ref(false);
const xpackDisplayDialogVisible = ref(false);
const chatRecordDrawerOpen = ref(false);
const chatRecordDrawerTitle = ref('');
const chatRecordLoading = ref(false);
const chatSessions = ref<JsonRecord[]>([]);
const chatRecords = ref<JsonRecord[]>([]);
const selectedChatId = ref<Id>();
const annotationOpen = ref(false);
const annotationChatId = ref<Id>();
const annotationRecordId = ref<Id>();
const annotationAnswer = ref('');
const annotationQuestion = ref('');
const debugChatId = ref<Id>();
const debugMessages = ref<ChatMessage[]>([]);
const debugMessage = ref('');
const debugStreaming = ref(false);
const debugBodyRef = ref<HTMLElement>();
const applicationConfig = ref('{}');
const simpleSettings = ref<SimpleApplicationSettings>(
  createDefaultSimpleApplicationSettings(),
);
let debugMessageId = 0;

const chatQuery = reactive({
  current: 1,
  page: 1,
  size: 20,
});
const chatTotal = ref(0);

const recordQuery = reactive({
  current: 1,
  page: 1,
  size: 20,
});
const recordTotal = ref(0);
const accessLimitForm = reactive({
  accessNum: 0,
  whiteActive: true,
  whiteList: '',
});
const displayForm = reactive({
  language: '',
  showExec: false,
  showSource: false,
});
const displayLangOptions = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
  { label: '繁體中文', value: 'zh-Hant' },
];

const applicationId = computed(() => routeApplicationId());
const applicationName = computed(() =>
  stringValue(
    firstValue(application.value, ['name', 'title', 'id']),
    '未命名应用',
  ),
);
const applicationDescription = computed(() =>
  stringValue(
    firstValue(application.value, ['description', 'desc']),
    '暂无描述',
  ),
);
const isWorkflowApp = computed(() =>
  isWorkflowApplication(`${application.value?.type || ''}`),
);
const applicationTypeLabel = computed(() =>
  isWorkflowApp.value ? '高级智能体' : '简易智能体',
);

function redirectWorkflowSettings() {
  const id = applicationId.value;
  if (id === undefined || id === null) return false;
  router.replace({
    name: 'AiOrchestrationApplicationWorkflow',
    params: { id },
  });
  return true;
}
const publishLabel = computed(() => (isPublished.value ? '已发布' : '未发布'));
const publishTagType = computed(() => (isPublished.value ? 'success' : 'info'));
const updatedAt = computed(() =>
  stringValue(
    firstValue(application.value, ['updateTime', 'update_time']),
    '-',
  ),
);
const createdAt = computed(() =>
  stringValue(
    firstValue(application.value, ['createTime', 'create_time']),
    '-',
  ),
);
const isPublished = computed(() => {
  if (booleanValue(firstValue(statsPayload.value, ['published']), false)) {
    return true;
  }
  if (
    firstValue(application.value, [
      'currentPublishId',
      'current_publish_id',
    ]) !== undefined
  ) {
    return true;
  }
  const status = stringValue(
    firstValue(application.value, ['publishStatus', 'publish_status']),
  ).toUpperCase();
  return ['ONLINE', 'PUBLISHED', 'RELEASED'].includes(status);
});
const statsPayload = computed<JsonRecord>(() => {
  const data = stats.value.data;
  return isRecord(data) ? data : stats.value;
});
const tokenUsage = computed<JsonRecord>(() => {
  const raw = statsPayload.value.tokenUsage;
  return isRecord(raw) ? raw : {};
});
const metricItems = computed(() => [
  { label: '对话数', value: statNumber('chatRecords') },
  { label: '运行数', value: statNumber('workflowRuns') },
  { label: '触发器', value: statNumber('triggers') },
  { label: '总 Token', value: numberValue(tokenUsage.value.totalTokens, 0) },
  {
    label: '问题 Token',
    value: numberValue(tokenUsage.value.messageTokens, 0),
  },
  { label: '回答 Token', value: numberValue(tokenUsage.value.answerTokens, 0) },
]);
const dailyChatCounts = computed(() => {
  const raw = statsPayload.value.dailyChatCounts;
  if (!isRecord(raw)) return [];
  return Object.entries(raw)
    .map(([date, count]) => ({ count: numberValue(count, 0), date }))
    .slice(-7);
});
const topQuestions = computed(() => {
  const raw = statsPayload.value.topQuestions;
  return Array.isArray(raw) ? raw.filter((item) => isRecord(item)) : [];
});
const workflowStatusCounts = computed(() => {
  const raw = statsPayload.value.workflowStatusCounts;
  if (!isRecord(raw)) return [];
  return Object.entries(raw).map(([status, count]) => ({
    count: numberValue(count, 0),
    status,
  }));
});
const primaryAccessToken = computed(() => accessTokens.value[0]);
const primaryTokenEnabled = computed(() =>
  booleanValue(
    firstValue(primaryAccessToken.value, ['enabled', 'active']),
    false,
  ),
);
const primaryTokenText = computed(() => tokenText(primaryAccessToken.value));
const publicShareUrl = computed(() => {
  const token = primaryTokenText.value;
  if (!token) return '';
  return `${window.location.origin}/ui/chat/${encodeURIComponent(token)}`;
});
const apiBaseUrl = computed(() => {
  const id = applicationId.value;
  return id ? `${window.location.origin}/ai/api/public/applications/${id}` : '';
});
const openAiUrl = computed(() => {
  const id = applicationId.value;
  return id
    ? `${window.location.origin}/ai/v1/applications/${id}/chat/completions`
    : '';
});

const navItems: Array<{
  icon: typeof View;
  label: string;
  tab: ApplicationDetailTab;
}> = [
  { icon: View, label: '概览', tab: 'overview' },
  { icon: Setting, label: '设置', tab: 'setting' },
  { icon: Document, label: '对话日志', tab: 'chat-log' },
];

function routeApplicationId(): Id | undefined {
  const value = route.params.id;
  const first = Array.isArray(value) ? value[0] : value;
  return first === null || first === undefined || first === ''
    ? undefined
    : first;
}

function routeTab(): ApplicationDetailTab {
  const value = route.params.tab;
  const first = Array.isArray(value) ? value[0] : value;
  const validTabs: ApplicationDetailTab[] = [
    'overview',
    'setting',
    'chat-log',
    'access',
    'chat-user',
  ];
  return validTabs.includes(first as ApplicationDetailTab)
    ? (first as ApplicationDetailTab)
    : 'overview';
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstValue(record: JsonRecord | undefined, keys: string[]) {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function stringValue(value: unknown, fallback = '') {
  if (value === undefined || value === null || value === '') return fallback;
  return `${value}`;
}

function idValue(value: unknown): Id | undefined {
  return typeof value === 'number' || typeof value === 'string'
    ? value
    : undefined;
}

function booleanValue(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
}

function numberValue(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function statNumber(key: string) {
  return numberValue(statsPayload.value[key], 0);
}

function tokenText(record?: JsonRecord) {
  return stringValue(
    firstValue(record, ['token', 'accessToken', 'access_token']),
  );
}

function keyText(record?: JsonRecord) {
  return stringValue(firstValue(record, ['keyValue', 'key_value', 'secret']));
}

function rowTitle(record?: JsonRecord) {
  return stringValue(
    firstValue(record, ['title', 'abstract', 'question', 'id']),
    '-',
  );
}

function rowTime(record?: JsonRecord) {
  return stringValue(
    firstValue(record, [
      'updateTime',
      'update_time',
      'createTime',
      'create_time',
    ]),
    '-',
  );
}

async function loadPage() {
  const id = applicationId.value;
  if (!id) return;
  loading.value = true;
  try {
    application.value = (await getApplication(id)) as ApplicationRecord;
    await loadCurrentTab();
  } finally {
    loading.value = false;
  }
}

async function loadCurrentTab() {
  if (activeTab.value === 'overview') {
    await loadOverview();
    return;
  }
  if (activeTab.value === 'setting') {
    if (isWorkflowApp.value) {
      redirectWorkflowSettings();
      return;
    }
    await loadSettings();
    return;
  }
  await loadChatSessions();
}

async function loadOverview() {
  const id = applicationId.value;
  if (!id) return;
  overviewLoading.value = true;
  try {
    const [statsResponse] = await Promise.all([
      getApplicationStats(id),
      loadAccessTokens(),
      loadApplicationKeys(),
    ]);
    stats.value = isRecord(statsResponse) ? statsResponse : {};
  } finally {
    overviewLoading.value = false;
  }
}

async function loadAccessTokens() {
  const id = applicationId.value;
  if (!id) return;
  accessTokens.value = recordsOf<JsonRecord>(
    await pageAccessTokens(id, { current: 1, page: 1, size: 20 }),
  );
}

async function loadApplicationKeys() {
  const id = applicationId.value;
  if (!id) return;
  appKeys.value = recordsOf<JsonRecord>(
    await pageApplicationKeys(id, { current: 1, page: 1, size: 20 }),
  );
}

async function loadSettings() {
  const id = applicationId.value;
  if (!id) return;
  settingsLoading.value = true;
  try {
    const draft = await getWorkflowDraft(id);
    const graphData = isRecord(draft)
      ? draft.graphData || draft.graph_data
      : draft;
    applicationConfig.value = stringValue(
      isRecord(draft)
        ? draft.applicationConfig || draft.application_config
        : undefined,
      '{}',
    );
    simpleSettings.value = parseSimpleApplicationSettings(
      graphData,
      application.value || {},
    );
  } finally {
    settingsLoading.value = false;
  }
}

async function loadChatSessions() {
  const id = applicationId.value;
  if (!id) return;
  chatLogLoading.value = true;
  try {
    const response = await pageApplicationChats(id, {
      current: chatQuery.current,
      page: chatQuery.page,
      size: chatQuery.size,
    });
    chatSessions.value = recordsOf<JsonRecord>(response);
    chatTotal.value = totalOf(response);
    if (
      !selectedChatId.value ||
      !chatSessions.value.some(
        (item) => `${idValue(item.id)}` === `${selectedChatId.value}`,
      )
    ) {
      selectedChatId.value = idValue(firstValue(chatSessions.value[0], ['id']));
    }
    await loadChatRecords();
  } finally {
    chatLogLoading.value = false;
  }
}

async function loadChatRecords() {
  const id = applicationId.value;
  if (!id || !selectedChatId.value) {
    chatRecords.value = [];
    recordTotal.value = 0;
    return;
  }
  chatRecordLoading.value = true;
  try {
    const response = await pageApplicationChatRecords(
      id,
      selectedChatId.value,
      {
        current: recordQuery.current,
        page: recordQuery.page,
        size: recordQuery.size,
      },
    );
    chatRecords.value = recordsOf<JsonRecord>(response);
    recordTotal.value = totalOf(response);
  } finally {
    chatRecordLoading.value = false;
  }
}

async function openDebugChat() {
  const id = applicationId.value;
  if (!id) {
    ElMessage.warning('缺少应用 ID');
    return;
  }
  const chat = await openApplicationChat(id, {
    source: 'APPLICATION_DEBUG',
    title: '调试会话',
  });
  debugChatId.value = idValue(firstValue(chat as JsonRecord, ['id']));
  debugMessages.value = [];
}

function addDebugMessage(
  role: ChatMessage['role'],
  content: string,
  pending = false,
) {
  const item: ChatMessage = {
    content,
    id: ++debugMessageId,
    pending,
    role,
  };
  debugMessages.value.push(item);
  return item;
}

async function sendDebugMessage() {
  if (debugStreaming.value) return;
  const id = applicationId.value;
  const content = debugMessage.value.trim();
  if (!id) {
    ElMessage.warning('缺少应用 ID');
    return;
  }
  if (!content) {
    ElMessage.warning('请输入消息');
    return;
  }
  if (!debugChatId.value) await openDebugChat();
  if (!debugChatId.value) return;

  const userMessage = addDebugMessage('user', content);
  const assistantMessage = addDebugMessage('assistant', '', true);
  debugMessage.value = '';
  debugStreaming.value = true;
  await scrollDebugBottom();

  try {
    const response = await fetch(
      `${apiURL}${adaptationUrl(`/ai/api/applications/${id}/chat/message/stream`)}`,
      {
        body: JSON.stringify({
          chatId: debugChatId.value,
          inputJson: '{}',
          message: userMessage.content,
        }),
        headers: {
          Authorization: accessStore.accessToken
            ? `Bearer ${accessStore.accessToken}`
            : '',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
    if (!response.ok) {
      throw new Error(
        (await response.text()) || `请求失败：${response.status}`,
      );
    }
    if (!response.body) throw new Error('聊天接口未返回流数据');
    await readDebugStream(response.body, assistantMessage);
  } catch (error) {
    assistantMessage.content = errorMessage(error);
    ElMessage.error(assistantMessage.content);
  } finally {
    assistantMessage.pending = false;
    debugStreaming.value = false;
    await scrollDebugBottom();
  }
}

async function readDebugStream(
  stream: ReadableStream<Uint8Array>,
  target: ChatMessage,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) handleDebugStreamLine(line, target);
    await scrollDebugBottom();
  }
  if (buffer.trim()) handleDebugStreamLine(buffer, target);
}

function handleDebugStreamLine(line: string, target: ChatMessage) {
  const raw = line.trim();
  if (!raw) return;
  const payloadText = raw.startsWith('data:') ? raw.slice(5).trim() : raw;
  if (!payloadText || payloadText === '[DONE]') return;
  const data = safeParseJson(payloadText, undefined);
  if (!data) {
    target.content += payloadText;
    return;
  }
  if (data.event === 'error' || data.event === 'canceled') {
    target.content = data.message || '调试失败';
    target.pending = false;
    return;
  }
  if (data.content) {
    target.content += data.content;
    return;
  }
  if (data.event === 'done' && data.payload) {
    const answer = extractDebugAnswer(data.payload);
    if (answer) target.content = answer;
  }
}

function extractDebugAnswer(payload: unknown) {
  const value =
    typeof payload === 'string' ? safeParseJson(payload, payload) : payload;
  if (typeof value === 'string') return value;
  if (!isRecord(value)) return '';
  const answer = value.content || value.answer || value.result || value.output;
  return typeof answer === 'string' ? answer : prettyJson(answer, '');
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return '调试失败';
}

async function scrollDebugBottom() {
  await nextTick();
  const el = debugBodyRef.value;
  if (el) el.scrollTop = el.scrollHeight;
}

function goBack() {
  router.push('/ai/orchestration/applications/index');
}

function goTab(tab: ApplicationDetailTab) {
  if (tab === activeTab.value) return;
  const id = applicationId.value;
  if (!id) return;
  router.push(`${APPLICATION_DETAIL_PATH}/${id}/${tab}`);
}

function goChat() {
  const token = primaryTokenText.value;
  if (!token) {
    ElMessage.warning('请先启用公开访问令牌');
    return;
  }
  router.push(`/ui/chat/${encodeURIComponent(token)}`);
}

async function copyText(text: string) {
  if (!text) {
    ElMessage.warning('暂无可复制内容');
    return;
  }
  await navigator.clipboard?.writeText(text);
  ElMessage.success('已复制');
}

async function changeAccessToken(enabled: boolean | number | string) {
  const id = applicationId.value;
  if (!id) return;
  const nextEnabled = enabled === true || enabled === 'true' || enabled === 1;
  const token = primaryAccessToken.value;
  const tokenId = idValue(firstValue(token, ['id']));

  // Toggle token
  await (!token || tokenId === undefined
    ? createAccessToken(id, {
        enabled: nextEnabled,
        name: '默认令牌',
      })
    : toggleAccessToken(id, tokenId, nextEnabled));

  // Also update application's accessEnabled field
  if (nextEnabled) {
    const payload = applicationDetailPayload({ accessEnabled: true });
    if (payload) {
      await updateApplication(id, payload);
      application.value = { ...application.value, ...payload };
    }
  }

  await loadAccessTokens();
  ElMessage.success(nextEnabled ? '访问已启用' : '访问已停用');
}

async function createKey() {
  const id = applicationId.value;
  if (!id) return;
  await createApplicationKey(id, { enabled: true, name: '默认密钥' });
  await loadApplicationKeys();
  ElMessage.success('API Key 已创建');
}

async function openApiKeyDialog() {
  apiKeyDialogOpen.value = true;
  await loadApplicationKeys();
}

async function changeKeyState(row: JsonRecord) {
  const id = applicationId.value;
  const keyId = idValue(firstValue(row, ['id']));
  if (!id || keyId === undefined) return;
  const nextEnabled = !booleanValue(firstValue(row, ['enabled']), true);
  await toggleApplicationKey(id, keyId, nextEnabled);
  await loadApplicationKeys();
  ElMessage.success(nextEnabled ? '已启用' : '已停用');
}

async function removeKey(row: JsonRecord) {
  const id = applicationId.value;
  const keyId = idValue(firstValue(row, ['id']));
  if (!id || keyId === undefined) return;
  await deleteApplicationKey(id, keyId);
  await loadApplicationKeys();
  ElMessage.success('API Key 已删除');
}

function applicationDetailPayload(
  overrides: Partial<ApplicationPayload> = {},
): ApplicationPayload | undefined {
  const source = application.value;
  if (!source) return undefined;
  return {
    accessEnabled: booleanValue(firstValue(source, ['accessEnabled']), true),
    description: stringValue(firstValue(source, ['description', 'desc'])),
    folderId: idValue(firstValue(source, ['folderId', 'folder_id'])),
    icon: stringValue(firstValue(source, ['icon']), 'App'),
    name: applicationName.value,
    showGuide: booleanValue(firstValue(source, ['showGuide']), true),
    showHistory: booleanValue(firstValue(source, ['showHistory']), true),
    showSource: booleanValue(firstValue(source, ['showSource']), true),
    type: stringValue(firstValue(source, ['type']), 'SIMPLE'),
    workspaceId: stringValue(
      firstValue(source, ['workspaceId', 'workspace_id']),
      'default',
    ),
    ...overrides,
  };
}

function openEmbedDialog() {
  embedDialogRef.value?.open(primaryTokenText.value);
}

function openAccessLimitDialog() {
  const token = primaryAccessToken.value;
  accessLimitForm.accessNum = numberValue(
    firstValue(token, ['accessNum', 'access_num']),
    0,
  );
  accessLimitForm.whiteActive = booleanValue(
    firstValue(token, ['whiteActive', 'white_active']),
    true,
  );
  const whiteList = firstValue(token, ['whiteList', 'white_list']);
  accessLimitForm.whiteList = Array.isArray(whiteList)
    ? whiteList.join('\n')
    : stringValue(whiteList);
  accessLimitDialogOpen.value = true;
}

async function saveAccessLimit() {
  const id = applicationId.value;
  const token = primaryAccessToken.value;
  const tokenId = idValue(firstValue(token, ['id']));
  if (!id || !token || tokenId === undefined) {
    ElMessage.warning('请先启用公开访问令牌');
    return;
  }

  const payload = {
    accessNum: accessLimitForm.accessNum,
    whiteActive: accessLimitForm.whiteActive,
    whiteList: accessLimitForm.whiteList
      ? accessLimitForm.whiteList.split('\n').filter(Boolean)
      : [],
  };

  await updateAccessToken(id, tokenId, payload);

  // Update local state
  token.accessNum = payload.accessNum;
  token.access_num = payload.accessNum;
  token.whiteActive = payload.whiteActive;
  token.white_active = payload.whiteActive;
  token.whiteList = payload.whiteList;
  token.white_list = payload.whiteList;

  accessLimitDialogOpen.value = false;
  ElMessage.success('保存成功');
}

function openDisplaySettingDialog() {
  const source = application.value;
  const token = primaryAccessToken.value;
  displayForm.language = stringValue(firstValue(token, ['language']));
  displayForm.showSource = booleanValue(
    firstValue(token, ['showSource', 'show_source']),
    booleanValue(firstValue(source, ['showSource']), false),
  );
  displayForm.showExec = booleanValue(
    firstValue(token, ['showExec', 'show_exec']),
    false,
  );
  displaySettingDialogOpen.value = true;
}

function openXpackDisplayDialog() {
  if (!applicationId.value) {
    ElMessage.warning('缺少应用 ID');
    return;
  }
  xpackDisplayDialogVisible.value = true;
}

async function saveDisplaySettings() {
  const id = applicationId.value;
  const payload = applicationDetailPayload({
    showSource: displayForm.showSource,
  });
  if (!id || !payload) return;

  // Save application-level settings
  await updateApplication(id, payload);
  application.value = { ...application.value, ...payload };

  // Save token-level settings
  const token = primaryAccessToken.value;
  const tokenId = idValue(firstValue(token, ['id']));
  if (token && tokenId !== undefined) {
    await updateAccessToken(id, tokenId, {
      language: displayForm.language,
      showExec: displayForm.showExec,
      showSource: displayForm.showSource,
    });
    token.language = displayForm.language;
    token.showSource = displayForm.showSource;
    token.show_source = displayForm.showSource;
    token.showExec = displayForm.showExec;
    token.show_exec = displayForm.showExec;
  }

  displaySettingDialogOpen.value = false;
  ElMessage.success('保存成功');
}

function applicationPayload(): ApplicationPayload | undefined {
  const source = application.value;
  if (!source) return undefined;
  return {
    accessEnabled: booleanValue(firstValue(source, ['accessEnabled']), true),
    description: simpleSettings.value.desc,
    folderId: idValue(firstValue(source, ['folderId', 'folder_id'])),
    icon: stringValue(firstValue(source, ['icon']), 'App'),
    name: simpleSettings.value.name.trim(),
    showGuide: booleanValue(firstValue(source, ['showGuide']), true),
    showHistory: booleanValue(firstValue(source, ['showHistory']), true),
    showSource: booleanValue(firstValue(source, ['showSource']), true),
    type: 'SIMPLE',
    workspaceId: stringValue(
      firstValue(source, ['workspaceId', 'workspace_id']),
      'default',
    ),
  };
}

async function saveSimpleSettings() {
  const id = applicationId.value;
  if (!id) return false;
  const name = simpleSettings.value.name.trim();
  if (!name) {
    ElMessage.warning('请输入应用名称');
    return false;
  }
  simpleSettings.value = { ...simpleSettings.value, name };
  const payload = applicationPayload();
  if (!payload) return false;
  settingsLoading.value = true;
  try {
    await updateApplication(id, payload);
    await saveWorkflowDraft(id, {
      applicationConfig: applicationConfig.value || '{}',
      graphData: serializeSimpleApplicationGraph(simpleSettings.value),
    });
    application.value = {
      ...application.value,
      ...payload,
      desc: payload.description,
    };
    ElMessage.success('保存成功');
    return true;
  } finally {
    settingsLoading.value = false;
  }
}

async function publishSimpleApplication() {
  const id = applicationId.value;
  if (!id) return;
  const saved = await saveSimpleSettings();
  if (!saved) return;
  settingsLoading.value = true;
  try {
    await publishWorkflow(id, { description: '从简易智能体设置发布' });
    ElMessage.success('发布成功');
    await loadPage();
  } finally {
    settingsLoading.value = false;
  }
}

function selectChat(row: JsonRecord) {
  const id = idValue(firstValue(row, ['id']));
  if (id === undefined) return;
  selectedChatId.value = id;
  chatRecordDrawerTitle.value = stringValue(
    firstValue(row, ['abstract', 'title']),
    '对话记录',
  );
  chatRecordDrawerOpen.value = true;
  recordQuery.page = 1;
  recordQuery.current = 1;
  void loadChatRecords();
}

function closeChatRecordDrawer() {
  chatRecordDrawerOpen.value = false;
  chatRecords.value = [];
  selectedChatId.value = undefined;
}

function openAnnotation(row: JsonRecord) {
  const recordId = idValue(firstValue(row, ['id']));
  const chatId =
    idValue(firstValue(row, ['chatId', 'chat_id'])) ?? selectedChatId.value;
  if (recordId === undefined || chatId === undefined) {
    ElMessage.warning('缺少聊天记录信息');
    return;
  }
  annotationChatId.value = chatId;
  annotationRecordId.value = recordId;
  annotationQuestion.value = stringValue(
    firstValue(row, ['question', 'problemText', 'problem_text']),
    '',
  );
  annotationAnswer.value = stringValue(
    firstValue(row, ['answer', 'answerText', 'answer_text']),
    '',
  );
  annotationOpen.value = true;
}

function changeChatPage(page: number) {
  chatQuery.page = page;
  chatQuery.current = page;
  void loadChatSessions();
}

function changeChatSize(size: number) {
  chatQuery.size = size;
  chatQuery.page = 1;
  chatQuery.current = 1;
  void loadChatSessions();
}

function changeRecordPage(page: number) {
  recordQuery.page = page;
  recordQuery.current = page;
  void loadChatRecords();
}

async function renameChatSession(row: JsonRecord) {
  const id = applicationId.value;
  const chatId = idValue(firstValue(row, ['id']));
  if (!id || chatId === undefined) return;
  const current = rowTitle(row);
  let title: string;
  try {
    const result = await ElMessageBox.prompt('请输入会话标题', '重命名会话', {
      cancelButtonText: '取消',
      confirmButtonText: '确定',
      inputValue: current === '-' ? '' : current,
      inputValidator: (value: string) =>
        value.trim().length > 0 || '标题不能为空',
    });
    title = result.value.trim();
  } catch {
    return;
  }
  try {
    await renameApplicationChat(id, chatId, title);
    ElMessage.success('重命名成功');
    await loadChatSessions();
  } catch (error) {
    const message = error instanceof Error ? error.message : '重命名失败';
    ElMessage.error(message);
  }
}

async function deleteChatSession(row: JsonRecord) {
  const id = applicationId.value;
  const chatId = idValue(firstValue(row, ['id']));
  if (!id || chatId === undefined) return;
  try {
    await ElMessageBox.confirm('确认删除该会话及其全部对话记录？', '提示', {
      cancelButtonText: '取消',
      confirmButtonText: '删除',
      type: 'warning',
    });
  } catch {
    return;
  }
  try {
    await deleteApplicationChat(id, chatId);
    ElMessage.success('已删除');
    if (`${selectedChatId.value}` === `${chatId}`) {
      selectedChatId.value = undefined;
      chatRecords.value = [];
      recordTotal.value = 0;
    }
    await loadChatSessions();
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除失败';
    ElMessage.error(message);
  }
}

async function clearAllChats() {
  const id = applicationId.value;
  if (!id) return;
  try {
    await ElMessageBox.confirm('确认清空全部会话及其对话记录？', '提示', {
      cancelButtonText: '取消',
      confirmButtonText: '清空',
      type: 'warning',
    });
  } catch {
    return;
  }
  try {
    await clearApplicationChats(id);
    ElMessage.success('已清空');
    selectedChatId.value = undefined;
    chatRecords.value = [];
    recordTotal.value = 0;
    await loadChatSessions();
  } catch (error) {
    const message = error instanceof Error ? error.message : '清空失败';
    ElMessage.error(message);
  }
}

watch(
  () => route.params.tab,
  async () => {
    activeTab.value = routeTab();
    await loadCurrentTab();
  },
);

watch(
  () => route.params.id,
  async () => {
    selectedChatId.value = undefined;
    chatRecords.value = [];
    debugChatId.value = undefined;
    debugMessages.value = [];
    debugMessage.value = '';
    await loadPage();
  },
);

onMounted(loadPage);
</script>

<template>
  <Page auto-content-height>
    <div class="application-detail" v-loading="loading">
      <aside class="detail-sidebar">
        <ElButton :icon="ArrowLeft" class="back-button" text @click="goBack">
          返回
        </ElButton>
        <div class="application-identity">
          <div class="application-avatar">
            {{ applicationName.slice(0, 1) }}
          </div>
          <div class="application-name" :title="applicationName">
            {{ applicationName }}
          </div>
          <ElTag :type="publishTagType" size="small">{{ publishLabel }}</ElTag>
        </div>
        <nav class="detail-nav">
          <button
            v-for="item in navItems"
            :key="item.tab"
            class="nav-item"
            :class="{ active: activeTab === item.tab }"
            type="button"
            @click="goTab(item.tab)"
          >
            <ElIcon><component :is="item.icon" /></ElIcon>
            <span>{{ item.label }}</span>
          </button>
        </nav>
      </aside>

      <main class="detail-main">
        <ElScrollbar class="detail-scrollbar">
          <div class="view-heading">
            <h2>
              {{ navItems.find((item) => item.tab === activeTab)?.label }}
            </h2>
            <div v-if="activeTab === 'setting'" class="header-actions">
              <ElButton
                :icon="Operation"
                :loading="settingsLoading"
                type="primary"
                @click="saveSimpleSettings"
              >
                保存
              </ElButton>
              <ElButton
                :icon="Promotion"
                :loading="settingsLoading"
                @click="publishSimpleApplication"
              >
                发布
              </ElButton>
            </div>
          </div>
          <section v-if="!applicationId" class="empty-state">
            <ElEmpty description="缺少应用 ID" />
          </section>

          <section
            v-else-if="activeTab === 'overview'"
            class="overview-layout"
            v-loading="overviewLoading"
          >
            <div class="content-section info-section">
              <div class="section-title">
                <span>基本信息</span>
                <ElTag size="small">{{ applicationTypeLabel }}</ElTag>
              </div>
              <div class="overview-card application-card">
                <div class="card-title-row">
                  <div class="application-avatar small">
                    {{ applicationName.slice(0, 1) }}
                  </div>
                  <div>
                    <strong>{{ applicationName }}</strong>
                    <p>{{ applicationDescription }}</p>
                  </div>
                </div>
                <ElDescriptions :column="3" border size="small">
                  <ElDescriptionsItem label="发布状态">
                    <ElTag :type="publishTagType" size="small">
                      {{ publishLabel }}
                    </ElTag>
                  </ElDescriptionsItem>
                  <ElDescriptionsItem label="创建时间">
                    {{ createdAt }}
                  </ElDescriptionsItem>
                  <ElDescriptionsItem label="更新时间">
                    {{ updatedAt }}
                  </ElDescriptionsItem>
                </ElDescriptions>
              </div>

              <div class="info-columns">
                <div class="info-block">
                  <div class="info-block__head">
                    <span>公开访问链接</span>
                    <ElSwitch
                      :model-value="primaryTokenEnabled"
                      size="small"
                      @change="changeAccessToken"
                    />
                  </div>
                  <div class="api-list">
                    <div class="api-row">
                      <span>访问链接</span>
                      <code>{{ publicShareUrl || '-' }}</code>
                      <ElTooltip content="复制" placement="top">
                        <ElButton
                          :icon="CopyDocument"
                          text
                          type="primary"
                          @click="copyText(publicShareUrl)"
                        />
                      </ElTooltip>
                    </div>
                  </div>
                  <div class="section-actions">
                    <ElButton
                      :icon="ChatDotRound"
                      :disabled="!primaryTokenEnabled || !isPublished"
                      @click="goChat"
                    >
                      去对话
                    </ElButton>
                    <ElButton
                      :icon="Connection"
                      :disabled="!primaryTokenEnabled || !isPublished"
                      @click="openEmbedDialog"
                    >
                      嵌入第三方
                    </ElButton>
                    <ElButton
                      :icon="Lock"
                      :disabled="!isPublished"
                      @click="openAccessLimitDialog"
                    >
                      访问限制
                    </ElButton>
                    <ElButton
                      :icon="Setting"
                      :disabled="!isPublished"
                      @click="openDisplaySettingDialog"
                    >
                      显示设置
                    </ElButton>
                    <ElButton
                      :icon="View"
                      :disabled="!isPublished"
                      @click="openXpackDisplayDialog"
                    >
                      展示设置
                    </ElButton>
                  </div>
                </div>

                <div class="info-block">
                  <div class="info-block__head">
                    <span>API 访问凭证</span>
                    <ElButton
                      :icon="Key"
                      size="small"
                      @click="openApiKeyDialog"
                    >
                      API Key
                    </ElButton>
                  </div>
                  <div class="api-list">
                    <div class="api-row">
                      <span>Base URL</span>
                      <code>{{ apiBaseUrl || '-' }}</code>
                      <ElButton
                        :icon="CopyDocument"
                        text
                        type="primary"
                        @click="copyText(apiBaseUrl)"
                      />
                    </div>
                    <div class="api-row">
                      <span>Chat API</span>
                      <code>{{ openAiUrl || '-' }}</code>
                      <ElButton
                        :icon="CopyDocument"
                        text
                        type="primary"
                        @click="copyText(openAiUrl)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="content-section">
              <div class="section-title">
                <span>监控统计</span>
                <ElIcon><TrendCharts /></ElIcon>
              </div>
              <div class="metric-grid">
                <div
                  v-for="item in metricItems"
                  :key="item.label"
                  class="metric-cell"
                >
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
              <div class="statistics-grid">
                <div class="stats-panel">
                  <div class="stats-title">近 7 次对话趋势</div>
                  <div v-if="dailyChatCounts.length > 0" class="bar-list">
                    <div
                      v-for="item in dailyChatCounts"
                      :key="item.date"
                      class="bar-row"
                    >
                      <span>{{ item.date }}</span>
                      <div class="bar-track">
                        <div
                          class="bar-fill"
                          :style="{
                            width: `${Math.min(item.count * 12, 100)}%`,
                          }"
                        ></div>
                      </div>
                      <strong>{{ item.count }}</strong>
                    </div>
                  </div>
                  <ElEmpty v-else description="暂无趋势数据" />
                </div>
                <div class="stats-panel">
                  <div class="stats-title">Top Questions</div>
                  <ElTable
                    v-if="topQuestions.length > 0"
                    :data="topQuestions"
                    height="220"
                    size="small"
                  >
                    <ElTableColumn
                      prop="question"
                      label="问题"
                      min-width="200"
                    />
                    <ElTableColumn prop="count" label="次数" width="90" />
                  </ElTable>
                  <ElEmpty v-else description="暂无问题统计" />
                </div>
                <div class="stats-panel">
                  <div class="stats-title">运行状态</div>
                  <div
                    v-if="workflowStatusCounts.length > 0"
                    class="status-list"
                  >
                    <div
                      v-for="item in workflowStatusCounts"
                      :key="item.status"
                      class="status-row"
                    >
                      <ElTag :type="statusType(item.status)" size="small">
                        {{ item.status }}
                      </ElTag>
                      <strong>{{ item.count }}</strong>
                    </div>
                  </div>
                  <ElEmpty v-else description="暂无运行状态" />
                </div>
              </div>
            </div>
          </section>

          <section
            v-else-if="activeTab === 'setting' && !isWorkflowApp"
            class="setting-layout"
            v-loading="settingsLoading"
          >
            <div class="setting-card">
              <div class="setting-form-panel">
                <ElScrollbar class="setting-form-scroll">
                  <SimpleApplicationSettingsPanel
                    v-model="simpleSettings"
                    :application-id="applicationId"
                  />
                </ElScrollbar>
              </div>
              <div class="setting-preview-panel">
                <div class="section-title setting-card-title">
                  <span>应用测试</span>
                </div>
                <div class="debug-preview">
                  <div ref="debugBodyRef" class="debug-chat-body">
                    <ElEmpty
                      v-if="debugMessages.length === 0"
                      description="暂无对话"
                    />
                    <div
                      v-for="item in debugMessages"
                      :key="item.id"
                      class="debug-message"
                      :class="`debug-message--${item.role}`"
                    >
                      <div class="debug-message__content">
                        {{ item.content || (item.pending ? '思考中...' : '') }}
                      </div>
                    </div>
                  </div>
                  <div class="debug-chat-input">
                    <ElInput
                      v-model="debugMessage"
                      :rows="3"
                      placeholder="输入问题"
                      type="textarea"
                      @keydown.enter.exact.prevent="sendDebugMessage"
                    />
                    <ElButton
                      :loading="debugStreaming"
                      type="primary"
                      @click="sendDebugMessage"
                    >
                      发送
                    </ElButton>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section v-else class="chat-log-layout" v-loading="chatLogLoading">
            <div class="chat-log-card">
              <div class="chat-log-toolbar">
                <div class="complex-search">
                  <ElSelect
                    class="complex-search__left"
                    model-value="abstract"
                    style="width: 82px"
                  >
                    <ElOption label="摘要" value="abstract" />
                    <ElOption label="用户" value="username" />
                  </ElSelect>
                  <ElInput
                    class="complex-search__input"
                    clearable
                    placeholder="搜索"
                  />
                </div>
                <ElSelect model-value="all" class="chat-log-day-filter">
                  <ElOption label="全部时间" value="all" />
                  <ElOption label="今天" value="today" />
                  <ElOption label="最近 7 天" value="7" />
                  <ElOption label="最近 30 天" value="30" />
                </ElSelect>
                <ElButton
                  :disabled="chatSessions.length === 0"
                  :icon="Delete"
                  @click="clearAllChats"
                >
                  清空
                </ElButton>
              </div>
              <ElTable
                :data="chatSessions"
                highlight-current-row
                class="log-table"
                height="100%"
                @row-click="selectChat"
              >
                <ElTableColumn type="selection" width="55" />
                <ElTableColumn label="摘要" min-width="220">
                  <template #default="{ row }">
                    <span class="ellipsis">{{ rowTitle(row) }}</span>
                  </template>
                </ElTableColumn>
                <ElTableColumn label="对话数量" align="right" width="110">
                  <template #default="{ row }">
                    {{
                      numberValue(
                        row.chatRecordCount || row.chat_record_count,
                        0,
                      ) || '-'
                    }}
                  </template>
                </ElTableColumn>
                <ElTableColumn label="用户" width="130">
                  <template #default="{ row }">
                    {{
                      stringValue(
                        firstValue(row, ['username', 'userName', 'user_name']),
                        '-',
                      )
                    }}
                  </template>
                </ElTableColumn>
                <ElTableColumn label="IP 地址" width="130">
                  <template #default="{ row }">
                    {{
                      stringValue(
                        firstValue(row, ['ipAddress', 'ip_address']),
                        '-',
                      )
                    }}
                  </template>
                </ElTableColumn>
                <ElTableColumn label="来源" width="130">
                  <template #default="{ row }">
                    {{
                      stringValue(
                        firstValue(row, [
                          'source',
                          'sourceType',
                          'source_type',
                        ]),
                        '-',
                      )
                    }}
                  </template>
                </ElTableColumn>
                <ElTableColumn label="最近对话时间" width="180">
                  <template #default="{ row }">{{ rowTime(row) }}</template>
                </ElTableColumn>
                <ElTableColumn label="操作" width="130" fixed="right">
                  <template #default="{ row }">
                    <ElButton
                      link
                      type="primary"
                      @click.stop="renameChatSession(row)"
                    >
                      重命名
                    </ElButton>
                    <ElButton
                      link
                      type="danger"
                      @click.stop="deleteChatSession(row)"
                    >
                      删除
                    </ElButton>
                  </template>
                </ElTableColumn>
              </ElTable>
              <ElPagination
                v-if="chatTotal > chatQuery.size"
                v-model:current-page="chatQuery.page"
                v-model:page-size="chatQuery.size"
                :total="chatTotal"
                background
                layout="prev, pager, next, sizes"
                @current-change="changeChatPage"
                @size-change="changeChatSize"
              />
            </div>
          </section>
        </ElScrollbar>
      </main>
    </div>

    <ElDialog
      v-model="apiKeyDialogOpen"
      title="API Key"
      width="1000px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      align-center
    >
      <ElButton class="dialog-create-button" type="primary" @click="createKey">
        创建
      </ElButton>
      <ElTable
        :data="appKeys"
        class="api-key-table"
        max-height="500"
        size="small"
      >
        <ElTableColumn label="API Key" min-width="320">
          <template #default="{ row }">
            <div class="api-key-cell">
              <ElTooltip :content="keyText(row)" effect="light" placement="top">
                <span>{{ keyText(row) || '-' }}</span>
              </ElTooltip>
              <ElButton
                :icon="CopyDocument"
                text
                type="primary"
                @click="copyText(keyText(row))"
              />
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="启用状态" width="110">
          <template #default="{ row }">
            <div class="state-cell">
              <ElTag
                :type="booleanValue(row.enabled, true) ? 'success' : 'info'"
                size="small"
              >
                {{ booleanValue(row.enabled, true) ? '已启用' : '已禁用' }}
              </ElTag>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="跨域设置" width="110">
          <template #default="{ row }">
            <ElTag
              :type="
                booleanValue(
                  row.allowCrossDomain || row.allow_cross_domain,
                  false,
                )
                  ? 'success'
                  : 'info'
              "
              size="small"
            >
              {{
                booleanValue(
                  row.allowCrossDomain || row.allow_cross_domain,
                  false,
                )
                  ? '已开启'
                  : '未开启'
              }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="过期时间" width="180">
          <template #default="{ row }">
            {{
              booleanValue(row.isPermanent || row.is_permanent, true)
                ? '永不过期'
                : stringValue(row.expireTime || row.expire_time, '-')
            }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="创建时间" width="170">
          <template #default="{ row }">{{ rowTime(row) }}</template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="130">
          <template #default="{ row }">
            <ElSwitch
              :model-value="booleanValue(row.enabled, true)"
              size="small"
              @change="changeKeyState(row)"
            />
            <ElButton link type="primary" @click="removeKey(row)">
              删除
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElDialog>

    <EmbedDialog ref="embedDialogRef" :application-id="applicationId" />

    <ElDialog
      v-model="accessLimitDialogOpen"
      title="访问限制"
      width="560px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <ElForm :model="accessLimitForm" class="limit-form" label-position="top">
        <ElFormItem label="每客户端每日最多访问次数">
          <div class="limit-row">
            <ElInputNumber
              v-model="accessLimitForm.accessNum"
              :min="0"
              :max="10000000"
              :step="1"
              :step-strictly="true"
              :value-on-clear="0"
              controls-position="right"
            />
            <span>次/天</span>
          </div>
        </ElFormItem>
        <ElFormItem label="白名单">
          <ElSwitch v-model="accessLimitForm.whiteActive" size="small" />
        </ElFormItem>
        <ElFormItem>
          <ElInput
            v-model="accessLimitForm.whiteList"
            placeholder="每行一个 IP 地址"
            :rows="10"
            type="textarea"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="accessLimitDialogOpen = false">取消</ElButton>
        <ElButton type="primary" @click="saveAccessLimit">保存</ElButton>
      </template>
    </ElDialog>

    <ElDialog
      v-model="displaySettingDialogOpen"
      title="显示设置"
      width="560px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <ElForm :model="displayForm" class="display-form" label-position="top">
        <ElFormItem>
          <template #label>
            <span>语言</span>
          </template>
          <ElSelect v-model="displayForm.language" clearable>
            <ElOption
              v-for="item in displayLangOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem>
          <div class="display-checkboxes">
            <ElCheckbox v-model="displayForm.showSource" label="显示引用来源" />
            <ElCheckbox v-model="displayForm.showExec" label="显示执行详情" />
          </div>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="displaySettingDialogOpen = false">取消</ElButton>
        <ElButton type="primary" @click="saveDisplaySettings">保存</ElButton>
      </template>
    </ElDialog>

    <DisplaySettingDialog
      v-model="xpackDisplayDialogVisible"
      :application-id="applicationId"
      :application-name="applicationName"
    />

    <AnnotationDialog
      v-model="annotationOpen"
      :answer="annotationAnswer"
      :application-id="applicationId"
      :chat-id="annotationChatId"
      :chat-record-id="annotationRecordId"
      :question="annotationQuestion"
    />

    <!-- Chat Record Drawer -->
    <ElDrawer
      v-model="chatRecordDrawerOpen"
      :title="chatRecordDrawerTitle"
      size="60%"
      @close="closeChatRecordDrawer"
    >
      <div v-loading="chatRecordLoading" class="chat-record-drawer-body">
        <ElScrollbar>
          <div v-if="chatRecords.length === 0" class="chat-record-empty">
            <ElEmpty description="暂无对话记录" :image-size="48" />
          </div>
          <div
            v-for="record in chatRecords"
            v-else
            :key="`${idValue(firstValue(record, ['id']))}`"
            class="chat-record-item"
          >
            <div class="chat-record-item__question">
              <div class="chat-record-item__label">问题</div>
              <div class="chat-record-item__content">
                {{
                  stringValue(
                    firstValue(record, [
                      'question',
                      'problemText',
                      'problem_text',
                    ]),
                    '-',
                  )
                }}
              </div>
            </div>
            <div class="chat-record-item__answer">
              <div class="chat-record-item__label">回答</div>
              <div class="chat-record-item__content">
                <MdRenderer
                  :source="
                    stringValue(
                      firstValue(record, [
                        'answer',
                        'answerText',
                        'answer_text',
                      ]),
                      '',
                    )
                  "
                  type="log"
                />
              </div>
            </div>
            <div class="chat-record-item__actions">
              <ElButton
                link
                type="primary"
                :icon="Document"
                @click="openAnnotation(record)"
              >
                标注
              </ElButton>
            </div>
          </div>
        </ElScrollbar>
        <div
          v-if="recordTotal > recordQuery.size"
          class="chat-record-pagination"
        >
          <ElPagination
            v-model:current-page="recordQuery.page"
            v-model:page-size="recordQuery.size"
            :total="recordTotal"
            background
            layout="prev, pager, next"
            @current-change="changeRecordPage"
          />
        </div>
      </div>
    </ElDrawer>
  </Page>
</template>

<style scoped lang="scss">
.application-detail {
  --detail-border: var(--el-border-color-lighter);
  --detail-gap: 16px;
  --detail-radius: 8px;
  --detail-sidebar-width: 240px;

  box-sizing: border-box;
  display: grid;
  grid-template-columns: var(--detail-sidebar-width) minmax(0, 1fr);
  gap: 8px;
  height: 100%;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  background: var(--el-bg-color-page);
}

.detail-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--detail-gap);
  padding: 14px;
  background: var(--el-bg-color);
  border: 1px solid var(--detail-border);
  border-radius: var(--detail-radius);
}

.back-button {
  align-self: flex-start;
  height: 32px;
  padding-right: 8px;
  padding-left: 8px;
}

.application-identity {
  display: grid;
  gap: 8px;
  justify-items: start;
  padding: 14px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--detail-border);
  border-radius: var(--detail-radius);
}

.application-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  font-weight: 600;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: var(--detail-radius);
}

.application-avatar.small {
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
}

.application-name {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.detail-nav {
  display: grid;
  gap: 4px;
}

.nav-item {
  position: relative;
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  height: 38px;
  padding: 0 10px 0 8px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--detail-radius);
}

.nav-item::before {
  width: 3px;
  height: 16px;
  content: '';
  background: transparent;
  border-radius: 999px;
}

.nav-item:hover,
.nav-item.active {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.nav-item.active::before {
  background: var(--el-color-primary);
}

.detail-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.view-heading {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  gap: var(--detail-gap);
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 8px;
  background: var(--el-bg-color-page);
}

.view-heading h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.header-actions,
.section-actions,
.card-title-row,
.status-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.header-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.header-actions :deep(.el-button) {
  height: 32px;
}

.detail-scrollbar {
  flex: 1;
  min-height: 0;
}

.overview-layout,
.setting-layout,
.chat-log-layout {
  min-height: 100%;
  padding: var(--detail-gap);
}

.overview-layout,
.setting-layout {
  display: grid;
  gap: var(--detail-gap);
}

.content-section,
.chat-session-panel,
.chat-record-panel,
.stats-panel {
  background: var(--el-bg-color);
  border: 1px solid var(--detail-border);
  border-radius: var(--detail-radius);
}

.content-section {
  display: grid;
  gap: var(--detail-gap);
  min-width: 0;
  padding: 16px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
}

.section-title {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.section-title > span:first-child {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.section-title > span:first-child::before {
  width: 3px;
  height: 14px;
  content: '';
  background: var(--el-color-primary);
  border-radius: 999px;
}

.overview-card {
  display: grid;
  gap: var(--detail-gap);
}

.info-section {
  gap: 16px;
}

.info-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--detail-gap);
  min-width: 0;
  padding-top: 4px;
}

.info-block {
  display: grid;
  gap: 10px;
  align-content: start;
  min-width: 0;
  padding-top: 12px;
  border-top: 1px solid var(--detail-border);
}

.info-block__head {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
}

.info-block__head > span {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.card-title-row {
  min-width: 0;
}

.card-title-row strong,
.card-title-row p {
  display: block;
  max-width: 760px;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-title-row p {
  margin-top: 3px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.two-column,
.statistics-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--detail-gap);
}

.copy-line {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  min-height: 34px;
  padding: 0 10px;
  overflow: hidden;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--detail-border);
  border-radius: var(--detail-radius);
}

.copy-line span,
.api-row code,
.ellipsis {
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy-line span {
  flex: 1;
}

.api-list,
.bar-list,
.status-list {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.info-block .api-list {
  align-content: start;
  min-height: 72px;
}

.api-row {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr) 32px;
  gap: 8px;
  align-items: center;
  min-width: 0;
  min-height: 34px;
  overflow: hidden;
}

.api-row span {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.api-row code {
  padding: 5px 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
  border: 1px solid var(--detail-border);
  border-radius: 4px;
}

.api-row :deep(.el-button) {
  width: 32px;
  height: 32px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(120px, 1fr));
  gap: 8px;
}

.metric-cell {
  padding: 14px;
  background: var(--el-bg-color);
  border: 1px solid var(--detail-border);
  border-top: 3px solid var(--el-color-primary-light-5);
  border-radius: var(--detail-radius);
}

.metric-cell span {
  display: block;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.metric-cell strong {
  display: block;
  margin-top: 5px;
  font-size: 22px;
  color: var(--el-text-color-primary);
}

.statistics-grid {
  grid-template-columns: 1fr 1fr 260px;
}

.stats-panel {
  min-height: 260px;
  padding: 14px;
  overflow: hidden;
}

.stats-title {
  margin-bottom: 10px;
  font-weight: 600;
}

.bar-row {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr) 44px;
  gap: 8px;
  align-items: center;
  font-size: 12px;
}

.bar-track {
  height: 8px;
  overflow: hidden;
  background: var(--el-fill-color);
  border-radius: 999px;
}

.bar-fill {
  height: 100%;
  background: var(--el-color-primary);
  border-radius: inherit;
}

.status-list {
  align-content: start;
}

.status-row {
  justify-content: space-between;
  min-height: 28px;
}

.setting-layout {
  height: calc(100vh - 154px);
  min-height: 0;
  overflow: hidden;
}

.setting-card {
  display: grid;
  grid-template-columns: minmax(420px, 10fr) minmax(520px, 14fr);
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--detail-border);
  border-radius: var(--detail-radius);
}

.setting-form-panel,
.setting-preview-panel {
  min-width: 0;
  min-height: 0;
}

.setting-preview-panel {
  padding: 24px;
  overflow: hidden;
  border-left: 1px solid var(--detail-border);
}

.setting-form-panel {
  padding: 24px 0 24px 24px;
  overflow: hidden;
}

.setting-card-title {
  margin-bottom: 16px;
}

.setting-form-scroll {
  height: calc(100% - 0px);
  padding-right: 24px;
}

.setting-layout :deep(.simple-agent-settings) {
  display: block;
}

.setting-layout :deep(.simple-agent-settings__section) {
  padding: 0;
  margin-bottom: 18px;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.debug-preview {
  display: flex;
  flex-direction: column;
  height: calc(100% - 44px);
  overflow: hidden;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--detail-border);
  border-radius: var(--detail-radius);
}

.debug-chat-body {
  flex: 1;
  min-height: 0;
  padding: 16px;
  overflow: auto;
}

.debug-message {
  display: flex;
  margin-bottom: 12px;
}

.debug-message--user {
  justify-content: flex-end;
}

.debug-message--assistant {
  justify-content: flex-start;
}

.debug-message__content {
  max-width: 78%;
  padding: 9px 12px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  background: var(--el-bg-color);
  border: 1px solid var(--detail-border);
  border-radius: 8px;
}

.debug-message--user .debug-message__content {
  color: var(--el-color-white);
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
}

.debug-chat-input {
  display: grid;
  gap: 8px;
  padding: 12px;
  background: var(--el-bg-color);
  border-top: 1px solid var(--detail-border);
}

.debug-chat-input :deep(.el-button) {
  justify-self: end;
}

.chat-log-layout {
  min-height: 100%;
}

.chat-log-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: calc(100vh - 170px);
  padding: 24px;
  background: var(--el-bg-color);
  border: 1px solid var(--detail-border);
  border-radius: var(--detail-radius);
}

.chat-log-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.complex-search {
  display: flex;
  align-items: center;
}

.complex-search__left :deep(.el-select__wrapper) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  box-shadow:
    1px 0 0 0 var(--el-border-color) inset,
    0 1px 0 0 var(--el-border-color) inset,
    0 -1px 0 0 var(--el-border-color) inset;
}

.complex-search__input {
  width: 240px;
}

.complex-search__input :deep(.el-input__wrapper) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.chat-log-day-filter {
  width: 180px;
}

.log-table {
  flex: 1;
  min-height: 420px;
}

.chat-record-item {
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid var(--detail-border);
  border-radius: var(--detail-radius);
}

.chat-record-item__question,
.chat-record-item__answer {
  margin-bottom: 12px;
}

.chat-record-item__label {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.chat-record-item__content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--el-text-color-primary);
}

.chat-record-item__actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid var(--detail-border);
}

.chat-record-drawer-body {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0 16px;
}

.chat-record-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.chat-record-pagination {
  display: flex;
  justify-content: center;
  padding: 16px 0;
  border-top: 1px solid var(--detail-border);
}

.limit-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.limit-row :deep(.el-input-number) {
  width: 268px;
}

.display-form :deep(.el-select) {
  width: 100%;
}

.display-checkboxes {
  display: grid;
  gap: 2px;
  justify-items: start;
}

.dialog-create-button {
  margin-bottom: 16px;
}

.api-key-table {
  min-height: 300px;
  margin-bottom: 16px;
}

.api-key-cell {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.api-key-cell span {
  display: block;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.api-key-cell :deep(.el-button) {
  flex-shrink: 0;
}

.state-cell {
  display: flex;
  align-items: center;
}

.empty-state {
  display: grid;
  place-items: center;
  min-height: 420px;
}

@media (max-width: 1180px) {
  .metric-grid {
    grid-template-columns: repeat(3, minmax(120px, 1fr));
  }

  .statistics-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .application-detail {
    grid-template-columns: 1fr;
  }

  .detail-sidebar {
    border: 1px solid var(--detail-border);
  }

  .detail-nav {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .info-columns,
  .two-column,
  .setting-layout,
  .chat-log-layout {
    grid-template-columns: 1fr;
  }

  .view-heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .setting-summary-panel {
    position: static;
  }

  .setting-layout :deep(.simple-agent-settings) {
    grid-template-columns: 1fr;
  }
}
</style>
