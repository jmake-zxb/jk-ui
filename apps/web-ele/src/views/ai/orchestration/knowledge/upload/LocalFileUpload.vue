<script setup lang="ts">
import type { UploadFiles } from 'element-plus';

import type { Ref } from 'vue';

import { computed, inject, nextTick, ref, useAttrs } from 'vue';

import { Delete } from '@element-plus/icons-vue';
import {
  ElButton,
  ElCard,
  ElCol,
  ElIcon,
  ElMessage,
  ElRow,
  ElText,
  ElUpload,
} from 'element-plus';

interface FormField {
  field?: string;
  label?: string;
  [key: string]: unknown;
}

const props = withDefaults(
  defineProps<{
    formField: FormField;
    modelValue?: any[];
  }>(),
  {
    modelValue: () => [],
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: any[]];
}>();

const upload = inject<(file: File, loading: Ref<boolean>) => Promise<any>>(
  'upload',
  () => Promise.resolve({ data: '' }),
);

const attrs = useAttrs() as Record<string, any>;

const loading = ref(false);

const fileTypeList = computed<string[]>(() => {
  const list = attrs.file_type_list;
  if (!Array.isArray(list)) return [];
  return list.map((item: string) => item.toUpperCase());
});

const accept = computed(() => {
  return fileTypeList.value.map((item) => `.${item.toLowerCase()}`).join(',');
});

const formats = computed(() => {
  return fileTypeList.value.join('、');
});

const fileSizeLimit = computed(() => {
  return attrs.file_size_limit ?? 50;
});

const fileCountLimit = computed(() => {
  return attrs.file_count_limit ?? 100;
});

function getFileExtension(name: string): string {
  if (!name) return '';
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx + 1).toUpperCase();
}

function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '0B';
  if (bytes === 0) return '0B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = (bytes / k ** i).toFixed(i === 0 ? 0 : 1);
  return `${size}${units[i]}`;
}

function getFileIcon(name?: string): string {
  if (!name) return '';
  const ext = getFileExtension(name);
  const iconMap: Record<string, string> = {
    CSV: 'csv',
    DOC: 'doc',
    DOCX: 'docx',
    HTML: 'html',
    JPG: 'jpg',
    JPEG: 'jpg',
    MD: 'md',
    PDF: 'pdf',
    PNG: 'png',
    PPT: 'ppt',
    TXT: 'txt',
    XLS: 'xls',
    XLSX: 'xlsx',
    ZIP: 'zip',
  };
  const type = iconMap[ext] || 'unknown';
  return type;
}

function onExceed() {
  ElMessage.error(`最多只能上传${fileCountLimit.value}个文件`);
}

function handlePreview(directory: boolean) {
  nextTick(() => {
    const inputDom = document.querySelector(
      '.el-upload__input',
    ) as HTMLInputElement | null;
    if (inputDom) {
      inputDom.webkitdirectory = directory;
    }
  });
}

function fileHandleChange(file: any, fileList: UploadFiles) {
  const isLimit = file?.size / 1024 / 1024 < fileSizeLimit.value;
  if (!isLimit) {
    ElMessage.error(`文件大小不能超过${fileSizeLimit.value}MB`);
    fileList.splice(-1, 1);
    return;
  }

  const ext = getFileExtension(file?.name);
  if (!fileTypeList.value.includes(ext)) {
    if (file?.name !== '.DS_Store') {
      ElMessage.error('不支持的文件类型');
    }
    fileList.splice(-1, 1);
    return;
  }

  if (file?.size === 0) {
    ElMessage.error('不能上传空文件');
    fileList.splice(-1, 1);
    return;
  }

  upload(file.raw, loading).then((ok: any) => {
    const fileId = ok.id;
    const newFile = { file_id: fileId, name: file.name, size: file.size };
    const updated = [...props.modelValue, newFile];
    emit('update:modelValue', updated);
  });
}

function deleteFile(index: number) {
  const updated = [...props.modelValue];
  updated.splice(index, 1);
  emit('update:modelValue', updated);
}
</script>

<template>
  <div v-loading="loading" class="w-full">
    <ElUpload
      :webkitdirectory="false"
      class="w-full"
      drag
      multiple
      :file-list="modelValue"
      action="#"
      :auto-upload="false"
      :show-file-list="false"
      :accept="accept"
      :limit="fileCountLimit"
      :on-exceed="onExceed"
      :on-change="fileHandleChange"
      @click.prevent="handlePreview(false)"
    >
      <div class="el-upload__text">
        <p>
          将文件拖到此处，或
          <em class="hover" @click.prevent="handlePreview(false)"
            >点击选择文件</em
          >
          <em class="hover ml-4" @click.prevent="handlePreview(true)"
            >点击选择文件夹</em
          >
        </p>
        <div class="upload__decoration">
          <p>
            最多上传{{ fileCountLimit }}个文件，单文件不超过{{
              fileSizeLimit
            }}MB
          </p>
          <p>支持格式：{{ formats }}</p>
        </div>
      </div>
    </ElUpload>
    <ElRow :gutter="8" v-if="modelValue?.length" class="mt-16">
      <template v-for="(item, index) in modelValue" :key="index">
        <ElCol :span="12" class="mb-8">
          <ElCard
            shadow="never"
            style="
              --el-card-padding: 8px 12px;

              line-height: normal;
            "
          >
            <div class="flex-between">
              <div class="flex">
                <div
                  class="file-icon"
                  :class="`file-icon--${getFileIcon(item?.name)}`"
                >
                  {{ getFileExtension(item?.name) || '?' }}
                </div>
                <div class="ml-8">
                  <p class="ellipsis-1" :title="item?.name">{{ item?.name }}</p>
                  <ElText type="info" size="small">
                    {{ formatFileSize(item?.size) || '0K' }}
                  </ElText>
                </div>
              </div>
              <ElButton text @click="deleteFile(index)">
                <ElIcon><Delete /></ElIcon>
              </ElButton>
            </div>
          </ElCard>
        </ElCol>
      </template>
    </ElRow>
  </div>
</template>

<style scoped>
.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.flex {
  display: flex;
  align-items: center;
}

.ellipsis-1 {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ml-8 {
  margin-left: 8px;
}

.ml-4 {
  margin-left: 4px;
}

.mt-16 {
  margin-top: 16px;
}

.mb-8 {
  margin-bottom: 8px;
}

.w-full {
  width: 100%;
}

.hover {
  font-style: normal;
  color: var(--el-color-primary);
  cursor: pointer;
}

.upload__decoration {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.file-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  font-size: 10px;
  font-weight: 700;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 6px;
}
</style>
