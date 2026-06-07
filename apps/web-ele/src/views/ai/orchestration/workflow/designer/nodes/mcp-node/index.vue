<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import {
  ElButton,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElSelect,
  ElSwitch,
  ElText,
  ElTooltip,
} from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

import { getMcpTools, listTools } from '#/api/ai/tools';

import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';
import McpServerInputDialog from './component/McpServerInputDialog.vue';

type SourceType = 'custom' | 'referencing';
type InputType = 'JsonInput' | 'NumberInput' | 'SwitchInput' | 'TextInput';
type ResourceRecord = Record<string, unknown>;
type SchemaProperty = Record<string, unknown> & {
  description?: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  type?: string;
};
type ArgsSchema = Record<string, unknown> & {
  properties?: Record<string, SchemaProperty>;
  required?: string[];
};
type McpToolRecord = {
  args_schema?: ArgsSchema;
  description?: string;
  name: string;
  server?: string;
};
type ToolFormField = {
  field: string;
  input_type: InputType;
  label: {
    attrs: { tooltip?: string };
    input_type: 'TooltipLabel';
    label: string;
    props_info: Record<string, unknown>;
  };
  props_info: Record<string, unknown>;
  required: boolean;
  source: SourceType;
};
type McpNodeData = Record<string, unknown> & {
  mcp_server: string;
  mcp_servers: string;
  mcp_source: SourceType;
  mcp_tool: string;
  mcp_tool_id: number | string;
  mcp_tools: McpToolRecord[];
  params_nested: string;
  tool_form_field: ToolFormField[];
  tool_params: Record<string, unknown>;
};

const props = defineProps<{
  nodeModel: any;
  renderVersion?: number;
}>();

const defaultNodeData: McpNodeData = {
  mcp_server: '',
  mcp_servers: '',
  mcp_source: 'referencing',
  mcp_tool: '',
  mcp_tool_id: '',
  mcp_tools: [],
  params_nested: '',
  tool_form_field: [],
  tool_params: {},
};

const mcpServerJson = `{
  "math": {
    "url": "your_server",
    "transport": "sse"
  }
}`;

const formData = ref<McpNodeData>(
  normalizeNodeData(props.nodeModel.properties?.node_data),
);
const loading = ref(false);
const mcpToolOptions = ref<ResourceRecord[]>([]);
const mcpServerInputDialogRef =
  ref<InstanceType<typeof McpServerInputDialog>>();
const nodeRenderVersion = ref(0);

const selectedToolParams = computed(() => {
  if (!formData.value.params_nested) return formData.value.tool_params;
  const nestedValue = formData.value.tool_params[formData.value.params_nested];
  return isRecord(nestedValue) ? nestedValue : {};
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasField(data: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function recordsOf(value: unknown): ResourceRecord[] {
  const root = isRecord(value) && hasField(value, 'data') ? value.data : value;
  if (Array.isArray(root)) return root.filter((item) => isRecord(item));
  if (!isRecord(root)) return [];
  if (Array.isArray(root.data))
    return root.data.filter((item) => isRecord(item));
  for (const key of ['records', 'list', 'items']) {
    const list = root[key];
    if (Array.isArray(list)) return list.filter((item) => isRecord(item));
  }
  return [];
}

function idOf(record: ResourceRecord) {
  const value = record.id ?? record.toolId ?? record.tool_id ?? record.value;
  return typeof value === 'number' || typeof value === 'string'
    ? value
    : `${value || ''}`;
}

function nameOf(record: ResourceRecord) {
  return `${record.name || record.toolName || record.tool_name || record.title || idOf(record) || ''}`;
}

function descriptionOf(record: ResourceRecord) {
  return `${record.description || record.desc || record.remark || ''}`;
}

function codeOf(record: ResourceRecord) {
  const value =
    record.code ?? record.mcp_servers ?? record.content ?? record.config;
  return typeof value === 'string' ? value : '';
}

function typeOf(record: ResourceRecord) {
  return `${record.toolType || record.tool_type || record.type || record.category || ''}`.toUpperCase();
}

function isEnabled(record: ResourceRecord) {
  if (hasField(record, 'is_active')) return record.is_active !== false;
  if (hasField(record, 'enabled')) return record.enabled !== false;
  if (hasField(record, 'active')) return record.active !== false;
  if (hasField(record, 'status')) {
    const status = `${record.status || ''}`.toUpperCase();
    if (['DISABLED', 'INACTIVE', 'OFFLINE', 'STOPPED'].includes(status))
      return false;
  }
  return true;
}

function isMcpTool(record: ResourceRecord) {
  const toolType = typeOf(record);
  return (!toolType || toolType === 'MCP') && isEnabled(record);
}

function normalizeToolRecord(
  record: ResourceRecord,
): McpToolRecord | undefined {
  const name = `${record.name || ''}`.trim();
  if (!name) return undefined;
  const schema = isRecord(record.args_schema)
    ? cloneDeep(record.args_schema)
    : undefined;
  return {
    args_schema: schema as ArgsSchema | undefined,
    description: `${record.description || ''}`,
    name,
    server: `${record.server || ''}`,
  };
}

function normalizeToolResponse(value: unknown) {
  return recordsOf(value).flatMap((record) => {
    const normalized = normalizeToolRecord(record);
    return normalized ? [normalized] : [];
  });
}

function normalizeSource(value: unknown): SourceType {
  return value === 'custom' ? 'custom' : 'referencing';
}

function normalizeNodeData(source: unknown): McpNodeData {
  const sourceData = isRecord(source) ? cloneDeep(source) : {};
  const next: McpNodeData = {
    ...cloneDeep(defaultNodeData),
    ...sourceData,
    mcp_server: `${sourceData.mcp_server || ''}`,
    mcp_servers: `${sourceData.mcp_servers || sourceData.server || ''}`,
    mcp_source: normalizeSource(
      sourceData.mcp_source ||
        (sourceData.mcp_servers || sourceData.server
          ? 'custom'
          : 'referencing'),
    ),
    mcp_tool: `${sourceData.mcp_tool || sourceData.tool || ''}`,
    mcp_tool_id:
      typeof sourceData.mcp_tool_id === 'number' ||
      typeof sourceData.mcp_tool_id === 'string'
        ? sourceData.mcp_tool_id
        : '',
    mcp_tools: Array.isArray(sourceData.mcp_tools)
      ? cloneDeep(sourceData.mcp_tools).flatMap((record) =>
          isRecord(record) ? normalizeToolRecord(record) || [] : [],
        )
      : [],
    params_nested: `${sourceData.params_nested || ''}`,
    tool_form_field: Array.isArray(sourceData.tool_form_field)
      ? (cloneDeep(sourceData.tool_form_field) as ToolFormField[])
      : [],
    tool_params: isRecord(sourceData.tool_params)
      ? cloneDeep(sourceData.tool_params)
      : {},
  };
  return next;
}

function emitInlineUpdate() {
  props.nodeModel.graphModel?.eventCenter?.emit?.('node:inline-update', {
    fields: ['node_data'],
    id: props.nodeModel.id,
    properties: props.nodeModel.properties,
    source: 'vue-node',
  });
}

function refreshNode() {
  nodeRenderVersion.value += 1;
  emitInlineUpdate();
}

function syncNodeData(nextData: McpNodeData) {
  formData.value = cloneDeep(nextData);
  const nodeModel = props.nodeModel;
  if (!nodeModel.properties) set(nodeModel, 'properties', {});
  set(nodeModel.properties, 'node_data', cloneDeep(nextData));
  refreshNode();
}

function findReferencedMcpTool(id: unknown) {
  return mcpToolOptions.value.find((record) => `${idOf(record)}` === `${id}`);
}

function patchMcpSource(value: SourceType) {
  const nextData = cloneDeep(formData.value);
  set(nextData, 'mcp_source', value);
  set(nextData, 'mcp_tool', '');
  set(nextData, 'mcp_server', '');
  set(nextData, 'mcp_tools', []);
  set(nextData, 'tool_params', {});
  set(nextData, 'tool_form_field', []);
  set(nextData, 'params_nested', '');
  if (value === 'custom') set(nextData, 'mcp_tool_id', '');
  if (value === 'referencing') set(nextData, 'mcp_servers', '');
  syncNodeData(nextData);
}

function normalizeSourceEvent(value: unknown): SourceType {
  return value === 'custom' ? 'custom' : 'referencing';
}

function patchMcpServers(value: string) {
  const nextData = cloneDeep(formData.value);
  set(nextData, 'mcp_servers', value);
  set(nextData, 'mcp_tool', '');
  set(nextData, 'mcp_server', '');
  set(nextData, 'mcp_tools', []);
  set(nextData, 'tool_params', {});
  set(nextData, 'tool_form_field', []);
  set(nextData, 'params_nested', '');
  syncNodeData(nextData);
}

function selectReferencedMcpTool(value: number | string) {
  const nextData = cloneDeep(formData.value);
  const tool = findReferencedMcpTool(value);
  set(nextData, 'mcp_tool_id', value);
  set(nextData, 'mcp_servers', tool ? codeOf(tool) : '');
  set(nextData, 'mcp_tool', '');
  set(nextData, 'mcp_server', '');
  set(nextData, 'mcp_tools', []);
  set(nextData, 'tool_params', {});
  set(nextData, 'tool_form_field', []);
  set(nextData, 'params_nested', '');
  syncNodeData(nextData);
}

function inputTypeOf(property: SchemaProperty): InputType {
  if (property.type === 'number' || property.type === 'integer')
    return 'NumberInput';
  if (property.type === 'boolean') return 'SwitchInput';
  if (property.type === 'array' || property.type === 'object')
    return 'JsonInput';
  return 'TextInput';
}

function buildToolField(
  field: string,
  property: SchemaProperty,
  requiredList?: string[],
): ToolFormField {
  const required = Array.isArray(requiredList) && requiredList.includes(field);
  return {
    field,
    input_type: inputTypeOf(property),
    label: {
      attrs: { tooltip: property.description },
      input_type: 'TooltipLabel',
      label: field,
      props_info: {},
    },
    props_info: {
      rules: [
        {
          message: '请填写必填参数',
          required,
          trigger: 'blur',
        },
      ],
    },
    required,
    source: 'referencing',
  };
}

function buildToolForm(tool: McpToolRecord) {
  const argsSchema = tool.args_schema;
  const schemaProperties = argsSchema?.properties || {};
  const fields: ToolFormField[] = [];
  let paramsNested = '';

  for (const [field, property] of Object.entries(schemaProperties)) {
    if (property.properties) {
      paramsNested = field;
      for (const [nestedField, nestedProperty] of Object.entries(
        property.properties,
      )) {
        fields.push(
          buildToolField(nestedField, nestedProperty, property.required),
        );
      }
    } else {
      fields.push(buildToolField(field, property, argsSchema?.required));
    }
  }

  const toolParams: Record<string, unknown> = paramsNested
    ? { [paramsNested]: {} }
    : {};
  return { fields, paramsNested, toolParams };
}

function selectMcpTool(value: string) {
  const selectedTool = formData.value.mcp_tools.find(
    (tool) => tool.name === value,
  );
  const nextData = cloneDeep(formData.value);
  set(nextData, 'mcp_tool', value);
  set(nextData, 'mcp_server', selectedTool?.server || '');
  if (selectedTool) {
    const toolForm = buildToolForm(selectedTool);
    set(nextData, 'tool_form_field', toolForm.fields);
    set(nextData, 'params_nested', toolForm.paramsNested);
    set(nextData, 'tool_params', toolForm.toolParams);
  } else {
    set(nextData, 'tool_form_field', []);
    set(nextData, 'params_nested', '');
    set(nextData, 'tool_params', {});
  }
  syncNodeData(nextData);
}

function defaultValueFor(field: ToolFormField) {
  if (field.source === 'referencing') return [];
  if (field.input_type === 'SwitchInput') return false;
  if (field.input_type === 'NumberInput') return 0;
  return '';
}

function patchToolFieldSource(field: ToolFormField, value: SourceType) {
  const nextData = cloneDeep(formData.value);
  const fieldList = nextData.tool_form_field.map((item) =>
    item.field === field.field ? { ...item, source: value } : item,
  );
  set(nextData, 'tool_form_field', fieldList);
  setToolParamValue(
    nextData,
    field.field,
    defaultValueFor({ ...field, source: value }),
  );
  syncNodeData(nextData);
}

function setToolParamValue(data: McpNodeData, field: string, value: unknown) {
  if (data.params_nested) {
    if (!isRecord(data.tool_params[data.params_nested]))
      set(data.tool_params, data.params_nested, {});
    set(
      data.tool_params[data.params_nested] as Record<string, unknown>,
      field,
      cloneDeep(value),
    );
    return;
  }
  set(data.tool_params, field, cloneDeep(value));
}

function patchToolParam(field: string, value: unknown) {
  const nextData = cloneDeep(formData.value);
  setToolParamValue(nextData, field, value);
  syncNodeData(nextData);
}

function hasParamValue(value: unknown) {
  if (Array.isArray(value)) return value.length >= 2;
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  return value !== undefined && value !== null && `${value}`.trim() !== '';
}

function paramValue(field: string) {
  return selectedToolParams.value[field];
}

function paramArrayValue(field: string) {
  const value = paramValue(field);
  return Array.isArray(value) ? value : [];
}

function paramNumberValue(field: string) {
  const value = paramValue(field);
  return typeof value === 'number' ? value : undefined;
}

function paramStringValue(field: string) {
  const value = paramValue(field);
  return typeof value === 'string' || typeof value === 'number'
    ? `${value}`
    : '';
}

function validateMcpServerJson(value: string) {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function extractPlaceholders(input: unknown): string[] {
  const placeholderPattern = /\{\{\s*([a-z_][\w.]*)\s*\}\}/gi;
  const found = new Set<string>();

  function visit(value: unknown) {
    if (typeof value === 'string') {
      let match = placeholderPattern.exec(value);
      while (match) {
        if (match[1]) found.add(match[1]);
        match = placeholderPattern.exec(value);
      }
      placeholderPattern.lastIndex = 0;
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item));
      return;
    }
    if (isRecord(value)) Object.values(value).forEach((item) => visit(item));
  }

  if (typeof input === 'string') {
    try {
      visit(JSON.parse(input));
    } catch {
      visit(input);
    }
  } else {
    visit(input);
  }

  return [...found];
}

function replaceMcpVariables(
  mcpServers: string,
  variables: Record<string, string>,
) {
  let nextValue = mcpServers;
  Object.entries(variables).forEach(([key, value]) => {
    nextValue = nextValue.replaceAll(
      new RegExp(
        String.raw`\{\{\s*${key.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)}\s*\}\}`,
        'g',
      ),
      value,
    );
  });
  return nextValue;
}

async function loadMcpToolOptions() {
  try {
    const response = await listTools();
    mcpToolOptions.value = recordsOf(response).filter((record) =>
      isMcpTool(record),
    );
  } catch {
    ElMessage.warning('MCP 工具列表加载失败');
  }
}

function validateDiscoverySource() {
  if (
    formData.value.mcp_source === 'referencing' &&
    (!formData.value.mcp_tool_id ||
      !findReferencedMcpTool(formData.value.mcp_tool_id))
  ) {
    ElMessage.warning('请选择 MCP 工具资源');
    return false;
  }
  if (!`${formData.value.mcp_servers || ''}`.trim()) {
    ElMessage.warning('请填写 MCP Server Config');
    return false;
  }
  if (!validateMcpServerJson(formData.value.mcp_servers)) {
    ElMessage.warning('MCP Server Config 必须是合法 JSON');
    return false;
  }
  return true;
}

async function requestMcpTools(mcpServers: string) {
  loading.value = true;
  try {
    const response = await getMcpTools(mcpServers);
    const tools = normalizeToolResponse(response);
    const nextData = cloneDeep(formData.value);
    set(nextData, 'mcp_tools', tools);
    const stillSelectedTool = tools.find(
      (tool) => tool.name === nextData.mcp_tool,
    );
    set(nextData, 'mcp_server', stillSelectedTool?.server || '');
    if (!stillSelectedTool) {
      set(nextData, 'mcp_tool', '');
      set(nextData, 'tool_form_field', []);
      set(nextData, 'tool_params', {});
      set(nextData, 'params_nested', '');
    }
    syncNodeData(nextData);
    ElMessage.success('MCP 工具获取成功');
  } catch {
    ElMessage.error('MCP 工具获取失败，请确认服务端已提供 MCP 工具发现接口');
  } finally {
    loading.value = false;
  }
}

function getTools() {
  if (!validateDiscoverySource()) return;
  const variables = extractPlaceholders(formData.value.mcp_servers);
  if (variables.length > 0) {
    mcpServerInputDialogRef.value?.open(variables);
    return;
  }
  void requestMcpTools(formData.value.mcp_servers);
}

function handleMcpVariables(variables: Record<string, string>) {
  void requestMcpTools(
    replaceMcpVariables(formData.value.mcp_servers, variables),
  );
}

function validate() {
  const data = formData.value;
  if (!`${data.mcp_servers || ''}`.trim()) {
    return Promise.reject(createValidationError('请填写 MCP Server Config'));
  }
  if (!`${data.mcp_tool || ''}`.trim()) {
    return Promise.reject(createValidationError('请选择 MCP 工具'));
  }

  for (const field of data.tool_form_field.filter((item) => item.required)) {
    if (!hasParamValue(paramValue(field.field))) {
      return Promise.reject(createValidationError(`${field.field} 为必填参数`));
    }
  }
  return Promise.resolve();
}

function createValidationError(errMessage: string) {
  return Object.assign(new Error(errMessage), {
    errMessage,
    node: props.nodeModel,
  });
}

onMounted(() => {
  const normalizedData = normalizeNodeData(
    props.nodeModel.properties?.node_data,
  );
  syncNodeData(normalizedData);
  set(props.nodeModel, 'validate', validate);
  void loadMcpToolOptions();
});
</script>

<template>
  <NodeContainer
    :node-model="nodeModel"
    :render-version="nodeRenderVersion + (renderVersion || 0)"
  >
    <ElForm
      v-loading="loading"
      :model="formData"
      class="workflow-mcp-node"
      label-position="top"
      @submit.prevent
    >
      <section class="workflow-mcp-node__panel">
        <ElFormItem required>
          <template #label>
            <div class="workflow-mcp-node__form-label">
              <span>MCP Server Config</span>
              <ElSelect
                :model-value="formData.mcp_source"
                :teleported="false"
                size="small"
                @update:model-value="
                  patchMcpSource(normalizeSourceEvent($event))
                "
              >
                <ElOption label="引用" value="referencing" />
                <ElOption label="自定义" value="custom" />
              </ElSelect>
            </div>
          </template>
          <ElInput
            v-if="formData.mcp_source === 'custom'"
            :model-value="formData.mcp_servers"
            type="textarea"
            :rows="7"
            :placeholder="mcpServerJson"
            @update:model-value="patchMcpServers"
          />
          <ElSelect
            v-else
            :model-value="formData.mcp_tool_id"
            clearable
            filterable
            placeholder="请选择 MCP 工具资源"
            :teleported="false"
            @update:model-value="selectReferencedMcpTool"
          >
            <ElOption
              v-for="record in mcpToolOptions"
              :key="`${idOf(record)}`"
              :label="nameOf(record)"
              :value="idOf(record)"
            >
              <div class="workflow-mcp-node__option">
                <span>{{ nameOf(record) }}</span>
                <small>{{ descriptionOf(record) || idOf(record) }}</small>
              </div>
            </ElOption>
          </ElSelect>
        </ElFormItem>

        <ElFormItem required>
          <template #label>
            <div class="workflow-mcp-node__form-label">
              <span>工具</span>
              <ElButton link type="primary" @click="getTools">
                获取工具
              </ElButton>
            </div>
          </template>
          <ElSelect
            :model-value="formData.mcp_tool"
            clearable
            filterable
            placeholder="请选择 MCP 工具"
            :teleported="false"
            @update:model-value="selectMcpTool"
          >
            <ElOption
              v-for="tool in formData.mcp_tools"
              :key="`${tool.server || ''}:${tool.name}`"
              :label="tool.name"
              :value="tool.name"
            >
              <div class="workflow-mcp-node__option">
                <span>{{ tool.name }}</span>
                <ElTooltip
                  v-if="tool.description"
                  :content="tool.description"
                  placement="top-start"
                >
                  <small>{{ tool.description }}</small>
                </ElTooltip>
                <small v-else>{{ tool.server || 'MCP' }}</small>
              </div>
            </ElOption>
          </ElSelect>
        </ElFormItem>
      </section>

      <section class="workflow-mcp-node__panel">
        <div class="workflow-mcp-node__panel-head">工具参数</div>
        <ElText v-if="!formData.mcp_tool" type="info">暂无数据</ElText>
        <ElEmpty
          v-else-if="formData.tool_form_field.length === 0"
          description="暂无参数"
          :image-size="42"
        />
        <div v-else class="workflow-mcp-node__fields">
          <ElFormItem
            v-for="field in formData.tool_form_field"
            :key="field.field"
            :required="field.required"
          >
            <template #label>
              <div class="workflow-mcp-node__form-label">
                <span class="workflow-mcp-node__field-label">
                  {{ field.label.label }}
                  <ElTooltip
                    v-if="field.label.attrs.tooltip"
                    :content="field.label.attrs.tooltip"
                    placement="top-start"
                  >
                    <small>?</small>
                  </ElTooltip>
                </span>
                <ElSelect
                  :model-value="field.source"
                  :teleported="false"
                  size="small"
                  @update:model-value="
                    patchToolFieldSource(field, normalizeSourceEvent($event))
                  "
                >
                  <ElOption label="引用" value="referencing" />
                  <ElOption label="自定义" value="custom" />
                </ElSelect>
              </div>
            </template>
            <NodeCascader
              v-if="field.source === 'referencing'"
              :node-model="nodeModel"
              :model-value="paramArrayValue(field.field)"
              class="w-full"
              placeholder="选择变量"
              @update:model-value="patchToolParam(field.field, $event)"
            />
            <ElInput
              v-else-if="field.input_type === 'TextInput'"
              :model-value="paramStringValue(field.field)"
              @update:model-value="patchToolParam(field.field, $event)"
            />
            <ElInputNumber
              v-else-if="field.input_type === 'NumberInput'"
              :model-value="paramNumberValue(field.field)"
              controls-position="right"
              class="w-full"
              @update:model-value="patchToolParam(field.field, $event)"
            />
            <ElSwitch
              v-else-if="field.input_type === 'SwitchInput'"
              :model-value="paramValue(field.field) === true"
              @update:model-value="patchToolParam(field.field, $event)"
            />
            <ElInput
              v-else
              :model-value="paramStringValue(field.field)"
              type="textarea"
              :rows="3"
              placeholder="请输入 JSON"
              @update:model-value="patchToolParam(field.field, $event)"
            />
          </ElFormItem>
        </div>
      </section>
    </ElForm>
    <McpServerInputDialog
      ref="mcpServerInputDialogRef"
      @refresh="handleMcpVariables"
    />
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-mcp-node,
.workflow-mcp-node__panel,
.workflow-mcp-node__fields {
  display: grid;
  gap: 8px;
}

.workflow-mcp-node__panel {
  padding: 8px;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.workflow-mcp-node :deep(.el-form-item) {
  margin-bottom: 6px;
}

.workflow-mcp-node :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.workflow-mcp-node__form-label,
.workflow-mcp-node__field-label,
.workflow-mcp-node__option {
  display: flex;
  gap: 6px;
  align-items: center;
}

.workflow-mcp-node__form-label {
  justify-content: space-between;
  width: 100%;
}

.workflow-mcp-node__form-label > .el-select {
  width: 86px;
}

.workflow-mcp-node__panel-head {
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.workflow-mcp-node__field-label {
  min-width: 0;
}

.workflow-mcp-node__field-label small {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-placeholder);
  border: 1px solid var(--el-border-color);
  border-radius: 50%;
}

.workflow-mcp-node__option {
  min-width: 0;
}

.workflow-mcp-node__option span,
.workflow-mcp-node__option small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-mcp-node__option small {
  color: var(--el-text-color-placeholder);
}
</style>
