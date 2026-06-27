<script setup lang="ts">
import type { FormField } from '../../type';

import { computed } from 'vue';

import { Collection } from '@element-plus/icons-vue';
import { ElIcon, ElOption, ElSelect, ElSpace } from 'element-plus';

import SelectHeader from '../common/SelectHeader.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    formField: FormField;
    modelValue?: string[];
  }>(),
  { modelValue: () => [] },
);

const emit = defineEmits(['update:modelValue', 'change']);

const availableList = computed(() => {
  return (props.formField.attrs?.knowledge_list as any[]) || [];
});

const selectedIds = computed({
  get: () =>
    props.modelValue.filter((id: string) =>
      availableList.value.some((item) => item.id === id),
    ) || [],
  set: (ids: string[]) => {
    emit('update:modelValue', ids);
    emit('change', props.formField);
  },
});
</script>

<template>
  <div class="w-full">
    <ElSelect
      v-model="selectedIds"
      multiple
      v-bind="$attrs"
      class="w-full"
      placeholder="选择知识库"
    >
      <template v-if="($attrs as any).popperHeader" #header>
        <SelectHeader :header="($attrs as any).popperHeader" />
      </template>
      <ElOption
        v-for="item in availableList"
        :key="item.id"
        :label="item.name"
        :value="item.id"
      >
        <ElSpace :size="8">
          <ElIcon :size="20" style="

--el-avatar-border-radius: 6px">
            <Collection />
          </ElIcon>
          <span>{{ item.name }}</span>
        </ElSpace>
      </ElOption>
      <template #label="{ label }">
        <ElSpace :size="8">
          <ElIcon :size="14" style="

--el-avatar-border-radius: 4px">
            <Collection />
          </ElIcon>
          <span>{{ label }}</span>
        </ElSpace>
      </template>
    </ElSelect>
  </div>
</template>
