<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { ElCascader } from 'element-plus';

const props = defineProps<{
  global?: boolean;
  modelValue?: any[];
  nodeModel: any;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: any[]];
}>();

const data = computed({
  get: () => props.modelValue || [],
  set: (value: any[]) => emit('update:modelValue', value || []),
});

const options = ref<any[]>([]);

function optionKey(item: any) {
  return `${item?.type || ''}:${item?.value || item?.label || ''}`;
}

function mergeChildren(target: any[], source: any[]) {
  const result = [...target];
  const usedKeys = new Set(result.map((item) => optionKey(item)));
  source.forEach((item) => {
    const key = optionKey(item);
    if (usedKeys.has(key)) return;
    usedKeys.add(key);
    result.push(item);
  });
  return result;
}

function dedupeOptions(items: any[]) {
  const result: any[] = [];
  const indexByKey = new Map<string, number>();
  items.forEach((item) => {
    if (!item?.children?.length) return;
    const key = optionKey(item);
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, result.length);
      result.push({
        ...item,
        children: mergeChildren([], item.children || []),
      });
      return;
    }
    const existing = result[existingIndex];
    result[existingIndex] = {
      ...existing,
      children: mergeChildren(existing.children || [], item.children || []),
    };
  });
  return result;
}

function refreshOptions() {
  const upstream =
    typeof props.nodeModel.get_up_node_field_list === 'function'
      ? props.nodeModel.get_up_node_field_list(false, true)
      : [];
  const parentUpstream =
    typeof props.nodeModel.graphModel?.get_up_node_field_list === 'function'
      ? props.nodeModel.graphModel.get_up_node_field_list(false, true)
      : [];
  const merged = dedupeOptions([...parentUpstream, ...upstream]);
  options.value = props.global
    ? merged.filter((item: any) =>
        ['chat', 'global', 'loop', 'output'].includes(item.value),
      )
    : merged;
}

function stopWheel(event: WheelEvent) {
  if (!event.ctrlKey) event.stopPropagation();
}

function validate() {
  refreshOptions();
  if (!data.value || data.value.length < 2)
    return Promise.reject(new Error('请选择上游变量'));
  const [nodeId, nodeField] = data.value;
  const nodeParent = options.value.find((item: any) => item.value === nodeId);
  if (!nodeParent) {
    data.value = [];
    return Promise.reject(new Error('引用变量不存在'));
  }
  if (!nodeParent.children?.some((item: any) => item.value === nodeField)) {
    data.value = [];
    return Promise.reject(new Error('引用字段不存在'));
  }
  return Promise.resolve('');
}

defineExpose({ validate });
onMounted(refreshOptions);
</script>

<template>
  <ElCascader
    v-model="data"
    :options="options"
    clearable
    filterable
    separator=" > "
    :teleported="false"
    v-bind="$attrs"
    @visible-change="(visible: boolean) => visible && refreshOptions()"
    @wheel="stopWheel"
  >
    <template #default="{ data: option }">
      <span class="workflow-node-cascader-option">
        <small>{{ option.type || 'var' }}</small>
        {{ option.label }}
      </span>
    </template>
  </ElCascader>
</template>

<style scoped lang="scss">
.workflow-node-cascader-option {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.workflow-node-cascader-option small {
  color: var(--el-text-color-placeholder);
}
</style>
