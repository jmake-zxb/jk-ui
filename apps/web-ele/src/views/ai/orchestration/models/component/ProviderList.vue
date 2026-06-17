<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { FolderOpened } from '@element-plus/icons-vue';
import { ElCollapse, ElCollapseItem, ElIcon, ElScrollbar } from 'element-plus';

import { providerList } from '#/components/dynamics-form/items/model/provider-data';

import { allProviderObj, localProviderCodes, sharedProviderObj } from '../data';

interface Provider {
  icon?: string;
  name: string;
  provider: string;
}

const props = defineProps<{
  active?: Provider;
  data: Array<Provider>;
  loading: boolean;
  showShared: boolean;
}>();

const emit = defineEmits<{
  click: [item: Provider];
}>();

const onlineProviderList = ref<Array<Provider>>([]);
const localProviderList = ref<Array<Provider>>([]);

/**
 * Lookup provider icon SVG string.
 * Priority: item.icon > provider-data.ts providerList > empty string.
 */
function getProviderIcon(item: Provider): string {
  // 优先使用 provider-data.ts 中的真实 SVG 图标
  const fromData = providerList.find((p) => p.provider === item.provider);
  if (fromData?.icon) return fromData.icon;
  // 后端返回的 icon 若是 SVG（以 < 开头），直接使用
  if (item.icon && item.icon.trim().startsWith('<')) return item.icon;
  return '';
}

function isLocalProvider(providerCode: string): boolean {
  return localProviderCodes.includes(providerCode);
}

function splitProviders(list: Array<Provider>) {
  const online: Array<Provider> = [];
  const local: Array<Provider> = [];
  list
    .filter((v) => v.provider)
    .forEach((item) => {
      if (isLocalProvider(item.provider)) {
        local.push(item);
      } else {
        online.push(item);
      }
    });
  online.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  local.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  return { local, online };
}

watch(
  () => props.data,
  (list) => {
    const { local, online } = splitProviders(list);
    onlineProviderList.value = online;
    localProviderList.value = local;
  },
  { immediate: true, deep: true },
);

const isAllActive = computed(() => !props.active?.provider);
const isSharedActive = computed(() => props.active?.provider === 'share');

function handleClick(item: Provider) {
  emit('click', item);
}

function handleSharedClick() {
  emit('click', {
    provider: sharedProviderObj.provider,
    name: sharedProviderObj.name,
    icon: '',
  });
}

function handleAllClick() {
  emit('click', {
    provider: allProviderObj.provider,
    name: allProviderObj.name,
    icon: '',
  });
}

function isItemActive(item: Provider): boolean {
  return props.active?.provider === item.provider;
}
</script>

<template>
  <div class="provider-list">
    <ElScrollbar>
      <div class="provider-inner">
        <!-- Shared model entry -->
        <div v-if="showShared" class="border-entry">
          <div
            class="entry-item shared-entry"
            :class="{ active: isSharedActive }"
            @click="handleSharedClick"
          >
            <ElIcon class="entry-icon color-primary" :size="18">
              <FolderOpened />
            </ElIcon>
            <span class="entry-label">{{ sharedProviderObj.name }}</span>
          </div>
        </div>

        <!-- All providers entry -->
        <div
          class="entry-item all-entry"
          :class="{ 'all-entry-active': isAllActive }"
          @click="handleAllClick"
        >
          <ElIcon class="entry-icon color-primary" :size="20">
            <FolderOpened />
          </ElIcon>
          <span class="entry-label">{{ allProviderObj.name }}</span>
        </div>

        <ElCollapse class="provider-collapse" expand-icon-position="left">
          <ElCollapseItem name="public">
            <template #title>
              <div class="collapse-title">
                <ElIcon :size="20"><FolderOpened /></ElIcon>
                <span class="collapse-label">公共模型</span>
              </div>
            </template>
            <ul v-loading="loading" class="provider-group">
              <li
                v-for="item in onlineProviderList"
                :key="item.provider"
                class="provider-item"
                :class="{ active: isItemActive(item) }"
                :title="item.name"
                @click="handleClick(item)"
              >
                <span
                  class="provider-icon"
                  v-safe-html="getProviderIcon(item)"
                ></span>
                <span class="provider-name ellipsis">{{ item.name }}</span>
              </li>
              <li
                v-if="!loading && onlineProviderList.length === 0"
                class="empty-hint"
              >
                暂无供应商
              </li>
            </ul>
          </ElCollapseItem>

          <ElCollapseItem name="private">
            <template #title>
              <div class="collapse-title">
                <ElIcon :size="20"><FolderOpened /></ElIcon>
                <span class="collapse-label">私有模型</span>
              </div>
            </template>
            <ul v-loading="loading" class="provider-group">
              <li
                v-for="item in localProviderList"
                :key="item.provider"
                class="provider-item"
                :class="{ active: isItemActive(item) }"
                :title="item.name"
                @click="handleClick(item)"
              >
                <span
                  class="provider-icon"
                  v-safe-html="getProviderIcon(item)"
                ></span>
                <span class="provider-name ellipsis">{{ item.name }}</span>
              </li>
              <li
                v-if="!loading && localProviderList.length === 0"
                class="empty-hint"
              >
                暂无供应商
              </li>
            </ul>
          </ElCollapseItem>
        </ElCollapse>
      </div>
    </ElScrollbar>
  </div>
</template>

<style lang="scss" scoped>
.provider-list {
  height: 100%;

  .provider-inner {
    padding: 8px;
  }

  .border-entry {
    padding-bottom: 4px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .entry-item {
    display: flex;
    align-items: center;
    padding: 10px 8px;
    font-size: 14px;
    font-weight: 400;
    cursor: pointer;
    border-radius: var(--el-border-radius-small);
    transition: background 0.2s;

    &:hover {
      background: var(--el-fill-color-light);
    }

    .entry-icon {
      flex-shrink: 0;
      margin-right: 8px;
    }

    .entry-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .shared-entry.active {
    font-weight: 500;
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);

    &:hover {
      background: var(--el-color-primary-light-9);
    }
  }

  .all-entry {
    margin-bottom: 4px;
  }

  .all-entry-active {
    font-weight: 500;
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);

    &:hover {
      background: var(--el-color-primary-light-9);
    }
  }

  .provider-collapse {
    border-top: none !important;
    border-bottom: none !important;

    :deep(.el-collapse-item__header) {
      height: 40px;
      padding-left: 8px;
      font-size: 14px;
      font-weight: 400;
      background: none;
      border-bottom: none !important;

      &:hover {
        background: var(--el-fill-color-light);
        border-radius: var(--el-border-radius-small);
      }
    }

    :deep(.el-collapse-item) {
      margin-top: 2px;
    }

    :deep(.el-collapse-item__wrap) {
      background: none !important;
      border-bottom: none !important;
    }

    :deep(.el-collapse-item__content) {
      padding-bottom: 0 !important;
    }
  }

  .collapse-title {
    display: flex;
    align-items: center;
  }

  .collapse-label {
    margin-left: 8px;
  }

  .provider-group {
    min-height: 32px;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .provider-item {
    display: flex;
    align-items: center;
    padding: 8px 8px 8px 36px;
    cursor: pointer;
    border-radius: var(--el-border-radius-small);
    transition: background 0.2s;

    &:hover {
      background: var(--el-fill-color-light);
    }

    &.active {
      font-weight: 500;
      color: var(--el-color-primary);
      background: var(--el-color-primary-light-9);
    }

    .provider-icon {
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      margin-right: 8px;

      :deep(svg) {
        width: 100%;
        height: 100%;
      }
    }

    .provider-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .empty-hint {
    padding: 8px 36px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .ellipsis {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .color-primary {
    color: var(--el-color-primary);
  }
}
</style>
