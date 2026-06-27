<script setup lang="ts">
import type { Ref } from 'vue';

import type { chatType } from '#/api/ai/types';

import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  CircleCloseFilled,
  Microphone,
  Paperclip,
  Promotion as SendIcon,
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

import applicationApi from '#/api/ai/applications';
import chatAPI from '#/api/ai/chat';
import iconSendSvg from '#/assets/chat/icon_send.svg';
import { $t } from '#/locales';
import bus from '#/utils/bus';
import { getImgUrl } from '#/utils/common';
import { MsgAlert, MsgWarning } from '#/utils/message';

import TouchChat from './TouchChat.vue';

import 'recorder-core/src/engine/mp3';
import 'recorder-core/src/engine/mp3-engine';

const props = withDefaults(
  defineProps<{
    appId?: string;
    applicationDetails?: any;
    chatId: string;
    isMobile: boolean;
    loading: boolean;
    openChatId: () => Promise<string>;
    sendMessage: (
      question: string,
      other_params_data?: any,
      chat?: chatType,
    ) => void;
    type: 'ai-chat' | 'debug-ai-chat' | 'log' | 'share';
    validate: () => Promise<any>;
  }>(),
  {
    appId: undefined,
    applicationDetails: () => ({}),
    available: true,
  },
);
const emit = defineEmits([
  'update:chatId',
  'update:loading',
  'update:showUserInput',
  'backBottom',
]);
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
const localLoading = computed({
  get: () => {
    return props.loading;
  },
  set: (v) => {
    emit('update:loading', v);
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
  if (recorderStatus.value === 'START') {
    return `${$t('aiChat.inputPlaceholder.speaking')}...`;
  }
  if (recorderStatus.value === 'TRANSCRIBING') {
    return `${$t('aiChat.inputPlaceholder.recorderLoading')}...`;
  }
  return `${$t('aiChat.inputPlaceholder.default')}`;
});

const upload = ref();

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
    props.applicationDetails.file_upload_setting;
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
    // 其他文件类型
    otherExtensions.value =
      props.applicationDetails.file_upload_setting.otherExtensions;
    accepts = [...accepts, ...otherExtensions.value];
  }

  if (accepts.length === 0) {
    return `.${$t('aiChat.uploadFile.tipMessage')}`;
  }
  return accepts.map((ext: any) => `.${ext}`).join(',');
};

const checkMaxFilesLimit = () => {
  return (
    props.applicationDetails.file_upload_setting.maxFiles <=
    uploadImageList.value.length +
      uploadDocumentList.value.length +
      uploadAudioList.value.length +
      uploadVideoList.value.length +
      uploadOtherList.value.length
  );
};
const filePromisionDict: any = ref<any>({});
const uploadFile = async (file: any, fileList: any) => {
  const { maxFiles, fileLimit } = props.applicationDetails.file_upload_setting;
  // 单次上传文件数量限制
  const file_limit_once =
    uploadImageList.value.length +
    uploadDocumentList.value.length +
    uploadAudioList.value.length +
    uploadVideoList.value.length +
    uploadOtherList.value.length;
  if (file_limit_once >= maxFiles) {
    MsgWarning(
      $t('aiChat.uploadFile.limitMessage1') +
        maxFiles +
        $t('aiChat.uploadFile.limitMessage2'),
    );
    fileList.splice(0, fileList.length, ...fileList.slice(0, maxFiles));
    return;
  }
  if (fileList.some((f: any) => f.size === 0)) {
    // MB
    MsgWarning($t('aiChat.uploadFile.sizeLimit2'));
    // 空文件上传过滤
    fileList.splice(
      0,
      fileList.length,
      ...fileList.filter((f: any) => f.size > 0),
    );
    return;
  }
  if (fileList.some((f: any) => f.size > fileLimit * 1024 * 1024)) {
    // MB
    MsgWarning(`${$t('aiChat.uploadFile.sizeLimit') + fileLimit}MB`);
    // 只保留未超出大小限制的文件
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
  const api =
    props.type === 'debug-ai-chat'
      ? applicationApi.postUploadFile(
          file.raw,
          'TEMPORARY_120_MINUTE',
          'TEMPORARY_120_MINUTE',
        )
      : chatAPI.postUploadFile(file.raw, chatId_context.value, 'CHAT');

  api.then((ok) => {
    inner.url = ok.data;
    const split_path = ok.data.split('/');
    inner.file_id = split_path[split_path.length - 1];
    delete filePromisionDict.value[file.uid];
  });
  showURLSetting.value = false;
};
// 粘贴处理
const handlePaste = (event: ClipboardEvent) => {
  if (!props.applicationDetails.file_upload_enable) return;
  const clipboardData = event.clipboardData;
  if (!clipboardData) return;

  // 获取剪贴板中的文件
  const files = clipboardData.files;
  if (files.length === 0) return;

  // 转换 FileList 为数组并遍历处理
  [...files].forEach((rawFile: File) => {
    // 创建符合 el-upload 要求的文件对象
    const elFile = {
      uid: Date.now(), // 生成唯一ID
      name: rawFile.name,
      size: rawFile.size,
      raw: rawFile, // 原始文件对象
      status: 'ready', // 文件状态
      percentage: 0, // 上传进度
    };

    // 手动触发上传逻辑（模拟 on-change 事件）
    uploadFile(elFile, [elFile]);
  });

  // 阻止默认粘贴行为
  event.preventDefault();
};
// 新增拖拽处理
const handleDrop = (event: DragEvent) => {
  if (!props.applicationDetails.file_upload_enable) return;
  event.preventDefault();
  const files = event.dataTransfer?.files;
  if (!files) return;

  [...files].forEach((rawFile) => {
    const elFile = {
      uid: Date.now(),
      name: rawFile.name,
      size: rawFile.size,
      raw: rawFile,
      status: 'ready',
      percentage: 0,
    };
    uploadFile(elFile, [elFile]);
  });
};
// 语音录制任务id
const intervalId = ref<any | null>(null);
// 语音录制开始秒数
const recorderTime = ref(0);
// START:开始录音 TRANSCRIBING:转换文字中
const recorderStatus = ref<'START' | 'STOP' | 'TRANSCRIBING'>('STOP');

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

// 是否显示移动端语音按钮
const isMicrophone = ref(false);
const switchMicrophone = (status: boolean) => {
  if (status) {
    // 如果显示就申请麦克风权限
    recorderManage.open(() => {
      isMicrophone.value = true;
    });
  } else {
    // 关闭麦克风
    recorderManage.close();
    isMicrophone.value = false;
  }
};

const TouchEnd = (bool?: boolean) => {
  if (bool) {
    stopRecording();
    recorderStatus.value = 'STOP';
  } else {
    stopTimer();
    recorderStatus.value = 'STOP';
  }
};
// 取消录音控制台日志
Recorder.CLog = function () {};

class RecorderManage {
  recorder?: any;
  uploadRecording: (blob: Blob, duration: number) => void;

  constructor(uploadRecording: (blob: Blob, duration: number) => void) {
    this.uploadRecording = uploadRecording;
  }

  close() {
    if (this.recorder) {
      this.recorder.close();
      this.recorder = undefined;
    }
  }

  open(callback?: () => void) {
    const recorder = new Recorder({
      type: 'mp3',
      bitRate: 128,
      sampleRate: 16_000,
    });
    if (!this.recorder) {
      recorder.open(() => {
        this.recorder = recorder;
        if (callback) {
          callback();
        }
      }, this.errorCallBack);
    }
  }

  start() {
    if (this.recorder) {
      this.recorder.start();
      recorderStatus.value = 'START';
      handleTimeChange();
    } else {
      const recorder = new Recorder({
        type: 'mp3',
        bitRate: 128,
        sampleRate: 16_000,
      });
      recorder.open(() => {
        this.recorder = recorder;
        recorder.start();
        recorderStatus.value = 'START';
        handleTimeChange();
      }, this.errorCallBack);
    }
  }

  stop() {
    if (this.recorder) {
      this.recorder.stop(
        (blob: Blob, duration: number) => {
          if (mode !== 'mobile') {
            this.close();
          }
          this.uploadRecording(blob, duration);
        },
        (err: any) => {
          MsgAlert($t('common.tip'), err, {
            confirmButtonText: $t('aiChat.tip.confirm'),
            dangerouslyUseHTMLString: true,
            customClass: 'record-tip-confirm',
          });
        },
      );
    }
  }

  private errorCallBack(err: any, isUserNotAllow: boolean) {
    if (isUserNotAllow) {
      MsgAlert($t('common.tip'), err, {
        confirmButtonText: $t('aiChat.tip.confirm'),
        dangerouslyUseHTMLString: true,
        customClass: 'record-tip-confirm',
      });
    } else {
      MsgAlert(
        $t('common.tip'),
        `${err}
        <div style="width: 100%;height:1px;border-top:1px var(--el-border-color) var(--el-border-style);margin:10px 0;"></div>
        ${$t('aiChat.tip.recorderTip')}
    <img src="${new URL(`/tipIMG.jpg`, import.meta.url).href}" style="width: 100%;" />`,
        {
          confirmButtonText: $t('aiChat.tip.confirm'),
          dangerouslyUseHTMLString: true,
          customClass: 'record-tip-confirm',
        },
      );
    }
  }
}

const getSpeechToTextAPI = () => {
  return props.type === 'ai-chat'
    ? (id?: any, data?: any, loading?: Ref<boolean>) => {
        return chatAPI.speechToText(data, loading);
      }
    : applicationApi.speechToText;
};
const speechToTextAPI = getSpeechToTextAPI();
// 上传录音文件
const uploadRecording = async (audioBlob: Blob) => {
  try {
    // 非自动发送切换输入框
    if (!props.applicationDetails.stt_autosend) {
      switchMicrophone(false);
    }
    recorderStatus.value = 'TRANSCRIBING';
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.mp3');
    if (props.applicationDetails.stt_autosend) {
      bus.emit('on:transcribing', true);
    }
    speechToTextAPI(
      props.applicationDetails.id as string,
      formData,
      localLoading,
    )
      .then((response) => {
        inputValue.value =
          typeof response.data === 'string' ? response.data : '';
        // 自动发送
        if (props.applicationDetails.stt_autosend) {
          nextTick(() => {
            autoSendMessage();
          });
        } else {
          switchMicrophone(false);
        }
      })
      .catch((error) => {
        console.error(`${$t('aiChat.uploadFile.errorMessage')}:`, error);
      })
      .finally(() => {
        recorderStatus.value = 'STOP';
        bus.emit('on:transcribing', false);
      });
  } catch (error) {
    recorderStatus.value = 'STOP';
    console.error(`${$t('aiChat.uploadFile.errorMessage')}:`, error);
  }
};
const recorderManage = new RecorderManage(uploadRecording);
// 开始录音
const startRecording = () => {
  recorderManage.start();
};

// 停止录音
const stopRecording = () => {
  recorderManage.stop();
};

const handleTimeChange = () => {
  recorderTime.value = 0;
  if (intervalId.value) {
    return;
  }
  intervalId.value = setInterval(() => {
    if (recorderStatus.value === 'STOP') {
      clearInterval(intervalId.value!);
      intervalId.value = null;
      return;
    }

    recorderTime.value++;

    if (recorderTime.value === 60 && mode !== 'mobile') {
      stopRecording();
      clearInterval(intervalId.value!);
      intervalId.value = null;
      recorderStatus.value = 'STOP';
    }
  }, 1000);
};
// 停止计时的函数
const stopTimer = () => {
  if (intervalId.value !== null) {
    clearInterval(intervalId.value);
    recorderTime.value = 0;
    intervalId.value = null;
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
      return $t('aiChat.uploadFile.otherMessage');
    } else if (fileLength[0]) {
      return $t('aiChat.uploadFile.imageMessage');
    } else if (fileLength[1]) {
      return $t('aiChat.uploadFile.documentMessage');
    } else if (fileLength[2]) {
      return $t('aiChat.uploadFile.audioMessage');
    } else if (fileLength[3]) {
      return $t('aiChat.uploadFile.videoMessage');
    } else if (fileLength[4]) {
      return $t('aiChat.uploadFile.otherMessage');
    }
  }

  return inputValue.value.trim();
};

function autoSendMessage() {
  props
    .validate()
    .then(() => {
      props.sendMessage(getQuestion(), {
        image_list: uploadImageList.value,
        document_list: uploadDocumentList.value,
        audio_list: uploadAudioList.value,
        video_list: uploadVideoList.value,
        other_list: uploadOtherList.value,
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
  // 如果是移动端，且按下回车键，不直接发送
  if ((isMobile || mode === 'mobile') && event?.key === 'Enter') {
    // 阻止默认事件
    return;
  }
  if (
    !event?.ctrlKey &&
    !event?.shiftKey &&
    !event?.altKey &&
    !event?.metaKey
  ) {
    // 如果没有按下组合键，则会阻止默认事件
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
    // 如果同时按下ctrl/shift/cmd/opt +enter，则会换行
    insertNewlineAtCursor(event);
  }
}

const insertNewlineAtCursor = (event?: any) => {
  const textarea = quickInputRef.value.$el.querySelector(
    '.el-textarea__inner',
  ) as HTMLTextAreaElement;
  const startPos = textarea.selectionStart;
  const endPos = textarea.selectionEnd;
  // 阻止默认行为（避免额外的换行符）
  event.preventDefault();
  // 在光标处插入换行符
  inputValue.value = `${inputValue.value.slice(0, startPos)}\n${inputValue.value.slice(endPos)}`;
  nextTick(() => {
    textarea.setSelectionRange(startPos + 1, startPos + 1); // 光标定位到换行后位置
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
  bus.emit('chat:stop');
}

onMounted(() => {
  bus.on('chat-input', (message: string) => {
    inputValue.value = message;
  });
  if (question) {
    inputValue.value = decodeURIComponent(question.trim());
    sendChatHandle();
    setTimeout(() => {
      // 获取当前路由信息
      const route = router.currentRoute.value;
      // 复制query对象
      const query = { ...route.query };
      // 删除特定的参数
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

const mime_types = {
  html: 'text/html',
  htm: 'text/html',
  shtml: 'text/html',
  css: 'text/css',
  xml: 'text/xml',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  js: 'application/javascript',
  atom: 'application/atom+xml',
  rss: 'application/rss+xml',
  mml: 'text/mathml',
  txt: 'text/plain',
  jad: 'text/vnd.sun.j2me.app-descriptor',
  wml: 'text/vnd.wap.wml',
  htc: 'text/x-component',
  avif: 'image/avif',
  png: 'image/png',
  svg: 'image/svg+xml',
  svgz: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  wbmp: 'image/vnd.wap.wbmp',
  webp: 'image/webp',
  ico: 'image/x-icon',
  jng: 'image/x-jng',
  bmp: 'image/x-ms-bmp',
  woff: 'font/woff',
  woff2: 'font/woff2',
  jar: 'application/java-archive',
  war: 'application/java-archive',
  ear: 'application/java-archive',
  json: 'application/json',
  hqx: 'application/mac-binhex40',
  doc: 'application/msword',
  pdf: 'application/pdf',
  ps: 'application/postscript',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  eps: 'application/postscript',
  ai: 'application/postscript',
  rtf: 'application/rtf',
  m3u8: 'application/vnd.apple.mpegurl',
  kml: 'application/vnd.google-earth.kml+xml',
  kmz: 'application/vnd.google-earth.kmz',
  xls: 'application/vnd.ms-excel',
  eot: 'application/vnd.ms-fontobject',
  ppt: 'application/vnd.ms-powerpoint',
  odg: 'application/vnd.oasis.opendocument.graphics',
  odp: 'application/vnd.oasis.opendocument.presentation',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odt: 'application/vnd.oasis.opendocument.text',
  wmlc: 'application/vnd.wap.wmlc',
  wasm: 'application/wasm',
  '7z': 'application/x-7z-compressed',
  cco: 'application/x-cocoa',
  jardiff: 'application/x-java-archive-diff',
  jnlp: 'application/x-java-jnlp-file',
  run: 'application/x-makeself',
  pl: 'application/x-perl',
  pm: 'application/x-perl',
  prc: 'application/x-pilot',
  pdb: 'application/x-pilot',
  rar: 'application/x-rar-compressed',
  rpm: 'application/x-redhat-package-manager',
  sea: 'application/x-sea',
  swf: 'application/x-shockwave-flash',
  sit: 'application/x-stuffit',
  tcl: 'application/x-tcl',
  tk: 'application/x-tcl',
  der: 'application/x-x509-ca-cert',
  pem: 'application/x-x509-ca-cert',
  crt: 'application/x-x509-ca-cert',
  xpi: 'application/x-xpinstall',
  xhtml: 'application/xhtml+xml',
  xspf: 'application/xspf+xml',
  zip: 'application/zip',
  bin: 'application/octet-stream',
  exe: 'application/octet-stream',
  dll: 'application/octet-stream',
  deb: 'application/octet-stream',
  dmg: 'application/octet-stream',
  iso: 'application/octet-stream',
  img: 'application/octet-stream',
  msi: 'application/octet-stream',
  msp: 'application/octet-stream',
  msm: 'application/octet-stream',
  mid: 'audio/midi',
  midi: 'audio/midi',
  kar: 'audio/midi',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  m4a: 'audio/x-m4a',
  ra: 'audio/x-realaudio',
  '3gpp': 'video/3gpp',
  '3gp': 'video/3gpp',
  ts: 'video/mp2t',
  mp4: 'video/mp4',
  mpeg: 'video/mpeg',
  mpg: 'video/mpeg',
  mov: 'video/quicktime',
  webm: 'video/webm',
  flv: 'video/x-flv',
  m4v: 'video/x-m4v',
  mng: 'video/x-mng',
  asx: 'video/x-ms-asf',
  asf: 'video/x-ms-asf',
  wmv: 'video/x-ms-wmv',
  avi: 'video/x-msvideo',
  wav: 'audio/wav',
  flac: 'audio/flac',
  aac: 'audio/aac',
  opus: 'audio/opus',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  ics: 'text/calendar',
};

function getExtensionsByMime(mime: string): string[] {
  return Object.entries(mime_types)
    .filter(([_key, value]) => value === mime)
    .map(([_key]) => _key);
}

const fileUploadOptions = computed(() => [
  {
    label: $t('common.fileUpload.image'),
    value: 'image',
    visible: props.applicationDetails.file_upload_setting.image,
  },
  {
    label: $t('common.fileUpload.document'),
    value: 'document',
    visible: props.applicationDetails.file_upload_setting.document,
  },
  {
    label: $t('common.fileUpload.video'),
    value: 'video',
    visible: props.applicationDetails.file_upload_setting.video,
  },
  {
    label: $t('common.fileUpload.audio'),
    value: 'audio',
    visible: props.applicationDetails.file_upload_setting.audio,
  },
  {
    label: $t('common.fileUpload.other'),
    value: 'other',
    visible: props.applicationDetails.file_upload_setting.other,
  },
]);

function openUrlSetting() {
  showURLSetting.value = true;
  const visibleOptions = fileUploadOptions.value.filter(
    (option) => option.visible,
  );
  if (visibleOptions.length > 0) {
    urlForm.type = visibleOptions[0].value;
  }
}

async function saveUrl() {
  const urls = urlForm.source_url.split('\n');
  if (urls.length === 0) {
    MsgWarning($t('aiChat.uploadFile.invalidUrl'));
    return;
  }
  const { maxFiles, fileLimit } = props.applicationDetails.file_upload_setting;
  const file_limit_once =
    uploadImageList.value.length +
    uploadDocumentList.value.length +
    uploadAudioList.value.length +
    uploadVideoList.value.length +
    uploadOtherList.value.length;
  if (
    file_limit_once >= maxFiles ||
    urls.length + file_limit_once >= fileLimit ||
    urls.length > fileLimit
  ) {
    MsgWarning(
      $t('aiChat.uploadFile.limitMessage1') +
        maxFiles +
        $t('aiChat.uploadFile.limitMessage2'),
    );
    return;
  }
  // 允许的 MIME 类型
  const allowedTypes: Record<string, string[]> = {
    image: imageExtensions
      .map((ext) => mime_types[ext.toLowerCase() as keyof typeof mime_types])
      .filter(Boolean) as string[],
    document: documentExtensions
      .map((ext) => mime_types[ext.toLowerCase() as keyof typeof mime_types])
      .filter(Boolean) as string[],
    audio: audioExtensions
      .map((ext) => mime_types[ext.toLowerCase() as keyof typeof mime_types])
      .filter(Boolean) as string[],
    video: videoExtensions
      .map((ext) => mime_types[ext.toLowerCase() as keyof typeof mime_types])
      .filter(Boolean) as string[],
    other: otherExtensions.value
      .map((ext) => mime_types[ext.toLowerCase() as keyof typeof mime_types])
      .filter(Boolean) as string[],
  };

  // 校验 URL 是否有效
  const validUrls = urls
    .map((u) => u.trim())
    .filter((u) => {
      try {
        new URL(u).toString();
        return u !== '';
      } catch {
        return false;
      }
    });

  if (validUrls.length === 0) {
    MsgWarning($t('aiChat.uploadFile.invalidUrl'));
    return;
  }

  const type = urlForm.type;
  const expectedTypes = allowedTypes[type] || [];
  const validFiles: any[] = [];

  // 异步校验单个 URL
  async function processUrl(url: string) {
    try {
      const appId = props.appId || props.applicationDetails?.id;
      const res =
        props.type === 'debug-ai-chat'
          ? await applicationApi.getFile(appId, { url })
          : await chatAPI.getFile(appId, { url });

      if (res.data.status_code !== 200) {
        MsgWarning(`${url} ${$t('aiChat.uploadFile.invalidUrl')}`);
        return;
      }

      const contentType = res.data['Content-Type'] || '';
      const contentLength = res.data['Content-Length'];
      const fileSize = contentLength ? Number.parseInt(contentLength, 10) : 0;

      // 类型校验
      if (
        expectedTypes.length > 0 &&
        !expectedTypes.some((type) => contentType.includes(type))
      ) {
        MsgWarning(`${url} ${$t('aiChat.uploadFile.urlErrorMessage')}`);
        return;
      }

      if (fileSize > fileLimit * 1024 * 1024) {
        MsgWarning(`${url} ${$t('aiChat.uploadFile.sizeLimit')}${fileLimit}MB`);
        return;
      }

      // 文件名处理
      let fileName = url.slice(Math.max(0, url.lastIndexOf('/') + 1));
      if (!fileName) fileName = `file_${Date.now()}`;
      if (!fileName.includes('.') && getExtensionsByMime(contentType)) {
        fileName += `.${getExtensionsByMime(contentType)[0]}`;
      }

      const fileItem = {
        uid: `${Date.now()}_${Math.random()}`,
        name: fileName,
        url,
        type: contentType,
        size: fileSize,
        status: 'success',
      };

      // 文档/音频类型需要下载后上传
      if (type === 'document' || type === 'audio' || type === 'other') {
        const base64Data = res.data.content;
        const byteString = atob(base64Data.split(',')[1] || base64Data);
        const mimeString =
          base64Data.split(',')[0]?.split(':')[1]?.split(';')[0] || contentType;
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++)
          ia[i] = byteString.codePointAt(i) || 0;

        const fileBlob = new Blob([ab], { type: mimeString });
        const fileObj = new File([fileBlob], fileName, { type: mimeString });

        const uploadFileItem = {
          uid: fileItem.uid,
          name: fileName,
          size: fileSize,
          raw: fileObj,
          status: 'ready',
          percentage: 0,
        };

        await uploadFile(uploadFileItem, [uploadFileItem]);
      } else {
        validFiles.push(reactive(fileItem));
      }
    } catch (error) {
      console.error(error);
    }
  }

  // 并行处理所有 URL
  await Promise.all(validUrls.map((url) => processUrl(url)));

  if (validFiles.length > 0) {
    fileAllList.value.push(...validFiles);
  }

  showURLSetting.value = false;
  urlForm.source_url = '';
  urlForm.type = '';
}
</script>
<template>
  <div
    class="ai-chat__operate p-4"
    @drop.prevent="handleDrop"
    @dragover.prevent
  >
    <div class="mb-2 text-center" v-if="loading">
      <ElButton class="video-stop-button border-primary" @click="stopChat">
        <app-icon icon-name="app-video-stop" class="mr-2" />
        {{ $$t('aiChat.operation.stopChat') }}
      </ElButton>
    </div>

    <div class="operate-textarea">
      <ElScrollbar max-height="136">
        <div
          class="p-8-12"
          v-loading="uploadLoading"
          v-if="
            uploadDocumentList.length > 0 ||
            uploadImageList.length > 0 ||
            uploadAudioList.length > 0 ||
            uploadVideoList.length > 0 ||
            uploadOtherList.length > 0
          "
        >
          <ElRow :gutter="10">
            <ElCol
              v-for="(item, index) in uploadDocumentList"
              :key="index"
              :xs="24"
              :sm="props.type === 'debug-ai-chat' ? 24 : 12"
              :md="props.type === 'debug-ai-chat' ? 24 : 12"
              :lg="props.type === 'debug-ai-chat' ? 24 : 12"
              :xl="props.type === 'debug-ai-chat' ? 24 : 12"
              class="mb-2"
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
                    <div class="ellipsis-1 ml-1" :title="item && item?.name">
                      {{ item && item?.name }}
                    </div>
                  </div>
                  <div
                    @click="deleteFile(item)"
                    class="delete-icon color-secondary"
                    v-if="showDelete === item.url"
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
              :key="index"
              :xs="24"
              :sm="props.type === 'debug-ai-chat' ? 24 : 12"
              :md="props.type === 'debug-ai-chat' ? 24 : 12"
              :lg="props.type === 'debug-ai-chat' ? 24 : 12"
              :xl="props.type === 'debug-ai-chat' ? 24 : 12"
              class="mb-2"
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
                    <div class="ellipsis-1 ml-1" :title="item && item?.name">
                      {{ item && item?.name }}
                    </div>
                  </div>
                  <div
                    @click="deleteFile(item)"
                    class="delete-icon color-secondary"
                    v-if="showDelete === item.url"
                  >
                    <ElIcon style="top: 2px; font-size: 16px">
                      <CircleCloseFilled />
                    </ElIcon>
                  </div>
                </div>
              </ElCard>
            </ElCol>

            <ElCol
              :xs="24"
              :sm="props.type === 'debug-ai-chat' ? 24 : 12"
              :md="props.type === 'debug-ai-chat' ? 24 : 12"
              :lg="props.type === 'debug-ai-chat' ? 24 : 12"
              :xl="props.type === 'debug-ai-chat' ? 24 : 12"
              class="mb-2"
              v-for="(item, index) in uploadAudioList"
              :key="index"
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
                    <div class="ellipsis-1 ml-1" :title="item && item?.name">
                      {{ item && item?.name }}
                    </div>
                  </div>
                  <div
                    @click="deleteFile(item)"
                    class="delete-icon color-secondary"
                    v-if="showDelete === item.url"
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
            <template v-for="(item, index) in uploadImageList" :key="index">
              <div
                class="file file-image cursor rounded-md border"
                @mouseenter.stop="mouseenter(item)"
                @mouseleave.stop="mouseleave()"
              >
                <div
                  @click="deleteFile(item)"
                  class="delete-icon color-secondary"
                  v-if="showDelete === item.url"
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
                  class="rounded-md"
                />
              </div>
            </template>
          </ElSpace>
          <ElSpace wrap>
            <template v-for="(item, index) in uploadVideoList" :key="index">
              <div
                class="file file-image cursor rounded-md border"
                @mouseenter.stop="mouseenter(item)"
                @mouseleave.stop="mouseleave()"
              >
                <div
                  @click="deleteFile(item)"
                  class="delete-icon color-secondary"
                  v-if="showDelete === item.url"
                >
                  <ElIcon style="top: 2px; font-size: 16px">
                    <CircleCloseFilled />
                  </ElIcon>
                </div>
                <video
                  v-if="item.url"
                  :src="item.url"
                  controls
                  style="display: block; width: 100px"
                  class="rounded-md"
                  autoplay
                ></video>
              </div>
            </template>
          </ElSpace>
        </div>
      </ElScrollbar>

      <TouchChat
        v-if="isMicrophone"
        @touch-start="startRecording"
        @touch-end="TouchEnd"
        :time="recorderTime"
        :start="recorderStatus === 'START'"
        :disabled="loading"
      />
      <ElInput
        v-else
        ref="quickInputRef"
        v-model="inputValue"
        :autosize="{ minRows: 1, maxRows: isMobile ? 4 : 10 }"
        type="textarea"
        :placeholder="inputPlaceholder"
        :maxlength="100000"
        @keydown.enter="sendChatHandle($event)"
        @paste="handlePaste"
        class="chat-operate-textarea"
      />
      <div class="operate flex-between">
        <div>
          <slot name="inlineParams"></slot>
        </div>
        <div class="align-center flex">
          <template v-if="props.applicationDetails.stt_model_enable">
            <span v-if="mode === 'mobile'">
              <ElButton text @click="switchMicrophone(!isMicrophone)">
                <!-- 键盘 -->
                <AppIcon
                  v-if="isMicrophone"
                  icon-name="app-keyboard"
                  :size="20"
                />
                <ElIcon v-else :size="20">
                  <!-- 录音 -->
                  <Microphone />
                </ElIcon>
              </ElButton>
            </span>
            <span class="align-center flex" v-else>
              <ElButton
                :disabled="loading"
                text
                @click="startRecording"
                v-if="recorderStatus === 'STOP'"
              >
                <ElIcon :size="20">
                  <Microphone />
                </ElIcon>
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
                  @click="stopRecording"
                  :loading="recorderStatus === 'TRANSCRIBING'"
                >
                  <AppIcon icon-name="app-video-stop" :size="20" />
                </ElButton>
              </div>
            </span>
          </template>

          <template v-if="recorderStatus === 'STOP' || mode === 'mobile'">
            <span
              v-if="props.applicationDetails.file_upload_enable"
              class="align-center ml-1 flex"
            >
              <!-- 如果URL地址 -->
              <ElButton
                v-if="props.applicationDetails.file_upload_setting.url_upload"
                text
                :disabled="checkMaxFilesLimit() || loading"
                class="mt-1"
                @click="openUrlSetting"
              >
                <ElIcon :size="20"><Paperclip /></ElIcon>
              </ElButton>
              <!-- 没有URL地址 -->
              <ElUpload
                v-else
                action="#"
                multiple
                :auto-upload="false"
                :show-file-list="false"
                :accept="getAcceptList()"
                :on-change="
                  (file: any, fileList: any) => uploadFile(file, fileList)
                "
                ref="upload"
              >
                <ElTooltip
                  :disabled="mode === 'mobile'"
                  effect="dark"
                  placement="top"
                  popper-class="upload-tooltip-width"
                >
                  <template #content>
                    <div class="pre-wrap break-all">
                      {{ $$t('aiChat.uploadFile.label') }}：{{
                        $$t('aiChat.uploadFile.most')
                      }}{{
                        props.applicationDetails.file_upload_setting.maxFiles
                      }}{{ $$t('aiChat.uploadFile.limit') }}
                      {{
                        props.applicationDetails.file_upload_setting.fileLimit
                      }}MB<br />{{ $$t('aiChat.uploadFile.fileType') }}：{{
                        getAcceptList()
                          .replace(/\./g, '')
                          .replace(/,/g, '、')
                          .toUpperCase()
                      }}
                    </div>
                  </template>
                  <ElButton
                    text
                    :disabled="checkMaxFilesLimit() || loading"
                    class="mt-1"
                  >
                    <ElIcon :size="20"><Paperclip /></ElIcon>
                  </ElButton>
                </ElTooltip>
              </ElUpload>
            </span>
            <ElDivider
              direction="vertical"
              v-if="
                props.applicationDetails.file_upload_enable ||
                props.applicationDetails.stt_model_enable
              "
            />
            <ElButton
              text
              class="sent-button"
              :disabled="isDisabledChat || loading || uploadLoading"
              @click="sendChatHandle"
            >
              <img
                v-show="isDisabledChat || loading || uploadLoading"
                :src="iconSendSvg"
                alt=""
              />
              <SendIcon
                v-show="!isDisabledChat && !loading && !uploadLoading"
              />
            </ElButton>
          </template>
        </div>
      </div>
    </div>

    <div class="mt-2 text-center" v-if="applicationDetails.disclaimer">
      <ElText
        type="info"
        v-if="applicationDetails.disclaimer"
        class="font-small"
      >
        <ElTooltip :content="applicationDetails.disclaimer_value">
          <span>{{ applicationDetails.disclaimer_value }}</span>
        </ElTooltip>
      </ElText>
    </div>

    <!-- 弹出URL设置框 -->
    <div class="popperURLSetting" v-if="showURLSetting">
      <ElCard
        shadow="always"
        class="rounded-lg"
        style="

--el-card-padding: 16px"
        v-if="props.applicationDetails.file_upload_setting.url_upload"
      >
        <ElForm label-position="top" :model="urlForm">
          <ElFormItem>
            <template #label>
              <div class="flex-between">
                <span>{{ $$t('aiChat.uploadFile.urlTitle') }}</span>
                <ElSelect
                  :teleported="false"
                  v-model="urlForm.type"
                  size="small"
                  style="width: 85px"
                >
                  <ElOption
                    v-for="option in fileUploadOptions"
                    :key="option.value"
                    :label="option.label"
                    :value="option.value"
                    v-show="option.visible"
                  />
                </ElSelect>
              </div>
            </template>
            <ElInput
              v-model="urlForm.source_url"
              :placeholder="$$t('aiChat.uploadFile.urlPlaceholder')"
              :rows="5"
              type="textarea"
            />
          </ElFormItem>
        </ElForm>
        <div class="text-right">
          <ElButton @click="showURLSetting = false">
            {{ $$t('common.cancel') }}
          </ElButton>
          <ElButton type="primary" @click="saveUrl">
            {{ $$t('common.confirm') }}
          </ElButton>
        </div>
        <div v-if="props.applicationDetails.file_upload_setting.local_upload">
          <ElDivider style="margin: 16px 0" />
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
            <ElButton class="url-upload-button w-full">
              {{ $$t('aiChat.uploadFile.localUpload') }}
            </ElButton>
          </ElUpload>
        </div>
      </ElCard>
    </div>
  </div>
</template>
<style lang="scss" scoped>
.ai-chat__operate {
  position: relative;
  z-index: 10;
  box-sizing: border-box;
  width: 100%;

  :deep(.operate-textarea) {
    box-sizing: border-box;
    background-color: var(--el-bg-color);
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

        .el-icon,
        svg {
          width: 1em;
          height: 1em;
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
