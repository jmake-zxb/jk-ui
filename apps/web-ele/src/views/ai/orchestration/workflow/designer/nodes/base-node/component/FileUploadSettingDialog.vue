<script setup lang="ts">
import type { InputInstance } from 'element-plus';

import { nextTick, ref, watch } from 'vue';

import {
  ElButton,
  ElCard,
  ElCheckbox,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElScrollbar,
  ElSlider,
  ElSpace,
  ElTag,
} from 'element-plus';

import {
  audioExtensions,
  cloneValue,
  defaultUploadSetting,
  documentExtensions,
  emitGraphEvent,
  imageExtensions,
  videoExtensions,
} from './base-node-utils';

const props = defineProps<{ nodeModel: any }>();
const emit = defineEmits<{
  refresh: [data: Record<string, any>];
}>();

const dialogVisible = ref(false);
const inputVisible = ref(false);
const inputValue = ref('');
const inputRef = ref<InputInstance>();
const formData = ref(cloneValue(defaultUploadSetting));
type UploadTypeKey = 'audio' | 'document' | 'image' | 'other' | 'video';

watch(dialogVisible, (visible) => {
  if (visible) return;
  formData.value = cloneValue(defaultUploadSetting);
  inputVisible.value = false;
  inputValue.value = '';
});

const typeCards = [
  {
    desc: documentExtensions.join('、'),
    key: 'document',
    label: '文档',
    tone: 'document',
  },
  {
    desc: imageExtensions.join('、'),
    key: 'image',
    label: '图片',
    tone: 'image',
  },
  {
    desc: audioExtensions.join('、'),
    key: 'audio',
    label: '音频',
    tone: 'audio',
  },
  {
    desc: videoExtensions.join('、'),
    key: 'video',
    label: '视频',
    tone: 'video',
  },
] as const;

function open(data?: any) {
  formData.value = { ...cloneValue(defaultUploadSetting), ...data };
  dialogVisible.value = true;
}

function close() {
  dialogVisible.value = false;
}

function toggleType(key: UploadTypeKey) {
  formData.value[key] = !formData.value[key];
}

function removeExtension(tag: string) {
  formData.value.otherExtensions = formData.value.otherExtensions.filter(
    (item: string) => item !== tag,
  );
}

function showInput() {
  inputVisible.value = true;
  nextTick(() => inputRef.value?.input?.focus());
}

function handleInputConfirm() {
  const value = inputValue.value.trim().toUpperCase();
  if (!value) {
    inputVisible.value = false;
    return;
  }
  const existingExtensions = [
    ...formData.value.otherExtensions,
    ...documentExtensions,
    ...imageExtensions,
    ...audioExtensions,
    ...videoExtensions,
  ];
  if (existingExtensions.includes(value)) {
    ElMessage.warning('扩展名已存在');
    inputVisible.value = false;
    inputValue.value = '';
    return;
  }
  formData.value.otherExtensions.push(value);
  inputVisible.value = false;
  inputValue.value = '';
}

async function submit() {
  if (!formData.value.local_upload && !formData.value.url_upload) {
    ElMessage.warning('请至少选择一种上传方式');
    return;
  }
  const data = cloneValue(formData.value);
  dialogVisible.value = false;
  await nextTick();
  emit('refresh', data);
  emitGraphEvent(props.nodeModel, 'refreshFileUploadConfig');
}

defineExpose({ open });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    title="文件上传设置"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    append-to-body
    width="760"
  >
    <ElScrollbar max-height="calc(100vh - 260px)">
      <ElForm
        :model="formData"
        label-position="top"
        class="file-upload-setting"
        @submit.prevent
      >
        <ElFormItem label="最多上传文件数">
          <ElSlider
            v-model="formData.maxFiles"
            :min="1"
            :max="100"
            show-input
            :show-input-controls="false"
          />
        </ElFormItem>
        <ElFormItem label="单文件大小限制（MB）">
          <ElSlider
            v-model="formData.fileLimit"
            :min="1"
            :max="1000"
            show-input
            :show-input-controls="false"
          />
        </ElFormItem>
        <ElFormItem label="文件类型">
          <div class="file-upload-setting__types">
            <ElCard
              v-for="item in typeCards"
              :key="item.key"
              shadow="hover"
              class="file-upload-setting__card"
              :class="[`is-${item.tone}`, { 'is-active': formData[item.key] }]"
              @click="toggleType(item.key)"
            >
              <div class="file-upload-setting__card-main">
                <span class="file-upload-setting__badge">{{
                  item.label.slice(0, 1)
                }}</span>
                <div>
                  <strong>{{ item.label }}</strong>
                  <small>{{ item.desc }}</small>
                </div>
                <ElCheckbox
                  :model-value="formData[item.key]"
                  @click.stop
                  @update:model-value="toggleType(item.key)"
                />
              </div>
            </ElCard>
            <ElCard
              shadow="hover"
              class="file-upload-setting__card is-other"
              :class="{ 'is-active': formData.other }"
              @click="toggleType('other')"
            >
              <div class="file-upload-setting__card-main">
                <span class="file-upload-setting__badge">其</span>
                <div>
                  <strong>其他</strong>
                  <ElSpace wrap :size="6" class="file-upload-setting__tags">
                    <ElTag
                      v-for="tag in formData.otherExtensions"
                      :key="tag"
                      closable
                      effect="plain"
                      type="info"
                      @close.stop="removeExtension(tag)"
                    >
                      {{ tag }}
                    </ElTag>
                    <ElInput
                      v-if="inputVisible"
                      ref="inputRef"
                      v-model="inputValue"
                      size="small"
                      class="file-upload-setting__tag-input"
                      @blur="handleInputConfirm"
                      @keyup.enter="handleInputConfirm"
                    />
                    <ElButton v-else size="small" @click.stop="showInput">
                      添加扩展名
                    </ElButton>
                  </ElSpace>
                </div>
                <ElCheckbox
                  :model-value="formData.other"
                  @click.stop
                  @update:model-value="toggleType('other')"
                />
              </div>
            </ElCard>
          </div>
        </ElFormItem>
        <ElFormItem label="上传方式">
          <div class="file-upload-setting__methods">
            <ElCheckbox v-model="formData.local_upload">本地上传</ElCheckbox>
            <ElCheckbox v-model="formData.url_upload">URL 上传</ElCheckbox>
          </div>
        </ElFormItem>
      </ElForm>
    </ElScrollbar>
    <template #footer>
      <ElButton @click="close">取消</ElButton>
      <ElButton type="primary" @click="submit">确定</ElButton>
    </template>
  </ElDialog>
</template>

<style scoped lang="scss">
.file-upload-setting,
.file-upload-setting__types {
  display: grid;
  gap: 10px;
}

.file-upload-setting__types {
  width: 100%;
}

.file-upload-setting__card {
  cursor: pointer;
  border-color: var(--el-border-color-lighter);
  transition:
    border-color var(--el-transition-duration),
    box-shadow var(--el-transition-duration);
}

.file-upload-setting__card.is-active {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-9);
}

.file-upload-setting__card-main {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.file-upload-setting__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 13px;
  font-weight: 800;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: 6px;
}

.file-upload-setting__card strong,
.file-upload-setting__card small {
  display: block;
}

.file-upload-setting__card small {
  margin-top: 3px;
  color: var(--el-text-color-secondary);
}

.file-upload-setting__tags {
  margin-top: 6px;
}

.file-upload-setting__tag-input {
  width: 96px;
}

.file-upload-setting__methods {
  display: flex;
  gap: 16px;
}
</style>
