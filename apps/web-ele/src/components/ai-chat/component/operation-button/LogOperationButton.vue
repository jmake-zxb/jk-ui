<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';

import { ElButton, ElCard, ElText, ElTooltip } from 'element-plus';

import applicationApi from '#/api/ai/applications';
import VoteReasonContent from '#/components/ai-chat/component/operation-button/VoteReasonContent.vue';
import { $t } from '#/locales';
import { copyClick } from '#/utils/clipboard';
import { MsgError as showError } from '#/utils/message';
// TODO: 需要实现这两个对话框组件
// import EditContentDialog from '#/views/chat-log/component/EditContentDialog.vue'
// import EditMarkDialog from '#/views/chat-log/component/EditMarkDialog.vue'
import { datetimeFormat } from '#/utils/time';

const props = defineProps({
  data: {
    type: Object,
    default: () => {},
  },
  applicationId: {
    type: String,
    default: '',
  },
  tts: {
    type: Boolean,
    default: false,
  },
  ttsType: {
    type: String,
    default: 'BROWSER',
  },
});
const route = useRoute();
const {
  params: { id },
} = route as any;

const audioPlayer = ref<HTMLAudioElement[] | null>(null);
const buttonData = ref(props.data);
const loading = ref(false);
const utterance = ref<null | SpeechSynthesisUtterance>(null);
const audioList = ref<string[]>([]);
const currentAudioIndex = ref(0);
const audioPlayerStatus = ref(false);

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
      // 移除多余的换行符
      .replaceAll(/\n{2,}/g, '\n')
      .trim()
  );
}

function removeFormRander(text: string) {
  return text.replaceAll(/<form_rander>.*?<\/form_rander>/gs, '').trim();
}

const playAnswerText = (text: string) => {
  if (!text) {
    text = $t('aiChat.tip.answerMessage');
  }
  // 移除表单渲染器
  text = removeFormRander(text);
  // text 处理成纯文本
  text = markdownToPlainText(text);
  // console.log(text)
  audioPlayerStatus.value = true;
  // 分割成多份
  audioList.value = text.split(/(<audio[^>]*><\/audio>)/);
  playAnswerTextPart();
};

const playAnswerTextPart = () => {
  // console.log(audioList.value, currentAudioIndex.value)
  if (currentAudioIndex.value === audioList.value.length) {
    audioPlayerStatus.value = false;
    currentAudioIndex.value = 0;
    return;
  }
  if (audioList.value[currentAudioIndex.value].includes('<audio')) {
    if (audioPlayer.value) {
      audioPlayer.value[currentAudioIndex.value].src =
        audioList.value[currentAudioIndex.value].match(/src="([^"]*)"/)?.[1] ||
        '';
      audioPlayer.value[currentAudioIndex.value].play(); // 自动播放音频
      audioPlayer.value[currentAudioIndex.value].addEventListener(
        'ended',
        () => {
          currentAudioIndex.value += 1;
          playAnswerTextPart();
        },
      );
    }
  } else if (props.ttsType === 'BROWSER') {
    if (audioList.value[currentAudioIndex.value] !== utterance.value?.text) {
      window.speechSynthesis.cancel();
    }
    if (
      window.speechSynthesis.paused &&
      audioList.value[currentAudioIndex.value] === utterance.value?.text
    ) {
      window.speechSynthesis.resume();
      return;
    }
    // 创建一个新的 SpeechSynthesisUtterance 实例
    utterance.value = new SpeechSynthesisUtterance(
      audioList.value[currentAudioIndex.value],
    );
    utterance.value.onend = () => {
      utterance.value = null;
      currentAudioIndex.value += 1;
      playAnswerTextPart();
    };
    utterance.value.addEventListener('error', () => {
      audioPlayerStatus.value = false;
      utterance.value = null;
    });
    // 调用浏览器的朗读功能
    window.speechSynthesis.speak(utterance.value);
  } else if (props.ttsType === 'TTS') {
    // 恢复上次暂停的播放
    if (audioPlayer.value && audioPlayer.value[currentAudioIndex.value]?.src) {
      audioPlayer.value[currentAudioIndex.value].play();
      return;
    }
    applicationApi
      .postTextToSpeech(
        (props.applicationId as string) || (id as string),
        { text: audioList.value[currentAudioIndex.value] },
        loading,
      )
      .then(async (res: any) => {
        if (res.type === 'application/json') {
          const text = await res.text();
          showError(text);
          return;
        }
        // 假设我们有一个 MP3 文件的字节数组
        // 创建 Blob 对象
        const blob = new Blob([res], { type: 'audio/mp3' });

        // 创建对象 URL
        const url = URL.createObjectURL(blob);

        // 测试blob是否能正常播放
        // const link = document.createElement('a')
        // link.href = window.URL.createObjectURL(blob)
        // link.download = "abc.mp3"
        // link.click()

        // 检查 audioPlayer 是否已经引用了 DOM 元素
        if (audioPlayer.value) {
          audioPlayer.value[currentAudioIndex.value].src = url;
          audioPlayer.value[currentAudioIndex.value].play(); // 自动播放音频
          audioPlayer.value[currentAudioIndex.value].addEventListener(
            'ended',
            () => {
              currentAudioIndex.value += 1;
              playAnswerTextPart();
            },
          );
        } else {
          console.error(
            'audioPlayer.value is not an instance of HTMLAudioElement',
          );
        }
      })
      .catch((_error) => {
        // console.log('err:', _error);
      });
  }
};

const pausePlayAnswerText = () => {
  audioPlayerStatus.value = false;
  if (props.ttsType === 'TTS' && audioPlayer.value) {
    audioPlayer.value?.forEach((item) => {
      item.pause();
    });
  }
  if (props.ttsType === 'BROWSER') {
    window.speechSynthesis.pause();
  }
};
</script>
<template>
  <div>
    <div class="flex-between mt-2">
      <div>
        <ElText type="info">
          <span class="ml-1">{{ datetimeFormat(data.create_time) }}</span>
        </ElText>
      </div>
      <div>
        <!-- 语音播放 -->
        <span v-if="tts">
          <ElTooltip
            effect="dark"
            :content="$$t('aiChat.operation.play')"
            placement="top"
            v-if="!audioPlayerStatus"
          >
            <ElButton text @click="playAnswerText(data?.answer_text)">
              <AppIcon icon-name="app-video-play" class="color-secondary" />
            </ElButton>
          </ElTooltip>
          <ElTooltip
            v-else
            effect="dark"
            :content="$$t('aiChat.operation.pause')"
            placement="top"
          >
            <ElButton type="primary" text @click="pausePlayAnswerText()">
              <AppIcon icon-name="app-video-pause" class="color-secondary" />
            </ElButton>
          </ElTooltip>
        </span>
        <span class="ml-2">
          <ElTooltip
            effect="dark"
            :content="$$t('common.copy')"
            placement="top"
          >
            <ElButton text @click="copyClick(data?.answer_text)">
              <AppIcon icon-name="app-copy" class="color-secondary" />
            </ElButton>
          </ElTooltip>
        </span>

        <!-- TODO: 需要实现 EditContentDialog 和 EditMarkDialog 组件 -->
        <!-- <template v-if="permissionPrecise.chat_log_add_knowledge(id)">
          <span class="ml-2" v-if="buttonData.improve_paragraph_id_list.length === 0">
            <el-tooltip effect="dark" :content="$$t('views.chatLog.editContent')" placement="top">
              <el-button text @click="editContent(data)">
                <AppIcon iconName="app-edit" class="color-secondary"></AppIcon>
              </el-button>
            </el-tooltip>
          </span>
          <span v-else class="ml-2">
            <el-tooltip effect="dark" :content="$$t('views.chatLog.editMark')" placement="top">
              <el-button text @click="editMark(data)">
                <AppIcon iconName="app-document-active" class="primary"></AppIcon>
              </el-button>
            </el-tooltip>
          </span>
        </template> -->
        <span class="ml-2" v-if="buttonData?.vote_status === '0'">
          <ElButton text disabled>
            <AppIcon icon-name="app-like-color" />
          </ElButton>
        </span>
        <span class="ml-2" v-if="buttonData?.vote_status === '1'">
          <ElButton text disabled>
            <AppIcon icon-name="app-oppose-color" />
          </ElButton>
        </span>
        <!-- <EditContentDialog ref="EditContentDialogRef" @refresh="refreshContent" />
        <EditMarkDialog ref="EditMarkDialogRef" @refresh="refreshMark" /> -->
        <!-- 先渲染，不然不能播放   -->
        <audio
          ref="audioPlayer"
          v-for="item in audioList"
          :key="item"
          controls
          hidden="hidden"
        ></audio>
      </div>
    </div>

    <ElCard
      class="layout-bg mt-4"
      shadow="always"
      v-if="buttonData?.vote_status !== '-1' && data.vote_reason"
    >
      <VoteReasonContent
        v-if="buttonData?.id"
        :vote-type="buttonData?.vote_status"
        :chat-id="buttonData?.chat_id"
        :record-id="buttonData?.id"
        readonly
        :default-reason="data.vote_reason"
        :default-other-content="data.vote_other_content"
      />
    </ElCard>
  </div>
</template>
<style lang="scss" scoped></style>
