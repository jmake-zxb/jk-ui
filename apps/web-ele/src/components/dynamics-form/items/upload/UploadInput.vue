<script setup lang="ts">
import type { FormField } from '../../type';

import { computed, inject, ref, useAttrs } from 'vue';

import { Delete } from '@element-plus/icons-vue';
import {
  ElButton,
  ElCard,
  ElIcon,
  ElMessage,
  ElSpace,
  ElUpload,
  useFormDisabled,
} from 'element-plus';

import { getImgUrl } from '#/utils/file-util';

const props = withDefaults(
  defineProps<{ formField: FormField; modelValue?: any }>(),
  {
    modelValue: () => [],
  },
);
const emit = defineEmits(['update:modelValue']);
const inputDisabled = useFormDisabled();
const attrs = useAttrs() as any;
const upload = inject('upload', undefined) as any;
function formatSize(sizeInBytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = sizeInBytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

const deleteFile = (file: any) => {
  if (inputDisabled.value) {
    return;
  }
  fileArray.value = fileArray.value.filter((f: any) => f.uid !== file.uid);
  emit('update:modelValue', fileArray.value);
};

const model_value = computed({
  get: () => {
    if (!props.modelValue) {
      emit('update:modelValue', []);
    }
    return props.modelValue;
  },
  set: (v: Array<any>) => {
    emit('update:modelValue', v);
  },
});
const fileArray = ref<any>([]);

const loading = ref<boolean>(false);

const uploadFile = async (file: any, fileList: Array<any>) => {
  fileList.splice(fileList.indexOf(file), 1);
  if (fileArray.value.some((f: any) => f.name === file.name)) {
    ElMessage.warning('文件已存在');
    return;
  }
  const max_file_size = (props.formField as any).max_file_size;
  if (file.size / 1024 / 1024 > max_file_size) {
    ElMessage.warning(`文件大小不能超过${max_file_size}MB`);
    return;
  }

  if (attrs.limit && fileList.length > attrs.limit) {
    ElMessage.warning(`最多上传${attrs.limit}个文件`);
    return;
  }
  if (upload) {
    upload(file.raw, loading).then((ok: any) => {
      const split_path = ok.data.split('/');
      const file_id = split_path[split_path.length - 1];
      fileArray.value?.push({ name: file.name, file_id, size: file.size });
      emit('update:modelValue', fileArray.value);
    });
  } else {
    // If no upload function is injected, directly use the file
    fileArray.value?.push({
      name: file.name,
      file_id: file.uid,
      size: file.size,
    });
    emit('update:modelValue', fileArray.value);
  }
};
</script>
<template>
  <ElUpload
    style="width: 100%"
    v-loading="loading"
    action="#"
    v-bind="$attrs"
    :auto-upload="false"
    :on-change="(file: any, fileList: any) => uploadFile(file, fileList)"
    v-model:file-list="model_value"
    multiple
    :show-file-list="false"
  >
    <ElButton type="primary">上传文件</ElButton>
  </ElUpload>
  <ElSpace wrap class="media-file-width upload-content mt-16 w-full">
    <template v-for="(file, index) in model_value" :key="index">
      <ElCard style="--el-card-padding: 0" shadow="never">
        <div
          class="flex-between"
          :class="[inputDisabled ? 'is-disabled' : '']"
          style="padding: 0 8px"
        >
          <div class="align-center flex" style="width: 70%">
            <img
              :src="getImgUrl(file && file?.name)"
              alt=""
              width="24"
              class="mr-4"
            />
            <span class="ellipsis-1" :title="file.name">
              {{ file.name }}
            </span>
          </div>
          <div class="align-center flex">
            <div class="ellipsis-1" :title="formatSize(file.size)">
              {{ formatSize(file.size) }}
            </div>

            <ElButton
              link
              class="ml-8"
              @click="deleteFile(file)"
              v-if="!inputDisabled"
            >
              <ElIcon><Delete /></ElIcon>
            </ElButton>
          </div>
        </div>
      </ElCard>
    </template>
  </ElSpace>
</template>
<style lang="scss" scoped>
.upload-content {
  .is-disabled {
    color: var(--el-text-color-placeholder);
    cursor: not-allowed;
    background-color: var(--el-fill-color-light);

    &:hover {
      cursor: not-allowed;
    }
  }

  &.media-file-width {
    :deep(.el-space__item) {
      width: calc(50% - 4px) !important;
    }
  }
}

@media only screen and (max-width: 768px) {
  .upload-content {
    &.media-file-width {
      :deep(.el-space__item) {
        min-width: 100% !important;
      }
    }
  }
}
</style>
