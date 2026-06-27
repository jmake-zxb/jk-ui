// 简化版 shared-api，提供基本的动态 API 加载功能
// TODO: 完整迁移所有 API 模块

interface LoadSharedApiOptions {
  type: string;
  systemType: string;
}

// 创建一个占位 API 对象
const createPlaceholderApi = () => ({
  getSelectModelList: async (_params?: any) => {
    console.warn(
      'shared-api placeholder: getSelectModelList not fully implemented',
    );
    return { data: [] };
  },
});

export function loadSharedApi(_options: LoadSharedApiOptions) {
  // 返回占位 API
  return createPlaceholderApi();
}

export default {
  loadSharedApi,
};
