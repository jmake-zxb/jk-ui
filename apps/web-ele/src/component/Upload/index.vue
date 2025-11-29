<!--文件上传组件-->
<script setup lang="ts" name="upload-file">
import type { UploadUserFile } from 'element-plus';

import { computed, ref, watch } from 'vue';

import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import { Document, Download } from '@element-plus/icons-vue';
import { ElButton, ElIcon, ElMessage, ElUpload } from 'element-plus';

import { downBlobFile } from '#/api/core/other';
import { $t } from '#/locales';
import { adaptationUrl, getQueryString } from '#/utils/other';

const props = defineProps({
  modelValue: {
    type: [String, Array],
    default: null,
  },
  // 数量限制
  limit: {
    type: Number,
    default: 5,
  },
  // 大小限制(MB)
  fileSize: {
    type: Number,
    default: 5,
  },
  fileType: {
    type: Array,
    default: () => [
      'png',
      'jpg',
      'jpeg',
      'doc',
      'xls',
      'ppt',
      'txt',
      'pdf',
      'docx',
      'xlsx',
      'pptx',
    ],
  },
  // 是否显示提示
  isShowTip: {
    type: Boolean,
    default: true,
  },
  uploadFileUrl: {
    type: String,
    default: '/admin/sys-file/upload',
  },
  type: {
    type: String,
    default: 'default',
    validator: (value: string) => {
      return ['default', 'simple'].includes(value);
    },
  },
  data: {
    type: Object,
    default: () => ({}),
  },
  dir: {
    type: String,
    default: '',
  },
  autoUpload: {
    type: Boolean,
    default: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue', 'change']);

// 定义基础URL
const { apiURL: baseUrl } = useAppConfig(import.meta.env, import.meta.env.PROD);

// 获取文件名
const getFileName = (file: any): string => {
  return file.url
    ? getQueryString(file.url, 'fileName') ||
        getQueryString(file.url, 'originalFileName') ||
        ''
    : 'File';
};

// 根据文件类型生成accept属性值
const fileAccept = computed(() => {
  if (!props.fileType || props.fileType.length === 0) return '';

  const acceptValues: string[] = [];

  for (const ext of props.fileType) {
    if (typeof ext === 'string') {
      acceptValues.push(`.${ext}`);
    }
  }

  return acceptValues.join(',');
});

interface UploadFileItem extends UploadUserFile {
  name: string;
  url: string;
  fileUrl: string;
  fileSize: number;
  fileName: string;
  fileType: string;
}

const number = ref(0);
const fileList = ref<UploadFileItem[]>([]);
const uploadList = ref<UploadFileItem[]>([]);
const fileUpload = ref();

// 请求头处理
const headers = computed<Record<string, string>>(() => {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
  };
});

// 请求参数处理
const formData = computed(() => {
  return Object.assign(props.data, { dir: props.dir });
});

// 上传前校检格式和大小
const handleBeforeUpload = (file: File) => {
  // 校检文件类型
  if (props.fileType.length > 0) {
    const fileName = file.name.split('.');
    const fileExt = fileName[fileName.length - 1];
    const isTypeOk = props?.fileType.indexOf(fileExt) >= 0;
    if (!isTypeOk) {
      ElMessage.error(
        `${$t('page.upload-excel.typeErrorText')} ${props.fileType.join('/')}!`,
      );
      return false;
    }
  }
  // 校检文件大小
  if (props.fileSize) {
    const isLt = file.size / 1024 / 1024 < props.fileSize;
    if (!isLt) {
      ElMessage.error(
        `${$t('page.upload-excel.sizeErrorText')} ${props.fileSize} MB!`,
      );
      return false;
    }
  }
  number.value++;
  return true;
};

// 上传成功回调
function handleUploadSuccess(res: any, file: any) {
  if (res.code === 0) {
    uploadList.value.push({
      name: file.name,
      url: `${res.data?.url}?originalFileName=${file.name}`,
      fileUrl: res.data?.fileName,
      fileSize: file.size,
      fileName: file.name,
      fileType: file.raw.type,
    });
    uploadedSuccessfully();
  } else {
    number.value--;
    ElMessage.error(res.msg);
    fileUpload.value.handleRemove(file);
    uploadedSuccessfully();
  }
}

// 上传结束处理
const uploadedSuccessfully = () => {
  if (number.value > 0 && uploadList.value.length === number.value) {
    fileList.value = [
      ...fileList.value.filter((f) => f.url !== undefined),
      ...uploadList.value,
    ];
    uploadList.value = [];
    number.value = 0;
    emit('update:modelValue', listToString(fileList.value));
    emit('change', listToString(fileList.value), fileList.value);
  }
};

const handleRemove = (file: { url: string }) => {
  fileList.value = fileList.value.filter((f) => f.url !== file.url);
  emit('update:modelValue', listToString(fileList.value));
  emit('change', listToString(fileList.value));
};

const handlePreview = (file: any) => {
  downBlobFile(file.url, {}, file.name);
};

// 添加 handleExceed 函数
const handleExceed = () => {
  ElMessage.warning(
    `${$t('page.upload-excel.uploadLimit')} ${props.limit} ${$t('page.upload-excel.files')}`,
  );
};

/**
 * 将对象数组转为字符串，以逗号分隔。
 * @param list 待转换的对象数组。
 * @param separator 分隔符，默认为逗号。
 * @returns {string} 返回转换后的字符串。
 */
const listToString = (list: UploadFileItem[], separator = ','): string => {
  let strs = '';
  separator = separator || ',';
  for (const i in list) {
    if (list[i]?.url) {
      strs += list[i].url + separator;
    }
  }
  return strs === '' ? '' : strs.slice(0, Math.max(0, strs.length - 1));
};

const handleUploadError = () => {
  ElMessage.error('上传文件失败');
};

/**
 * 监听 props 中的 modelValue 值变化，更新 fileList。
 */
watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      let temp = 1;
      // 首先将值转为数组
      const list = Array.isArray(val)
        ? val
        : (props.modelValue as string).split(',');
      // 然后将数组转为对象数组
      fileList.value = list.map((item: any) => {
        if (typeof item === 'string') {
          item = {
            name:
              getQueryString(item, 'originalFileName') ||
              getQueryString(item, 'fileName'),
            url: item,
          };
        }
        item.uid = item.uid || Date.now() + temp++;

        return item as UploadFileItem;
      });
    } else {
      fileList.value = [];
    }
  },
  { deep: true, immediate: true },
);

const submit = () => {
  fileUpload.value?.submit();
};

defineExpose({
  submit,
});
</script>

<template>
  <div class="upload-file w-full">
    <!-- 当禁用时只显示文件列表，不使用el-upload组件 -->
    <div v-if="props.disabled">
      <div
        v-if="fileList.length === 0"
        class="p flex items-center justify-center rounded-md bg-gray-50 px-4 text-gray-400"
      >
        <ElIcon class="mr-2 text-lg"><Document /></ElIcon>
        <span class="text-sm">{{ $t('page.upload-excel.noFiles') }}</span>
      </div>
      <div v-else>
        <div
          v-for="(file, index) in fileList"
          :key="index"
          class="group mb-1 flex cursor-pointer items-center rounded px-4 py-3 transition-colors duration-200 hover:bg-blue-50"
          @click="handlePreview(file)"
        >
          <ElIcon class="mr-3 text-blue-500"><Document /></ElIcon>
          <span
            class="flex-1 truncate text-gray-700 transition-colors duration-200 group-hover:text-blue-600"
          >
            {{ getFileName(file) }}
          </span>
          <ElIcon
            class="text-gray-400 transition-colors duration-200 group-hover:text-blue-500"
          >
            <Download />
          </ElIcon>
        </div>
      </div>
    </div>
    <!-- 默认上传组件 -->
    <ElUpload
      ref="fileUpload"
      v-if="props.type === 'default' && !props.disabled"
      :action="baseUrl + adaptationUrl(props.uploadFileUrl)"
      :before-upload="handleBeforeUpload"
      :file-list="fileList"
      :headers="headers"
      :limit="limit"
      :on-error="handleUploadError"
      :on-remove="handleRemove"
      :on-preview="handlePreview"
      :on-exceed="handleExceed"
      :data="formData"
      :auto-upload="autoUpload"
      :on-success="handleUploadSuccess"
      :accept="fileAccept"
      class="upload-file-uploader"
      drag
      multiple
    >
      <i class="el-icon-upload"></i>
      <div class="el-upload__text">
        {{ $t('page.upload-excel.operationNotice') }}
        <em>{{ $t('page.upload-excel.clickUpload') }}</em>
      </div>
      <template #tip>
        <div class="el-upload__tip" v-if="props.isShowTip">
          {{ $t('page.upload-excel.pleaseUpload') }}
          <template v-if="props.fileSize">
            {{ $t('page.upload-excel.size') }}
            <b style="color: #f56c6c">{{ props.fileSize }}MB</b>
          </template>
          <template v-if="props.fileType">
            {{ $t('page.upload-excel.format') }}
            <b style="color: #f56c6c">{{ props.fileType.join('/') }}</b>
          </template>
          {{ $t('page.upload-excel.file') }}
        </div>
      </template>
    </ElUpload>
    <!-- 简单上传组件 -->
    <ElUpload
      ref="fileUpload"
      v-if="props.type === 'simple' && !props.disabled"
      :action="baseUrl + adaptationUrl(props.uploadFileUrl)"
      :before-upload="handleBeforeUpload"
      :file-list="fileList"
      :headers="headers"
      :limit="limit"
      :auto-upload="autoUpload"
      :on-error="handleUploadError"
      :on-remove="handleRemove"
      :on-exceed="handleExceed"
      :data="formData"
      :on-success="handleUploadSuccess"
      :accept="fileAccept"
      class="upload-file-uploader"
      multiple
    >
      <ElButton type="primary" link>
        {{ $t('page.upload-excel.clickUpload') }}
      </ElButton>
      <template #tip>
        <div class="el-upload__tip" v-if="props.isShowTip">
          {{ $t('page.upload-excel.pleaseUpload') }}
          <template v-if="props.fileSize">
            {{ $t('page.upload-excel.size') }}
            <b style="color: #f56c6c">{{ props.fileSize }}MB</b>
          </template>
          <template v-if="props.fileType">
            {{ $t('page.upload-excel.format') }}
            <b style="color: #f56c6c">{{ props.fileType.join('/') }}</b>
          </template>
          {{ $t('page.upload-excel.file') }}
        </div>
      </template>
    </ElUpload>
  </div>
</template>
