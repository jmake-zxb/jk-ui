<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

import {
  CaretRight,
  Close,
  EditPen,
  MagicStick,
  Operation,
  Plus,
} from '@element-plus/icons-vue';
import {
  ElAvatar,
  ElButton,
  ElCheckbox,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTooltip,
} from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

import { listApplications } from '#/api/ai/applications';
import { listTools } from '#/api/ai/tools';

import GeneratePromptDialog from '../../../../applications/GeneratePromptDialog.vue';
import ModelParamSettingDialog from '../../../../applications/ModelParamSettingDialog.vue';
import { syncNodeProperties } from '../../common/node-inline-update';
import NodeCascader from '../../common/NodeCascader.vue';
import NodeContainer from '../../common/NodeContainer.vue';
import LocalModelSelect from '../base-node/component/LocalModelSelect.vue';
import McpServersDialog from './component/McpServersDialog.vue';
import ReasoningParamSettingDialog from './component/ReasoningParamSettingDialog.vue';
import ResourceSelectDialog from './component/ResourceSelectDialog.vue';
import TextMagnifyDialog from './component/TextMagnifyDialog.vue';

type ResourceRecord = Record<string, unknown>;
type ResourceKind = 'application' | 'mcp' | 'skill' | 'tool';

const props = defineProps<{
  nodeModel: any;
  renderVersion?: number;
}>();
const nodeModel = props.nodeModel;

const defaultPrompt =
  '请根据用户问题和知识库检索结果回答。\n\n用户问题：{{start-node.question}}\n\n知识库检索结果：\n{{search-knowledge-node.data}}\n\n如果检索结果不足以回答，请说明无法从现有知识中确认。';

const defaultModelSetting = {
  reasoning_content_enable: false,
  reasoning_content_end: '</think>',
  reasoning_content_start: '<think>',
};

const defaultNodeData = {
  application_ids: [],
  dialogue_number: 1,
  dialogue_type: 'WORKFLOW',
  is_result: true,
  mcp_output_enable: true,
  mcp_servers: '',
  mcp_source: 'custom',
  mcp_tool_ids: [],
  model_id: '',
  model_id_reference: [],
  model_id_type: 'custom',
  model_params_setting: {},
  model_setting: cloneDeep(defaultModelSetting),
  prompt: defaultPrompt,
  skill_tool_ids: [],
  system: '',
  tool_ids: [],
};

const collapseData = reactive({
  application: true,
  mcp: true,
  skill: true,
  tool: true,
});

const modelParamOpen = ref(false);
const generatePromptOpen = ref(false);
const textMagnifyDialogRef = ref<InstanceType<typeof TextMagnifyDialog>>();
const mcpServersDialogRef = ref<InstanceType<typeof McpServersDialog>>();
const resourceSelectDialogRef =
  ref<InstanceType<typeof ResourceSelectDialog>>();
const reasoningParamDialogRef =
  ref<InstanceType<typeof ReasoningParamSettingDialog>>();
const resourceDialogKind = ref<ResourceKind>('tool');
const nodeRenderVersion = ref(0);
const tools = ref<ResourceRecord[]>([]);
const applications = ref<ResourceRecord[]>([]);

function refreshNode() {
  nodeRenderVersion.value += 1;
  syncNodeProperties(
    nodeModel,
    { node_data: nodeModel.properties.node_data || {} },
    ['node_data'],
  );
}

function hasField(data: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function recordsOf(value: unknown): ResourceRecord[] {
  const root = asRecord(value);
  const data = root && hasField(root, 'data') ? root.data : value;
  if (Array.isArray(data))
    return data.filter((item) => !!asRecord(item)) as ResourceRecord[];
  const dataRecord = asRecord(data);
  if (!dataRecord) return [];
  const nestedData = dataRecord.data;
  if (Array.isArray(nestedData))
    return nestedData.filter((item) => !!asRecord(item)) as ResourceRecord[];
  for (const key of ['records', 'list', 'items']) {
    const list = dataRecord[key];
    if (Array.isArray(list))
      return list.filter((item) => !!asRecord(item)) as ResourceRecord[];
  }
  return [];
}

function ensureNodeData() {
  let changed = false;
  if (!nodeModel.properties.node_data) {
    set(nodeModel.properties, 'node_data', cloneDeep(defaultNodeData));
    changed = true;
  }

  const data = nodeModel.properties.node_data as Record<string, unknown>;
  Object.entries(defaultNodeData).forEach(([key, value]) => {
    if (!hasField(data, key)) {
      set(data, key, cloneDeep(value));
      changed = true;
    }
  });

  if (asRecord(data.model_setting)) {
    const setting = data.model_setting as Record<string, unknown>;
    Object.entries(defaultModelSetting).forEach(([key, value]) => {
      if (!hasField(setting, key)) {
        set(setting, key, value);
        changed = true;
      }
    });
  } else {
    set(data, 'model_setting', cloneDeep(defaultModelSetting));
    changed = true;
  }

  for (const key of [
    'application_ids',
    'mcp_tool_ids',
    'model_id_reference',
    'skill_tool_ids',
    'tool_ids',
  ]) {
    if (!Array.isArray(data[key])) {
      set(data, key, []);
      changed = true;
    }
  }

  for (const key of ['image_list', 'video_list']) {
    if (hasField(data, key) && !Array.isArray(data[key])) {
      set(data, key, []);
      changed = true;
    }
  }

  if (hasField(data, 'mcp_tool_id') && data.mcp_tool_id) {
    const currentIds = Array.isArray(data.mcp_tool_ids)
      ? cloneDeep(data.mcp_tool_ids)
      : [];
    if (currentIds.length === 0) currentIds.push(data.mcp_tool_id);
    set(data, 'mcp_tool_ids', currentIds);
    set(data, 'mcp_tool_id', undefined);
    changed = true;
  }

  if (changed) refreshNode();
}

function currentBaseFileUploadSetting() {
  const nodes = nodeModel.graphModel?.nodes;
  if (!Array.isArray(nodes)) return undefined;
  const baseNode = nodes.find(
    (node: unknown) => asRecord(node)?.id === 'base-node',
  );
  const nodeData = asRecord(asRecord(baseNode)?.properties)?.node_data;
  const data = asRecord(nodeData);
  if (!data?.file_upload_enable) return undefined;
  return asRecord(data.file_upload_setting);
}

function syncMediaFieldsFromBaseNode() {
  const setting = currentBaseFileUploadSetting();
  const enabledByKey: Record<'image_list' | 'video_list', boolean> = {
    image_list: !!setting?.image,
    video_list: !!setting?.video,
  };
  const currentData = asRecord(nodeModel.properties.node_data) || {};
  const nextData = cloneDeep(currentData);
  let changed = false;

  Object.entries(enabledByKey).forEach(([key, enabled]) => {
    if (enabled && !hasField(nextData, key)) {
      set(nextData, key, []);
      changed = true;
    }
    if (!enabled && hasField(nextData, key)) {
      delete nextData[key];
      changed = true;
    }
  });

  if (!changed) return;
  set(nodeModel.properties, 'node_data', nextData);
  refreshNode();
}

ensureNodeData();

const formData = computed(() => {
  trackRenderVersion(props.renderVersion, nodeRenderVersion.value);
  return nodeModel.properties.node_data || {};
});

function trackRenderVersion(..._versions: unknown[]) {}

const modelParamsSummary = computed(() => {
  const setting = formData.value.model_params_setting;
  if (!setting || typeof setting !== 'object' || Array.isArray(setting))
    return '默认参数';
  const count = Object.keys(setting).length;
  return count ? `${count} 项` : '默认参数';
});

const mcpToolOptions = computed(() => filterTools(['MCP']));
const toolOptions = computed(() => filterTools(['CUSTOM', 'WORKFLOW']));
const skillToolOptions = computed(() => filterTools(['SKILL']));

function patchData(key: string, value: unknown) {
  set(nodeModel.properties.node_data, key, cloneDeep(value));
  refreshNode();
}

function hasNodeDataField(key: string) {
  return Object.prototype.hasOwnProperty.call(formData.value, key);
}

function patchModelType(value: string) {
  set(nodeModel.properties.node_data, 'model_id_type', value);
  set(nodeModel.properties.node_data, 'model_id_reference', []);
  refreshNode();
}

function patchModelId(value: number | string | undefined) {
  set(nodeModel.properties.node_data, 'model_id', value || '');
  if (!value) set(nodeModel.properties.node_data, 'model_params_setting', {});
  refreshNode();
}

function patchReasoning(key: string, value: unknown) {
  const current = asRecord(formData.value.model_setting) || defaultModelSetting;
  const setting = cloneDeep(current);
  set(setting, key, value);
  patchData('model_setting', setting);
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function idOf(record: ResourceRecord) {
  return (
    record.id ??
    record.toolId ??
    record.tool_id ??
    record.applicationId ??
    record.application_id ??
    record.value
  );
}

function nameOf(record: ResourceRecord) {
  return `${record.name || record.toolName || record.tool_name || record.applicationName || record.application_name || record.title || idOf(record) || ''}`;
}

function iconOf(record: ResourceRecord) {
  const icon = record.icon || record.logo || record.avatar;
  return typeof icon === 'string' ? icon : '';
}

function typeOf(record: ResourceRecord) {
  return `${record.toolType || record.tool_type || record.type || record.category || ''}`.toUpperCase();
}

function typeLabel(record: ResourceRecord, fallback: string) {
  return typeOf(record) || fallback;
}

function isEnabled(record: ResourceRecord) {
  if (hasField(record, 'is_active')) return record.is_active !== false;
  if (hasField(record, 'active')) return record.active !== false;
  if (hasField(record, 'enabled')) return record.enabled !== false;
  if (hasField(record, 'status')) {
    const status = `${record.status || ''}`.toUpperCase();
    if (['DISABLED', 'INACTIVE', 'OFFLINE', 'STOPPED'].includes(status))
      return false;
  }
  return true;
}

function isPublishedApplication(record: ResourceRecord) {
  if (!isEnabled(record)) return false;
  if (hasField(record, 'is_publish')) return record.is_publish === true;
  if (hasField(record, 'isPublished')) return record.isPublished === true;
  if (hasField(record, 'published')) return record.published === true;
  if (hasField(record, 'publishStatus')) {
    const status = `${record.publishStatus || ''}`.toUpperCase();
    return ['ENABLED', 'ONLINE', 'PUBLISH', 'PUBLISHED'].includes(status);
  }
  if (hasField(record, 'publish_status')) {
    const status = `${record.publish_status || ''}`.toUpperCase();
    return ['ENABLED', 'ONLINE', 'PUBLISH', 'PUBLISHED'].includes(status);
  }
  return true;
}

function filterTools(types: string[]) {
  return tools.value.filter((record) => {
    if (!isEnabled(record)) return false;
    const toolType = typeOf(record);
    return !toolType || types.includes(toolType);
  });
}

function findResource(options: ResourceRecord[], id: unknown) {
  return options.find((record) => `${idOf(record)}` === `${id}`);
}

function selectedResources(
  ids: unknown,
  options: ResourceRecord[],
  fallbackType: string,
) {
  return arrayValue(ids).flatMap((id) => {
    const record = findResource(options, id);
    if (!record) return [];
    return {
      fallbackType,
      icon: record ? iconOf(record) : '',
      id,
      name: record ? nameOf(record) : `${id}`,
      type: record ? typeLabel(record, fallbackType) : fallbackType,
    };
  });
}

function selectedCount(ids: unknown, options?: ResourceRecord[]) {
  if (!options) return arrayValue(ids).length;
  return selectedResources(ids, options, '').length;
}

function removeId(key: string, id: unknown) {
  const nextIds = arrayValue(formData.value[key]).filter(
    (item) => `${item}` !== `${id}`,
  );
  patchData(key, nextIds);
}

function clearCustomMcpServers() {
  patchData('mcp_servers', '');
}

function resourceOptions(kind: ResourceKind) {
  if (kind === 'mcp') return mcpToolOptions.value;
  if (kind === 'skill') return skillToolOptions.value;
  if (kind === 'application')
    return applications.value.filter((record) =>
      isPublishedApplication(record),
    );
  return toolOptions.value;
}

function resourceIdsKey(kind: ResourceKind) {
  if (kind === 'mcp') return 'mcp_tool_ids';
  if (kind === 'skill') return 'skill_tool_ids';
  if (kind === 'application') return 'application_ids';
  return 'tool_ids';
}

function resourceTitle(kind: ResourceKind) {
  if (kind === 'mcp') return '选择 MCP 工具';
  if (kind === 'skill') return '选择技能';
  if (kind === 'application') return '选择应用';
  return '选择工具';
}

function openResourceDialog(kind: ResourceKind) {
  resourceDialogKind.value = kind;
  resourceSelectDialogRef.value?.open(
    arrayValue(formData.value[resourceIdsKey(kind)]),
  );
}

function submitResourceDialog(ids: Array<number | string>) {
  patchData(resourceIdsKey(resourceDialogKind.value), ids);
  set(collapseData, resourceDialogKind.value, true);
}

function openMcpServersDialog() {
  mcpServersDialogRef.value?.open({
    mcp_servers: formData.value.mcp_servers,
    mcp_source: formData.value.mcp_source || 'custom',
    mcp_tool_ids: arrayValue(formData.value.mcp_tool_ids),
  });
}

function submitMcpServersDialog(config: {
  mcp_servers: string;
  mcp_source: string;
  mcp_tool_ids: Array<number | string>;
}) {
  set(nodeModel.properties.node_data, 'mcp_servers', config.mcp_servers);
  set(
    nodeModel.properties.node_data,
    'mcp_tool_ids',
    cloneDeep(config.mcp_tool_ids),
  );
  set(nodeModel.properties.node_data, 'mcp_source', config.mcp_source);
  set(collapseData, 'mcp', true);
  refreshNode();
}

function validationError(errMessage: string) {
  return Object.assign(new Error(errMessage), {
    errMessage,
    node: nodeModel,
  });
}

const resolvedModelId = computed(() => {
  const value = formData.value.model_id || formData.value.modelId;
  return typeof value === 'number' || typeof value === 'string' ? value : '';
});

const modelParamSetting = computed(() => {
  const setting = formData.value.model_params_setting;
  return setting && typeof setting === 'object' && !Array.isArray(setting)
    ? (setting as Record<string, unknown>)
    : {};
});

function openModelParamDialog() {
  modelParamOpen.value = true;
}

function refreshModelParams(value: Record<string, unknown>) {
  patchData('model_params_setting', value);
}

function openGeneratePrompt() {
  generatePromptOpen.value = true;
}

function applyGeneratedPrompt(prompt: string) {
  patchData('system', prompt);
}

function openTextMagnifyDialog(key: 'prompt' | 'system', title: string) {
  textMagnifyDialogRef.value?.open({
    key,
    title,
    value: `${formData.value[key] || ''}`,
  });
}

function submitTextMagnifyDialog(data: {
  key: 'prompt' | 'system';
  value: string;
}) {
  patchData(data.key, data.value);
}

function openReasoningParamSettingDialog() {
  reasoningParamDialogRef.value?.open(
    formData.value.model_setting || defaultModelSetting,
  );
}

function submitReasoningDialog(value: Record<string, unknown>) {
  const current = asRecord(formData.value.model_setting) || defaultModelSetting;
  const setting = cloneDeep(current);
  Object.entries(value).forEach(([key, item]) => set(setting, key, item));
  patchData('model_setting', setting);
}

function isValidMcpJson(value: unknown) {
  const text = `${value || ''}`.trim();
  if (!text) return true;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function validate() {
  const data = formData.value;
  if ((data.model_id_type || 'custom') === 'reference') {
    if (
      !Array.isArray(data.model_id_reference) ||
      data.model_id_reference.length < 2
    ) {
      return Promise.reject(validationError('请选择模型变量'));
    }
  } else if (!`${data.model_id || data.modelId || ''}`.trim()) {
    return Promise.reject(validationError('请选择模型'));
  }
  if (!`${data.prompt || ''}`.trim()) {
    return Promise.reject(validationError('请输入用户提示词'));
  }
  if (!isValidMcpJson(data.mcp_servers)) {
    return Promise.reject(validationError('自定义 MCP Server 必须是合法 JSON'));
  }
  return Promise.resolve();
}

async function loadResourceOptions() {
  const [toolResponse, applicationResponse] = await Promise.all([
    listTools(),
    listApplications(),
  ]);
  tools.value = recordsOf(toolResponse);
  applications.value = recordsOf(applicationResponse).filter((record) =>
    isPublishedApplication(record),
  );
}

onMounted(() => {
  ensureNodeData();
  syncMediaFieldsFromBaseNode();
  nodeModel.graphModel?.eventCenter?.on?.(
    'refreshFileUploadConfig',
    syncMediaFieldsFromBaseNode,
  );
  set(nodeModel, 'validate', validate);
  loadResourceOptions();
});

onBeforeUnmount(() => {
  nodeModel.graphModel?.eventCenter?.off?.(
    'refreshFileUploadConfig',
    syncMediaFieldsFromBaseNode,
  );
});
</script>

<template>
  <NodeContainer
    :node-model="nodeModel"
    :render-version="nodeRenderVersion + (renderVersion || 0)"
  >
    <ElForm
      :model="formData"
      class="workflow-ai-chat-node"
      label-position="top"
      @submit.prevent
    >
      <section class="workflow-ai-chat-node__panel">
        <ElFormItem label="模型" required>
          <template #label>
            <div class="workflow-ai-chat-node__form-label">
              <span>模型</span>
              <ElSelect
                :model-value="formData.model_id_type || 'custom'"
                :teleported="false"
                size="small"
                @update:model-value="patchModelType"
              >
                <ElOption label="自定义" value="custom" />
                <ElOption label="变量引用" value="reference" />
              </ElSelect>
            </div>
          </template>
          <div class="workflow-ai-chat-node__model-row">
            <LocalModelSelect
              v-if="(formData.model_id_type || 'custom') === 'custom'"
              :model-value="formData.model_id || formData.modelId"
              model-type="LLM"
              placeholder="请选择模型"
              @update:model-value="patchModelId"
            />
            <NodeCascader
              v-else
              :node-model="nodeModel"
              :model-value="formData.model_id_reference || []"
              class="w-full"
              placeholder="选择模型变量"
              @update:model-value="patchData('model_id_reference', $event)"
            />
            <ElButton
              :disabled="
                (formData.model_id_type || 'custom') !== 'custom' ||
                !formData.model_id
              "
              size="small"
              @click="openModelParamDialog"
            >
              <ElIcon><Operation /></ElIcon>
            </ElButton>
          </div>
        </ElFormItem>

        <ElFormItem label="模型参数">
          <ElInput :model-value="modelParamsSummary" disabled />
        </ElFormItem>

        <ElFormItem label="系统提示词">
          <template #label>
            <div class="workflow-ai-chat-node__form-label">
              <span>系统提示词</span>
              <div class="workflow-ai-chat-node__label-actions">
                <ElButton
                  :disabled="!resolvedModelId"
                  size="small"
                  text
                  type="primary"
                  @click="openGeneratePrompt"
                >
                  <ElIcon><MagicStick /></ElIcon>
                  AI 生成
                </ElButton>
                <ElButton
                  size="small"
                  text
                  type="primary"
                  @click="openTextMagnifyDialog('system', '系统提示词')"
                >
                  <ElIcon><EditPen /></ElIcon>
                </ElButton>
              </div>
            </div>
          </template>
          <ElInput
            :model-value="formData.system"
            type="textarea"
            :rows="3"
            placeholder="定义模型角色、回答边界和输出风格"
            @update:model-value="patchData('system', $event)"
          />
        </ElFormItem>

        <ElFormItem label="用户提示词" required>
          <template #label>
            <div class="workflow-ai-chat-node__form-label">
              <span>用户提示词</span>
              <ElButton
                size="small"
                text
                type="primary"
                @click="openTextMagnifyDialog('prompt', '用户提示词')"
              >
                <ElIcon><EditPen /></ElIcon>
              </ElButton>
            </div>
          </template>
          <ElInput
            :model-value="formData.prompt || defaultPrompt"
            type="textarea"
            :rows="5"
            placeholder="支持 {{节点.字段}} 引用，例如 {{start-node.question}}"
            @update:model-value="patchData('prompt', $event)"
          />
        </ElFormItem>
      </section>

      <section class="workflow-ai-chat-node__panel">
        <ElFormItem>
          <template #label>
            <div class="workflow-ai-chat-node__form-label">
              <span>历史记录</span>
              <ElSelect
                :model-value="formData.dialogue_type || 'WORKFLOW'"
                :teleported="false"
                size="small"
                @update:model-value="patchData('dialogue_type', $event)"
              >
                <ElOption label="当前节点" value="NODE" />
                <ElOption label="工作流" value="WORKFLOW" />
              </ElSelect>
            </div>
          </template>
          <ElInputNumber
            :model-value="formData.dialogue_number ?? 1"
            :min="0"
            :step="1"
            :step-strictly="true"
            :value-on-clear="0"
            controls-position="right"
            class="w-full"
            @update:model-value="patchData('dialogue_number', $event ?? 0)"
          />
        </ElFormItem>
        <ElFormItem v-if="hasNodeDataField('image_list')">
          <template #label>
            <div class="workflow-ai-chat-node__label-with-tip">
              <span>图片</span>
              <ElTooltip
                content="请选择上游节点输出的图片文件变量。"
                placement="right"
              >
                <span class="workflow-ai-chat-node__tip">!</span>
              </ElTooltip>
            </div>
          </template>
          <NodeCascader
            :node-model="nodeModel"
            :model-value="formData.image_list || []"
            class="w-full"
            placeholder="请选择图片变量"
            @update:model-value="patchData('image_list', $event)"
          />
        </ElFormItem>
        <ElFormItem v-if="hasNodeDataField('video_list')">
          <template #label>
            <div class="workflow-ai-chat-node__label-with-tip">
              <span>视频</span>
              <ElTooltip
                content="请选择上游节点输出的视频文件变量。"
                placement="right"
              >
                <span class="workflow-ai-chat-node__tip">!</span>
              </ElTooltip>
            </div>
          </template>
          <NodeCascader
            :node-model="nodeModel"
            :model-value="formData.video_list || []"
            class="w-full"
            placeholder="请选择视频变量"
            @update:model-value="patchData('video_list', $event)"
          />
        </ElFormItem>
      </section>

      <section class="workflow-ai-chat-node__panel">
        <div class="workflow-ai-chat-node__section-head">
          <strong>技能</strong>
          <ElCheckbox
            :model-value="formData.mcp_output_enable !== false"
            @update:model-value="patchData('mcp_output_enable', $event)"
          >
            输出执行过程
          </ElCheckbox>
        </div>

        <div class="workflow-ai-chat-node__resource-group">
          <button
            class="workflow-ai-chat-node__resource-head"
            type="button"
            @click="set(collapseData, 'mcp', !collapseData.mcp)"
          >
            <span>
              <ElIcon
                class="workflow-ai-chat-node__caret"
                :class="{ 'is-open': collapseData.mcp }"
              >
                <CaretRight />
              </ElIcon>
              MCP
              <small
                v-if="
                  selectedCount(formData.mcp_tool_ids, mcpToolOptions) ||
                  formData.mcp_servers
                "
              >
                ({{
                  selectedCount(formData.mcp_tool_ids, mcpToolOptions) +
                  (formData.mcp_servers ? 1 : 0)
                }})
              </small>
            </span>
          </button>
          <ElButton
            size="small"
            text
            type="primary"
            @click="openMcpServersDialog"
          >
            <ElIcon><Plus /></ElIcon>
          </ElButton>
        </div>
        <div
          v-if="collapseData.mcp"
          class="workflow-ai-chat-node__selected-list"
        >
          <div
            v-for="item in selectedResources(
              formData.mcp_tool_ids,
              mcpToolOptions,
              'MCP',
            )"
            :key="`${item.id}`"
            class="workflow-ai-chat-node__selected-row"
          >
            <ElAvatar
              v-if="item.icon"
              :size="20"
              shape="square"
              :src="item.icon"
            />
            <span v-else class="workflow-ai-chat-node__type-mark">{{
              item.type
            }}</span>
            <span
              class="workflow-ai-chat-node__selected-name"
              :title="item.name"
            >
              {{ item.name }}
            </span>
            <ElButton
              text
              type="danger"
              @click="removeId('mcp_tool_ids', item.id)"
            >
              <ElIcon><Close /></ElIcon>
            </ElButton>
          </div>
          <div
            v-if="formData.mcp_servers"
            class="workflow-ai-chat-node__selected-row"
          >
            <span class="workflow-ai-chat-node__type-mark">MCP</span>
            <span class="workflow-ai-chat-node__selected-name">自定义 MCP</span>
            <ElButton text type="danger" @click="clearCustomMcpServers">
              <ElIcon><Close /></ElIcon>
            </ElButton>
          </div>
        </div>

        <div class="workflow-ai-chat-node__resource-group">
          <button
            class="workflow-ai-chat-node__resource-head"
            type="button"
            @click="set(collapseData, 'tool', !collapseData.tool)"
          >
            <span>
              <ElIcon
                class="workflow-ai-chat-node__caret"
                :class="{ 'is-open': collapseData.tool }"
              >
                <CaretRight />
              </ElIcon>
              工具
              <small v-if="selectedCount(formData.tool_ids, toolOptions)">
                ({{ selectedCount(formData.tool_ids, toolOptions) }})
              </small>
            </span>
          </button>
          <ElButton
            size="small"
            text
            type="primary"
            @click="openResourceDialog('tool')"
          >
            <ElIcon><Plus /></ElIcon>
          </ElButton>
        </div>
        <div
          v-if="collapseData.tool"
          class="workflow-ai-chat-node__selected-list"
        >
          <div
            v-for="item in selectedResources(
              formData.tool_ids,
              toolOptions,
              'TOOL',
            )"
            :key="`${item.id}`"
            class="workflow-ai-chat-node__selected-row"
          >
            <ElAvatar
              v-if="item.icon"
              :size="20"
              shape="square"
              :src="item.icon"
            />
            <span v-else class="workflow-ai-chat-node__type-mark">{{
              item.type
            }}</span>
            <span
              class="workflow-ai-chat-node__selected-name"
              :title="item.name"
            >
              {{ item.name }}
            </span>
            <ElButton text type="danger" @click="removeId('tool_ids', item.id)">
              <ElIcon><Close /></ElIcon>
            </ElButton>
          </div>
        </div>

        <div class="workflow-ai-chat-node__resource-group">
          <button
            class="workflow-ai-chat-node__resource-head"
            type="button"
            @click="set(collapseData, 'skill', !collapseData.skill)"
          >
            <span>
              <ElIcon
                class="workflow-ai-chat-node__caret"
                :class="{ 'is-open': collapseData.skill }"
              >
                <CaretRight />
              </ElIcon>
              Skills
              <small
                v-if="selectedCount(formData.skill_tool_ids, skillToolOptions)"
              >
                ({{ selectedCount(formData.skill_tool_ids, skillToolOptions) }})
              </small>
            </span>
          </button>
          <ElButton
            size="small"
            text
            type="primary"
            @click="openResourceDialog('skill')"
          >
            <ElIcon><Plus /></ElIcon>
          </ElButton>
        </div>
        <div
          v-if="collapseData.skill"
          class="workflow-ai-chat-node__selected-list"
        >
          <div
            v-for="item in selectedResources(
              formData.skill_tool_ids,
              skillToolOptions,
              'SKILL',
            )"
            :key="`${item.id}`"
            class="workflow-ai-chat-node__selected-row"
          >
            <ElAvatar
              v-if="item.icon"
              :size="20"
              shape="square"
              :src="item.icon"
            />
            <span v-else class="workflow-ai-chat-node__type-mark">{{
              item.type
            }}</span>
            <span
              class="workflow-ai-chat-node__selected-name"
              :title="item.name"
            >
              {{ item.name }}
            </span>
            <ElButton
              text
              type="danger"
              @click="removeId('skill_tool_ids', item.id)"
            >
              <ElIcon><Close /></ElIcon>
            </ElButton>
          </div>
        </div>

        <div class="workflow-ai-chat-node__resource-group">
          <button
            class="workflow-ai-chat-node__resource-head"
            type="button"
            @click="set(collapseData, 'application', !collapseData.application)"
          >
            <span>
              <ElIcon
                class="workflow-ai-chat-node__caret"
                :class="{ 'is-open': collapseData.application }"
              >
                <CaretRight />
              </ElIcon>
              应用
              <small v-if="selectedCount(formData.application_ids)">
                ({{ selectedCount(formData.application_ids) }})
              </small>
            </span>
          </button>
          <ElButton
            size="small"
            text
            type="primary"
            @click="openResourceDialog('application')"
          >
            <ElIcon><Plus /></ElIcon>
          </ElButton>
        </div>
        <div
          v-if="collapseData.application"
          class="workflow-ai-chat-node__selected-list"
        >
          <div
            v-for="item in selectedResources(
              formData.application_ids,
              applications,
              'APP',
            )"
            :key="`${item.id}`"
            class="workflow-ai-chat-node__selected-row"
          >
            <ElAvatar
              v-if="item.icon"
              :size="20"
              shape="square"
              :src="item.icon"
            />
            <span v-else class="workflow-ai-chat-node__type-mark">{{
              item.type
            }}</span>
            <span
              class="workflow-ai-chat-node__selected-name"
              :title="item.name"
            >
              {{ item.name }}
            </span>
            <ElButton
              text
              type="danger"
              @click="removeId('application_ids', item.id)"
            >
              <ElIcon><Close /></ElIcon>
            </ElButton>
          </div>
        </div>
      </section>

      <section class="workflow-ai-chat-node__panel">
        <div class="workflow-ai-chat-node__switch-row">
          <div>
            <strong>输出思考</strong>
            <small>开启后按标记提取模型思考过程</small>
          </div>
          <div class="workflow-ai-chat-node__switch-actions">
            <ElTooltip
              v-if="formData.model_setting?.reasoning_content_enable"
              content="设置输出思考开始和结束标记"
              placement="top"
            >
              <ElButton
                size="small"
                text
                type="primary"
                @click="openReasoningParamSettingDialog"
              >
                <ElIcon><Operation /></ElIcon>
              </ElButton>
            </ElTooltip>
            <ElSwitch
              :model-value="!!formData.model_setting?.reasoning_content_enable"
              size="small"
              @update:model-value="
                patchReasoning('reasoning_content_enable', $event)
              "
            />
          </div>
        </div>
        <div class="workflow-ai-chat-node__switch-row">
          <div>
            <strong>返回内容</strong>
            <small>将本节点回复作为工作流输出内容</small>
          </div>
          <ElSwitch
            :model-value="formData.is_result !== false"
            size="small"
            @update:model-value="patchData('is_result', $event)"
          />
        </div>
      </section>
    </ElForm>

    <ModelParamSettingDialog
      v-model="modelParamOpen"
      :model-id="resolvedModelId"
      :setting="modelParamSetting"
      @refresh="refreshModelParams"
    />
    <GeneratePromptDialog
      v-model="generatePromptOpen"
      :model-id="resolvedModelId"
      @replace="applyGeneratedPrompt"
    />
    <TextMagnifyDialog
      ref="textMagnifyDialogRef"
      @refresh="submitTextMagnifyDialog"
    />
    <McpServersDialog
      ref="mcpServersDialogRef"
      :records="mcpToolOptions"
      @refresh="submitMcpServersDialog"
    />
    <ResourceSelectDialog
      ref="resourceSelectDialogRef"
      :model-value="arrayValue(formData[resourceIdsKey(resourceDialogKind)])"
      :records="resourceOptions(resourceDialogKind)"
      :title="resourceTitle(resourceDialogKind)"
      @refresh="submitResourceDialog"
    />
    <ReasoningParamSettingDialog
      ref="reasoningParamDialogRef"
      @refresh="submitReasoningDialog"
    />
  </NodeContainer>
</template>

<style scoped lang="scss">
.workflow-ai-chat-node {
  --ai-node-space-2xs: 2px;
  --ai-node-space-xs: 4px;
  --ai-node-space-sm: 6px;
  --ai-node-space-md: 8px;
  --ai-node-radius: 6px;

  display: grid;
  gap: var(--ai-node-space-sm);
}

.workflow-ai-chat-node__panel,
.workflow-ai-chat-node__selected-list {
  display: grid;
  gap: var(--ai-node-space-sm);
}

.workflow-ai-chat-node__panel {
  padding: var(--ai-node-space-sm) var(--ai-node-space-md);
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--ai-node-radius);
}

.workflow-ai-chat-node :deep(.el-form-item) {
  margin-bottom: var(--ai-node-space-sm);
}

.workflow-ai-chat-node :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.workflow-ai-chat-node :deep(.el-form-item__label) {
  margin-bottom: var(--ai-node-space-2xs);
  font-size: var(--el-font-size-extra-small);
  line-height: 16px;
}

.workflow-ai-chat-node :deep(.el-input__wrapper) {
  min-height: 28px;
}

.workflow-ai-chat-node :deep(.el-textarea__inner) {
  min-height: 0 !important;
  padding-block: var(--ai-node-space-xs);
  line-height: 18px;
}

.workflow-ai-chat-node__form-label,
.workflow-ai-chat-node__section-head,
.workflow-ai-chat-node__switch-row,
.workflow-ai-chat-node__resource-group,
.workflow-ai-chat-node__resource-head,
.workflow-ai-chat-node__selected-row,
.workflow-ai-chat-node__switch-actions {
  display: flex;
  gap: var(--ai-node-space-sm);
  align-items: center;
  min-width: 0;
}

.workflow-ai-chat-node__form-label,
.workflow-ai-chat-node__section-head,
.workflow-ai-chat-node__switch-row,
.workflow-ai-chat-node__resource-group {
  justify-content: space-between;
}

.workflow-ai-chat-node__form-label {
  width: 100%;
}

.workflow-ai-chat-node__form-label .el-select {
  width: 92px;
}

.workflow-ai-chat-node__label-actions {
  display: inline-flex;
  gap: var(--ai-node-space-xs);
  align-items: center;
}

.workflow-ai-chat-node__label-with-tip {
  display: flex;
  gap: var(--ai-node-space-xs);
  align-items: center;
}

.workflow-ai-chat-node__tip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  font-size: 10px;
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 50%;
}

.workflow-ai-chat-node__model-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--ai-node-space-sm);
  align-items: center;
  width: 100%;
}

.workflow-ai-chat-node__grid {
  display: grid;
  gap: var(--ai-node-space-sm);
  min-width: 0;
}

.workflow-ai-chat-node__grid.is-two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.workflow-ai-chat-node__section-head,
.workflow-ai-chat-node__switch-row strong,
.workflow-ai-chat-node__resource-head {
  font-size: var(--el-font-size-extra-small);
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.workflow-ai-chat-node__switch-row strong,
.workflow-ai-chat-node__switch-row small {
  display: block;
}

.workflow-ai-chat-node__switch-row small {
  margin-top: var(--ai-node-space-2xs);
  font-size: 11px;
  font-weight: 400;
  line-height: 14px;
  color: var(--el-text-color-placeholder);
}

.workflow-ai-chat-node__resource-head {
  flex: 1;
  padding: 0;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.workflow-ai-chat-node__resource-head span {
  display: inline-flex;
  gap: var(--ai-node-space-xs);
  align-items: center;
}

.workflow-ai-chat-node__resource-head small {
  color: var(--el-text-color-placeholder);
}

.workflow-ai-chat-node__caret {
  transition: transform var(--el-transition-duration-fast);
}

.workflow-ai-chat-node__caret.is-open {
  transform: rotate(90deg);
}

.workflow-ai-chat-node__selected-row {
  padding: var(--ai-node-space-xs) var(--ai-node-space-md);
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--ai-node-radius);
}

.workflow-ai-chat-node__type-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 20px;
  padding: 0 var(--ai-node-space-xs);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: var(--ai-node-radius);
}

.workflow-ai-chat-node__selected-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.workflow-ai-chat-node__model-row > *,
.workflow-ai-chat-node__grid > * {
  min-width: 0;
}
</style>
