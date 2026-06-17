<script setup lang="ts">
import type { FormField } from '../../type';

import { computed } from 'vue';

import { Setting } from '@element-plus/icons-vue';
import {
  ElButton,
  ElDivider,
  ElIcon,
  ElOption,
  ElOptionGroup,
  ElSelect,
  ElSpace,
} from 'element-plus';
import { flatMap, groupBy } from 'lodash-es';

import SelectHeader from '../common/SelectHeader.vue';
import { providerList } from './provider-data';

const props = withDefaults(
  defineProps<{
    formField: FormField;
    modelValue?: null | {
      model_id: string;
      model_params_setting: Record<string, any>;
    };
  }>(),
  {
    modelValue: null,
  },
);

const emit = defineEmits(['update:modelValue', 'change']);

function relatedObject(list: any[], value: any, key: string) {
  return list.find((item) => item[key] === value);
}

const model_value = computed({
  get: () => props.modelValue,
  set: (value) => {
    emit('update:modelValue', value);
    emit('change', props.formField);
  },
});

const groupedOptions = computed(() => {
  const list = (props.formField.attrs?.provider_list as any[]) || [];
  return groupBy(list, 'provider');
});

const getModelProvider = computed(() => {
  return (id: string) => {
    const item = flatMap(groupedOptions.value)?.find(
      (item: any) => item.model_id === id,
    );
    return (item as any)?.provider || '';
  };
});

function openParamSetting() {
  // TODO: Integrate AIModeParamSettingDialog when the component is migrated
}

function handleModelChange(selectedId: string) {
  const list = (props.formField.attrs?.provider_list as any[]) || [];
  const selectedItem = list.find((p) => p.model_id === selectedId);
  model_value.value = {
    model_id: selectedId,
    model_params_setting: selectedItem?.model_params_setting || {},
  };
}
</script>
<template>
  <div class="complex-select align-center flex w-full">
    <ElSelect
      class="complex-select__left"
      :model-value="model_value?.model_id"
      @change="handleModelChange"
      v-bind="$attrs"
      popper-class="select-model"
      style="width: 120px"
    >
      <template v-if="($attrs as any).popperHeader" #header>
        <SelectHeader :header="($attrs as any).popperHeader" />
      </template>
      <ElOptionGroup
        v-for="(modelList, providerName) in groupedOptions"
        :key="providerName"
        :label="relatedObject(providerList, providerName, 'provider')?.name"
      >
        <ElOption
          v-for="item in modelList"
          :key="item.model_id"
          :label="item.model_name"
          :value="item.model_id"
        >
          <ElSpace :size="8">
            <span
              :innerHTML="
                relatedObject(providerList, providerName, 'provider')?.icon
              "
              class="select-model-icon"
              style="margin-top: -7px"
            ></span>
            <span>{{ item.model_name }}</span>
          </ElSpace>
        </ElOption>
      </ElOptionGroup>
      <template #label="{ label, value }">
        <ElSpace :size="8" v-if="value">
          <span
            class="select-model-icon"
            :innerHTML="
              relatedObject(providerList, getModelProvider(value), 'provider')
                ?.icon
            "
          ></span>
          <span>
            <span>{{ label }}</span>
          </span>
        </ElSpace>
      </template>
    </ElSelect>
    <ElDivider direction="vertical" />
    <ElButton
      text
      @click="openParamSetting"
      :disabled="!model_value?.model_id"
      class="mr-4"
    >
      <ElIcon class="color-secondary" :size="16"><Setting /></ElIcon>
    </ElButton>
  </div>
  <!-- TODO: Integrate AIModeParamSettingDialog when available -->
</template>
<style lang="scss" scoped>
.select-model {
  .el-select-dropdown__footer {
    &:hover {
      background-color: var(--el-fill-color-light);
    }
  }

  .check-icon {
    position: absolute;
    right: 10px;
  }
}
</style>
