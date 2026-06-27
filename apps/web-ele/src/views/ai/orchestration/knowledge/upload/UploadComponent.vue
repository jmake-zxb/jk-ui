<script setup lang="ts">
import type { FormInstance, FormRules, UploadFiles } from 'element-plus';

import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from 'vue';
import { useRoute } from 'vue-router';

import { Delete, WarningFilled } from '@element-plus/icons-vue';
import {
  ElButton,
  ElCard,
  ElCol,
  ElForm,
  ElFormItem,
  ElIcon,
  ElMessage,
  ElRadioButton,
  ElRadioGroup,
  ElRow,
  ElText,
  ElUpload,
} from 'element-plus';

import { requestClient } from '#/api/request';

const route = useRoute();
const knowledgeId = computed(() => route.query.id as string);

const formRef = ref<FormInstance>();
const loading = ref(false);

const form = ref({
  fileList: [] as any[],
  fileType: 'txt',
});

const rules = reactive<FormRules>({
  fileList: [{ message: '请选择文件', required: true, trigger: 'change' }],
});

const fileCountLimit = ref(50);
const fileSizeLimit = ref(100);

watch(
  () => form.value,
  () => {
    // Keep local state
  },
  { deep: true },
);

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
  return iconMap[ext] || 'unknown';
}

function isRightType(fileName: string, fileType: string): boolean {
  const ext = getFileExtension(fileName);
  const typeMap: Record<string, string[]> = {
    QA: ['XLSX', 'XLS', 'CSV', 'ZIP'],
    table: ['XLSX', 'XLS', 'CSV'],
    txt: [
      'TXT',
      'MD',
      'LOG',
      'DOCX',
      'PDF',
      'HTML',
      'ZIP',
      'XLSX',
      'XLS',
      'CSV',
    ],
  };
  const allowed = typeMap[fileType] ?? typeMap.txt;
  return allowed.includes(ext);
}

function radioChange() {
  form.value.fileList = [];
}

function deleteFile(index: number) {
  form.value.fileList.splice(index, 1);
}

function fileHandleChange(file: any, fileList: UploadFiles) {
  const isLimit = file?.size / 1024 / 1024 < fileSizeLimit.value;
  if (!isLimit) {
    ElMessage.error(`文件大小不能超过${fileSizeLimit.value}MB`);
    fileList.splice(-1, 1);
    return;
  }

  if (!isRightType(file?.name, form.value.fileType)) {
    if (file?.name !== '.DS_Store') {
      ElMessage.error('不支持的文件类型');
    }
    fileList.splice(-1, 1);
    return;
  }

  if (file?.size === 0) {
    ElMessage.error('不能上传空文件');
    fileList.splice(-1, 1);
  }
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

function downloadTemplate(type: string) {
  const ext = type === 'csv' ? 'csv' : 'xlsx';
  const filename = `${type}模板.${ext}`;
  requestClient
    .get(
      `/ai/api/knowledge/${knowledgeId.value}/documents/export-qa-template`,
      {
        params: { filename, type },
        responseType: 'blob',
      },
    )
    .then((res: any) => {
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    })
    .catch(() => {
      ElMessage.error('下载模板失败');
    });
}

function downloadTableTemplate(type: string) {
  const ext = type === 'csv' ? 'csv' : 'xlsx';
  const filename = `${type}模板.${ext}`;
  requestClient
    .get(
      `/ai/api/knowledge/${knowledgeId.value}/documents/export-table-template`,
      {
        params: { filename, type },
        responseType: 'blob',
      },
    )
    .then((res: any) => {
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    })
    .catch(() => {
      ElMessage.error('下载模板失败');
    });
}

function validate() {
  if (!formRef.value) return Promise.resolve(false);
  return formRef.value
    .validate()
    .then(() => true)
    .catch(() => false);
}

function getDetail() {
  if (!knowledgeId.value) return;
  requestClient
    .get(`/ai/api/knowledge/${knowledgeId.value}`)
    .then((res: any) => {
      const data = res.data || res;
      if (data.file_count_limit) fileCountLimit.value = data.file_count_limit;
      if (data.file_size_limit) fileSizeLimit.value = data.file_size_limit;
    })
    .catch(() => {
      // Use defaults
    });
}

onMounted(() => {
  getDetail();
});

onUnmounted(() => {
  form.value = { fileList: [], fileType: 'txt' };
});

defineExpose({ form, validate });
</script>

<template>
  <h4 class="title-decoration-1 mb-8">上传文档</h4>
  <ElForm
    ref="formRef"
    :model="form"
    :rules="rules"
    label-position="top"
    require-asterisk-position="right"
    v-loading="loading"
  >
    <div class="mb-16 mt-16">
      <ElRadioGroup v-model="form.fileType" @change="radioChange">
        <ElRadioButton value="txt">文本文档</ElRadioButton>
        <ElRadioButton value="table">表格文档</ElRadioButton>
        <ElRadioButton value="QA">问答对</ElRadioButton>
      </ElRadioGroup>
    </div>

    <!-- QA mode -->
    <ElFormItem prop="fileList" v-if="form.fileType === 'QA'">
      <div class="update-info p-8-12 border-r-6 mb-16 flex w-full">
        <div class="mt-4">
          <ElIcon color="var(--el-color-warning)" :size="16">
            <WarningFilled />
          </ElIcon>
        </div>
        <div class="lighter ml-16">
          <p>
            1. 请按照模板格式上传问答对文件
            <ElButton type="primary" link @click="downloadTemplate('excel')">
              下载 Excel 模板
            </ElButton>
            <ElButton type="primary" link @click="downloadTemplate('csv')">
              下载 CSV 模板
            </ElButton>
          </p>
          <p>2. 支持批量导入，每个文件不超过{{ fileSizeLimit }}MB</p>
          <p>
            3. 最多上传{{ fileCountLimit }}个文件，单文件不超过{{
              fileSizeLimit
            }}MB
          </p>
        </div>
      </div>
      <ElUpload
        :webkitdirectory="false"
        class="mb-4 w-full"
        drag
        multiple
        v-model:file-list="form.fileList"
        action="#"
        :auto-upload="false"
        :show-file-list="false"
        accept=".xlsx, .xls, .csv,.zip"
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
            <p>支持格式：XLS、XLSX、CSV、ZIP</p>
          </div>
        </div>
      </ElUpload>
    </ElFormItem>

    <!-- Table mode -->
    <ElFormItem prop="fileList" v-else-if="form.fileType === 'table'">
      <div class="update-info p-8-12 border-r-6 mb-16 flex w-full">
        <div class="mt-4">
          <ElIcon color="var(--el-color-warning)" :size="16">
            <WarningFilled />
          </ElIcon>
        </div>
        <div class="lighter ml-16">
          <p>
            1. 请按照模板格式上传表格文件
            <ElButton
              type="primary"
              link
              @click="downloadTableTemplate('excel')"
            >
              下载 Excel 模板
            </ElButton>
            <ElButton type="primary" link @click="downloadTableTemplate('csv')">
              下载 CSV 模板
            </ElButton>
          </p>
          <p>2. 支持批量导入，每个文件不超过{{ fileSizeLimit }}MB</p>
          <p>3. 表格文档将按行解析为独立段落</p>
          <p>
            4. 最多上传{{ fileCountLimit }}个文件，单文件不超过{{
              fileSizeLimit
            }}MB
          </p>
        </div>
      </div>
      <ElUpload
        :webkitdirectory="false"
        class="mb-4 w-full"
        drag
        multiple
        v-model:file-list="form.fileList"
        action="#"
        :auto-upload="false"
        :show-file-list="false"
        accept=".xlsx, .xls, .csv"
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
            <p>支持格式：XLS、XLSX、CSV</p>
          </div>
        </div>
      </ElUpload>
    </ElFormItem>

    <!-- TXT mode -->
    <ElFormItem prop="fileList" v-else>
      <div class="update-info p-8-12 border-r-6 mb-16 flex w-full">
        <div class="mt-4">
          <ElIcon color="var(--el-color-warning)" :size="16">
            <WarningFilled />
          </ElIcon>
        </div>
        <div class="lighter ml-16">
          <p>1. 支持上传多种格式的文档文件</p>
          <p>
            2. 最多上传{{ fileCountLimit }}个文件，单文件不超过{{
              fileSizeLimit
            }}MB
          </p>
        </div>
      </div>
      <ElUpload
        :webkitdirectory="false"
        class="w-full"
        drag
        multiple
        v-model:file-list="form.fileList"
        action="#"
        :auto-upload="false"
        :show-file-list="false"
        accept=".txt, .md, .log, .docx, .pdf, .html,.zip,.xlsx,.xls,.csv"
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
            <p>支持格式：TXT、Markdown、PDF、DOCX、HTML、XLS、XLSX、CSV、ZIP</p>
          </div>
        </div>
      </ElUpload>
    </ElFormItem>
  </ElForm>

  <ElRow :gutter="8" v-if="form.fileList?.length">
    <template v-for="(item, index) in form.fileList" :key="index">
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
</template>

<style scoped>
.title-decoration-1 {
  font-size: 16px;
  font-weight: 600;
}

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

.ml-16 {
  margin-left: 16px;
}

.mt-4 {
  margin-top: 4px;
}

.mt-16 {
  margin-top: 16px;
}

.mb-8 {
  margin-bottom: 8px;
}

.mb-16 {
  margin-bottom: 16px;
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

.update-info {
  background: var(--el-color-warning-light-9);
  border-radius: 6px;
}

.p-8-12 {
  padding: 8px 12px;
}

.border-r-6 {
  border-radius: 6px;
}

.lighter {
  font-size: 13px;
  line-height: 1.8;
  color: var(--el-text-color-regular);
}

.lighter p {
  margin: 0;
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
