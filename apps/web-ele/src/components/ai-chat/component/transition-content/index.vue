<script setup lang="ts">
defineProps<{
  application: Record<string, any>;
  text: string;
  type: 'ai-chat' | 'debug-ai-chat' | 'log' | 'share';
}>();
</script>

<template>
  <div class="question-content">
    <div class="content">
      <span>{{ text }}</span>
      <span class="dotting"></span>
    </div>
    <div class="avatar" v-if="application.show_user_avatar">
      <el-image
        v-if="application.user_avatar"
        :src="application.user_avatar"
        alt=""
        fit="cover"
        style="display: block; width: 28px; height: 28px"
      />
      <el-avatar v-else :size="28">
        <span style="font-size: 14px">U</span>
      </el-avatar>
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
  margin-bottom: 16px; /* was: .mb-16 */
  font-weight: 400; /* was: .lighter */

  .content {
    padding: 12px 16px; /* was: .p-12-16 */
    background: #d6e2ff;
    border-radius: 8px; /* was: .border-r-8 (MaxKB has this on content) */
  }

  .avatar {
    float: left;
    margin-left: 8px; /* was: .ml-8 */
  }

  /* was: .dotting — typing animation dots */
  .dotting {
    box-sizing: border-box;
    display: inline-block;
    width: 10px;
    min-height: 2px;
    padding-right: 2px;
    padding-left: 2px;
    margin-left: 2px;
    background-color: currentcolor;
    background-clip: content-box;
    border-right: 2px solid currentcolor;
    border-left: 2px solid currentcolor;
    animation: dot 0.8s infinite step-start both;

    &::before {
      content: '';
    }
  }
}

@keyframes dot {
  0% {
    background-color: transparent;
    border-right-color: transparent;
    border-left-color: currentcolor;
  }

  33% {
    background-color: transparent;
    border-right-color: currentcolor;
    border-left-color: currentcolor;
  }

  66% {
    background-color: currentcolor;
    border-right-color: currentcolor;
    border-left-color: currentcolor;
  }

  100% {
    background-color: currentcolor;
    border-right-color: currentcolor;
    border-left-color: transparent;
  }
}
</style>
