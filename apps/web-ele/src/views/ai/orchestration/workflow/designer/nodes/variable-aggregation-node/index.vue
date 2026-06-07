<script setup lang="ts">
import { computed } from 'vue';

import {
  ElButton,
  ElForm,
  ElFormItem,
  ElInput,
  ElOption,
  ElSelect,
} from 'element-plus';

import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';

const props = defineProps<{ nodeModel: any }>();
const formData = computed({
  get: () => props.nodeModel.properties.node_data || {},
  set: (value) =>
    props.nodeModel.updateWorkflowProperties?.({ node_data: value }, [
      'node_data',
    ]),
});
const groups = computed(() =>
  Array.isArray(formData.value.group_list)
    ? formData.value.group_list
    : [
        {
          field: 'result',
          id: 'group_1',
          label: '结果',
          variable_list: formData.value.variables || [],
        },
      ],
);
function patchData(key: string, value: any) {
  formData.value = { ...formData.value, [key]: value };
}
function syncGroups(next: any[]) {
  patchData('group_list', next);
  props.nodeModel.updateWorkflowProperties?.(
    {
      config: {
        ...props.nodeModel.properties.config,
        fields: next.map((item) => ({ label: item.label, value: item.field })),
      },
      node_data: formData.value,
    },
    ['node_data', 'config'],
  );
}
function addGroup() {
  syncGroups([
    ...groups.value,
    {
      field: `group_${groups.value.length + 1}`,
      id: `group_${Date.now()}`,
      label: `分组 ${groups.value.length + 1}`,
      variable_list: [{ variable: [], v_id: `v_${Date.now()}` }],
    },
  ]);
}
function patchGroup(index: number, patch: Record<string, any>) {
  syncGroups(
    groups.value.map((item: any, itemIndex: number) =>
      itemIndex === index ? { ...item, ...patch } : item,
    ),
  );
}
function removeGroup(index: number) {
  syncGroups(
    groups.value.filter((_: any, itemIndex: number) => itemIndex !== index),
  );
}
function addVariable(groupIndex: number) {
  const group = groups.value[groupIndex];
  patchGroup(groupIndex, {
    variable_list: [
      ...(group.variable_list || []),
      { variable: [], v_id: `v_${Date.now()}` },
    ],
  });
}
function patchVariable(
  groupIndex: number,
  variableIndex: number,
  patch: Record<string, any>,
) {
  const group = groups.value[groupIndex];
  patchGroup(groupIndex, {
    variable_list: (group.variable_list || []).map(
      (item: any, itemIndex: number) =>
        itemIndex === variableIndex ? { ...item, ...patch } : item,
    ),
  });
}
function removeVariable(groupIndex: number, variableIndex: number) {
  const group = groups.value[groupIndex];
  patchGroup(groupIndex, {
    variable_list: (group.variable_list || []).filter(
      (_: any, itemIndex: number) => itemIndex !== variableIndex,
    ),
  });
}
</script>

<template>
  <NodeContainer :node-model="nodeModel">
    <ElForm :model="formData" label-position="top" @submit.prevent>
      <ElFormItem label="聚合策略">
        <ElSelect
          :model-value="formData.strategy || 'first_non_null'"
          :teleported="false"
          @update:model-value="patchData('strategy', $event)"
        >
          <ElOption label="首个非空" value="first_non_null" />
          <ElOption label="变量转数组" value="variable_to_array" />
          <ElOption label="变量转字典" value="variable_to_dict" />
        </ElSelect>
      </ElFormItem>
      <div class="workflow-node-panel">
        <div class="workflow-node-panel__head">
          <span>聚合分组</span>
          <ElButton link type="primary" @click="addGroup">添加分组</ElButton>
        </div>
        <div
          v-for="(group, groupIndex) in groups"
          :key="group.id || groupIndex"
          class="workflow-node-card"
        >
          <div class="workflow-node-row">
            <ElInput
              :model-value="group.field"
              placeholder="输出字段"
              @update:model-value="
                patchGroup(Number(groupIndex), { field: $event })
              "
            />
            <ElInput
              :model-value="group.label"
              placeholder="显示名"
              @update:model-value="
                patchGroup(Number(groupIndex), { label: $event })
              "
            />
            <ElButton
              link
              type="danger"
              :disabled="groups.length <= 1"
              @click="removeGroup(Number(groupIndex))"
            >
              删
            </ElButton>
          </div>
          <div
            v-for="(item, variableIndex) in group.variable_list || []"
            :key="item.v_id || variableIndex"
            class="workflow-node-ref"
          >
            <ElInput
              v-if="formData.strategy === 'variable_to_dict'"
              :model-value="item.key"
              placeholder="key"
              @update:model-value="
                patchVariable(Number(groupIndex), Number(variableIndex), {
                  key: $event,
                })
              "
            />
            <NodeCascader
              :node-model="nodeModel"
              :model-value="item.variable || []"
              placeholder="选择变量"
              @update:model-value="
                patchVariable(Number(groupIndex), Number(variableIndex), {
                  variable: $event,
                })
              "
            />
            <ElButton
              link
              type="danger"
              :disabled="(group.variable_list || []).length <= 1"
              @click="removeVariable(Number(groupIndex), Number(variableIndex))"
            >
              删
            </ElButton>
          </div>
          <ElButton
            link
            type="primary"
            @click="addVariable(Number(groupIndex))"
          >
            添加变量
          </ElButton>
        </div>
      </div>
    </ElForm>
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-node-panel,
.workflow-node-card {
  display: grid;
  gap: 8px;
}

.workflow-node-panel {
  padding: 8px;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-node-panel__head {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.workflow-node-card {
  padding: 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-node-row,
.workflow-node-ref {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 6px;
  align-items: center;
}
</style>
