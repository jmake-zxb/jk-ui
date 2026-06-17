<script setup lang="ts">
import type { UploadFiles } from 'element-plus';

import type { FormField } from '../../type';

import { computed, inject, nextTick, ref, useAttrs } from 'vue';

import { Delete, UploadFilled } from '@element-plus/icons-vue';
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

import { filesize, fileType, getImgUrl } from '#/utils/file-util';

const props = withDefaults(
  defineProps<{ formField: FormField; modelValue?: any }>(),
  {
    modelValue: () => [],
  },
);
const emit = defineEmits(['update:modelValue']);
const upload = inject('upload', undefined) as any;
const attrs = useAttrs() as any;
const onExceed = () => {
  ElMessage.error(`最多上传${file_count_limit.value}个文件`);
};
const fileArray = ref<any>([]);
const loading = ref<boolean>(false);

// 上传on-change事件
const fileHandleChange = (file: any, fileList: UploadFiles) => {
  // 1、判断文件大小是否合法
  const isLimit = file?.size / 1024 / 1024 < file_size_limit.value;
  if (!isLimit) {
    ElMessage.error(`文件大小不能超过${file_size_limit.value}MB`);
    fileList.splice(-1, 1);
    return false;
  }
  if (
    fileType(file.name) &&
    !file_type_list.value.includes(fileType(file.name)!.toLocaleUpperCase())
  ) {
    if (file?.name !== '.DS_Store') {
      ElMessage.error('不支持的文件格式');
    }
    fileList.splice(-1, 1);
    return false;
  }

  if (file?.size === 0) {
    ElMessage.error('文件大小不能为0');
    fileList.splice(-1, 1);
    return false;
  }
  if (upload) {
    upload(file.raw, loading).then((ok: any) => {
      const split_path = ok.data.split('/');
      const file_id = split_path[split_path.length - 1];
      fileArray.value?.push({ name: file.name, file_id, size: file.size });
      emit('update:modelValue', fileArray.value);
    });
  } else {
    fileArray.value?.push({
      name: file.name,
      file_id: file.uid,
      size: file.size,
    });
    emit('update:modelValue', fileArray.value);
  }
};
function deleteFile(index: number | string) {
  const next = [...(props.modelValue ?? [])];
  next.splice(Number(index), 1);
  emit('update:modelValue', next);
}

const handlePreview = (bool: boolean) => {
  nextTick(() => {
    const inputDom = document.querySelector(
      '.el-upload__input',
    ) as HTMLInputElement | null;
    if (inputDom) {
      inputDom.webkitdirectory = bool;
    }
  });
};
const accept = computed(() => {
  return ((attrs.file_type_list || []) as any[])
    .map((item: any) => `.${item.toLowerCase()}`)
    .join(',');
});
const file_type_list = computed(() => {
  return (
    (attrs.file_type_list || []).map((item: any) => item.toUpperCase()) || []
  );
});
const formats = computed(() => {
  return file_type_list.value.join('、');
});
const file_size_limit = computed(() => {
  return attrs.file_size_limit || 50;
});
const file_count_limit = computed(() => {
  return attrs.file_count_limit || 100;
});
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
      :limit="file_count_limit"
      :on-exceed="onExceed"
      :on-change="fileHandleChange"
      @click.prevent="handlePreview(false)"
    >
      <ElIcon :size="60" style="color: var(--el-color-primary)">
        <UploadFilled />
      </ElIcon>
      <div class="el-upload__text">
        <p>
          将文件拖到此处，或
          <em class="hover" @click.prevent="handlePreview(false)">点击上传</em>
          <em class="hover ml-4" @click.prevent="handlePreview(true)"
            >选择文件夹</em
          >
        </p>
        <div class="upload__decoration">
          <p>
            最多上传 {{ file_count_limit }} 个文件，单文件大小不超过
            {{ file_size_limit }} MB
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
                <img :src="getImgUrl(item && item?.name)" alt="" width="40" />
                <div class="ml-8">
                  <p class="ellipsis-1" :title="item && item?.name">
                    {{ item && item?.name }}
                  </p>
                  <ElText type="info" size="small">
                    {{ filesize(item?.size ?? 0) || '0K' }}
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
