<script setup lang="ts">
import type { SegmentRules } from './SetRules.vue';

import { computed, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ArrowLeft } from '@element-plus/icons-vue';
import {
  ElButton,
  ElCard,
  ElMessage,
  ElMessageBox,
  ElResult,
  ElScrollbar,
} from 'element-plus';

import { postUploadFile } from '#/api/ai/chat';
import { createDocumentFromFile } from '#/api/ai/knowledge';
import { requestClient } from '#/api/request';

import SetRules from './SetRules.vue';
import UploadComponent from './UploadComponent.vue';

const router = useRouter();
const route = useRoute();
const {
  params: { folderId, type },
  query: { id },
} = route as any;

const knowledgeId = computed(() => id as string);

const uploadComponentRef = ref<InstanceType<typeof UploadComponent>>();
const loading = ref(false);
const active = ref(0);
const successInfo = ref<null | { count: number }>(null);

const documentsFiles = ref<any[]>([]);
const documentsType = ref('txt');
const segmentRules = ref<SegmentRules>({
  mode: 'intelligent',
  patterns: ['\n\n'],
  limit: 1000,
  withFilter: true,
  withProblemList: false,
});

function clearStore() {
  documentsFiles.value = [];
  documentsType.value = '';
}

function syncFromUploadComponent() {
  if (uploadComponentRef.value) {
    documentsFiles.value = uploadComponentRef.value.form.fileList;
    documentsType.value = uploadComponentRef.value.form.fileType;
  }
}

async function next() {
  syncFromUploadComponent();

  if (!(await uploadComponentRef.value?.validate())) {
    return;
  }

  if (documentsFiles.value.length === 0) {
    ElMessage.warning('请选择文件');
    return;
  }

  const fd = new FormData();
  documentsFiles.value.forEach((item: any) => {
    if (item?.raw) {
      fd.append('file', item.raw);
    }
  });

  let endpoint: null | string = null;
  if (documentsType.value === 'QA') {
    endpoint = `/ai/api/knowledge/${knowledgeId.value}/documents/qa`;
  } else if (documentsType.value === 'table') {
    endpoint = `/ai/api/knowledge/${knowledgeId.value}/documents/table`;
  }

  // QA / 表格:直接 multipart 上传到对应解析端点(后端直接解析,不经过 RemoteFileService)
  if (endpoint) {
    loading.value = true;
    requestClient
      .post(endpoint, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(() => {
        ElMessage.success('提交成功');
        clearStore();
        router.push({
          path: `/knowledge/${knowledgeId.value}/${folderId}/${type}/document`,
        });
      })
      .catch(() => {
        ElMessage.error('上传失败');
      })
      .finally(() => {
        loading.value = false;
      });
    return;
  }

  // TXT 模式:进入设置分段规则步骤
  active.value = 1;
}

function prev() {
  active.value = 0;
}

/**
 * TXT 模式:逐个上传文件到 SysFileService,然后通过 from-file 端点创建文档。
 * 避免走 /batch-upload 后端的 RemoteFileService Feign 调用(需要 Feign multipart config)。
 */
async function submit() {
  if (documentsFiles.value.length === 0) {
    ElMessage.warning('没有待上传的文件');
    return;
  }

  loading.value = true;
  let successCount = 0;

  try {
    for (const item of documentsFiles.value) {
      if (!item?.raw) continue;
      try {
        // 1. Upload file to SysFileService (direct REST, not Feign)
        const fileResult = await postUploadFile(
          item.raw,
          knowledgeId.value,
          'KNOWLEDGE',
        );
        // 2. Create document from the uploaded file
        await createDocumentFromFile(knowledgeId.value, {
          fileId: fileResult.id,
          fileUrl: fileResult.url,
          name: item.name || item.raw?.name || 'document',
        });
        successCount++;
      } catch (error) {
        console.error('上传文件失败:', item.name, error);
        ElMessage.error(`文件 ${item.name || '未知'} 上传失败`);
      }
    }

    if (successCount > 0) {
      ElMessage.success(`成功上传 ${successCount} 个文件`);
      clearStore();
      router.push({
        path: `/knowledge/${knowledgeId.value}/${folderId}/${type}/document`,
      });
    }
  } finally {
    loading.value = false;
  }
}

function back() {
  syncFromUploadComponent();
  if (documentsFiles.value?.length > 0) {
    ElMessageBox.confirm('当前有未保存的文件，确定要离开吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
      .then(() => {
        router.go(-1);
        clearStore();
      })
      .catch(() => {});
  } else {
    router.go(-1);
  }
}

onUnmounted(() => {
  clearStore();
});
</script>

<template>
  <div class="upload-document p-12-24">
    <div class="align-center mb-16 flex">
      <ElButton :icon="ArrowLeft" text @click="back" style="margin-left: -4px">
        返回
      </ElButton>
      <h3 style="display: inline-block; margin: 0">上传文档</h3>
    </div>
    <ElCard style="--el-card-padding: 0">
      <div class="upload-document__main flex" v-loading="loading">
        <div class="upload-document__component main-calc-height">
          <ElScrollbar>
            <template v-if="active === 0">
              <div class="upload-component p-24">
                <UploadComponent ref="uploadComponentRef" />
              </div>
            </template>
            <template v-else-if="active === 1">
              <div>
                <SetRules v-model="segmentRules" />
              </div>
            </template>
            <template v-else-if="active === 2">
              <div class="p-24">
                <ElResult
                  icon="success"
                  title="导入成功"
                  :sub-title="`成功导入 ${successInfo?.count || (documentsFiles.length > 0 ? documentsFiles.length : 0)} 个文件`"
                />
              </div>
            </template>
          </ElScrollbar>
        </div>
      </div>
    </ElCard>
    <div
      class="upload-document__footer border-t text-right"
      v-if="active !== 2"
    >
      <ElButton @click="router.go(-1)" :disabled="loading">取消</ElButton>
      <ElButton @click="prev" v-if="active === 1" :disabled="loading">
        上一步
      </ElButton>
      <ElButton
        @click="next"
        type="primary"
        v-if="active === 0"
        :disabled="loading"
      >
        {{ documentsType === 'txt' ? '下一步' : '导入' }}
      </ElButton>
      <ElButton
        @click="submit"
        type="primary"
        v-if="active === 1"
        :disabled="loading"
      >
        导入
      </ElButton>
    </div>
  </div>
</template>

<style scoped>
.upload-document {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.p-12-24 {
  padding: 12px 24px;
}

.p-24 {
  padding: 24px;
}

.flex {
  display: flex;
}

.align-center {
  align-items: center;
}

.mb-16 {
  margin-bottom: 16px;
}

.upload-document__main {
  flex: 1;
  overflow: hidden;
}

.upload-document__component {
  width: 100%;
}

.main-calc-height {
  height: calc(100vh - 200px);
}

.upload-document__footer {
  padding: 12px 24px;
  background: var(--el-bg-color);
}

.text-right {
  text-align: right;
}

.border-t {
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
