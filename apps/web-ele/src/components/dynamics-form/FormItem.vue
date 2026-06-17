<script setup lang="ts">
import type { Ref } from 'vue';

import type { Dict, FormField } from './type';

import { computed, onMounted, ref } from 'vue';

import { ElFormItem } from 'element-plus';
import { get } from 'lodash-es';

import { aiChatBus } from '../ai-chat/utils/bus';
import FormItemLabel from './FormItemLabel.vue';

const props = defineProps<{
  defaultItemWidth: string;
  formfield: FormField;
  formfieldList: Array<FormField>;
  formValue: Dict<any>;
  initDefaultData: (formItem: FormField) => void;
  modelValue: any;
  otherParams: any;
  parentField?: string;
  trigger: (
    trigger_field: string,
    trigger_value: any,
    trigger_setting: any,
    self: any,
    loading: Ref<boolean>,
  ) => void;
  view: boolean;
}>();

const emit = defineEmits(['change', 'changeLabel']);

const loading = ref<boolean>(false);
const componentFormRef = ref<any>();

const isString = (value: any) => {
  return typeof value === 'string';
};

const attrs = computed(() => {
  return props.formfield.attrs || {};
});

const componentStyle = computed(() => {
  return props_info.value.style || {};
});

const errMsg = computed(() => {
  return (
    props_info.value.err_msg ||
    (isString(props.formfield.label)
      ? `${props.formfield.label} 为必填属性`
      : `${props.formfield.label?.label || props.formfield.field} 为必填属性`)
  );
});

const formItemStyle = computed(() => {
  return props_info.value.item_style || {};
});

const itemValue = computed({
  get: () => {
    return props.modelValue;
  },
  set: (value: any) => {
    emit('change', value);
    if (props.parentField) {
      aiChatBus.emit(`${props.parentField}.${props.formfield.field}`, value);
    } else {
      aiChatBus.emit(props.formfield.field, value);
    }
  },
});

const labelValue = computed({
  get: () => {
    return props.formValue[props.formfield.label.field];
  },
  set: (value: any) => {
    emit('change', value);
    if (props.parentField) {
      aiChatBus.emit(`${props.parentField}.${props.formfield.field}`, value);
    } else {
      aiChatBus.emit(props.formfield.field, value);
    }
  },
});

const label_attrs = computed(() => {
  return props.formfield.label &&
    typeof props.formfield.label !== 'string' &&
    props.formfield.label.attrs
    ? props.formfield.label.attrs
    : {};
});

const props_info = computed(() => {
  return props.formfield.props_info || {};
});

const rules = computed(() => {
  return (
    props_info.value.rules || {
      message: errMsg.value,
      trigger:
        props.formfield.input_type === 'Slider' ? 'blur' : ['blur', 'change'],
      required: props.formfield.required !== false,
    }
  );
});

const initTrigger = (self: any, trigger_field_dict?: Dict<any>) => {
  if (trigger_field_dict) {
    Object.keys(trigger_field_dict).forEach((key) => {
      const setting = trigger_field_dict[key];
      const triggerValues = setting.values;
      const value = get(props.formValue, key);
      if (triggerValues && triggerValues.length > 0) {
        if (triggerValues.includes(value)) {
          props.trigger(key, value, setting, self, loading);
        }
      } else {
        props.trigger(key, value, setting, self, loading);
      }
    });
  }
};

const onTrigger = (self: any, trigger_field_dict?: Dict<any>) => {
  if (trigger_field_dict) {
    Object.keys(trigger_field_dict).forEach((key) => {
      const setting = trigger_field_dict[key];
      const values: Array<any> = setting.values;
      aiChatBus.on(key, (v: any) => {
        if (values && values.length > 0) {
          if (values.includes(v)) {
            props.trigger(key, v, setting, self, loading);
          }
        } else {
          props.trigger(key, v, setting, self, loading);
        }
      });
    });
  }
};

const validate = () => {
  if (
    props.formfield.trigger_type === 'CHILD_FORMS' &&
    componentFormRef.value
  ) {
    return componentFormRef.value.validate();
  }
  return Promise.resolve();
};

onMounted(() => {
  props.initDefaultData(props.formfield);
  initTrigger(props.formfield, props.formfield.relation_trigger_field_dict);
  if (!isString(props.formfield.label)) {
    initTrigger(
      props.formfield.label,
      props.formfield.label?.relation_trigger_field_dict,
    );
    onTrigger(
      props.formfield.label,
      props.formfield.label?.relation_trigger_field_dict,
    );
  }
  onTrigger(props.formfield, props.formfield.relation_trigger_field_dict);
});

defineExpose({ validate });
</script>

<template>
  <ElFormItem
    :key="formfield.field"
    v-loading="loading"
    :class="formfield.required_asterisk ? 'hide-asterisk' : ''"
    :prop="formfield.field"
    :rules="rules"
    :style="formItemStyle"
  >
    <template v-if="formfield.label" #label>
      <FormItemLabel v-if="isString(formfield.label)" :form-field="formfield" />
      <component
        v-else
        :is="formfield.label.input_type"
        v-model="labelValue"
        v-bind="label_attrs"
        :form-value="formValue"
        :label="formfield.label"
      />
    </template>
    <component
      :is="formfield.input_type"
      ref="componentFormRef"
      v-model="itemValue"
      v-bind="attrs"
      :field="formfield.field"
      :form-field="formfield"
      :formfield-list="formfieldList"
      :other-params="otherParams"
      :style="componentStyle"
      :view="view"
    />
  </ElFormItem>
</template>

<style lang="scss" scoped>
.hide-asterisk {
  &::after {
    display: none;
  }
}
</style>
