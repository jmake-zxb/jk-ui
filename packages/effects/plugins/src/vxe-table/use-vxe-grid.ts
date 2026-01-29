import type { VxeGridSlotTypes } from 'vxe-table';

import type {
  AllowedComponentProps,
  ComponentCustomProps,
  VNodeProps,
} from 'vue';

import type { BaseFormComponentType } from '@vben-core/form-ui';

// 注意：不要从 'vxe-table' 导入 VxeGridProps，否则会冲突
// 我们只使用本地扩展过的 VxeGridProps (包含 T 和 D)
import type { ExtendedVxeGridApi, VxeGridProps } from './types';

import { defineComponent, h, onBeforeUnmount } from 'vue';

import { useStore } from '@vben-core/shared/store';

import { VxeGridApi } from './api';
import VxeGrid from './use-vxe-grid.vue';

// -------------------------------------------------------------------
// 1. 插槽定义
// -------------------------------------------------------------------
type VbenGridSlots<T> = {
  [key: string]: VxeGridSlotTypes.DefaultSlotParams<T>;
  'table-title': any;
  'toolbar-actions': VxeGridSlotTypes.DefaultSlotParams<T>;
  'toolbar-tools': VxeGridSlotTypes.DefaultSlotParams<T>;
};

// -------------------------------------------------------------------
// 2. 组件类型声明 (外部欺骗层)
// -------------------------------------------------------------------
export interface VbenGridComponent<T> {
  new (): {
    // 关键修复点：
    // 这里的 VxeGridProps 来自 './types'，它需要 <T, D>。
    // 我们传入 <any, any> 来彻底切断 TypeScript 的递归检查 (Fix TS 2589)。
    $props: AllowedComponentProps &
      ComponentCustomProps &
      VNodeProps &
      VxeGridProps<any, any>;

    // 插槽保留 T，提供智能提示
    $slots: VbenGridSlots<T>;
  };
}

// -------------------------------------------------------------------
// 3. 返回值类型
// -------------------------------------------------------------------
export type UseVbenVxeGridReturn<
  T extends Record<string, any>,
  D extends BaseFormComponentType,
> = readonly [VbenGridComponent<T>, ExtendedVxeGridApi<T, D>];

// -------------------------------------------------------------------
// 4. Hook 实现
// -------------------------------------------------------------------
export function useVbenVxeGrid<
  T extends Record<string, any> = any,
  D extends BaseFormComponentType = BaseFormComponentType,
>(
  // 这里必须使用 <T, D>，因为 VxeGridApi 需要完整的配置信息
  // 如果这里报错 TS(2707)，请确认 ./types 文件中的 VxeGridProps 是否真的定义了两个泛型
  options: VxeGridProps<T, D>,
): UseVbenVxeGridReturn<T, D> {
  const api = new VxeGridApi(options);
  const extendedApi: ExtendedVxeGridApi<T, D> = api as ExtendedVxeGridApi<T, D>;

  extendedApi.useStore = (selector) => {
    return useStore(api.store, selector);
  };

  // 内部实现：降级为 any，防止编译死锁
  const GridImpl = defineComponent(
    (props: any, { attrs, slots }) => {
      onBeforeUnmount(() => {
        api.unmount();
      });
      // 内部不做类型检查，直接透传
      api.setState({ ...props, ...attrs });
      return () => h(VxeGrid, { ...props, ...attrs, api: extendedApi }, slots);
    },
    {
      name: 'VbenVxeGrid',
      inheritAttrs: false,
      props: [] as any,
      slots: Object as any,
    },
  );

  // 强制断言为 VbenGridComponent<T>
  const Grid = GridImpl as unknown as VbenGridComponent<T>;

  return [Grid, extendedApi];
}

export type UseVbenVxeGrid = typeof useVbenVxeGrid;
