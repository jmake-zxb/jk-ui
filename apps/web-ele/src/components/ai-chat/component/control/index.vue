<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';

import { ElDropdown, ElDropdownItem, ElDropdownMenu } from 'element-plus';

import { $t } from '#/locales';
import bus from '#/utils/bus';

const isOpen = ref<boolean>(false);
const menuPosition = ref({ x: 0, y: 0 });

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

/**
 * 打开控制台
 * @param event
 */
const openControl = (event: any) => {
  const c = getSelection();
  if (c) {
    menuPosition.value = { x: event.clientX, y: event.clientY };
    if (isOpen.value) {
      clearSelectedText();
      isOpen.value = false;
    } else {
      nextTick(() => {
        isOpen.value = true;
      });
    }
    event.preventDefault();
  } else {
    isOpen.value = false;
  }
};

const menus = ref([
  {
    label: $t('common.copy'),
    click: () => {
      const selectionText = getSelection();
      if (selectionText) {
        clearSelectedText();
        if (
          navigator.clipboard === undefined ||
          navigator.clipboard.writeText === undefined
        ) {
          const input = document.createElement('input');
          input.setAttribute('value', selectionText);
          document.body.append(input);
          input.select();
          try {
            if (document.execCommand('copy')) {
              ElMessage.success($t('common.copySuccess'));
            }
          } finally {
            input.remove();
          }
        } else {
          navigator.clipboard.writeText(selectionText).then(() => {
            ElMessage.success($t('common.copySuccess'));
          });
        }
      }
      isOpen.value = false;
    },
  },
  {
    label: $t('aiChat.quote'),
    click: () => {
      bus.emit('chat-input', getSelection());
      clearSelectedText();
      isOpen.value = false;
    },
  },
]);

/**
 * 清除选中文本
 */
const clearSelectedText = () => {
  if (window.getSelection) {
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  }
};

const handleVisibleChange = (visible: boolean) => {
  if (!visible) {
    isOpen.value = false;
  }
};

onMounted(() => {
  bus.on('open-control', openControl);
});
</script>

<template>
  <ElDropdown
    v-if="isOpen"
    trigger="contextmenu"
    :teleported="false"
    :style="{
      position: 'fixed',
      left: `${menuPosition.x}px`,
      top: `${menuPosition.y}px`,
      zIndex: 9999,
    }"
    @visible-change="handleVisibleChange"
  >
    <span style="display: none"></span>
    <template #dropdown>
      <ElDropdownMenu>
        <ElDropdownItem
          v-for="(menu, index) in menus"
          :key="index"
          @click="menu.click"
        >
          {{ menu.label }}
        </ElDropdownItem>
      </ElDropdownMenu>
    </template>
  </ElDropdown>
</template>

<style lang="scss" scoped>
.el-dropdown {
  pointer-events: none;
}
</style>
