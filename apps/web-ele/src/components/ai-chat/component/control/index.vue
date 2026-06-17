<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

import { ElMessage } from 'element-plus';

import { aiChatBus } from '../../utils/bus';

const visibleMenu = ref(false);
const menuStyle = ref<Record<string, string>>({});

function getSelection() {
  const selection = window.getSelection();
  if (selection) {
    if (selection.rangeCount === 0) return undefined;
    const range = selection.getRangeAt(0);
    const fragment = range.cloneContents();
    const div = document.createElement('div');
    div.append(fragment);
    if (div.textContent) {
      return div.textContent.trim();
    }
  }
  return undefined;
}

const openControl = (event: MouseEvent) => {
  const c = getSelection();
  if (c) {
    if (visibleMenu.value) {
      clearSelectedText();
      visibleMenu.value = false;
    } else {
      nextTick(() => {
        menuStyle.value = {
          left: `${event.clientX}px`,
          top: `${event.clientY}px`,
        };
        visibleMenu.value = true;
      });
    }
    event.preventDefault();
  } else {
    visibleMenu.value = false;
  }
};

const menus = ref([
  {
    icon: 'copy',
    label: '复制',
    click: () => {
      const selectionText = getSelection();
      if (selectionText) {
        clearSelectedText();
        navigator.clipboard
          ?.writeText(selectionText)
          .then(() => {
            ElMessage.success('复制成功');
          })
          .catch(() => {
            const input = document.createElement('input');
            input.setAttribute('value', selectionText);
            document.body.append(input);
            input.select();
            try {
              if (document.execCommand('copy')) {
                ElMessage.success('复制成功');
              }
            } finally {
              input.remove();
            }
          });
      }
    },
  },
  {
    icon: 'quote',
    label: '引用',
    click: () => {
      aiChatBus.emit('chat-input', getSelection());
      clearSelectedText();
    },
  },
]);

const clearSelectedText = () => {
  if (window.getSelection) {
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  }
};

function closeMenu() {
  visibleMenu.value = false;
}

onMounted(() => {
  aiChatBus.on('open-control', openControl);
  document.addEventListener('click', closeMenu);
});

onBeforeUnmount(() => {
  aiChatBus.off('open-control', openControl);
  document.removeEventListener('click', closeMenu);
});
</script>

<template>
  <div v-if="visibleMenu" class="control-menu" :style="menuStyle" @click.stop>
    <div
      v-for="(menu, index) in menus"
      :key="index"
      class="control-menu-item"
      @click="
        menu.click();
        visibleMenu = false;
      "
    >
      {{ menu.label }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
.control-menu {
  position: fixed;
  z-index: 9999;
  min-width: 80px;
  padding: 4px 0;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgb(0 0 0 / 15%);

  &-item {
    padding: 8px 16px;
    font-size: 14px;
    white-space: nowrap;
    cursor: pointer;

    &:hover {
      color: var(--el-color-primary);
      background: #f5f7fa;
    }
  }
}
</style>
