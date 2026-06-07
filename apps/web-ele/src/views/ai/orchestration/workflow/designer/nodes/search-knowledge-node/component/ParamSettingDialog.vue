<script setup lang="ts">
import { ref, watch } from 'vue';

import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInputNumber,
  ElOption,
  ElSelect,
  ElSlider,
} from 'element-plus';
import { cloneDeep } from 'lodash-es';

type SearchMode = 'blend' | 'embedding' | 'keywords';

type KnowledgeSetting = {
  max_paragraph_char_number: number;
  search_mode: SearchMode;
  similarity: number;
  top_n: number;
};

const emit = defineEmits<{
  refresh: [setting: KnowledgeSetting];
}>();

const defaultSetting: KnowledgeSetting = {
  max_paragraph_char_number: 5000,
  search_mode: 'embedding',
  similarity: 0.6,
  top_n: 3,
};

const dialogVisible = ref(false);
const formData = ref<KnowledgeSetting>(cloneDeep(defaultSetting));

function normalizeSetting(
  setting?: Partial<KnowledgeSetting>,
): KnowledgeSetting {
  return {
    max_paragraph_char_number:
      typeof setting?.max_paragraph_char_number === 'number'
        ? setting.max_paragraph_char_number
        : defaultSetting.max_paragraph_char_number,
    search_mode: ['blend', 'embedding', 'keywords'].includes(
      `${setting?.search_mode}`,
    )
      ? (setting?.search_mode as SearchMode)
      : defaultSetting.search_mode,
    similarity:
      typeof setting?.similarity === 'number'
        ? setting.similarity
        : defaultSetting.similarity,
    top_n:
      typeof setting?.top_n === 'number' ? setting.top_n : defaultSetting.top_n,
  };
}

function open(setting?: KnowledgeSetting) {
  formData.value = normalizeSetting(setting);
  dialogVisible.value = true;
}

function close() {
  dialogVisible.value = false;
}

function submit() {
  dialogVisible.value = false;
  emit('refresh', cloneDeep(formData.value));
}

watch(dialogVisible, (visible) => {
  if (visible) return;
  formData.value = cloneDeep(defaultSetting);
});

defineExpose({ open });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    title="检索参数"
    append-to-body
    :close-on-click-modal="false"
    width="560"
  >
    <ElForm
      :model="formData"
      class="param-setting-dialog"
      label-position="top"
      @submit.prevent
    >
      <ElFormItem label="检索模式">
        <ElSelect v-model="formData.search_mode" :teleported="false">
          <ElOption label="向量检索" value="embedding" />
          <ElOption label="全文检索" value="keywords" />
          <ElOption label="混合检索" value="blend" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="相似度">
        <div class="param-setting-dialog__row">
          <ElSlider
            v-model="formData.similarity"
            :min="0"
            :max="2"
            :step="0.001"
          />
          <ElInputNumber
            v-model="formData.similarity"
            :min="0"
            :max="2"
            :step="0.001"
            :precision="3"
            controls-position="right"
          />
        </div>
      </ElFormItem>
      <ElFormItem label="Top N">
        <ElInputNumber
          v-model="formData.top_n"
          :min="1"
          :max="10000"
          controls-position="right"
        />
      </ElFormItem>
      <ElFormItem label="最大引用字符数">
        <div class="param-setting-dialog__row">
          <ElSlider
            v-model="formData.max_paragraph_char_number"
            :min="500"
            :max="100000"
            :step="100"
          />
          <ElInputNumber
            v-model="formData.max_paragraph_char_number"
            :min="500"
            :max="100000"
            :step="100"
            controls-position="right"
          />
        </div>
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="close">取消</ElButton>
      <ElButton type="primary" @click="submit">保存</ElButton>
    </template>
  </ElDialog>
</template>

<style scoped lang="scss">
.param-setting-dialog {
  display: grid;
  gap: 8px;
}

.param-setting-dialog__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 150px;
  gap: 10px;
  align-items: center;
  width: 100%;
}
</style>
