<script setup lang="ts">
import type { ViewUpdate } from '@codemirror/view';

import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue';

import { indentWithTab } from '@codemirror/commands';
// --- 语言包 ---
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { Compartment, EditorState } from '@codemirror/state';
// --- 主题 ---
import { oneDark } from '@codemirror/theme-one-dark';
import { keymap } from '@codemirror/view';
// 注意：CM6 目前没有官方的 velocity 支持，通常用 StreamLanguage 桥接或暂时用 JS/HTML 代替
// --- CodeMirror 6 核心导入 ---
import { basicSetup, EditorView } from 'codemirror';
// CM6 默认就是亮色主题（类似 idea），无需额外引入

// 1. 定义 Props
export interface CodeEditorProps {
  modelValue?: string;
  mode?: 'java' | 'javascript' | 'json' | string;
  height?: number | string;
  width?: number | string;
  theme?: 'darcula' | 'idea' | 'one-dark' | string; // 映射旧主题名
  readOnly?: boolean;
}

const props = withDefaults(defineProps<CodeEditorProps>(), {
  modelValue: '',
  mode: 'java',
  height: '300px',
  width: '100%',
  theme: 'idea',
  readOnly: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'change', value: string): void;
}>();

// 2. Refs
const containerRef = ref<HTMLDivElement | null>(null);
const view = shallowRef<EditorView | null>(null);

// 3. Compartments (用于动态更新配置)
// CM6 中要动态修改配置（如切换语言），必须预先定义一个 Compartment
const languageConf = new Compartment();
const themeConf = new Compartment();
const readOnlyConf = new Compartment();

// 4. 辅助函数：获取语言扩展
const getLanguageExtension = (mode: string) => {
  switch (mode) {
    case 'java': {
      return java();
    }
    case 'javascript':
    case 'js': {
      return javascript();
    }
    case 'json': {
      return json();
    }
    // CM6 没有内置 velocity，这里暂退化为 javascript 或纯文本
    case 'velocity': {
      return javascript();
    }
    default: {
      return [];
    } // 纯文本
  }
};

// 5. 辅助函数：获取主题扩展
const getThemeExtension = (theme: string) => {
  if (theme === 'darcula' || theme === 'one-dark') {
    return oneDark;
  }
  // 返回空数组即使用默认亮色主题 (类似 idea)
  return [];
};

// 6. 初始化编辑器
const init = () => {
  if (!containerRef.value) return;

  // 定义状态
  const state = EditorState.create({
    doc: props.modelValue,
    extensions: [
      basicSetup, // 包含行号、高亮当前行、撤销重做等基础功能
      keymap.of([indentWithTab]), // 支持 Tab 缩进

      // 注册隔舱 (Compartments)
      languageConf.of(getLanguageExtension(props.mode)),
      themeConf.of(getThemeExtension(props.theme)),
      readOnlyConf.of(EditorState.readOnly.of(props.readOnly)),

      // 监听更新
      EditorView.updateListener.of((v: ViewUpdate) => {
        if (v.docChanged) {
          const newValue = v.state.doc.toString();
          emit('update:modelValue', newValue);
          emit('change', newValue);
        }
      }),
    ],
  });

  // 创建视图
  view.value = new EditorView({
    state,
    parent: containerRef.value,
  });
};

// 7. 监听 Props 变化并动态更新 (使用 dispatch + effects)

// 监听内容变化 (外部修改 modelValue -> 同步到编辑器)
watch(
  () => props.modelValue,
  (newVal) => {
    // 只有当新值与编辑器当前值不同时才更新，避免光标跳动
    if (view.value && newVal !== view.value.state.doc.toString()) {
      view.value.dispatch({
        changes: { from: 0, to: view.value.state.doc.length, insert: newVal },
      });
    }
  },
);

// 监听语言变化
watch(
  () => props.mode,
  (newMode) => {
    if (view.value) {
      view.value.dispatch({
        effects: languageConf.reconfigure(getLanguageExtension(newMode)),
      });
    }
  },
);

// 监听主题变化
watch(
  () => props.theme,
  (newTheme) => {
    if (view.value) {
      view.value.dispatch({
        effects: themeConf.reconfigure(getThemeExtension(newTheme)),
      });
    }
  },
);

// 监听只读变化
watch(
  () => props.readOnly,
  (newVal) => {
    if (view.value) {
      view.value.dispatch({
        effects: readOnlyConf.reconfigure(EditorState.readOnly.of(newVal)),
      });
    }
  },
);

// 8. 格式化 JSON 功能
const formatStrInJson = (strValue: string) => {
  try {
    const formatted = JSON.stringify(JSON.parse(strValue), null, 4);
    // 如果编辑器存在，直接更新编辑器内容
    if (view.value) {
      view.value.dispatch({
        changes: {
          from: 0,
          to: view.value.state.doc.length,
          insert: formatted,
        },
      });
    }
    return formatted;
  } catch (error) {
    console.error('JSON Format Error:', error);
    return strValue;
  }
};

// 9. 生命周期
onMounted(() => {
  init();
});

onBeforeUnmount(() => {
  if (view.value) {
    view.value.destroy();
  }
});

// 10. 暴露实例
defineExpose({
  formatStrInJson,
  view, // 暴露 CM6 的 EditorView 实例
});

// 计算样式
const _height = computed(() =>
  Number(props.height) ? `${Number(props.height)}px` : props.height,
);
const _width = computed(() =>
  Number(props.width) ? `${Number(props.width)}px` : props.width,
);
</script>

<template>
  <div class="code-editor-wrapper" :style="{ height: _height, width: _width }">
    <div ref="containerRef" class="cm-container"></div>
  </div>
</template>

<style scoped>
.code-editor-wrapper {
  overflow: hidden; /* 防止溢出 */
  font-size: 14px;
  border: 1px solid #ddd;
}

.cm-container {
  height: 100%;
}

/* CM6 的样式穿透调整 */
:deep(.cm-editor) {
  height: 100%;
}

:deep(.cm-scroller) {
  overflow: auto;
}

/* 选中行高亮样式微调（可选） */
:deep(.cm-activeLine) {
  background-color: #f0f9ff33;
}
</style>
