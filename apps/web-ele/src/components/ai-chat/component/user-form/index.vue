<script setup lang="ts">
import type { FormField } from '#/components/dynamics-form/type';

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { ElButton, ElCard, ElMessage, ElScrollbar } from 'element-plus';

import DynamicsForm from '#/components/dynamics-form/index.vue';

const props = defineProps<{
  apiFormData: any;
  application: Record<string, any>;
  excludeFields?: string[];
  first?: boolean;
  formData: any;
  title?: string;
  type: 'ai-chat' | 'debug-ai-chat' | 'log' | 'share';
}>();
const emit = defineEmits([
  'cancel',
  'confirm',
  'update:apiFormData',
  'update:formData',
]);
const route = useRoute();
const {
  params: { accessToken },
} = route as any;

const api_form_data_context = computed({
  get: () => {
    return props.apiFormData;
  },
  set: (data) => {
    emit('update:apiFormData', data);
  },
});

const dynamicsFormRef = ref<InstanceType<typeof DynamicsForm>>();
const dynamicsFormRefresh = ref(0);
const dynamicsFormRef2 = ref<InstanceType<typeof DynamicsForm>>();

const form_data_context = computed({
  get: () => {
    return props.formData;
  },
  set: (data) => {
    emit('update:formData', data);
  },
});

const inputFieldList = ref<FormField[]>([]);
const apiInputFieldList = ref<FormField[]>([]);

function handleInputFieldList() {
  dynamicsFormRefresh.value++;
  (props.application as any)?.work_flow?.nodes
    ?.filter((v: any) => v.id === 'base-node')
    .forEach((v: any) => {
      let rawInputFields: FormField[];
      if (v.properties.user_input_field_list) {
        rawInputFields = v.properties.user_input_field_list.map((v: any) => {
          switch (v.type) {
            case 'date': {
              return {
                attrs: {
                  format: 'YYYY-MM-DD HH:mm:ss',
                  type: 'datetime',
                  'value-format': 'YYYY-MM-DD HH:mm:ss',
                },
                default_value: v.default_value,
                field: v.variable,
                input_type: 'DatePicker',
                label: v.name,
                required: v.is_required,
              };
            }
            case 'input': {
              return {
                default_value: v.default_value,
                field: v.variable,
                input_type: 'TextInput',
                label: v.name,
                required: v.is_required,
              };
            }
            case 'select': {
              return {
                default_value: v.default_value,
                field: v.variable,
                input_type: 'SingleSelect',
                label: v.name,
                required: v.is_required,
                option_list: v.optionList
                  ? v.optionList.map((o: any) => {
                      return { key: o, value: o };
                    })
                  : [],
              };
            }
            case 'switch': {
              return {
                default_value: v.default_value,
                field: v.variable,
                input_type: 'SwitchInput',
                label: v.name,
                required: v.is_required,
              };
            }
            case 'textarea': {
              return {
                default_value: v.default_value,
                field: v.variable,
                input_type: 'TextareaInput',
                label: v.name,
                required: v.is_required,
              };
            }
            default: {
              return {
                default_value: v.default_value,
                field: v.variable,
                input_type: 'TextInput',
                label: v.name,
                required: v.is_required,
              };
            }
          }
        });
      } else if (v.properties.input_field_list) {
        rawInputFields = v.properties.input_field_list
          .filter((v: any) => v.assignment_method === 'user_input')
          .map((v: any) => {
            switch (v.type) {
              case 'date': {
                return {
                  attrs: {
                    format: 'YYYY-MM-DD HH:mm:ss',
                    type: 'datetime',
                    'value-format': 'YYYY-MM-DD HH:mm:ss',
                  },
                  default_value: v.default_value,
                  field: v.variable,
                  input_type: 'DatePicker',
                  label: v.name,
                  required: v.is_required,
                };
              }
              case 'input': {
                return {
                  default_value: v.default_value,
                  field: v.variable,
                  input_type: 'TextInput',
                  label: v.name,
                  required: v.is_required,
                };
              }
              case 'select': {
                return {
                  default_value: v.default_value,
                  field: v.variable,
                  input_type: 'SingleSelect',
                  label: v.name,
                  required: v.is_required,
                  option_list: v.optionList.map((o: any) => {
                    return { key: o, value: o };
                  }),
                };
              }
              case 'switch': {
                return {
                  default_value: v.default_value,
                  field: v.variable,
                  input_type: 'SwitchInput',
                  label: v.name,
                  required: v.is_required,
                };
              }
              case 'textarea': {
                return {
                  default_value: v.default_value,
                  field: v.variable,
                  input_type: 'TextareaInput',
                  label: v.name,
                  required: v.is_required,
                };
              }
              default: {
                return v;
              }
            }
          });
      } else {
        rawInputFields = [];
      }
      // Deduplicate within inputFieldList by field name (keep first occurrence)
      const inputSeen = new Set<string>();
      inputFieldList.value = rawInputFields.filter((f: any) => {
        const key = f?.field;
        if (!key || inputSeen.has(key)) return false;
        inputSeen.add(key);
        return true;
      });
      if (props.excludeFields?.length) {
        inputFieldList.value = inputFieldList.value.filter(
          (f: any) => !props.excludeFields!.includes(f.field),
        );
      }
      let rawApiFields: FormField[];
      if (v.properties.api_input_field_list) {
        rawApiFields = v.properties.api_input_field_list.map((v: any) => {
          switch (v.type) {
            case 'date': {
              return {
                attrs: {
                  format: 'YYYY-MM-DD HH:mm:ss',
                  type: 'datetime',
                  'value-format': 'YYYY-MM-DD HH:mm:ss',
                },
                default_value: v.default_value,
                field: v.variable,
                input_type: 'DatePicker',
                label: v.variable,
                required: v.is_required,
              };
            }
            case 'input': {
              return {
                default_value: v.default_value,
                field: v.variable,
                input_type: 'TextInput',
                label: v.variable,
                required: v.is_required,
              };
            }
            case 'select': {
              return {
                default_value: v.default_value,
                field: v.variable,
                input_type: 'SingleSelect',
                label: v.variable,
                required: v.is_required,
                option_list: v.optionList.map((o: any) => {
                  return { key: o, value: o };
                }),
              };
            }
            case 'switch': {
              return {
                default_value: v.default_value,
                field: v.variable,
                input_type: 'SwitchInput',
                label: v.variable,
                required: v.is_required,
              };
            }
            case 'textarea': {
              return {
                default_value: v.default_value,
                field: v.variable,
                input_type: 'TextareaInput',
                label: v.variable,
                required: v.is_required,
              };
            }
            default: {
              return {
                default_value: v.default_value,
                field: v.variable,
                input_type: 'TextInput',
                label: v.name || v.variable,
                required: v.is_required,
              };
            }
          }
        });
      } else if (v.properties.input_field_list) {
        rawApiFields = v.properties.input_field_list
          .filter((v: any) => v.assignment_method === 'api_input')
          .map((v: any) => {
            switch (v.type) {
              case 'date': {
                return {
                  attrs: {
                    format: 'YYYY-MM-DD HH:mm:ss',
                    type: 'datetime',
                    'value-format': 'YYYY-MM-DD HH:mm:ss',
                  },
                  default_value: v.default_value,
                  field: v.variable,
                  input_type: 'DatePicker',
                  label: v.name,
                  required: v.is_required,
                };
              }
              case 'input': {
                return {
                  default_value: v.default_value,
                  field: v.variable,
                  input_type: 'TextInput',
                  label: v.name,
                  required: v.is_required,
                };
              }
              case 'select': {
                return {
                  default_value: v.default_value,
                  field: v.variable,
                  input_type: 'SingleSelect',
                  label: v.name,
                  required: v.is_required,
                  option_list: v.optionList.map((o: any) => {
                    return { key: o, value: o };
                  }),
                };
              }
              case 'switch': {
                return {
                  default_value: v.default_value,
                  field: v.variable,
                  input_type: 'SwitchInput',
                  label: v.name,
                  required: v.is_required,
                };
              }
              case 'textarea': {
                return {
                  default_value: v.default_value,
                  field: v.variable,
                  input_type: 'TextareaInput',
                  label: v.name,
                  required: v.is_required,
                };
              }
              default: {
                return {
                  field: v.variable,
                  input_type: 'TextInput',
                  label: v.name,
                  required: v.is_required,
                };
              }
            }
          });
      } else {
        rawApiFields = [];
      }
      // Deduplicate: within apiInputFieldList by field name, AND cross-deduplicate
      // against inputFieldList so the same field never appears in both forms.
      const apiSeen = new Set<string>(inputSeen);
      apiInputFieldList.value = rawApiFields.filter((f: any) => {
        const key = f?.field;
        if (!key || apiSeen.has(key)) return false;
        apiSeen.add(key);
        return true;
      });
    });
}

const getRouteQueryValue = (field: string) => {
  let _value = (route.query as any)[field];
  if (_value !== null && _value !== undefined) {
    _value = Array.isArray(_value)
      ? _value
          .map((item: any) => {
            if (item !== null && item !== undefined) {
              return decodeQuery(item);
            }
            return null;
          })
          .filter((item: any) => item !== null && item !== undefined)
      : decodeQuery(_value);
    return _value;
  }
  return null;
};

const decodeQuery = (query: string) => {
  try {
    return decodeURIComponent(query);
  } catch {
    return query;
  }
};

const validate_query = () => {
  const msg: string[] = [];
  for (const f of apiInputFieldList.value) {
    if (f.required && !api_form_data_context.value[f.field]) {
      msg.push(f.field);
    }
  }
  if (msg.length > 0) {
    ElMessage.warning(`以下参数为必填项: ${msg.join('、')}`);
    return Promise.reject(new Error(`必填项缺失: ${msg.join('、')}`));
  }
  return Promise.resolve(true);
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

const validate = () => {
  const promiseList: Promise<any>[] = [];
  if (dynamicsFormRef.value) {
    promiseList.push(dynamicsFormRef.value.validate());
  }
  if (dynamicsFormRef2.value) {
    promiseList.push(dynamicsFormRef2.value.validate());
  }
  promiseList.push(validate_query());
  return Promise.all(promiseList);
};

const confirmHandle = () => {
  validate().then(() => {
    if (accessToken) {
      localStorage.setItem(
        `${accessToken}userForm`,
        JSON.stringify(form_data_context.value),
      );
    }
    emit('confirm');
  });
};

const cancelHandle = () => {
  emit('cancel');
};

const render = (data: any) => {
  if (dynamicsFormRef.value) {
    dynamicsFormRef.value.render(inputFieldList.value, data);
  }
};

const renderDebugAiChat = (data: any) => {
  if (dynamicsFormRef2.value) {
    dynamicsFormRef2.value.render(apiInputFieldList.value, data);
  }
};

defineExpose({ render, renderDebugAiChat, validate });

watch([() => props.application, () => props.excludeFields], () => {
  handleInputFieldList();
});

onMounted(() => {
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
    class="user-form-container g-mb-16 w-full"
  >
    <ElCard shadow="always" style="--el-card-padding: 16px 8px">
      <div class="align-center cursor flex w-full" style="padding: 0 8px">
        <span
          class="ellipsis-1 g-mr-16 break-all"
          :title="props.title || '更多设置'"
        >
          {{ props.title || '更多设置' }}
        </span>
      </div>

      <ElScrollbar :max-height="first ? '' : 450">
        <div class="g-mt-16" style="height: calc(100% - 100px); padding: 0 8px">
          <DynamicsForm
            :key="`user-${dynamicsFormRefresh}`"
            ref="dynamicsFormRef"
            v-model="form_data_context"
            :model="form_data_context"
            label-position="top"
            require-asterisk-position="right"
            :render-fields="inputFieldList"
          />
          <DynamicsForm
            v-if="type === 'debug-ai-chat'"
            :key="`api-${dynamicsFormRefresh}`"
            ref="dynamicsFormRef2"
            v-model="api_form_data_context"
            :model="api_form_data_context"
            label-position="top"
            require-asterisk-position="right"
            :render-fields="apiInputFieldList"
          />
        </div>
      </ElScrollbar>

      <div class="g-ml-8 text-left">
        <ElButton
          v-if="first"
          class="w-full"
          type="primary"
          @click="confirmHandle"
        >
          开始对话
        </ElButton>
        <ElButton v-if="!first" type="primary" @click="confirmHandle">
          确认
        </ElButton>
        <ElButton v-if="!first" @click="cancelHandle"> 取消 </ElButton>
      </div>
    </ElCard>
  </div>
</template>

<style lang="scss" scoped>
.user-form-container {
  padding: 0 24px;
}

.g-mb-16 {
  margin-bottom: 16px;
}

.g-mr-16 {
  margin-right: 16px;
}

.g-mt-16 {
  margin-top: 16px;
}

.g-ml-8 {
  margin-left: 8px;
}

@media only screen and (max-width: 768px) {
  .user-form-container {
    max-width: 100%;
  }
}
</style>
