<script setup lang="ts">
import type { CheckboxValueType } from 'element-plus';

import type { ChatRecord } from './types/application';

import type { PublicChatMessagePayload } from '#/api/ai/public';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  reactive,
  ref,
  watch,
} from 'vue';
import { useRoute } from 'vue-router';

import { ArrowDownBold } from '@element-plus/icons-vue';
import { useElementSize } from '@vueuse/core';
import {
  ElButton,
  ElCheckbox,
  ElCheckboxGroup,
  ElIcon,
  ElScrollbar,
} from 'element-plus';
import { cloneDeep, debounce, throttle } from 'lodash-es';

import {
  chatSSE,
  getChatUserProfile,
  getFileUrl,
  openChat,
  pageChatRecords,
  postShareChat,
  postUploadFile,
  speechToText,
  workflowDebugSSE,
} from '#/api/ai/chat';
import { listActiveModels } from '#/api/ai/models';
import {
  getPublicChatRecordDetail,
  getPublicUrlFile,
  openPublicTokenChat,
  pagePublicTokenChatRecords,
  publicTokenChatStream,
  publicTokenSpeechToText,
} from '#/api/ai/public';

import AnswerContent from './component/answer-content/index.vue';
import ChatInputOperate from './component/chat-input-operate/index.vue';
import Control from './component/control/index.vue';
import InlineParams from './component/inline-params/index.vue';
import PrologueContent from './component/prologue-content/index.vue';
import QuestionContent from './component/question-content/index.vue';
import TransitionContent from './component/transition-content/index.vue';
import UserForm from './component/user-form/index.vue';
import { ChatManagement } from './types/application';
import { aiChatBus } from './utils/bus';
import {
  getWrite,
  getWriteDebug,
  hydrateChatRecordFromHistory,
} from './utils/chat';

defineOptions({ name: 'AiChat' });

const props = withDefaults(
  defineProps<{
    appId?: string;
    applicationDetails?: Record<string, any>;
    available?: boolean;
    chatId?: string;
    chatRecord?: ChatRecord;
    executionIsRightPanel?: boolean;
    publicInputJson?: string;
    publicToken?: string;
    record?: Array<ChatRecord>;
    selection?: boolean;
    type?: 'ai-chat' | 'debug-ai-chat' | 'log' | 'share';
  }>(),
  {
    appId: '',
    applicationDetails: () => ({}),
    available: true,
    chatId: '',
    chatRecord: undefined,
    publicInputJson: '',
    publicToken: '',
    record: () => [],
    type: 'ai-chat',
  },
);

const emit = defineEmits<{
  openExecutionDetail: [value: unknown];
  openParagraph: [value: Record<string, any>];
  openParagraphDocument: [
    chatRecord: Record<string, any>,
    value: Record<string, any>,
  ];
  refresh: [chatId: string];
  scroll: [event: any];
  'update:selection': [value: boolean];
}>();

declare global {
  interface Window {
    sendMessage?:
      | ((
          message: string,
          otherParamsData?: unknown,
          chat?: ChatRecord,
        ) => Promise<boolean>)
      | null;
  }
}

const route = useRoute();
const {
  params: { accessToken, id },
  query: { mode },
} = route as any;

provide('upload', (file: File) => {
  return postUploadFile(
    file,
    props.chatId || props.appId || 'TEMPORARY',
    'LLM',
  );
});

provide('getUrl', (url: string) => {
  const appId = props.appId || (props.applicationDetails as any)?.id || '';
  if (props.publicToken) {
    // Public token chat uses the public endpoint
    return getPublicUrlFile(props.publicToken, url);
  }
  if (appId) {
    // Debug / regular chat uses the internal endpoint
    return getFileUrl(appId, { url });
  }
  return Promise.reject(new Error('No application ID available for URL fetch'));
});

function createSttFormData(audioBlob: Blob): FormData {
  const fd = new FormData();
  fd.append('file', audioBlob, 'recording.mp3');
  return fd;
}

provide('stt', (audioBlob: Blob) => {
  const appId = props.appId || (props.applicationDetails as any)?.id || '';
  if (props.publicToken) {
    // Public token chat: use token-path STT endpoint
    return publicTokenSpeechToText(props.publicToken, audioBlob);
  }
  if (appId) {
    // Authenticated chat: use application-path endpoint
    return speechToText(appId, createSttFormData(audioBlob));
  }
  return Promise.reject(new Error('No application ID available for STT'));
});

provide('getSelectModelList', (params: any) => {
  return listActiveModels(params?.model_type || 'LLM').then((res: any) => {
    // 统一返回格式，兼容 MaxKB 子组件期望的数据结构
    return {
      data: Array.isArray(res) ? res : res?.data || res?.records || [],
    };
  });
});

provide('chatUserProfile', () => {
  if (props.type === 'ai-chat') {
    return getChatUserProfile().then((res: any) => res?.data || res);
  }
  return Promise.resolve(null);
});

const transcribing = ref<boolean>(false);

const aiChatRef = ref();
const { width: rootWidth } = useElementSize(aiChatRef);

const isMobile = computed(() => {
  return (
    (rootWidth.value > 0 && rootWidth.value < 768) ||
    mode === 'embed' ||
    mode === 'mobile'
  );
});

const isNarrow = computed(() => rootWidth.value > 0 && rootWidth.value < 1040);

const maxExposed = computed(() => (isNarrow.value ? 1 : 3));
const inlineExposedFields = computed<string[]>(() =>
  (
    (props.applicationDetails as any)?.work_flow?.nodes?.find(
      (v: any) => v.id === 'base-node',
    )?.properties?.user_input_field_list_setting?.exposed_fields || []
  ).slice(0, maxExposed.value),
);

const scrollDiv = ref();
const dialogScrollbar = ref();
const loading = ref(false);
const inputValue = ref<string>('');
const chartOpenId = ref<string>('');
const chatList = ref<any[]>([]);
const isSendingMessage = ref(false);
const form_data = ref<any>({});
const api_form_data = ref<any>({});
const userFormRef = ref<InstanceType<typeof UserForm>>();
const firsUserInput = ref(false);
const showUserInput = ref(false);

const initialFormData = ref({});
const initialApiFormData = ref({});

const inlineParamsRef = ref<InstanceType<typeof InlineParams>>();

const isUserInput = computed(
  () =>
    (
      (props.applicationDetails as any)?.work_flow?.nodes?.find(
        (v: any) => v.id === 'base-node',
      ) as any
    )?.properties?.user_input_field_list?.length > 0,
);

const isAPIInput = computed(
  () =>
    props.type === 'debug-ai-chat' &&
    (
      (props.applicationDetails as any).work_flow?.nodes?.find(
        (v: any) => v.id === 'base-node',
      ) as any
    )?.properties?.api_input_field_list?.length > 0,
);

const showUserInputContent = computed(() => {
  return (
    (((isUserInput.value || isAPIInput.value) && firsUserInput.value) ||
      showUserInput.value) &&
    props.type !== 'log'
  );
});

watch(
  () => props.chatId,
  (val) => {
    if (val && val !== 'new') {
      chartOpenId.value = val;
      firsUserInput.value = false;
    } else {
      chartOpenId.value = '';
    }
  },
  { deep: true, immediate: true },
);

watch(chartOpenId, async (chatIdValue, oldValue) => {
  if (
    !chatIdValue ||
    chatIdValue === 'new' ||
    props.type === 'debug-ai-chat' ||
    props.type === 'share' ||
    isSendingMessage.value
  ) {
    return;
  }

  // 如果 chatId 没有变化，不加载历史
  if (chatIdValue === oldValue) {
    return;
  }

  const appId = String(
    props.appId ||
      (props.applicationDetails as Record<string, unknown>)?.id ||
      '',
  );
  if (!appId) return;

  // Clear current chat list before loading new history
  chatList.value = [];

  const records = await loadChatHistory(appId, chatIdValue);
  if (records.length > 0) {
    chatList.value = records;
  }
});

watch(
  () => props.applicationDetails,
  () => {
    chartOpenId.value = '';
  },
  { deep: true },
);

watch(
  () => props.record,
  (value) => {
    chatList.value = value || [];
  },
  { immediate: true },
);

const checkAll = ref(false);
const multipleSelectionChat = ref<any[]>([]);
const shareLoading = ref(false);

watch(
  () => props.selection,
  (value) => {
    if (value) {
      if (value && multipleSelectionChat.value.length === 0) {
        multipleSelectionChat.value = chatList.value.map((v) => v.record_id);
        checkAll.value = true;
      }
    } else {
      checkAll.value = false;
      multipleSelectionChat.value = [];
    }
  },
  { immediate: true },
);

function shareChatHandle() {
  const appId = (props.appId ||
    id ||
    (props.applicationDetails as any)?.id) as string;

  // 过滤出当前聊天列表中存在的 record_id
  const validIds = new Set(chatList.value.map((v) => v.record_id));
  const selectedIds = multipleSelectionChat.value.filter((id: any) =>
    validIds.has(id),
  );

  const obj = {
    chat_record_ids: selectedIds,
    is_current_all: checkAll.value,
  };

  postShareChat(appId, chartOpenId.value, obj).then((res: any) => {
    const token = res?.shareToken || res?.share_token;
    if (token) {
      navigator.clipboard?.writeText(
        `${window.location.origin}/chat/share/${token}`,
      );
    }
  });
}

const handleCheckAllChange = (val: CheckboxValueType) => {
  const checked = Boolean(val);
  multipleSelectionChat.value = checked
    ? chatList.value.map((v) => v.record_id)
    : [];
  checkAll.value = checked;
};

const handleCheckedChatChange = (value: any[]) => {
  const checkedCount = value.length;
  checkAll.value = checkedCount === chatList.value.length;
};

function toggleSelect(id: number) {
  if (props.selection) {
    const index = multipleSelectionChat.value.indexOf(id);
    if (index === -1) {
      multipleSelectionChat.value.push(id);
    } else {
      multipleSelectionChat.value.splice(index, 1);
    }
    checkAll.value =
      multipleSelectionChat.value.length === chatList.value.length;
  }
}

const handleOpenDialog = () => {
  showUserInput.value = true;
  initialFormData.value = cloneDeep(form_data.value);
  initialApiFormData.value = cloneDeep(api_form_data.value);
};

const toggleUserInput = () => {
  showUserInput.value = !showUserInput.value;
  if (showUserInput.value) {
    initialFormData.value = cloneDeep(form_data.value);
    initialApiFormData.value = cloneDeep(api_form_data.value);
  }
};

function cancelCheckHandle() {
  checkAll.value = false;
  multipleSelectionChat.value = [];
  emit('update:selection', false);
}

function UserFormCancel() {
  form_data.value = cloneDeep(initialFormData.value);
  api_form_data.value = cloneDeep(initialApiFormData.value);
  userFormRef.value?.render(form_data.value);
  showUserInput.value = false;
}

function UserFormConfirm() {
  firsUserInput.value = false;
  showUserInput.value = false;
}

const validate = () => {
  return inlineParamsRef.value?.validate() || Promise.resolve(true);
};

function sendMessage(
  val: string,
  other_params_data?: any,
  chat?: ChatRecord,
): Promise<boolean> {
  if (isUserInput.value) {
    return userFormRef.value
      ? userFormRef.value
          ?.validate()
          .then(() => {
            const userFormData = accessToken
              ? JSON.parse(
                  localStorage.getItem(`${accessToken}userForm`) || '{}',
                )
              : {};
            const newData: Record<string, any> = {};
            for (const key of Object.keys(form_data.value)) {
              newData[key] = Object.prototype.hasOwnProperty.call(
                userFormData,
                key,
              )
                ? userFormData[key]
                : form_data.value[key];
            }
            if (accessToken) {
              localStorage.setItem(
                `${accessToken}userForm`,
                JSON.stringify(newData),
              );
            }

            showUserInput.value = false;

            const isFormResume = !!other_params_data?.runtime_node_id;
            if (
              isFormResume ||
              (!loading.value && props.applicationDetails?.name)
            ) {
              if (isFormResume) {
                chatMessage(chat, val, false, other_params_data);
              } else {
                handleDebounceClick(val, other_params_data, chat);
              }
              return true;
            }
            throw new Error('err: no send');
          })
          .catch(() => {
            showUserInput.value = !(
              isAPIInput.value && props.type !== 'debug-ai-chat'
            );
            return false;
          })
      : Promise.reject(new Error('no user form ref'));
  } else {
    showUserInput.value = false;
    const isFormResume = !!other_params_data?.runtime_node_id;
    if ((isFormResume || !loading.value) && props.applicationDetails?.name) {
      if (isFormResume) {
        // Form resume: skip debounce, execute directly
        chatMessage(chat, val, false, other_params_data);
      } else {
        handleDebounceClick(val, other_params_data, chat);
      }
      return Promise.resolve(true);
    }
    if (!props.applicationDetails?.name) {
      return Promise.reject(new Error('no application name'));
    }
    // Loading still in progress for non-resume calls
    return Promise.reject(new Error('previous request still in progress'));
  }
}

const handleDebounceClick = debounce(
  (val: string, other_params_data?: any, chat?: ChatRecord) => {
    chatMessage(chat, val, false, other_params_data);
  },
  200,
);

const openChatId = (): Promise<string> => {
  if (props.publicToken) {
    return openPublicTokenChat(props.publicToken, {
      title: String(props.applicationDetails?.name || '公开会话'),
    }).then((res: unknown) => {
      const chatId = getOpenChatIdFromResponse(res);
      chartOpenId.value = chatId;
      return chatId;
    });
  }

  const appId = (props.appId ||
    (props.applicationDetails as any)?.id) as string;
  return openChat(appId).then((res: any) => {
    const chatId = String(res?.id || res);
    chartOpenId.value = chatId;
    return chatId;
  });
};

function getOpenChatIdFromResponse(response: unknown) {
  const candidates: unknown[] = [response];
  if (isRecordObject(response)) {
    candidates.push(response.id, response.chatId, response.data);
    if (isRecordObject(response.data)) {
      candidates.push(response.data.id, response.data.chatId);
    }
  }

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return `${candidate}`;
    }
  }
  return '';
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function optionalId(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
}

function optionalBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

function optionalRecord(value: unknown) {
  return isRecordObject(value) ? value : undefined;
}

function optionalList(value: unknown) {
  return Array.isArray(value) ? value : undefined;
}

function normalizePublicWorkflowPayload(
  value: unknown,
): Partial<PublicChatMessagePayload> {
  if (!isRecordObject(value)) return {};

  const payload: Partial<PublicChatMessagePayload> = {};
  const runtimeNodeId =
    optionalString(value.runtimeNodeId) ??
    optionalString(value.runtime_node_id);
  const nodeData =
    optionalRecord(value.nodeData) ?? optionalRecord(value.node_data);
  const chatRecordId =
    optionalId(value.chatRecordId) ?? optionalId(value.chat_record_id);
  const childNode =
    optionalRecord(value.childNode) ?? optionalRecord(value.child_node);
  const nodeId = optionalString(value.nodeId) ?? optionalString(value.node_id);
  const reChat =
    optionalBoolean(value.reChat) ?? optionalBoolean(value.re_chat);

  if (runtimeNodeId) payload.runtimeNodeId = runtimeNodeId;
  if (nodeData) {
    payload.nodeData = nodeData;
    payload.formDataJson = JSON.stringify(nodeData);
  }
  if (optionalString(value.formDataJson)) {
    payload.formDataJson = optionalString(value.formDataJson);
  }
  if (chatRecordId !== undefined) payload.chatRecordId = chatRecordId;
  if (childNode) payload.childNode = childNode;
  if (nodeId) payload.nodeId = nodeId;
  if (reChat !== undefined) payload.reChat = reChat;

  payload.imageList =
    optionalList(value.imageList) ?? optionalList(value.image_list);
  payload.documentList =
    optionalList(value.documentList) ?? optionalList(value.document_list);
  payload.audioList =
    optionalList(value.audioList) ?? optionalList(value.audio_list);
  payload.videoList =
    optionalList(value.videoList) ?? optionalList(value.video_list);
  payload.otherList =
    optionalList(value.otherList) ?? optionalList(value.other_list);

  return Object.fromEntries(
    Object.entries(payload).filter(([, item]) => item !== undefined),
  ) as Partial<PublicChatMessagePayload>;
}

function publicWorkflowFormData(value: unknown) {
  const source = isRecordObject(value) ? value : {};
  return {
    ...form_data.value,
    ...api_form_data.value,
    ...optionalRecord(source.formData),
    ...optionalRecord(source.form_data),
  };
}

function normalizePrivateWorkflowPayload(value: unknown) {
  if (!isRecordObject(value)) return {};

  const payload: Record<string, unknown> = {};
  const runtimeNodeId =
    optionalString(value.runtimeNodeId) ??
    optionalString(value.runtime_node_id);
  const nodeData =
    optionalRecord(value.nodeData) ?? optionalRecord(value.node_data);
  const chatRecordId =
    optionalId(value.chatRecordId) ?? optionalId(value.chat_record_id);
  const childNode =
    optionalRecord(value.childNode) ?? optionalRecord(value.child_node);
  const nodeId = optionalString(value.nodeId) ?? optionalString(value.node_id);
  const reChat =
    optionalBoolean(value.reChat) ?? optionalBoolean(value.re_chat);

  if (runtimeNodeId) payload.runtimeNodeId = runtimeNodeId;
  if (nodeData) {
    payload.nodeData = nodeData;
    payload.formDataJson = JSON.stringify(nodeData);
  }
  if (optionalString(value.formDataJson)) {
    payload.formDataJson = optionalString(value.formDataJson);
  }
  if (chatRecordId !== undefined) payload.chatRecordId = chatRecordId;
  if (childNode) payload.childNode = childNode;
  if (nodeId) payload.nodeId = nodeId;
  if (reChat !== undefined) payload.reChat = reChat;

  const imageList =
    optionalList(value.imageList) ?? optionalList(value.image_list);
  const documentList =
    optionalList(value.documentList) ?? optionalList(value.document_list);
  const audioList =
    optionalList(value.audioList) ?? optionalList(value.audio_list);
  const videoList =
    optionalList(value.videoList) ?? optionalList(value.video_list);
  const otherList =
    optionalList(value.otherList) ?? optionalList(value.other_list);

  if (imageList) payload.imageList = imageList;
  if (documentList) payload.documentList = documentList;
  if (audioList) payload.audioList = audioList;
  if (videoList) payload.videoList = videoList;
  if (otherList) payload.otherList = otherList;

  return payload;
}

function privateWorkflowFormData(value: unknown) {
  const source = isRecordObject(value) ? value : {};
  return {
    ...form_data.value,
    ...api_form_data.value,
    ...optionalRecord(source.formData),
    ...optionalRecord(source.form_data),
  };
}

function getRecordArrayFromPageResponse(
  response: unknown,
): Array<Record<string, unknown>> {
  const candidates: unknown[] = [response];
  if (isRecordObject(response)) {
    candidates.push(
      response.records,
      response.rows,
      response.list,
      response.data,
    );
    if (isRecordObject(response.data)) {
      candidates.push(
        response.data.records,
        response.data.rows,
        response.data.list,
      );
    }
  }

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item) => isRecordObject(item));
    }
  }
  return [];
}

async function loadChatHistory(
  applicationId: string,
  chatId: string,
): Promise<ChatRecord[]> {
  try {
    // Use public token endpoint when in public chat mode
    const res = props.publicToken
      ? await pagePublicTokenChatRecords(props.publicToken, chatId, {
          current: 1,
          size: 100,
        })
      : await pageChatRecords(applicationId, chatId, { current: 1, size: 100 });
    const rawRecords = getRecordArrayFromPageResponse(res);
    return rawRecords.map((item) => hydrateChatRecordFromHistory(item));
  } catch {
    return [];
  }
}

function getSourceDetail(row: any) {
  if (row.record_id) {
    const appId = (props.appId ||
      (props.applicationDetails as any)?.id) as string;
    const chatId = String(row.chat_id || chartOpenId.value || '');
    if (!chatId) {
      return Promise.resolve();
    }
    // Use dedicated single-record detail endpoint when available (public token path)
    if (props.publicToken) {
      return getPublicChatRecordDetail(props.publicToken, row.record_id)
        .then((res: any) => {
          const data = res?.data ?? res;
          if (!data) return;
          const exclude_keys = new Set([
            'answer_text',
            'answer_text_list',
            'id',
          ]);
          Object.keys(data).forEach((key) => {
            if (!exclude_keys.has(key)) {
              row[key] = data[key];
            }
          });
        })
        .catch(() => {
          // Fallback to paged lookup if dedicated endpoint fails
          return pagedRecordLookup(row, appId, chatId);
        });
    }
    return pagedRecordLookup(row, appId, chatId);
  }
  return Promise.resolve();
}

function pagedRecordLookup(row: any, appId: string, chatId: string) {
  return pageChatRecords(appId, chatId, { current: 1, size: 100 }).then(
    (res) => {
      const data = getRecordArrayFromPageResponse(res).find(
        (item) =>
          String(item.record_id ?? item.id ?? '') === String(row.record_id),
      );
      if (!data) return;
      const exclude_keys = new Set(['answer_text', 'answer_text_list', 'id']);
      Object.keys(data).forEach((key) => {
        if (!exclude_keys.has(key)) {
          row[key] = data[key];
        }
      });
    },
  );
}

function getChartOpenId(
  chat?: any,
  problem?: string,
  re_chat?: boolean,
  other_params_data?: any,
) {
  isSendingMessage.value = true;
  return openChatId().then(() => {
    chatMessage(chat, problem, re_chat, other_params_data);
    // 延迟重置标志，给 watch 时间处理
    setTimeout(() => {
      isSendingMessage.value = false;
    }, 500);
  });
}

const errorWrite = (chat: any, message?: string) => {
  ChatManagement.addChatRecord(chat, 50, loading);
  ChatManagement.write(chat.id);
  ChatManagement.append(chat.id, message || '服务器异常，请稍后重试');
  ChatManagement.updateStatus(chat.id, 500);
  ChatManagement.close(chat.id);
};

function chatMessage(
  chat?: any,
  problem?: string,
  re_chat?: boolean,
  other_params_data?: any,
) {
  loading.value = true;
  if (!chat) {
    chat = reactive({
      answer_text: '',
      answer_text_list: [[]],
      buffer: [],
      chat_id: '',
      currentNodeName: '',
      id: `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      is_stop: false,
      problem_text: problem || inputValue.value.trim(),
      reasoning_content: '',
      reasoning_content_buffer: [],
      record_id: '',
      status: undefined,
      upload_meta: {
        audio_list: other_params_data?.audio_list || [],
        document_list: other_params_data?.document_list || [],
        image_list: other_params_data?.image_list || [],
        other_list: other_params_data?.other_list || [],
        video_list: other_params_data?.video_list || [],
      },
      vote_status: '-1',
      write_ed: false,
    } as ChatRecord);
    chatList.value.push(chat);
    ChatManagement.addChatRecord(chat, 50, loading);
    ChatManagement.write(chat.id);
    inputValue.value = '';
    nextTick(() => {
      scrollDiv.value.setScrollTop(getMaxHeight());
    });
  }
  if (chat.run_time) {
    ChatManagement.addChatRecord(chat, 50, loading);
  }
  // 无论是新对话还是表单恢复，都需要启动打字机
  ChatManagement.write(chat.id);
  if (props.type === 'debug-ai-chat') {
    // 工作流调试模式 — 统一使用 workflowDebugSSE
    // runtimeNodeId / formDataJson / chatId 存在时为表单恢复，
    // 缺失时为全新调试，后端自动区分。
    const appId = props.appId || (props.applicationDetails as any)?.id;
    if (!appId) return;

    const handleResponse = (response: Response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      nextTick(() => {
        scrollDiv.value.setScrollTop(getMaxHeight());
      });
      const reader = response.body?.getReader();
      if (reader) {
        const write = getWriteDebug(chat, reader);
        write()
          .catch((error: any) => {
            errorWrite(chat, `${error}`);
          })
          .finally(() => {
            if (!chat.write_ed) ChatManagement.markDone(chat.id);
          });
      } else {
        ChatManagement.close(chat.id);
      }
    };

    // Build debug request — runtimeNodeId/formDataJson/chatId present
    // when resuming from form interrupt; absent for fresh debug
    const debugObj: Parameters<typeof workflowDebugSSE>[1] &
      Record<string, any> = {
      formData: { ...form_data.value, ...api_form_data.value },
      message: chat.problem_text,
    };

    // Merge form-resume fields if present (from FormRander submit)
    if (other_params_data) {
      if (other_params_data.runtime_node_id) {
        debugObj.runtimeNodeId = other_params_data.runtime_node_id;
      }
      if (other_params_data.node_data) {
        debugObj.formDataJson = JSON.stringify(other_params_data.node_data);
      }
      if (other_params_data.chat_record_id) {
        debugObj.chatRecordId = other_params_data.chat_record_id;
      }
      if (other_params_data.child_node) {
        debugObj.childNode = other_params_data.child_node;
      }
      // chatId: from chat.chat_id (set by SSE runId during initial debug)
      if (chat.chat_id) {
        debugObj.chatId = chat.chat_id;
      }
      // Also spread remaining other_params_data for backward compatibility
      Object.assign(debugObj, other_params_data);
    }

    workflowDebugSSE(appId, debugObj)
      .then(handleResponse)
      .catch((error: any) => {
        errorWrite(chat, `${error}`);
      });
  } else if (chartOpenId.value) {
    if (props.publicToken) {
      const extraPayload = normalizePublicWorkflowPayload(other_params_data);
      const obj: PublicChatMessagePayload = {
        chatId: chartOpenId.value,
        formData: publicWorkflowFormData(other_params_data),
        inputJson: props.publicInputJson || '{}',
        message: chat.problem_text,
        reChat: re_chat || false,
        stream: true,
        ...extraPayload,
      };
      publicTokenChatStream(props.publicToken, obj)
        .then((response) => {
          if (!response.ok) {
            if (response.status === 460) {
              throw new Error('身份验证失败，请重新认证');
            }
            if (response.status === 461) {
              throw new Error('对话次数已达上限');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          nextTick(() => {
            scrollDiv.value.setScrollTop(getMaxHeight());
          });
          const reader = response.body?.getReader();
          if (reader) {
            const write = getWriteDebug(chat, reader);
            write()
              .catch((error: unknown) => {
                errorWrite(chat, `${error}`);
              })
              .finally(() => {
                ChatManagement.markDone(chat.id);
              });
          } else {
            ChatManagement.close(chat.id);
          }
        })
        .catch((error: unknown) => {
          errorWrite(chat, `${error}`);
        });
      return;
    }

    const applicationId = String(
      props.appId ||
        (props.applicationDetails as Record<string, unknown>)?.id ||
        '',
    );
    if (!applicationId) {
      errorWrite(chat, 'No application ID available for chat');
      return;
    }
    chat.chat_id = chat.chat_id || chartOpenId.value;
    const obj = {
      chatId: chartOpenId.value,
      formData: privateWorkflowFormData(other_params_data),
      message: chat.problem_text,
      reChat: re_chat || false,
      stream: true,
      ...normalizePrivateWorkflowPayload(other_params_data),
    };
    // SSE 流式对话
    chatSSE(applicationId, obj)
      .then((response: any) => {
        nextTick(() => {
          scrollDiv.value.setScrollTop(getMaxHeight());
        });
        // 处理流数据
        const reader = response.body?.getReader();
        if (reader) {
          const write = getWrite(chat, reader, true);
          write()
            .then(() => {
              if (props.chatId === 'new') {
                emit('refresh', chartOpenId.value);
              }
              getSourceDetail(chat);
            })
            .catch((error: any) => {
              errorWrite(chat, `${error}`);
            })
            .finally(() => {
              ChatManagement.markDone(chat.id);
            });
        } else {
          // 非流式响应
          const contentType = response.headers?.get?.('Content-Type') || '';
          if (contentType.includes('application/json')) {
            return response.json?.().then((data: any) => {
              if (data.code === 500) {
                errorWrite(chat, data.message);
              } else {
                const content = data.data || data.answer || data.content || '';
                if (content) ChatManagement.append(chat.id, content);
                getSourceDetail(chat);
              }
            });
          }
          ChatManagement.close(chat.id);
        }
      })
      .catch((error: any) => {
        errorWrite(chat, `${error}`);
      });
  } else {
    getChartOpenId(chat, problem, re_chat, other_params_data).catch(() => {
      errorWrite(chat);
    });
  }
}

const scrollTop = ref(0);
const scorll = ref(true);
const isBottom = ref(false);

const getMaxHeight = () => {
  return dialogScrollbar.value!.scrollHeight;
};

const handleScrollTop = ($event: any) => {
  scrollTop.value = $event.scrollTop;
  scorll.value =
    dialogScrollbar.value.scrollHeight -
      (scrollTop.value + scrollDiv.value.wrapRef.offsetHeight) <=
    40;
  isBottom.value =
    scrollTop.value + scrollDiv.value.wrapRef.offsetHeight <
    dialogScrollbar.value!.scrollHeight;
  emit('scroll', {
    ...$event,
    dialogScrollbar: dialogScrollbar.value,
    scrollDiv: scrollDiv.value,
  });
};

const handleScroll = () => {
  if (
    props.type !== 'log' &&
    scrollDiv.value &&
    scrollDiv.value.wrapRef.offsetHeight < dialogScrollbar.value.scrollHeight
  ) {
    const isNearBottom =
      dialogScrollbar.value.scrollHeight -
        (scrollTop.value + scrollDiv.value.wrapRef.offsetHeight) <=
      40;
    if (scorll.value || isNearBottom) {
      scrollDiv.value.setScrollTop(dialogScrollbar.value.scrollHeight);
    }
  }
};

const handleTranscribing = (status: boolean) => {
  transcribing.value = status;
  nextTick(() => {
    if (scorll.value) {
      scrollDiv.value?.setScrollTop(getMaxHeight());
    }
  });
};

const handleShareClick = (id: string) => {
  multipleSelectionChat.value.push(id);
  checkAll.value = multipleSelectionChat.value.length === chatList.value.length;
  emit('update:selection', true);
};

// --- 图片缩放处理 ---
function parseTransform(transformStr: string) {
  const result = { scale: 1, translateX: 0, translateY: 0, translateZ: 0 };

  if (!transformStr || transformStr === 'none') return result;

  // 使用正则表达式匹配 scale 和 translate3d 的值
  const scaleMatch = transformStr.match(/scale\(([^)]+)\)/);
  const translateMatch = transformStr.match(/translate3d\(([^)]+)\)/);

  if (scaleMatch) {
    // scale可能是一个值，也可能是两个值（scaleX, scaleY）
    const scaleValues = scaleMatch[1]
      .split(',')
      .map((v) => Number.parseFloat(v.trim()));
    result.scale = scaleValues[0];
  }

  if (translateMatch) {
    const translateValues = translateMatch[1]
      .split(',')
      .map((v) => Number.parseFloat(v.trim()));
    [result.translateX, result.translateY, result.translateZ] = translateValues;
  }

  return result;
}

const handleImageZoom = throttle((event: WheelEvent, target: HTMLElement) => {
  // 解析当前变换状态
  const currentTransform = target.style.transform;
  const transformValues = parseTransform(currentTransform);
  const { scale, translateX, translateY } = transformValues;
  // 确保scale是数值类型
  const currentScale = Array.isArray(scale) ? scale[0] : scale;

  // 计算缩放方向和新的缩放比例
  const zoomIntensity = 0.05; // 每次滚轮的缩放步长
  const zoomFactor = event.deltaY < 0 ? 1 + zoomIntensity : 1 - zoomIntensity;
  const newScale = Math.max(0.1, currentScale * zoomFactor); // 设置最小缩放限制

  // 计算新的平移值
  const newTranslateX = (translateX * currentScale) / newScale;
  const newTranslateY = (translateY * currentScale) / newScale;

  // 应用新的变换
  target.style.transform = `scale(${newScale}) translate3d(${newTranslateX}px, ${newTranslateY}px, 0px)`;
}, 50); // 50ms 内只执行一次

function handleWheel(event: WheelEvent) {
  if (event.target) {
    const target = event.target as HTMLElement;
    // 假设打开状态的图片具有特定类名
    if (target.classList && target.classList.contains('medium-zoom-overlay')) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (
      target.classList &&
      target.classList.contains('medium-zoom-image--opened')
    ) {
      event.preventDefault();
      event.stopPropagation();
      handleImageZoom(event, target);
    }
  }
}

onMounted(() => {
  // Expose sendMessage globally for embed integration (parent window can call window.sendMessage)
  window.sendMessage = sendMessage;

  // debug-ai-chat 模式：若含 API 输入字段用全屏 UserForm，
  // 若仅有用户输入字段则走 InlineParams 内联方式，不弹全屏表单。
  if (props.type === 'debug-ai-chat' && isAPIInput.value) {
    firsUserInput.value = true;
  }

  if (
    isUserInput.value &&
    accessToken &&
    localStorage.getItem(`${accessToken}userForm`)
  ) {
    const userFormData = JSON.parse(
      localStorage.getItem(`${accessToken}userForm`) || '{}',
    );
    form_data.value = userFormData;
  }

  aiChatBus.on('on:transcribing', handleTranscribing);
  aiChatBus.on('click:share', handleShareClick);

  // 图片缩放事件监听
  document.body.addEventListener('wheel', handleWheel, { passive: false });
});

onBeforeUnmount(() => {
  aiChatBus.off('on:transcribing', handleTranscribing);
  aiChatBus.off('click:share', handleShareClick);
  window.sendMessage = null;

  // 清理图片缩放事件监听
  document.body.removeEventListener('wheel', handleWheel);
});

function setScrollBottom() {
  scrollDiv.value.setScrollTop(getMaxHeight());
}

watch(
  chatList,
  () => {
    nextTick(() => {
      handleScroll();
    });
  },
  { deep: true, immediate: true },
);

defineExpose({
  loading,
  setScrollBottom,
  toggleUserInput,
});
</script>

<template>
  <div
    ref="aiChatRef"
    class="ai-chat"
    :class="type"
    :style="{
      height: firsUserInput ? '100%' : undefined,
    }"
  >
    <div
      v-show="showUserInputContent"
      :class="firsUserInput ? 'firstUserInput' : 'popperUserInput'"
    >
      <UserForm
        ref="userFormRef"
        v-model:api-form-data="api_form_data"
        v-model:form-data="form_data"
        :application="applicationDetails as any"
        :exclude-fields="inlineExposedFields"
        :first="firsUserInput"
        :title="
          (applicationDetails as any)?.work_flow?.nodes?.find(
            (v: any) => v.id === 'base-node',
          )?.properties?.user_input_field_list_setting?.menu_title ||
          (applicationDetails as any)?.work_flow?.nodes?.find(
            (v: any) => v.id === 'base-node',
          )?.properties?.user_input_config?.title
        "
        :type="type"
        @cancel="UserFormCancel"
        @confirm="UserFormConfirm"
      />
    </div>
    <template
      v-if="!(isUserInput || isAPIInput) || !firsUserInput || type === 'log'"
    >
      <ElScrollbar ref="scrollDiv" @scroll="handleScrollTop">
        <div
          ref="dialogScrollbar"
          id="chatListId"
          class="ai-chat__content g-p-16"
          :style="{ marginBottom: selection ? '65px' : '' }"
        >
          <PrologueContent
            v-if="!selection"
            :application="applicationDetails"
            :available="available"
            :send-message="sendMessage"
            :type="type"
          />
          <ElCheckboxGroup
            v-model="multipleSelectionChat"
            @change="handleCheckedChatChange"
          >
            <template v-for="(item, index) in chatList" :key="index">
              <div class="flex-between w-full">
                <ElCheckbox v-if="selection" :value="item.record_id" />
                <div
                  class="w-full"
                  :class="[
                    selection ? 'cursor mb-8 mt-8 p-12' : 'mt-24',
                    multipleSelectionChat.includes(item.record_id)
                      ? 'is-selected'
                      : '',
                  ]"
                  @click="toggleSelect(item.record_id)"
                >
                  <QuestionContent
                    :application="applicationDetails"
                    :chat-management="ChatManagement"
                    :chat-record="item"
                    :is-last="index >= chatList.length - 1"
                    :send-message="sendMessage"
                    :selection="selection"
                    :type="type"
                  />
                </div>
              </div>
              <div class="align-center flex w-full">
                <ElCheckbox v-if="selection" :value="item.record_id" />
                <div
                  class="w-full"
                  :class="[
                    selection ? 'cursor p-12' : '',
                    multipleSelectionChat.includes(item.record_id)
                      ? 'is-selected'
                      : '',
                  ]"
                  @click="toggleSelect(item.record_id)"
                >
                  <AnswerContent
                    :application="applicationDetails"
                    :chat-management="ChatManagement"
                    v-model:chat-record="chatList[index]"
                    :execution-is-right-panel="props.executionIsRightPanel"
                    :loading="loading"
                    :send-message="sendMessage"
                    :selection="selection"
                    :share-available="!props.publicToken"
                    :type="type"
                    @open-execution-detail="
                      (val: any) =>
                        emit('openExecutionDetail', val ?? chatList[index])
                    "
                    @open-paragraph="
                      (val: any) =>
                        emit('openParagraph', val ?? chatList[index])
                    "
                    @open-paragraph-document="
                      (val: any) =>
                        emit('openParagraphDocument', chatList[index], val)
                    "
                  />
                </div>
              </div>
            </template>
          </ElCheckboxGroup>
          <TransitionContent
            v-if="transcribing"
            :application="applicationDetails"
            text="语音识别中..."
            :type="type"
          />
        </div>
      </ElScrollbar>
      <div style="position: relative">
        <ElButton
          v-if="isBottom"
          class="back-bottom-button"
          circle
          @click="setScrollBottom"
        >
          <ElIcon><ArrowDownBold /></ElIcon>
        </ElButton>
        <div v-if="selection === true" class="mul-operation w-full border-t">
          <div class="flex-between chat-width">
            <ElCheckbox v-model="checkAll" @change="handleCheckAllChange">
              全选
            </ElCheckbox>
            <div>
              <ElButton @click="cancelCheckHandle">取消</ElButton>
              <ElButton
                type="primary"
                :disabled="shareLoading || multipleSelectionChat.length === 0"
                @click="shareChatHandle"
              >
                复制链接
              </ElButton>
            </div>
          </div>
        </div>
        <ChatInputOperate
          v-else-if="type !== 'log' && type !== 'share'"
          v-model:chat-id="chartOpenId"
          v-model:loading="loading"
          v-model:show-user-input="showUserInput"
          :app-id="appId"
          :application-details="applicationDetails"
          :is-mobile="isMobile"
          :open-chat-id="openChatId"
          :send-message="sendMessage"
          :type="type"
          :validate="validate"
        >
          <template #inlineParams>
            <InlineParams
              ref="inlineParamsRef"
              v-model:form-data="form_data"
              :application="applicationDetails as any"
              :max-exposed="maxExposed"
              @open-dialog="handleOpenDialog"
            />
          </template>
        </ChatInputOperate>
      </div>
      <Control />
    </template>
  </div>
</template>

<style lang="scss">
@use './index.scss';

.firstUserInput {
  display: flex;
  justify-content: center;
  height: 100%;
  overflow: auto;

  .user-form-container {
    max-width: 70%;
  }
}

.debug-ai-chat {
  .user-form-container {
    max-width: 100%;
  }

  /* 调试面板窄窗：缩小内容区域内边距 */
  .ai-chat__content {
    padding: 8px !important;
  }

  /* 调试面板窄窗：放宽内容最大宽度 */
  .chat-width {
    max-width: 100%;
    margin: 0;
  }

  /* 调试面板窄窗：用户输入弹窗适配窄面板 */
  .popperUserInput {
    left: 8px;
    max-width: calc(100% - 16px);
  }
}

.popperUserInput {
  position: absolute;
  bottom: 50px;
  left: 0;
  z-index: 999;
  width: calc(100% - 50px);
  max-width: 400px;
}

.g-p-16 {
  padding: 16px;
}

@media only screen and (max-width: 768px) {
  .firstUserInput {
    .user-form-container {
      max-width: 100%;
    }
  }
}
</style>
