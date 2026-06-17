<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';

import { Close, Refresh, Search, Setting, User } from '@element-plus/icons-vue';
import {
  ElButton,
  ElCard,
  ElCheckbox,
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
  ElText,
  ElUpload,
} from 'element-plus';
import { cloneDeep } from 'lodash-es';

import {
  getApplicationSetting,
  saveApplicationSetting,
} from '#/api/ai/applications';

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

function onFileChange(file: any, field: string) {
  // 验证文件大小 (10MB)
  const isLimit = file?.size / 1024 / 1024 < 10;
  if (!isLimit) {
    ElMessage.warning('文件大小不能超过 10MB');
    return;
  }
  // 创建本地预览 URL
  const url = URL.createObjectURL(file.raw);
  // 更新表单字段
  (form as any)[field] = url;
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
    width="900px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    align-center
    destroy-on-close
    class="display-setting-dialog"
  >
    <template #header>
      <div class="dialog-header">
        <h3>展示设置</h3>
        <div class="header-actions">
          <ElButton link @click="resetForm">
            <ElIcon class="reset-icon"><Refresh /></ElIcon>
            恢复默认
          </ElButton>
          <ElDivider direction="vertical" />
        </div>
      </div>
    </template>

    <div v-loading="loading" class="display-setting-body">
      <div class="preview-pane">
        <div class="preview-container" :style="previewBackgroundStyle">
          <div class="preview-header" :style="headerStyle">
            <div class="preview-header-content">
              <div class="preview-header-left">
                <!-- 应用头像 -->
                <div class="preview-app-icon">
                  <img v-if="form.icon" :src="form.icon" alt="icon" />
                  <ElIcon v-else><Setting /></ElIcon>
                </div>
                <h4 class="preview-app-name">
                  {{ applicationName || '应用名称' }}
                </h4>
              </div>
              <div class="preview-header-right">
                <ElIcon
                  :size="20"
                  :style="{ color: form.customTheme.header_font_color }"
                >
                  <Search />
                </ElIcon>
                <ElIcon
                  :size="20"
                  :style="{ color: form.customTheme.header_font_color }"
                >
                  <Close />
                </ElIcon>
              </div>
            </div>
          </div>
          <div class="preview-body">
            <div class="preview-messages">
              <!-- AI 回复 -->
              <div class="preview-message-row">
                <div v-if="form.showAvatar" class="preview-avatar">
                  <img v-if="form.avatar" :src="form.avatar" alt="ai" />
                  <ElIcon v-else><Setting /></ElIcon>
                </div>
                <img
                  src="/static/display-bg2.png"
                  alt=""
                  :width="
                    form.showAvatar
                      ? form.showUserAvatar
                        ? '232px'
                        : '270px'
                      : form.showUserAvatar
                        ? '260px'
                        : '300px'
                  "
                />
              </div>
              <!-- 用户提问 -->
              <div class="preview-message-row preview-message-row--user">
                <img
                  src="/static/display-bg3.png"
                  alt=""
                  :width="
                    form.showUserAvatar
                      ? form.showAvatar
                        ? '227px'
                        : '255px'
                      : form.showAvatar
                        ? '265px'
                        : '292px'
                  "
                  style="object-fit: contain"
                />
                <div v-if="form.showUserAvatar" class="preview-avatar ml-8">
                  <img
                    v-if="form.userAvatar"
                    :src="form.userAvatar"
                    alt="user"
                  />
                  <ElIcon v-else><User /></ElIcon>
                </div>
              </div>
            </div>
            <!-- 输入区域 -->
            <div class="preview-input-area">
              <img src="/static/display-bg1.png" alt="" class="w-full" />
              <div v-if="form.disclaimer" class="preview-disclaimer">
                {{ form.disclaimerValue }}
              </div>
            </div>
          </div>
        </div>
        <!-- 悬浮图标 -->
        <div class="preview-float">
          <img v-if="form.floatIcon" :src="form.floatIcon" alt="float" />
          <ElIcon v-else :size="22"><Setting /></ElIcon>
        </div>
      </div>

      <ElScrollbar class="form-pane">
        <div class="form-content">
          <ElForm :model="form" label-position="top" class="setting-form">
            <!-- 主题颜色 -->
            <div class="theme-section">
              <h5>自定义主题色</h5>
              <div class="theme-row">
                <div class="theme-item">
                  <ElColorPicker v-model="form.customTheme.theme_color" />
                  <span v-if="!form.customTheme.theme_color">默认</span>
                </div>
                <div class="theme-item">
                  <h5>标题字色</h5>
                  <ElColorPicker v-model="form.customTheme.header_font_color" />
                </div>
              </div>
            </div>

            <!-- 图片设置 -->
            <ElCard shadow="never" class="mb-8">
              <div class="card-header">
                <span class="card-title">应用 LOGO</span>
                <ElUpload
                  action="#"
                  :auto-upload="false"
                  :show-file-list="false"
                  accept="image/jpeg, image/png, image/gif"
                  :on-change="(file: any) => onFileChange(file, 'icon')"
                >
                  <ElButton size="small">替换</ElButton>
                </ElUpload>
              </div>
              <ElText type="info" size="small">
                支持 JPG/PNG/GIF，最大 10MB
              </ElText>
            </ElCard>

            <ElCard shadow="never" class="mb-8">
              <div class="card-header">
                <span class="card-title">聊天背景</span>
                <ElUpload
                  action="#"
                  :auto-upload="false"
                  :show-file-list="false"
                  accept="image/jpeg, image/png, image/gif"
                  :on-change="
                    (file: any) => onFileChange(file, 'chatBackground')
                  "
                >
                  <ElButton size="small">替换</ElButton>
                </ElUpload>
              </div>
              <ElText type="info" size="small">
                支持 JPG/PNG/GIF，最大 10MB
              </ElText>
            </ElCard>

            <ElCard shadow="never" class="mb-8">
              <div class="card-header">
                <span class="card-title">AI 回复头像</span>
                <div class="card-actions">
                  <ElCheckbox v-model="form.showAvatar">显示</ElCheckbox>
                  <ElUpload
                    action="#"
                    :auto-upload="false"
                    :show-file-list="false"
                    accept="image/jpeg, image/png, image/gif"
                    :on-change="(file: any) => onFileChange(file, 'avatar')"
                    class="ml-8"
                  >
                    <ElButton size="small">替换</ElButton>
                  </ElUpload>
                </div>
              </div>
              <ElText type="info" size="small">
                支持 JPG/PNG/GIF，最大 10MB
              </ElText>
            </ElCard>

            <ElCard shadow="never" class="mb-8">
              <div class="card-header">
                <span class="card-title">用户提问头像</span>
                <div class="card-actions">
                  <ElCheckbox v-model="form.showUserAvatar">显示</ElCheckbox>
                  <ElUpload
                    action="#"
                    :auto-upload="false"
                    :show-file-list="false"
                    accept="image/jpeg, image/png, image/gif"
                    :on-change="(file: any) => onFileChange(file, 'userAvatar')"
                    class="ml-8"
                  >
                    <ElButton size="small">替换</ElButton>
                  </ElUpload>
                </div>
              </div>
              <ElText type="info" size="small">
                支持 JPG/PNG/GIF，最大 10MB
              </ElText>
            </ElCard>

            <ElCard shadow="never" class="mb-8">
              <div class="card-header">
                <span class="card-title">悬浮图标</span>
                <ElUpload
                  action="#"
                  :auto-upload="false"
                  :show-file-list="false"
                  accept="image/jpeg, image/png, image/gif"
                  :on-change="(file: any) => onFileChange(file, 'floatIcon')"
                >
                  <ElButton size="small">替换</ElButton>
                </ElUpload>
              </div>
              <ElText type="info" size="small">
                支持 JPG/PNG/GIF，最大 10MB
              </ElText>
              <div class="location-section">
                <div class="location-header">
                  <span>图标默认位置</span>
                  <ElCheckbox v-model="form.draggable">
                    可拖拽调整位置
                  </ElCheckbox>
                </div>
                <div class="location-row">
                  <div class="location-cell">
                    <ElSelect
                      v-model="form.floatLocation.x.type"
                      style="width: 80px"
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
                  <div class="location-cell">
                    <ElSelect
                      v-model="form.floatLocation.y.type"
                      style="width: 80px"
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
                </div>
              </div>
            </ElCard>

            <!-- 显示选项 -->
            <div class="checkbox-section">
              <ElCheckbox v-model="form.showHistory">显示历史记录</ElCheckbox>
              <ElCheckbox v-model="form.showGuide">显示引导信息</ElCheckbox>
              <ElCheckbox v-model="form.disclaimer">免责声明</ElCheckbox>
              <ElFormItem v-if="form.disclaimer" label="免责声明文本">
                <ElInput
                  v-model="form.disclaimerValue"
                  :maxlength="128"
                  show-word-limit
                  placeholder="请输入免责声明"
                />
              </ElFormItem>
            </div>
          </ElForm>
        </div>
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
  align-items: center;
  justify-content: space-between;
  padding-right: 17px;
}

.dialog-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
}

.reset-icon {
  margin-right: 4px;
}

.display-setting-body {
  display: flex;
  gap: 16px;
  height: 570px;
}

.preview-pane {
  position: relative;
  min-width: 400px;
  height: 570px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.preview-container {
  position: absolute;
  top: 25px;
  left: 16px;
  width: 330px;
  height: 520px;
  overflow: hidden;
  background: var(--dialog-bg-gradient-color, var(--el-bg-color));
  background-repeat: no-repeat;
  background-position: center;
  background-size: auto 100%;
  border: 1px solid #fff;
  border-radius: 8px;
  box-shadow: 0 4px 8px 0 rgb(0 0 0 / 10%);
}

.preview-header {
  box-sizing: border-box;
  height: var(--app-header-height, 48px);
  line-height: var(--app-header-height, 48px);
  background: var(--app-header-bg-color, var(--el-bg-color));
  border-bottom: 1px solid var(--el-border-color);
}

.preview-header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
}

.preview-header-left {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-left: 24px;
}

.preview-header-right {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-right: 16px;
}

.preview-app-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
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
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.preview-body {
  position: relative;
  height: calc(100% - 48px);
}

.preview-messages {
  position: relative;
  padding: 16px;
}

.preview-message-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 4px;
}

.preview-message-row--user {
  justify-content: flex-end;
}

.preview-avatar {
  display: flex;
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

.ml-8 {
  margin-left: 8px;
}

.preview-input-area {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 16px;
  padding-bottom: 8px;
  text-align: center;
}

.preview-input-area img {
  width: 100%;
}

.preview-disclaimer {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.preview-float {
  position: absolute;
  right: 8px;
  bottom: 15px;
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
  flex: 1;
  height: 100%;
}

.form-content {
  padding: 8px;
}

.setting-form {
  padding-right: 8px;
}

.theme-section {
  margin-bottom: 16px;
}

.theme-section h5 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
}

.theme-row {
  display: flex;
  gap: 24px;
}

.theme-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.theme-item h5 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.mb-8 {
  margin-bottom: 8px;
}

.w-full {
  width: 100%;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.card-title {
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.card-actions {
  display: flex;
  align-items: center;
}

.location-section {
  padding-top: 12px;
  margin-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.location-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.location-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.location-cell {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.location-cell :deep(.el-input-number) {
  flex: 1;
  min-width: 0;
}

.unit {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.checkbox-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.display-setting-dialog :deep(.el-dialog__header) {
  padding-right: 17px;
}

.display-setting-dialog :deep(.el-dialog__headerbtn) {
  top: 14px;
}
</style>
