<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { confirm } from '@vben/common-ui';

import {
  Delete,
  Edit,
  More,
  Setting,
  WarningFilled,
} from '@element-plus/icons-vue';
import {
  ElButton,
  ElCard,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElIcon,
  ElMessage,
  ElTooltip,
} from 'element-plus';

import { getModelMeta, pauseDownload } from '#/api/ai/models';
import { providerList as allProviderList } from '#/components/dynamics-form/items/model/provider-data';

import { modelTypeLabel } from '../data';

interface Provider {
  icon?: string;
  name: string;
  provider: string;
}

interface ModelMeta {
  message?: string;
}

interface Model {
  create_time?: string;
  id: number | string;
  meta?: ModelMeta;
  model_name: string;
  model_type: string;
  name: string;
  nick_name?: string;
  provider: string;
  resource_count?: number;
  status: string;
}

const props = defineProps<{
  model: Model;
  providerList: Array<Provider>;
  updateModelById: (modelId: string, model: Model) => void;
}>();

const emit = defineEmits<{
  change: [];
  delete: [model: Model];
  edit: [model: Model];
  paramSetting: [model: Model];
}>();

/** Downloading model snapshot polled from getModelMeta */
const downModel = ref<Model | undefined>();

const currentModel = computed(() => downModel.value ?? props.model);

/** Lookup provider icon SVG string: provider-data.ts first, then prop list */
function getProviderIcon(providerCode: string): string {
  // 优先使用 provider-data.ts 中的真实 SVG 图标
  const fromData = allProviderList.find((p) => p.provider === providerCode);
  if (fromData?.icon) return fromData.icon;
  // 兜底：后端返回的 icon 若是 SVG（以 < 开头），直接使用
  const fromProp = props.providerList.find((p) => p.provider === providerCode);
  if (fromProp?.icon && fromProp.icon.trim().startsWith('<'))
    return fromProp.icon;
  return '';
}

const icon = computed(() => getProviderIcon(props.model.provider));

const errMessage = computed(() => {
  const meta = currentModel.value.meta;
  if (meta?.message) {
    if (meta.message === 'pull model manifest: file does not exist') {
      return `${currentModel.value.model_name} 模型不存在`;
    }
    return meta.message;
  }
  return '';
});

const pauseDownloadTooltip = computed(
  () => `基础模型: ${props.model.model_name} 下载错误`,
);

const subtitleText = computed(() => {
  const nick = props.model.nick_name || '';
  const time = formatDate(props.model.create_time);
  if (nick && time) return `${nick} 创建于 ${time}`;
  if (nick) return nick;
  if (time) return `创建于 ${time}`;
  return '';
});

const modelTypeText = computed(() => modelTypeLabel(props.model.model_type));

const showParamSetting = computed(() => {
  const types = [
    'TTS',
    'STT',
    'LLM',
    'IMAGE',
    'TTI',
    'ITV',
    'EMBEDDING',
    'TTV',
  ];
  return types.includes(props.model.model_type?.toUpperCase());
});

function formatDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

let interval: ReturnType<typeof setInterval> | undefined;

function initInterval() {
  interval = setInterval(async () => {
    if (currentModel.value.status === 'DOWNLOAD') {
      try {
        const res = await getModelMeta(props.model.id);
        if (res) {
          downModel.value = res as Model;
        }
      } catch {
        // ignore polling errors
      }
    } else if (downModel.value) {
      props.updateModelById(String(props.model.id), downModel.value);
      downModel.value = undefined;
    }
  }, 6000);
}

function closeInterval() {
  if (interval) {
    clearInterval(interval);
    interval = undefined;
  }
}

async function cancelDownload() {
  try {
    await pauseDownload(props.model.id);
    downModel.value = undefined;
    emit('change');
  } catch {
    ElMessage.error('取消下载失败');
  }
}

function openEdit() {
  emit('edit', props.model);
}

function openParamSetting() {
  emit('paramSetting', props.model);
}

function handleDelete() {
  const name = props.model.name;
  const resourceCount = props.model.resource_count ?? 0;
  const content =
    resourceCount > 0
      ? `确认删除模型 ${name}？该模型已关联 ${resourceCount} 个资源，删除后相关资源将无法使用此模型。`
      : `确认删除模型 ${name}？`;
  confirm(content, { title: '删除模型' })
    .then(() => {
      emit('delete', props.model);
    })
    .catch(() => {});
}

onMounted(() => {
  initInterval();
});

onBeforeUnmount(() => {
  closeInterval();
});
</script>

<template>
  <ElCard shadow="hover" class="model-card" :body-style="{ padding: '16px' }">
    <!-- Card header: icon + title + status -->
    <div class="card-header">
      <span class="card-icon" v-html="icon"></span>
      <div class="card-title-area">
        <div class="card-title-row">
          <span class="card-title ellipsis" :title="model.name">{{
            model.name
          }}</span>
          <ElTooltip
            v-if="currentModel.status === 'ERROR'"
            effect="dark"
            :content="errMessage"
            placement="top"
          >
            <ElIcon class="status-danger" :size="18"><WarningFilled /></ElIcon>
          </ElTooltip>
          <ElTooltip
            v-if="currentModel.status === 'PAUSE_DOWNLOAD'"
            effect="dark"
            :content="pauseDownloadTooltip"
            placement="top"
          >
            <ElIcon class="status-danger" :size="18"><WarningFilled /></ElIcon>
          </ElTooltip>
        </div>
        <div
          v-if="subtitleText"
          class="card-subtitle ellipsis"
          :title="subtitleText"
        >
          {{ subtitleText }}
        </div>
      </div>

      <ElDropdown trigger="click" class="card-actions" @click.stop>
        <ElButton text @click.stop>
          <ElIcon class="color-secondary"><More /></ElIcon>
        </ElButton>
        <template #dropdown>
          <ElDropdownMenu>
            <ElDropdownItem @click.stop="openEdit">
              <ElIcon class="color-secondary"><Edit /></ElIcon>
              编辑
            </ElDropdownItem>
            <ElDropdownItem
              v-if="showParamSetting"
              @click.stop="openParamSetting"
            >
              <ElIcon class="color-secondary"><Setting /></ElIcon>
              参数设置
            </ElDropdownItem>
            <ElDropdownItem divided @click.stop="handleDelete">
              <ElIcon class="color-secondary"><Delete /></ElIcon>
              删除
            </ElDropdownItem>
          </ElDropdownMenu>
        </template>
      </ElDropdown>
    </div>

    <!-- Card body: model type + model name -->
    <ul class="card-body">
      <li class="body-row">
        <span class="body-label">模型类型</span>
        <span class="body-value ellipsis">{{ modelTypeText }}</span>
      </li>
      <li class="body-row">
        <span class="body-label">基础模型</span>
        <span class="body-value ellipsis" :title="model.model_name">{{
          model.model_name
        }}</span>
      </li>
    </ul>

    <!-- Download progress overlay -->
    <div
      v-if="currentModel.status === 'DOWNLOAD'"
      class="progress-mask"
      @click.stop
    >
      <div class="spinner"></div>
      <div class="percentage-label">
        下载中<span class="dotting"></span>
        <ElButton
          link
          type="primary"
          class="cancel-btn"
          @click.stop="cancelDownload"
        >
          取消下载
        </ElButton>
      </div>
    </div>
  </ElCard>
</template>

<style lang="scss" scoped>
.model-card {
  position: relative;
  min-width: auto;
  min-height: 135px;

  .card-header {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .card-icon {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;

    :deep(svg) {
      width: 100%;
      height: 100%;
    }
  }

  .card-title-area {
    flex: 1;
    min-width: 0;
  }

  .card-title-row {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .card-title {
    max-width: 80%;
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .status-danger {
    flex-shrink: 0;
    margin-left: 4px;
    color: var(--el-color-danger);
  }

  .card-subtitle {
    margin-top: 4px;
    font-size: 13px;
    font-weight: 400;
    color: var(--el-text-color-secondary);
  }

  .card-actions {
    flex-shrink: 0;
  }

  .card-body {
    padding: 0;
    margin: 12px 0 0;
    list-style: none;

    .body-row {
      display: flex;
      align-items: center;
      margin-bottom: 8px;

      &:last-child {
        margin-bottom: 0;
      }
    }

    .body-label {
      flex-shrink: 0;
      width: 60px;
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }

    .body-value {
      flex: 1;
      margin-left: 16px;
      font-size: 13px;
      color: var(--el-text-color-primary);
    }
  }

  .progress-mask {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 99;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background-color: rgb(255 255 255 / 90%);
    border-radius: var(--el-card-border-radius);

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--el-border-color);
      border-top-color: var(--el-color-primary);
      border-radius: 50%;
      animation: model-card-spin 0.8s linear infinite;
    }

    .percentage-label {
      display: flex;
      align-items: center;
      margin-top: 16px;
      font-size: 13px;
      color: var(--el-text-color-secondary);

      .cancel-btn {
        margin-left: 16px;
      }
    }
  }

  .ellipsis {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .color-secondary {
    color: var(--el-text-color-secondary);
  }
}

@keyframes model-card-spin {
  to {
    transform: rotate(360deg);
  }
}

.dotting::after {
  content: '...';
  animation: dotting 1.5s steps(4, end) infinite;
}

@keyframes dotting {
  0% {
    content: '';
  }

  25% {
    content: '.';
  }

  50% {
    content: '..';
  }

  75% {
    content: '...';
  }

  100% {
    content: '';
  }
}
</style>
