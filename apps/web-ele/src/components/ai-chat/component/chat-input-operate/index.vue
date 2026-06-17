<script setup lang="ts">
import type { ChatRecord } from '../../types/application';

import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  CircleCloseFilled,
  Microphone,
  Paperclip,
} from '@element-plus/icons-vue';
import {
  ElButton,
  ElCard,
  ElCol,
  ElDivider,
  ElForm,
  ElFormItem,
  ElIcon,
  ElImage,
  ElInput,
  ElMessage,
  ElOption,
  ElRow,
  ElScrollbar,
  ElSelect,
  ElSpace,
  ElText,
  ElTooltip,
  ElUpload,
} from 'element-plus';
import Recorder from 'recorder-core';

import { getImgUrl } from '#/utils/file-util';

import { aiChatBus } from '../../utils/bus';
import TouchChat from './TouchChat.vue';

import 'recorder-core/src/engine/mp3';
import 'recorder-core/src/engine/mp3-engine';

const props = withDefaults(
  defineProps<{
    appId?: string;
    applicationDetails?: Record<string, any>;
    chatId?: string;
    isMobile?: boolean;
    loading?: boolean;
    openChatId?: () => Promise<string>;
    sendMessage?: (
      question: string,
      otherParamsData?: unknown,
      chat?: ChatRecord,
    ) => void;
    type?: 'ai-chat' | 'debug-ai-chat' | 'log' | 'share';
    validate?: () => Promise<any>;
  }>(),
  {
    appId: '',
    applicationDetails: () => ({}),
    chatId: '',
    isMobile: false,
    loading: false,
    openChatId: () => Promise.resolve(''),
    sendMessage: () => {},
    type: 'ai-chat',
    validate: () => Promise.resolve(),
  },
);

const emit = defineEmits([
  'backBottom',
  'update:chatId',
  'update:loading',
  'update:showUserInput',
]);

Recorder.CLog = function () {};

const router = useRouter();
const route = useRoute();
const {
  query: { mode, question },
} = route as any;

const quickInputRef = ref();
const chartOpenId = ref<string>();
const chatId_context = computed({
  get: () => {
    if (chartOpenId.value) {
      return chartOpenId.value;
    }
    return props.chatId;
  },
  set: (v) => {
    chartOpenId.value = v;
    emit('update:chatId', v);
  },
});
const showURLSetting = ref(false);
const urlForm = reactive({
  source_url: '',
  type: '',
});

const uploadLoading = computed(() => {
  return Object.values(filePromisionDict.value).length > 0;
});

const inputPlaceholder = computed(() => {
  if (recorderStatus.value === 'START') return '正在说话...';
  if (recorderStatus.value === 'TRANSCRIBING') return '语音识别中...';
  return '输入问题，Shift+Enter换行';
});

const upload = ref();

// Inject URL fetch function and upload function from parent (ai-chat/index.vue)
const getUrlFn = inject<(url: string) => Promise<Record<string, any>>>(
  'getUrl',
  () => Promise.reject(new Error('getUrl not provided')),
);
const uploadFn = inject<(file: File) => Promise<{ data: string }>>(
  'upload',
  undefined as unknown as (file: File) => Promise<{ data: string }>,
);
const sttFn = inject<(audioBlob: Blob) => Promise<Record<string, any>>>(
  'stt',
  () => Promise.reject(new Error('stt not provided')),
);

const imageExtensions = ['JPG', 'JPEG', 'PNG', 'GIF', 'BMP'];
const documentExtensions = [
  'PDF',
  'DOCX',
  'TXT',
  'XLS',
  'XLSX',
  'MD',
  'HTML',
  'CSV',
];
const videoExtensions = ['MP4', 'AVI', 'MKV', 'MOV', 'FLV', 'WMV'];
const audioExtensions = ['MP3', 'WAV', 'OGG', 'AAC', 'M4A'];
const otherExtensions = ref(['PPT', 'DOC']);

const getAcceptList = () => {
  const { image, document, audio, video, other } =
    props.applicationDetails.file_upload_setting || {};
  let accepts: any = [];
  if (image) {
    accepts = [...imageExtensions];
  }
  if (document) {
    accepts = [...accepts, ...documentExtensions];
  }
  if (audio) {
    accepts = [...accepts, ...audioExtensions];
  }
  if (video) {
    accepts = [...accepts, ...videoExtensions];
  }
  if (other) {
    otherExtensions.value =
      props.applicationDetails.file_upload_setting.otherExtensions ||
      otherExtensions.value;
    accepts = [...accepts, ...otherExtensions.value];
  }

  if (accepts.length === 0) {
    // 无配置文件类型时返回一个不存在的扩展名，阻止上传
    return '.upload_not_allowed';
  }
  return accepts.map((ext: any) => `.${ext}`).join(',');
};

const checkMaxFilesLimit = () => {
  const setting = props.applicationDetails.file_upload_setting;
  if (!setting) return false;
  return (
    setting.maxFiles <=
    uploadImageList.value.length +
      uploadDocumentList.value.length +
      uploadAudioList.value.length +
      uploadVideoList.value.length +
      uploadOtherList.value.length
  );
};
const filePromisionDict = ref<any>({});
const uploadFile = async (file: any, fileList: any) => {
  const { maxFiles, fileLimit } =
    props.applicationDetails.file_upload_setting || {};
  const file_limit_once =
    uploadImageList.value.length +
    uploadDocumentList.value.length +
    uploadAudioList.value.length +
    uploadVideoList.value.length +
    uploadOtherList.value.length;
  if (file_limit_once >= maxFiles) {
    ElMessage.warning(`最多上传 ${maxFiles} 个文件`);
    fileList.splice(0, fileList.length, ...fileList.slice(0, maxFiles));
    return;
  }
  if (fileList.some((f: any) => f.size === 0)) {
    ElMessage.warning('不能上传空文件');
    fileList.splice(
      0,
      fileList.length,
      ...fileList.filter((f: any) => f.size > 0),
    );
    return;
  }
  if (fileList.some((f: any) => f.size > fileLimit * 1024 * 1024)) {
    ElMessage.warning(`文件大小不能超过 ${fileLimit}MB`);
    fileList.splice(
      0,
      fileList.length,
      ...fileList.filter((f: any) => f.size <= fileLimit * 1024 * 1024),
    );
    return;
  }
  filePromisionDict.value[file.uid] = false;
  const inner = reactive(file);
  fileAllList.value.push(inner);
  if (!chatId_context.value) {
    chatId_context.value = await props.openChatId();
  }
  // Upload file to server (same pattern as MaxKB: use injected upload function)
  if (uploadFn) {
    uploadFn(file.raw)
      .then((ok: any) => {
        inner.url = ok.data ?? ok;
        const split_path = (inner.url || '').split('/');
        inner.file_id = split_path[split_path.length - 1];
        delete filePromisionDict.value[file.uid];
      })
      .catch(() => {
        delete filePromisionDict.value[file.uid];
      });
  } else {
    // Fallback: local blob URL when upload is not provided
    inner.url = URL.createObjectURL(file.raw);
    const split_path = inner.url.split('/');
    inner.file_id = split_path[split_path.length - 1];
    delete filePromisionDict.value[file.uid];
  }
  showURLSetting.value = false;
};

const handlePaste = (event: ClipboardEvent) => {
  if (!props.applicationDetails.file_upload_enable) return;
  const clipboardData = event.clipboardData;
  if (!clipboardData) return;
  const files = clipboardData.files;
  if (files.length === 0) return;
  [...files].forEach((rawFile: File) => {
    const elFile = {
      uid: Date.now(),
      name: rawFile.name,
      raw: rawFile,
      size: rawFile.size,
      status: 'ready',
      percentage: 0,
    };
    uploadFile(elFile, [elFile]);
  });
  event.preventDefault();
};

const handleDrop = (event: DragEvent) => {
  if (!props.applicationDetails.file_upload_enable) return;
  event.preventDefault();
  const files = event.dataTransfer?.files;
  if (!files) return;
  [...files].forEach((rawFile) => {
    const elFile = {
      uid: Date.now(),
      name: rawFile.name,
      raw: rawFile,
      size: rawFile.size,
      status: 'ready',
      percentage: 0,
    };
    uploadFile(elFile, [elFile]);
  });
};

// --- STT Recording (recorder-core) ---
const intervalId = ref<any | null>(null);
const recorderTime = ref(0);
const recorderStatus = ref<'START' | 'STOP' | 'TRANSCRIBING'>('STOP');
const isMicrophone = ref(false);

class RecorderManage {
  recorder: any = undefined;
  uploadRecording: (blob: Blob, duration: number) => void;

  constructor(uploadRecording: (blob: Blob, duration: number) => void) {
    this.uploadRecording = uploadRecording;
  }

  close() {
    this.recorder?.close();
    this.recorder = undefined;
  }

  open(callback?: () => void) {
    const recorder = new Recorder({
      type: 'mp3',
      bitRate: 128,
      sampleRate: 16_000,
    });
    if (this.recorder) {
      callback?.();
    } else {
      recorder.open(
        () => {
          this.recorder = recorder;
          callback?.();
        },
        (_err: string) => {
          ElMessage.warning('麦克风权限获取失败');
          recorderStatus.value = 'STOP';
        },
      );
    }
  }

  start() {
    if (this.recorder) {
      this.recorder.start();
      recorderStatus.value = 'START';
      handleTimeChange();
    } else {
      this.open(() => {
        this.recorder?.start();
        recorderStatus.value = 'START';
        handleTimeChange();
      });
    }
  }

  stop() {
    if (!this.recorder) {
      recorderStatus.value = 'STOP';
      stopTimer();
      return;
    }
    this.recorder.stop(
      (blob: Blob, duration: number) => {
        // On mobile, keep recorder alive for repeated use
        const mobileMode = /Mobi|Android|iPhone|iPad/i.test(
          navigator.userAgent,
        );
        if (!mobileMode) this.close();
        this.uploadRecording(blob, duration);
      },
      (_err: string) => {
        ElMessage.warning('录音停止失败');
        recorderStatus.value = 'STOP';
        stopTimer();
      },
    );
  }
}

const uploadRecording = async (audioBlob: Blob, _duration: number) => {
  // 非自动发送切换输入框
  const isAutoSend =
    props.applicationDetails.stt_autosend ||
    props.applicationDetails.sttAutosend;
  if (!isAutoSend) {
    switchMicrophone(false);
  }
  recorderStatus.value = 'TRANSCRIBING';
  if (isAutoSend) {
    aiChatBus.emit('on:transcribing', true);
  }

  try {
    const res = await sttFn(audioBlob);
    const text =
      typeof res?.data === 'string' ? res.data : (res?.data?.data ?? '');
    if (text) {
      inputValue.value = text;
    }
    // 自动发送
    if (isAutoSend) {
      nextTick(() => autoSendMessage());
    } else {
      switchMicrophone(false);
    }
  } catch {
    ElMessage.warning('语音识别失败');
  } finally {
    recorderStatus.value = 'STOP';
    aiChatBus.emit('on:transcribing', false);
    stopTimer();
  }
};

const recorderManage = new RecorderManage(uploadRecording);

const startRecording = () => {
  recorderManage.start();
};

const stopRecording = () => {
  recorderManage.stop();
};

const handleTimeChange = () => {
  recorderTime.value = 0;
  if (intervalId.value) return;
  intervalId.value = setInterval(() => {
    if (recorderStatus.value === 'STOP') {
      clearInterval(intervalId.value!);
      intervalId.value = null;
      return;
    }
    recorderTime.value++;
    // 桌面端 60 秒自动停止，移动端不限制
    if (recorderTime.value === 60 && mode !== 'mobile') {
      stopRecording();
      clearInterval(intervalId.value!);
      intervalId.value = null;
    }
  }, 1000);
};

const stopTimer = () => {
  if (intervalId.value !== null) {
    clearInterval(intervalId.value);
    recorderTime.value = 0;
    intervalId.value = null;
  }
};

const switchMicrophone = (status: boolean) => {
  if (status) {
    recorderManage.open(() => {
      isMicrophone.value = true;
    });
  } else {
    recorderManage.close();
    isMicrophone.value = false;
  }
};

const inputValue = ref<string>('');
const fileAllList = ref<Array<any>>([]);

const fileFilter = (fileList: Array<any>, extensionList: Array<string>) => {
  return fileList.filter((f) => {
    return extensionList.includes(f.name.split('.').pop().toUpperCase());
  });
};
const uploadImageList = computed(() =>
  fileFilter(fileAllList.value, imageExtensions),
);
const uploadDocumentList = computed(() =>
  fileFilter(fileAllList.value, documentExtensions),
);
const uploadVideoList = computed(() =>
  fileFilter(fileAllList.value, videoExtensions),
);
const uploadAudioList = computed(() =>
  fileFilter(fileAllList.value, audioExtensions),
);
const uploadOtherList = computed(() =>
  fileFilter(
    fileAllList.value,
    otherExtensions.value.map((item) => item.toUpperCase()),
  ),
);

const showDelete = ref('');

const isDisabledChat = computed(
  () =>
    !(
      (inputValue.value.trim() ||
        uploadImageList.value.length > 0 ||
        uploadDocumentList.value.length > 0 ||
        uploadVideoList.value.length > 0 ||
        uploadAudioList.value.length > 0 ||
        uploadOtherList.value.length > 0) &&
      (props.appId || props.applicationDetails?.name)
    ),
);

const TouchEnd = (bool?: boolean) => {
  if (bool) {
    // Touch ended normally — stop recording and send for transcription
    stopRecording();
  } else {
    // Swipe-up cancel — stop timer and reset status without sending
    stopTimer();
    recorderStatus.value = 'STOP';
  }
};

const getQuestion = () => {
  if (!inputValue.value.trim()) {
    const fileLength = [
      uploadImageList.value.length > 0,
      uploadDocumentList.value.length > 0,
      uploadAudioList.value.length > 0,
      uploadVideoList.value.length > 0,
      uploadOtherList.value.length > 0,
    ];
    if (fileLength.filter(Boolean).length > 1) {
      return '发送文件';
    } else if (fileLength[0]) {
      return '发送图片';
    } else if (fileLength[1]) {
      return '发送文档';
    } else if (fileLength[2]) {
      return '发送音频';
    } else if (fileLength[3]) {
      return '发送视频';
    } else if (fileLength[4]) {
      return '发送文件';
    }
  }
  return inputValue.value.trim();
};

function autoSendMessage() {
  props
    .validate()
    .then(() => {
      props.sendMessage(getQuestion(), {
        audio_list: uploadAudioList.value,
        document_list: uploadDocumentList.value,
        image_list: uploadImageList.value,
        other_list: uploadOtherList.value,
        video_list: uploadVideoList.value,
      });
      inputValue.value = '';
      fileAllList.value = [];
      if (upload.value) {
        upload.value.clearFiles();
      }
      if (quickInputRef.value) {
        quickInputRef.value.textarea.style.height = '45px';
      }
    })
    .catch(() => {});
}

function sendChatHandle(event?: any) {
  const isMobile =
    /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
  if (isMobile && event?.key === 'Enter') {
    return;
  }
  if (
    !event?.ctrlKey &&
    !event?.shiftKey &&
    !event?.altKey &&
    !event?.metaKey
  ) {
    event?.preventDefault();
    if (
      !isDisabledChat.value &&
      !props.loading &&
      !event?.isComposing &&
      !uploadLoading.value &&
      (inputValue.value.trim() || fileAllList.value.length > 0)
    ) {
      autoSendMessage();
    }
  } else {
    insertNewlineAtCursor(event);
  }
}

const insertNewlineAtCursor = (event?: any) => {
  const textarea = quickInputRef.value.$el.querySelector(
    '.el-textarea__inner',
  ) as HTMLTextAreaElement;
  const startPos = textarea.selectionStart;
  const endPos = textarea.selectionEnd;
  event.preventDefault();
  inputValue.value = `${inputValue.value.slice(0, startPos)}\n${inputValue.value.slice(endPos)}`;
  nextTick(() => {
    textarea.setSelectionRange(startPos + 1, startPos + 1);
  });
};

function deleteFile(item: any) {
  fileAllList.value = fileAllList.value.filter((i) => i !== item);
}

function mouseenter(row: any) {
  showDelete.value = row.url;
}

function mouseleave() {
  showDelete.value = '';
}

function stopChat() {
  aiChatBus.emit('chat:stop');
}

const fileUploadOptions = computed(() => [
  {
    label: '图片',
    value: 'image',
    visible: props.applicationDetails.file_upload_setting?.image,
  },
  {
    label: '文档',
    value: 'document',
    visible: props.applicationDetails.file_upload_setting?.document,
  },
  {
    label: '视频',
    value: 'video',
    visible: props.applicationDetails.file_upload_setting?.video,
  },
  {
    label: '音频',
    value: 'audio',
    visible: props.applicationDetails.file_upload_setting?.audio,
  },
  {
    label: '其他',
    value: 'other',
    visible: props.applicationDetails.file_upload_setting?.other,
  },
]);

function openUrlSetting() {
  showURLSetting.value = true;
  const visibleOptions = fileUploadOptions.value.filter(
    (option) => option.visible,
  );
  if (visibleOptions.length > 0 && visibleOptions[0]) {
    urlForm.type = visibleOptions[0].value;
  }
}

// MIME type mapping for URL import validation
const mimeTypes: Record<string, string> = {
  JPG: 'image/jpeg',
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  GIF: 'image/gif',
  BMP: 'image/bmp',
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  DOC: 'application/msword',
  TXT: 'text/plain',
  XLS: 'application/vnd.ms-excel',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  MD: 'text/markdown',
  HTML: 'text/html',
  CSV: 'text/csv',
  MP4: 'video/mp4',
  AVI: 'video/x-msvideo',
  MKV: 'video/x-matroska',
  MOV: 'video/quicktime',
  FLV: 'video/x-flv',
  WMV: 'video/x-ms-wmv',
  MP3: 'audio/mpeg',
  WAV: 'audio/wav',
  OGG: 'audio/ogg',
  AAC: 'audio/aac',
  M4A: 'audio/mp4',
  PPT: 'application/vnd.ms-powerpoint',
  PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

// Reverse-lookup: extension from MIME type
function getExtensionByMimeType(mimeType: string): string | undefined {
  for (const [ext, mime] of Object.entries(mimeTypes)) {
    if (mime === mimeType) return ext.toLowerCase();
  }
  return undefined;
}

async function saveUrl() {
  const urls = urlForm.source_url
    .split('\n')
    .map((u: string) => u.trim())
    .filter((u: string) => u.length > 0);
  if (urls.length === 0) return;

  const { maxFiles, fileLimit } =
    props.applicationDetails.file_upload_setting || {};
  const fileLimitMb = fileLimit || 50;

  // Validate max file count
  const currentCount =
    uploadImageList.value.length +
    uploadDocumentList.value.length +
    uploadAudioList.value.length +
    uploadVideoList.value.length +
    uploadOtherList.value.length;
  if (currentCount + urls.length > (maxFiles || 3)) {
    ElMessage.warning(`最多上传 ${maxFiles || 3} 个文件`);
    return;
  }

  // Build allowed MIME types for the selected category
  const mimeLookup = (ext: string): string | undefined => mimeTypes[ext];
  const allowedTypes: Record<string, string[]> = {
    image: imageExtensions.map((ext) => mimeLookup(ext)).filter(Boolean),
    document: documentExtensions.map((ext) => mimeLookup(ext)).filter(Boolean),
    audio: audioExtensions.map((ext) => mimeLookup(ext)).filter(Boolean),
    video: videoExtensions.map((ext) => mimeLookup(ext)).filter(Boolean),
    other: otherExtensions.value.map((ext) => mimeLookup(ext)).filter(Boolean),
  };

  const type = urlForm.type;
  const expectedTypes = allowedTypes[type] || [];

  const validFiles: any[] = [];
  const errors: string[] = [];

  // Process URLs in parallel
  const results = await Promise.allSettled(
    urls.map(async (url: string) => {
      // Validate URL structure
      try {
        void new URL(url);
      } catch {
        throw new Error(`${url}: URL格式无效`);
      }

      // Call backend to fetch remote URL
      const res = await getUrlFn(url);
      const data = res?.data ?? res;

      // Validate response status
      if (data.statusCode !== 200) {
        throw new Error(`${url}: URL返回状态码 ${data.statusCode}`);
      }

      const contentType: string = data.contentType || '';
      const contentLength: number = data.contentLength || 0;

      // Validate content type
      if (
        expectedTypes.length > 0 &&
        !expectedTypes.some((t: string) => contentType.includes(t))
      ) {
        throw new Error(`${url}: 文件类型不匹配`);
      }

      // Validate file size
      if (contentLength > fileLimitMb * 1024 * 1024) {
        throw new Error(`${url}: 文件大小超过 ${fileLimitMb}MB`);
      }

      // Derive filename from URL
      let fileName =
        url.slice(Math.max(0, url.lastIndexOf('/') + 1)) ||
        `file_${Date.now()}`;
      // Add extension from MIME type if missing
      if (!fileName.includes('.')) {
        const ext = getExtensionByMimeType(contentType);
        if (ext) fileName += `.${ext}`;
      }

      // Branch: image/video → direct URL; document/audio/other → re-upload
      if (type === 'image' || type === 'video') {
        // Use URL directly
        return reactive({
          uid: `${Date.now()}_${Math.random()}`,
          name: fileName,
          url,
          type: contentType,
          size: contentLength,
          status: 'success',
        });
      } else {
        // Decode base64 → File blob → upload via existing upload function
        const base64Data = data.content;
        let blob: Blob;

        if (contentType.includes('text') || contentType.includes('json')) {
          // Text content is raw string
          blob = new Blob([base64Data], { type: contentType });
        } else {
          // Binary content is base64-encoded (handle both data URL and raw base64)
          const byteString = base64Data.includes(',')
            ? // Data URL format: data:image/png;base64,iVBOR...
              atob(base64Data.split(',')[1] || base64Data)
            : // Raw base64
              atob(base64Data);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++)
            ia[i] = byteString.codePointAt(i) ?? 0;
          blob = new Blob([ab], { type: contentType });
        }

        const fileObj = new File([blob], fileName, { type: contentType });

        // Upload via the injected upload function
        if (uploadFn) {
          try {
            const ok = await uploadFn(fileObj);
            const uploadedUrl = ok.data ?? (ok as unknown as string);
            const splitPath = (uploadedUrl || '').split('/');
            const fileId = splitPath[splitPath.length - 1];
            return reactive({
              uid: `${Date.now()}_${Math.random()}`,
              name: fileName,
              url: uploadedUrl,
              file_id: fileId,
              size: contentLength,
              status: 'success',
            });
          } catch {
            throw new Error(`${url}: 文件上传失败`);
          }
        }

        // Fallback: no upload function available
        return reactive({
          uid: `${Date.now()}_${Math.random()}`,
          name: fileName,
          url,
          type: contentType,
          size: contentLength,
          status: 'success',
        });
      }
    }),
  );

  // Collect results
  for (const result of results) {
    if (result.status === 'fulfilled') {
      validFiles.push(result.value);
    } else {
      errors.push(result.reason?.message || '未知错误');
    }
  }

  // Push valid files to fileAllList
  fileAllList.value.push(...validFiles);

  // Show errors if any
  if (errors.length > 0) {
    ElMessage.warning(`URL导入部分失败: ${errors.join('; ')}`);
  }

  showURLSetting.value = false;
  urlForm.source_url = '';
  urlForm.type = '';
}

onMounted(() => {
  aiChatBus.on('chat-input', (message: string) => {
    inputValue.value = message;
  });
  if (question) {
    inputValue.value = decodeURIComponent((question as string).trim());
    sendChatHandle();
    setTimeout(() => {
      const route = router.currentRoute.value;
      const query = { ...route.query };
      delete query.question;
      const newRoute =
        Object.entries(query)?.length > 0
          ? `${route.path}?${Object.entries(query)
              .map(([key, value]) => `${key}=${value}`)
              .join('&')}`
          : route.path;
      history.pushState(null, '', `/chat${newRoute}`);
    }, 100);
  }
  setTimeout(() => {
    nextTick(() => {
      quickInputRef.value.textarea.style.height = '0';
    });
  }, 800);
});

onBeforeUnmount(() => {
  recorderManage.close();
});
</script>

<template>
  <div
    class="ai-chat__operate p-[16px]"
    @drop.prevent="handleDrop"
    @dragover.prevent
  >
    <div v-if="loading" class="g-mb-8 text-center">
      <ElButton class="video-stop-button border-primary" @click="stopChat">
        <ElIcon class="g-mr-8">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </ElIcon>
        停止回答
      </ElButton>
    </div>

    <div class="operate-textarea">
      <ElScrollbar max-height="136">
        <div
          v-if="
            uploadDocumentList.length > 0 ||
            uploadImageList.length > 0 ||
            uploadAudioList.length > 0 ||
            uploadVideoList.length > 0 ||
            uploadOtherList.length > 0
          "
          class="g-p-8-12"
          v-loading="uploadLoading"
        >
          <ElRow :gutter="10">
            <ElCol
              v-for="(item, index) in uploadDocumentList"
              :key="`doc-${index}`"
              :xs="24"
              :sm="props.type === 'debug-ai-chat' ? 24 : 12"
              :md="props.type === 'debug-ai-chat' ? 24 : 12"
              :lg="props.type === 'debug-ai-chat' ? 24 : 12"
              :xl="props.type === 'debug-ai-chat' ? 24 : 12"
              class="g-mb-8"
            >
              <ElCard
                shadow="never"
                style="

                  --el-card-padding: 8px;

                  max-width: 100%;
                "
                class="file cursor"
              >
                <div
                  class="flex-between align-center"
                  @mouseenter.stop="mouseenter(item)"
                  @mouseleave.stop="mouseleave()"
                >
                  <div class="align-center flex">
                    <img
                      :src="getImgUrl(item && item?.name)"
                      alt=""
                      width="24"
                    />
                    <div class="ellipsis-1 g-ml-4" :title="item && item?.name">
                      {{ item && item?.name }}
                    </div>
                  </div>
                  <div
                    v-if="showDelete === item.url"
                    class="delete-icon color-secondary"
                    @click="deleteFile(item)"
                  >
                    <ElIcon style="top: 2px; font-size: 16px">
                      <CircleCloseFilled />
                    </ElIcon>
                  </div>
                </div>
              </ElCard>
            </ElCol>
            <ElCol
              v-for="(item, index) in uploadOtherList"
              :key="`other-${index}`"
              :xs="24"
              :sm="props.type === 'debug-ai-chat' ? 24 : 12"
              :md="props.type === 'debug-ai-chat' ? 24 : 12"
              :lg="props.type === 'debug-ai-chat' ? 24 : 12"
              :xl="props.type === 'debug-ai-chat' ? 24 : 12"
              class="g-mb-8"
            >
              <ElCard
                shadow="never"
                style="

                  --el-card-padding: 8px;

                  max-width: 100%;
                "
                class="file cursor"
              >
                <div
                  class="flex-between align-center"
                  @mouseenter.stop="mouseenter(item)"
                  @mouseleave.stop="mouseleave()"
                >
                  <div class="align-center flex">
                    <img
                      :src="getImgUrl(item && item?.name)"
                      alt=""
                      width="24"
                    />
                    <div class="ellipsis-1 g-ml-4" :title="item && item?.name">
                      {{ item && item?.name }}
                    </div>
                  </div>
                  <div
                    v-if="showDelete === item.url"
                    class="delete-icon color-secondary"
                    @click="deleteFile(item)"
                  >
                    <ElIcon style="top: 2px; font-size: 16px">
                      <CircleCloseFilled />
                    </ElIcon>
                  </div>
                </div>
              </ElCard>
            </ElCol>
            <ElCol
              v-for="(item, index) in uploadAudioList"
              :key="`audio-${index}`"
              :xs="24"
              :sm="props.type === 'debug-ai-chat' ? 24 : 12"
              :md="props.type === 'debug-ai-chat' ? 24 : 12"
              :lg="props.type === 'debug-ai-chat' ? 24 : 12"
              :xl="props.type === 'debug-ai-chat' ? 24 : 12"
              class="g-mb-8"
            >
              <ElCard
                shadow="never"
                style="

--el-card-padding: 8px"
                class="file cursor"
              >
                <div
                  class="flex-between align-center"
                  @mouseenter.stop="mouseenter(item)"
                  @mouseleave.stop="mouseleave()"
                >
                  <div class="align-center flex">
                    <img
                      :src="getImgUrl(item && item?.name)"
                      alt=""
                      width="24"
                    />
                    <div class="ellipsis-1 g-ml-4" :title="item && item?.name">
                      {{ item && item?.name }}
                    </div>
                  </div>
                  <div
                    v-if="showDelete === item.url"
                    class="delete-icon color-secondary"
                    @click="deleteFile(item)"
                  >
                    <ElIcon style="top: 2px; font-size: 16px">
                      <CircleCloseFilled />
                    </ElIcon>
                  </div>
                </div>
              </ElCard>
            </ElCol>
          </ElRow>
          <ElSpace wrap>
            <template
              v-for="(item, index) in uploadImageList"
              :key="`img-${index}`"
            >
              <div
                class="file file-image cursor border-r-6 border"
                @mouseenter.stop="mouseenter(item)"
                @mouseleave.stop="mouseleave()"
              >
                <div
                  v-if="showDelete === item.url"
                  class="delete-icon color-secondary"
                  @click="deleteFile(item)"
                >
                  <ElIcon style="top: 2px; font-size: 16px">
                    <CircleCloseFilled />
                  </ElIcon>
                </div>
                <ElImage
                  v-if="item.url"
                  :src="item.url"
                  alt=""
                  fit="cover"
                  style="display: block; width: 40px; height: 40px"
                  class="border-r-6"
                />
              </div>
            </template>
          </ElSpace>
          <ElSpace wrap>
            <template
              v-for="(item, index) in uploadVideoList"
              :key="`video-${index}`"
            >
              <div
                class="file file-image cursor border-r-6 border"
                @mouseenter.stop="mouseenter(item)"
                @mouseleave.stop="mouseleave()"
              >
                <div
                  v-if="showDelete === item.url"
                  class="delete-icon color-secondary"
                  @click="deleteFile(item)"
                >
                  <ElIcon style="top: 2px; font-size: 16px">
                    <CircleCloseFilled />
                  </ElIcon>
                </div>
                <video
                  v-if="item.url"
                  :src="item.url"
                  autoplay
                  class="border-r-6"
                  controls
                  style="display: block; width: 100px"
                ></video>
              </div>
            </template>
          </ElSpace>
        </div>
      </ElScrollbar>

      <TouchChat
        v-if="isMicrophone"
        :disabled="loading"
        :start="recorderStatus === 'START'"
        :time="recorderTime"
        @touch-end="TouchEnd"
        @touch-start="startRecording"
      />
      <ElInput
        v-else
        ref="quickInputRef"
        v-model="inputValue"
        :autosize="{ maxRows: isMobile ? 4 : 10, minRows: 1 }"
        :placeholder="inputPlaceholder"
        :maxlength="100000"
        class="chat-operate-textarea"
        type="textarea"
        @keydown.enter="sendChatHandle($event)"
        @paste="handlePaste"
      />
      <div class="operate flex-between">
        <div>
          <slot name="inlineParams"></slot>
        </div>
        <div class="align-center flex">
          <template v-if="props.applicationDetails.stt_model_enable">
            <span class="align-center flex" v-if="mode !== 'mobile'">
              <ElButton
                v-if="recorderStatus === 'STOP'"
                :disabled="loading"
                text
                @click="startRecording"
              >
                <ElIcon :size="20"><Microphone /></ElIcon>
              </ElButton>
              <div v-else class="operate align-center flex">
                <ElText type="info"
                  >00:{{
                    recorderTime < 10 ? `0${recorderTime}` : recorderTime
                  }}</ElText
                >
                <ElButton
                  text
                  type="primary"
                  :loading="recorderStatus === 'TRANSCRIBING'"
                  @click="stopRecording"
                >
                  <ElIcon :size="20"
                    ><svg viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="2" /></svg
                  ></ElIcon>
                </ElButton>
              </div>
            </span>
            <span class="align-center flex" v-if="mode === 'mobile'">
              <ElButton
                :disabled="loading"
                text
                @click="switchMicrophone(!isMicrophone)"
              >
                <ElIcon :size="20">
                  <svg
                    v-if="isMicrophone"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path
                      d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"
                    />
                  </svg>
                  <Microphone v-else />
                </ElIcon>
              </ElButton>
            </span>
          </template>

          <template v-if="recorderStatus === 'STOP' || mode === 'mobile'">
            <span
              v-if="props.applicationDetails.file_upload_enable"
              class="align-center g-ml-4 flex"
            >
              <ElUpload
                v-if="!props.applicationDetails.file_upload_setting?.url_upload"
                ref="upload"
                action="#"
                :accept="getAcceptList()"
                :auto-upload="false"
                :on-change="
                  (file: any, fileList: any) => uploadFile(file, fileList)
                "
                :show-file-list="false"
                multiple
              >
                <ElTooltip
                  :disabled="mode === 'mobile'"
                  effect="dark"
                  placement="top"
                  popper-class="upload-tooltip-width"
                >
                  <template #content>
                    <div class="pre-wrap break-all">
                      上传文件：最多{{
                        props.applicationDetails.file_upload_setting?.maxFiles
                      }}个文件
                      {{
                        props.applicationDetails.file_upload_setting?.fileLimit
                      }}MB<br />
                      文件类型：{{
                        getAcceptList()
                          .replace(/\./g, '')
                          .replace(/,/g, '、')
                          .toUpperCase()
                      }}
                    </div>
                  </template>
                  <ElButton
                    :disabled="checkMaxFilesLimit() || loading"
                    class="g-mt-4"
                    text
                  >
                    <ElIcon :size="20"><Paperclip /></ElIcon>
                  </ElButton>
                </ElTooltip>
              </ElUpload>
              <ElTooltip
                v-if="props.applicationDetails.file_upload_setting?.url_upload"
                :disabled="mode === 'mobile'"
                effect="dark"
                placement="top"
                popper-class="upload-tooltip-width"
              >
                <template #content>
                  <div class="pre-wrap break-all">
                    通过URL导入文件：最多{{
                      props.applicationDetails.file_upload_setting?.maxFiles
                    }}个文件
                    {{
                      props.applicationDetails.file_upload_setting?.fileLimit
                    }}MB
                  </div>
                </template>
                <ElButton
                  :disabled="checkMaxFilesLimit() || loading"
                  class="g-mt-4"
                  text
                  @click="openUrlSetting"
                >
                  <ElIcon :size="20">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path
                        d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"
                      />
                    </svg>
                  </ElIcon>
                </ElButton>
              </ElTooltip>
            </span>
            <ElDivider
              v-if="
                props.applicationDetails.file_upload_enable ||
                props.applicationDetails.stt_model_enable
              "
              direction="vertical"
            />
            <ElButton
              text
              class="sent-button"
              :disabled="isDisabledChat || loading || uploadLoading"
              @click="sendChatHandle"
            >
              <svg
                v-show="isDisabledChat || loading || uploadLoading"
                style="width: 24px; height: 24px"
                viewBox="0 0 24 24"
                fill="#C0C4CC"
              >
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
              <svg
                v-show="!isDisabledChat && !loading && !uploadLoading"
                style="width: 24px; height: 24px"
                viewBox="0 0 24 24"
                fill="var(--el-color-primary)"
              >
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </ElButton>
          </template>
        </div>
      </div>
    </div>

    <div v-if="applicationDetails.disclaimer" class="g-mt-8 text-center">
      <ElTooltip
        :content="applicationDetails.disclaimer_value || ''"
        placement="top"
        :disabled="
          !applicationDetails.disclaimer_value ||
          (applicationDetails.disclaimer_value || '').length <= 50
        "
      >
        <ElText type="info" class="font-small disclaimer-text">
          {{ applicationDetails.disclaimer_value }}
        </ElText>
      </ElTooltip>
    </div>

    <div v-if="showURLSetting" class="popperURLSetting">
      <ElCard
        v-if="props.applicationDetails.file_upload_setting?.url_upload"
        shadow="always"
        style="

--el-card-padding: 16px"
      >
        <ElForm :model="urlForm" label-position="top">
          <ElFormItem>
            <template #label>
              <div class="flex-between">
                <span>URL地址</span>
                <ElSelect
                  v-model="urlForm.type"
                  :teleported="false"
                  size="small"
                  style="width: 85px"
                >
                  <ElOption
                    v-for="option in fileUploadOptions"
                    :key="option.value"
                    v-show="option.visible"
                    :label="option.label"
                    :value="option.value"
                  />
                </ElSelect>
              </div>
            </template>
            <ElInput
              v-model="urlForm.source_url"
              :rows="5"
              placeholder="请输入URL地址，每行一个"
              type="textarea"
            />
          </ElFormItem>
        </ElForm>
        <div class="text-right">
          <ElButton @click="showURLSetting = false">取消</ElButton>
          <ElButton type="primary" @click="saveUrl">确认</ElButton>
        </div>
        <div
          v-if="props.applicationDetails.file_upload_setting?.local_upload"
          style="margin-top: 16px"
        >
          <ElDivider style="margin: 0 0 16px" />
          <ElUpload
            action="#"
            multiple
            :auto-upload="false"
            :show-file-list="false"
            :accept="getAcceptList()"
            :on-change="
              (file: any, fileList: any) => uploadFile(file, fileList)
            "
            ref="upload"
            class="import-button"
          >
            <ElButton class="w-full">本地上传</ElButton>
          </ElUpload>
        </div>
      </ElCard>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@media only screen and (max-width: 768px) {
  .ai-chat__operate {
    position: fixed;
    bottom: 0;
    font-size: 1rem;

    .el-icon {
      font-size: 1.4rem !important;
    }
  }

  .popperURLSetting {
    right: 30px;
  }
}

.disclaimer-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.g-mb-8 {
  margin-bottom: 8px;
}

.g-mt-4 {
  margin-top: 4px;
}

.g-mt-8 {
  margin-top: 8px;
}

.g-mr-8 {
  margin-right: 8px;
}

.g-ml-4 {
  margin-left: 4px;
}

.g-p-8-12 {
  padding: 8px 12px;
}

.flex {
  display: flex;
}

.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.align-center {
  align-items: center;
}

.cursor {
  cursor: pointer;
}

.border-r-6 {
  border-radius: 6px;
}

.ellipsis-1 {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 1;
  word-break: break-all;
  -webkit-box-orient: vertical;
}

.color-secondary {
  color: var(--el-text-color-secondary);
}

.border-primary {
  color: var(--el-color-primary);
  border: 1px solid var(--el-color-primary);
}

.pre-wrap {
  white-space: pre-wrap;
}

.break-all {
  word-break: break-all;
}

.text-center {
  text-align: center;
}

.text-right {
  text-align: right;
}

.w-full {
  width: 100%;
}

/* ── Component styles ── */

.ai-chat__operate {
  position: relative;
  z-index: 10;
  box-sizing: border-box;
  width: 100%;

  /* Subtle background so the white input card stands out */
  background-color: var(--el-bg-color);

  :deep(.operate-textarea) {
    box-sizing: border-box;
    background-color: #fff;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    box-shadow: 0 6px 24px 0 rgb(var(--el-text-color-primary-rgb), 0.08);

    &:has(.el-textarea__inner:focus) {
      border: 1px solid var(--el-color-primary);
    }

    .el-textarea__inner {
      box-sizing: border-box;
      height: 0;
      min-height: 47px !important;
      padding: 13px 16px;
      resize: none;
      border-radius: 8px !important;
      box-shadow: none;
    }

    .operate {
      padding: 6px 10px;

      .sent-button {
        max-height: none;

        .el-icon {
          font-size: 24px;
        }
      }

      .el-loading-spinner {
        margin-top: -15px;

        .circular {
          width: 31px;
          height: 31px;
        }
      }
    }
  }

  .file {
    max-width: 200px;
    cursor: pointer;
  }

  .file-image {
    position: relative;
    overflow: inherit;

    .delete-icon {
      position: absolute;
      top: -5px;
      right: -5px;
      z-index: 1;
    }
  }

  .upload-tooltip-width {
    width: 300px;
  }
}

.popperURLSetting {
  position: absolute;
  right: 60px;
  bottom: 65px;
  z-index: 999;
  width: calc(100% - 50px);
  max-width: 320px;

  .url-upload-button {
    color: var(--el-color-primary);
    border-color: var(--el-color-primary);
  }
}
</style>
