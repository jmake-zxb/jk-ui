<script setup lang="ts">
import type { UploadFile } from 'element-plus';

import { computed, ref, watch } from 'vue';

import { Operation, Upload } from '@element-plus/icons-vue';
import {
  ElAvatar,
  ElButton,
  ElDialog,
  ElMessage,
  ElRadio,
  ElRadioGroup,
  ElUpload,
} from 'element-plus';

const props = withDefaults(
  defineProps<{
    defaultIcon?: string;
  }>(),
  {
    defaultIcon: '',
  },
);
const emit = defineEmits<{
  save: [icon: string];
}>();
const maxImageSizeMb = 10;
const maxImageSizeBytes = maxImageSizeMb * 1024 * 1024;
const allowedImageTypes = new Set(['image/gif', 'image/jpeg', 'image/png']);

const dialogVisible = ref(false);
const loading = ref(false);
const radioType = ref<'custom' | 'default'>('default');
const currentIcon = ref('');
const filePreviewUrl = ref('');
const fileDataUrl = ref('');

const customPreviewUrl = computed(
  () =>
    filePreviewUrl.value ||
    (isImageIcon(currentIcon.value) ? currentIcon.value : ''),
);
const defaultPreviewUrl = computed(() =>
  isImageIcon(props.defaultIcon) ? props.defaultIcon : '',
);

function isImageIcon(icon?: unknown) {
  const value = `${icon ?? ''}`.trim();
  return /^(?:https?:|data:image|blob:|\/|\.\/)/i.test(value);
}

function revokePreview() {
  if (filePreviewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(filePreviewUrl.value);
  }
  filePreviewUrl.value = '';
}

function resetUploadState() {
  revokePreview();
  fileDataUrl.value = '';
}

function imageTypeAllowed(file: File) {
  if (allowedImageTypes.has(file.type)) return true;
  return /\.(?:gif|jpe?g|png)$/i.test(file.name);
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(`${reader.result ?? ''}`));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

async function onChange(uploadFile: UploadFile) {
  const file = uploadFile.raw;
  if (!file) return false;
  if (!imageTypeAllowed(file)) {
    ElMessage.warning('仅支持 JPG、PNG、GIF 图片');
    return false;
  }
  if (file.size > maxImageSizeBytes) {
    ElMessage.warning(`图片大小不能超过 ${maxImageSizeMb}MB`);
    return false;
  }

  resetUploadState();
  radioType.value = 'custom';
  filePreviewUrl.value = URL.createObjectURL(file);
  fileDataUrl.value = await fileToDataUrl(file);
  return true;
}

function submit() {
  loading.value = true;
  try {
    if (radioType.value === 'default') {
      emit('save', props.defaultIcon || '');
      dialogVisible.value = false;
      return;
    }
    const icon = fileDataUrl.value || currentIcon.value;
    if (!isImageIcon(icon)) {
      ElMessage.warning('请上传图片');
      return;
    }
    emit('save', icon);
    dialogVisible.value = false;
  } finally {
    loading.value = false;
  }
}

function open(icon = '') {
  currentIcon.value = icon;
  radioType.value = isImageIcon(icon) ? 'custom' : 'default';
  resetUploadState();
  dialogVisible.value = true;
}

watch(dialogVisible, (visible) => {
  if (!visible) resetUploadState();
});

defineExpose({ open });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    append-to-body
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    title="Logo 设置"
    width="550px"
  >
    <ElRadioGroup v-model="radioType" class="avatar-radio-group">
      <ElRadio class="avatar-radio" value="default">
        <div class="avatar-radio__content">
          <p>默认</p>
          <ElAvatar
            class="avatar-radio__preview is-default"
            shape="square"
            :size="36"
          >
            <img v-if="defaultPreviewUrl" :src="defaultPreviewUrl" alt="" />
            <Operation v-else />
          </ElAvatar>
        </div>
      </ElRadio>

      <ElRadio class="avatar-radio" value="custom">
        <div class="avatar-radio__content">
          <p>自定义上传</p>
          <div class="avatar-upload-row">
            <ElAvatar
              v-if="customPreviewUrl"
              class="avatar-radio__preview"
              shape="square"
              :size="36"
            >
              <img :src="customPreviewUrl" alt="" />
            </ElAvatar>
            <ElUpload
              accept="image/jpeg,image/png,image/gif"
              action="#"
              :auto-upload="false"
              :on-change="onChange"
              :show-file-list="false"
            >
              <ElButton :disabled="radioType !== 'custom'" :icon="Upload">
                上传
              </ElButton>
            </ElUpload>
          </div>
          <div class="avatar-upload-tip">
            支持 JPG、PNG、GIF，单个文件不超过 {{ maxImageSizeMb }}MB。
          </div>
        </div>
      </ElRadio>
    </ElRadioGroup>

    <template #footer>
      <ElButton @click="dialogVisible = false">取消</ElButton>
      <ElButton type="primary" :loading="loading" @click="submit">
        保存
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped lang="scss">
.avatar-radio-group {
  display: grid;
  gap: 12px;
  width: 100%;
}

.avatar-radio {
  align-items: flex-start;
  height: auto;
  padding: 12px;
  margin: 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.avatar-radio :deep(.el-radio__label) {
  width: 100%;
}

.avatar-radio__content p {
  margin: 0 0 8px;
  color: var(--el-text-color-primary);
}

.avatar-upload-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.avatar-radio__preview {
  flex-shrink: 0;
  overflow: hidden;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.avatar-radio__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-upload-tip {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
