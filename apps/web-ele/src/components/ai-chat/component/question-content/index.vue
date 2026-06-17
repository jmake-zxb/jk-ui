<script setup lang="ts">
import type { ChatRecord } from '../../types/application';

import { computed, nextTick, onMounted, ref } from 'vue';

import { Close, Download } from '@element-plus/icons-vue';
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

import { getImgUrl } from '#/utils/file-util';

const props = defineProps<{
  application: Record<string, any>;
  chatManagement: any;
  chatRecord: ChatRecord;
  isLast: boolean;
  selection?: boolean;
  sendMessage: (
    question: string,
    otherParamsData?: unknown,
    chat?: ChatRecord,
  ) => Promise<boolean>;
  type: 'ai-chat' | 'debug-ai-chat' | 'log' | 'share';
}>();

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
    return (props.chatRecord.upload_meta as any)?.document_list || [];
  }
  const startNode = (props.chatRecord.execution_details as any)?.find(
    (detail: any) => detail.type === 'start-node',
  );
  return startNode?.document_list || [];
});

const image_list = computed(() => {
  if (props.chatRecord?.upload_meta) {
    return (props.chatRecord.upload_meta as any)?.image_list || [];
  }
  const startNode = (props.chatRecord.execution_details as any)?.find(
    (detail: any) => detail.type === 'start-node',
  );
  return startNode?.image_list || [];
});

const video_list = computed(() => {
  if (props.chatRecord?.upload_meta) {
    return (props.chatRecord.upload_meta as any)?.video_list || [];
  }
  const startNode = (props.chatRecord.execution_details as any)?.find(
    (detail: any) => detail.type === 'start-node',
  );
  return startNode?.video_list || [];
});

const audio_list = computed(() => {
  if (props.chatRecord?.upload_meta) {
    return (props.chatRecord.upload_meta as any)?.audio_list || [];
  }
  const startNode = (props.chatRecord.execution_details as any)?.find(
    (detail: any) => detail.type === 'start-node',
  );
  return startNode?.audio_list || [];
});

const other_list = computed(() => {
  if (props.chatRecord?.upload_meta) {
    return (props.chatRecord.upload_meta as any)?.other_list || [];
  }
  const startNode = (props.chatRecord.execution_details as any)?.find(
    (detail: any) => detail.type === 'start-node',
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

function getAttrsArray(arr: any[], key: string) {
  return arr.map((item) => item[key]).filter(Boolean);
}

function downloadByURL(url: string, name: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name || 'download';
  a.click();
}

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
  if (isMobile && event?.key === 'Enter') {
    return;
  }
  if (
    !event?.ctrlKey &&
    !event?.shiftKey &&
    !event?.altKey &&
    !event?.metaKey
  ) {
    event?.preventDefault();
    if (
      editText.value.trim() &&
      editText.value.trim() !== props.chatRecord.problem_text.trim()
    ) {
      const chatRecord = props.chatRecord;
      const container =
        chatRecord.upload_meta ||
        (chatRecord.execution_details as any)?.find(
          (detail: any) => detail.type === 'start-node',
        );

      chatRecord.problem_text = editText.value;
      reset_answer_text_list(chatRecord.answer_text_list);
      chatRecord.write_ed = false;

      isReQuestion.value = false;
      props.sendMessage(
        editText.value,
        {
          re_chat: true,
          image_list: (container as any)?.image_list || [],
          document_list: (container as any)?.document_list || [],
          audio_list: (container as any)?.audio_list || [],
          video_list: (container as any)?.video_list || [],
          other_list: (container as any)?.other_list || [],
          chat_record_id: chatRecord.record_id || chatRecord.id,
        },
        chatRecord,
      );
    }
  } else {
    insertNewlineAtCursor(event);
  }
}

const insertNewlineAtCursor = (event?: any) => {
  const textarea = quickInputRef.value.$el.querySelector(
    '.el-textarea__inner',
  ) as HTMLTextAreaElement;
  const startPos = textarea.selectionStart;
  const endPos = textarea.selectionEnd;
  event.preventDefault();
  editText.value = `${editText.value
    .trim()
    .slice(0, startPos)}\n${editText.value.trim().slice(endPos)}`;
  nextTick(() => {
    textarea.setSelectionRange(startPos + 1, startPos + 1);
  });
};

const reset_answer_text_list = (answer_text_list: any) => {
  answer_text_list.splice(0);
  answer_text_list.push([]);
};

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const input = document.createElement('input');
    input.value = text;
    document.body.append(input);
    input.select();
    document.execCommand('copy');
    input.remove();
  }
}

function toPreviewIndex(index: number | string) {
  const value = typeof index === 'number' ? index : Number(index);
  return Number.isFinite(value) ? value : undefined;
}

onMounted(() => {});
</script>

<template>
  <div @mouseenter.stop="showIcon = true" @mouseleave.stop="showIcon = false">
    <div class="question-content">
      <div v-if="!isReQuestion" class="content" :class="getClassName">
        <div class="text">
          <div class="g-mb-8" v-if="document_list.length > 0">
            <ElSpace wrap class="media-file-width">
              <template v-for="(item, index) in document_list" :key="index">
                <ElCard
                  shadow="never"
                  style="

--el-card-padding: 8px"
                  class="download-file"
                >
                  <div class="download-button" @click="downloadFile(item)">
                    <ElIcon><Download /></ElIcon>
                    下载
                  </div>
                  <div class="show">
                    <img
                      :src="getImgUrl(item && item?.name)"
                      alt=""
                      width="24"
                    />
                    <div class="filename" :title="item && item?.name">
                      {{ item && item?.name }}
                    </div>
                  </div>
                </ElCard>
              </template>
            </ElSpace>
          </div>
          <div class="g-mb-8" v-if="image_list.length > 0">
            <ElSpace wrap>
              <template v-for="(item, index) in image_list" :key="index">
                <div class="file" v-if="item.url">
                  <ElImage
                    :src="item.url"
                    :zoom-rate="1.2"
                    :max-scale="7"
                    :min-scale="0.2"
                    :preview-src-list="getAttrsArray(image_list, 'url')"
                    :initial-index="toPreviewIndex(index)"
                    alt=""
                    fit="cover"
                    style="display: block; width: 170px; height: 170px"
                  />
                </div>
              </template>
            </ElSpace>
          </div>
          <div class="g-mb-8" v-if="audio_list.length > 0">
            <ElSpace wrap>
              <template v-for="(item, index) in audio_list" :key="index">
                <div class="file" v-if="item.url">
                  <audio
                    :src="item.url"
                    controls
                    style="width: 350px; height: 43px"
                  ></audio>
                </div>
              </template>
            </ElSpace>
          </div>
          <div class="g-mb-8" v-if="video_list.length > 0">
            <ElSpace wrap>
              <template v-for="(item, index) in video_list" :key="index">
                <div class="file" v-if="item.url">
                  <video
                    :src="item.url"
                    style="display: block; width: 170px"
                    controls
                    autoplay
                  ></video>
                </div>
              </template>
            </ElSpace>
          </div>
          <div class="g-mb-8" v-if="other_list.length > 0">
            <ElSpace wrap class="media-file-width">
              <template v-for="(item, index) in other_list" :key="index">
                <ElCard
                  shadow="never"
                  style="

--el-card-padding: 8px"
                  class="download-file"
                >
                  <div class="download-button" @click="downloadFile(item)">
                    <ElIcon><Download /></ElIcon>
                    下载
                  </div>
                  <div class="show">
                    <img
                      :src="getImgUrl(item && item?.name)"
                      alt=""
                      width="24"
                    />
                    <div class="filename" :title="item && item?.name">
                      {{ item && item?.name }}
                    </div>
                  </div>
                </ElCard>
              </template>
            </ElSpace>
          </div>
          <span>{{ chatRecord.problem_text }}</span>
        </div>
      </div>
      <div class="question-content__operate" v-else>
        <div class="operate-textarea">
          <ElInput
            ref="quickInputRef"
            v-model="editText"
            :autosize="{ minRows: 1, maxRows: 10 }"
            type="textarea"
            placeholder="请输入问题"
            :maxlength="100000"
            @keydown.enter="sendReQuestionMessage"
            class="chat-operate-textarea"
          />

          <div class="operate">
            <ElButton link @click="cancelReQuestion">
              <ElIcon><Close /></ElIcon>
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
              <ElIcon :size="24">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </ElIcon>
            </ElButton>
          </div>
        </div>
      </div>
      <div class="avatar" v-if="showAvatar">
        <ElImage
          v-if="application.user_avatar"
          :src="application.user_avatar"
          alt=""
          fit="cover"
          style="display: block; width: 28px; height: 28px"
        />
        <ElAvatar v-else :size="28">
          <span style="font-size: 14px">U</span>
        </ElAvatar>
      </div>
    </div>
    <div class="question-edit-button" v-if="!selection">
      <div v-if="!isReQuestion && showIcon && props.type === 'ai-chat'">
        <ElTooltip
          effect="dark"
          content="编辑"
          placement="top"
          v-if="props.isLast"
        >
          <ElButton text @click.stop="handleEdit(chatRecord)">
            <ElIcon>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"
                />
              </svg>
            </ElIcon>
          </ElButton>
        </ElTooltip>
        <ElTooltip effect="dark" content="复制" placement="top">
          <ElButton text @click.stop="copyText(chatRecord?.problem_text || '')">
            <ElIcon>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
                />
              </svg>
            </ElIcon>
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
  font-weight: 400; /* was: .lighter */

  .content {
    padding: 12px 16px; /* was: .p-12-16 */
    background: #d6e2ff;
    border-radius: 8px; /* was: .border-r-8 */
  }

  .text {
    word-break: break-all; /* was: .break-all */
    white-space: pre-wrap; /* was: .pre-wrap */
  }

  .g-mb-8 {
    margin-bottom: 8px;
  }

  .file {
    overflow: hidden;
    cursor: pointer; /* was: .cursor */
    border-radius: 6px; /* was: .border-r-6 */
  }

  .download-file {
    height: 43px;
    cursor: pointer; /* was: .cursor */

    &:hover {
      color: var(--el-color-primary);
      border: 1px solid var(--el-color-primary);

      .download-button {
        display: flex;
        align-items: center; /* was: .align-center */
        line-height: 26px;
        text-align: center;
      }

      .show {
        display: none;
      }
    }

    .download-button {
      display: none;
      align-items: center; /* was: .align-center */
    }

    .download-button .el-icon {
      margin-right: 4px; /* was: .mr-4 */
    }

    .show {
      display: flex;
      align-items: center; /* was: .align-center */
    }

    .filename {
      /* was: .ellipsis-1 */
      display: -webkit-box;
      margin-left: 4px; /* was: .ml-4 */
      overflow: hidden;
      -webkit-line-clamp: 1;
      word-break: break-all;
      -webkit-box-orient: vertical;
    }
  }

  .media-file-width {
    width: 100%; /* was: .w-full */

    /* stylelint-disable-next-line selector-pseudo-class-no-unknown */
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

  .avatar {
    float: left;
    margin-left: 8px; /* was: .ml-8 */
  }

  &__operate {
    position: relative;
    z-index: 10;
    box-sizing: border-box;
    width: 100%;

    /* stylelint-disable-next-line selector-pseudo-class-no-unknown */
    :deep(.operate-textarea) {
      box-sizing: border-box;
      background-color: #fff;
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
        text-align: right; /* was: .text-right */

        .sent-button {
          max-height: none;

          .el-icon {
            font-size: 24px;
          }
        }
      }
    }
  }

  .color-secondary {
    color: var(--el-text-color-secondary);
  }
}

.question-edit-button {
  height: 28px;
  margin-top: 4px; /* was: .mt-4 */
  text-align: right; /* was: .text-right */
}

@media only screen and (max-width: 768px) {
  .question-content {
    .media-file-width {
      /* stylelint-disable-next-line selector-pseudo-class-no-unknown */
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
      /* stylelint-disable-next-line selector-pseudo-class-no-unknown */
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
