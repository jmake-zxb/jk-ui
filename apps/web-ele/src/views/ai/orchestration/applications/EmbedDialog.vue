<script setup lang="ts">
import { computed, ref } from 'vue';

import { useAppConfig } from '@vben/hooks';

import { ElButton, ElDialog, ElMessage, ElTabPane, ElTabs } from 'element-plus';

import { adaptationUrl } from '#/utils/other';

defineProps<{
  applicationId?: number | string;
}>();

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

const visible = ref(false);
const activeTab = ref('fullscreen');
const accessToken = ref('');
const apiInputParams = ref('');

const publicChatRoute = '/ui/chat';

const normalizedApiInputParams = computed(() => {
  const value = apiInputParams.value
    .trim()
    .replace(/^\?/, '')
    .replace(/^&/, '');
  return value;
});

const embedBaseUrl = computed(() => {
  if (!accessToken.value) return '';
  const params = normalizedApiInputParams.value;
  const query = params ? `?${params}` : '';
  return `${window.location.origin}${publicChatRoute}/${accessToken.value}${query}`;
});

const fullscreenCode = computed(() => {
  if (!embedBaseUrl.value) return '';
  return `<iframe src="${embedBaseUrl.value}" style="width: 100%; height: 100%; min-height: 640px; border: 0;" allow="microphone"></iframe>`;
});

const mobileCode = computed(() => {
  if (!accessToken.value) return '';
  const params = normalizedApiInputParams.value;
  const suffix = params ? `?mode=mobile&${params}` : '?mode=mobile';
  const url = `${window.location.origin}${publicChatRoute}/${accessToken.value}${suffix}`;
  return `<iframe src="${url}" style="width: 100%; height: 100%; border: 0;" allow="microphone"></iframe>`;
});

const floatingScriptCode = computed(() => {
  if (!accessToken.value) return '';
  const protocol = window.location.protocol.replace(':', '');
  const host = window.location.host;
  const baseUrl = apiURL || window.location.origin;
  const params = normalizedApiInputParams.value;
  const suffix = params ? `&${params}` : '';
  const scriptUrl = `${baseUrl}${adaptationUrl('/ai/api/embed.js')}?protocol=${protocol}&host=${host}&token=${accessToken.value}${suffix}`;
  return `<script async defer src="${scriptUrl}"><${'/'}script>`;
});

function open(token: string, params = '') {
  accessToken.value = token;
  apiInputParams.value = params;
  activeTab.value = 'fullscreen';
  visible.value = true;
}

async function copyCode(code: string) {
  if (!code) {
    ElMessage.warning('暂无可复制内容');
    return;
  }
  await navigator.clipboard?.writeText(code);
  ElMessage.success('已复制');
}

defineExpose({ open });
</script>

<template>
  <ElDialog
    v-model="visible"
    title="嵌入第三方"
    width="720px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
  >
    <ElTabs v-model="activeTab">
      <ElTabPane label="全屏嵌入" name="fullscreen">
        <p class="embed-desc">
          将以下代码嵌入到您的网站中，用户可全屏使用聊天功能。
        </p>
        <pre class="embed-code-block">{{ fullscreenCode }}</pre>
        <div class="embed-actions">
          <ElButton type="primary" @click="copyCode(fullscreenCode)">
            复制代码
          </ElButton>
        </div>
      </ElTabPane>
      <ElTabPane label="悬浮窗嵌入" name="floating">
        <p class="embed-desc">
          将以下脚本代码嵌入到您的网站中，页面右下角将出现悬浮对话窗口。
        </p>
        <pre class="embed-code-block">{{ floatingScriptCode }}</pre>
        <div class="embed-actions">
          <ElButton type="primary" @click="copyCode(floatingScriptCode)">
            复制代码
          </ElButton>
        </div>
      </ElTabPane>
      <ElTabPane label="移动端嵌入" name="mobile">
        <p class="embed-desc">
          适配移动端的嵌入代码，可嵌入到移动应用的 WebView 中。
        </p>
        <pre class="embed-code-block">{{ mobileCode }}</pre>
        <div class="embed-actions">
          <ElButton type="primary" @click="copyCode(mobileCode)">
            复制代码
          </ElButton>
        </div>
      </ElTabPane>
    </ElTabs>
    <template #footer>
      <ElButton @click="visible = false">关闭</ElButton>
    </template>
  </ElDialog>
</template>

<style scoped lang="scss">
.embed-desc {
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.embed-code-block {
  padding: 12px;
  overflow: auto;
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  line-height: 1.6;
  word-break: break-all;
  white-space: pre-wrap;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.embed-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
