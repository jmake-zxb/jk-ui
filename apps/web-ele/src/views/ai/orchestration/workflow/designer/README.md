# Workflow Designer LogicFlow Node Contract

This document defines the project-level contract for the AI orchestration workflow designer. Use it together with MaxKB source files and the LogicFlow official docs when migrating or fixing workflow nodes.

## Official LogicFlow References

Check these before changing shared graph behavior:

- Constructor and graph APIs: https://07.logic-flow.cn/api/logicFlowApi.html#constructor
- Event model and node events: https://07.logic-flow.cn/guide/advance/event.html#%E8%8A%82%E7%82%B9%E4%BA%8B%E4%BB%B6
- Custom node lifecycle and model/view split: https://07.logic-flow.cn/guide/advance/customNode.html

Do not paste large LogicFlow documentation into project files. Keep this README focused on how this project integrates LogicFlow.

## Key Files

- `WorkflowDesigner.vue`: owns graph creation, loading, saving, validation, and designer-level events.
- `common/app-node.ts`: shared `AppNode` / `AppNodeModel` implementation for most workflow nodes.
- `common/NodeContainer.vue`: shared node card shell, measurement, selection, collapse, and add-node menu behavior.
- `register.ts`: registers LogicFlow node types.
- `nodes.ts`: node palette templates and default node data.
- `LoopBodyCanvasPanel.vue`: nested LogicFlow panel for loop body editing.

## Model Ownership

LogicFlow owns node position and graph topology: `x`, `y`, `width`, `height`, anchors, edges, and connected-edge refresh. Vue node components may render and edit node properties, but they must not compensate for LogicFlow geometry by writing DOM coordinates.

`AppNode` embeds each Vue node component with `createApp`. Because LogicFlow can replace the node model object during graph render/reload operations, the embedded Vue app must track the current `props.model` and `props.graphModel`. Do not close over the first model passed to `setHtml()`.

Shared wrappers should keep shallow current-model state for Vue `render` and `provide`, then synchronize it when LogicFlow view props change. Do not deep-proxy LogicFlow model objects.

## Vue Bridge Methods

Some Vue components expose imperative methods by assigning functions to `nodeModel`, usually in `onMounted()` or with `set(props.nodeModel, key, fn)`. If the LogicFlow model is replaced while the Vue app is reused, those function bridges must move to the live model.

Known bridge methods include:

- `validate`
- `set_loop_body`
- `refresh_loop_fields`
- `loopLayout`
- `getSelectNodes`
- `clearSelectElements`
- NodeContainer callbacks such as `queueNodeResize`, `selectOn`, `focusOn`, `clearSelectOn`, `openNodeMenu`, `setCollapsed`, and `shouldKeepHovered`

When adding a new `nodeModel` function bridge, update `AppNode.MODEL_CALLBACK_KEYS` in `common/app-node.ts` and verify the method exists on the current graph model after reload.

## Dynamic Height and Anchors

Dynamic node height must flow through the model layer:

1. Vue content changes.
2. `NodeContainer` measures content height.
3. The model updates size through `syncNodeSize()` / `setHeight()` / LogicFlow resize APIs.
4. The model refreshes anchors and connected edge paths.
5. Vue re-renders from the current model.

Anchor positions must come from model data: `x`, `y`, `width`, `height`, and `getAnchorY()`. Custom `getDefaultAnchor()` implementations must use `this.getAnchorY()` for collapsed-state main anchors instead of hardcoded node-local offsets.

Do not write `foreignObject` `x` or `y` from Vue, observers, or measurement code. If a wrapper must sync SVG `foreignObject` geometry, sync only `width` and `height`. LogicFlow remains responsible for node position.

## Data and Events

Persisted workflow data belongs under LogicFlow graph JSON, mostly `properties.node_data` and related `properties` fields. After changing persisted data from Vue, notify the designer with `node:inline-update` or `nodeModel.updateWorkflowProperties(...)` so graph data, selected-node state, output fields, and downstream references stay current.

Use `refreshVueComponent?.()` for structural or geometry changes that require node/anchor re-rendering, such as branch add/remove/reorder, exception-anchor toggles, collapse changes, or dynamic height changes. Do not call it on every text/select/cascader edit.

For dynamic nested Element Plus forms, bind `ElForm :model` to a Vue-reactive local model first, then clone-sync into `nodeModel.properties.node_data`. LogicFlow properties are not Vue reactive form state.

## Runtime Validation

Static checks are not enough for LogicFlow/Vue lifecycle bugs. For shared node changes, validate in the browser:

- The Vue component's `nodeModel` is the same live object used by `graphModel.nodes` / node model lookup.
- Dynamic height changes update model `height` and anchors on first paint, not only after a second interaction.
- Main output anchors remain vertically centered where appropriate; branch anchors track branch rows.
- Dragging works after height changes and does not snap, jump, or fight manual DOM coordinate writes.
- `condition-node` and the loop node family still render, validate, collapse/expand, and keep their anchors/edges correct.

Also run the focused frontend validation from `jk-ui/`:

```bash
pnpm -F @vben/web-ele typecheck
```

Run broader build or browser checks when the changed area affects runtime behavior, shared node infrastructure, or migrated node registration.
