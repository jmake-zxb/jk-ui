<script setup lang="ts">
import { reactive, watch } from 'vue';

import {
  ElCard,
  ElCheckbox,
  ElCol,
  ElOption,
  ElRadio,
  ElRadioGroup,
  ElRow,
  ElSelect,
  ElSlider,
  ElSwitch,
  ElText,
  ElTooltip,
} from 'element-plus';

export interface SegmentRules {
  mode: 'advanced' | 'intelligent';
  patterns: string[];
  limit: number;
  withFilter: boolean;
  withProblemList: boolean;
}

const props = defineProps<{
  modelValue: SegmentRules;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: SegmentRules];
}>();

const form = reactive<SegmentRules>({
  ...props.modelValue,
});

watch(
  form,
  (val) => {
    emit('update:modelValue', { ...val });
  },
  { deep: true },
);

watch(
  () => props.modelValue,
  (val) => {
    Object.assign(form, val);
  },
);

const splitPatternOptions = [
  { label: String.raw`\n`, value: '\n' },
  { label: String.raw`\n\n`, value: '\n\n' },
  { label: '。', value: '。' },
  { label: '.', value: '.' },
  { label: '！', value: '！' },
  { label: '？', value: '？' },
  { label: '；', value: '；' },
];
</script>

<template>
  <div class="set-rules">
    <ElRow>
      <!-- Left: Settings -->
      <ElCol :span="10" class="set-rules__left p-24">
        <h4 class="title-decoration-1 mb-16">分段规则</h4>
        <div class="set-rules__scroll">
          <ElRadioGroup v-model="form.mode" class="set-rules__radio">
            <!-- Intelligent mode -->
            <ElCard
              shadow="never"
              class="mb-16"
              :class="{ 'border-active': form.mode === 'intelligent' }"
            >
              <ElRadio value="intelligent" size="large">
                <p class="mb-4">智能分段</p>
                <ElText type="info">
                  使用预训练的AI模型自动识别文档结构进行分段
                </ElText>
              </ElRadio>
            </ElCard>

            <!-- Advanced mode -->
            <ElCard
              shadow="never"
              class="mb-16"
              :class="{ 'border-active': form.mode === 'advanced' }"
            >
              <ElRadio value="advanced" size="large">
                <p class="mb-4">高级分段</p>
                <ElText type="info">
                  自定义分隔符和分段长度，精确控制分段效果
                </ElText>
              </ElRadio>

              <!-- Advanced options (nested card) -->
              <ElCard
                v-if="form.mode === 'advanced'"
                shadow="never"
                class="set-rules__advanced-card mt-16"
              >
                <!-- Separator patterns -->
                <div class="set-rules__form-item mb-16">
                  <div class="set-rules__form-label mb-8">
                    <span class="mr-4">分隔符</span>
                    <ElTooltip
                      effect="dark"
                      content="设置文档分段的分隔符，支持自定义输入"
                      placement="right"
                    >
                      <ElText type="warning" size="small">⚠</ElText>
                    </ElTooltip>
                  </div>
                  <ElSelect
                    v-model="form.patterns"
                    multiple
                    filterable
                    allow-create
                    default-first-option
                    :reserve-keyword="false"
                    placeholder="请选择或输入分隔符"
                  >
                    <ElOption
                      v-for="(item, index) in splitPatternOptions"
                      :key="index"
                      :label="item.label"
                      :value="item.value"
                    />
                  </ElSelect>
                </div>

                <!-- Segment length limit -->
                <div class="set-rules__form-item mb-16">
                  <div class="set-rules__form-label mb-8">分段长度</div>
                  <ElSlider
                    v-model="form.limit"
                    show-input
                    :show-input-controls="false"
                    :min="50"
                    :max="100000"
                    :step="100"
                  />
                </div>

                <!-- Auto cleaning -->
                <div class="set-rules__form-item">
                  <div class="set-rules__form-label mb-8">自动清洗</div>
                  <ElSwitch v-model="form.withFilter" size="small" />
                  <ElText type="info" size="small" class="mt-4">
                    开启后自动删除多余空格空行空段
                  </ElText>
                </div>
              </ElCard>
            </ElCard>
          </ElRadioGroup>
        </div>

        <!-- Problem list checkbox -->
        <div>
          <ElCheckbox
            v-model="form.withProblemList"
            style="white-space: normal"
          >
            关联问题列表
            <ElText type="info" size="small">
              将分段后的内容和问题列表关联
            </ElText>
          </ElCheckbox>
        </div>
      </ElCol>

      <!-- Right: Preview -->
      <ElCol :span="14" class="set-rules__right border-l p-24">
        <h4 class="title-decoration-1 mb-8">分段预览</h4>
        <ElCard shadow="never" class="set-rules__preview">
          <div class="set-rules__preview-placeholder">
            <ElText type="info">选择文件后将在此展示分段预览</ElText>
          </div>
        </ElCard>
      </ElCol>
    </ElRow>
  </div>
</template>

<style scoped>
.set-rules {
  width: 100%;
}

.set-rules__left {
  overflow: hidden;
}

.set-rules__scroll {
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}

.set-rules__right {
  overflow-y: auto;
}

.set-rules__radio {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.set-rules__radio :deep(.el-radio) {
  margin-right: 0;
}

.set-rules__advanced-card {
  margin-left: 30px;
}

.set-rules__form-label {
  font-size: 14px;
  font-weight: 400;
}

.set-rules__preview {
  min-height: 300px;
}

.set-rules__preview-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 260px;
}

/* Utility classes (matching UploadComponent.vue patterns) */
.p-24 {
  padding: 24px;
}

.mb-4 {
  margin-bottom: 4px;
}

.mb-8 {
  margin-bottom: 8px;
}

.mb-16 {
  margin-bottom: 16px;
}

.mt-4 {
  margin-top: 4px;
}

.mt-16 {
  margin-top: 16px;
}

.mr-4 {
  margin-right: 4px;
}

.border-l {
  border-left: 1px solid var(--el-border-color-lighter);
}

.title-decoration-1 {
  font-size: 16px;
  font-weight: 600;
}

.border-active {
  border-color: var(--el-color-primary);
}
</style>
