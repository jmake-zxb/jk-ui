<script setup lang="ts">
import { computed, ref } from 'vue';

import DynamicsForm from '#/components/dynamics-form/index.vue';
import { WorkflowType } from '#/enums/application';

defineOptions({ name: 'KnowledgeBase' });

const props = defineProps<{
  workflow: null | Record<string, any>;
}>();

const loading = ref(false);
const formData = ref<Record<string, any>>({});
const dynamicsFormRef = ref<InstanceType<typeof DynamicsForm>>();

const knowledgeBaseNode = computed(() => {
  const nodes = props.workflow?.nodes;
  if (!Array.isArray(nodes)) return undefined;
  return nodes.find(
    (node: Record<string, any>) => node.type === WorkflowType.KnowledgeBase,
  );
});

const title = computed(
  () =>
    knowledgeBaseNode.value?.properties?.user_input_config?.title || '用户输入',
);

const baseFormList = computed(() => {
  const fields = knowledgeBaseNode.value?.properties?.user_input_field_list;
  return Array.isArray(fields) ? fields : [];
});

function validate() {
  return dynamicsFormRef.value?.validate();
}

function getData() {
  return formData.value;
}

defineExpose({ get_data: getData, validate });
</script>

<template>
  <DynamicsForm
    ref="dynamicsFormRef"
    v-loading="loading"
    v-model="formData"
    :model="formData"
    :render-fields="baseFormList"
    label-position="top"
    require-asterisk-position="right"
  >
    <template #default>
      <h4 class="title-decoration-1 mb-16 mt-4">{{ title }}</h4>
    </template>
  </DynamicsForm>
</template>

<style scoped lang="scss">
.mb-16 {
  margin-bottom: 16px;
}

.mt-4 {
  margin-top: 4px;
}
</style>
