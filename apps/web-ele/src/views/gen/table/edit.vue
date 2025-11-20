<script setup lang="ts">
import { defineAsyncComponent, nextTick, onMounted, reactive, ref } from 'vue';

import { VbenIcon, VbenIconButton } from '@vben/common-ui';

import {
  ElCheckbox,
  ElInput,
  ElOption,
  ElSelect,
  ElTableColumn,
  ElTabPane,
  ElTabs,
} from 'element-plus';
import Sortable from 'sortablejs';

import { list } from '#/api/gen/fieldtype';
import {
  fetchDictList,
  useTableApi,
  useTableFieldSubmitApi,
} from '#/api/gen/table';

const props = defineProps({
  tableName: {
    type: String,
    default: '',
  },
  dsName: {
    type: String,
    default: '',
  },
});
const scFormTable = defineAsyncComponent(
  () => import('#/component/FormTable/index.vue'),
);
const FormDialog = defineAsyncComponent(() => import('./add-dict.vue'));

const activeName = ref();
const tableId = ref('');

const visible = ref(false);

const sortable = ref() as any;

const formDialogRef = ref();
const fieldTable = ref();
const gridTable = ref();
const formTable = ref();

const typeList = ref([]) as any;
const fieldDictList = ref([]) as any;
const selectRow = ref();
const dsNameValue = ref();
const tableNameValue = ref();

const fieldList: any = ref([]);
const fillList = reactive([
  { label: 'DEFAULT', value: 'DEFAULT' },
  { label: 'INSERT', value: 'INSERT' },
  { label: 'UPDATE', value: 'UPDATE' },
  { label: 'INSERT_UPDATE', value: 'INSERT_UPDATE' },
]);

const queryList = reactive([
  { label: '=', value: '=' },
  { label: '!=', value: '!=' },
  { label: '>', value: '>' },
  { label: '>=', value: '>=' },
  { label: '<', value: '<' },
  { label: '<=', value: '<=' },
  { label: 'like', value: 'like' },
  { label: 'left like', value: 'left like' },
  { label: 'right like', value: 'right like' },
]);

const formTypeList = reactive([
  { label: '单行文本', value: 'text' },
  { label: '多行文本', value: 'textarea' },
  { label: '数字', value: 'number' },
  { label: '富文本编辑器', value: 'editor' },
  { label: '下拉框', value: 'select' },
  { label: '单选按钮', value: 'radio' },
  { label: '复选框', value: 'checkbox' },
  { label: '日期', value: 'date' },
  { label: '日期时间', value: 'datetime' },
  { label: '文件上传', value: 'upload-file' },
  { label: '图片上传', value: 'upload-img' },
]);

const queryTypeList = reactive([
  { label: '单行文本', value: 'text' },
  { label: '多行文本', value: 'textarea' },
  { label: '数字', value: 'number' },
  { label: '下拉框', value: 'select' },
  { label: '单选按钮', value: 'radio' },
  { label: '复选框', value: 'checkbox' },
  { label: '日期', value: 'date' },
  { label: '日期时间', value: 'datetime' },
]);

const formValidatorList = reactive([
  { label: '去重', value: 'duplicate' },
  { label: '数字', value: 'number' },
  { label: '字母', value: 'letter' },
  { label: '字母和数字', value: 'letterAndNumber' },
  { label: '手机号码', value: 'mobilePhone' },
  { label: '字母开头，仅可包含数字', value: 'letterStartNumberIncluded' },
  { label: '禁止中文输入', value: 'noChinese' },
  { label: '必须中文输入', value: 'chinese' },
  { label: '电子邮箱', value: 'email' },
  { label: 'URL网址', value: 'url' },
]);

const propToType: Record<string, any> = reactive({
  tinyint: 'number',
  smallint: 'number',
  mediumint: 'number',
  int: 'number',
  integer: 'number',
  bigint: 'number',
  float: 'number',
  datetime: 'datetime',
  LocalDateTime: 'datetime',
  date: 'date',
  LocalDate: 'date',
  Long: 'number',
  Float: 'number',
  Double: 'number',
  BigDecimal: 'number',
  text: 'textarea',
  String: 'text',
  longtext: 'editor',
  bit: 'radio',
  Boolean: 'radio',
  char: 'radio',
  varchar: 'text',
});

/**
 * 属性修改触发事件
 * @param row
 */
const handleChangeRow = (row: any) => {
  row.queryFormType = propToType[row.attrType];
  row.formType = propToType[row.attrType];
};

/**
 * 添加字典
 * @param row
 */
const handleAddDict = (row: object) => {
  selectRow.value = row;
  formDialogRef.value.openDialog();
};

/**
 * 刷新字典
 * @param dictType
 */
const handleDictRefresh = async (dictType: string) => {
  await getDictList();
  selectRow.value.fieldDict = dictType;
};

const openDialog = (dName: string, tName: string) => {
  visible.value = true;
  tableNameValue.value = tName;
  dsNameValue.value = dName;

  activeName.value = 'field';

  rowDrop();
  getTable(dName, tName);
  getFieldTypeList();
  getDictList();
};

onMounted(() => {
  tableNameValue.value = String(props.tableName);
  dsNameValue.value = String(props.dsName);
  activeName.value = 'field';
  rowDrop();
  getTable(dsNameValue.value, tableNameValue.value);
  getFieldTypeList();
  getDictList();
});

const rowDrop = () => {
  nextTick(() => {
    const el: any = window.document.querySelector('#pane-field');
    sortable.value = Sortable.create(el, {
      handle: '.drag-btn',
      onEnd: (e: any) => {
        const { newIndex, oldIndex } = e;
        const currRow = fieldList.value.splice(oldIndex, 1)[0];
        fieldList.value.splice(newIndex, 0, currRow);
      },
    });
  });
};
const loading = ref(false);

const getTable = (dsName: string, tableName: string) => {
  fieldList.value = []; // 避免第一次数据初始化， 表格显示历史数据
  loading.value = true;
  useTableApi(dsName, tableName)
    .then((res) => {
      tableId.value = res.id;
      fieldList.value = res.fieldList.map(
        (item: {
          fieldType: number | string;
          formType: any;
          queryFormType: any;
        }) => {
          // eslint-disable-next-line no-unused-expressions
          item.queryFormType ?? propToType[item.fieldType];
          // eslint-disable-next-line no-unused-expressions
          item.formType ?? propToType[item.fieldType];
          return item;
        },
      );
    })
    .finally(() => {
      loading.value = false;
    });
};

const getFieldTypeList = async () => {
  typeList.value = [];
  // 获取数据
  const data = await list();
  // 设置属性类型值
  const typeMap = new Map();
  data.forEach((item: any) => {
    const { attrType, columnType } = item;
    if (!typeMap.has(attrType)) {
      typeMap.set(attrType, columnType);
      typeList.value.push({ label: attrType, value: attrType });
    }
  });
  // 增加Object类型
  typeList.value.push({ label: 'Object', value: 'Object' });
};

const getDictList = () => {
  fetchDictList().then((res) => {
    for (const item of res) {
      fieldDictList.value.push({
        label: item.description,
        value: item.dictType,
      });
    }
  });
};

// 表单提交
const submitHandle = () => {
  return new Promise((resolve) => {
    useTableFieldSubmitApi(
      dsNameValue.value,
      tableNameValue.value,
      fieldList.value,
    ).then(() => {
      resolve(tableId.value);
    });
  });
};

defineExpose({
  openDialog,
  submitHandle,
});
</script>

<template>
  <ElTabs v-model="activeName">
    <!-- 属性设置面板 -->
    <ElTabPane label="属性设置" name="field">
      <sc-form-table
        ref="fieldTable"
        v-model="fieldList"
        :hide-add="true"
        :hide-delete="true"
        drag-sort
        placeholder="暂无数据"
      >
        <ElTableColumn
          label="主键"
          prop="primaryPk"
          width="80"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <ElCheckbox
              v-model="row.primaryPk"
              true-value="1"
              false-value="0"
              disabled
            />
          </template>
        </ElTableColumn>
        <ElTableColumn label="字段名" prop="fieldName" show-overflow-tooltip />
        <ElTableColumn label="说明" prop="fieldComment" show-overflow-tooltip>
          <template #default="{ row }">
            <ElInput v-model="row.fieldComment" placeholder="请输入说明" />
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="字段类型"
          prop="fieldType"
          show-overflow-tooltip
        />
        <ElTableColumn label="属性名" prop="attrName" show-overflow-tooltip>
          <template #default="{ row }">
            <ElInput v-model="row.attrName" placeholder="请输入属性名" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="属性类型" prop="attrType" show-overflow-tooltip>
          <template #default="{ row }">
            <ElSelect
              v-model="row.attrType"
              placeholder="请选择属性类型"
              @change="handleChangeRow(row)"
            >
              <ElOption
                v-for="item in typeList"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
          </template>
        </ElTableColumn>
        <ElTableColumn label="自动填充" prop="autoFill" show-overflow-tooltip>
          <template #default="{ row }">
            <ElSelect v-model="row.autoFill" placeholder="请选择类型">
              <ElOption
                v-for="item in fillList"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
          </template>
        </ElTableColumn>
        <ElTableColumn label="字典名称" prop="fieldDict" show-overflow-tooltip>
          <template #default="{ row }">
            <ElSelect
              v-model="row.fieldDict"
              placeholder="请选择类型"
              filterable
              clearable
              :disabled="row.primaryPk === '1'"
            >
              <template #prefix>
                <VbenIconButton variant="link" @click.stop="handleAddDict(row)">
                  <VbenIcon icon="ant-design:plus-outlined" />
                </VbenIconButton>
              </template>
              <ElOption
                v-for="item in fieldDictList"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
          </template>
        </ElTableColumn>
      </sc-form-table>
    </ElTabPane>
    <!-- 列表设置面板 -->
    <ElTabPane label="列表查询" name="third">
      <sc-form-table
        ref="gridTable"
        v-model="fieldList"
        :hide-add="true"
        :hide-delete="true"
        placeholder="暂无数据"
      >
        <ElTableColumn label="属性名" prop="attrName" show-overflow-tooltip />
        <ElTableColumn label="说明" prop="fieldComment" show-overflow-tooltip />
        <ElTableColumn
          label="列表显示"
          prop="gridItem"
          width="100"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <ElCheckbox
              v-model="row.gridItem"
              true-value="1"
              false-value="0"
              :disabled="row.primaryPk === '1'"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="是否排序"
          prop="gridSort"
          width="100"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <ElCheckbox
              v-model="row.gridSort"
              true-value="1"
              false-value="0"
              :disabled="row.primaryPk === '1'"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="查询显示"
          prop="gridSort"
          width="100"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <ElCheckbox
              v-model="row.queryItem"
              true-value="1"
              false-value="0"
              :disabled="row.primaryPk === '1'"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="查询表单类型"
          prop="queryFormType"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <ElSelect
              v-model="row.queryFormType"
              placeholder="请选择查询表单类型"
              :disabled="row.primaryPk === '1'"
            >
              <ElOption
                v-for="item in queryTypeList"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
          </template>
        </ElTableColumn>
        <ElTableColumn label="查询方式" prop="queryType" show-overflow-tooltip>
          <template #default="{ row }">
            <ElSelect
              v-model="row.queryType"
              placeholder="请选择查询方式"
              :disabled="row.primaryPk === '1'"
            >
              <ElOption
                v-for="item in queryList"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
          </template>
        </ElTableColumn>
      </sc-form-table>
    </ElTabPane>
    <ElTabPane label="表单页面" name="form">
      <sc-form-table
        ref="formTable"
        v-model="fieldList"
        :hide-add="true"
        :hide-delete="true"
        placeholder="暂无数据"
      >
        <ElTableColumn label="属性名" prop="attrName" show-overflow-tooltip />
        <ElTableColumn label="说明" prop="fieldComment" show-overflow-tooltip />
        <ElTableColumn label="表单类型" prop="formType" show-overflow-tooltip>
          <template #default="{ row }">
            <ElSelect
              v-model="row.formType"
              placeholder="请选择表单类型"
              :disabled="row.primaryPk === '1'"
            >
              <ElOption
                v-for="item in formTypeList"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="是否显示"
          prop="formItem"
          width="100"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <ElCheckbox
              v-model="row.formItem"
              true-value="1"
              false-value="0"
              :disabled="row.primaryPk === '1'"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="表单必填"
          prop="formRequired"
          width="100"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <ElCheckbox
              v-model="row.formRequired"
              true-value="1"
              false-value="0"
              :disabled="row.primaryPk === '1'"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="表单效验"
          prop="formValidator"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <ElSelect
              v-model="row.formValidator"
              placeholder="请选择表单效验"
              :disabled="row.primaryPk === '1'"
            >
              <ElOption
                v-for="item in formValidatorList"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
          </template>
        </ElTableColumn>
      </sc-form-table>
    </ElTabPane>
  </ElTabs>

  <!-- 新增字典  -->
  <FormDialog ref="formDialogRef" @refresh="handleDictRefresh" />
</template>

<style lang="scss">
.sortable-row-gen .drag-btn {
  font-size: 12px;
  cursor: move;
}

.sortable-row-gen .vxe-body--row.sortable-ghost,
.sortable-row-gen .vxe-body--row.sortable-chosen {
  background-color: #dfecfb;
}

.vxe-select-panel {
  z-index: 9997 !important;
}
</style>
