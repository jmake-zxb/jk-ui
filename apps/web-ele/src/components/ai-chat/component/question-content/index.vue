<script setup lang="ts">
import type { chatType } from '#/api/ai/types';

import { computed, nextTick, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import {
  Close,
  Download,
  Promotion as SendIcon,
  UserFilled,
} from '@element-plus/icons-vue';
import {
  ElAvatar,
  ElButton,
  ElCard,
  ElDivider,
  ElIcon,
  ElImage,
  ElInput,
  ElSpace,
  ElTooltip,
} from 'element-plus';

import { getAttrsArray } from '#/utils/array';
import { copyClick } from '#/utils/clipboard';
import { downloadByURL, getImgUrl } from '#/utils/common';

const props = defineProps<{
  application: any;
  chatManagement: any;
  chatRecord: chatType;
  isLast: boolean;
  selection?: boolean;
  sendMessage: (
    question: string,
    other_params_data?: any,
    chat?: chatType,
  ) => Promise<boolean>;
  type: 'ai-chat' | 'debug-ai-chat' | 'log' | 'share';
}>();
const route = useRoute();
const {
  query: { mode },
} = route as any;
const showIcon = ref<boolean>(false);
const isReQuestion = ref<boolean>(false);
const editText = ref<string>('');

const showAvatar = computed(() => {
  return props.application.show_user_avatar === undefined
    ? true
    : props.application.show_user_avatar;
});

const document_list = computed(() => {
  if (props.chatRecord?.upload_meta) {
    return props.chatRecord.upload_meta?.document_list || [];
  }
  const startNode = props.chatRecord.execution_details?.find(
    (detail) => detail.type === 'start-node',
  );
  return startNode?.document_list || [];
});
const image_list = computed(() => {
  if (props.chatRecord?.upload_meta) {
    return props.chatRecord.upload_meta?.image_list || [];
  }
  const startNode = props.chatRecord.execution_details?.find(
    (detail) => detail.type === 'start-node',
  );
  return startNode?.image_list || [];
});
const video_list = computed(() => {
  if (props.chatRecord?.upload_meta) {
    return props.chatRecord.upload_meta?.video_list || [];
  }
  const startNode = props.chatRecord.execution_details?.find(
    (detail) => detail.type === 'start-node',
  );
  return startNode?.video_list || [];
});
const audio_list = computed(() => {
  if (props.chatRecord?.upload_meta) {
    return props.chatRecord.upload_meta?.audio_list || [];
  }
  const startNode = props.chatRecord.execution_details?.find(
    (detail) => detail.type === 'start-node',
  );
  return startNode?.audio_list || [];
});
const other_list = computed(() => {
  if (props.chatRecord?.upload_meta) {
    return props.chatRecord.upload_meta?.other_list || [];
  }
  const startNode = props.chatRecord.execution_details?.find(
    (detail) => detail.type === 'start-node',
  );
  return startNode?.other_list || [];
});
const getClassName = computed(() => {
  if (document_list.value.length >= 2 || other_list.value.length >= 2) {
    return 'media-2';
  }
  if (document_list.value.length > 0) {
    return `media-${document_list.value.length}`;
  }
  if (other_list.value.length > 0) {
    return `media-${other_list.value.length}`;
  }
  return 'media-0';
});

function downloadFile(item: any) {
  downloadByURL(item.url, item.name);
}

function handleEdit(chatRecord: any) {
  isReQuestion.value = true;
  editText.value = chatRecord.problem_text;
}

const cancelReQuestion = () => {
  isReQuestion.value = false;
};

const quickInputRef = ref();
function sendReQuestionMessage(event?: any) {
  const isMobile =
    /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
  // 如果是移动端，且按下回车键，不直接发送
  if ((isMobile || mode === 'mobile') && event?.key === 'Enter') {
    // 阻止默认事件
    return;
  }
  if (
    !event?.ctrlKey &&
    !event?.shiftKey &&
    !event?.altKey &&
    !event?.metaKey
  ) {
    // 如果没有按下组合键，则会阻止默认事件
    event?.preventDefault();
    if (
      editText.value.trim() &&
      editText.value.trim() !== props.chatRecord.problem_text.trim()
    ) {
      const container =
        props.chatRecord?.upload_meta ||
        props.chatRecord.execution_details?.find(
          (detail) => detail.type === 'start-node',
        );

      const updatedChat = {
        ...props.chatRecord,
        problem_text: editText.value,
        write_ed: false,
        answer_text_list: props.chatRecord.answer_text_list.map(
          (list: any[]) => [...list],
        ),
      };
      reset_answer_text_list(updatedChat.answer_text_list);

      isReQuestion.value = false;
      props.sendMessage(
        editText.value,
        {
          re_chat: true,
          image_list: container?.image_list || [],
          document_list: container?.document_list || [],
          audio_list: container?.audio_list || [],
          video_list: container?.video_list || [],
          other_list: container?.other_list || [],
          chat_record_id: props.chatRecord.record_id || props.chatRecord.id,
        },
        updatedChat,
      );
    }
  } else {
    // 如果同时按下ctrl/shift/cmd/opt +enter，则会换行
    insertNewlineAtCursor(event);
  }
}

const insertNewlineAtCursor = (event?: any) => {
  const textarea = quickInputRef.value.$el.querySelector(
    '.el-textarea__inner',
  ) as HTMLTextAreaElement;
  const startPos = textarea.selectionStart;
  const endPos = textarea.selectionEnd;
  // 阻止默认行为（避免额外的换行符）
  event.preventDefault();
  // 在光标处插入换行符
  editText.value = `${editText.value.trim().slice(0, startPos)}\n${editText.value.trim().slice(endPos)}`;
  nextTick(() => {
    textarea.setSelectionRange(startPos + 1, startPos + 1); // 光标定位到换行后位置
  });
};

const reset_answer_text_list = (answer_text_list: any) => {
  answer_text_list.splice(0);
  answer_text_list.push([]);
};

onMounted(() => {});
</script>
<template>
  <!-- 问题内容 -->
  <div @mouseenter.stop="showIcon = true" @mouseleave.stop="showIcon = false">
    <div class="question-content item-content lighter">
      <div
        v-if="!isReQuestion"
        class="content p-12-16 rounded-lg"
        :class="getClassName"
      >
        <div class="text pre-wrap break-all">
          <div class="mb-2" v-if="document_list.length > 0">
            <ElSpace wrap class="media-file-width w-full">
              <template v-for="(item, index) in document_list" :key="index">
                <ElCard
                  shadow="never"
                  style="

--el-card-padding: 8px"
                  class="download-file cursor"
                >
                  <div
                    class="download-button align-center flex"
                    @click="downloadFile(item)"
                  >
                    <ElIcon class="mr-1">
                      <Download />
                    </ElIcon>
                    {{ $$t('aiChat.download') }}
                  </div>
                  <div class="show align-center flex">
                    <img
                      :src="getImgUrl(item && item?.name)"
                      alt=""
                      width="24"
                    />
                    <div class="ellipsis-1 ml-1" :title="item && item?.name">
                      {{ item && item?.name }}
                    </div>
                  </div>
                </ElCard>
              </template>
            </ElSpace>
          </div>
          <div class="mb-2" v-if="image_list.length > 0">
            <ElSpace wrap>
              <template v-for="(item, index) in image_list" :key="index">
                <div class="file cursor rounded-md" v-if="item.url">
                  <ElImage
                    :src="item.url"
                    :zoom-rate="1.2"
                    :max-scale="7"
                    :min-scale="0.2"
                    :preview-src-list="getAttrsArray(image_list, 'url')"
                    :initial-index="index"
                    alt=""
                    fit="cover"
                    style="display: block; width: 170px; height: 170px"
                    class="rounded-md"
                  />
                </div>
              </template>
            </ElSpace>
          </div>
          <div class="mb-2" v-if="audio_list.length > 0">
            <ElSpace wrap>
              <template v-for="(item, index) in audio_list" :key="index">
                <div class="file cursor rounded-md" v-if="item.url">
                  <audio
                    :src="item.url"
                    controls
                    style="width: 350px; height: 43px"
                    class="rounded-md"
                  ></audio>
                </div>
              </template>
            </ElSpace>
          </div>
          <div class="mb-2" v-if="video_list.length > 0">
            <ElSpace wrap>
              <template v-for="(item, index) in video_list" :key="index">
                <div class="file cursor rounded-md" v-if="item.url">
                  <video
                    :src="item.url"
                    style="display: block; width: 170px"
                    class="rounded-md"
                    controls
                    autoplay
                  ></video>
                </div>
              </template>
            </ElSpace>
          </div>
          <div class="mb-2" v-if="other_list.length > 0">
            <ElSpace wrap class="media-file-width w-full">
              <template v-for="(item, index) in other_list" :key="index">
                <ElCard
                  shadow="never"
                  style="

--el-card-padding: 8px"
                  class="download-file cursor"
                >
                  <div
                    class="download-button align-center flex"
                    @click="downloadFile(item)"
                  >
                    <ElIcon class="mr-1">
                      <Download />
                    </ElIcon>
                    {{ $$t('aiChat.download') }}
                  </div>
                  <div class="show align-center flex">
                    <img
                      :src="getImgUrl(item && item?.name)"
                      alt=""
                      width="24"
                    />
                    <div class="ellipsis-1 ml-1" :title="item && item?.name">
                      {{ item && item?.name }}
                    </div>
                  </div>
                </ElCard>
              </template>
            </ElSpace>
          </div>
          <span> {{ chatRecord.problem_text }}</span>
        </div>
      </div>
      <div class="question-content__operate" v-else>
        <div class="operate-textarea">
          <ElInput
            ref="quickInputRef"
            v-model="editText"
            :autosize="{ minRows: 1, maxRows: 10 }"
            type="textarea"
            :placeholder="$$t('aiChat.inputPlaceholder.default')"
            :maxlength="100000"
            @keydown.enter="sendReQuestionMessage"
            class="chat-operate-textarea"
          />

          <div class="operate text-right">
            <ElButton link @click="cancelReQuestion">
              <ElIcon class="color-secondary"><Close /> </ElIcon>
            </ElButton>

            <ElDivider direction="vertical" />
            <ElButton
              text
              class="sent-button"
              :disabled="
                !editText.trim() ||
                editText.trim() === chatRecord.problem_text.trim()
              "
              @click="sendReQuestionMessage"
            >
              <img
                v-show="
                  !editText.trim() ||
                  editText.trim() === chatRecord.problem_text.trim()
                "
                src="#/assets/chat/icon_send.svg"
                alt=""
              />
              <SendIcon
                v-show="
                  editText.trim() &&
                  editText.trim() !== chatRecord.problem_text.trim()
                "
              />
            </ElButton>
          </div>
        </div>
      </div>
      <!-- <el-input v-else v-model="editText">
        <template #append>
          <div class="flex" style="gap: 8px">
            <el-button-group class="flex ml-2 mr-2">
              <el-button class="flex mr-2" text @click="cancelReQuestion"
                ><el-icon><Close /></el-icon
              ></el-button>
              <el-button
                :disabled="!editText.trim() || editText.trim() === chatRecord.problem_text.trim()"
                text
                @click="sendReQuestionMessage(chatRecord)"
              >
                <el-icon><Comment /></el-icon>
              </el-button>
            </el-button-group>
          </div>
        </template>
      </el-input> -->
      <div class="avatar ml-2" v-if="showAvatar">
        <ElImage
          v-if="application.user_avatar"
          :src="application.user_avatar"
          alt=""
          fit="cover"
          style="display: block; width: 28px; height: 28px"
        />
        <ElAvatar v-else :size="28" :icon="UserFilled" />
      </div>
    </div>
    <div class="question-edit-button mt-1 text-right" v-if="!selection">
      <div v-if="!isReQuestion && showIcon && props.type === 'ai-chat'">
        <ElTooltip
          effect="dark"
          :content="$$t('common.edit')"
          placement="top"
          v-if="props.isLast"
        >
          <ElButton text @click.stop="handleEdit(chatRecord)">
            <AppIcon class="color-secondary" icon-name="app-edit" />
          </ElButton>
        </ElTooltip>
        <ElTooltip effect="dark" :content="$$t('common.copy')" placement="top">
          <ElButton text @click.stop="copyClick(chatRecord?.problem_text)">
            <AppIcon class="color-secondary" icon-name="app-copy" />
          </ElButton>
        </ElTooltip>
      </div>
    </div>
  </div>
</template>
<style lang="scss" scoped>
.question-content {
  box-sizing: border-box;
  display: flex;
  justify-content: flex-end;
  width: 100%;
  padding-left: var(--padding-left);

  .content {
    padding-right: 16px;
    padding-left: 16px;
    background: var(--el-color-primary-light-9);
  }

  .download-file {
    height: 43px;

    &:hover {
      color: var(--el-color-primary);
      border: 1px solid var(--el-color-primary);

      .download-button {
        display: block;
        line-height: 26px;
        text-align: center;
      }

      .show {
        display: none;
      }
    }

    .download-button {
      display: none;
    }
  }

  .media-file-width {
    :deep(.el-space__item) {
      width: 49% !important;
    }
  }

  .media-2 {
    flex: 1;
  }

  .media-0 {
    flex: inherit;
  }

  .media-1 {
    width: 50%;
  }

  &__operate {
    position: relative;
    z-index: 10;
    box-sizing: border-box;
    width: 100%;

    :deep(.operate-textarea) {
      box-sizing: border-box;
      background-color: var(--el-bg-color);
      border: 1px solid var(--el-border-color-light);
      border-radius: 8px;
      box-shadow: 0 6px 24px 0 rgb(var(--el-text-color-primary-rgb), 0.08);

      &:has(.el-textarea__inner:focus) {
        border: 1px solid var(--el-color-primary);
      }

      .el-textarea__inner {
        box-sizing: border-box;
        height: 0;
        min-height: 47px !important;
        padding: 13px 16px;
        resize: none;
        border-radius: 8px !important;
        box-shadow: none;
      }

      .operate {
        padding: 6px 10px;

        .sent-button {
          max-height: none;

          .el-icon {
            font-size: 24px;
          }
        }

        .el-loading-spinner {
          margin-top: -15px;

          .circular {
            width: 31px;
            height: 31px;
          }
        }
      }
    }

    .file-image {
      position: relative;
      overflow: inherit;

      .delete-icon {
        position: absolute;
        top: -5px;
        right: -5px;
        z-index: 1;
      }
    }

    .upload-tooltip-width {
      width: 300px;
    }
  }
}

.question-edit-button {
  height: 28px;
}

@media only screen and (max-width: 768px) {
  .question-content {
    .media-file-width {
      :deep(.el-space__item) {
        min-width: 100% !important;
      }
    }

    .media-1 {
      width: 100%;
    }
  }
}

.debug-ai-chat {
  .question-content {
    .media-file-width {
      :deep(.el-space__item) {
        min-width: 100% !important;
      }
    }

    .media-1 {
      width: 100%;
    }
  }
}
</style>
