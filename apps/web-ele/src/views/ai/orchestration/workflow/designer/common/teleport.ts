import type { BaseEdgeModel, BaseNodeModel, GraphModel } from '@logicflow/core';

import { defineComponent, Fragment, h, markRaw, reactive, Teleport } from 'vue';

let active = false;
const items = reactive<Record<string, any>>({});

export function connect(
  id: string,
  component: any,
  container: HTMLDivElement,
  node: BaseEdgeModel | BaseNodeModel,
  graph: GraphModel,
  get_props?: (node: BaseEdgeModel | BaseNodeModel, graph: GraphModel) => any,
  get_provide?: (node: BaseEdgeModel | BaseNodeModel, graph: GraphModel) => any,
) {
  const resolveProps =
    get_props ||
    ((n: BaseEdgeModel | BaseNodeModel, g: GraphModel) => {
      return { nodeModel: n, graph: g };
    });
  const resolveProvide =
    get_provide ||
    ((n: BaseEdgeModel | BaseNodeModel, g: GraphModel) => ({
      getNode: () => n,
      getGraph: () => g,
    }));
  if (active) {
    items[id] = markRaw(
      defineComponent({
        provide: () => resolveProvide(node, graph),
        render: () =>
          h(Teleport as any, { to: container }, [
            h(component, resolveProps(node, graph)),
          ]),
      }),
    );
  }
}

export function disconnect(id: string) {
  if (active) {
    Reflect.deleteProperty(items, id);
  }
}

export function disconnectByFlow(flowId: string) {
  Object.keys(items).forEach((key) => {
    if (key.startsWith(flowId)) {
      Reflect.deleteProperty(items, key);
    }
  });
}

export function disconnectAll() {
  Object.keys(items).forEach((key) => {
    Reflect.deleteProperty(items, key);
  });
}

export function isActive() {
  return active;
}

export function getTeleport(): any {
  active = true;

  return defineComponent({
    props: {
      flowId: {
        type: String,
        required: true,
      },
    },
    setup() {
      return () => {
        const children: any[] = [];
        Object.keys(items).forEach((id) => {
          children.push(items[id]);
        });
        return h(
          Fragment,
          {},
          children.map((item) => h(item)),
        );
      };
    },
  });
}
