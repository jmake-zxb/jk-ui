<script setup lang="ts" name="query-tree">
import { computed, onMounted, reactive, ref, unref } from 'vue';

import { Fold, More } from '@element-plus/icons-vue';
import {
  ElButton,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElIcon,
  ElInput,
  ElMessage,
  ElTree,
} from 'element-plus';

const props = defineProps({
  /**
   * 树结构属性配置。
   *
   * @default { label: 'name', children: 'children', value: 'id' }
   */
  props: {
    type: Object,
    default: () => {
      return {
        label: 'name',
        children: 'children',
        value: 'id',
      };
    },
  },

  /**
   * 输入框占位符。
   *
   * @default ''
   */
  placeholder: {
    type: String,
    default: '',
  },

  /**
   * 是否显示加载中状态。
   *
   * @default false
   */
  loading: {
    type: Boolean,
    default: false,
  },

  /**
   * 查询函数，必须返回 Promise 类型数据。
   */
  query: {
    type: Function,
    required: true,
  },

  /**
   * 是否显示折叠控制
   */
  showExpand: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['search', 'nodeClick']);

const state = reactive({
  List: [], // 树形结构列表数据
  localLoading: props.loading, // 是否加载中
});

const deptTreeRef = ref(); // 部门树形结构组件实例引用
const searchName = ref(); // 查询关键字
const isExpand = ref(true); // 是否展开所有节点

const buttonClass = computed(() => {
  return [
    '!h-[20px]',
    'reset-margin',
    '!text-gray-500',
    'dark:!text-white',
    'dark:hover:!text-primary',
  ];
});

/**
 * 点击树形结构节点触发的事件。
 *
 * @param item 被点击的节点数据。
 */
const handleNodeClick = (item: any) => {
  emit('nodeClick', item);
};

/**
 * 获取部门树形结构数据。
 */
const getdeptTree = () => {
  if (typeof props.query === 'function') {
    state.localLoading = true;

    // 调用传入的查询函数，并将查询关键字作为参数传入
    const result = props.query(unref(searchName));

    // 如果查询结果为 Promise 类型，则进行后续处理
    if (
      (typeof result === 'object' || typeof result === 'function') &&
      typeof result.then === 'function'
    ) {
      result
        .then((r: any) => {
          state.List = r;
        })
        .catch((error: any) => {
          ElMessage.error(error.msg);
        });
    }
  }
};

/**
 * 切换所有节点的展开/收起状态。
 *
 * @param status 目标状态，true 为展开，false 为收起。
 */
const toggleRowExpansionAll = (status: boolean) => {
  isExpand.value = status;
  const nodes = deptTreeRef.value.store._getAllNodes();
  for (const node of nodes) {
    node.expanded = status;
  }
};

onMounted(() => {
  getdeptTree();
});

// 方便父组件调用刷新树方法
defineExpose({
  getdeptTree,
});
</script>

<template>
  <div class="head-container">
    <div class="head-container-header">
      <div class="head-container-header-input">
        <ElInput
          v-model="searchName"
          suffix-icon="search"
          :placeholder="placeholder"
          clearable
          @change="getdeptTree"
        />
      </div>
      <div class="head-container-header-dropdown" v-if="showExpand">
        <ElDropdown :hide-on-click="false">
          <ElIcon><More /></ElIcon>
          <template #dropdown>
            <ElDropdownMenu>
              <ElDropdownItem>
                <ElButton
                  :class="buttonClass"
                  link
                  type="primary"
                  @click="toggleRowExpansionAll(isExpand ? false : true)"
                >
                  <ElIcon><Fold /></ElIcon>
                  {{ isExpand ? '折叠' : '展开' }}
                </ElButton>
              </ElDropdownItem>
            </ElDropdownMenu>
          </template>
        </ElDropdown>
      </div>
    </div>
    <ElTree
      class="mt20"
      :data="state.List"
      :props="props.props"
      :expand-on-click-node="false"
      ref="deptTreeRef"
      :loading="state.localLoading"
      node-key="id"
      highlight-current
      default-expand-all
      @node-click="handleNodeClick"
    >
      <template #default="{ node, data }" v-if="$slots.default">
        <slot :node="node" :data="data"></slot>
      </template>
    </ElTree>
  </div>
</template>
<style lang="scss" scoped>
.head-container {
  &-header {
    display: flex;
    align-items: center;

    &-input {
      width: 90%;
      margin-bottom: 10px;
    }

    &-dropdown {
      flex: 1;
      margin-left: 5%;
    }
  }
}
</style>
