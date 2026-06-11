<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import { computed, ref, watch } from 'vue';

import { Back } from '@element-plus/icons-vue';
import {
  ElAlert,
  ElButton,
  ElCard,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElMessage,
  ElTag,
} from 'element-plus';

import { debugDraftTool, debugTool } from '#/api/ai/tools';

import DynamicInitForm from './DynamicInitForm.vue';

const props = defineProps<{
  toolId?: number | string;
}>();

const formRef = ref<FormInstance>();
const dynamicsFormRef = ref<InstanceType<typeof DynamicInitForm>>();
const loading = ref(false);
const debugVisible = ref(false);
const showResult = ref(false);
const isSuccess = ref(false);
const result = ref<any>(null);

const form = ref<any>({
  debug_field_list: [],
  code: '',
  input_field_list: [],
  init_field_list: [],
  init_params: '{}',
});

/** Extract the display content from debug result */
const resultDisplay = computed(() => {
  const data = result.value;
  if (data === null || data === undefined)
    return { status: '', runTime: '', output: '', stderr: '' };

  // Handle string error messages
  if (typeof data === 'string') {
    return { status: '', runTime: '', output: data, stderr: '' };
  }

  // Handle the full response object: { success, message, result, data: { status, outputJson, runTime } }
  const inner = data.data ?? data;
  const status = inner.status ?? '';
  const runTime =
    inner.runTime === null || inner.runTime === undefined
      ? ''
      : `${inner.runTime}ms`;
  const outputJson =
    typeof inner.outputJson === 'string' ? inner.outputJson : '';

  let output = '';
  let stderr = '';

  if (outputJson) {
    try {
      const parsed = JSON.parse(outputJson);
      // Extract the actual result content
      if (parsed.data === null || parsed.data === undefined) {
        output =
          parsed.result === null || parsed.result === undefined
            ? outputJson
            : String(parsed.result);
      } else {
        output =
          typeof parsed.data === 'object'
            ? JSON.stringify(parsed.data, null, 2)
            : String(parsed.data);
      }
      stderr = parsed.stderr ? String(parsed.stderr) : '';
    } catch {
      output = outputJson;
    }
  } else if (data.result !== null && data.result !== undefined) {
    output = String(data.result);
  }

  // For FAILED status, prefer stderr if output is unhelpful
  if (status === 'FAILED' && stderr && (!output || output === 'unsupported')) {
    output = stderr;
    stderr = '';
  }

  return { status, runTime, output, stderr };
});

/** Format output for display — pretty-print if JSON, raw otherwise */
const formattedOutput = computed(() => {
  const raw = resultDisplay.value.output;
  if (!raw) return '-';
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
});

watch(debugVisible, (bool) => {
  if (!bool) {
    showResult.value = false;
    isSuccess.value = false;
    result.value = null;
    form.value = {
      debug_field_list: [],
      code: '',
      input_field_list: [],
      init_field_list: [],
      init_params: '{}',
    };
  }
});

const handleSubmit = async () => {
  const validate = formRef.value ? formRef.value.validate() : Promise.resolve();
  const dynamicsValidate =
    dynamicsFormRef.value?.validate() ?? Promise.resolve(true);

  Promise.all([dynamicsValidate, validate]).then(() => {
    loading.value = true;
    const payload = {
      ...form.value,
      input_field_list:
        typeof form.value.input_field_list === 'string'
          ? form.value.input_field_list
          : JSON.stringify(form.value.input_field_list),
      init_field_list:
        typeof form.value.init_field_list === 'string'
          ? form.value.init_field_list
          : JSON.stringify(form.value.init_field_list),
    };
    const api = props.toolId
      ? debugTool(props.toolId, payload)
      : debugDraftTool(payload);
    api
      .then((res: any) => {
        if (res.code === 500) {
          showResult.value = true;
          isSuccess.value = false;
          result.value = {
            data: {
              status: 'FAILED',
              outputJson: JSON.stringify({
                status: 'FAILED',
                reason: res.message,
              }),
              runTime: 0,
            },
          };
        } else {
          showResult.value = true;
          isSuccess.value =
            res.data?.status !== 'FAILED' && res.data?.status !== 'UNSUPPORTED';
          result.value = res.data;
        }
      })
      .catch((error: any) => {
        ElMessage.error(error?.message || '调试失败');
      })
      .finally(() => {
        loading.value = false;
      });
  });
};

const open = (data: any) => {
  // Clear previous data
  form.value.debug_field_list = [];

  console.warn('[ToolDebugDrawer] opening with data:', data);
  console.warn(
    '[ToolDebugDrawer] input_field_list.length:',
    data.input_field_list?.length,
  );

  if (data.input_field_list && data.input_field_list.length > 0) {
    data.input_field_list.forEach((item: any) => {
      const field = {
        value: '',
        ...item,
      };
      console.warn('[ToolDebugDrawer] pushing field:', field);
      form.value.debug_field_list.push(field);
    });
  }

  console.warn(
    '[ToolDebugDrawer] final debug_field_list:',
    form.value.debug_field_list,
  );

  form.value.code = data.code;
  form.value.input_field_list = data.input_field_list;
  form.value.init_field_list = data.init_field_list || [];
  debugVisible.value = true;
};

defineExpose({
  open,
});
</script>

<template>
  <ElDrawer
    v-model="debugVisible"
    size="60%"
    :append-to-body="true"
    :modal="false"
    :show-close="false"
  >
    <template #header>
      <div class="flex items-center" style="margin-left: -8px">
        <ElButton
          class="mr-4 cursor-pointer"
          link
          @click.prevent="debugVisible = false"
        >
          <ElIcon :size="20">
            <Back />
          </ElIcon>
        </ElButton>
        <h4>调试</h4>
      </div>
    </template>
    <div>
      <div v-if="form.init_field_list.length > 0" class="mb-4">
        <h4 class="mb-4 text-lg font-medium">初始化参数</h4>
        <ElCard
          shadow="never"
          class="card-never"
          style="

--el-card-padding: 12px"
        >
          <DynamicInitForm
            v-model="form.init_params"
            :fields="form.init_field_list"
            ref="dynamicsFormRef"
          />
        </ElCard>
      </div>
      <div v-if="form.debug_field_list.length > 0" class="mb-4">
        <h4 class="mb-4 text-lg font-medium">输入参数</h4>
        <ElCard
          shadow="never"
          class="card-never"
          style="

--el-card-padding: 12px"
        >
          <ElForm
            ref="formRef"
            :model="form"
            label-position="top"
            require-asterisk-position="right"
            hide-required-asterisk
            v-loading="loading"
            @submit.prevent
          >
            <template
              v-for="(item, index) in form.debug_field_list"
              :key="index"
            >
              <ElFormItem
                :label="item.name"
                :prop="`debug_field_list.${index}.value`"
                :rules="{
                  required: item.is_required,
                  message: `请输入${item.name}`,
                  trigger: 'blur',
                }"
              >
                <template #label>
                  <div class="flex">
                    <span
                      >{{ item.name }}
                      <span class="text-red-500" v-if="item.is_required"
                        >*</span
                      >
                    </span>
                    <ElTag size="small" type="info" class="ml-2">
                      {{ item.type }}
                    </ElTag>
                  </div>
                </template>
                <ElInput v-model="item.value" placeholder="请输入" />
              </ElFormItem>
            </template>
          </ElForm>
        </ElCard>
      </div>

      <ElButton type="primary" @click="handleSubmit" :loading="loading">
        运行
      </ElButton>
      <div v-if="showResult" class="mt-4">
        <h4 class="mb-4 mt-4 text-lg font-medium">运行结果</h4>
        <div class="mb-4">
          <ElAlert
            v-if="isSuccess"
            title="运行成功"
            type="success"
            show-icon
            :closable="false"
          />
          <ElAlert
            v-else
            title="运行失败"
            type="error"
            show-icon
            :closable="false"
          />
        </div>

        <div v-if="resultDisplay.runTime" class="mb-2 flex items-center gap-3">
          <ElTag
            v-if="resultDisplay.status"
            :type="isSuccess ? 'success' : 'danger'"
            size="small"
          >
            {{ resultDisplay.status }}
          </ElTag>
          <span class="text-sm text-gray-400"
            >耗时: {{ resultDisplay.runTime }}</span
          >
        </div>

        <p class="mb-2 text-gray-500">输出结果</p>

        <ElCard
          :class="isSuccess ? '' : 'debug-error-output'"
          shadow="never"
          class="debug-output-card"
        >
          <pre class="debug-code-block"><code>{{ formattedOutput }}</code></pre>
        </ElCard>

        <template v-if="resultDisplay.stderr">
          <p class="mb-2 mt-4 text-gray-500">错误输出</p>
          <ElCard shadow="never" class="debug-stderr-card">
            <pre
              class="debug-code-block debug-stderr-text"
            ><code>{{ resultDisplay.stderr }}</code></pre>
          </ElCard>
        </template>
      </div>
    </div>
  </ElDrawer>
</template>

<style scoped lang="scss">
.debug-output-card {
  :deep(.el-card__body) {
    max-height: 400px;
    padding: 12px;
    overflow-y: auto;
  }
}

.debug-error-output {
  .debug-code-block {
    color: var(--el-color-danger);
  }
}

.debug-stderr-card {
  :deep(.el-card__body) {
    max-height: 200px;
    padding: 12px;
    overflow-y: auto;
  }

  .debug-stderr-text {
    color: var(--el-color-danger);
  }
}

.debug-code-block {
  margin: 0;
  font-family: Menlo, Monaco, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: break-word;
  white-space: pre-wrap;
}
</style>
