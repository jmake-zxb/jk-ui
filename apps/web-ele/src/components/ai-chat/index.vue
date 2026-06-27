<script setup lang="ts">
import type { CheckboxValueType } from 'element-plus';

import type { Ref } from 'vue';

import type { chatType } from '#/api/ai/types-maxkb';

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
import { debounce, throttle } from 'lodash-es';

import applicationApi from '#/api/ai/applications';
import chatAPI from '#/api/ai/chat';
import chatLogApi from '#/api/ai/chat-log';
import SystemResourceManagementApplicationAPI from '#/api/system/application';
import syetrmResourceManagementChatLogApi from '#/api/system/chat-log';
import AnswerContent from '#/components/ai-chat/component/answer-content/index.vue';
import ChatInputOperate from '#/components/ai-chat/component/chat-input-operate/index.vue';
import Control from '#/components/ai-chat/component/control/index.vue';
import InlineParams from '#/components/ai-chat/component/inline-params/index.vue';
import PrologueContent from '#/components/ai-chat/component/prologue-content/index.vue';
import QuestionContent from '#/components/ai-chat/component/question-content/index.vue';
import TransitionContent from '#/components/ai-chat/component/transition-content/index.vue';
import UserForm from '#/components/ai-chat/component/user-form/index.vue';
import { ChatManagement } from '#/components/ai-chat/types/application';
import { getWriteDebug } from '#/components/ai-chat/utils/chat';
import { $t } from '#/locales';
import useStore from '#/store';
import bus from '#/utils/bus';
import { copyClick } from '#/utils/clipboard';
import { randomId } from '#/utils/common';
import { loadSharedApi } from '#/utils/dynamics-api/shared-api';

defineOptions({ name: 'AiChat' });
const props = withDefaults(
  defineProps<{
    appId?: string;
    applicationDetails?: any;
    available?: boolean;
    chatId?: string;
    chatRecord?: chatType;
    executionIsRightPanel?: boolean;
    record?: Array<chatType>;
    selection?: boolean;
    type?: 'ai-chat' | 'debug-ai-chat' | 'log' | 'share';
  }>(),
  {
    appId: undefined,
    applicationDetails: () => ({}),
    available: true,
    chatId: undefined,
    chatRecord: undefined,
    record: undefined,
    type: 'ai-chat',
  },
);
const emit = defineEmits([
  'refresh',
  'scroll',
  'openExecutionDetail',
  'openParagraph',
  'openParagraphDocument',
  'update:selection',
]);
provide('upload', (file: any, loading?: Ref<boolean>) => {
  return props.type === 'debug-ai-chat'
    ? applicationApi.postUploadFile(
        file,
        'TEMPORARY_120_MINUTE',
        'TEMPORARY_120_MINUTE',
        loading,
      )
    : chatAPI.postUploadFile(file, chartOpenId.value, 'CHAT', loading);
});
provide('getSelectModelList', (params: any) => {
  return route.path.includes('resource-management')
    ? loadSharedApi({
        type: 'model',
        systemType: 'systemManage',
      }).getSelectModelList(params)
    : loadSharedApi({
        type: 'model',
        systemType: 'workspace',
      }).getSelectModelList(params);
});
provide('chatUserProfile', () => {
  if (
    props.type === 'ai-chat' &&
    chatUser.chat_profile?.authentication_type === 'login'
  ) {
    return chatUser.getChatUserProfile();
  }
  return Promise.resolve(null);
});

const transcribing = ref<boolean>(false);
const route = useRoute();
const {
  params: { accessToken, id },
  query: { mode },
} = route as any;
const { common, chatUser } = useStore();

const aiChatRef = ref();
const { width: rootWidth } = useElementSize(aiChatRef);

const isMobile = computed(() => {
  return common.isMobile() || mode === 'embed' || mode === 'mobile';
});

const isNarrow = computed(() => rootWidth.value > 0 && rootWidth.value < 1040);

const maxExposed = computed(() => (isNarrow.value ? 1 : 3));
const inlineExposedFields = computed<string[]>(() =>
  (
    props.applicationDetails?.work_flow?.nodes?.find(
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
// 用户输入
const firsUserInput = ref(false);
const showUserInput = ref(false);

// 初始表单数据（用于恢复）
const initialFormData = ref({});
const initialApiFormData = ref({});

const inlineParamsRef = ref<InstanceType<typeof InlineParams>>();

const isUserInput = computed(
  () =>
    props.applicationDetails?.work_flow?.nodes?.find(
      (v: any) => v.id === 'base-node',
    )?.properties.user_input_field_list.length > 0,
);

const isAPIInput = computed(
  () =>
    props.type === 'debug-ai-chat' &&
    props.applicationDetails.work_flow?.nodes?.find(
      (v: any) => v.id === 'base-node',
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
  {
    immediate: true,
  },
);

// 选择对话分享
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
  {
    immediate: true,
  },
);

function shareChatHandle() {
  const validIds = new Set(chatList.value.map((v) => v.record_id));
  const selectedIds = multipleSelectionChat.value.filter((id) =>
    validIds.has(id),
  );

  const obj = {
    chat_record_ids: selectedIds,
    is_current_all: checkAll.value,
  };
  chatAPI
    .postShareChat(id || props.appId, chartOpenId.value, obj, shareLoading)
    .then((res) => {
      if (res.data?.link) {
        copyClick(`${window.location.origin}/chat/share/${res.data.link}`);
      }
    });
}

const handleCheckAllChange = (val: CheckboxValueType) => {
  multipleSelectionChat.value = val
    ? chatList.value.map((v) => v.record_id)
    : [];
  checkAll.value = val as boolean;
};
const handleCheckedChatChange = (value: CheckboxValueType[]) => {
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

function UserFormConfirm() {
  firsUserInput.value = false;
  showUserInput.value = false;

  // 表单提交后，继续当前对话（不创建新记录）
  // 查找最后一个对话记录，如果它正在等待表单提交，则继续该对话
  if (chatList.value.length > 0) {
    const lastChat = chatList.value[chatList.value.length - 1];
    // 带着表单数据继续当前对话
    if (!loading.value && props.applicationDetails?.name) {
      handleDebounceClick(lastChat.problem_text, {}, lastChat);
    }
  }
}

function UserFormCancel() {
  // 恢复初始数据
  form_data.value = structuredClone(initialFormData.value);
  api_form_data.value = structuredClone(initialApiFormData.value);
  userFormRef.value?.render(form_data.value);
  showUserInput.value = false;
}

const validate = () => {
  return inlineParamsRef.value?.validate() || Promise.resolve(true);
};

function sendMessage(
  val: string,
  other_params_data?: any,
  chat?: chatType,
): Promise<boolean> {
  if (isUserInput.value) {
    return userFormRef.value
      ? userFormRef.value
          ?.validate()
          .then((_ok) => {
            const userFormData = accessToken
              ? JSON.parse(
                  localStorage.getItem(`${accessToken}userForm`) || '{}',
                )
              : {};
            const newData: any = {};
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
          .catch((_error) => {
            showUserInput.value = !(
              isAPIInput.value && props.type !== 'debug-ai-chat'
            );

            return false;
          })
      : Promise.reject(new Error('No user input'));
  } else {
    showUserInput.value = false;
    if (!loading.value && props.applicationDetails?.name) {
      handleDebounceClick(val, other_params_data, chat);
      return Promise.resolve(true);
    }
    return Promise.reject(new Error('No application name'));
  }
}

const handleDebounceClick = debounce(
  (val, other_params_data?: any, chat?: chatType) => {
    chatMessage(chat, val, false, other_params_data);
  },
  200,
);

/**
 * 打开对话id
 */
const openChatId: () => Promise<string> = () => {
  const obj = props.applicationDetails;
  const openParams =
    props.type === 'debug-ai-chat'
      ? { source: 'APPLICATION_DEBUG', title: '调试会话' }
      : undefined;
  return getOpenChatAPI()(obj.id, openParams).then((res) => {
    // requestClient 返回的是完整响应，data 字段包含实际数据
    const chatData = res.data || res;
    const chatId = String(chatData.id);
    chartOpenId.value = chatId;
    return chatId;
  });
};

const getChatMessageAPI = () => {
  return props.type === 'debug-ai-chat'
    ? (chatId: string, data: any) => {
        return chatAPI.workflowDebugSSE(id || props.appId, {
          message: data.message,
          stream: data.stream,
          reChat: data.re_chat,
          chatId,
          formDataJson: data.node_data
            ? JSON.stringify(data.node_data)
            : undefined,
          runtimeNodeId: data.runtime_node_id,
          chatRecordId: data.chat_record_id,
          childNode: data.child_node,
          imageList: data.image_list,
          documentList: data.document_list,
          audioList: data.audio_list,
          videoList: data.video_list,
          otherList: data.other_list,
        });
      }
    : (chatId: string, data: any) => {
        return chatAPI.chatSSE(id || props.appId, {
          message: data.message,
          stream: data.stream,
          reChat: data.re_chat,
          chatId,
          formDataJson: data.node_data
            ? JSON.stringify(data.node_data)
            : undefined,
          runtimeNodeId: data.runtime_node_id,
          chatRecordId: data.chat_record_id,
          childNode: data.child_node,
          imageList: data.image_list,
          documentList: data.document_list,
          audioList: data.audio_list,
          videoList: data.video_list,
          otherList: data.other_list,
        });
      };
};
const getOpenChatAPI = () => {
  if (props.type === 'debug-ai-chat') {
    return route.path.includes('resource-management')
      ? SystemResourceManagementApplicationAPI.open
      : applicationApi.openApplicationChat;
  } else {
    return (applicationId: string, data?: any) => {
      return chatAPI.openChat(applicationId, data);
    };
  }
};

const getChatRecordDetailsAPI = (row: any) => {
  if (row.record_id) {
    if (props.type === 'debug-ai-chat') {
      return route.path.includes('resource-management')
        ? syetrmResourceManagementChatLogApi.getChatRecordDetails(
            id || props.appId,
            row.chat_id,
            row.record_id,
            loading,
          )
        : chatLogApi.getChatRecordDetails(
            id || props.appId,
            row.chat_id,
            row.record_id,
            loading,
          );
    } else {
      // Use the new getChatRecord endpoint for ai-chat mode
      // Use chartOpenId instead of row.chat_id (which might be runId)
      return chatAPI.getChatRecord(
        id || props.appId,
        chartOpenId.value,
        row.record_id,
      );
    }
  }
  return Promise.reject(new Error('404'));
};

/**
 * 获取对话详情
 * @param row
 */
function getSourceDetail(row: any) {
  return getChatRecordDetailsAPI(row)
    .then((res) => {
      // Handle different response structures: res.data or res directly
      const data = res.data || res;
      if (!data) {
        return;
      }
      const exclude_keys = new Set(['answer_text', 'id']);
      Object.keys(data).forEach((key) => {
        if (!exclude_keys.has(key)) {
          row[key] = data[key];
        }
      });

      // 从 answer_text_list 中提取 chat_record_id 并设置到 row.record_id
      // 这样表单提交时可以正确传递 chatRecordId 来更新现有记录而不是创建新记录
      if (!row.record_id && data.answer_text_list) {
        for (const answerGroup of data.answer_text_list) {
          if (Array.isArray(answerGroup)) {
            for (const answer of answerGroup) {
              if (answer && answer.chat_record_id) {
                row.record_id = answer.chat_record_id;
                break;
              }
            }
          }
          if (row.record_id) break;
        }
      }
    })
    .catch((error) => {
      console.warn('Failed to get source detail:', error);
    });
}

/**
 * 对话
 */
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
  ChatManagement.append(chat.id, message || $t('aiChat.tip.error500Message'));
  ChatManagement.updateStatus(chat.id, 500);
  ChatManagement.close(chat.id);
};

// 保存上传文件列表

function chatMessage(
  chat?: any,
  problem?: string,
  re_chat?: boolean,
  other_params_data?: any,
) {
  loading.value = true;
  if (!chat) {
    chat = reactive({
      id: randomId(),
      problem_text: problem || inputValue.value.trim(),
      answer_text: '',
      answer_text_list: [[]],
      currentNodeName: '',
      buffer: [],
      reasoning_content: '',
      reasoning_content_buffer: [],
      write_ed: false,
      is_stop: false,
      record_id: '',
      chat_id: '',
      vote_status: '-1',
      status: undefined,
      upload_meta: {
        image_list:
          other_params_data && other_params_data.image_list
            ? other_params_data.image_list
            : [],
        document_list:
          other_params_data && other_params_data.document_list
            ? other_params_data.document_list
            : [],
        audio_list:
          other_params_data && other_params_data.audio_list
            ? other_params_data.audio_list
            : [],
        video_list:
          other_params_data && other_params_data.video_list
            ? other_params_data.video_list
            : [],
        other_list:
          other_params_data && other_params_data.other_list
            ? other_params_data.other_list
            : [],
      },
    });
    chatList.value.push(chat);
    ChatManagement.addChatRecord(chat, 50, loading);
    ChatManagement.write(chat.id);
    inputValue.value = '';
    nextTick(() => {
      // 将滚动条滚动到最下面
      scrollDiv.value.setScrollTop(getMaxHeight());
    });
  }
  if (chat.run_time) {
    ChatManagement.addChatRecord(chat, 50, loading);
    ChatManagement.write(chat.id);
  }
  if (chartOpenId.value) {
    const obj = {
      message: chat.problem_text,
      stream: true,
      re_chat: re_chat || false,
      ...other_params_data,
      form_data: {
        ...form_data.value,
        ...api_form_data.value,
      },
    };
    // 对话
    getChatMessageAPI()(chartOpenId.value, obj)
      .then((response) => {
        if (response.status === 460) {
          throw new Error($t('aiChat.tip.errorIdentifyMessage'));
        } else if (response.status === 461) {
          throw new Error($t('aiChat.tip.errorLimitMessage'));
        } else {
          nextTick(() => {
            // 将滚动条滚动到最下面
            scrollDiv.value.setScrollTop(getMaxHeight());
          });
          const reader = response.body.getReader();
          // 处理流数据
          // 使用 getWriteDebug 处理新的事件格式（node_interrupt 等）
          const write = getWriteDebug(chat, reader);
          return write();
        }
      })
      .then(() => {
        if (props.chatId === 'new') {
          emit('refresh', chartOpenId.value);
        }
        getSourceDetail(chat);
        // if (props.type === 'debug-ai-chat') {
        //   getSourceDetail(chat)
        // } else {
        //   if (
        //     props.applicationDetails &&
        //     (props.applicationDetails.show_exec || props.applicationDetails.show_source)
        //   ) {
        //     getSourceDetail(chat)
        //   }
        // }
      })
      .finally(() => {
        ChatManagement.close(chat.id);
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

/**
 * 滚动条距离最上面的高度
 */
const scrollTop = ref(0);

const scorll = ref(true);
const isBottom = ref(false);

const getMaxHeight = () => {
  return dialogScrollbar.value!.scrollHeight;
};

/**
 * 滚动滚动条到最上面
 * @param $event
 */
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
/**
 * 处理跟随滚动条
 */
const handleScroll = () => {
  if (
    props.type !== 'log' &&
    scrollDiv.value && // 内部高度小于外部高度 就需要出滚动条
    scrollDiv.value.wrapRef.offsetHeight < dialogScrollbar.value.scrollHeight
  ) {
    // 只有在用户已经在底部附近时才自动滚动到底部
    const isNearBottom =
      dialogScrollbar.value.scrollHeight -
        (scrollTop.value + scrollDiv.value.wrapRef.offsetHeight) <=
      40;
    if (scorll.value || isNearBottom) {
      // 滚动到底部
      scrollDiv.value.setScrollTop(dialogScrollbar.value.scrollHeight);
    }
  }
};

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

onMounted(() => {
  if (isUserInput.value && localStorage.getItem(`${accessToken}userForm`)) {
    const userFormData = JSON.parse(
      localStorage.getItem(`${accessToken}userForm`) || '{}',
    );
    form_data.value = userFormData;
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  const handleZoom = throttle((event: WheelEvent, target: HTMLElement) => {
    // 2. 解析当前变换状态
    const currentTransform = target.style.transform;
    const transformValues = parseTransform(currentTransform);
    const { scale, translateX, translateY } = transformValues;
    // 确保scale是数值类型
    const currentScale = Array.isArray(scale) ? scale[0] : scale;

    // 3. 计算缩放方向和新的缩放比例
    const zoomIntensity = 0.05; // 每次滚轮的缩放步长
    const zoomFactor = event.deltaY < 0 ? 1 + zoomIntensity : 1 - zoomIntensity;
    const newScale = Math.max(0.1, currentScale * zoomFactor); // 设置最小缩放限制
    // 4. 计算新的平移值
    const newTranslateX = (translateX * currentScale) / newScale;
    const newTranslateY = (translateY * currentScale) / newScale;
    // 5. 应用新的变换
    target.style.transform = `scale(${newScale}) translate3d(${newTranslateX}px, ${newTranslateY}px, 0px)`;
  }, 50); // 50ms 内只执行一次

  document.body.addEventListener(
    'wheel',
    (event) => {
      // 1. 定位目标元素
      if (event.target) {
        const target = event.target as HTMLElement;
        // 假设打开状态的图片具有特定类名
        if (
          target.classList &&
          target.classList.contains('medium-zoom-overlay')
        ) {
          event.preventDefault();
          event.stopPropagation();
        }
        if (
          target.classList &&
          target.classList.contains('medium-zoom-image--opened')
        ) {
          event.preventDefault();
          event.stopPropagation();

          handleZoom(event, target);
        }
      }
    },
    { passive: false },
  );

  window.sendMessage = sendMessage;
  bus.on('on:transcribing', (status: boolean) => {
    transcribing.value = status;
    nextTick(() => {
      if (scorll.value) {
        scrollDiv.value.setScrollTop(getMaxHeight());
      }
    });
  });
  bus.on('click:share', (id: string) => {
    multipleSelectionChat.value.push(id);
    checkAll.value =
      multipleSelectionChat.value.length === chatList.value.length;
    emit('update:selection', true);
  });
});

onBeforeUnmount(() => {
  window.sendMessage = null;
  window.chatUserProfile = null;
});

function setScrollBottom() {
  // 将滚动条滚动到最下面
  scrollDiv.value.setScrollTop(getMaxHeight());
}

watch(
  chatList,
  () => {
    nextTick(() => {
      handleScroll(); // 确保 DOM 更新后再滚动
    });
  },
  { deep: true, immediate: true },
);

defineExpose({
  setScrollBottom,
  loading,
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
        v-model:api_form_data="api_form_data"
        v-model:form_data="form_data"
        :exclude-fields="inlineExposedFields"
        :title="
          applicationDetails?.work_flow?.nodes?.find(
            (v: any) => v.id === 'base-node',
          )?.properties?.user_input_field_list_setting?.menu_title ||
          applicationDetails?.work_flow?.nodes?.find(
            (v: any) => v.id === 'base-node',
          )?.properties?.user_input_config?.title
        "
        :application="applicationDetails"
        :type="type"
        :first="firsUserInput"
        @confirm="UserFormConfirm"
        @cancel="UserFormCancel"
        ref="userFormRef"
      />
    </div>
    <template
      v-if="!(isUserInput || isAPIInput) || !firsUserInput || type === 'log'"
    >
      <ElScrollbar ref="scrollDiv" @scroll="handleScrollTop">
        <div
          ref="dialogScrollbar"
          class="ai-chat__content p-4"
          id="chatListId"
          :style="{ marginBottom: selection ? '65px' : '' }"
        >
          <PrologueContent
            :type="type"
            :application="applicationDetails"
            :available="available"
            :send-message="sendMessage"
            v-if="!selection"
          />
          <ElCheckboxGroup
            v-model="multipleSelectionChat"
            @change="handleCheckedChatChange"
          >
            <template v-for="(item, index) in chatList" :key="index">
              <div class="flex-between w-full">
                <ElCheckbox :value="item.record_id" v-if="selection" />
                <div
                  class="w-full rounded-lg"
                  :class="[
                    selection ? 'cursor mb-2 mt-2 p-3' : 'mt-6',
                    multipleSelectionChat.includes(item.record_id)
                      ? 'is-selected'
                      : '',
                  ]"
                  @click="toggleSelect(item.record_id)"
                >
                  <!-- 问题 -->
                  <QuestionContent
                    :chat-management="ChatManagement"
                    :type="type"
                    :application="applicationDetails"
                    :send-message="sendMessage"
                    :chat-record="item"
                    :is-last="index >= chatList.length - 1"
                    :selection="selection"
                  />
                </div>
              </div>
              <div class="align-center flex w-full">
                <ElCheckbox :value="item.record_id" v-if="selection" />
                <div
                  class="w-full rounded-lg"
                  :class="[
                    selection ? 'cursor p-3' : '',
                    multipleSelectionChat.includes(item.record_id)
                      ? 'is-selected'
                      : '',
                  ]"
                  @click="toggleSelect(item.record_id)"
                >
                  <!-- 回答 -->
                  <AnswerContent
                    :application="applicationDetails"
                    :loading="loading"
                    v-model:chat-record="chatList[index]"
                    :type="type"
                    :send-message="sendMessage"
                    :chat-management="ChatManagement"
                    :execution-is-right-panel="props.executionIsRightPanel"
                    @open-execution-detail="
                      emit('openExecutionDetail', chatList[index])
                    "
                    @open-paragraph="emit('openParagraph', chatList[index])"
                    @open-paragraph-document="
                      (val: any) =>
                        emit('openParagraphDocument', chatList[index], val)
                    "
                    :selection="selection"
                  />
                </div>
              </div>
            </template>
          </ElCheckboxGroup>
          <TransitionContent
            v-if="transcribing"
            :text="$t('aiChat.inputPlaceholder.recorderLoading')"
            :type="type"
            :application="applicationDetails"
          />
        </div>
      </ElScrollbar>
      <div style="position: relative">
        <!-- 置底按钮 -->
        <ElButton
          v-if="isBottom"
          circle
          class="back-bottom-button"
          @click="setScrollBottom"
        >
          <ElIcon>
            <ArrowDownBold />
          </ElIcon>
        </ElButton>
        <div class="mul-operation w-full border-t" v-if="selection === true">
          <div class="flex-between chat-width">
            <ElCheckbox v-model="checkAll" @change="handleCheckAllChange">
              {{ $t('common.allCheck') }}
            </ElCheckbox>
            <div>
              <ElButton @click="cancelCheckHandle">
                {{ $t('common.cancel') }}
              </ElButton>
              <ElButton
                type="primary"
                @click="shareChatHandle"
                :disabled="shareLoading || multipleSelectionChat.length === 0"
              >
                {{ $t('aiChat.copyLinkText') }}
              </ElButton>
            </div>
          </div>
        </div>
        <ChatInputOperate
          :app-id="appId"
          :application-details="applicationDetails"
          :is-mobile="isMobile"
          :type="type"
          :send-message="sendMessage"
          :open-chat-id="openChatId"
          :validate="validate"
          :chat-management="ChatManagement"
          v-model:chat-id="chartOpenId"
          v-model:loading="loading"
          v-model:show-user-input="showUserInput"
          v-else-if="type !== 'log' && type !== 'share'"
        >
          <template #inlineParams>
            <InlineParams
              ref="inlineParamsRef"
              :application="applicationDetails"
              :max-exposed="maxExposed"
              v-model:form-data="form_data"
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
