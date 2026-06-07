<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { Delete, Plus, Rank } from '@element-plus/icons-vue';
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
import Sortable from 'sortablejs';

import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';

type BranchCondition = {
  compare: string;
  field: any[];
  value: any;
};

type BranchItem = {
  condition: string;
  conditions: BranchCondition[];
  id: string;
  type: string;
};

type ConditionNodeData = {
  branch: BranchItem[];
};

const props = defineProps<{
  nodeModel: any;
  renderVersion?: number;
}>();
const nodeModel = props.nodeModel;

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
const emptyValueCompareList = new Set([
  'is_not_null',
  'is_not_true',
  'is_null',
  'is_true',
]);

const form: ConditionNodeData = {
  branch: [
    {
      conditions: [
        {
          field: [],
          compare: '',
          value: '',
        },
      ],
      id: randomId(),
      type: 'IF',
      condition: 'and',
    },
    {
      conditions: [],
      id: randomId(),
      type: 'ELSE',
      condition: 'and',
    },
  ],
};

const ConditionNodeFormRef = ref<FormInstance>();
const nodeCascaderRef = ref<any[]>([]);
const draggableRef = ref<HTMLElement>();
const nodeRenderVersion = ref(0);
const branchElements = new Map<string, HTMLElement>();
let shouldSyncInitialNodeData = false;
const formData = ref<ConditionNodeData>(conditionNodeDataFromProperties());
const resizeObserver =
  typeof ResizeObserver === 'undefined'
    ? undefined
    : new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          const el = entry.target as HTMLElement;
          const branchId = el.dataset.branchId;
          const branchIndex = Number(el.dataset.branchIndex);
          const branch = formData.value.branch.find(
            (item: BranchItem) => item.id === branchId,
          );
          if (branch)
            resizeCondition(
              { height: entry.contentRect.height },
              branch,
              branchIndex,
            );
        });
      });
let sortable: Sortable | undefined;

const wheel = (e: WheelEvent) => {
  if (e.ctrlKey === true) {
    e.preventDefault();
    return true;
  }
  e.stopPropagation();
  return true;
};

const resizeCondition = (wh: any, row: BranchItem, index: number) => {
  const branch_condition_list = cloneDeep(
    nodeModel.properties.branch_condition_list || [],
  );
  const new_branch_condition_list = branch_condition_list.map((item: any) => {
    if (item.id === row.id) {
      return { ...item, height: wh.height, index };
    }
    return item;
  });
  set(nodeModel.properties, 'branch_condition_list', new_branch_condition_list);
  refreshBranchAnchor(formData.value.branch, true, ['branch_condition_list']);
};

function refreshConditionNode(
  fields = ['node_data', 'branch_condition_list'],
  options: { refreshComponent?: boolean } = {},
) {
  nodeRenderVersion.value += 1;
  if (options.refreshComponent !== false) {
    nodeModel.refreshVueComponent?.();
  }
  nodeModel.graphModel?.eventCenter?.emit?.('node:inline-update', {
    fields,
    id: nodeModel.id,
    properties: nodeModel.properties,
    source: 'vue-node',
  });
}

function normalizeConditionNodeData(
  nodeData?: Partial<ConditionNodeData>,
): ConditionNodeData {
  if (Array.isArray(nodeData?.branch)) {
    return { branch: cloneDeep(nodeData.branch) };
  }
  return cloneDeep(form);
}

function conditionNodeDataFromProperties() {
  const nodeData: Partial<ConditionNodeData> | undefined =
    nodeModel.properties.node_data;
  const normalizedData = normalizeConditionNodeData(nodeData);
  if (!Array.isArray(nodeData?.branch)) {
    shouldSyncInitialNodeData = true;
    set(nodeModel.properties, 'node_data', cloneDeep(normalizedData));
  }
  return normalizedData;
}

function syncNodeData(
  fields = ['node_data'],
  options: { refreshComponent?: boolean } = {},
) {
  set(nodeModel.properties, 'node_data', cloneDeep(formData.value));
  refreshConditionNode(fields, options);
}

function validateConditionField(prop: string) {
  nextTick(() => {
    ConditionNodeFormRef.value?.validateField(prop).catch(() => undefined);
  });
}

const validate = () => {
  let cascaderRefs: any[] = [];
  if (Array.isArray(nodeCascaderRef.value)) {
    cascaderRefs = nodeCascaderRef.value;
  } else if (nodeCascaderRef.value) {
    cascaderRefs = [nodeCascaderRef.value];
  }
  const v_list = [
    ConditionNodeFormRef.value?.validate(),
    ...cascaderRefs.map((item: any) => item.validate()),
  ].filter(Boolean);
  return Promise.all(v_list).catch((error) => {
    throw Object.assign(new Error(`${error || ''}`), {
      errMessage: error,
      node: nodeModel,
    });
  });
};

function onEnd(event?: any) {
  const { oldIndex, newIndex } = event;
  if (oldIndex === undefined || newIndex === undefined) return;
  const list = cloneDeep(formData.value.branch);
  if (oldIndex === list.length - 1 || newIndex === list.length - 1) {
    syncNodeData(['node_data']);
    return;
  }
  const oldBranch = list[oldIndex];
  const newBranch = list[newIndex];
  if (!oldBranch || !newBranch) return;
  const newInstance: BranchItem = {
    ...oldBranch,
    type: newBranch.type,
    id: newBranch.id,
  };
  const oldInstance: BranchItem = {
    ...newBranch,
    type: oldBranch.type,
    id: oldBranch.id,
  };
  list[newIndex] = newInstance;
  list[oldIndex] = oldInstance;
  formData.value.branch = list;
  syncNodeData(['node_data'], { refreshComponent: false });
  refreshBranchAnchor(list, true, ['node_data', 'branch_condition_list']);
}

function addBranch() {
  const list = cloneDeep(formData.value.branch);
  const obj = {
    conditions: [
      {
        field: [],
        compare: '',
        value: '',
      },
    ],
    type: `ELSE IF ${list.length - 1}`,
    id: randomId(),
    condition: 'and',
  };
  list.splice(-1, 0, obj);
  formData.value.branch = list;
  syncNodeData(['node_data'], { refreshComponent: false });
  refreshBranchAnchor(list, true, ['node_data', 'branch_condition_list']);
  nextTick(syncSortableDisabled);
}

function refreshBranchAnchor(
  list: Array<BranchItem>,
  is_add: boolean,
  fields = ['branch_condition_list'],
) {
  const branch_condition_list = cloneDeep(
    nodeModel.properties.branch_condition_list || [],
  );
  const new_branch_condition_list = list
    .map((item, index) => {
      const find = branch_condition_list.find((b: any) => b.id === item.id);
      if (find) {
        return { index, height: find.height, id: item.id };
      } else {
        if (is_add) {
          return { index, height: 12, id: item.id };
        }
      }
      return undefined;
    })
    .filter(Boolean);

  set(nodeModel.properties, 'branch_condition_list', new_branch_condition_list);
  nodeModel.refreshBranch();
  refreshConditionNode(fields);
}

function addCondition(index: number) {
  const list = cloneDeep(formData.value.branch);
  const branch = list[index];
  if (!branch) return;
  branch.conditions.push({
    field: [],
    compare: '',
    value: '',
  });
  formData.value.branch = list;
  syncNodeData(['node_data']);
}

function deleteCondition(index: number, cIndex: number) {
  const list = cloneDeep(formData.value.branch);
  const branch = list[index];
  if (!branch) return;
  branch.conditions.splice(cIndex, 1);
  if (branch.conditions.length === 0) {
    const delete_edge = list.splice(index, 1);
    const delete_target_anchor_id_list = new Set(
      delete_edge.map((item: BranchItem) => `${nodeModel.id}_${item.id}_right`),
    );
    const deleteEdgeIds = [
      ...(nodeModel.outgoing?.edges || []),
      ...(nodeModel.graphModel?.edges || []),
    ]
      .filter((item: any) =>
        delete_target_anchor_id_list.has(item.sourceAnchorId),
      )
      .map((item: any) => item.id)
      .filter(
        (edgeId: string, edgeIndex: number, edgeIds: string[]) =>
          edgeIds.indexOf(edgeId) === edgeIndex,
      );

    nodeModel.graphModel?.eventCenter?.emit?.('delete_edge', deleteEdgeIds);
    deleteEdgeIds.forEach((edgeId: string) =>
      nodeModel.graphModel?.deleteEdgeById?.(edgeId),
    );
    list.forEach((item: BranchItem, branchIndex: number) => {
      if (item.type === `ELSE IF ${branchIndex + 1}`) {
        item.type = `ELSE IF ${branchIndex}`;
      }
    });
    formData.value.branch = list;
    syncNodeData(['node_data'], { refreshComponent: false });
    refreshBranchAnchor(list, false, ['node_data', 'branch_condition_list']);
  } else {
    formData.value.branch = list;
    syncNodeData(['node_data']);
  }
  nextTick(syncSortableDisabled);
}

function updateBranchCondition(index: number, value: string) {
  const list: BranchItem[] = cloneDeep(formData.value.branch || []);
  if (!list[index]) return;
  set(list, [index, 'condition'], value);
  formData.value.branch = list;
  syncNodeData(['node_data'], { refreshComponent: false });
}

function updateConditionField(index: number, cIndex: number, value: any[]) {
  const list: BranchItem[] = cloneDeep(formData.value.branch || []);
  if (!list[index]?.conditions?.[cIndex]) return;
  set(list, [index, 'conditions', cIndex, 'field'], value || []);
  formData.value.branch = list;
  syncNodeData(['node_data'], { refreshComponent: false });
  validateConditionField(`branch.${index}.conditions.${cIndex}.field`);
}

function updateConditionCompare(index: number, cIndex: number, value: string) {
  const list: BranchItem[] = cloneDeep(formData.value.branch || []);
  const current = list[index]?.conditions?.[cIndex];
  if (!current) return;
  const previousCompare = current.compare;
  set(list, [index, 'conditions', cIndex, 'compare'], value);
  if (emptyValueCompareList.has(value)) {
    set(list, [index, 'conditions', cIndex, 'value'], 1);
  } else if (
    emptyValueCompareList.has(previousCompare) &&
    current.value === 1
  ) {
    set(list, [index, 'conditions', cIndex, 'value'], '');
  }
  formData.value.branch = list;
  syncNodeData(['node_data'], { refreshComponent: false });
  validateConditionField(`branch.${index}.conditions.${cIndex}.compare`);
}

function updateConditionValue(index: number, cIndex: number, value: any) {
  const list: BranchItem[] = cloneDeep(formData.value.branch || []);
  if (!list[index]?.conditions?.[cIndex]) return;
  set(list, [index, 'conditions', cIndex, 'value'], value);
  formData.value.branch = list;
  syncNodeData(['node_data'], { refreshComponent: false });
  validateConditionField(`branch.${index}.conditions.${cIndex}.value`);
}

function setBranchElement(element: any, row: BranchItem, index: number) {
  const htmlElement = element instanceof HTMLElement ? element : element?.$el;
  const previous = branchElements.get(row.id);
  if (previous) resizeObserver?.unobserve(previous);
  if (htmlElement instanceof HTMLElement) {
    htmlElement.dataset.branchId = row.id;
    htmlElement.dataset.branchIndex = `${index}`;
    branchElements.set(row.id, htmlElement);
    resizeObserver?.observe(htmlElement);
    nextTick(() =>
      resizeCondition(
        { height: htmlElement.getBoundingClientRect().height || 12 },
        row,
        index,
      ),
    );
    return;
  }
  branchElements.delete(row.id);
}

function initSortable() {
  if (!draggableRef.value || sortable) return;
  sortable = Sortable.create(draggableRef.value, {
    animation: 150,
    disabled: formData.value.branch.length === 2,
    draggable: '.drag-card:not(.no-drag)',
    ghostClass: 'ghost',
    handle: '.handle',
    onEnd,
  });
}

function syncSortableDisabled() {
  (sortable as any)?.option('disabled', formData.value.branch.length === 2);
}

function randomId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  );
}

watch(
  () => props.renderVersion,
  () => nextTick(syncSortableDisabled),
);

onMounted(() => {
  set(nodeModel, 'validate', validate);
  nextTick(() => {
    initSortable();
    refreshBranchAnchor(
      formData.value.branch,
      true,
      shouldSyncInitialNodeData
        ? ['node_data', 'branch_condition_list']
        : ['branch_condition_list'],
    );
    syncSortableDisabled();
  });
});

onBeforeUnmount(() => {
  sortable?.destroy();
  resizeObserver?.disconnect();
});
</script>

<template>
  <NodeContainer
    :node-model="nodeModel"
    :render-version="nodeRenderVersion + (renderVersion || 0)"
  >
    <ElForm
      ref="ConditionNodeFormRef"
      :model="formData"
      label-position="top"
      require-asterisk-position="right"
      label-width="auto"
      @submit.prevent
    >
      <div ref="draggableRef" class="condition-node-draggable">
        <template v-for="(item, index) in formData.branch" :key="item.id">
          <ElCard
            :ref="(element) => setBranchElement(element, item, Number(index))"
            shadow="never"
            class="drag-card card-never mb-8"
            :class="{
              'no-drag':
                index === formData.branch.length - 1 ||
                formData.branch.length === 2,
            }"
          >
            <div class="handle flex-between lighter">
              <span class="align-center flex">
                <ElIcon class="handle-img mr-4"><Rank /></ElIcon>
                {{ item.type }}
              </span>
              <div v-if="item.conditions.length > 1" class="info">
                <span>满足</span>
                <ElSelect
                  :model-value="item.condition"
                  :teleported="false"
                  size="small"
                  style="width: 60px; margin: 0 8px"
                  @update:model-value="
                    updateBranchCondition(Number(index), $event)
                  "
                >
                  <ElOption label="AND" value="and" />
                  <ElOption label="OR" value="or" />
                </ElSelect>
                <span>条件</span>
              </div>
            </div>
            <div v-if="index !== formData.branch.length - 1" class="mt-8">
              <template
                v-for="(condition, cIndex) in item.conditions"
                :key="cIndex"
              >
                <ElRow :gutter="8">
                  <ElCol :span="11">
                    <ElFormItem
                      :prop="`branch.${index}.conditions.${cIndex}.field`"
                      :rules="{
                        type: 'array',
                        required: true,
                        message: '请选择变量',
                        trigger: 'change',
                      }"
                    >
                      <NodeCascader
                        ref="nodeCascaderRef"
                        :node-model="nodeModel"
                        class="w-full"
                        placeholder="请选择变量"
                        :model-value="condition.field"
                        @update:model-value="
                          updateConditionField(
                            Number(index),
                            Number(cIndex),
                            $event,
                          )
                        "
                      />
                    </ElFormItem>
                  </ElCol>
                  <ElCol :span="6">
                    <ElFormItem
                      :prop="`branch.${index}.conditions.${cIndex}.compare`"
                      :rules="{
                        required: true,
                        message: '请选择比较方式',
                        trigger: 'change',
                      }"
                    >
                      <ElSelect
                        :model-value="condition.compare"
                        :teleported="false"
                        placeholder="请选择比较方式"
                        clearable
                        @update:model-value="
                          updateConditionCompare(
                            Number(index),
                            Number(cIndex),
                            $event,
                          )
                        "
                        @wheel="wheel"
                      >
                        <template
                          v-for="(compareItem, compareIndex) in compareList"
                          :key="compareIndex"
                        >
                          <ElOption
                            :label="compareItem.label"
                            :value="compareItem.value"
                          />
                        </template>
                      </ElSelect>
                    </ElFormItem>
                  </ElCol>
                  <ElCol :span="6">
                    <ElFormItem
                      v-if="!emptyValueCompareList.has(condition.compare)"
                      :prop="`branch.${index}.conditions.${cIndex}.value`"
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
                          updateConditionValue(
                            Number(index),
                            Number(cIndex),
                            $event,
                          )
                        "
                      />
                    </ElFormItem>
                  </ElCol>
                  <ElCol :span="1">
                    <ElButton
                      :disabled="
                        formData.branch.length === 2 &&
                        item.conditions.length === 1
                      "
                      link
                      type="info"
                      class="mt-4"
                      @click="deleteCondition(Number(index), Number(cIndex))"
                    >
                      <ElIcon><Delete /></ElIcon>
                    </ElButton>
                  </ElCol>
                </ElRow>
              </template>
            </div>

            <ElButton
              v-if="index !== formData.branch.length - 1"
              link
              type="primary"
              @click="addCondition(Number(index))"
            >
              <ElIcon class="mr-4"><Plus /></ElIcon>
              添加条件
            </ElButton>
          </ElCard>
        </template>
      </div>
      <ElButton link type="primary" @click="addBranch">
        <ElIcon class="mr-4"><Plus /></ElIcon>
        新增分支
      </ElButton>
    </ElForm>
  </NodeContainer>
</template>

<style lang="scss" scoped>
.condition-node-draggable {
  display: grid;
  gap: 8px;
}

.condition-node-draggable :deep(.el-row + .el-row) {
  margin-top: 8px;
}

.drag-card {
  --el-card-padding: 12px;

  overflow: visible;
  border-left: 3px solid var(--el-color-success);
}

.drag-card :deep(.el-card__body) {
  overflow: visible;
}

.drag-card.no-drag {
  border-left-color: var(--el-color-warning);
}

.handle {
  cursor: move;
}

.no-drag .handle {
  cursor: default;
}

.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.flex {
  display: flex;
}

.align-center {
  align-items: center;
}

.lighter {
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.info {
  display: flex;
  align-items: center;
}

.mb-8 {
  margin-bottom: 8px;
}

.mt-4 {
  margin-top: 4px;
}

.mt-8 {
  margin-top: 8px;
}

.mr-4 {
  margin-right: 4px;
}

.w-full {
  width: 100%;
}

.ghost {
  opacity: 0.45;
}
</style>
