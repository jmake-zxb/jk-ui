<script setup lang="ts">
import { ElResult } from 'element-plus';
</script>

<template>
  <div class="public-chat-no-service">
    <ElResult
      icon="warning"
      title="暂无服务"
      sub-title="公开聊天服务不可用或访问令牌已失效"
    />
  </div>
</template>

<style scoped lang="scss">
.public-chat-no-service {
  display: grid;
  place-items: center;
  width: 100vw;
  height: 100vh;
  background: var(--el-bg-color-page);
}
</style>
