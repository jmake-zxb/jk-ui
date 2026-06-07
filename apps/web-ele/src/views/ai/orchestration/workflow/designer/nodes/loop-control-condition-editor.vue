<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import { onMounted, ref } from 'vue';

import { Delete, Plus } from '@element-plus/icons-vue';
import {
  ElButton,
  ElCard,
  ElCol,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElOption,
  ElRow,
  ElSelect,
} from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

import NodeCascader from '../common/NodeCascader.vue';
import NodeContainer from '../common/NodeContainer.vue';

type LoopCondition = {
  compare: string;
  field: any[];
  value: any;
};

type LoopControlNodeData = {
  condition: string;
  condition_list: LoopCondition[];
  condition_relation: string;
};

const props = defineProps<{
  nodeModel: any;
}>();

const compareList = [
  { value: 'is_null', label: '为空' },
  { value: 'is_not_null', label: '不为空' },
  { value: 'contain', label: '包含' },
  { value: 'not_contain', label: '不包含' },
  { value: 'eq', label: '等于' },
  { value: 'not_eq', label: '不等于' },
  { value: 'ge', label: '大于等于' },
  { value: 'gt', label: '大于' },
  { value: 'le', label: '小于等于' },
  { value: 'lt', label: '小于' },
  { value: 'len_eq', label: '长度等于' },
  { value: 'len_ge', label: '长度大于等于' },
  { value: 'len_gt', label: '长度大于' },
  { value: 'len_le', label: '长度小于等于' },
  { value: 'len_lt', label: '长度小于' },
  { value: 'is_true', label: '为真' },
  { value: 'is_not_true', label: '不为真' },
  { value: 'start_with', label: 'startWith' },
  { value: 'end_with', label: 'endWith' },
  { value: 'regex', label: '正则' },
  { value: 'wildcard', label: '通配符' },
];
const emptyValueOperators = new Set([
  'is_not_null',
  'is_not_true',
  'is_null',
  'is_true',
]);
const formData = ref<LoopControlNodeData>(
  normalizeNodeData(props.nodeModel.properties?.node_data),
);
const loopControlFormRef = ref<FormInstance>();
const nodeCascaderRef = ref<
  | Array<{ validate?: () => Promise<unknown> }>
  | { validate?: () => Promise<unknown> }
>();

function normalizeNodeData(
  value: Record<string, any> | undefined,
): LoopControlNodeData {
  const source = value && typeof value === 'object' ? value : {};
  const condition =
    `${source.condition || source.condition_relation || source.condition_type || 'and'}`.toLowerCase();
  return {
    condition: condition === 'or' ? 'or' : 'and',
    condition_list: Array.isArray(source.condition_list)
      ? cloneDeep(source.condition_list)
      : [],
    condition_relation: condition === 'or' ? 'or' : 'and',
  };
}

function emitInlineUpdate(fields: string[]) {
  props.nodeModel.graphModel?.eventCenter?.emit?.('node:inline-update', {
    fields,
    id: props.nodeModel.id,
    properties: props.nodeModel.properties,
    source: 'vue-node',
  });
}

function syncNodeData() {
  set(props.nodeModel.properties, 'node_data', cloneDeep(formData.value));
  emitInlineUpdate(['node_data']);
}

function addCondition() {
  formData.value.condition_list.push({ compare: '', field: [], value: '' });
  syncNodeData();
}

function deleteCondition(index: number) {
  formData.value.condition_list.splice(index, 1);
  syncNodeData();
}

function updateRelation(value: string) {
  const relation = value === 'or' ? 'or' : 'and';
  set(formData.value, 'condition', relation);
  set(formData.value, 'condition_relation', relation);
  syncNodeData();
}

function updateConditionField(index: number, value: any[]) {
  set(formData.value, ['condition_list', index, 'field'], value || []);
  syncNodeData();
}

function updateConditionCompare(index: number, value: string) {
  const previousCompare = formData.value.condition_list[index]?.compare;
  set(formData.value, ['condition_list', index, 'compare'], value);
  if (emptyValueOperators.has(value)) {
    set(formData.value, ['condition_list', index, 'value'], 1);
  } else if (
    previousCompare &&
    emptyValueOperators.has(previousCompare) &&
    formData.value.condition_list[index]?.value === 1
  ) {
    set(formData.value, ['condition_list', index, 'value'], '');
  }
  syncNodeData();
}

function updateConditionValue(index: number, value: any) {
  set(formData.value, ['condition_list', index, 'value'], value);
  syncNodeData();
}

function wheel(event: WheelEvent) {
  if (event.ctrlKey) event.preventDefault();
  else event.stopPropagation();
  return true;
}

function cascaderRefs() {
  if (Array.isArray(nodeCascaderRef.value)) return nodeCascaderRef.value;
  return nodeCascaderRef.value ? [nodeCascaderRef.value] : [];
}

const validate = () => {
  const validations = [
    loopControlFormRef.value?.validate(),
    ...cascaderRefs().map((item) => item.validate?.()),
  ].filter(Boolean);
  return Promise.all(validations).catch((error) => {
    throw Object.assign(new Error(`${error}`), {
      node: props.nodeModel,
      errMessage: error,
    });
  });
};

onMounted(() => {
  formData.value = normalizeNodeData(props.nodeModel.properties?.node_data);
  syncNodeData();
  set(props.nodeModel, 'validate', validate);
});
</script>

<template>
  <NodeContainer :node-model="nodeModel">
    <ElCard shadow="never" class="loop-control-card">
      <ElForm
        ref="loopControlFormRef"
        :model="formData"
        label-position="top"
        require-asterisk-position="right"
        label-width="auto"
        @submit.prevent
      >
        <div class="loop-control-handle">
          <div
            v-if="formData.condition_list.length > 1"
            class="loop-control-info"
          >
            <span>满足</span>
            <ElSelect
              :model-value="formData.condition"
              :teleported="false"
              size="small"
              class="loop-control-relation"
              @update:model-value="updateRelation"
            >
              <ElOption label="AND" value="and" />
              <ElOption label="OR" value="or" />
            </ElSelect>
            <span>条件</span>
          </div>
        </div>
        <template
          v-for="(condition, index) in formData.condition_list"
          :key="index"
        >
          <ElRow :gutter="8">
            <ElCol :span="11">
              <ElFormItem
                :prop="`condition_list.${index}.field`"
                :rules="{
                  type: 'array',
                  required: true,
                  message: '请选择变量',
                  trigger: 'change',
                }"
              >
                <NodeCascader
                  ref="nodeCascaderRef"
                  :model-value="condition.field"
                  :node-model="nodeModel"
                  class="w-full"
                  placeholder="请选择变量"
                  @update:model-value="
                    updateConditionField(Number(index), $event)
                  "
                />
              </ElFormItem>
            </ElCol>
            <ElCol :span="6">
              <ElFormItem
                :prop="`condition_list.${index}.compare`"
                :rules="{
                  required: true,
                  message: '请选择比较方式',
                  trigger: 'change',
                }"
              >
                <ElSelect
                  :model-value="condition.compare"
                  :teleported="false"
                  clearable
                  placeholder="请选择比较方式"
                  @update:model-value="
                    updateConditionCompare(Number(index), $event)
                  "
                  @wheel="wheel"
                >
                  <ElOption
                    v-for="item in compareList"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </ElSelect>
              </ElFormItem>
            </ElCol>
            <ElCol :span="6">
              <ElFormItem
                v-if="!emptyValueOperators.has(condition.compare)"
                :prop="`condition_list.${index}.value`"
                :rules="{
                  required: true,
                  message: '请输入比较值',
                  trigger: 'blur',
                }"
              >
                <ElInput
                  :model-value="condition.value"
                  placeholder="请输入比较值"
                  @update:model-value="
                    updateConditionValue(Number(index), $event)
                  "
                />
              </ElFormItem>
            </ElCol>
            <ElCol :span="1">
              <ElButton
                link
                type="info"
                class="mt-4"
                @click="deleteCondition(Number(index))"
              >
                <ElIcon><Delete /></ElIcon>
              </ElButton>
            </ElCol>
          </ElRow>
        </template>
      </ElForm>
      <ElButton link type="primary" @click="addCondition">
        <ElIcon class="mr-4"><Plus /></ElIcon>
        添加条件
      </ElButton>
    </ElCard>
  </NodeContainer>
</template>

<style scoped lang="scss">
.loop-control-card {
  --el-card-padding: 12px;

  overflow: visible;
}

.loop-control-card :deep(.el-card__body),
.loop-control-card :deep(.el-form),
.loop-control-card :deep(.el-row),
.loop-control-card :deep(.el-col),
.loop-control-card :deep(.el-form-item),
.loop-control-card :deep(.el-form-item__content) {
  overflow: visible;
}

.loop-control-handle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.loop-control-info {
  display: flex;
  align-items: center;
}

.loop-control-relation {
  width: 60px;
  margin: 0 8px;
}

.mt-4 {
  margin-top: 4px;
}

.mr-4 {
  margin-right: 4px;
}

.w-full {
  width: 100%;
}
</style>
