<script setup lang="ts">
import { computed, ref } from 'vue';

import {
  ElButton,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
} from 'element-plus';

import { syncNodeProperties } from '../../common/node-inline-update';
import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';
import GroupFieldDialog from './component/GroupFieldDialog.vue';

const props = defineProps<{ nodeModel: any; renderVersion?: number }>();
const groupFieldDialogRef = ref<InstanceType<typeof GroupFieldDialog>>();
const nodeRenderVersion = ref(0);
const formData = computed({
  get: () => {
    trackRenderVersion(props.renderVersion, nodeRenderVersion.value);
    return props.nodeModel.properties.node_data || {};
  },
  set: (value) => syncNodeData(value),
});
const groups = computed(() =>
  Array.isArray(formData.value.group_list)
    ? formData.value.group_list
    : [
        {
          field: 'Group1',
          id: 'group_1',
          label: 'Group1',
          variable_list:
            Array.isArray(formData.value.variables) &&
            formData.value.variables.length > 0
              ? formData.value.variables
              : [{ variable: [], v_id: 'v_1' }],
        },
      ],
);
function patchData(key: string, value: any) {
  formData.value = { ...formData.value, [key]: value };
}
function syncNodeData(
  nodeData: Record<string, unknown>,
  patch: Record<string, unknown> = {},
  fields = ['node_data'],
) {
  syncNodeProperties(
    props.nodeModel,
    { node_data: nodeData, ...patch },
    fields,
  );
  nodeRenderVersion.value += 1;
}
function trackRenderVersion(..._versions: unknown[]) {}
function syncGroups(next: any[]) {
  const nodeData = { ...formData.value, group_list: next };
  syncNodeData(
    nodeData,
    {
      config: {
        ...props.nodeModel.properties.config,
        fields: next.map((item) => ({ label: item.label, value: item.field })),
      },
    },
    ['node_data', 'config'],
  );
}
function addGroup() {
  openGroupDialog();
}
function openGroupDialog(group?: any, index?: number) {
  groupFieldDialogRef.value?.open(
    group ? { field: group.field, label: group.label } : undefined,
    index,
  );
}
function refreshGroupField(
  data: { field: string; label: string },
  index?: number,
) {
  const exists = groups.value.some(
    (item: any, itemIndex: number) =>
      item.field === data.field && itemIndex !== index,
  );
  if (exists) {
    ElMessage.error(`输出字段重复: ${data.field}`);
    return;
  }
  if (index === undefined) {
    syncGroups([
      ...groups.value,
      {
        field: data.field,
        id: `group_${Date.now()}`,
        label: data.label,
        variable_list: [{ variable: [], v_id: `v_${Date.now()}` }],
      },
    ]);
  } else {
    patchGroup(index, data);
  }
  groupFieldDialogRef.value?.close();
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
function moveGroup(index: number, direction: -1 | 1) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= groups.value.length) return;
  const next = [...groups.value];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  syncGroups(next);
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
function moveVariable(
  groupIndex: number,
  variableIndex: number,
  direction: -1 | 1,
) {
  const group = groups.value[groupIndex];
  const nextVariables = [...(group.variable_list || [])];
  const targetIndex = variableIndex + direction;
  if (targetIndex < 0 || targetIndex >= nextVariables.length) return;
  [nextVariables[variableIndex], nextVariables[targetIndex]] = [
    nextVariables[targetIndex],
    nextVariables[variableIndex],
  ];
  patchGroup(groupIndex, { variable_list: nextVariables });
}
</script>

<template>
  <NodeContainer
    :node-model="nodeModel"
    :render-version="nodeRenderVersion + (renderVersion || 0)"
  >
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
            <span class="workflow-node-group-title" :title="group.label">
              {{ group.label || group.field }}
            </span>
            <span class="workflow-node-group-field" :title="group.field">
              {{ group.field }}
            </span>
            <ElButton
              link
              type="primary"
              @click="openGroupDialog(group, Number(groupIndex))"
            >
              编辑
            </ElButton>
            <ElButton
              link
              :disabled="Number(groupIndex) === 0"
              @click="moveGroup(Number(groupIndex), -1)"
            >
              上移
            </ElButton>
            <ElButton
              link
              :disabled="Number(groupIndex) === groups.length - 1"
              @click="moveGroup(Number(groupIndex), 1)"
            >
              下移
            </ElButton>
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
              :disabled="Number(variableIndex) === 0"
              @click="
                moveVariable(Number(groupIndex), Number(variableIndex), -1)
              "
            >
              上
            </ElButton>
            <ElButton
              link
              :disabled="
                Number(variableIndex) === (group.variable_list || []).length - 1
              "
              @click="
                moveVariable(Number(groupIndex), Number(variableIndex), 1)
              "
            >
              下
            </ElButton>
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
    <GroupFieldDialog ref="groupFieldDialogRef" @refresh="refreshGroupField" />
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
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto auto auto auto;
  gap: 6px;
  align-items: center;
}

.workflow-node-ref {
  grid-template-columns: minmax(0, 96px) minmax(0, 1fr) auto auto auto;
}

.workflow-node-group-title,
.workflow-node-group-field {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  white-space: nowrap;
}

.workflow-node-group-title {
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.workflow-node-group-field {
  color: var(--el-text-color-secondary);
}
</style>
