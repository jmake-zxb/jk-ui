<script setup lang="ts">
import type { FormField } from '#/components/dynamics-form/type';

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { ElButton, ElCard, ElScrollbar } from 'element-plus';

import DynamicsForm from '#/components/dynamics-form/index.vue';
import { $t } from '#/locales';
import { MsgWarning } from '#/utils/message';

const props = defineProps<{
  // eslint-disable-next-line vue/prop-name-casing
  api_form_data: any;
  application: any;
  excludeFields?: string[];
  first?: boolean;
  // eslint-disable-next-line vue/prop-name-casing
  form_data: any;
  title?: string;
  type: 'ai-chat' | 'debug-ai-chat' | 'log' | 'share';
}>();
const emit = defineEmits([
  'update:api_form_data',
  'update:form_data',
  'confirm',
  'cancel',
]);
const route = useRoute();
const {
  params: { accessToken },
} = route;
// 用于刷新动态表单
const dynamicsFormRefresh = ref(0);
const inputFieldList = ref<FormField[]>([]);
const apiInputFieldList = ref<FormField[]>([]);
const inputFieldConfig = ref({ title: $t('aiChat.userInput') });
const firstMounted = ref(false);

const dynamicsFormRef = ref<InstanceType<typeof DynamicsForm>>();
const dynamicsFormRef2 = ref<InstanceType<typeof DynamicsForm>>();

const api_form_data_context = computed({
  get: () => {
    return props.api_form_data;
  },
  set: (data) => {
    emit('update:api_form_data', data);
  },
});

const form_data_context = computed({
  get: () => {
    return props.form_data;
  },
  set: (data) => {
    emit('update:form_data', data);
  },
});

watch([() => props.application, () => props.excludeFields], () => {
  handleInputFieldList();
});

function handleInputFieldList() {
  dynamicsFormRefresh.value++;
  const default_value: any = {};
  props.application?.work_flow?.nodes
    ?.filter((v: any) => v.id === 'base-node')
    .forEach((v: any) => {
      if (v.properties.user_input_field_list) {
        inputFieldList.value = v.properties.user_input_field_list.map(
          (v: any) => {
            switch (v.type) {
              case 'date': {
                return {
                  field: v.variable,
                  input_type: 'DatePicker',
                  label: v.name,
                  default_value: default_value[v.variable],
                  required: v.is_required,
                  attrs: {
                    format: 'YYYY-MM-DD HH:mm:ss',
                    'value-format': 'YYYY-MM-DD HH:mm:ss',
                    type: 'datetime',
                  },
                };
              }
              case 'input': {
                return {
                  field: v.variable,
                  input_type: 'TextInput',
                  label: v.name,
                  default_value: default_value[v.variable],
                  required: v.is_required,
                };
              }
              case 'select': {
                return {
                  field: v.variable,
                  input_type: 'SingleSelect',
                  label: v.name,
                  default_value: default_value[v.variable],
                  required: v.is_required,
                  option_list: v.optionList.map((o: any) => {
                    return { key: o, value: o };
                  }),
                };
              }
              default: {
                return v;
              }
            }
          },
        );
      } else if (v.properties.input_field_list) {
        inputFieldList.value = v.properties.input_field_list
          .filter((v: any) => v.assignment_method === 'user_input')
          .map((v: any) => {
            switch (v.type) {
              case 'date': {
                return {
                  field: v.variable,
                  input_type: 'DatePicker',
                  label: v.name,
                  default_value: default_value[v.variable],
                  required: v.is_required,
                  attrs: {
                    format: 'YYYY-MM-DD HH:mm:ss',
                    'value-format': 'YYYY-MM-DD HH:mm:ss',
                    type: 'datetime',
                  },
                };
              }
              case 'input': {
                return {
                  field: v.variable,
                  input_type: 'TextInput',
                  label: v.name,
                  default_value: default_value[v.variable],
                  required: v.is_required,
                };
              }
              case 'select': {
                return {
                  field: v.variable,
                  input_type: 'SingleSelect',
                  label: v.name,
                  default_value: default_value[v.variable],
                  required: v.is_required,
                  option_list: v.optionList.map((o: any) => {
                    return { key: o, value: o };
                  }),
                };
              }
              default: {
                return null;
              }
            }
          });
      } else {
        inputFieldList.value = [];
      }
      if (props.excludeFields?.length) {
        inputFieldList.value = inputFieldList.value.filter(
          (f: any) => !props.excludeFields!.includes(f.field),
        );
      }
      if (v.properties.api_input_field_list) {
        apiInputFieldList.value = v.properties.api_input_field_list.map(
          (v: any) => {
            switch (v.type) {
              case 'date': {
                return {
                  field: v.variable,
                  input_type: 'DatePicker',
                  label: v.variable,
                  default_value: v.default_value || default_value[v.variable],
                  required: v.is_required,
                  attrs: {
                    format: 'YYYY-MM-DD HH:mm:ss',
                    'value-format': 'YYYY-MM-DD HH:mm:ss',
                    type: 'datetime',
                  },
                };
              }
              case 'input': {
                return {
                  field: v.variable,
                  input_type: 'TextInput',
                  label: v.variable,
                  default_value: v.default_value || default_value[v.variable],
                  required: v.is_required,
                };
              }
              case 'select': {
                return {
                  field: v.variable,
                  input_type: 'SingleSelect',
                  label: v.variable,
                  default_value: v.default_value || default_value[v.variable],
                  required: v.is_required,
                  option_list: v.optionList.map((o: any) => {
                    return { key: o, value: o };
                  }),
                };
              }
              default: {
                return null;
              }
            }
          },
        );
      } else if (v.properties.input_field_list) {
        apiInputFieldList.value = v.properties.input_field_list
          .filter((v: any) => v.assignment_method === 'api_input')
          .map((v: any) => {
            switch (v.type) {
              case 'date': {
                return {
                  field: v.variable,
                  input_type: 'DatePicker',
                  label: v.name,
                  default_value: default_value[v.variable],
                  required: v.is_required,
                  attrs: {
                    format: 'YYYY-MM-DD HH:mm:ss',
                    'value-format': 'YYYY-MM-DD HH:mm:ss',
                    type: 'datetime',
                  },
                };
              }
              case 'input': {
                return {
                  field: v.variable,
                  input_type: 'TextInput',
                  label: v.name,
                  default_value: default_value[v.variable],
                  required: v.is_required,
                };
              }
              case 'select': {
                return {
                  field: v.variable,
                  input_type: 'SingleSelect',
                  label: v.name,
                  default_value: default_value[v.variable],
                  required: v.is_required,
                  option_list: v.optionList.map((o: any) => {
                    return { key: o, value: o };
                  }),
                };
              }
              default: {
                return null;
              }
            }
          });
      } else {
        apiInputFieldList.value = [];
      }

      //
      inputFieldConfig.value = v.properties.user_input_config?.title
        ? v.properties.user_input_config
        : { title: $t('aiChat.userInput') };
    });
}
const getRouteQueryValue = (field: string) => {
  let _value = route.query[field];
  if (_value !== null && _value !== undefined) {
    _value = Array.isArray(_value)
      ? _value
          .map((item) => {
            if (item !== null && item !== undefined) {
              return decodeQuery(item);
            }
            return null;
          })
          .filter((item) => item !== null && item !== undefined)
      : decodeQuery(_value);
    return _value;
  }
  return null;
};
const validate = () => {
  const promise_list = [];
  if (dynamicsFormRef.value) {
    promise_list.push(dynamicsFormRef.value?.validate());
  }
  if (dynamicsFormRef2.value) {
    promise_list.push(dynamicsFormRef2.value?.validate());
  }
  promise_list.push(validate_query());
  return Promise.all(promise_list);
};
const validate_query = () => {
  // 浏览器query参数找到接口传参
  const msg = [];
  for (const f of apiInputFieldList.value) {
    if (f.required && !api_form_data_context.value[f.field]) {
      msg.push(f.field);
    }
  }
  if (msg.length > 0) {
    MsgWarning(
      `${$t('aiChat.tip.inputParamMessage1')} ${msg.join('、')}${$t('aiChat.tip.inputParamMessage2')}`,
    );
    return Promise.reject(new Error('Validation failed'));
  }
  return Promise.resolve(false);
};

const initRouteQueryValue = () => {
  for (const f of apiInputFieldList.value) {
    if (!api_form_data_context.value[f.field]) {
      const _value = getRouteQueryValue(f.field);
      if (_value !== null && _value !== undefined) {
        api_form_data_context.value[f.field] = _value;
      }
    }
  }
  if (!api_form_data_context.value.asker) {
    const asker = getRouteQueryValue('asker');
    if (asker) {
      api_form_data_context.value.asker = getRouteQueryValue('asker');
    }
  }
};

const decodeQuery = (query: string) => {
  try {
    return decodeURIComponent(query);
  } catch {
    return query;
  }
};
const confirmHandle = () => {
  validate().then((_ok) => {
    localStorage.setItem(
      `${accessToken}userForm`,
      JSON.stringify(form_data_context.value),
    );
    emit('confirm');
  });
};
const cancelHandle = () => {
  emit('cancel');
};
const render = (data: any) => {
  if (dynamicsFormRef.value) {
    dynamicsFormRef.value?.render(inputFieldList.value, data);
  }
};

const renderDebugAiChat = (data: any) => {
  if (dynamicsFormRef2.value) {
    dynamicsFormRef2.value?.render(apiInputFieldList.value, data);
  }
};
defineExpose({ validate, render, renderDebugAiChat });
onMounted(() => {
  firstMounted.value = true;
  handleInputFieldList();
  initRouteQueryValue();
});
</script>
<template>
  <div
    v-if="
      (inputFieldList.length > 0 ||
        (type === 'debug-ai-chat' && apiInputFieldList.length > 0)) &&
      type !== 'log'
    "
    class="user-form-container mb-4 w-full"
  >
    <ElCard
      shadow="always"
      class="rounded-lg"
      style="

--el-card-padding: 16px 8px"
    >
      <div class="align-center cursor flex w-full" style="padding: 0 8px">
        <span
          class="ellipsis-1 mr-4 break-all"
          :title="props.title || $$t('common.moreSettings')"
        >
          {{ props.title || $$t('common.moreSettings') }}
        </span>
      </div>

      <ElScrollbar :max-height="first ? '' : 450">
        <div class="mt-4" style="height: calc(100% - 100px); padding: 0 8px">
          <DynamicsForm
            :key="dynamicsFormRefresh"
            v-model="form_data_context"
            :model="form_data_context"
            label-position="top"
            require-asterisk-position="right"
            :render_data="inputFieldList"
            ref="dynamicsFormRef"
          />
          <DynamicsForm
            v-if="type === 'debug-ai-chat'"
            v-model="api_form_data_context"
            :model="api_form_data_context"
            label-position="top"
            require-asterisk-position="right"
            :render_data="apiInputFieldList"
            ref="dynamicsFormRef2"
          />
        </div>
      </ElScrollbar>

      <div class="ml-2 text-left">
        <ElButton
          type="primary"
          class="w-full"
          v-if="first"
          @click="confirmHandle"
        >
          <AppIcon icon-name="app-chat" class="mr-1" />
          {{ $$t('aiChat.operation.startChat') }}
        </ElButton>
        <ElButton type="primary" v-if="!first" @click="confirmHandle">
          {{ $$t('common.confirm') }}
        </ElButton>
        <ElButton v-if="!first" @click="cancelHandle">
          {{ $$t('common.cancel') }}
        </ElButton>
      </div>
    </ElCard>
  </div>
</template>
<style lang="scss" scoped>
.user-form-container {
  padding: 0 24px;
}

@media only screen and (max-width: 768px) {
  .user-form-container {
    max-width: 100%;
  }
}
</style>
