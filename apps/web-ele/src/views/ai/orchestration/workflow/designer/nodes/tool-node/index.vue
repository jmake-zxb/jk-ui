<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue';

import {
  ElButton,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElInput,
  ElOption,
  ElSelect,
  ElSwitch,
} from 'element-plus';

import CodeEditor from '#/component/CodeEditor/index.vue';

import { syncNodeProperties } from '../../common/node-inline-update';
import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';

const props = defineProps<{ nodeModel: any; renderVersion?: number }>();
type WorkflowMode = 'application' | 'application-loop' | 'tool' | string;
const workflowMode = inject<WorkflowMode>('workflowMode', 'application');
const nodeRenderVersion = ref(0);

const formData = computed({
  get: () => {
    trackRenderVersion(props.renderVersion, nodeRenderVersion.value);
    return props.nodeModel.properties.node_data || {};
  },
  set: (value) =>
    syncNodeProperties(props.nodeModel, { node_data: value }, ['node_data']),
});

const fields = computed(() =>
  Array.isArray(formData.value.input_field_list)
    ? formData.value.input_field_list
    : [],
);
const showWorkflowOutputControls = computed(
  () => !`${workflowMode || 'application'}`.includes('knowledge'),
);

function refreshNode() {
  nodeRenderVersion.value += 1;
}

function trackRenderVersion(..._versions: unknown[]) {}

function patchData(key: string, value: any) {
  formData.value = { ...formData.value, [key]: value };
  refreshNode();
}

function syncFields(nextFields: any[]) {
  patchData('input_field_list', nextFields);
}

function addField() {
  syncFields([
    ...fields.value,
    {
      desc: '',
      is_required: false,
      name: `param_${fields.value.length + 1}`,
      source: 'reference',
      type: 'string',
      value: [],
    },
  ]);
}

function patchField(index: number, patch: Record<string, any>) {
  syncFields(
    fields.value.map((field: any, fieldIndex: number) =>
      fieldIndex === index ? { ...field, ...patch } : field,
    ),
  );
}

function removeField(index: number) {
  syncFields(
    fields.value.filter((_: any, fieldIndex: number) => fieldIndex !== index),
  );
}

onMounted(() => {
  refreshNode();
});
</script>

<template>
  <NodeContainer
    :node-model="nodeModel"
    :render-version="nodeRenderVersion + (renderVersion || 0)"
  >
    <ElForm :model="formData" label-position="top" @submit.prevent>
      <div class="workflow-node-panel">
        <div class="workflow-node-panel__head">
          <span>输入参数</span>
          <ElButton link type="primary" @click="addField">添加</ElButton>
        </div>
        <div v-if="fields.length > 0" class="workflow-node-list">
          <div
            v-for="(field, index) in fields"
            :key="index"
            class="workflow-node-field"
          >
            <div class="workflow-node-field__meta">
              <ElInput
                :model-value="field.name"
                placeholder="参数名"
                @update:model-value="
                  patchField(Number(index), { name: $event })
                "
              />
              <ElSelect
                :model-value="field.type || 'string'"
                :teleported="false"
                @update:model-value="
                  patchField(Number(index), { type: $event })
                "
              >
                <ElOption label="string" value="string" />
                <ElOption label="number" value="number" />
                <ElOption label="boolean" value="boolean" />
                <ElOption label="json" value="json" />
              </ElSelect>
              <ElSwitch
                :model-value="!!field.is_required"
                size="small"
                active-text="必填"
                @update:model-value="
                  patchField(Number(index), { is_required: $event })
                "
              />
              <ElButton link type="danger" @click="removeField(Number(index))">
                删
              </ElButton>
            </div>
            <div class="workflow-node-field__value">
              <ElSelect
                :model-value="field.source || 'reference'"
                :teleported="false"
                @update:model-value="
                  patchField(Number(index), {
                    source: $event,
                    value: $event === 'reference' ? [] : '',
                  })
                "
              >
                <ElOption label="引用" value="reference" />
                <ElOption label="自定义" value="custom" />
              </ElSelect>
              <NodeCascader
                v-if="(field.source || 'reference') === 'reference'"
                :node-model="nodeModel"
                :model-value="field.value || []"
                placeholder="选择变量"
                @update:model-value="
                  patchField(Number(index), { value: $event })
                "
              />
              <ElInput
                v-else
                :model-value="field.value"
                placeholder="固定值"
                @update:model-value="
                  patchField(Number(index), { value: $event })
                "
              />
            </div>
          </div>
        </div>
        <ElEmpty v-else description="暂无参数" :image-size="42" />
      </div>
      <ElFormItem label="执行代码">
        <CodeEditor
          :model-value="`${formData.code ?? ''}`"
          height="130px"
          mode="python"
          @update:model-value="patchData('code', $event)"
        />
      </ElFormItem>
      <ElFormItem v-if="showWorkflowOutputControls" label="作为结果返回">
        <ElSwitch
          :model-value="!!formData.is_result"
          size="small"
          @update:model-value="patchData('is_result', $event)"
        />
      </ElFormItem>
    </ElForm>
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-node-panel {
  display: grid;
  gap: 8px;
  padding: 8px;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-node-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.workflow-node-list,
.workflow-node-field {
  display: grid;
  gap: 8px;
}

.workflow-node-field {
  padding: 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-node-field__meta {
  display: grid;
  grid-template-columns: 1fr 86px auto auto;
  gap: 6px;
  align-items: center;
}

.workflow-node-field__value {
  display: grid;
  grid-template-columns: 86px 1fr;
  gap: 6px;
}
</style>
