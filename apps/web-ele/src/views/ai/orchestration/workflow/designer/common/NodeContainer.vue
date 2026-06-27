<script setup lang="ts">
import type { PaletteMode } from '../nodes';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  ref,
  watch,
} from 'vue';

import { ArrowDownBold, MoreFilled, Search } from '@element-plus/icons-vue';
import {
  ElAlert,
  ElButton,
  ElCollapseTransition,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElIcon,
  ElInput,
  ElMessageBox,
  ElPopover,
  ElScrollbar,
  ElSwitch,
  ElTabPane,
  ElTabs,
  ElTag,
} from 'element-plus';

import { WorkflowType } from '#/enums/application';

import {
  defaultProperties,
  groupedNodeTemplates,
  isProtectedWorkflowActionNode,
  isWorkflowSingletonNode,
  nodeMeta,
  outputFields,
} from '../nodes';

const props = defineProps<{
  nodeModel: any;
  renderVersion?: number;
}>();

function getNodeModel() {
  return props.nodeModel;
}

const showNode = ref(props.nodeModel.properties?.showNode !== false);
const titleVersion = ref(0);
const isSelected = ref(!!props.nodeModel.isSelected);
const runtimeStatus = computed(() => {
  void props.renderVersion;
  return `${props.nodeModel.runtimeStatus || ''}`.toUpperCase();
});

// Sync isSelected and isHovered from model when LogicFlow triggers re-render
watch(
  () => props.renderVersion,
  () => {
    isSelected.value = !!props.nodeModel.isSelected;
    isNodeHovered.value = !!props.nodeModel.isHovered;
  },
);

const disabled = computed({
  get: () =>
    !isProtectedWorkflowActionNode(props.nodeModel.type) &&
    !!props.nodeModel.properties?.disabled,
  set: (value: boolean) => {
    if (isProtectedWorkflowActionNode(props.nodeModel.type)) return;
    updateProperties({ disabled: value }, ['disabled']);
  },
});

const enableException = computed({
  get: () => {
    void props.renderVersion; // reactivity trigger for deep property changes
    return !!props.nodeModel.properties?.enableException;
  },
  set: (value: boolean) => {
    updateProperties({ enableException: value }, ['enableException']);
    nextTick(() => props.nodeModel.refreshConnectedEdges?.());
  },
});

const meta = computed(() => nodeMeta(props.nodeModel.type));
const fields = computed(() => {
  void props.renderVersion; // reactivity trigger for deep property changes
  return outputFields(props.nodeModel.properties);
});
const exceptionNodeTypes = new Set([
  'ai-chat-node',
  'image-generate-node',
  'image-understand-node',
  'video-understand-node',
]);
const hideOutputSection = computed(() => props.nodeModel.type === 'base-node');
const showExceptionSwitch = computed(() =>
  exceptionNodeTypes.has(props.nodeModel.type),
);
const nodeWidth = computed(
  () =>
    `${Number(props.nodeModel.width || props.nodeModel.properties?.width || 340)}px`,
);
const nodeMenuTabs = [
  { categories: ['业务逻辑'], label: '基础组件', name: 'base' },
  { categories: ['AI能力'], label: 'AI能力', name: 'ai' },
  { categories: ['知识库'], label: '知识库', name: 'knowledge' },
  { categories: ['工具/其他'], label: '工具应用', name: 'tool' },
  { categories: ['数据处理', '数据源'], label: '数据处理', name: 'data' },
];
const activeMenuTab = ref('base');
const isProtectedNode = computed(() =>
  isProtectedWorkflowActionNode(props.nodeModel.type),
);
const paletteMode = computed<PaletteMode>(() => {
  void props.renderVersion;
  const mode = props.nodeModel.graphModel?.paletteMode;
  if (
    mode === 'application-loop' ||
    mode === 'knowledge-loop' ||
    mode === 'knowledge' ||
    mode === 'tool'
  )
    return mode;
  return 'application';
});
const menuGroups = computed(() =>
  groupedNodeTemplates(paletteMode.value)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !isWorkflowSingletonNode(item.type)),
    }))
    .filter((group) => group.items.length > 0),
);
const tabbedMenuGroups = computed(() => {
  const keyword = menuSearchKeyword.value.trim().toLowerCase();
  return nodeMenuTabs.map((tab) => {
    const groups = menuGroups.value
      .filter((group) => tab.categories.includes(group.name))
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (!keyword) return true;
          return `${item.name} ${item.type} ${item.description}`
            .toLowerCase()
            .includes(keyword);
        }),
      }))
      .filter((group) => group.items.length > 0);
    return { ...tab, groups };
  });
});
const activeMenuGroups = computed(
  () =>
    tabbedMenuGroups.value.find((tab) => tab.name === activeMenuTab.value)
      ?.groups || [],
);
const measureRef = ref<HTMLElement>();
const searchKeyword = ref('');
const menuSearchKeyword = ref('');
const searchFocused = ref(false);
const isNodeHovered = ref(!!props.nodeModel.isHovered);
const isPointerInsideNode = ref(false);
let resizeObserver: ResizeObserver | undefined;
let hoverReleaseFrame = 0;
let lastMeasuredHeight = 0;
let resizeDebounceTimer = 0;

const INLINE_POPPER_SELECTOR = [
  '.el-popper',
  '.el-select__popper',
  '.el-cascader__dropdown',
  '.el-dropdown__popper',
  '.el-popper__arrow',
].join(',');

const activeAnchorData = ref<any>();
const showAddMenu = computed(() => !!activeAnchorData.value);
const isNodeHoverActive = computed(() => {
  void props.renderVersion; // re-evaluate when LogicFlow triggers refresh
  return (
    isNodeHovered.value || !!props.nodeModel.isHovered || showAddMenu.value
  );
});
const anchorMenuStyle = computed(() => ({
  top: activeAnchorData.value
    ? `${Number(activeAnchorData.value.y) - Number(props.nodeModel.y) + Number(props.nodeModel.height) / 2}px`
    : '0px',
}));

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ai: 'AI',
    data: '数据',
    input: '输入',
    logic: '逻辑',
    output: '输出',
    resource: '资源',
    tool: '工具',
  };
  return labels[status] || status;
}

function statusTagType(status: string) {
  const types: Record<
    string,
    'danger' | 'info' | 'primary' | 'success' | 'warning'
  > = {
    ai: 'info',
    data: 'success',
    input: 'success',
    logic: 'primary',
    output: 'warning',
    resource: 'warning',
    tool: 'primary',
  };
  return types[status] || 'info';
}

function runtimeStatusLabel(status: string) {
  const labels: Record<string, string> = {
    FAILED: '失败',
    RUNNING: '运行中',
    SUCCESS: '成功',
    WARNING: '中断',
  };
  return labels[status] || status;
}

function runtimeStatusTagType(status: string) {
  const types: Record<
    string,
    'danger' | 'info' | 'primary' | 'success' | 'warning'
  > = {
    FAILED: 'danger',
    RUNNING: 'primary',
    SUCCESS: 'success',
    WARNING: 'warning',
  };
  return types[status] || 'info';
}

function updateProperties(patch: Record<string, any>, fields: string[]) {
  const nodeModel = getNodeModel();
  if (typeof nodeModel.updateWorkflowProperties === 'function') {
    nodeModel.updateWorkflowProperties(patch, fields);
  } else {
    if (!nodeModel.properties) nodeModel.properties = {};
    Object.assign(nodeModel.properties, patch);
    nodeModel.refreshVueComponent?.();
    nodeModel.graphModel?.eventCenter?.emit?.('node:inline-update', {
      fields,
      id: nodeModel.id,
      properties: nodeModel.properties,
      source: 'vue-node',
    });
  }
}

function currentTitle() {
  void titleVersion.value;
  void props.renderVersion;
  return `${props.nodeModel.properties?.stepName || props.nodeModel.properties?.name || nodeMeta(props.nodeModel.type).name}`;
}

function hasDuplicateStepName(name: string) {
  return props.nodeModel.graphModel?.nodes
    ?.filter((node: any) => node.id !== props.nodeModel.id)
    .some(
      (node: any) =>
        `${node.properties?.stepName || node.properties?.name || ''}`.trim() ===
        name,
    );
}

function setShowNode(value: boolean) {
  showNode.value = value;
  updateProperties({ showNode: value }, ['showNode']);
}

function measuredHeightWithoutInlinePoppers(element: HTMLElement) {
  const poppers = [
    ...element.querySelectorAll<HTMLElement>(INLINE_POPPER_SELECTOR),
  ];
  const displays = poppers.map((popper) => popper.style.display);
  try {
    poppers.forEach((popper) => {
      popper.style.display = 'none';
    });
    return element.getBoundingClientRect().height || element.offsetHeight;
  } finally {
    poppers.forEach((popper, index) => {
      popper.style.display = displays[index] || '';
    });
  }
}

function resizeNode(element?: HTMLElement) {
  if (!element) return;
  const card =
    element.querySelector<HTMLElement>('.workflow-vue-node__card') ||
    element.closest<HTMLElement>('.workflow-vue-node__card');
  const measureTarget = card || element;
  const height = measuredHeightWithoutInlinePoppers(measureTarget);
  const normalizedHeight = Math.round(height);
  if (normalizedHeight && normalizedHeight !== lastMeasuredHeight) {
    lastMeasuredHeight = normalizedHeight;
    props.nodeModel.setHeight?.(normalizedHeight);
  }
}

function queueNodeResize() {
  clearTimeout(resizeDebounceTimer);
  resizeDebounceTimer = window.setTimeout(() => {
    resizeNode(measureRef.value);
  }, 100);
}

function copyNode() {
  if (isProtectedNode.value) return;
  const clone = props.nodeModel.graphModel?.cloneNode?.(props.nodeModel.id);
  if (clone) props.nodeModel.graphModel?.toFront?.(clone.id);
}

async function renameNode() {
  if (isProtectedNode.value) return;
  try {
    const { value } = await ElMessageBox.prompt('请输入节点名称', '重命名', {
      cancelButtonText: '取消',
      confirmButtonText: '确定',
      inputValue: currentTitle(),
      inputValidator: (value) => {
        const name = `${value}`.trim();
        if (!name) return '节点名称不能为空';
        if (hasDuplicateStepName(name)) return '节点名称已存在';
        return true;
      },
    });
    const name = `${value}`.trim();
    const nodeModel = getNodeModel();
    if (!nodeModel.properties) nodeModel.properties = {};
    nodeModel.properties.stepName = name;
    nodeModel.properties.name = name;
    if (nodeModel.text) nodeModel.text.value = '';
    nodeModel.clear_next_node_field?.(true);
    titleVersion.value += 1;
    nodeModel.refreshVueComponent?.();
    nodeModel.graphModel?.eventCenter?.emit?.('node:inline-update', {
      fields: ['stepName', 'name'],
      id: nodeModel.id,
      properties: nodeModel.properties,
      source: 'vue-node',
    });
    queueNodeResize();
  } catch {}
}

async function deleteNode() {
  if (isProtectedNode.value) return;
  try {
    await ElMessageBox.confirm(
      `确认删除节点「${currentTitle()}」？`,
      '删除节点',
      {
        cancelButtonText: '取消',
        confirmButtonText: '删除',
        type: 'warning',
      },
    );
  } catch {
    return;
  }
  // Cascade-delete loop-body-node before deleting loop-node (matches MaxKB pattern)
  if (props.nodeModel.type === WorkflowType.LoopNode) {
    const outgoing = props.nodeModel.graphModel?.getNodeOutgoingNode?.(
      props.nodeModel.id,
    );
    outgoing?.forEach?.((n: any) => {
      if (n.type === WorkflowType.LoopBodyNode) {
        props.nodeModel.graphModel?.deleteNode?.(n.id);
      }
    });
  }
  props.nodeModel.graphModel?.deleteNode?.(props.nodeModel.id);
  props.nodeModel.graphModel?.eventCenter?.emit?.('node:inline-update', {
    fields: ['delete'],
    id: props.nodeModel.id,
    source: 'vue-node',
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function highlightedTitle(value: string) {
  const keyword = searchKeyword.value.trim();
  if (!keyword) return escapeHtml(value);
  const lowerValue = value.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  let offset = 0;
  let result = '';
  while (offset < value.length) {
    const index = lowerValue.indexOf(lowerKeyword, offset);
    if (index === -1) {
      result += escapeHtml(value.slice(offset));
      break;
    }
    result += escapeHtml(value.slice(offset, index));
    result += `<span class="workflow-vue-node__highlight${searchFocused.value ? ' is-current' : ''}">${escapeHtml(value.slice(index, index + keyword.length))}</span>`;
    offset = index + keyword.length;
  }
  return result;
}

function selectOn(keyword: string) {
  searchKeyword.value = keyword;
  searchFocused.value = false;
}

function focusOn(keyword: string) {
  searchKeyword.value = keyword;
  searchFocused.value = true;
  props.nodeModel.setSelected?.(true);
}

function clearSelectOn() {
  searchKeyword.value = '';
  searchFocused.value = false;
}

function isLoopChildConnection(sourceAnchorId?: string, targetType?: string) {
  return (
    sourceAnchorId?.endsWith('_children') ||
    (props.nodeModel.type === 'loop-node' && targetType === 'loop-body-node')
  );
}

function keepNodeHoverActive() {
  return isPointerInsideNode.value || showAddMenu.value;
}

function setModelHovered(value: boolean) {
  isNodeHovered.value = value;
  props.nodeModel.setHovered?.(value);
}

function scheduleHoverRelease() {
  cancelAnimationFrame(hoverReleaseFrame);
  hoverReleaseFrame = requestAnimationFrame(() => {
    if (!keepNodeHoverActive()) setModelHovered(false);
  });
}

function openNodeMenu(anchorData: any) {
  const closing = activeAnchorData.value?.id === anchorData?.id;
  activeAnchorData.value = closing ? undefined : anchorData;
  if (closing) {
    scheduleHoverRelease();
    return;
  }
  cancelAnimationFrame(hoverReleaseFrame);
  setModelHovered(true);
}

function addNextNode(item: any) {
  if (isWorkflowSingletonNode(item?.type)) {
    activeAnchorData.value = undefined;
    menuSearchKeyword.value = '';
    scheduleHoverRelease();
    return;
  }
  const properties = defaultProperties(item.type, item.name);
  const width = Number(properties.width || 340);
  const sourceAnchor = activeAnchorData.value;
  if (!sourceAnchor) return;
  const node = props.nodeModel.graphModel?.addNode?.({
    id: isWorkflowSingletonNode(item.type)
      ? item.type
      : `${item.type}_${Date.now()}`,
    properties,
    type: item.type,
    x: Number(sourceAnchor.x) + width / 2 + 160,
    y: Number(sourceAnchor.y),
  });
  if (node) {
    const targetAnchor = node
      .getDefaultAnchor?.()
      .find((anchor: any) =>
        item.type === 'loop-body-node'
          ? anchor.id === `${node.id}_children` || anchor.type === 'children'
          : anchor.type === 'left' || anchor.id === `${node.id}_left`,
      );
    if (!targetAnchor) return;
    const edgeType = isLoopChildConnection(sourceAnchor.id, item.type)
      ? 'loop-edge'
      : 'app-edge';
    props.nodeModel.graphModel?.addEdge?.({
      id: `edge_${props.nodeModel.id}_${node.id}_${Date.now()}`,
      sourceAnchorId: sourceAnchor.id,
      sourceNodeId: props.nodeModel.id,
      targetAnchorId: targetAnchor.id,
      targetNodeId: node.id,
      properties: {
        sourceAnchorId: sourceAnchor.id,
        targetAnchorId: targetAnchor.id,
      },
      type: edgeType,
    });
  }
  activeAnchorData.value = undefined;
  menuSearchKeyword.value = '';
  scheduleHoverRelease();
  props.nodeModel.graphModel?.eventCenter?.emit?.('node:inline-update', {
    fields: ['add-next'],
    id: props.nodeModel.id,
    source: 'vue-node',
  });
}

function copyField(field: any) {
  const text = `{{${currentTitle()}.${outputFieldValue(field)}}}`;
  navigator.clipboard?.writeText(text);
}

function outputFieldValue(field: any) {
  return `${field?.value || field?.name || ''}`;
}

function outputFieldReference(field: any) {
  return `{${outputFieldValue(field)}}`;
}

function stopCanvas(event: Event) {
  event.stopPropagation();
}

function selectNode(event: MouseEvent) {
  if (!event.shiftKey) {
    // Notify all other nodes to refresh their selected state
    props.nodeModel.graphModel?.nodes?.forEach((node: any) => {
      if (node.id !== props.nodeModel.id) {
        node.isSelected = false;
        node.refreshVueComponent?.();
      }
    });
    props.nodeModel.graphModel?.clearSelectElements?.();
  }
  const nodeModel = getNodeModel();
  nodeModel.isSelected = true;
  isSelected.value = true;
  nodeModel.graphModel?.toFront?.(nodeModel.id);
}

onMounted(() => {
  const nodeModel = getNodeModel();
  nodeModel.ensureWorkflowProperties?.();
  nodeModel.queueNodeResize = queueNodeResize;
  nodeModel.selectOn = selectOn;
  nodeModel.focusOn = focusOn;
  nodeModel.clearSelectOn = clearSelectOn;
  nodeModel.openNodeMenu = openNodeMenu;
  nodeModel.shouldKeepHovered = keepNodeHoverActive;
  nodeModel.setCollapsed = (collapsed: boolean) => setShowNode(!collapsed);
  if (measureRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => queueNodeResize());
    resizeObserver.observe(measureRef.value);
  }
  queueNodeResize();
});

onUpdated(() => {
  queueNodeResize();
});

onBeforeUnmount(() => {
  clearTimeout(resizeDebounceTimer);
  resizeObserver?.disconnect();
  cancelAnimationFrame(hoverReleaseFrame);
  const nodeModel = getNodeModel();
  nodeModel.queueNodeResize = undefined;
  nodeModel.openNodeMenu = undefined;
  nodeModel.shouldKeepHovered = undefined;
});
</script>

<template>
  <div
    class="workflow-vue-node"
    :class="{
      'is-anchor-active': isNodeHoverActive || isSelected,
    }"
    :style="{ width: nodeWidth }"
    @mousedown="selectNode"
  >
    <section
      class="workflow-vue-node__card"
      :class="{
        'is-collapsed': !showNode,
        'is-disabled': disabled,
        'is-hovered': isNodeHoverActive,
        [`is-runtime-${runtimeStatus.toLowerCase()}`]: runtimeStatus,
        'is-selected': isSelected,
      }"
    >
      <div ref="measureRef" class="workflow-vue-node__measure">
        <header
          class="workflow-vue-node__header"
          :style="{
            gridTemplateColumns: runtimeStatus
              ? showNode
                ? '36px auto minmax(0, 1fr) auto'
                : '24px auto minmax(0, 1fr) auto'
              : showNode
                ? '36px minmax(0, 1fr) auto'
                : '24px minmax(0, 1fr) auto',
          }"
        >
          <span class="workflow-vue-node__badge" :class="`is-${meta.status}`">{{
            meta.status.slice(0, 2).toUpperCase()
          }}</span>
          <ElTag
            v-if="runtimeStatus"
            size="small"
            :type="runtimeStatusTagType(runtimeStatus)"
            effect="light"
          >
            {{ runtimeStatusLabel(runtimeStatus) }}
          </ElTag>
          <div class="workflow-vue-node__title-wrap">
            <span
              class="workflow-vue-node__title"
              :title="currentTitle()"
              v-html="highlightedTitle(currentTitle())"
            ></span>
          </div>
          <div
            class="workflow-vue-node__actions"
            @click="stopCanvas"
            @mousedown="stopCanvas"
            @mousemove="stopCanvas"
            @keydown="stopCanvas"
          >
            <ElButton
              text
              size="small"
              class="workflow-vue-node__icon-button"
              @click="setShowNode(!showNode)"
            >
              <ElIcon
                class="workflow-vue-node__collapse-icon"
                :class="{ 'is-open': showNode }"
              >
                <ArrowDownBold />
              </ElIcon>
            </ElButton>
            <ElDropdown
              v-if="!isProtectedNode"
              trigger="click"
              :teleported="false"
              popper-class="workflow-vue-node__actions-dropdown"
            >
              <ElButton text :icon="MoreFilled" size="small" />
              <template #dropdown>
                <ElDropdownMenu>
                  <ElDropdownItem @click="renameNode">重命名</ElDropdownItem>
                  <ElDropdownItem @click="copyNode">复制</ElDropdownItem>
                  <ElDropdownItem @click="disabled = !disabled">
                    {{ disabled ? '启用' : '禁用' }}
                  </ElDropdownItem>
                  <ElDropdownItem divided @click="deleteNode">
                    删除
                  </ElDropdownItem>
                </ElDropdownMenu>
              </template>
            </ElDropdown>
          </div>
        </header>

        <ElCollapseTransition>
          <div
            v-show="showNode"
            class="workflow-vue-node__body"
            @click="stopCanvas"
            @mousedown="stopCanvas"
            @mousemove="stopCanvas"
            @keydown="stopCanvas"
            @wheel="stopCanvas"
          >
            <ElAlert
              v-if="disabled"
              title="节点已禁用，保存时仍会保留配置"
              type="warning"
              :closable="false"
              show-icon
            />
            <slot></slot>
            <div v-if="!hideOutputSection" class="workflow-vue-node__outputs">
              <div class="workflow-vue-node__section-title">
                <span>输出字段</span>
                <ElSwitch
                  v-if="showExceptionSwitch"
                  v-model="enableException"
                  size="small"
                />
              </div>
              <div
                v-if="fields.length > 0"
                class="workflow-vue-node__field-list"
              >
                <button
                  v-for="field in fields"
                  :key="field.name"
                  type="button"
                  class="workflow-vue-node__field"
                  @click="copyField(field)"
                >
                  <span
                    :title="`${field.label || outputFieldValue(field)} {${outputFieldValue(field)}}`"
                  >
                    {{ field.label || outputFieldValue(field) }}
                    {{ outputFieldReference(field) }}
                  </span>
                </button>
              </div>
              <div v-else class="workflow-vue-node__empty">暂无输出字段</div>
            </div>
          </div>
        </ElCollapseTransition>
      </div>
    </section>

    <ElCollapseTransition>
      <div
        v-if="showAddMenu"
        class="workflow-vue-node__anchor-menu"
        :style="anchorMenuStyle"
        @click="stopCanvas"
        @mousedown="stopCanvas"
        @mousemove="stopCanvas"
        @keydown="stopCanvas"
        @wheel="stopCanvas"
      >
        <div class="workflow-vue-node__menu" @wheel="stopCanvas">
          <div class="workflow-vue-node__menu-search">
            <ElInput
              v-model="menuSearchKeyword"
              clearable
              placeholder="搜索节点名称 / 类型 / 描述"
            >
              <template #suffix>
                <ElIcon><Search /></ElIcon>
              </template>
            </ElInput>
          </div>
          <ElTabs v-model="activeMenuTab" class="workflow-vue-node__tabs">
            <ElTabPane
              v-for="tab in tabbedMenuGroups"
              :key="tab.name"
              :label="tab.label"
              :name="tab.name"
            />
          </ElTabs>
          <ElScrollbar height="390px">
            <div
              v-if="activeMenuGroups.length > 0"
              class="workflow-vue-node__menu-content"
            >
              <section
                v-for="group in activeMenuGroups"
                :key="group.name"
                class="workflow-vue-node__menu-group"
              >
                <div class="workflow-vue-node__menu-title">
                  {{ group.name }}
                </div>
                <div class="workflow-vue-node__menu-grid">
                  <ElPopover
                    v-for="item in group.items"
                    :key="item.type"
                    placement="right"
                    :show-after="350"
                    :persistent="false"
                    :teleported="false"
                    width="280"
                  >
                    <template #reference>
                      <button
                        type="button"
                        class="workflow-vue-node__menu-item"
                        :class="`is-${item.status}`"
                        @click="addNextNode(item)"
                      >
                        <span class="workflow-vue-node__menu-icon">{{
                          item.name.slice(0, 1)
                        }}</span>
                        <span class="workflow-vue-node__menu-main">
                          <strong>{{ item.name }}</strong>
                          <small>{{ item.description }}</small>
                        </span>
                        <ElTag
                          size="small"
                          :type="statusTagType(item.status)"
                          effect="light"
                        >
                          {{ statusLabel(item.status) }}
                        </ElTag>
                      </button>
                    </template>
                    <div class="workflow-vue-node__menu-preview">
                      <div class="workflow-vue-node__menu-preview-head">
                        <span
                          class="workflow-vue-node__menu-icon"
                          :class="`is-${item.status}`"
                        >
                          {{ item.name.slice(0, 1) }}
                        </span>
                        <div>
                          <strong>{{ item.name }}</strong>
                          <small>{{ item.type }}</small>
                        </div>
                      </div>
                      <p>{{ item.description }}</p>
                      <ElTag v-if="item.stub" size="small" type="warning">
                        兼容占位
                      </ElTag>
                    </div>
                  </ElPopover>
                </div>
              </section>
            </div>
            <ElEmpty v-else description="未找到匹配节点" :image-size="72" />
          </ElScrollbar>
        </div>
      </div>
    </ElCollapseTransition>
  </div>
</template>

<style scoped lang="scss">
.workflow-vue-node {
  position: relative;
  box-sizing: border-box;
  min-width: 0;
  padding: 16px;
  color: var(--el-text-color-primary);
  pointer-events: auto;
}

.workflow-vue-node__card {
  padding: 16px;
  overflow: visible;
  background: var(--el-bg-color);
  border: 2px solid var(--el-bg-color);
  border-radius: 8px;
  box-shadow: 0 2px 4px 0 rgb(var(--el-text-color-primary-rgb), 0.12);
  transition:
    border-color var(--el-transition-duration),
    box-shadow var(--el-transition-duration);
}

.workflow-vue-node__measure {
  min-width: 0;
}

.workflow-vue-node__card.is-selected {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 4px 0 rgb(var(--el-text-color-primary-rgb), 0.12);
}

.workflow-vue-node:hover .workflow-vue-node__card,
.workflow-vue-node__card.is-hovered {
  box-shadow: 0 6px 24px 0 rgb(var(--el-text-color-primary-rgb), 0.08);
}

.workflow-vue-node__card.is-disabled {
  opacity: 0.7;
}

.workflow-vue-node__card.is-runtime-running {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-8);
}

.workflow-vue-node__card.is-runtime-success {
  border-color: var(--el-color-success);
}

.workflow-vue-node__card.is-runtime-warning {
  border-color: var(--el-color-warning);
}

.workflow-vue-node__card.is-runtime-failed {
  border-color: var(--el-color-danger);
}

.workflow-vue-node__header {
  display: grid;
  gap: 8px;
  align-items: center;
  padding: 10px;
  background: linear-gradient(
    135deg,
    var(--el-fill-color-extra-light),
    var(--el-bg-color)
  );
  border-bottom: 1px solid var(--el-border-color-lighter);
  border-radius: 8px 8px 0 0;
}

.workflow-vue-node__card.is-collapsed .workflow-vue-node__header {
  min-height: 32px;
  padding: 0;
  background: transparent;
  border-bottom: 0;
  border-radius: 0;
}

.workflow-vue-node__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  font-size: 11px;
  font-weight: 800;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: 6px;
}

.workflow-vue-node__card.is-collapsed .workflow-vue-node__badge {
  width: 24px;
  height: 24px;
  font-size: 10px;
}

.workflow-vue-node__badge.is-ai {
  color: var(--el-color-info);
  background: var(--el-color-info-light-9);
  border-color: var(--el-color-info-light-5);
}

.workflow-vue-node__badge.is-input {
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-5);
}

.workflow-vue-node__badge.is-output {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning-light-5);
}

.workflow-vue-node__title {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  min-width: 0;
  height: 28px;
  padding: 0 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 700;
  line-height: 28px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.workflow-vue-node__card.is-collapsed .workflow-vue-node__title {
  height: 24px;
  padding: 0;
  line-height: 24px;
}

.workflow-vue-node__title-wrap {
  position: relative;
  min-width: 0;
}

.workflow-vue-node__title-wrap:deep(.workflow-vue-node__highlight) {
  background: var(--el-color-warning-light-7);
  border-radius: 3px;
}

.workflow-vue-node__title-wrap:deep(.workflow-vue-node__highlight.is-current) {
  background: var(--el-color-warning);
}

.workflow-vue-node__actions,
.workflow-vue-node__section-title {
  display: flex;
  gap: 6px;
  align-items: center;
}

:global(.workflow-vue-node__actions-dropdown) {
  z-index: calc(var(--el-z-index-popper) + 20);
}

.workflow-vue-node__icon-button {
  width: 24px;
}

.workflow-vue-node__card.is-collapsed .workflow-vue-node__actions {
  gap: 4px;
  min-height: 24px;
}

.workflow-vue-node__card.is-collapsed
  .workflow-vue-node__actions
  :deep(.el-button) {
  width: 24px;
  height: 24px;
  min-height: 24px;
  padding: 0;
}

.workflow-vue-node__collapse-icon {
  color: var(--el-text-color-secondary);
  transition: transform var(--el-transition-duration);
}

.workflow-vue-node__collapse-icon.is-open {
  transform: rotate(180deg);
}

.workflow-vue-node__body {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 10px;
}

.workflow-vue-node__body > :deep(*) {
  min-width: 0;
}

.workflow-vue-node__body :deep(.el-form),
.workflow-vue-node__body :deep(.el-form-item),
.workflow-vue-node__body :deep(.el-form-item__content),
.workflow-vue-node__body :deep(.el-input),
.workflow-vue-node__body :deep(.el-input-number),
.workflow-vue-node__body :deep(.el-select),
.workflow-vue-node__body :deep(.el-cascader),
.workflow-vue-node__body :deep(.el-textarea) {
  min-width: 0;
  max-width: 100%;
}

.workflow-vue-node__body :deep(.el-cascader__dropdown) {
  min-width: 0;
  max-width: none;
  overflow: visible;
}

.workflow-vue-node__body :deep(.el-cascader-panel) {
  max-width: none;
  overflow: visible;
}

.workflow-vue-node__body :deep(.el-form-item) {
  margin-bottom: 10px;
}

.workflow-vue-node__body :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.workflow-vue-node__body :deep(.el-input),
.workflow-vue-node__body :deep(.el-input-number),
.workflow-vue-node__body :deep(.el-select),
.workflow-vue-node__body :deep(.el-cascader),
.workflow-vue-node__body :deep(.el-textarea) {
  width: 100%;
}

.workflow-vue-node__section-title {
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.workflow-vue-node__field-list {
  display: grid;
  gap: 6px;
}

.workflow-vue-node__field {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  padding: 5px 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-vue-node__field span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-vue-node__empty {
  padding: 8px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-extra-light);
  border-radius: 6px;
}

.workflow-vue-node__anchor-menu {
  position: absolute;
  left: 100%;
  z-index: 20;
  width: 520px;
  padding: 12px;
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  box-shadow: var(--el-box-shadow);
  transform: translate(0, -50%);
}

.workflow-vue-node__anchor-menu::before {
  position: absolute;
  top: 50%;
  left: -7px;
  width: 12px;
  height: 12px;
  content: '';
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
  border-left: 1px solid var(--el-border-color-light);
  transform: translateY(-50%) rotate(45deg);
}

.workflow-vue-node__menu {
  width: 100%;
  overflow: hidden;
}

.workflow-vue-node__menu-search {
  padding: 4px 4px 8px;
}

.workflow-vue-node__tabs {
  --el-tabs-header-height: 34px;
}

.workflow-vue-node__tabs :deep(.el-tabs__header) {
  margin: 0 0 8px;
}

.workflow-vue-node__tabs :deep(.el-tabs__item) {
  padding: 0 10px;
  font-size: 12px;
}

.workflow-vue-node__menu-content {
  padding: 0 4px 4px;
}

.workflow-vue-node__menu-group + .workflow-vue-node__menu-group {
  margin-top: 12px;
}

.workflow-vue-node__menu-title {
  margin: 2px 0 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.workflow-vue-node__menu-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.workflow-vue-node__menu-item {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  width: 100%;
  min-height: 58px;
  padding: 8px;
  text-align: left;
  cursor: pointer;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  transition:
    background-color var(--el-transition-duration),
    border-color var(--el-transition-duration),
    box-shadow var(--el-transition-duration);
}

.workflow-vue-node__menu-item:hover {
  background: var(--el-bg-color);
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-9);
}

.workflow-vue-node__menu-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 13px;
  font-weight: 800;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: 6px;
}

.workflow-vue-node__menu-item.is-ai .workflow-vue-node__menu-icon,
.workflow-vue-node__menu-icon.is-ai {
  color: var(--el-color-info);
  background: var(--el-color-info-light-9);
  border-color: var(--el-color-info-light-5);
}

.workflow-vue-node__menu-item.is-data .workflow-vue-node__menu-icon,
.workflow-vue-node__menu-item.is-input .workflow-vue-node__menu-icon,
.workflow-vue-node__menu-icon.is-data,
.workflow-vue-node__menu-icon.is-input {
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-5);
}

.workflow-vue-node__menu-item.is-output .workflow-vue-node__menu-icon,
.workflow-vue-node__menu-item.is-resource .workflow-vue-node__menu-icon,
.workflow-vue-node__menu-icon.is-output,
.workflow-vue-node__menu-icon.is-resource {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning-light-5);
}

.workflow-vue-node__menu-main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.workflow-vue-node__menu-main strong {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.workflow-vue-node__menu-main small,
.workflow-vue-node__menu-preview small,
.workflow-vue-node__menu-preview p {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.workflow-vue-node__menu-main small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-vue-node__menu-preview {
  display: grid;
  gap: 8px;
}

.workflow-vue-node__menu-preview-head {
  display: flex;
  gap: 8px;
  align-items: center;
}

.workflow-vue-node__menu-preview-head > div {
  display: grid;
  gap: 2px;
}

.workflow-vue-node__menu-preview p {
  margin: 0;
  line-height: 1.5;
}
</style>
