<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps({
  disabled: {
    default: false,
    type: Boolean,
  },
  start: {
    default: false,
    type: Boolean,
  },
  time: {
    default: 0,
    type: Number,
  },
});

const emit = defineEmits(['touchEnd', 'touchStart']);

const startY = ref(0);
const isTouching = ref(false);
const dialogVisible = ref(false);
const message = ref('按住说话');

watch(
  () => [props.time, props.start],
  ([time, start]) => {
    if (start) {
      isTouching.value = true;
      dialogVisible.value = true;
      message.value = '松开结束，上滑取消';
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
      message.value = '松开结束，上滑取消';
    } else {
      dialogVisible.value = false;
      isTouching.value = false;
    }
  },
);

function onTouchStart(event: any) {
  event.preventDefault();
  if (props.disabled) {
    return;
  }
  emit('touchStart');
  startY.value = event.touches[0].clientY;
}

function onTouchMove(event: any) {
  if (!isTouching.value) return;
  event.preventDefault();
  const currentY = event.touches[0].clientY;
  const deltaY = currentY - startY.value;
  if (deltaY < -50) {
    message.value = '松开手指，取消发送';
    isTouching.value = false;
  }
}

function onTouchEnd() {
  emit('touchEnd', isTouching.value);
}
</script>

<template>
  <div class="touch-chat g-p-8 g-pb-0">
    <el-button
      text
      bg
      class="microphone-button w-full"
      style="
        padding: 1.2rem 0 !important;
        font-size: 1rem;
        background-color: #eff0f1;
      "
      @touchend="onTouchEnd"
      @touchmove="onTouchMove"
      @touchstart="onTouchStart"
      :disabled="disabled"
    >
      {{ disabled ? '对话中...' : '按住说话' }}
    </el-button>
    <transition name="el-fade-in-linear">
      <el-card
        class="custom-speech-card white-bg"
        :class="isTouching ? '' : 'active'"
        v-if="dialogVisible"
      >
        <p>
          <el-text type="info" v-if="isTouching">
            00:{{ props.time < 10 ? `0${props.time}` : props.time }}
          </el-text>
          <span class="lighter" v-else>
            {{ message }}
          </span>
        </p>
        <el-avatar :size="isTouching ? 43 : 50" icon="Close" class="close" />
        <p
          class="lighter"
          :style="{ visibility: isTouching ? 'visible' : 'hidden' }"
        >
          {{ message }}
        </p>
        <div class="speech-img flex-center border-r-6 g-mt-16">
          <el-icon v-if="isTouching" :size="25" color="#409eff">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15a.998.998 0 00-.98-.85c-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08a6.993 6.993 0 005.91-5.78c.1-.6-.39-1.14-1-1.14z"
              />
            </svg>
          </el-icon>
          <el-icon v-else :size="25">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15a.998.998 0 00-.98-.85c-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08a6.993 6.993 0 005.91-5.78c.1-.6-.39-1.14-1-1.14z"
              />
            </svg>
          </el-icon>
        </div>
      </el-card>
    </transition>
  </div>
</template>

<style lang="scss" scoped>
/* ── MaxKB-migrated utility classes ── */
.g-p-8 {
  padding: 8px;
}

.g-pb-0 {
  padding-bottom: 0;
}

.w-full {
  width: 100%;
}

.lighter {
  font-weight: 400;
  color: var(--app-text-color-secondary);
}

.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.border-r-6 {
  overflow: hidden;
  border-radius: 6px;
}

.g-mt-16 {
  margin-top: 16px;
}

/* ── Component styles ── */

.custom-speech-card {
  position: fixed;
  bottom: 10px;
  left: 50%;
  z-index: 999;
  width: 92%;
  color: var(--app-text-color-secondary);
  text-align: center;
  user-select: none;
  border: 1px solid var(--el-border-color-light);
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
