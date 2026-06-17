<script setup lang="ts">
import { ref } from 'vue';

import { Setting, WarningFilled } from '@element-plus/icons-vue';
import { ElButton, ElDialog, ElIcon, ElTooltip } from 'element-plus';
import { cloneDeep, get } from 'lodash-es';

import DynamicsForm from '../../index.vue';

const props = defineProps<{
  formValue: any;
  label: any;
  modelValue?: any;
  view?: boolean;
}>();
const emit = defineEmits(['update:modelValue']);
const dialogVisible = ref<boolean>(false);
const dynamicsFormRef = ref<InstanceType<typeof DynamicsForm>>();
const form_data = ref<any>(undefined);
const open = () => {
  if (props.modelValue) {
    form_data.value = cloneDeep(props.modelValue);
  }
  dialogVisible.value = true;
};
const close = () => {
  dialogVisible.value = false;
  form_data.value = undefined;
};
/**
 * 当前 field是否展示
 * @param field
 */
const show = (field: any) => {
  if (field.relation_show_field_dict) {
    const keys = Object.keys(field.relation_show_field_dict);
    if (keys.length > 0) {
      const key = keys[0]!;
      const v = get(props.formValue, key);
      if (v && v !== undefined && v !== null) {
        const values = field.relation_show_field_dict[key];
        return values && values.length > 0 ? values.includes(v) : true;
      } else {
        return false;
      }
    }
  }
  return true;
};
const submit = () => {
  dynamicsFormRef.value?.validate().then(() => {
    dialogVisible.value = false;
    emit('update:modelValue', form_data.value);
    form_data.value = undefined;
  });
};
</script>
<template>
  <div class="flex-between my-required w-full">
    <div>
      <span> {{ label.label }}<span class="color-danger">*</span></span>
    </div>

    <ElTooltip v-if="label.attrs?.tooltip" effect="dark" placement="right">
      <template #content>
        <div style="max-width: 200px">{{ label.attrs.tooltip }}</div>
      </template>
      <ElIcon style="flex-shrink: 0"><WarningFilled /></ElIcon>
    </ElTooltip>
    <ElButton v-if="show(label)" type="primary" link @click="open()">
      <ElIcon><Setting /></ElIcon>
    </ElButton>
    <ElDialog
      destroy-on-close
      v-model="dialogVisible"
      title="设置"
      width="500"
      :before-close="close"
    >
      <DynamicsForm
        :read-only="view"
        ref="dynamicsFormRef"
        :render-fields="label.children ? label.children : []"
        label-position="top"
        v-model="form_data"
        require-asterisk-position="right"
        :model="form_data"
      />
      <template #footer>
        <div class="dialog-footer">
          <ElButton @click="close">取消</ElButton>
          <ElButton type="primary" @click="submit">确定</ElButton>
        </div>
      </template>
    </ElDialog>
  </div>
</template>
