<script setup lang="ts">
import type { Ref } from 'vue';

import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { ElButton, ElPopover, ElText, ElTooltip } from 'element-plus';

import applicationApi from '#/api/ai/applications';
import chatAPI from '#/api/ai/chat';
import MobileVoteReasonDrawer from '#/components/ai-chat/component/operation-button/MobileVoteReasonDrawer.vue';
import VoteReasonContent from '#/components/ai-chat/component/operation-button/VoteReasonContent.vue';
import bus from '#/utils/bus';
import { copyClick } from '#/utils/clipboard';
import { MsgError as showError } from '#/utils/message';
import { datetimeFormat } from '#/utils/time';

const props = withDefaults(
  defineProps<{
    applicationId: string;
    chatId: string;
    chatLoading: boolean;
    data?: any;
    tts?: boolean;
    ttsAutoplay?: boolean;
    ttsType?: string;
    type?: 'ai-chat' | 'debug-ai-chat' | 'log' | 'share';
  }>(),
  {
    data: () => ({}),
    type: 'ai-chat',
    tts: false,
    ttsType: 'BROWSER',
    ttsAutoplay: false,
  },
);
const emit = defineEmits(['update:data', 'regeneration', 'clickShare']);
const route = useRoute();
const {
  params: { id },
  query: { mode },
} = route as any;

const clickShareHandle = (id: string) => {
  bus.emit('click:share', id);
};

const copy = (data: any) => {
  try {
    const text = data.answer_text_list
      .map((item: Array<any>) => item.map((i) => i.content).join('\n'))
      .join('\n\n');
    copyClick(removeFormRander(text));
  } catch {
    copyClick(removeFormRander(data?.answer_text.trim()));
  }
};

const likePopoverRef = ref();
const opposePopoverRef = ref();
const closePopover = () => {
  likePopoverRef.value.hide();
  opposePopoverRef.value.hide();
};
const mobileVoteReasonDrawerRef = ref<InstanceType<
  typeof MobileVoteReasonDrawer
> | null>(null);
const mobileVoteReasonHandler = (voteStatus: string) => {
  if (mobileVoteReasonDrawerRef.value) {
    mobileVoteReasonDrawerRef.value.open(voteStatus);
  }
};

const audioCiontainer = ref<HTMLDivElement>();
const buttonData = ref(props.data);
const loading = ref(false);

function regeneration() {
  emit('regeneration');
}

function handleVoteSuccess(voteStatus: string) {
  buttonData.value.vote_status = voteStatus;
  emit('update:data', buttonData.value);
  if (mode !== 'mobile') {
    closePopover();
  }
}

function cancelVoteHandle(val: string) {
  chatAPI
    .vote(props.chatId, props.data.record_id, val, undefined, '', loading)
    .then(() => {
      buttonData.value.vote_status = val;
      emit('update:data', buttonData.value);
    });
}

function markdownToPlainText(md: string) {
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

function removeFormRander(text: string) {
  return text.replaceAll(/<form_rander>.*?<\/form_rander>/gs, '').trim();
}
function getKey(keys: Array<number>, index: number) {
  // 从后往前查找第一个小于等于index的键
  for (let i = keys.length - 1; i >= 0; i--) {
    if (keys[i] <= index) {
      return keys[i];
    }
  }
  return 0;
}
const defaultMinLengthConfig = { 0: 10, 1: 25, 3: 50, 5: 100 };
function smartSplit(
  str: string,
  minLengthConfig: any = defaultMinLengthConfig,
  is_end = false,
) {
  // 匹配中文逗号/句号，且后面至少还有20个字符（含任何字符，包括换行）
  const regex = /([。？\n])|(<audio[^>]*><\/audio>)/g;
  // 拆分并保留分隔符
  const parts = str.split(regex);
  const result = [];
  const keys = Object.keys(minLengthConfig).map(Number);
  let minLength = minLengthConfig[0];
  let temp_str = '';
  for (const [i, content] of parts.entries()) {
    if (content === undefined) {
      continue;
    }
    if (/^<audio[^>]*><\/audio>$/.test(content)) {
      if (temp_str.length > 0) {
        result.push(temp_str);
        temp_str = '';
      }
      result.push(content);
      continue;
    }
    temp_str += content;
    if (temp_str.length > minLength && /[。？\n]$/.test(temp_str)) {
      minLength = minLengthConfig[getKey(keys, i)];
      result.push(temp_str);
      temp_str = '';
    }
  }
  if (temp_str.length > 0 && is_end) {
    result.push(temp_str);
  }
  return result;
}

const AudioStatus = {
  END: 'END',
  ERROR: 'ERROR',
  MOUNTED: 'MOUNTED',
  PLAY_INT: 'PLAY_INT',
  READY: 'READY',
} as const;
type AudioStatusType = (typeof AudioStatus)[keyof typeof AudioStatus];
const getTextToSpeechAPI = () => {
  return props.type === 'ai-chat'
    ? (application_id?: string, data?: any, loading?: Ref<boolean>) => {
        return chatAPI.textToSpeech(data, loading);
      }
    : applicationApi.postTextToSpeech;
};
const textToSpeechAPI = getTextToSpeechAPI();
class AudioManage {
  audioList: Array<HTMLAudioElement | SpeechSynthesisUtterance>;
  is_end: boolean;
  root: Element;
  statusList: Array<AudioStatusType>;
  textList: Array<string>;
  tryList: Array<number>;
  ttsType: string;
  constructor(ttsType: string, root: HTMLDivElement) {
    this.textList = [];
    this.audioList = [];
    this.statusList = [];
    this.tryList = [];
    this.ttsType = ttsType;
    this.root = root;
    this.is_end = false;
  }
  appendTextList(textList: Array<string>) {
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
            this.statusList.every((_item) => _item === AudioStatus.END) &&
            this.is_end
          ) {
            this.statusList = this.statusList.map((_item) => AudioStatus.READY);
            this.is_end = false;
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
          textToSpeechAPI(
            (props.applicationId as string) || (id as string),
            { text },
            loading,
          )
            .then(async (res: any) => {
              if (res.type === 'application/json') {
                const text = await res.text();
                if (this.tryList[index] >= 3) {
                  showError(text);
                }
                this.statusList[index] = AudioStatus.ERROR;
                throw new Error('Speech synthesis failed');
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
            .catch((_error) => {
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
          if (this.statusList.every((_item) => _item === AudioStatus.END)) {
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
  }
  getTextList(text: string, is_end: boolean) {
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
      is_end,
    );

    return split;
  }
  isPlaying() {
    return this.statusList.some((_item) =>
      [AudioStatus.PLAY_INT].includes(_item),
    );
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
  play(text?: string, is_end?: boolean, self?: boolean) {
    if (is_end) {
      this.is_end = true;
    }
    if (self) {
      this.tryList = this.tryList.map(() => 0);
    }
    if (text) {
      const textList = this.getTextList(text, !!is_end);
      if (this.appendTextList(textList) !== 0) {
        // 没有新增段落
        return;
      }
    }
    // 如果存在在阅读的元素则直接返回
    if (
      this.statusList.some((_item) => [AudioStatus.PLAY_INT].includes(_item))
    ) {
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
          play.catch((_error) => {
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
          if (speechSynthesis.speaking) {
            return;
          }
          speechSynthesis.speak(audioElement);
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
          textToSpeechAPI(
            (props.applicationId as string) || (id as string),
            { text },
            loading,
          )
            .then(async (res: any) => {
              if (res.type === 'application/json') {
                const text = await res.text();
                if (this.tryList[index] >= 3) {
                  showError(text);
                }
                throw new Error('Speech synthesis failed');
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
            .catch((_error) => {
              // console.log('err:', error);
              this.statusList[index] = AudioStatus.ERROR;
              this.play();
            });
        }
      }
    });
  }
}
const audioManage = ref<AudioManage>();
onMounted(() => {
  if (audioCiontainer.value) {
    audioManage.value = new AudioManage(props.ttsType, audioCiontainer.value);
  }
  bus.on('play:pause', (record_id: string) => {
    if (record_id !== props.data.record_id && audioManage.value) {
      audioManage.value?.pause();
    }
  });

  bus.on('change:answer', (data: any) => {
    const record_id = data.record_id;
    bus.emit('play:pause', record_id);
    if (
      props.data.record_id === record_id &&
      props.tts &&
      props.ttsAutoplay &&
      audioManage.value
    ) {
      audioManage.value.play(props.data.answer_text, data.is_end);
    }
  });
});
onBeforeUnmount(() => {
  bus.off('change:answer');
  bus.off('play:pause');
  if (audioManage.value) {
    audioManage.value.pause();
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
});
</script>
<template>
  <div class="chat-operation-button flex-between">
    <ElText type="info">
      <span class="ml-1" v-if="data.create_time">{{
        datetimeFormat(data.create_time)
      }}</span>
    </ElText>

    <div>
      <!-- 语音播放 -->
      <span v-if="tts">
        <ElTooltip
          v-if="audioManage?.isPlaying()"
          effect="dark"
          :content="$$t('aiChat.operation.pause')"
          placement="top"
        >
          <ElButton
            type="primary"
            text
            :disabled="!data?.write_ed"
            @click="audioManage?.pause(true)"
          >
            <AppIcon class="color-secondary" icon-name="app-video-pause" />
          </ElButton>
        </ElTooltip>
        <ElTooltip
          effect="dark"
          :content="$$t('aiChat.operation.play')"
          placement="top"
          v-else
        >
          <ElButton
            text
            :disabled="!data?.write_ed"
            @click="
              () => {
                bus.emit('play:pause', props.data.record_id);
                audioManage?.play(props.data.answer_text, true, true);
              }
            "
          >
            <AppIcon class="color-secondary" icon-name="app-video-play" />
          </ElButton>
        </ElTooltip>
      </span>
      <span v-if="type === 'ai-chat' || type === 'log'">
        <span>
          <ElTooltip
            effect="dark"
            :content="$$t('common.copy')"
            placement="top"
          >
            <ElButton text @click="copy(data)">
              <AppIcon class="color-secondary" icon-name="app-copy" />
            </ElButton>
          </ElTooltip>
        </span>
        <span>
          <ElTooltip
            effect="dark"
            :content="$$t('aiChat.operation.regeneration')"
            placement="top"
          >
            <ElButton :disabled="chatLoading" text @click="regeneration">
              <AppIcon icon-name="app-refresh" class="color-secondary" />
            </ElButton>
          </ElTooltip>
        </span>
        <span v-if="buttonData?.vote_status === '-1' && mode === 'mobile'">
          <ElTooltip
            effect="dark"
            :content="$$t('aiChat.operation.like')"
            placement="top"
          >
            <ElButton
              text
              :disabled="loading"
              @click="mobileVoteReasonHandler('0')"
            >
              <AppIcon class="color-secondary" icon-name="app-like" />
            </ElButton>
          </ElTooltip>
        </span>

        <ElPopover
          ref="likePopoverRef"
          trigger="click"
          placement="bottom-start"
          :width="360"
          popper-class="vote-popover"
          :persistent="false"
          v-if="buttonData?.vote_status === '-1' && mode !== 'mobile'"
        >
          <template #reference>
            <span>
              <ElTooltip
                effect="dark"
                :content="$$t('aiChat.operation.like')"
                placement="top"
              >
                <ElButton text :disabled="loading">
                  <AppIcon class="color-secondary" icon-name="app-like" />
                </ElButton>
              </ElTooltip>
            </span>
          </template>
          <VoteReasonContent
            vote-type="0"
            :chat-id="props.chatId"
            :record-id="props.data.record_id"
            @success="handleVoteSuccess"
            @close="closePopover"
          />
        </ElPopover>
        <span v-if="buttonData?.vote_status === '0'">
          <ElTooltip
            effect="dark"
            :content="$$t('aiChat.operation.cancelLike')"
            placement="top"
          >
            <ElButton text @click="cancelVoteHandle('-1')" :disabled="loading">
              <AppIcon class="color-secondary" icon-name="app-like-color" />
            </ElButton>
          </ElTooltip>
        </span>
        <span v-if="buttonData?.vote_status === '-1' && mode === 'mobile'">
          <ElTooltip
            effect="dark"
            :content="$$t('aiChat.operation.oppose')"
            placement="top"
          >
            <ElButton
              text
              :disabled="loading"
              @click="mobileVoteReasonHandler('1')"
            >
              <AppIcon class="color-secondary" icon-name="app-oppose" />
            </ElButton>
          </ElTooltip>
        </span>

        <ElPopover
          ref="opposePopoverRef"
          trigger="click"
          placement="bottom-start"
          :width="360"
          popper-class="vote-popover"
          :persistent="false"
          v-if="buttonData?.vote_status === '-1' && mode !== 'mobile'"
        >
          <template #reference>
            <span>
              <ElTooltip
                effect="dark"
                :content="$$t('aiChat.operation.oppose')"
                placement="top"
              >
                <ElButton text :disabled="loading">
                  <AppIcon class="color-secondary" icon-name="app-oppose" />
                </ElButton>
              </ElTooltip>
            </span>
          </template>
          <VoteReasonContent
            vote-type="1"
            :chat-id="props.chatId"
            :record-id="props.data.record_id"
            @success="handleVoteSuccess"
            @close="closePopover"
          />
        </ElPopover>
        <span v-if="buttonData?.vote_status === '1'">
          <ElTooltip
            effect="dark"
            :content="$$t('aiChat.operation.cancelOppose')"
            placement="top"
          >
            <ElButton text @click="cancelVoteHandle('-1')" :disabled="loading">
              <AppIcon class="color-secondary" icon-name="app-oppose-color" />
            </ElButton>
          </ElTooltip>
        </span>
        <span>
          <ElTooltip
            effect="dark"
            :content="$$t('aiChat.share')"
            placement="top"
          >
            <ElButton
              text
              @click.stop="clickShareHandle(props.data.record_id)"
              :disabled="chatLoading"
            >
              <AppIcon class="color-secondary" icon-name="app-share" />
            </ElButton>
          </ElTooltip>
        </span>
      </span>
      <div ref="audioCiontainer"></div>
    </div>
    <MobileVoteReasonDrawer
      ref="mobileVoteReasonDrawerRef"
      :chat-id="props.chatId"
      :record-id="props.data.record_id"
      @success="handleVoteSuccess"
    />
  </div>
</template>
<style lang="scss">
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
