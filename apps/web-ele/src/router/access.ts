import type {
  ComponentRecordType,
  GenerateMenuAndRoutesOptions,
} from '@vben/types';

import { generateAccessible } from '@vben/access';
import { preferences } from '@vben/preferences';

import { ElMessage } from 'element-plus';

import { getAllMenusApi } from '#/api';
import { BasicLayout, IFrameView } from '#/layouts';
import { $t } from '#/locales';
import { base64Encrypt } from '#/utils/other';

const forbiddenComponent = () => import('#/views/_core/fallback/forbidden.vue');

async function generateAccess(options: GenerateMenuAndRoutesOptions) {
  const pageMap: ComponentRecordType = import.meta.glob('../views/**/*.vue');

  const layoutMap: ComponentRecordType = {
    BasicLayout,
    IFrameView,
  };

  return await generateAccessible(preferences.app.accessMode, {
    ...options,
    fetchMenuListAsync: async () => {
      ElMessage({
        duration: 1500,
        message: `${$t('common.loadingMenu')}...`,
      });
      const baRoute = await getAllMenusApi();
      setIFrameComponent(baRoute);
      return baRoute;
    },
    // 可以指定没有权限跳转403页面
    forbiddenComponent,
    // 如果 route.meta.menuVisibleWithForbidden = true
    layoutMap,
    pageMap,
  });
}

/**
 * 递归遍历路由，将 meta.isIframe === true 的路由 component 设置为 IFrameView
 * @param routes 路由数组
 */
function setIFrameComponent(routes: any[]): void {
  for (const route of routes) {
    // 检查 meta.isIframe 是否为 true（注意：原始数据中可能是 null 或 undefined）
    if (route.meta?.isIframe === true) {
      route.component = 'IFrameView';
      route.path = `/iframes/${base64Encrypt(route.path)}`;
    }

    // 递归处理子路由
    if (route.children && route.children.length > 0) {
      delete route?.component;
      setIFrameComponent(route.children);
    }
  }
}

export { generateAccess };
