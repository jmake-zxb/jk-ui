<script>
import { Delete, Plus, Rank, Sort } from '@element-plus/icons-vue';
import {
  ElButton,
  ElIcon,
  ElTable,
  ElTableColumn,
  ElTooltip,
} from 'element-plus';
import Sortable from 'sortablejs';

export default {
  components: {
    ElTable,
    ElTableColumn,
    ElTooltip,
    ElButton,
    ElIcon,
    Plus,
    Delete,
    Rank,
    Sort,
  },
  props: {
    /**
     * 表格数据
     */
    modelValue: { type: Array, default: () => [] },
    /**
     * 新增行模板
     */
    addTemplate: { type: Object, default: () => {} },
    /**
     * 无数据时的提示语
     */
    placeholder: { type: String, default: '暂无数据' },
    /**
     * 是否启用拖拽排序
     */
    dragSort: { type: Boolean, default: false },
    /**
     * 是否隐藏新增按钮
     */
    hideAdd: { type: Boolean, default: false },
    /**
     * 是否隐藏删除按钮
     */
    hideDelete: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'delete'],
  data() {
    return {
      /**
       * 表格数据
       */
      data: [],
    };
  },
  watch: {
    modelValue() {
      this.data = this.modelValue;
    },
    data: {
      handler() {
        /**
         * 更新表格数据
         * @event update:modelValue
         * @type {Array}
         */
        this.$emit('update:modelValue', this.data);
      },
      deep: true,
    },
  },
  mounted() {
    this.data = this.modelValue;
    if (this.dragSort) {
      this.rowDrop();
    }
  },
  methods: {
    /**
     * 启用表格行拖拽排序
     */
    rowDrop() {
      // eslint-disable-next-line unicorn/no-this-assignment
      const _this = this;
      const tbody = this.$refs.table.$el.querySelector(
        '.el-table__body-wrapper tbody',
      );
      Sortable.create(tbody, {
        handle: '.move',
        animation: 300,
        ghostClass: 'ghost',
        onEnd({ newIndex, oldIndex }) {
          _this.data.splice(newIndex, 0, _this.data.splice(oldIndex, 1)[0]);
          const newArray = [..._this.data];
          const tmpHeight = _this.$refs.scFormTable.offsetHeight;
          _this.$refs.scFormTable.style.setProperty('height', `${tmpHeight}px`);
          _this.data = [];
          _this.$nextTick(() => {
            _this.data = newArray;
            _this.$nextTick(() => {
              _this.$refs.scFormTable.style.removeProperty('height');
            });
          });
        },
      });
    },
    /**
     * 新增一行
     */
    rowAdd() {
      const temp = structuredClone(this.addTemplate);
      this.data.push(temp);
    },
    /**
     * 删除一行
     * @param {object} row - 要删除的行数据
     * @param {number} index - 要删除的行的索引
     */
    rowDel(row, index) {
      this.data.splice(index, 1);
      this.$emit('delete', row);
    },
    /**
     * 插入一行
     * @param {object} row - 要插入的行数据，默认为新增行模板
     */
    pushRow(row) {
      const temp = row || structuredClone(this.addTemplate);
      this.data.push(temp);
    },
    /**
     * 根据索引删除一行
     * @param {number} index - 要删除的行的索引
     */
    deleteRow(index) {
      this.data.splice(index, 1);
    },
  },
};
</script>

<template>
  <div class="form-table" ref="scFormTable">
    <ElTable
      :data="data"
      ref="table"
      border
      stripe
      :cell-style="{ textAlign: 'center' }"
      :header-cell-style="{
        textAlign: 'center',
        background: 'var(--el-table-row-hover-bg-color)',
        color: 'var(--el-text-color-primary)',
      }"
    >
      <ElTableColumn type="index" width="50" fixed="left">
        <template #header>
          <ElButton v-if="!hideAdd" type="text" @click="rowAdd">
            <ElIcon><Plus /></ElIcon>
          </ElButton>
          <ElTooltip v-else content="序号" placement="top"> # </ElTooltip>
        </template>
        <template #default="scope">
          <div
            class="form-table-handle"
            :class="[{ 'form-table-handle-delete': !hideDelete }]"
          >
            <span>{{ scope.$index + 1 }}</span>
            <ElButton
              v-if="!hideDelete"
              type="text"
              @click="rowDel(scope.row, scope.$index)"
            >
              <ElIcon><Delete /></ElIcon>
            </ElButton>
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="" width="50" v-if="dragSort">
        <template #header>
          <ElTooltip content="拖动排序" placement="top">
            <ElIcon><Rank /></ElIcon>
          </ElTooltip>
        </template>
        <template #default>
          <div class="move" style="cursor: move">
            <ElIcon><Sort /></ElIcon>
          </div>
        </template>
      </ElTableColumn>
      <slot></slot>
      <template #empty>
        {{ placeholder }}
      </template>
    </ElTable>
  </div>
</template>

<style scoped>
.form-table {
  width: 100%;
}

.form-table .form-table-handle {
  text-align: center;
}

.form-table .form-table-handle span {
  display: inline-block;
}

.form-table .form-table-handle button {
  display: none;
}

.form-table .hover-row .form-table-handle-delete span {
  display: none;
}

.form-table .hover-row .form-table-handle-delete button {
  display: inline-block;
}

.form-table .move {
  margin-top: 3px;
  font-size: 14px;
  text-align: center;
}
</style>
