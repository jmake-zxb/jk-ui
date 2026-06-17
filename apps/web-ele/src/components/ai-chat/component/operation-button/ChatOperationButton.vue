<script setup lang="ts">
import type { ChatRecord } from '#/components/ai-chat/types/application';

import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import {
  CopyDocument,
  Refresh,
  Share,
  Star,
  StarFilled,
  VideoPause,
  VideoPlay,
} from '@element-plus/icons-vue';
import {
  ElButton,
  ElMessage,
  ElPopover,
  ElText,
  ElTooltip,
} from 'element-plus';

import { textToSpeech, vote } from '#/api/ai/chat';

import { aiChatBus } from '../../utils/bus';
import MobileVoteReasonDrawer from './MobileVoteReasonDrawer.vue';
import VoteReasonContent from './VoteReasonContent.vue';

const props = withDefaults(
  defineProps<{
    applicationId?: string;
    chatId?: string;
    chatLoading?: boolean;
    data?: ChatRecord;
    shareAvailable?: boolean;
    tts?: boolean;
    ttsAutoplay?: boolean;
    ttsType?: string;
    type?: 'ai-chat' | 'debug-ai-chat' | 'log' | 'share';
  }>(),
  {
    applicationId: '',
    chatId: '',
    chatLoading: false,
    data: undefined,
    shareAvailable: true,
    tts: false,
    ttsAutoplay: false,
    ttsType: '',
    type: 'ai-chat',
  },
);

const emit = defineEmits<{
  clickShare: [recordId: string];
  regeneration: [];
  'update:data': [value: ChatRecord];
}>();

// --- TTS 辅助函数 ---
function markdownToPlainText(md: string): string {
  return (
    md
      // 移除图片 ![alt](url)
      .replaceAll(/!\[.*?\]\(.*?\)/g, '')
      // 移除链接 [text](url)
      .replaceAll(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // 移除 Markdown 标题符号 (#, ##, ###)
      .replaceAll(/^#{1,6}\s+/gm, '')
      // 移除加粗 **text** 或 __text__
      .replaceAll(/\*\*(.*?)\*\*/g, '$1')
      .replaceAll(/__(.*?)__/g, '$1')
      // 移除斜体 *text* 或 _text_
      .replaceAll(/\*(.*?)\*/g, '$1')
      .replaceAll(/_(.*?)_/g, '$1')
      // 移除行内代码 `code`
      .replaceAll(/`(.*?)`/g, '$1')
      // 移除代码块 ```code```
      .replaceAll(/```.*?```/gs, '')
      // 移除video标签
      .replaceAll(/<video>.*?<\/video>/gs, '')
      // 移除html标签
      .replaceAll(/<[^>]+>/g, '')
      // 移除多余的换行符
      .replaceAll(/\n{2,}/g, '\n')
      .trim()
  );
}

function removeFormRander(text: string): string {
  return text.replaceAll(/<form_rander>.*?<\/form_rander>/gs, '').trim();
}

function getKey(keys: number[], index: number): number {
  // 从后往前查找第一个小于等于index的键
  for (let i = keys.length - 1; i >= 0; i--) {
    if (keys[i] <= index) {
      return keys[i];
    }
  }
  return 0;
}

function smartSplit(
  str: string,
  minLengthConfig: Record<number, number> = {} as Record<number, number>,
  isEnd = false,
): string[] {
  const config = { 0: 10, 1: 25, 3: 50, 5: 100, ...minLengthConfig };
  // 匹配中文逗号/句号，且后面至少还有20个字符（含任何字符，包括换行）
  const regex = /([。？\n])|(<audio[^>]*><\/audio>)/g;
  // 拆分并保留分隔符
  const parts = str.split(regex);
  const result: string[] = [];
  const keys = Object.keys(config).map(Number);
  let minLength = config[0] || 10;
  let tempStr = '';
  for (const [i, content] of parts.entries()) {
    if (content === undefined) {
      continue;
    }
    if (/^<audio[^>]*><\/audio>$/.test(content)) {
      if (tempStr.length > 0) {
        result.push(tempStr);
        tempStr = '';
      }
      result.push(content);
      continue;
    }
    tempStr += content;
    if (tempStr.length > minLength && /[。？\n]$/.test(tempStr)) {
      minLength = config[getKey(keys, i)] || 10;
      result.push(tempStr);
      tempStr = '';
    }
  }
  if (tempStr.length > 0 && isEnd) {
    result.push(tempStr);
  }
  return result;
}

// --- AudioManage 类 ---
const AudioStatus = {
  END: 'END',
  ERROR: 'ERROR',
  MOUNTED: 'MOUNTED',
  PLAY_INT: 'PLAY_INT',
  READY: 'READY',
} as const;
type AudioStatusValue = (typeof AudioStatus)[keyof typeof AudioStatus];

class AudioManage {
  applicationId: string;
  audioList: (HTMLAudioElement | SpeechSynthesisUtterance)[];
  isEnd: boolean;
  root: Element;
  statusList: AudioStatusValue[];
  textList: string[];
  tryList: number[];
  ttsType: string;

  constructor(ttsType: string, root: HTMLDivElement, applicationId: string) {
    this.textList = [];
    this.audioList = [];
    this.statusList = [];
    this.tryList = [];
    this.ttsType = ttsType;
    this.root = root;
    this.isEnd = false;
    this.applicationId = applicationId;
  }

  appendTextList(textList: string[]): number {
    const newTextList = textList.slice(this.textList.length);
    // 没有新增段落
    if (newTextList.length <= 0) {
      return 0;
    }
    newTextList.forEach((text, index) => {
      this.textList.push(text);
      this.statusList.push(AudioStatus.MOUNTED);
      this.tryList.push(1);
      index = this.textList.length - 1;
      if (this.ttsType === 'TTS') {
        const audioElement: HTMLAudioElement = document.createElement('audio');
        audioElement.controls = false;
        audioElement.hidden = true;
        /**
         * 播放结束事件
         */
        audioElement.addEventListener('ended', () => {
          this.statusList[index] = AudioStatus.END;
          // 如果所有的节点都播放结束
          if (
            this.statusList.every((item) => item === AudioStatus.END) &&
            this.isEnd
          ) {
            this.statusList = this.statusList.map(() => AudioStatus.READY);
            this.isEnd = false;
          } else {
            // next
            this.play();
          }
        });
        this.root.append(audioElement);
        if (/^<audio[^>]*><\/audio>$/.test(text)) {
          audioElement.src = text.match(/src="([^"]*)"/)?.[1] || '';
          this.statusList[index] = AudioStatus.READY;
        } else {
          textToSpeech(this.applicationId, { text })
            .then(async (res: any) => {
              if (res.type === 'application/json') {
                const text = await res.text();
                if (this.tryList[index] >= 3) {
                  ElMessage.error(text);
                }
                this.statusList[index] = AudioStatus.ERROR;
                throw new Error('textToSpeech response was JSON, not audio');
              }
              // 假设我们有一个 MP3 文件的字节数组
              // 创建 Blob 对象
              const blob = new Blob([res], { type: 'audio/mp3' });
              // 创建对象 URL
              const url = URL.createObjectURL(blob);
              audioElement.src = url;
              this.statusList[index] = AudioStatus.READY;
              this.play();
            })
            .catch(() => {
              this.statusList[index] = AudioStatus.ERROR;
              this.play();
            });
        }

        this.audioList.push(audioElement);
      } else {
        const speechSynthesisUtterance: SpeechSynthesisUtterance =
          new SpeechSynthesisUtterance(text);
        speechSynthesisUtterance.onend = () => {
          this.statusList[index] = AudioStatus.END;
          // 如果所有的节点都播放结束
          if (this.statusList.every((item) => item === AudioStatus.END)) {
            this.statusList = this.statusList.map(() => AudioStatus.READY);
          } else {
            // next
            this.play();
          }
        };
        speechSynthesisUtterance.addEventListener('error', () => {
          this.statusList[index] = AudioStatus.READY;
        });

        this.statusList[index] = AudioStatus.READY;
        this.audioList.push(speechSynthesisUtterance);
        this.play();
      }
    });
    return newTextList.length;
  }

  getTextList(text: string, isEnd: boolean): string[] {
    // 移除表单渲染器
    text = removeFormRander(text);
    // text 处理成纯文本
    text = markdownToPlainText(text);
    const split = smartSplit(
      text,
      {
        0: 20,
        1: 50,
        5: 100,
      },
      isEnd,
    );

    return split;
  }

  isPlaying(): boolean {
    return this.statusList.includes(AudioStatus.PLAY_INT);
  }

  pause(self?: boolean) {
    const index = this.statusList.indexOf(AudioStatus.PLAY_INT);
    if (index === -1) {
      return;
    }
    const audioElement = this.audioList[index];

    if (audioElement instanceof HTMLAudioElement) {
      if (this.statusList[index] === AudioStatus.PLAY_INT) {
        // 标签朗读
        this.statusList[index] = AudioStatus.READY;
        audioElement.pause();
      }
    } else {
      this.statusList[index] = AudioStatus.READY;
      if (self) {
        window.speechSynthesis.pause();
      } else {
        window.speechSynthesis.cancel();
      }
    }
  }

  play(text?: string, isEnd?: boolean, self?: boolean) {
    if (isEnd) {
      this.isEnd = true;
    }
    if (self) {
      this.tryList = this.tryList.map(() => 0);
    }
    if (text) {
      const textList = this.getTextList(text, !!isEnd);
      if (this.appendTextList(textList) !== 0) {
        // 没有新增段落
        return;
      }
    }
    // 如果存在在阅读的元素则直接返回
    if (this.statusList.includes(AudioStatus.PLAY_INT)) {
      return;
    }
    this.reTryError();

    // 需要播放的内容
    const index = this.statusList.findIndex((status) =>
      [AudioStatus.MOUNTED, AudioStatus.READY].includes(status),
    );
    if (index === -1 || this.statusList[index] === AudioStatus.MOUNTED) {
      return;
    }

    const audioElement = this.audioList[index];

    if (audioElement instanceof HTMLAudioElement) {
      // 标签朗读
      try {
        this.statusList[index] = AudioStatus.PLAY_INT;
        const play = audioElement.play();
        if (play instanceof Promise) {
          play.catch(() => {
            this.statusList[index] = AudioStatus.READY;
          });
        }
      } catch {
        this.statusList[index] = AudioStatus.ERROR;
      }
    } else {
      if (window.speechSynthesis.paused && self) {
        window.speechSynthesis.resume();
        this.statusList[index] = AudioStatus.PLAY_INT;
      } else {
        // 如果不是暂停状态，取消当前播放并重新开始
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
        }
        // 等待取消完成后重新播放
        setTimeout(() => {
          if (window.speechSynthesis.speaking) {
            return;
          }
          window.speechSynthesis.speak(audioElement);
          this.statusList[index] = AudioStatus.PLAY_INT;
        }, 500);
      }
    }
  }

  reTryError() {
    this.statusList.forEach((status, index) => {
      if (status === AudioStatus.ERROR && this.tryList[index] <= 3) {
        this.tryList[index]++;
        const audioElement = this.audioList[index];
        if (audioElement instanceof HTMLAudioElement) {
          const text = this.textList[index];
          this.statusList[index] = AudioStatus.MOUNTED;
          textToSpeech(this.applicationId, { text })
            .then(async (res: any) => {
              if (res.type === 'application/json') {
                const text = await res.text();
                if (this.tryList[index] >= 3) {
                  ElMessage.error(text);
                }
                throw new Error(
                  'retry textToSpeech response was JSON, not audio',
                );
              }
              // 假设我们有一个 MP3 文件的字节数组
              // 创建 Blob 对象
              const blob = new Blob([res], { type: 'audio/mp3' });

              // 创建对象 URL
              const url = URL.createObjectURL(blob);
              audioElement.src = url;
              this.statusList[index] = AudioStatus.READY;
              this.play();
            })
            .catch(() => {
              this.statusList[index] = AudioStatus.ERROR;
              this.play();
            });
        }
      }
    });
  }
}

const route = useRoute();
const {
  query: { mode },
} = route as any;

const showActions = computed(
  () => props.type === 'ai-chat' || props.type === 'log',
);

const isMobile = computed(() => mode === 'mobile');

// --- 投票功能 ---
const buttonData = ref<ChatRecord | undefined>(props.data);
const voteLoading = ref(false);

const likePopoverRef = ref();
const opposePopoverRef = ref();
const mobileVoteReasonDrawerRef =
  ref<InstanceType<typeof MobileVoteReasonDrawer>>();

const closePopover = () => {
  likePopoverRef.value?.hide();
  opposePopoverRef.value?.hide();
};

const mobileVoteReasonHandler = (voteStatus: string) => {
  mobileVoteReasonDrawerRef.value?.open(voteStatus);
};

function handleVoteSuccess(voteStatus: string) {
  if (buttonData.value) {
    buttonData.value.vote_status = voteStatus;
    emit('update:data', buttonData.value);
  }
  if (!isMobile.value) {
    closePopover();
  }
}

function cancelVoteHandle(val: string) {
  voteLoading.value = true;
  vote(props.chatId || '', props.data?.record_id || '', val)
    .then(() => {
      if (buttonData.value) {
        buttonData.value.vote_status = val;
        emit('update:data', buttonData.value);
      }
    })
    .finally(() => {
      voteLoading.value = false;
    });
}

// 监听 data 变化
watch(
  () => props.data,
  (newData) => {
    buttonData.value = newData;
  },
  { deep: true },
);

// --- TTS 功能 ---
const audioContainer = ref<HTMLDivElement>();
const audioManage = ref<AudioManage>();

function toggleTTS() {
  if (!audioManage.value || !props.data?.answer_text) return;

  if (audioManage.value.isPlaying()) {
    audioManage.value.pause(true);
  } else {
    aiChatBus.emit('play:pause', props.data.record_id);
    audioManage.value.play(props.data.answer_text, true, true);
  }
}

const isPlaying = computed(() => audioManage.value?.isPlaying() || false);

// 监听 autoplay
watch(
  () => props.data?.write_ed,
  (writeEd) => {
    if (
      props.tts &&
      props.ttsAutoplay &&
      writeEd &&
      props.data?.answer_text &&
      audioManage.value
    ) {
      audioManage.value.play(props.data.answer_text, true);
    }
  },
);

// 监听播放暂停事件
function handlePlayPause(recordId: string) {
  if (recordId !== props.data?.record_id) {
    audioManage.value?.pause();
  }
}

// 监听答案变化事件
function handleAnswerChange(data: { is_end: boolean; record_id: string }) {
  aiChatBus.emit('play:pause', data.record_id);
  if (
    props.data?.record_id === data.record_id &&
    props.tts &&
    props.ttsAutoplay &&
    audioManage.value
  ) {
    audioManage.value.play(props.data.answer_text, data.is_end);
  }
}

onMounted(() => {
  if (audioContainer.value) {
    audioManage.value = new AudioManage(
      props.ttsType || 'BROWSER',
      audioContainer.value,
      props.applicationId,
    );
  }
  aiChatBus.on('play:pause', handlePlayPause);
  aiChatBus.on('change:answer', handleAnswerChange);
});

onUnmounted(() => {
  aiChatBus.off('change:answer', handleAnswerChange);
  aiChatBus.off('play:pause', handlePlayPause);
  audioManage.value?.pause();
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
});

// --- 复制功能 ---
async function copy() {
  const text = props.data?.answer_text_list
    ?.map((item) => item.map((answer) => answer.content).join('\n'))
    .join('\n\n');
  await navigator.clipboard?.writeText(text || props.data?.answer_text || '');
}

function share() {
  const id = props.data?.record_id || '';
  aiChatBus.emit('click:share', id);
  emit('clickShare', id);
}
</script>

<template>
  <div class="chat-operation-button flex-between">
    <ElText type="info">
      <span class="ml-4" v-if="data?.create_time">{{
        new Date(data.create_time).toLocaleString()
      }}</span>
    </ElText>

    <div v-if="showActions" class="operation-actions">
      <!-- 语音播放 -->
      <template v-if="tts">
        <ElTooltip v-if="isPlaying" content="暂停" placement="top">
          <ElButton
            text
            :disabled="!data?.write_ed"
            :icon="VideoPause"
            @click="toggleTTS"
          />
        </ElTooltip>
        <ElTooltip v-else content="播放" placement="top">
          <ElButton
            text
            :disabled="!data?.write_ed"
            :icon="VideoPlay"
            @click="toggleTTS"
          />
        </ElTooltip>
      </template>
      <span class="ml-8">
        <ElTooltip content="复制" placement="top">
          <ElButton text :icon="CopyDocument" @click="copy" />
        </ElTooltip>
      </span>
      <span class="ml-8">
        <ElTooltip content="重新生成" placement="top">
          <ElButton
            text
            :disabled="chatLoading"
            :icon="Refresh"
            @click="emit('regeneration')"
          />
        </ElTooltip>
      </span>

      <!-- 投票按钮 - 移动端 -->
      <template v-if="isMobile">
        <span class="ml-8" v-if="buttonData?.vote_status === '-1'">
          <ElTooltip content="点赞" placement="top">
            <ElButton
              text
              :disabled="voteLoading"
              :icon="Star"
              @click="mobileVoteReasonHandler('0')"
            />
          </ElTooltip>
        </span>
        <span class="ml-8" v-if="buttonData?.vote_status === '-1'">
          <ElTooltip content="反对" placement="top">
            <ElButton
              text
              :disabled="voteLoading"
              :icon="StarFilled"
              @click="mobileVoteReasonHandler('1')"
            />
          </ElTooltip>
        </span>
      </template>

      <!-- 投票按钮 - 桌面端 -->
      <template v-else>
        <!-- 点赞按钮（未投票状态） -->
        <ElPopover
          ref="likePopoverRef"
          trigger="click"
          placement="bottom-start"
          :width="360"
          popper-class="vote-popover"
          :persistent="false"
          v-if="buttonData?.vote_status === '-1'"
        >
          <template #reference>
            <span class="ml-8">
              <ElTooltip content="点赞" placement="top">
                <ElButton text :disabled="voteLoading" :icon="Star" />
              </ElTooltip>
            </span>
          </template>
          <VoteReasonContent
            vote-type="0"
            :application-id="applicationId"
            :record-id="data?.record_id || ''"
            @success="handleVoteSuccess"
            @close="closePopover"
          />
        </ElPopover>

        <!-- 已点赞状态 -->
        <span class="ml-8" v-if="buttonData?.vote_status === '0'">
          <ElTooltip content="取消点赞" placement="top">
            <ElButton
              text
              :disabled="voteLoading"
              :icon="StarFilled"
              @click="cancelVoteHandle('-1')"
            />
          </ElTooltip>
        </span>

        <!-- 反对按钮（未投票状态） -->
        <ElPopover
          ref="opposePopoverRef"
          trigger="click"
          placement="bottom-start"
          :width="360"
          popper-class="vote-popover"
          :persistent="false"
          v-if="buttonData?.vote_status === '-1'"
        >
          <template #reference>
            <span class="ml-8">
              <ElTooltip content="反对" placement="top">
                <ElButton text :disabled="voteLoading" :icon="StarFilled" />
              </ElTooltip>
            </span>
          </template>
          <VoteReasonContent
            vote-type="1"
            :application-id="applicationId"
            :record-id="data?.record_id || ''"
            @success="handleVoteSuccess"
            @close="closePopover"
          />
        </ElPopover>

        <!-- 已反对状态 -->
        <span class="ml-8" v-if="buttonData?.vote_status === '1'">
          <ElTooltip content="取消反对" placement="top">
            <ElButton
              text
              :disabled="voteLoading"
              :icon="StarFilled"
              @click="cancelVoteHandle('-1')"
            />
          </ElTooltip>
        </span>
      </template>

      <span class="ml-8" v-if="shareAvailable">
        <ElTooltip content="分享" placement="top">
          <ElButton text :disabled="chatLoading" :icon="Share" @click="share" />
        </ElTooltip>
      </span>
    </div>

    <!-- 音频容器（隐藏） -->
    <div ref="audioContainer" style="display: none"></div>

    <!-- 移动端投票抽屉 -->
    <MobileVoteReasonDrawer
      ref="mobileVoteReasonDrawerRef"
      :application-id="applicationId"
      :record-id="data?.record_id || ''"
      @success="handleVoteSuccess"
    />
  </div>
</template>

<style lang="scss">
.chat-operation-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.operation-actions {
  display: flex;
  align-items: center;
}

.ml-4 {
  margin-left: 4px;
}

.ml-8 {
  margin-left: 8px;
}

.ml-12 {
  margin-left: 12px;
}

.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

@media only screen and (max-width: 430px) {
  .chat-operation-button {
    display: block;
    text-align: right;
  }
}

.vote-popover {
  padding: 20px 24px !important;
  color: var(--el-text-color-primary) !important;
}
</style>
