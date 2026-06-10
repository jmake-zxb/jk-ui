<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';

import { Refresh, Setting, User } from '@element-plus/icons-vue';
import {
  ElButton,
  ElColorPicker,
  ElDialog,
  ElDivider,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElScrollbar,
  ElSelect,
  ElSwitch,
} from 'element-plus';
import { cloneDeep } from 'lodash-es';

import {
  getApplicationSetting,
  saveApplicationSetting,
} from '#/api/ai/applications';
import { UploadImg } from '#/component';

import { safeParseJson } from '../utils';

interface CustomTheme {
  header_font_color: string;
  theme_color: string;
}

interface FloatLocationAxis {
  type: string;
  value: number;
}

interface FloatLocation {
  x: FloatLocationAxis;
  y: FloatLocationAxis;
}

interface ApplicationSettingForm {
  applicationId?: number | string;
  avatar: string;
  chatBackground: string;
  customTheme: CustomTheme;
  disclaimer: boolean;
  disclaimerValue: string;
  draggable: boolean;
  floatIcon: string;
  floatLocation: FloatLocation;
  icon: string;
  showAvatar: boolean;
  showGuide: boolean;
  showHistory: boolean;
  showUserAvatar: boolean;
  userAvatar: string;
}

interface ApplicationSettingResponse {
  applicationId?: number | string;
  avatar?: string;
  chatBackground?: string;
  customTheme?: string;
  disclaimer?: boolean;
  disclaimerValue?: string;
  draggable?: boolean;
  floatIcon?: string;
  floatLocation?: string;
  icon?: string;
  showAvatar?: boolean;
  showGuide?: boolean;
  showHistory?: boolean;
  showUserAvatar?: boolean;
  userAvatar?: string;
}

const props = defineProps<{
  applicationId?: number | string;
  applicationName?: string;
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'saved'): void;
}>();

const DEFAULT_DISCLAIMER = '本内容由 AI 生成，仅供参考。';

const defaultSetting: ApplicationSettingForm = {
  applicationId: undefined,
  avatar: '',
  chatBackground: '',
  customTheme: { header_font_color: '#1f2329', theme_color: '' },
  disclaimer: false,
  disclaimerValue: DEFAULT_DISCLAIMER,
  draggable: true,
  floatIcon: '',
  floatLocation: {
    x: { type: 'right', value: 0 },
    y: { type: 'bottom', value: 30 },
  },
  icon: '',
  showAvatar: true,
  showGuide: true,
  showHistory: true,
  showUserAvatar: false,
  userAvatar: '',
};

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const form = reactive<ApplicationSettingForm>(cloneDeep(defaultSetting));
const loading = ref(false);
const saving = ref(false);

function applyResponseToForm(data: ApplicationSettingResponse) {
  const merged: ApplicationSettingForm = cloneDeep(defaultSetting);
  merged.applicationId = data.applicationId ?? props.applicationId;
  merged.showHistory = data.showHistory ?? defaultSetting.showHistory;
  merged.showGuide = data.showGuide ?? defaultSetting.showGuide;
  merged.draggable = data.draggable ?? defaultSetting.draggable;
  merged.showAvatar = data.showAvatar ?? defaultSetting.showAvatar;
  merged.showUserAvatar = data.showUserAvatar ?? defaultSetting.showUserAvatar;
  merged.disclaimer = data.disclaimer ?? defaultSetting.disclaimer;
  merged.disclaimerValue =
    data.disclaimerValue || defaultSetting.disclaimerValue;
  merged.icon = data.icon || '';
  merged.chatBackground = data.chatBackground || '';
  merged.avatar = data.avatar || '';
  merged.floatIcon = data.floatIcon || '';
  merged.userAvatar = data.userAvatar || '';

  const parsedTheme = safeParseJson(
    data.customTheme || '',
    null,
  ) as null | Partial<CustomTheme>;
  merged.customTheme = {
    header_font_color:
      parsedTheme?.header_font_color ||
      defaultSetting.customTheme.header_font_color,
    theme_color:
      parsedTheme?.theme_color || defaultSetting.customTheme.theme_color,
  };

  const parsedLoc = safeParseJson(
    data.floatLocation || '',
    null,
  ) as null | Partial<FloatLocation>;
  merged.floatLocation = {
    x: {
      type: parsedLoc?.x?.type || defaultSetting.floatLocation.x.type,
      value:
        typeof parsedLoc?.x?.value === 'number'
          ? parsedLoc.x.value
          : defaultSetting.floatLocation.x.value,
    },
    y: {
      type: parsedLoc?.y?.type || defaultSetting.floatLocation.y.type,
      value:
        typeof parsedLoc?.y?.value === 'number'
          ? parsedLoc.y.value
          : defaultSetting.floatLocation.y.value,
    },
  };

  Object.assign(form, merged);
}

async function loadSetting() {
  if (!props.applicationId) return;
  loading.value = true;
  try {
    const data = (await getApplicationSetting(
      props.applicationId,
    )) as ApplicationSettingResponse;
    applyResponseToForm(data || {});
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  Object.assign(form, cloneDeep(defaultSetting));
  form.applicationId = props.applicationId;
}

async function submit() {
  if (!props.applicationId) {
    ElMessage.warning('缺少应用 ID');
    return;
  }
  saving.value = true;
  try {
    const payload: Record<string, unknown> = {
      applicationId: props.applicationId,
      avatar: form.avatar,
      chatBackground: form.chatBackground,
      customTheme: JSON.stringify(form.customTheme),
      disclaimer: form.disclaimer,
      disclaimerValue: form.disclaimerValue,
      draggable: form.draggable,
      floatIcon: form.floatIcon,
      floatLocation: JSON.stringify(form.floatLocation),
      icon: form.icon,
      showAvatar: form.showAvatar,
      showGuide: form.showGuide,
      showHistory: form.showHistory,
      showUserAvatar: form.showUserAvatar,
      userAvatar: form.userAvatar,
    };
    const saved = (await saveApplicationSetting(
      props.applicationId,
      payload,
    )) as ApplicationSettingResponse;
    applyResponseToForm(saved || {});
    ElMessage.success('保存成功');
    emit('saved');
    dialogVisible.value = false;
  } finally {
    saving.value = false;
  }
}

const headerStyle = computed(() => ({
  background: form.customTheme.theme_color || '#fff',
  color: form.customTheme.header_font_color || '#1f2329',
}));

const previewBackgroundStyle = computed(() =>
  form.chatBackground
    ? {
        backgroundImage: `url(${form.chatBackground})`,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
      }
    : {},
);

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      resetForm();
      void loadSetting();
    }
  },
);
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    title="展示设置"
    width="960px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    align-center
    destroy-on-close
    class="display-setting-dialog"
  >
    <template #header>
      <div class="dialog-header">
        <h3>展示设置</h3>
        <ElButton link @click="resetForm">
          <ElIcon class="reset-icon"><Refresh /></ElIcon>
          恢复默认
        </ElButton>
      </div>
    </template>

    <div v-loading="loading" class="display-setting-body">
      <div class="preview-pane">
        <div class="preview-frame" :style="previewBackgroundStyle">
          <div class="preview-header" :style="headerStyle">
            <div class="preview-app">
              <div class="preview-app-icon">
                <img v-if="form.icon" :src="form.icon" alt="icon" />
                <ElIcon v-else><Setting /></ElIcon>
              </div>
              <span class="preview-app-name">
                {{ applicationName || '应用名称' }}
              </span>
            </div>
          </div>
          <div class="preview-conversation">
            <div class="preview-row preview-row--ai">
              <div v-if="form.showAvatar" class="preview-avatar">
                <img v-if="form.avatar" :src="form.avatar" alt="ai" />
                <ElIcon v-else><Setting /></ElIcon>
              </div>
              <div class="preview-bubble preview-bubble--ai">
                您好，请问有什么可以帮您？
              </div>
            </div>
            <div class="preview-row preview-row--user">
              <div class="preview-bubble preview-bubble--user">
                这是一个示例提问，用于预览展示设置。
              </div>
              <div v-if="form.showUserAvatar" class="preview-avatar">
                <img v-if="form.userAvatar" :src="form.userAvatar" alt="user" />
                <ElIcon v-else><User /></ElIcon>
              </div>
            </div>
          </div>
          <div v-if="form.disclaimer" class="preview-disclaimer">
            {{ form.disclaimerValue }}
          </div>
        </div>
        <div class="preview-float">
          <img v-if="form.floatIcon" :src="form.floatIcon" alt="float" />
          <ElIcon v-else :size="22"><Setting /></ElIcon>
        </div>
      </div>

      <ElScrollbar class="form-pane">
        <ElForm :model="form" label-position="top" class="setting-form">
          <ElDivider content-position="left">主题</ElDivider>
          <div class="theme-row">
            <ElFormItem label="主题色">
              <ElColorPicker v-model="form.customTheme.theme_color" />
            </ElFormItem>
            <ElFormItem label="标题字色">
              <ElColorPicker v-model="form.customTheme.header_font_color" />
            </ElFormItem>
          </div>

          <ElDivider content-position="left">图片</ElDivider>
          <ElFormItem label="应用 LOGO">
            <UploadImg
              v-model="form.icon"
              :limit="1"
              :file-size="2"
              :file-type="['png', 'jpg', 'jpeg', 'svg']"
            />
          </ElFormItem>
          <ElFormItem label="聊天背景">
            <UploadImg
              v-model="form.chatBackground"
              :limit="1"
              :file-size="2"
              :file-type="['png', 'jpg', 'jpeg', 'svg']"
            />
          </ElFormItem>
          <ElFormItem label="AI 回复头像">
            <UploadImg
              v-model="form.avatar"
              :limit="1"
              :file-size="2"
              :file-type="['png', 'jpg', 'jpeg', 'svg']"
            />
          </ElFormItem>
          <ElFormItem label="用户提问头像">
            <UploadImg
              v-model="form.userAvatar"
              :limit="1"
              :file-size="2"
              :file-type="['png', 'jpg', 'jpeg', 'svg']"
            />
          </ElFormItem>
          <ElFormItem label="悬浮图标">
            <UploadImg
              v-model="form.floatIcon"
              :limit="1"
              :file-size="2"
              :file-type="['png', 'jpg', 'jpeg', 'svg']"
            />
          </ElFormItem>

          <ElDivider content-position="left">显示选项</ElDivider>
          <div class="switch-grid">
            <div class="switch-row">
              <span>显示历史记录</span>
              <ElSwitch v-model="form.showHistory" />
            </div>
            <div class="switch-row">
              <span>显示引导信息</span>
              <ElSwitch v-model="form.showGuide" />
            </div>
            <div class="switch-row">
              <span>悬浮窗可拖拽</span>
              <ElSwitch v-model="form.draggable" />
            </div>
            <div class="switch-row">
              <span>显示 AI 头像</span>
              <ElSwitch v-model="form.showAvatar" />
            </div>
            <div class="switch-row">
              <span>显示用户头像</span>
              <ElSwitch v-model="form.showUserAvatar" />
            </div>
            <div class="switch-row">
              <span>显示免责声明</span>
              <ElSwitch v-model="form.disclaimer" />
            </div>
          </div>
          <ElFormItem v-if="form.disclaimer" label="免责声明文本">
            <ElInput
              v-model="form.disclaimerValue"
              :maxlength="128"
              show-word-limit
              placeholder="请输入免责声明"
            />
          </ElFormItem>

          <ElDivider content-position="left">悬浮位置</ElDivider>
          <div class="location-row">
            <ElFormItem label="水平位置">
              <div class="location-cell">
                <ElSelect
                  v-model="form.floatLocation.x.type"
                  style="width: 90px"
                >
                  <ElOption label="左" value="left" />
                  <ElOption label="右" value="right" />
                </ElSelect>
                <ElInputNumber
                  v-model="form.floatLocation.x.value"
                  :min="0"
                  :step="1"
                  :precision="0"
                  :value-on-clear="0"
                  step-strictly
                  controls-position="right"
                />
                <span class="unit">px</span>
              </div>
            </ElFormItem>
            <ElFormItem label="垂直位置">
              <div class="location-cell">
                <ElSelect
                  v-model="form.floatLocation.y.type"
                  style="width: 90px"
                >
                  <ElOption label="上" value="top" />
                  <ElOption label="下" value="bottom" />
                </ElSelect>
                <ElInputNumber
                  v-model="form.floatLocation.y.value"
                  :min="0"
                  :step="1"
                  :precision="0"
                  :value-on-clear="0"
                  step-strictly
                  controls-position="right"
                />
                <span class="unit">px</span>
              </div>
            </ElFormItem>
          </div>
        </ElForm>
      </ElScrollbar>
    </div>

    <template #footer>
      <ElButton @click="dialogVisible = false">取消</ElButton>
      <ElButton type="primary" :loading="saving" @click="submit">
        保存
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped lang="scss">
.dialog-header {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding-right: 24px;
}

.dialog-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.reset-icon {
  margin-right: 4px;
}

.display-setting-body {
  display: grid;
  grid-template-columns: 380px minmax(0, 1fr);
  gap: 16px;
  height: 560px;
}

.preview-pane {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.preview-frame {
  display: flex;
  flex: 1;
  flex-direction: column;
  margin: 16px;
  overflow: hidden;
  background-color: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgb(0 0 0 / 6%);
}

.preview-header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.preview-app {
  display: flex;
  gap: 8px;
  align-items: center;
}

.preview-app-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  overflow: hidden;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.preview-app-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-app-name {
  font-size: 14px;
  font-weight: 600;
}

.preview-conversation {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  overflow: auto;
}

.preview-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.preview-row--user {
  flex-direction: row-reverse;
}

.preview-avatar {
  display: inline-flex;
  flex: 0 0 28px;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  overflow: hidden;
  background: var(--el-fill-color-light);
  border-radius: 50%;
}

.preview-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-bubble {
  max-width: 240px;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.6;
  border-radius: 8px;
}

.preview-bubble--ai {
  color: var(--el-text-color-primary);
  background: var(--el-fill-color);
}

.preview-bubble--user {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-8);
}

.preview-disclaimer {
  flex: 0 0 auto;
  padding: 8px 16px 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.preview-float {
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 50%;
  box-shadow: 0 4px 8px rgb(0 0 0 / 10%);
}

.preview-float img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.form-pane {
  height: 100%;
}

.setting-form {
  padding-right: 8px;
}

.theme-row,
.location-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.location-cell {
  display: flex;
  gap: 8px;
  align-items: center;
}

.unit {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.switch-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 24px;
  margin-bottom: 12px;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
</style>
