<script setup lang="ts">
import type { ChatRecord } from './types/application';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
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
import { debounce } from 'lodash-es';

import { chatSSE, getChatRecord, openChat, postShareChat } from '#/api/ai/chat';

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
import { getWrite } from './utils/chat';

defineOptions({ name: 'AiChat' });

const props = withDefaults(
  defineProps<{
    appId?: string;
    applicationDetails: Record<string, any>;
    available?: boolean;
    chatId?: string;
    chatRecord: ChatRecord;
    executionIsRightPanel?: boolean;
    record?: Array<ChatRecord>;
    selection?: boolean;
    type?: 'ai-chat' | 'debug-ai-chat' | 'log' | 'share';
  }>(),
  {
    appId: '',
    applicationDetails: () => ({}),
    available: true,
    chatId: '',
    record: () => [],
    type: 'ai-chat',
  },
);
const emit = defineEmits([
  'openExecutionDetail',
  'openParagraph',
  'openParagraphDocument',
  'refresh',
  'scroll',
  'update:selection',
]);
const route = useRoute();
const {
  params: { accessToken, id },
  query: { mode },
} = route as any;

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
    )?.properties.user_input_field_list.length > 0,
);

const isAPIInput = computed(
  () =>
    props.type === 'debug-ai-chat' &&
    (
      (props.applicationDetails as any).work_flow?.nodes?.find(
        (v: any) => v.id === 'base-node',
      ) as any
    )?.properties.api_input_field_list.length > 0,
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
  const appId = (props.appId || id || (props.applicationDetails as any)?.id) as string;
  postShareChat(appId, chartOpenId.value).then((res: any) => {
    const token = res?.shareToken || res?.share_token;
    if (token) {
      navigator.clipboard?.writeText(
        `${window.location.origin}/chat/share/${token}`,
      );
    }
  });
}

const handleCheckAllChange = (val: boolean) => {
  multipleSelectionChat.value = val
    ? chatList.value.map((v) => v.record_id)
    : [];
  checkAll.value = val;
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
  initialFormData.value = structuredClone(form_data.value);
  initialApiFormData.value = structuredClone(api_form_data.value);
};

function cancelCheckHandle() {
  checkAll.value = false;
  multipleSelectionChat.value = [];
  emit('update:selection', false);
}

function UserFormCancel() {
  form_data.value = structuredClone(initialFormData.value);
  api_form_data.value = structuredClone(initialApiFormData.value);
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

            if (!loading.value && props.applicationDetails?.name) {
              handleDebounceClick(val, other_params_data, chat);
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
    if (!loading.value && props.applicationDetails?.name) {
      handleDebounceClick(val, other_params_data, chat);
      return Promise.resolve(true);
    }
    return Promise.reject(new Error('no application name'));
  }
}

const handleDebounceClick = debounce(
  (val: string, other_params_data?: any, chat?: ChatRecord) => {
    chatMessage(chat, val, false, other_params_data);
  },
  200,
);

const openChatId = (): Promise<string> => {
  const appId = (props.appId ||
    (props.applicationDetails as any)?.id) as string;
  return openChat(appId).then((res: any) => {
    const chatId = String(res?.id || res);
    chartOpenId.value = chatId;
    return chatId;
  });
};

function getSourceDetail(row: any) {
  if (row.record_id) {
    const appId = (props.appId ||
      (props.applicationDetails as any)?.id) as string;
    return getChatRecord(appId, row.chat_id, row.record_id).then((res: any) => {
      const data = typeof res === 'object' ? res : {};
      const exclude_keys = new Set(['answer_text', 'answer_text_list', 'id']);
      Object.keys(data).forEach((key) => {
        if (!exclude_keys.has(key)) {
          row[key] = data[key];
        }
      });
    });
  }
  return Promise.resolve();
}

function getChartOpenId(
  chat?: any,
  problem?: string,
  re_chat?: boolean,
  other_params_data?: any,
) {
  return openChatId().then(() => {
    chatMessage(chat, problem, re_chat, other_params_data);
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
    ChatManagement.write(chat.id);
  }
  if (chartOpenId.value) {
    const obj = {
      form_data: {
        ...form_data.value,
        ...api_form_data.value,
      },
      message: chat.problem_text,
      re_chat: re_chat || false,
      stream: true,
      ...other_params_data,
    };
    // SSE 流式对话
    chatSSE(chartOpenId.value, obj)
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
              ChatManagement.close(chat.id);
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

onMounted(() => {
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

  aiChatBus.on('on:transcribing', (status: boolean) => {
    transcribing.value = status;
    nextTick(() => {
      if (scorll.value) {
        scrollDiv.value.setScrollTop(getMaxHeight());
      }
    });
  });
  aiChatBus.on('click:share', (id: string) => {
    multipleSelectionChat.value.push(id);
    checkAll.value =
      multipleSelectionChat.value.length === chatList.value.length;
    emit('update:selection', true);
  });
});

onBeforeUnmount(() => {
  window.sendMessage = null as any;
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
        v-model:api_form_data="api_form_data"
        v-model:form_data="form_data"
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
          class="ai-chat__content p-16"
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
                  class="w-full border-r-8"
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
                  class="w-full border-r-8"
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
                    :type="type"
                    @open-execution-detail="
                      emit('openExecutionDetail', chatList[index])
                    "
                    @open-paragraph="emit('openParagraph', chatList[index])"
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
}

.popperUserInput {
  position: absolute;
  bottom: 50px;
  left: 0;
  z-index: 999;
  width: calc(100% - 50px);
  max-width: 400px;
}

@media only screen and (max-width: 768px) {
  .firstUserInput {
    .user-form-container {
      max-width: 100%;
    }
  }
}
</style>
