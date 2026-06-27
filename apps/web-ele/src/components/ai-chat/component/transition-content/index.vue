<script setup lang="ts">
import { ElAvatar, ElImage } from 'element-plus';

defineProps<{
  application: any;
  text: string;
  type: 'ai-chat' | 'debug-ai-chat' | 'log' | 'share';
}>();
</script>
<template>
  <!-- 问题内容 -->
  <div class="question-content item-content lighter mb-4">
    <div class="content p-12-16 rounded-lg">
      <span> {{ text }}</span
      ><span class="dotting"></span>
    </div>
    <div class="avatar ml-2" v-if="application.show_user_avatar">
      <ElImage
        v-if="application.user_avatar"
        :src="application.user_avatar"
        alt=""
        fit="cover"
        style="display: block; width: 28px; height: 28px"
      />
      <ElAvatar v-else>
        <img src="#/assets/user-icon.svg" style="width: 50%" alt="" />
      </ElAvatar>
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
      flex-grow: 1;
      min-width: 40% !important;
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
