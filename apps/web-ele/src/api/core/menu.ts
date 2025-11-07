import type { RouteRecordStringComponent } from '@vben/types';

import { requestClient } from '#/api/request';

/**
 * 获取用户所有菜单
 */
export async function getAllMenusApi() {
  return requestClient.get<RouteRecordStringComponent[]>('/admin/menu');
}

export async function pageList(params: any) {
  return requestClient.get<RouteRecordStringComponent[]>('/admin/menu/tree', {
    params,
  });
}

export const info = (id: string) => {
  return requestClient.get(`/admin/menu/${id}`);
};

export const save = (data: object) => {
  return requestClient.post('/admin/menu', data);
};

export const putObj = (data: object) => {
  return requestClient.put('/admin/menu', data);
};

export const addObj = (data: object) => {
  return requestClient.post('/admin/menu', data);
};

export const delObj = (id: string) => {
  return requestClient.delete(`/admin/menu/${id}`);
};

/**
 * 后端控制路由，isRequestRoutes 为 true，则开启后端控制路由
 * @method getAdminMenu 获取后端动态路由菜单(admin)
 */
export function useMenuApi() {
  return {
    getAdminMenu: (params?: object) => {
      return requestClient.get('/admin/menu', { params });
    },
  };
}
