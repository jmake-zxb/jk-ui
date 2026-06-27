<script setup lang="ts">
import { ref, watch } from 'vue';

import { ElAvatar, ElButton, ElCard, ElText } from 'element-plus';

import { $t } from '#/locales';

const props = defineProps({
  time: {
    type: Number,
    default: 0,
  },
  start: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});
const emit = defineEmits(['touchStart', 'touchEnd']);
// 移动端语音
const startY = ref(0);
const isTouching = ref(false);
const dialogVisible = ref(false);
const message = ref($t('aiChat.inputPlaceholder.holdToTalk'));

watch(
  () => [props.time, props.start],
  ([time, start]) => {
    if (start) {
      isTouching.value = true;
      dialogVisible.value = true;
      message.value = $t('aiChat.inputPlaceholder.touchChatMessage');
      if (time === 60) {
        dialogVisible.value = false;
        emit('touchEnd', isTouching.value);
        isTouching.value = false;
      }
    } else {
      dialogVisible.value = false;
      isTouching.value = false;
    }
  },
);
watch(
  () => props.start,
  (val) => {
    if (val) {
      isTouching.value = true;
      dialogVisible.value = true;
      message.value = $t('aiChat.inputPlaceholder.touchChatMessage');
    } else {
      dialogVisible.value = false;
      isTouching.value = false;
    }
  },
);

function ontouchStart(event: any) {
  // 阻止默认滚动行为
  event.preventDefault();
  if (props.disabled) {
    return;
  }
  emit('touchStart');
  startY.value = event.touches[0].clientY;
}
function onTouchMove(event: any) {
  if (!isTouching.value) return;
  // 阻止默认滚动行为
  event.preventDefault();
  const currentY = event.touches[0].clientY;
  const deltaY = currentY - startY.value;
  // 判断是否上滑
  if (deltaY < -50) {
    // -50 是一个阈值，可以根据需要调整
    message.value = $t('aiChat.inputPlaceholder.cancelTouchChat');
    isTouching.value = false;
  }
}
function ontouchEnd() {
  emit('touchEnd', isTouching.value);
}
</script>

<template>
  <div class="touch-chat p-2 pb-0">
    <ElButton
      text
      bg
      class="microphone-button w-full"
      style="
        padding: 1.2rem 0 !important;
        font-size: 1rem;
        background-color: #eff0f1;
      "
      @touchstart="ontouchStart"
      @touchmove="onTouchMove"
      @touchend="ontouchEnd"
      :disabled="disabled"
    >
      {{
        disabled
          ? $$t('aiChat.inputPlaceholder.chatting')
          : $$t('aiChat.inputPlaceholder.holdToTalk')
      }}
    </ElButton>
    <!-- 使用 custom-class 自定义样式 -->
    <transition name="el-fade-in-linear">
      <ElCard
        class="custom-speech-card white-bg"
        :class="isTouching ? '' : 'active'"
        v-if="dialogVisible"
      >
        <p>
          <ElText type="info" v-if="isTouching">
            00:{{ props.time < 10 ? `0${props.time}` : props.time }}
          </ElText>
          <span class="lighter" v-else>
            {{ message }}
          </span>
        </p>
        <ElAvatar :size="isTouching ? 43 : 50" icon="Close" class="close" />
        <!-- <div class="close"></div> -->
        <p
          class="lighter"
          :style="{ visibility: isTouching ? 'visible' : 'hidden' }"
        >
          {{ message }}
        </p>
        <div class="speech-img flex-center mt-4 rounded-md">
          <img
            v-if="isTouching"
            src="#/assets/chat/acoustic-color.svg"
            alt=""
          />
          <img v-else src="#/assets/chat/acoustic.svg" alt="" />
        </div>
      </ElCard>
    </transition>
  </div>
</template>

<style lang="scss" scoped>
.custom-speech-card {
  position: fixed;
  bottom: 10px;
  left: 50%; /* 水平居中 */
  z-index: 999;
  width: 92%;
  color: var(--app-text-color-secondary);
  text-align: center;
  user-select: none;
  border: 1px solid #fff;
  box-shadow: 0 6px 24px 0 rgb(var(--el-text-color-primary-rgb), 0.08);
  transform: translateX(-50%);
  -webkit-touch-callout: none;

  .close {
    margin: 20px 0;
    font-size: 1.6rem;
    color: var(--app-text-color-secondary);
    background: rgb(255 255 255 / 100%);
    border: 1px solid rgb(222 224 227 / 100%);
    box-shadow: 0 4px 8px 0 rgb(var(--el-text-color-primary-rgb), 0.1);
  }

  .speech-img {
    padding: 8px;
    text-align: center;
    background: #ebf1ff;

    img {
      height: 25px;
    }
  }

  &.active {
    .close {
      font-size: 2rem;
      color: #fff;
      background: #f54a45;
      border: none;
    }

    .speech-img {
      background: #eff0f1;
    }
  }
}
</style>
