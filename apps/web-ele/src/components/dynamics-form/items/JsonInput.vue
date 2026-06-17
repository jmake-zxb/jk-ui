<script setup lang="ts">
import { computed, ref } from 'vue';

import { DocumentChecked, FullScreen } from '@element-plus/icons-vue';
import { ElButton, ElDialog, ElIcon, ElInput } from 'element-plus';

const props = withDefaults(defineProps<{ modelValue?: any }>(), {
  modelValue: () => ({}),
});
const emit = defineEmits(['update:modelValue']);

const cache_model_value_str = ref<string>();

const model_value = computed({
  get: () => {
    if (cache_model_value_str.value) {
      return cache_model_value_str.value;
    }
    return JSON.stringify(props.modelValue, null, 4);
  },
  set: (v: string) => {
    if (v) {
      try {
        cache_model_value_str.value = v;
        const result = JSON.parse(v);
        emit('update:modelValue', result);
      } catch {
        // parse error - keep the cache, don't emit
      }
    } else {
      emit('update:modelValue', {});
    }
  },
});

// 弹出框相关代码
const dialogVisible = ref<boolean>(false);

const cloneContent = ref<string>('');

const openEditorDialog = () => {
  cloneContent.value = model_value.value;
  dialogVisible.value = true;
};

const format = () => {
  try {
    const json_str = JSON.parse(model_value.value);
    model_value.value = JSON.stringify(json_str, null, 4);
  } catch {
    // ignore parse errors
  }
};

function submitDialog() {
  model_value.value = cloneContent.value;
  dialogVisible.value = false;
}

/**
 * 校验格式
 */
const validate_rules = (_rule: any, _value: any, callback: any) => {
  if (model_value.value) {
    try {
      JSON.parse(model_value.value);
    } catch {
      callback(new Error('JSON格式不正确'));
      return false;
    }
  }
  return true;
};

defineExpose({ validate_rules });
</script>
<template>
  <div style="width: 100%" class="json-input-wrapper">
    <ElInput
      v-bind="$attrs"
      v-model="model_value"
      type="textarea"
      :autosize="{ minRows: 4, maxRows: 12 }"
      style="width: 100%"
    />
    <div class="json-input-actions">
      <ElButton text type="info" @click="format" class="json-input-format">
        <ElIcon><DocumentChecked /></ElIcon>
      </ElButton>
      <ElButton
        text
        type="info"
        @click="openEditorDialog"
        class="json-input-fullscreen"
      >
        <ElIcon style="font-size: 16px"><FullScreen /></ElIcon>
      </ElButton>
    </div>
    <!-- 全屏编辑弹出层 -->
    <ElDialog v-model="dialogVisible" title="编辑" append-to-body fullscreen>
      <ElInput
        v-model="cloneContent"
        type="textarea"
        :autosize="false"
        style="
          height: calc(100vh - 200px);
          border: 1px solid #bbbfc4;
          border-radius: 4px;
        "
      />
      <template #footer>
        <div class="dialog-footer mt-24">
          <ElButton type="primary" @click="submitDialog">确定</ElButton>
        </div>
      </template>
    </ElDialog>
  </div>
</template>
<style lang="scss" scoped>
.json-input-wrapper {
  position: relative;
}

.json-input-actions {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 4px;
}
</style>
