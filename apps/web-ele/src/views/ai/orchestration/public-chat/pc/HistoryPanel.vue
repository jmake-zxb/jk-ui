<script setup lang="ts">
import { inject, ref } from 'vue';

import {
  ChatRound,
  Delete,
  EditPen,
  MoreFilled,
  Share,
} from '@element-plus/icons-vue';
import {
  ElAvatar,
  ElButton,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElIcon,
  ElMenu,
  ElMenuItem,
  ElScrollbar,
  ElSubMenu,
  ElText,
  ElTooltip,
} from 'element-plus';

import InfiniteScroll from '#/components/infinite-scroll/index.vue';

defineProps<{
  applicationDetail: Record<string, any>;
  chatLoading?: boolean;
  chatLogData: Array<Record<string, any>>;
  currentChatId: string;
  isPcCollapse?: boolean;
  leftLoading?: boolean;
  showHistory?: boolean;
}>();
const emit = defineEmits<{
  clearChat: [];
  clickLog: [item: Record<string, any>];
  clickShare: [];
  deleteLog: [row: Record<string, any>];
  editLogTitle: [row: Record<string, any>];
  newChat: [];
}>();
const scrollData = inject('scrollData') as any;
const chatLogPagination = inject('chatLogPagination') as any;
const _chatLogPagination = chatLogPagination?.() || {
  total: 0,
  page_size: 20,
  current_page: 1,
};

const mouseId = ref('');

function isValidUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const _url = new URL(url);
    return Boolean(_url);
  } catch {
    return url.startsWith('/') || url.startsWith('data:');
  }
}

function isAppIcon(icon?: string): boolean {
  return !!icon && isValidUrl(icon);
}

function mouseenter(row: Record<string, any>) {
  mouseId.value = row.id;
}

function shareHandle() {
  emit('clickShare');
}

function newChat() {
  emit('newChat');
}

function handleClickList(item: Record<string, any>) {
  emit('clickLog', item);
}

function deleteChatLog(row: Record<string, any>) {
  emit('deleteLog', row);
}

function clearChat() {
  emit('clearChat');
}

function editLogTitle(row: Record<string, any>) {
  emit('editLogTitle', row);
}
</script>

<template>
  <div class="history-component h-full">
    <ElMenu
      :default-active="currentChatId"
      :collapse="isPcCollapse"
      :collapse-transition="false"
      popper-class="chat-pc-popper"
      class="h-full"
    >
      <div style="padding: 16px 18px 0">
        <div class="align-center mb-16 flex">
          <div class="mr-8 flex">
            <ElAvatar
              v-if="isAppIcon(applicationDetail?.icon)"
              shape="square"
              :size="32"
              style="background: none"
            >
              <img :src="applicationDetail?.icon" alt="" />
            </ElAvatar>
            <ElIcon v-else :size="32">
              <ChatRound />
            </ElIcon>
          </div>
          <h4
            v-show="!isPcCollapse"
            :style="{
              color: applicationDetail?.custom_theme?.header_font_color,
            }"
            class="ellipsis"
            style="max-width: 185px; font-size: 14px"
            :title="applicationDetail?.name"
          >
            {{ applicationDetail?.name }}
          </h4>
        </div>
        <ElButton
          type="primary"
          plain
          v-show="!isPcCollapse"
          class="add-button primary medium w-full"
          @click="newChat"
        >
          <ElIcon><ChatRound /></ElIcon>
          <span class="ml-4">新建对话</span>
        </ElButton>
        <div
          v-show="!isPcCollapse"
          class="flex-between color-secondary mt-8 p-8 pb-0"
          v-if="showHistory"
        >
          <span>历史记录</span>
          <ElTooltip effect="dark" content="清空历史" placement="right">
            <ElButton text @click.stop="clearChat">
              <ElIcon><Delete /></ElIcon>
            </ElButton>
          </ElTooltip>
        </div>
      </div>
      <div v-show="!isPcCollapse" class="left-height" v-if="showHistory">
        <ElScrollbar>
          <InfiniteScroll
            :size="chatLogData.length"
            :total="_chatLogPagination?.total || 0"
            :page-size="_chatLogPagination?.page_size || 20"
            v-model:current_page="_chatLogPagination.current_page"
            @load="scrollData"
            :loading="leftLoading"
          >
            <div class="p-16 pt-0">
              <div
                v-if="leftLoading && chatLogData.length === 0"
                class="p-16 text-center"
              >
                <ElText type="info">加载中...</ElText>
              </div>
              <div
                v-else-if="chatLogData.length === 0"
                class="p-16 text-center"
              >
                <ElText type="info">暂无历史记录</ElText>
              </div>
              <ul v-else class="common-list mt-8" v-loading="leftLoading">
                <li
                  v-for="row in chatLogData"
                  :key="row.id"
                  :class="{ active: currentChatId === row.id }"
                  @click="handleClickList(row)"
                  @mouseenter="mouseenter(row)"
                  @mouseleave="mouseId = ''"
                >
                  <div class="history-item__row">
                    <span
                      :title="row.abstract"
                      class="ellipsis history-item__title"
                    >
                      {{ row.abstract || '新对话' }}
                    </span>
                    <div class="history-item__actions" @click.stop>
                      <ElDropdown trigger="click" :teleported="false">
                        <ElButton text>
                          <ElIcon><MoreFilled /></ElIcon>
                        </ElButton>

                        <template #dropdown>
                          <ElDropdownMenu>
                            <ElDropdownItem
                              @click.stop="shareHandle()"
                              :disabled="
                                currentChatId !== row.id || chatLoading
                              "
                            >
                              <ElIcon><Share /></ElIcon>
                              分享
                            </ElDropdownItem>
                            <ElDropdownItem @click.stop="editLogTitle(row)">
                              <ElIcon><EditPen /></ElIcon>
                              编辑
                            </ElDropdownItem>
                            <ElDropdownItem @click.stop="deleteChatLog(row)">
                              <ElIcon><Delete /></ElIcon>
                              删除
                            </ElDropdownItem>
                          </ElDropdownMenu>
                        </template>
                      </ElDropdown>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </InfiniteScroll>
        </ElScrollbar>
      </div>
      <ElMenuItem index="1" v-show="isPcCollapse" @click="newChat">
        <ElIcon><ChatRound /></ElIcon>
        <template #title>新建对话</template>
      </ElMenuItem>

      <ElSubMenu
        v-show="isPcCollapse"
        index="2"
        v-if="showHistory"
        :teleported="false"
      >
        <template #title>
          <ElIcon><ChatRound /></ElIcon>
        </template>
        <div class="flex-between ml-8 p-8">
          <span>历史记录</span>
          <ElTooltip effect="dark" content="清空历史" placement="right">
            <ElButton text @click.stop="clearChat">
              <ElIcon><Delete /></ElIcon>
            </ElButton>
          </ElTooltip>
        </div>

        <div class="left-height">
          <ElScrollbar>
            <InfiniteScroll
              :size="chatLogData.length"
              :total="_chatLogPagination?.total || 0"
              :page-size="_chatLogPagination?.page_size || 20"
              v-model:current_page="_chatLogPagination.current_page"
              @load="scrollData"
              :loading="leftLoading"
            >
              <div v-loading="leftLoading">
                <ElMenuItem
                  v-for="row in chatLogData"
                  :index="row.id"
                  :key="row.id"
                  @click="handleClickList(row)"
                  @mouseenter="mouseenter(row)"
                  @mouseleave="mouseId = ''"
                >
                  <div class="flex-between lighter w-full">
                    <span :title="row.abstract" class="ellipsis">
                      {{ row.abstract || '新对话' }}
                    </span>
                    <div
                      @click.stop
                      class="flex"
                      v-show="mouseId === row.id && row.id !== 'new'"
                    >
                      <ElDropdown trigger="click" :teleported="false">
                        <ElButton
                          text
                          class="lighter"
                          style="padding: 1px !important"
                        >
                          <ElIcon><MoreFilled /></ElIcon>
                        </ElButton>

                        <template #dropdown>
                          <ElDropdownMenu>
                            <ElDropdownItem @click.stop="editLogTitle(row)">
                              <ElIcon><EditPen /></ElIcon>
                              编辑
                            </ElDropdownItem>
                            <ElDropdownItem @click.stop="deleteChatLog(row)">
                              <ElIcon><Delete /></ElIcon>
                              删除
                            </ElDropdownItem>
                          </ElDropdownMenu>
                        </template>
                      </ElDropdown>
                    </div>
                  </div>
                </ElMenuItem>
              </div>
            </InfiniteScroll>
          </ElScrollbar>
        </div>
        <div v-if="!chatLogData?.length" class="text-center">
          <ElText type="info">暂无历史记录</ElText>
        </div>
      </ElSubMenu>
    </ElMenu>
    <slot></slot>
  </div>
</template>

<style lang="scss" scoped>
.history-component {
  display: flex;
  flex-direction: column;
  background: var(--el-fill-color-lighter) !important;
  border-right: 1px solid var(--el-menu-border-color);

  :deep(.el-menu) {
    background: none;
    border: none;

    &:not(.el-menu--collapse) {
      width: 280px;
    }

    &.el-menu--collapse {
      .el-sub-menu.is-active .el-sub-menu__title {
        color: var(--el-text-color-primary) !important;
      }
    }

    .el-sub-menu__title:hover {
      background-color: var(--el-color-primary-light-9, #ecf5ff) !important;
    }
  }

  .left-height {
    height: calc(100vh - 210px);
  }

  .common-list {
    padding: 0;
    margin: 0;
    list-style: none;

    li {
      display: flex;
      align-items: center;
      padding: 10px 12px;
      margin-bottom: 4px;
      cursor: pointer;
      border-radius: 6px;
      transition: background-color var(--el-transition-duration);

      &:hover {
        background-color: var(--el-color-primary-light-9, #ecf5ff);
      }

      &.active {
        font-weight: 500;
        color: var(--el-text-color-primary);
        background-color: var(--el-bg-color);

        &:hover {
          background-color: var(--el-bg-color);
        }
      }
    }
  }

  .history-item__row {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .history-item__title {
    flex: 1;
    min-width: 0;
    font-size: 13px;
  }

  .history-item__actions {
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .common-list li:hover .history-item__actions {
    opacity: 1;
  }

  .add-button {
    color: var(--el-color-primary, #409eff);
    background-color: var(--el-color-primary-light-9, #ecf5ff);
    border: 1px solid var(--el-color-primary-light-6, #a0cfff);
  }

  .flex-between {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .flex {
    display: flex;
  }

  .align-center {
    align-items: center;
  }

  .mr-8 {
    margin-right: 8px;
  }

  .ml-4 {
    margin-left: 4px;
  }

  .ml-8 {
    margin-left: 8px;
  }

  .p-8 {
    padding: 8px;
  }

  .p-16 {
    padding: 16px;
  }

  .pb-0 {
    padding-bottom: 0;
  }

  .mt-8 {
    margin-top: 8px;
  }

  .mb-16 {
    margin-bottom: 16px;
  }

  .pt-0 {
    padding-top: 0;
  }

  .color-secondary {
    color: var(--el-text-color-secondary);
  }

  .text-center {
    text-align: center;
  }

  .ellipsis {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .h-full {
    height: 100%;
  }

  .w-full {
    width: 100%;
  }

  .cursor {
    cursor: pointer;
  }

  .lighter {
    font-weight: 400;
  }
}

.chat-pc-popper {
  background: var(--el-fill-color-lighter);

  .el-menu {
    background: var(--el-fill-color-lighter) !important;
  }

  .el-menu-item-group__title {
    padding: 8px 8px 8px 16px;
    font-weight: 500;
    color: var(--app-text-color-secondary);
  }

  .el-menu-item {
    height: 40px;
    padding-right: 8px;
    padding-left: 8px;
    margin: 0 8px;
    border-radius: 6px;

    &:hover {
      background-color: rgb(var(--el-text-color-primary-rgb), 0.1);
    }

    &.is-active {
      color: var(--el-text-color-primary);
      background-color: var(--el-bg-color);
    }
  }
}
</style>
