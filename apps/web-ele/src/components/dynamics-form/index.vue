<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import type { Ref } from 'vue';

import type { Dict, FormField } from './type';
import type { VisibilityRules } from './visibility';

import { computed, nextTick, onBeforeMount, ref, watch } from 'vue';

import { ElForm } from 'element-plus';
import { cloneDeep, get } from 'lodash-es';

import FormItem from './FormItem.vue';
import { computeVisibilityMap } from './visibility';

defineOptions({ name: 'DynamicsForm' });

const props = withDefaults(
  defineProps<{
    defaultItemWidth?: string;
    modelValue?: Dict<any>;
    otherParams?: any;
    parentField?: string;
    renderFields:
      | (() => Promise<any>)
      | Array<FormField>
      | Promise<any>
      | string;
    view?: boolean;
  }>(),
  {
    defaultItemWidth: '75%',
    modelValue: () => ({}),
    otherParams: () => ({}),
    parentField: '',
    view: false,
  },
);

const emit = defineEmits(['update:modelValue']);

const formFieldList = ref<Array<FormField>>([]);
const formFieldRef = ref<Array<InstanceType<typeof FormItem>>>([]);
const formValue = ref<Dict<any>>({});
const loading = ref<boolean>(false);
const ruleFormRef = ref<FormInstance>();

const toVisibilityField = (
  field: FormField,
): { field: string; visibility_rules?: VisibilityRules } => ({
  field: field.field,
  ...(field.visibility_rules
    ? {
        visibility_rules: {
          ...field.visibility_rules,
          action: field.visibility_rules.action,
          condition: field.visibility_rules.condition,
          conditions: field.visibility_rules.conditions,
        },
      }
    : {}),
});

const visibilityMap = computed(() =>
  computeVisibilityMap(
    formFieldList.value.map((field) => toVisibilityField(field)),
    formValue.value,
  ),
);

const show = (field: FormField) => {
  if (field.relation_show_field_dict) {
    const keys = Object.keys(field.relation_show_field_dict);
    if (keys.length > 0) {
      const key = keys[0]!;
      const v = get(formValue.value, key);
      if (v && v !== undefined && v !== null) {
        const values = field.relation_show_field_dict[key];
        return values && values.length > 0 ? values.includes(v) : true;
      } else {
        return false;
      }
    }
  }
  if (field.visibility_rules?.node_id) {
    return visibilityMap.value[field.field] ?? true;
  }
  return true;
};

const change = (field: FormField, value: any) => {
  formValue.value[field.field] = value;
};

const changeLabel = (field: FormField, value: any) => {
  formValue.value[field.label.field] = value;
};

watch(
  formValue,
  () => {
    emit('update:modelValue', formValue.value);
  },
  { deep: true },
);

const initDefaultData = (formField: FormField) => {
  if (
    formField.default_value &&
    (formValue.value[formField.field] === undefined ||
      formValue.value[formField.field] === null ||
      !formValue.value[formField.field]) &&
    formValue.value[formField.field] !== false &&
    formField.show_default_value === true
  ) {
    formValue.value[formField.field] = formField.default_value;
  }
};

const getFormDefaultValue = (fieldList: Array<any>, form_data?: any) => {
  const data = form_data || {};
  const value: Record<string, any> = {};
  for (const item of fieldList) {
    if (data[item.field] !== undefined) {
      if (item.value_field && item.option_list && item.option_list.length > 0) {
        const value_field = item.value_field;
        const find = item.option_list?.find((i: any) => {
          if (typeof data[item.field] === 'string') {
            return i[value_field] === data[item.field];
          } else {
            return data[item.field]
              ? !data[item.field].includes([value_field])
              : false;
          }
        });
        if (find) {
          value[item.field] = data[item.field];
        } else if (
          item.show_default_value === true ||
          item.show_default_value === undefined
        ) {
          value[item.field] = item.default_value;
        }
      } else {
        value[item.field] = data[item.field];
      }
    } else if (
      item.show_default_value === true ||
      item.show_default_value === undefined
    ) {
      value[item.field] = item.default_value;
    }
  }
  return value;
};

const trigger = (
  _trigger_field: string,
  _trigger_value: any,
  trigger_setting: any,
  _self: any,
  _loading: Ref<boolean>,
) => {
  if (!trigger_setting.change && !trigger_setting.change_field) {
    // no-op: trigger intentionally does nothing when no change/change_field is set
  }
};

const render = (
  render_data: (() => Promise<any>) | Array<FormField> | Promise<any> | string,
  data?: Dict<any>,
) => {
  formFieldList.value = [];
  nextTick(() => {
    if (typeof render_data === 'string') {
      formFieldList.value = [];
    } else if (Array.isArray(render_data)) {
      formFieldList.value = render_data;
    } else if (typeof render_data === 'function') {
      render_data().then((ok: any) => {
        formFieldList.value = ok.data || ok;
        const formData = data || {};
        if (formData) {
          const value = getFormDefaultValue(formFieldList.value, formData);
          formValue.value = structuredClone(value);
        }
      });
    } else {
      render_data.then((ok: any) => {
        formFieldList.value = ok.data || ok;
      });
    }
    const formData = data || {};
    if (formData) {
      const value = getFormDefaultValue(formFieldList.value, formData);
      formValue.value = cloneDeep(value);
    }
  });
};

const validate = () => {
  for (const field of formFieldList.value) {
    if (!show(field)) {
      formValue.value[field.field] = null;
    }
  }
  return Promise.all([
    ...formFieldRef.value.map((item) => item.validate()),
    ruleFormRef.value ? ruleFormRef.value.validate() : Promise.resolve(),
  ]);
};

onBeforeMount(() => {
  render(props.renderFields, props.modelValue);
});

defineExpose({
  initDefaultData,
  render,
  ruleFormRef,
  validate,
});
</script>

<template>
  <ElForm
    ref="ruleFormRef"
    v-loading="loading"
    v-bind="$attrs"
    :model="formValue"
    label-position="top"
    label-suffix=":"
    label-width="130px"
    require-asterisk-position="right"
    @submit.prevent
  >
    <slot :form_value="formValue"></slot>
    <template v-for="item in formFieldList" :key="item.field">
      <FormItem
        v-if="show(item)"
        ref="formFieldRef"
        :model-value="formValue[item.field]"
        :default-item-width="defaultItemWidth"
        :form-value="formValue"
        :formfield="item"
        :formfield-list="formFieldList"
        :init-default-data="initDefaultData"
        :other-params="otherParams"
        :parent-field="parentField"
        :trigger="trigger"
        :view="view"
        @change="change(item, $event)"
        @change-label="changeLabel(item, $event)"
      />
    </template>
  </ElForm>
</template>
