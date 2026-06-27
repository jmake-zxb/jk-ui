// 简化的 store 包装器，用于兼容 MaxKB 的 store 结构
// TODO: 完整集成到 Vben Admin 的 pinia store

import { ref } from 'vue';

export * from './auth';

// 通用 store
const common = {
  isMobile: () => {
    return window.innerWidth <= 768;
  },
};

// 应用 store
const application = ref({
  application: {},
});

// 聊天用户 store
const chatUser = ref({
  user: {},
});

export default function useStore() {
  return {
    application,
    common,
    chatUser,
  };
}
