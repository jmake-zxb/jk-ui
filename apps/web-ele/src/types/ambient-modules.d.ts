import 'vue';

declare module 'element-plus/es/components/*/style/css';

declare module 'sortablejs' {
  export interface SortableEvent {
    dragged: HTMLElement;
    item: HTMLElement;
    newIndex?: number;
    oldIndex?: number;
    originalEvent: Event;
    related: HTMLElement;
  }

  export interface SortableOptions {
    [key: string]: any;
    filter?: (event: Event, target: HTMLElement) => boolean;
    onEnd?: (event: SortableEvent) => void;
    onMove?: (event: SortableEvent) => boolean;
    onStart?: (event: SortableEvent) => void;
  }

  class Sortable {
    static create(element: HTMLElement, options?: SortableOptions): Sortable;
    destroy(): void;
  }

  export default Sortable;
  export { Sortable };
}

declare module 'spark-md5' {
  const SparkMD5: any;
  export default SparkMD5;
}

declare module '#/component/FormTable/index.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<object, object, any>;
  export default component;
}

// Vue 类型扩展：v-safe-html 自定义指令
declare module 'vue' {
  interface HTMLAttributes {
    'v-safe-html'?: string;
  }
}
