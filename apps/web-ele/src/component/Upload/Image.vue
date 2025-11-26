<script setup lang="ts">
import type {
  UploadFile,
  UploadInstance,
  UploadProps,
  UploadRawFile,
  UploadUserFile,
} from 'element-plus';

import type { CSSProperties } from 'vue';

import { computed, nextTick, onMounted, ref, watch } from 'vue';

import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import { ElImageViewer, ElLoading, ElMessage, ElUpload } from 'element-plus';
import Sortable from 'sortablejs';

import { $t } from '#/locales';

// 定义 API 返回数据的接口
interface ApiResponse {
  code: number;
  msg?: string;
  data: {
    fileName: string;
    url: string;
  };
}

// 简单的 Sortable 事件接口
interface SortableEvent extends Event {
  oldIndex?: number;
  newIndex?: number;
}

// 定义组件 Props 接口
interface Props {
  modelValue?: string | string[] | UploadUserFile[];
  action?: string;
  data?: Record<string, any>;
  limit?: number;
  fileSize?: number;
  fileType?: string[];
  isShowTip?: boolean;
  drag?: boolean;
  disabled?: boolean;
  borderRadius?: number | string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  action: '/admin/sys-file/upload',
  data: () => ({}),
  limit: 1,
  fileSize: 5,
  fileType: () => ['png', 'jpg', 'jpeg'],
  isShowTip: true,
  drag: true,
  disabled: false,
  borderRadius: '',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

const uploadImgUrl = computed(() => apiURL + props.action);

// 状态变量
const number = ref(0);
const uploadList = ref<UploadUserFile[]>([]);
const imgViewVisible = ref(false);
const imageUploadRef = ref<UploadInstance>();
const fileList = ref<UploadUserFile[]>([]);
const previewImageList = ref<string[]>([]);

// Headers
const headers = computed<Record<string, string>>(() => {
  const accessStore = useAccessStore();
  return {
    Authorization: `Bearer ${accessStore.accessToken}`,
  };
});

// 是否显示提示
const showTip = computed(() => {
  return props.isShowTip && (!!props.fileType || !!props.fileSize);
});

// 上传组件样式
const uploadStyle = computed<CSSProperties>(() => {
  const style: CSSProperties = {};
  if (props.borderRadius) {
    const value =
      typeof props.borderRadius === 'number'
        ? `${props.borderRadius}px`
        : props.borderRadius;
    // Element Plus 使用 CSS 变量控制圆角
    (style as any)['--el-upload-picture-card-border-radius'] = value;
  }
  return style;
});

// 监听 modelValue 变化
watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      // 转为数组
      const list = Array.isArray(val) ? val : (val as string).split(',');
      // 转为对象数组
      fileList.value = list.map((item) => {
        if (typeof item === 'string') {
          return { name: item, url: item } as UploadUserFile;
        }
        return item as UploadUserFile;
      });
    } else {
      fileList.value = [];
    }
  },
  { deep: true, immediate: true },
);

// 拖拽排序
onMounted(() => {
  if (props.drag) {
    nextTick(() => {
      const element = document.querySelector('.el-upload-list') as HTMLElement;
      if (element) {
        Sortable.create(element, {
          onEnd: (evt: SortableEvent) => {
            const { oldIndex, newIndex } = evt;
            if (oldIndex !== undefined && newIndex !== undefined) {
              const movedItem = fileList.value.splice(oldIndex, 1)[0];
              if (movedItem) {
                fileList.value.splice(newIndex, 0, movedItem);
                emit('update:modelValue', listToString(fileList.value));
              }
            }
          },
        });
      }
    });
  }
});

// 上传前校验
const handleBeforeUpload: UploadProps['beforeUpload'] = (
  file: UploadRawFile,
) => {
  let isImg = false;
  if (props.fileType.length > 0) {
    let fileExtension = '';
    // 优化：使用 includes 检查存在，lastIndexOf 仅用于获取位置
    if (file.name.includes('.')) {
      fileExtension = file.name.slice(file.name.lastIndexOf('.') + 1);
    }

    // 优化：使用 includes 替代 indexOf > -1
    isImg = props.fileType.some((type) => {
      if (file.type.includes(type)) return true;
      if (fileExtension && fileExtension.includes(type)) return true;
      return false;
    });
  } else {
    // 优化：使用 includes
    isImg = file.type.includes('image');
  }

  if (!isImg) {
    ElMessage.error(
      $t('page.upload-img.invalidFormatError', {
        fileType: props.fileType.join('/'),
      }),
    );
    return false;
  }
  // 优化：使用 includes
  if (file.name.includes(',')) {
    ElMessage.error($t('page.upload-img.invalidFilenameError'));
    return false;
  }
  if (props.fileSize) {
    const isLt = file.size / 1024 / 1024 < props.fileSize;
    if (!isLt) {
      ElMessage.error(
        $t('page.upload-img.sizeLimitError', { fileSize: props.fileSize }),
      );
      return false;
    }
  }
  ElLoading.service({ text: $t('page.upload-img.uploading') });
  number.value++;
  return true;
};

// 文件个数超出
const handleExceed: UploadProps['onExceed'] = () => {
  ElMessage.error(
    $t('page.upload-img.limitExceedError', { limit: props.limit }),
  );
};

// 上传成功回调
const handleUploadSuccess: UploadProps['onSuccess'] = (
  res: ApiResponse,
  file: UploadFile,
) => {
  if (res.code === 0) {
    uploadList.value.push({
      name: res.data.fileName,
      url: apiURL + res.data.url,
    } as UploadUserFile);
    uploadedSuccessfully();
  } else {
    number.value--;
    ElLoading.service().close();
    ElMessage.error(res.msg || $t('page.upload-img.uploadFailRetry'));
    imageUploadRef.value?.handleRemove(file);
    uploadedSuccessfully();
  }
};

// 删除图片
const handleDelete: UploadProps['onRemove'] = (file: UploadFile) => {
  // 优化：使用 findIndex 替代 map + indexOf，效率更高且代码更少
  const findex = fileList.value.findIndex((f) => f.name === file.name);
  if (findex !== -1) {
    fileList.value.splice(findex, 1);
    emit('update:modelValue', listToString(fileList.value));
  }
};

// 上传失败
const handleUploadError: UploadProps['onError'] = () => {
  ElMessage.error($t('page.upload-img.uploadFail'));
  ElLoading.service().close();
};

// 上传结束处理
const uploadedSuccessfully = () => {
  if (number.value > 0 && uploadList.value.length === number.value) {
    fileList.value = [...fileList.value, ...uploadList.value];
    uploadList.value = [];
    number.value = 0;
    emit('update:modelValue', listToString(fileList.value));
    ElLoading.service().close();
  }
};

// 预览
const handlePictureCardPreview: UploadProps['onPreview'] = (
  file: UploadFile,
) => {
  if (file.url) {
    previewImageList.value = [file.url];
    imgViewVisible.value = true;
  }
};

// 优化：使用 Array.filter 和 join 简化逻辑
const listToString = (
  list: UploadUserFile[],
  separator: string = ',',
): string => {
  return list
    .map((item) => item.url)
    .filter((url) => !!url) // 过滤掉空 url
    .join(separator);
};
</script>

<template>
  <div class="upload-container">
    <ElUpload
      ref="imageUploadRef"
      multiple
      :action="uploadImgUrl"
      list-type="picture-card"
      :on-success="handleUploadSuccess"
      :before-upload="handleBeforeUpload"
      :data="data"
      :limit="limit"
      :on-error="handleUploadError"
      :on-exceed="handleExceed"
      :on-remove="handleDelete"
      :show-file-list="true"
      :headers="headers"
      :file-list="fileList"
      :on-preview="handlePictureCardPreview"
      :class="{ hide: fileList.length >= limit }"
      :disabled="disabled"
      :style="uploadStyle"
    >
      <span class="icon-[ep--plus]"></span>
    </ElUpload>

    <!-- 上传提示 -->
    <div class="el-upload__tip" v-if="showTip">
      {{ $t('page.upload-img.uploadTipPrefix') }}
      <template v-if="fileSize">
        {{ $t('page.upload-img.sizeLimitTip') }}
        <b style="color: #f56c6c">{{ fileSize }}MB</b>
      </template>
      <template v-if="fileType">
        {{ $t('page.upload-img.formatTip') }}
        <b style="color: #f56c6c">{{ fileType.join('/') }}</b>
      </template>
      {{ $t('page.upload-img.fileSuffix') }}
    </div>

    <ElImageViewer
      v-if="imgViewVisible"
      :teleported="true"
      @close="imgViewVisible = false"
      :url-list="previewImageList"
    />
  </div>
</template>

<style scoped>
/* 控制加号部分 */
:deep(.hide .el-upload--picture-card) {
  display: none;
}

/* 边框圆角样式 */
:deep(.el-upload--picture-card) {
  border-radius: var(--el-upload-picture-card-border-radius, 6px);
}

:deep(.el-upload-list--picture-card .el-upload-list__item) {
  border-radius: var(--el-upload-picture-card-border-radius, 6px);
}

:deep(.el-upload-list--picture-card .el-upload-list__item img) {
  border-radius: var(--el-upload-picture-card-border-radius, 6px);
}
</style>
