<script setup lang="ts">
import {
  computed,
  markRaw,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue';

import { FullScreen, Loading } from '@element-plus/icons-vue';
import { ElButton, ElIcon } from 'element-plus';
import * as pdfjsLib from 'pdfjs-dist';

const props = defineProps<{
  detail?: Record<string, any>;
}>();
// 设置 worker 路径
const pdfjsVersion = '4.10.38';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

type PdfDocumentProxy = any;
type RenderTask = any;
type PdfLoadingTask = any;

const viewerRef = ref<HTMLDivElement | null>(null);
const stageRef = ref<HTMLDivElement | null>(null);
const pagesRef = ref<HTMLDivElement | null>(null);

const loading = ref(false);
const error = ref('');
const isFullscreen = ref(false);

const pdfDoc = shallowRef<null | PdfDocumentProxy>(null);
const loadingTaskRef = shallowRef<null | PdfLoadingTask>(null);
const renderTasks = shallowRef<RenderTask[]>([]);
const requestToken = ref(0);

const meta = computed<Record<string, any>>(() => {
  const raw = props.detail?.meta ?? props.detail?.metadata;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw && typeof raw === 'object' ? raw : {};
});

const isPdf = computed(() => !!meta.value.source_file_id);

const pdfSrc = computed(() => {
  const fileId = meta.value.source_file_id;
  return fileId
    ? `/admin/sys-file/details?id=${encodeURIComponent(`${fileId}`)}`
    : '';
});

const overlayText = computed(() => {
  if (error.value) return error.value;
  if (!isPdf.value) return '暂无 PDF 预览';
  return '';
});

function clearPages() {
  if (pagesRef.value) {
    pagesRef.value.innerHTML = '';
  }
}

async function cancelRenderTasks() {
  if (renderTasks.value.length === 0) return;

  for (const task of renderTasks.value) {
    try {
      task.cancel();
    } catch {
      //
    }
  }

  renderTasks.value = [];
}

async function destroyLoadingTask() {
  if (!loadingTaskRef.value) return;

  try {
    await loadingTaskRef.value.destroy();
  } catch {
    //
  } finally {
    loadingTaskRef.value = null;
  }
}

async function destroyPdfDoc() {
  if (!pdfDoc.value) return;

  try {
    await pdfDoc.value.destroy();
  } catch {
    //
  } finally {
    pdfDoc.value = null;
  }
}

function getAvailableWidth() {
  if (!stageRef.value) return 0;
  const style = getComputedStyle(stageRef.value);
  const paddingLeft = Number.parseFloat(style.paddingLeft || '0');
  const paddingRight = Number.parseFloat(style.paddingRight || '0');
  return stageRef.value.clientWidth - paddingLeft - paddingRight;
}

async function renderAllPages() {
  if (!pdfDoc.value || !pagesRef.value) return;

  const currentToken = requestToken.value;
  const container = pagesRef.value;
  clearPages();
  renderTasks.value = [];

  const availableWidth = getAvailableWidth();

  for (let pageNum = 1; pageNum <= pdfDoc.value.numPages; pageNum++) {
    if (currentToken !== requestToken.value) return;

    const page = await pdfDoc.value.getPage(pageNum);
    if (currentToken !== requestToken.value) return;

    const baseViewport = page.getViewport({ scale: 1 });
    const fitScale =
      availableWidth > 0 && baseViewport.width > 0
        ? Math.min(3, Math.max(0.5, availableWidth / baseViewport.width))
        : 1;

    const viewport = page.getViewport({ scale: fitScale });

    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-canvas';

    const context = canvas.getContext('2d');
    if (!context) continue;

    const outputScale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

    container.append(canvas);

    const task = markRaw(
      page.render({
        canvasContext: context,
        viewport,
      }),
    );

    renderTasks.value = [...renderTasks.value, task];

    try {
      await task.promise;
    } catch (error_: any) {
      if (error_?.name !== 'RenderingCancelledException') {
        throw error_;
      }
    } finally {
      renderTasks.value = renderTasks.value.filter((item) => item !== task);
    }
  }
}

async function loadPdf(url: string) {
  const currentToken = ++requestToken.value;
  loading.value = true;
  error.value = '';

  await cancelRenderTasks();
  await destroyLoadingTask();
  await destroyPdfDoc();
  clearPages();

  try {
    const loadingTask = pdfjsLib.getDocument({ url });

    loadingTaskRef.value = markRaw(loadingTask);
    const doc = await loadingTask.promise;

    if (currentToken !== requestToken.value) {
      await doc.destroy();
      return;
    }

    loadingTaskRef.value = null;
    pdfDoc.value = markRaw(doc);

    await nextTick();
    await renderAllPages();
  } catch (error_: any) {
    console.error(error_);
    error.value = error_?.message || 'PDF 加载失败';
    clearPages();
  } finally {
    if (currentToken === requestToken.value) {
      loading.value = false;
    }
  }
}

async function handleResize() {
  if (!pdfDoc.value || loading.value) return;

  const currentToken = ++requestToken.value;
  loading.value = true;
  error.value = '';

  try {
    await cancelRenderTasks();
    if (currentToken !== requestToken.value) return;
    clearPages();
    await nextTick();
    await renderAllPages();
  } catch (error_: any) {
    console.error(error_);
    error.value = error_?.message || 'PDF 重绘失败';
  } finally {
    if (currentToken === requestToken.value) {
      loading.value = false;
    }
  }
}

async function toggleFullscreen() {
  try {
    await (document.fullscreenElement
      ? document.exitFullscreen()
      : viewerRef.value?.requestFullscreen());
  } catch (error_) {
    console.error('toggle fullscreen failed:', error_);
  }
}

function syncFullscreenState() {
  isFullscreen.value = document.fullscreenElement === viewerRef.value;
}

async function onFullscreenChange() {
  syncFullscreenState();
  await nextTick();
  await handleResize();
}

watch(
  pdfSrc,
  async (url) => {
    await nextTick();

    if (!isPdf.value || !url) {
      error.value = '';
      await cancelRenderTasks();
      await destroyLoadingTask();
      await destroyPdfDoc();
      clearPages();
      return;
    }

    await loadPdf(url);
  },
  { immediate: true },
);

let resizeTimer: null | number = null;

function onWindowResize() {
  if (resizeTimer) {
    window.clearTimeout(resizeTimer);
  }

  resizeTimer = window.setTimeout(() => {
    handleResize();
  }, 200);
}

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange);
  window.addEventListener('resize', onWindowResize);
});

onBeforeUnmount(async () => {
  if (resizeTimer) {
    window.clearTimeout(resizeTimer);
    resizeTimer = null;
  }

  document.removeEventListener('fullscreenchange', onFullscreenChange);
  window.removeEventListener('resize', onWindowResize);
  requestToken.value++;

  await cancelRenderTasks();
  await destroyLoadingTask();
  await destroyPdfDoc();
  clearPages();
});
</script>

<template>
  <div ref="viewerRef" class="pdf-viewer">
    <div ref="stageRef" class="pdf-stage">
      <div class="pdf-actions">
        <ElButton size="small" type="primary" plain @click="toggleFullscreen">
          <ElIcon><FullScreen /></ElIcon>
          <span>{{ isFullscreen ? '退出全屏' : '全屏' }}</span>
        </ElButton>
      </div>

      <div
        ref="pagesRef"
        class="pdf-pages"
        :class="{ 'is-hidden': !!overlayText }"
      ></div>

      <div v-if="loading" class="pdf-overlay">
        <ElIcon class="is-loading"><Loading /></ElIcon>
        <span>PDF 加载中...</span>
      </div>

      <div
        v-else-if="overlayText"
        class="pdf-overlay"
        :class="{ 'pdf-overlay--error': !!error }"
      >
        <span>{{ overlayText }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pdf-viewer {
  width: 100%;
  height: calc(100vh - 57px);
  background: #fff;
}

.pdf-viewer:fullscreen {
  width: 100vw;
  height: 100vh;
  background: #fff;
}

.pdf-stage {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
  background: #fff;
}

.pdf-actions {
  position: sticky;
  top: 12px;
  right: 12px;
  z-index: 3;
  display: flex;
  justify-content: flex-end;
  padding: 12px 12px 0;
  pointer-events: none;
}

.pdf-actions :deep(.el-button) {
  pointer-events: auto;
}

.pdf-pages {
  width: 100%;
  min-height: 100%;
}

.pdf-pages.is-hidden {
  visibility: hidden;
}

:deep(.pdf-canvas) {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  margin: 0 0 12px;
  background: #fff;
  border-radius: 0;
  box-shadow: none;
}

:deep(.pdf-canvas:last-child) {
  margin-bottom: 0;
}

.pdf-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--el-text-color-regular);
  background: #fff;
}

.pdf-overlay--error {
  color: var(--el-color-danger);
}
</style>
