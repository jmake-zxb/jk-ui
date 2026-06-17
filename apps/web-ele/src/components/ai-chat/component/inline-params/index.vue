<script setup lang="ts">
import type { Dict, FormField } from './InlineFormItem.vue';

import { computed, onMounted, ref, watch } from 'vue';

import { ElButton, ElIcon } from 'element-plus';
import { get } from 'lodash-es';

import { computeVisibilityMap } from '#/components/dynamics-form/visibility';

import InlineFormItem from './InlineFormItem.vue';

const props = defineProps<{
  application: Record<string, any>;
  formData: any;
  maxExposed?: number;
}>();

const emit = defineEmits(['openDialog', 'update:formData']);

const fieldList = ref<FormField[]>([]);
const formValue = ref<Dict<any>>({});
const setting = ref<{ exposed_fields: string[]; menu_title: string }>({
  exposed_fields: [],
  menu_title: '更多设置',
});

watch(
  formValue,
  () => {
    emit('update:formData', formValue.value);
  },
  { deep: true },
);

watch(
  () => props.formData,
  (val) => {
    if (val && JSON.stringify(val) !== JSON.stringify(formValue.value)) {
      formValue.value = val;
      for (const field of fieldList.value) {
        if (
          field.default_value &&
          !formValue.value[field.field] &&
          formValue.value[field.field] !== false &&
          (field.show_default_value === true ||
            field.show_default_value === undefined)
        ) {
          formValue.value[field.field] = field.default_value;
        }
      }
    }
  },
  { immediate: true },
);

watch(
  () => props.application,
  () => {
    handleInputFieldList();
  },
);

function handleInputFieldList() {
  (props.application as any)?.work_flow?.nodes
    ?.filter((v: any) => v.id === 'base-node')
    .forEach((v: any) => {
      // Deduplicate by field name (keep first occurrence)
      const rawFields: FormField[] = v.properties.user_input_field_list
        ? v.properties.user_input_field_list.map((v: any) => {
            let field: FormField;
            switch (v.type) {
              case 'date': {
                field = {
                  field: v.variable,
                  input_type: 'DatePicker',
                  label: v.name,
                  default_value: v.default_value,
                  required: v.is_required,
                  attrs: {
                    format: 'YYYY-MM-DD HH:mm:ss',
                    type: 'datetime',
                    'value-format': 'YYYY-MM-DD HH:mm:ss',
                  },
                };
                break;
              }
              case 'input': {
                field = {
                  field: v.variable,
                  input_type: 'TextInput',
                  label: v.name,
                  default_value: v.default_value,
                  required: v.is_required,
                };
                break;
              }
              case 'select': {
                field = {
                  field: v.variable,
                  input_type: 'SingleSelect',
                  label: v.name,
                  default_value: v.default_value,
                  required: v.is_required,
                  option_list: v.optionList.map((o: any) => ({
                    key: o,
                    value: o,
                  })),
                };
                break;
              }
              case 'switch': {
                field = {
                  field: v.variable,
                  input_type: 'SwitchInput',
                  label: v.name,
                  default_value: v.default_value,
                  required: v.is_required,
                };
                break;
              }
              case 'textarea': {
                field = {
                  field: v.variable,
                  input_type: 'TextareaInput',
                  label: v.name,
                  default_value: v.default_value,
                  required: v.is_required,
                };
                break;
              }
              default: {
                field = {
                  field: v.variable,
                  input_type: 'TextInput',
                  label: v.name,
                  default_value: v.default_value,
                  required: v.is_required,
                };
                break;
              }
            }
            const isEmpty =
              !field.default_value ||
              (Array.isArray(field.default_value) &&
                field.default_value.length === 0) ||
              (typeof field.default_value === 'object' &&
                Object.keys(field.default_value).length === 0);
            if (isEmpty) {
              const label =
                typeof field.label === 'string'
                  ? field.label
                  : field.label?.label || field.field;
              const truncated =
                label.length > 5 ? `${label.slice(0, 5)}…` : label;
              field.attrs = { ...field.attrs, placeholder: truncated };
            }
            field.attrs = {
              ...field.attrs,
              popperHeader: {
                label:
                  typeof field.label === 'string'
                    ? field.label
                    : field.label?.label || field.field,
                required: field.required,
                tooltip:
                  typeof field.label === 'object'
                    ? field.label?.attrs?.tooltip
                    : undefined,
              },
            };
            return field;
          })
        : [];
      const seen = new Set<string>();
      fieldList.value = rawFields.filter((f: any) => {
        const key = f?.field;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setting.value = v.properties.user_input_field_list_setting || {
        exposed_fields: [],
        menu_title: '更多设置',
      };
    });
}

const exposedFields = computed(() => {
  if (setting.value.exposed_fields.length === 0) return [];
  return setting.value.exposed_fields
    .map((field: string) => fieldList.value.find((f) => f.field === field))
    .filter(Boolean)
    .slice(0, props.maxExposed ?? 3) as FormField[];
});

const dialogFields = computed(() => {
  const inlineKeys = new Set(exposedFields.value.map((f) => f.field));
  return fieldList.value.filter((f) => !inlineKeys.has(f.field));
});

const visibilityMap = computed(() =>
  computeVisibilityMap(fieldList.value, formValue.value),
);

const show = (field: FormField) => {
  if (field.relation_show_field_dict) {
    const key = Object.keys(field.relation_show_field_dict)[0];
    if (key) {
      const v = get(formValue.value, key);
      if (v && v !== undefined && v !== null) {
        const values = field.relation_show_field_dict[key];
        return values && values.length > 0 ? values.includes(v) : true;
      }
      return false;
    }
  }
  if (field.visibility_rules?.node_id) {
    return visibilityMap.value[field.field] ?? true;
  }
  return true;
};

defineExpose({
  validate: () => {
    for (const field of fieldList.value) {
      if (!show(field)) {
        formValue.value[field.field] = null;
      }
    }

    for (const item of exposedFields.value) {
      if (!show(item)) continue;
      const isRequired = item.required ?? item.is_required;
      if (isRequired) {
        const value = formValue.value[item.field];
        const isEmpty =
          value === undefined ||
          value === null ||
          value === '' ||
          (Array.isArray(value) && value.length === 0) ||
          (typeof value === 'object' && Object.keys(value).length === 0);
        if (isEmpty) {
          const name =
            typeof item.label === 'string'
              ? item.label
              : item.label?.label || item.field;
          console.warn(`${name} 为必填属性`);
          return Promise.reject(new Error(`${name} 为必填属性`));
        }
      }
    }
    return Promise.resolve(true);
  },
});

const change = (field: FormField, value: any) => {
  formValue.value[field.field] = value;
};

const trigger = () => {
  // 暂留空，后续按需补充
};

const initDefaultData = (formField: FormField) => {
  if (
    formField.default_value &&
    (formValue.value[formField.field] === undefined ||
      formValue.value[formField.field] === null ||
      !formValue.value[formField.field]) &&
    formValue.value[formField.field] !== false &&
    (formField.show_default_value === true ||
      formField.show_default_value === undefined)
  ) {
    formValue.value[formField.field] = formField.default_value;
  }
};

onMounted(() => {
  handleInputFieldList();
});
</script>

<template>
  <div class="inline-params" v-if="fieldList.length > 0">
    <template v-for="item in exposedFields" :key="item.field">
      <InlineFormItem
        v-if="show(item)"
        default-item-width="auto"
        :form-value="formValue"
        :formfield="item"
        :formfield-list="fieldList"
        :init-default-data="initDefaultData"
        :model-value="formValue[item.field]"
        :other-params="{}"
        :trigger="trigger"
        :view="false"
        @change="change(item, $event)"
      />
    </template>
    <ElButton
      v-if="dialogFields.length > 0"
      style="padding: 8px"
      @click="emit('openDialog')"
    >
      <ElIcon>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
        </svg>
      </ElIcon>
    </ElButton>
  </div>
</template>

<style lang="scss" scoped>
.inline-params {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 4px 0;
}
</style>
