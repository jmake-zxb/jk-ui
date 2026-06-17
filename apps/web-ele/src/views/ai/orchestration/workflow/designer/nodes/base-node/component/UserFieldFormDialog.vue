<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import { computed, nextTick, ref, watch } from 'vue';

import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTag,
} from 'element-plus';

import {
  cloneValue,
  compareOptions,
  fieldLabel,
  inputTypeList,
  normalizeList,
  optionInputTypes,
} from './base-node-utils';

type UserFieldFormState = Record<string, any> & {
  default_value: any;
  option_list: Array<{ label: string; value: string }>;
  visibility_rules: {
    conditions: Array<Record<string, any>>;
    relation: string;
  };
};

const props = defineProps<{
  currentNodeFields?: any[];
  nodeModel?: any;
}>();
const emit = defineEmits<{
  refresh: [data: Record<string, any>, index: null | number];
}>();

const dialogVisible = ref(false);
const fieldFormRef = ref<FormInstance>();
const treeOptionsPlaceholder = '例如 [{"label":"选项","value":"value"}]';
const isEdit = ref(false);
const currentIndex = ref<null | number>(null);
const optionInputVisible = ref(false);
const optionForm = ref({ label: '', value: '' });
const form = ref<UserFieldFormState>(defaultForm());

const currentFields = computed(() =>
  normalizeList(props.currentNodeFields).filter(
    (_field, index) => index !== currentIndex.value,
  ),
);
const showOptions = computed(() => optionInputTypes.has(form.value.input_type));
const showDefaultValue = computed(
  () => form.value.input_type !== 'SwitchInput',
);
const rules = {
  field: [
    { message: '请输入字段名', required: true, trigger: 'blur' },
    {
      message: '仅支持字母、数字、下划线',
      pattern: /^\w+$/,
      trigger: 'blur',
    },
  ],
  label: [{ message: '请输入名称', required: true, trigger: 'blur' }],
};

function defaultForm(): UserFieldFormState {
  return {
    assignment_method: 'user_input',
    attrs: {
      maxlength: 200,
      minlength: 0,
      placeholder: '',
      type: 'datetime',
      'value-format': 'YYYY-MM-DD HH:mm:ss',
    },
    default_value: '',
    field: '',
    input_type: 'TextInput',
    label: '',
    option_list: [] as Array<{ label: string; value: string }>,
    required: false,
    show_default_value: true,
    visibility_rules: {
      conditions: [] as Array<Record<string, any>>,
      relation: 'and',
    },
  };
}

function normalizeField(row: any) {
  const next = { ...defaultForm(), ...cloneValue(row || {}) };
  next.field = next.field || next.variable || '';
  next.label = fieldLabel(next);
  next.required =
    next.required === undefined ? !!next.is_required : !!next.required;
  next.input_type = next.input_type || 'TextInput';
  next.attrs = { ...defaultForm().attrs, ...next.attrs };
  next.option_list = normalizeList(next.option_list || next.optionList).map(
    (item: any) => ({
      label: item.label || item.key || item.value || '',
      value: item.value || item.key || item.label || '',
    }),
  );
  next.visibility_rules = {
    conditions: normalizeList(next.visibility_rules?.conditions),
    relation: next.visibility_rules?.relation || 'and',
  };
  return next;
}

watch(dialogVisible, (visible) => {
  if (visible) return;
  form.value = defaultForm();
  isEdit.value = false;
  currentIndex.value = null;
  optionInputVisible.value = false;
  optionForm.value = { label: '', value: '' };
});

function open(row?: any, index?: number) {
  form.value = normalizeField(row);
  isEdit.value = !!row;
  currentIndex.value = row ? (index ?? null) : null;
  dialogVisible.value = true;
}

function close() {
  dialogVisible.value = false;
}

function addOption() {
  const value = optionForm.value.value.trim();
  const label = optionForm.value.label.trim() || value;
  if (!value || form.value.option_list.some((item) => item.value === value))
    return;
  form.value.option_list.push({ label, value });
  optionForm.value = { label: '', value: '' };
  optionInputVisible.value = false;
}

function removeOption(value: string) {
  form.value.option_list = form.value.option_list.filter(
    (item) => item.value !== value,
  );
  if (Array.isArray(form.value.default_value)) {
    form.value.default_value = form.value.default_value.filter(
      (item: string) => item !== value,
    );
  } else if (form.value.default_value === value) {
    form.value.default_value = '';
  }
}

function addVisibilityCondition() {
  form.value.visibility_rules.conditions.push({
    compare: 'eq',
    field: ['', ''],
    value: '',
  });
}

function removeVisibilityCondition(index: number) {
  form.value.visibility_rules.conditions.splice(index, 1);
}

function buildSubmitData() {
  const data: Record<string, any> = cloneValue(form.value);
  data.field = data.field.trim();
  data.is_required = !!data.required;
  data.assignment_method = 'user_input';
  if (!showOptions.value) data.option_list = [];
  if (data.input_type === 'SwitchInput' && data.default_value === '')
    data.default_value = false;
  return data;
}

async function submit() {
  const formEl = fieldFormRef.value;
  if (!formEl) return;
  try {
    await formEl.validate();
  } catch {
    return;
  }
  const data = buildSubmitData();
  const index = currentIndex.value;
  dialogVisible.value = false;
  await nextTick();
  emit('refresh', data, index);
}

defineExpose({ close, open });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑参数' : '添加参数'"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    append-to-body
    width="680"
  >
    <ElForm
      ref="fieldFormRef"
      :model="form"
      :rules="rules"
      label-position="top"
      @submit.prevent
    >
      <div class="user-field-form__grid">
        <ElFormItem label="字段" prop="field">
          <ElInput
            v-model="form.field"
            maxlength="64"
            placeholder="请输入字段名"
            show-word-limit
            @blur="form.field = form.field.trim()"
          />
        </ElFormItem>
        <ElFormItem label="名称" prop="label">
          <ElInput
            v-model="form.label"
            maxlength="64"
            placeholder="请输入名称"
            show-word-limit
          />
        </ElFormItem>
      </div>
      <div class="user-field-form__grid">
        <ElFormItem label="控件类型">
          <ElSelect v-model="form.input_type" :teleported="false">
            <ElOption
              v-for="item in inputTypeList"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="必填">
          <ElSwitch v-model="form.required" size="small" />
        </ElFormItem>
      </div>
      <ElFormItem label="占位提示">
        <ElInput
          v-model="form.attrs.placeholder"
          maxlength="120"
          placeholder="请输入占位提示"
        />
      </ElFormItem>
      <div
        v-if="
          ['TextInput', 'PasswordInput', 'TextareaInput', 'MultiRow'].includes(
            form.input_type,
          )
        "
        class="user-field-form__grid"
      >
        <ElFormItem label="最小长度">
          <ElInput v-model.number="form.attrs.minlength" type="number" />
        </ElFormItem>
        <ElFormItem label="最大长度">
          <ElInput v-model.number="form.attrs.maxlength" type="number" />
        </ElFormItem>
      </div>
      <div
        v-if="form.input_type === 'DatePicker'"
        class="user-field-form__grid"
      >
        <ElFormItem label="日期类型">
          <ElSelect
            v-model="form.attrs.type"
            :teleported="false"
            placeholder="请选择日期类型"
          >
            <ElOption label="日期时间" value="datetime" />
            <ElOption label="日期" value="date" />
            <ElOption label="月份" value="month" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="值格式">
          <ElInput
            v-model="form.attrs['value-format']"
            placeholder="YYYY-MM-DD HH:mm:ss"
          />
        </ElFormItem>
      </div>
      <div v-if="form.input_type === 'Model'" class="user-field-form__grid">
        <ElFormItem label="模型类型">
          <ElSelect
            v-model="form.attrs.model_type"
            :teleported="false"
            placeholder="请选择模型类型"
          >
            <ElOption label="LLM" value="LLM" />
            <ElOption label="EMBEDDING" value="EMBEDDING" />
            <ElOption label="重排模型" value="RERANKER" />
            <ElOption label="STT" value="STT" />
            <ElOption label="TTS" value="TTS" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="默认模型 ID">
          <ElInput
            v-model="form.default_value"
            placeholder="可选，默认模型 ID"
          />
        </ElFormItem>
      </div>
      <div v-if="form.input_type === 'Knowledge'" class="user-field-form__grid">
        <ElFormItem label="选择模式">
          <ElSwitch
            v-model="form.attrs.multiple"
            active-text="多选"
            inactive-text="单选"
          />
        </ElFormItem>
        <ElFormItem label="默认知识库 ID">
          <ElInput
            v-model="form.default_value"
            placeholder="多个 ID 用逗号分隔"
          />
        </ElFormItem>
      </div>
      <ElFormItem v-if="form.input_type === 'TreeSelect'" label="树选项 JSON">
        <ElInput
          v-model="form.attrs.options_json"
          type="textarea"
          :rows="4"
          :placeholder="treeOptionsPlaceholder"
        />
      </ElFormItem>
      <ElFormItem v-if="showOptions" label="选项">
        <div class="user-field-form__options">
          <div class="user-field-form__tags">
            <ElTag
              v-for="item in form.option_list"
              :key="item.value"
              closable
              type="info"
              @close="removeOption(item.value)"
            >
              {{ item.label }} / {{ item.value }}
            </ElTag>
          </div>
          <div v-if="optionInputVisible" class="user-field-form__option-row">
            <ElInput v-model="optionForm.label" placeholder="名称" />
            <ElInput
              v-model="optionForm.value"
              placeholder="值"
              @keyup.enter="addOption"
            />
            <ElButton type="primary" @click="addOption">确定</ElButton>
          </div>
          <ElButton
            v-else
            plain
            type="primary"
            @click="optionInputVisible = true"
          >
            添加选项
          </ElButton>
        </div>
      </ElFormItem>
      <ElFormItem v-if="showDefaultValue" label="默认值">
        <ElSelect
          v-if="showOptions"
          v-model="form.default_value"
          :multiple="form.input_type === 'MultiSelect'"
          :teleported="false"
          clearable
          placeholder="请选择默认值"
        >
          <ElOption
            v-for="item in form.option_list"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </ElSelect>
        <ElInput
          v-else
          v-model="form.default_value"
          placeholder="请输入默认值"
        />
      </ElFormItem>
      <ElFormItem label="显示条件">
        <div class="user-field-form__visibility">
          <div class="user-field-form__visibility-head">
            <ElSelect
              v-model="form.visibility_rules.relation"
              :teleported="false"
              style="width: 120px"
            >
              <ElOption label="全部满足" value="and" />
              <ElOption label="任一满足" value="or" />
            </ElSelect>
            <ElButton link type="primary" @click="addVisibilityCondition">
              添加条件
            </ElButton>
          </div>
          <div
            v-for="(condition, index) in form.visibility_rules.conditions"
            :key="index"
            class="user-field-form__condition"
          >
            <ElSelect
              v-model="condition.field"
              :teleported="false"
              placeholder="选择字段"
            >
              <ElOption
                v-for="item in currentFields"
                :key="item.field"
                :label="fieldLabel(item)"
                :value="['base-node', item.field]"
              />
            </ElSelect>
            <ElSelect v-model="condition.compare" :teleported="false">
              <ElOption
                v-for="item in compareOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
            <ElInput
              v-if="!['is_null', 'is_not_null'].includes(condition.compare)"
              v-model="condition.value"
              placeholder="比较值"
            />
            <ElButton
              link
              type="danger"
              @click="removeVisibilityCondition(index)"
            >
              删除
            </ElButton>
          </div>
        </div>
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="close">取消</ElButton>
      <ElButton type="primary" @click="submit">
        {{ isEdit ? '保存' : '添加' }}
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped lang="scss">
.user-field-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.user-field-form__options,
.user-field-form__visibility {
  display: grid;
  gap: 8px;
  width: 100%;
}

.user-field-form__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.user-field-form__option-row,
.user-field-form__condition {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.user-field-form__condition {
  grid-template-columns: minmax(0, 1.1fr) 110px minmax(0, 1fr) auto;
}

.user-field-form__visibility-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
