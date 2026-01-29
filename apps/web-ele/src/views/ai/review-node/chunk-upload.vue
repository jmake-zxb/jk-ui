<script setup lang="ts">
import type { UploadFile, UploadFiles } from 'element-plus';

import { computed, reactive, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Delete, InfoFilled } from '@element-plus/icons-vue';
import {
  ElButton,
  ElCard,
  ElCol,
  ElForm,
  ElFormItem,
  ElIcon,
  ElMessage,
  ElProgress,
  ElRow,
  ElText,
  ElUpload,
} from 'element-plus';
import SparkMD5 from 'spark-md5';

import {
  checkFileApi,
  mergeFileApi,
  uploadChunkApi,
} from '#/api/ai/reviewDocument';
import { getImgUrl } from '#/utils/file-util';

const emit = defineEmits(['refresh']);
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB 分片
const MAX_CONCURRENT_FILES = 3; // 同时处理的文件数（防止浏览器卡顿）
const MAX_CONCURRENT_CHUNKS = 3; // 单个文件同时上传的分片数

// --- 类型定义 ---
type UploadStatus =
  | 'fail'
  | 'hashing'
  | 'merging'
  | 'pending'
  | 'success'
  | 'uploading';

interface FileState {
  percent: number;
  status: UploadStatus;
  text: string;
  uiStatus: '' | 'exception' | 'success' | 'warning';
}
const form = ref({
  fileList: [] as UploadFiles,
});
// 存储文件上传状态的 Map
const statusMap = reactive(new Map<number, FileState>());

const isGlobalUploading = ref(false);

// 计算已完成数量
const finishedCount = computed(() => {
  let count = 0;
  statusMap.forEach((v) => {
    if (v.status === 'success') count++;
  });
  return count;
});

// --- 工具方法 ---
const filesize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
};

const getUploadState = (uid: number): FileState => {
  return (
    statusMap.get(uid) || {
      percent: 0,
      status: 'pending',
      text: '等待中',
      uiStatus: '',
    }
  );
};

const updateStatus = (uid: number, payload: Partial<FileState>) => {
  const old = getUploadState(uid);
  statusMap.set(uid, { ...old, ...payload });
};

// --- 事件处理 ---

const deleteFile = (index: number) => {
  if (index >= 0 && index < form.value.fileList.length) {
    const file = form.value.fileList[index] as UploadFile;
    statusMap.delete(file.uid);
    form.value.fileList.splice(index, 1);
  }
};

const onExceed = () => {
  ElMessage.error('每次最多上传 50 个文件');
};

// 监听文件变化，初始化状态
const handleFileChange = (file: UploadFile) => {
  if (!file.raw) return;

  // 简单校验
  const isLimit = file.size! / 1024 / 1024 < 100;
  if (!isLimit) {
    ElMessage.error(`文件 ${file.name} 超过 100MB`);
    const idx = form.value.fileList.indexOf(file);
    if (idx !== -1) form.value.fileList.splice(idx, 1);
    return;
  }

  // 初始化状态
  if (!statusMap.has(file.uid)) {
    statusMap.set(file.uid, {
      percent: 0,
      status: 'pending',
      text: '准备就绪',
      uiStatus: '',
    });
  }
};

// --- 核心上传逻辑 ---

const startUploadQueue = async () => {
  if (form.value.fileList.length === 0) return ElMessage.error('请选择文件');

  isGlobalUploading.value = true;

  // 过滤出未成功的任务
  const pendingFiles = form.value.fileList.filter((f) => {
    const s = statusMap.get(f?.uid)?.status;
    return s !== 'success';
  });

  // 文件级并发控制池
  const pool: Promise<void>[] = [];

  for (const file of pendingFiles) {
    if (!file.raw) continue;

    // 如果池满了，等待最早的一个完成
    if (pool.length >= MAX_CONCURRENT_FILES) {
      await Promise.race(pool);
    }

    const task = processSingleFile(file.raw, file.uid).finally(() => {
      // 任务结束（无论成功失败），从池中移除
      const idx = pool.indexOf(task);
      if (idx !== -1) pool.splice(idx, 1);
    });

    pool.push(task);
    ModalApi.setState({
      confirmText: `正在上传 ${finishedCount.value}/${form.value.fileList.length}`,
    });
  }

  // 等待所有任务完成
  await Promise.all(pool);

  isGlobalUploading.value = false;
  ModalApi.onCancel();
  emit('refresh');
  ElMessage.success('所有任务处理完毕');
};

/**
 * 处理单个文件的全流程：计算MD5 -> 检查 -> 切片上传 -> 合并
 */
const processSingleFile = async (file: File, uid: number) => {
  try {
    // 1. 计算 MD5
    updateStatus(uid, {
      status: 'hashing',
      text: '校验中...',
      uiStatus: 'warning',
    });
    const md5 = await computeMD5(file);

    // 2. 检查秒传
    const { fileStatus, uploadedChunks } = await checkFileApi(md5);
    const status = fileStatus; // 0, 1, 2

    // --- 状态 2: 当前库已存在 ---
    if (status === 2) {
      updateStatus(uid, {
        status: 'fail',
        text: '文件已存在',
        uiStatus: 'warning',
      });
      // 抛出异常中断流程，或者直接 return
      return;
    }

    // --- 状态 1: 全局已存在 (极速秒传) ---
    if (status === 1) {
      updateStatus(uid, {
        percent: 99,
        status: 'merging',
        text: '极速秒传中...',
      });
      // 跳过上传分片，直接调用 merge
      await mergeRequest(md5, file.name, uid);
      return;
    }

    // 3. 准备分片
    const chunks = createChunks(file, CHUNK_SIZE);
    const totalChunks = chunks.length;

    // 过滤掉服务器已有的分片
    const chunksToUpload = chunks
      .map((chunk, index) => ({ chunk, index }))
      .filter((item) => !uploadedChunks.includes(item.index));

    // 如果所有分片都在（极少情况，可能合并失败过），直接去合并
    if (chunksToUpload.length === 0) {
      await mergeRequest(md5, file.name, uid);
      return;
    }

    // 4. 分片上传 (并发控制)
    updateStatus(uid, { status: 'uploading', text: '上传中...', uiStatus: '' });

    let completedCount = totalChunks - chunksToUpload.length;
    const chunkPool: Promise<void>[] = [];

    for (const item of chunksToUpload) {
      if (chunkPool.length >= MAX_CONCURRENT_CHUNKS) {
        await Promise.race(chunkPool);
      }

      const formData = new FormData();
      formData.append('file', item.chunk);
      formData.append('md5', md5);
      formData.append('chunkIndex', item.index.toString());

      const uploadTask = uploadChunkApi(formData)
        .then(() => {
          completedCount++;
          // 预留 5% 给合并阶段
          const percent = Math.floor((completedCount / totalChunks) * 95);
          updateStatus(uid, { percent, text: `上传中 ${percent}%` });
        })
        .finally(() => {
          const idx = chunkPool.indexOf(uploadTask);
          if (idx !== -1) chunkPool.splice(idx, 1);
        });

      chunkPool.push(uploadTask);
    }

    await Promise.all(chunkPool);

    // 5. 合并文件
    await mergeRequest(md5, file.name, uid);
  } catch (error) {
    console.error(error);
    updateStatus(uid, {
      status: 'fail',
      text: '上传失败',
      uiStatus: 'exception',
    });
  }
};

// 独立的合并请求逻辑
const mergeRequest = async (md5: string, fileName: string, uid: number) => {
  updateStatus(uid, { status: 'merging', text: '处理中...', percent: 99 });
  await mergeFileApi({
    md5,
    fileName,
  });
  updateStatus(uid, {
    percent: 100,
    status: 'success',
    text: '完成',
    uiStatus: 'success',
  });
};

// --- 辅助函数：MD5 计算 (Web Worker 模式模拟) ---
const computeMD5 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const blobSlice = File.prototype.slice;
    const chunkSize = 20 * 1024 * 1024; // 20MB 一次读取，稍微大点减少循环次数
    const chunks = Math.ceil(file.size / chunkSize);
    let currentChunk = 0;
    const spark = new SparkMD5.ArrayBuffer();
    const fileReader = new FileReader();

    fileReader.addEventListener('load', (e) => {
      if (!e.target?.result) return;
      spark.append(e.target.result as ArrayBuffer);
      currentChunk++;

      if (currentChunk < chunks) {
        loadNext();
      } else {
        resolve(spark.end());
      }
    });

    // eslint-disable-next-line unicorn/prefer-add-event-listener
    fileReader.onerror = function () {
      reject(new Error('MD5 calculation failed'));
    };

    function loadNext() {
      const start = currentChunk * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      // 使用 requestIdleCallback 或 setTimeout 避免卡死 UI
      setTimeout(() => {
        // eslint-disable-next-line unicorn/prefer-blob-reading-methods
        fileReader.readAsArrayBuffer(blobSlice.call(file, start, end));
      }, 0);
    }

    loadNext();
  });
};

// 辅助函数：切片
const createChunks = (file: File, size: number) => {
  const chunks: Blob[] = [];
  let cur = 0;
  while (cur < file.size) {
    chunks.push(file.slice(cur, cur + size));
    cur += size;
  }
  return chunks;
};

// Modal定义
const [Modal, ModalApi] = useVbenModal({
  draggable: true,
  closeOnClickModal: false,
  closeOnPressEscape: false,
  confirmDisabled: form.value.fileList.length === 0,
  loading: isGlobalUploading.value,
  confirmText: '开始上传',
  onCancel() {
    // 清理上一次
    form.value.fileList = [];
    statusMap.clear();
    ModalApi.close();
  },
  onConfirm() {
    startUploadQueue();
  },
  async onOpenChange(isOpen) {
    if (isOpen) {
      ModalApi.setState({
        title: '上传文档',
      });
    }
  },
});

watch(
  () => form.value.fileList.length,
  (newLength, _oldLength) => {
    ModalApi.setState({
      confirmDisabled: newLength === 0,
    });
  },
);

watch(
  () => isGlobalUploading.value,
  (newValue) => {
    if (!newValue) {
      ModalApi.setState({
        confirmText: '开始上传',
      });
    }
  },
);
</script>
<template>
  <Modal>
    <div class="layout-page">
      <ElForm :model="form" class="mb-8">
        <ElFormItem>
          <div class="update-info p-8-12 mb-8 flex w-full">
            <div class="mt-[4px]">
              <ElIcon color="#409efc">
                <InfoFilled style="font-size: 16px" />
              </ElIcon>
            </div>
            <div class="lighter ml-[10px]">
              <p>1、文件上传前，建议规范文件的分段标识</p>
              <p>2、支持断点续传、秒传；单次建议不超过 50 个文件</p>
            </div>
          </div>

          <ElUpload
            class="w-full"
            drag
            multiple
            action="#"
            :auto-upload="false"
            v-model:file-list="form.fileList"
            :on-change="handleFileChange"
            :show-file-list="false"
            accept=".txt, .md, .docx, .pdf, .html, .xlsx, .xls, .csv"
            :limit="50"
            :on-exceed="onExceed"
          >
            <div class="el-upload__text">
              <img class="inline-block" src="/static/svg/upload-icon.svg" />
              <p>拖拽文件至此上传或 <em class="hover"> 点击选择 </em></p>
              <div class="upload__decoration">
                <p>支持格式：TXT、Markdown、PDF、DOCX、HTML、Excel、CSV</p>
              </div>
            </div>
          </ElUpload>
        </ElFormItem>
      </ElForm>

      <!-- 进度展示列表 -->
      <ElRow :gutter="8" v-if="form.fileList?.length">
        <template v-for="(item, index) in form.fileList" :key="item.uid">
          <ElCol :span="12" class="mb-8">
            <ElCard shadow="never" class="file-List-card">
              <div class="flex flex-col">
                <div class="mb-2 flex items-center justify-between">
                  <div class="flex items-center overflow-hidden">
                    <!-- 简单的图标占位，你可以用自己的 getImgUrl 方法 -->
                    <img class="mr-2" :src="getImgUrl(item.name)" />
                    <div class="truncate">
                      <p
                        class="truncate text-sm font-medium"
                        :title="item.name"
                      >
                        {{ item.name }}
                      </p>
                      <ElText type="info" size="small">
                        {{ filesize(item.size || 0) }}
                      </ElText>
                    </div>
                  </div>
                  <!-- 删除按钮：仅在非上传状态下可用 -->
                  <ElButton
                    v-if="!isGlobalUploading"
                    text
                    circle
                    type="danger"
                    @click="deleteFile(index)"
                  >
                    <ElIcon><Delete /></ElIcon>
                  </ElButton>
                </div>

                <!-- 进度条区域 -->
                <div class="flex items-center text-xs">
                  <div class="mr-4 flex-1">
                    <ElProgress
                      :percentage="getUploadState(item.uid).percent"
                      :status="getUploadState(item.uid).uiStatus"
                      :stroke-width="6"
                    />
                  </div>
                  <div class="w-16 text-right text-gray-500">
                    {{ getUploadState(item.uid).text }}
                  </div>
                </div>
              </div>
            </ElCard>
          </ElCol>
        </template>
      </ElRow>
    </div>
  </Modal>
</template>
<style scoped lang="scss">
.upload__decoration {
  font-size: 12px;
  line-height: 20px;
  color: var(--el-text-color-secondary);
}
.el-upload__text {
  .hover {
    color: var(--el-color-primary);
    cursor: pointer;
    &:hover {
      color: var(--el-color-primary-light-3);
    }
  }
}
.file-List-card {
  :deep(.el-card__body) {
    padding: 10px;
  }
  p {
    margin: 0;
  }
}
.lighter {
  font-size: 12px;
  color: #666;
  line-height: 1.5;
}
</style>
