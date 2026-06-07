<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

import { ArrowDown, ArrowUp, Close, Search } from '@element-plus/icons-vue';
import { ElButton, ElCard, ElDivider, ElInput } from 'element-plus';

import { nodeMeta } from '../nodes';

const props = defineProps<{
  enabled?: boolean;
  excludeTypes?: string[];
  lf?: any;
}>();

const emit = defineEmits<{
  clearSelection: [];
  focusNode: [id: string];
}>();

type SearchResult = {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
};

const showSearch = ref(false);
const searchText = ref('');
const searchInputRef = ref<any>();
const results = ref<SearchResult[]>([]);
const currentIndex = ref(0);
const excludedTypes = computed(
  () => new Set(props.excludeTypes || ['loop-body-node']),
);

const resultLabel = computed(() => {
  if (results.value.length > 0)
    return `${currentIndex.value + 1}/${results.value.length}`;
  return searchText.value.trim() ? '无结果' : 'Ctrl+F';
});

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tagName = element.tagName?.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    element.isContentEditable
  );
}

function clearHighlight() {
  results.value.forEach((result) => {
    props.lf?.graphModel?.getNodeModelById?.(result.id)?.clearSelectOn?.();
  });
  props.lf?.clearSelectElements?.();
  emit('clearSelection');
}

function markResult(result: SearchResult, focused: boolean) {
  const nodeModel = props.lf?.graphModel?.getNodeModelById?.(result.id);
  if (focused) nodeModel?.focusOn?.(searchText.value);
  else nodeModel?.selectOn?.(searchText.value);
}

function focusResult(result: SearchResult) {
  const lf = props.lf;
  if (!lf) return;
  results.value.forEach((item) => markResult(item, item.id === result.id));
  lf.selectElementById?.(result.id, false);
  const width = lf.container?.clientWidth || 0;
  const height = lf.container?.clientHeight || 0;
  lf.graphModel?.transformModel?.focusOn?.(result.x, result.y, width, height);
  emit('focusNode', result.id);
}

function collectResults(keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword || !props.lf) return [];
  const graph = props.lf.getGraphData?.() || { nodes: [] };
  return (graph.nodes || [])
    .filter((node: any) => !excludedTypes.value.has(node.type))
    .map((node: any) => {
      const name =
        node.properties?.stepName ||
        node.properties?.name ||
        node.text?.value ||
        node.text ||
        nodeMeta(node.properties?.backendType || node.type).name;
      return {
        id: `${node.id}`,
        name: `${name}`,
        type:
          node.properties?.backendType || node.properties?.type || node.type,
        x: Number(node.x || 0),
        y: Number(node.y || 0),
      } as SearchResult;
    })
    .filter((node: SearchResult) =>
      `${node.name} ${node.type} ${node.id}`
        .toLowerCase()
        .includes(normalizedKeyword),
    )
    .toSorted(
      (left: SearchResult, right: SearchResult) =>
        left.y - right.y || left.x - right.x,
    );
}

function runSearch() {
  clearHighlight();
  results.value = collectResults(searchText.value);
  currentIndex.value = 0;
  results.value.forEach((result, index) => markResult(result, index === 0));
  if (results.value.length > 0) focusResult(results.value[0]!);
}

function openSearch() {
  showSearch.value = true;
  nextTick(() => searchInputRef.value?.focus?.());
}

function closeSearch() {
  showSearch.value = false;
  searchText.value = '';
  results.value = [];
  currentIndex.value = 0;
  clearHighlight();
}

function nextResult(step: number) {
  if (results.value.length === 0) return;
  currentIndex.value =
    (currentIndex.value + step + results.value.length) % results.value.length;
  focusResult(results.value[currentIndex.value]!);
}

function handleKeydown(event: KeyboardEvent) {
  if (props.enabled === false) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
    if (isEditableTarget(event.target) && !showSearch.value) return;
    event.preventDefault();
    openSearch();
  }
  if (event.key === 'Escape' && showSearch.value) closeSearch();
}

watch(searchText, runSearch);
watch(
  () => props.enabled,
  (enabled) => {
    if (enabled === false && showSearch.value) closeSearch();
  },
);

onMounted(() => window.addEventListener('keydown', handleKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown));

defineExpose({ closeSearch, openSearch, runSearch });
</script>

<template>
  <ElCard v-if="showSearch" class="designer-node-search" shadow="always">
    <ElInput
      ref="searchInputRef"
      v-model="searchText"
      class="designer-node-search__input"
      clearable
      placeholder="搜索节点名称 / 类型 / ID"
      @keyup.enter="nextResult(1)"
      @keyup.esc="closeSearch"
    />
    <span class="designer-node-search__count">{{ resultLabel }}</span>
    <ElDivider direction="vertical" />
    <ElButton text size="small" :icon="ArrowUp" @click="nextResult(-1)" />
    <ElButton text size="small" :icon="ArrowDown" @click="nextResult(1)" />
    <ElButton text size="small" :icon="Close" @click="closeSearch" />
  </ElCard>
  <ElButton
    v-else
    class="designer-node-search__trigger"
    circle
    size="large"
    :icon="Search"
    @click="openSearch"
  />
</template>

<style scoped lang="scss">
.designer-node-search {
  --el-card-padding: 8px 12px;
  --el-card-border-radius: 8px;

  position: absolute;
  top: var(--designer-node-search-top, 16px);
  left: 50%;
  z-index: 3;
  transform: translateX(-50%);
}

.designer-node-search :deep(.el-card__body) {
  display: flex;
  gap: 4px;
  align-items: center;
}

.designer-node-search__input {
  width: 280px;
}

.designer-node-search__input :deep(.el-input__wrapper) {
  box-shadow: none;
}

.designer-node-search__count {
  min-width: 42px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.designer-node-search__trigger {
  position: absolute;
  top: var(--designer-node-search-top, 16px);
  left: 16px;
  z-index: 3;
  box-shadow: var(--el-box-shadow-light);
}
</style>
