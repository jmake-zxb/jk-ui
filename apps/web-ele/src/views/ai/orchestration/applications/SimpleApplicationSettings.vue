<script setup lang="ts">
import type { SimpleApplicationSettings } from './simple-application-settings';

import { computed, onMounted, reactive, ref, watch } from 'vue';

import {
  CaretRight,
  Close,
  MagicStick,
  Plus,
  Setting,
  VideoPlay,
} from '@element-plus/icons-vue';
import {
  ElButton,
  ElCheckbox,
  ElDialog,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElRadio,
  ElRadioGroup,
  ElSelect,
  ElSlider,
  ElSwitch,
} from 'element-plus';
import { cloneDeep, set } from 'lodash-es';

import { listApplications, playDemoText } from '#/api/ai/applications';
import { listKnowledge } from '#/api/ai/knowledge';
import { listTools } from '#/api/ai/tools';

import { recordsOf } from '../utils';
import LocalModelSelect from '../workflow/designer/nodes/base-node/component/LocalModelSelect.vue';
import GeneratePromptDialog from './GeneratePromptDialog.vue';
import ModelParamSettingDialog from './ModelParamSettingDialog.vue';
import { normalizeSettings } from './simple-application-settings';

type Id = number | string;
type ResourceRecord = Record<string, unknown>;
type ResourceGroupKey = 'agent' | 'mcp' | 'skill' | 'tool';

const props = defineProps<{
  applicationId?: number | string;
  modelValue: SimpleApplicationSettings;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: SimpleApplicationSettings];
}>();

const formData = ref<SimpleApplicationSettings>(
  normalizeSettings(props.modelValue),
);
const resourceLoading = ref(false);
const knowledgeRecords = ref<ResourceRecord[]>([]);
const toolRecords = ref<ResourceRecord[]>([]);
const applicationRecords = ref<ResourceRecord[]>([]);
const collapseData = reactive<Record<ResourceGroupKey, boolean>>({
  agent: true,
  mcp: true,
  skill: true,
  tool: true,
});
const knowledgeCollapse = reactive({
  list: true,
  prompt: true,
});
const knowledgePickerOpen = ref(false);
const knowledgeDraft = ref<Id[]>([]);
const knowledgeSettingOpen = ref(false);
const resourcePickerOpen = ref(false);
const selectedResourceGroup = ref<ResourceGroupKey>('tool');
const resourceDraft = ref<Id[]>([]);
const generatePromptOpen = ref(false);

function openGeneratePrompt() {
  if (!formData.value.model_id) {
    ElMessage.warning('请先选择 AI 模型');
    return;
  }
  generatePromptOpen.value = true;
}

function applyGeneratedPrompt(prompt: string) {
  patch('model_setting.system', prompt);
}

const modelParamOpen = ref(false);

function openModelParamSetting() {
  if (!formData.value.model_id) {
    ElMessage.warning('请先选择 AI 模型');
    return;
  }
  modelParamOpen.value = true;
}

function applyModelParams(value: Record<string, unknown>) {
  patch('model_params_setting', value);
}

const mcpToolOptions = computed(() =>
  toolRecords.value.filter((record) => resourceType(record) === 'MCP'),
);
const skillToolOptions = computed(() =>
  toolRecords.value.filter((record) => resourceType(record) === 'SKILL'),
);
const commonToolOptions = computed(() =>
  toolRecords.value.filter((record) => {
    const type = resourceType(record);
    return type !== 'MCP' && type !== 'SKILL';
  }),
);

watch(
  () => props.modelValue,
  (value) => {
    formData.value = normalizeSettings(value);
  },
  { deep: true },
);

function emitSettings(next: SimpleApplicationSettings) {
  const normalized = normalizeSettings(next);
  formData.value = normalized;
  emit('update:modelValue', cloneDeep(normalized));
}

function patch(path: string, value: unknown) {
  const next = cloneDeep(formData.value);
  set(next, path, cloneDeep(value));
  if (path === 'stt_model_enable' && value !== true) {
    set(next, 'stt_autosend', false);
    set(next, 'stt_model_id', '');
  }
  if (path === 'tts_model_enable' && value !== true) {
    set(next, 'tts_autoplay', false);
    set(next, 'tts_model_id', '');
    set(next, 'tts_type', 'BROWSER');
  }
  emitSettings(next);
}

function patchIdList(path: string, value: unknown) {
  patch(path, toIdList(value));
}

function patchKnowledge(value: unknown) {
  const ids = toIdList(value);
  const selected = knowledgeRecords.value.filter((record) =>
    ids.some((id) => `${id}` === `${resourceId(record)}`),
  );
  const next = cloneDeep(formData.value);
  set(next, 'knowledge_id_list', ids);
  set(next, 'knowledge_list', selected);
  emitSettings(next);
}

function selectedKnowledgeRecords() {
  return formData.value.knowledge_id_list.map((id) => {
    return (
      knowledgeRecords.value.find(
        (record) => `${resourceId(record)}` === `${id}`,
      ) || {
        id,
        name: `${id}`,
      }
    );
  });
}

function openKnowledgePicker() {
  knowledgeDraft.value = [...formData.value.knowledge_id_list];
  knowledgePickerOpen.value = true;
}

function confirmKnowledgePicker() {
  patchKnowledge(knowledgeDraft.value);
  knowledgeCollapse.list = true;
  knowledgePickerOpen.value = false;
}

function removeKnowledge(id: Id) {
  patchKnowledge(
    formData.value.knowledge_id_list.filter((item) => `${item}` !== `${id}`),
  );
}

function groupTitle(group: ResourceGroupKey) {
  return (
    {
      agent: '应用',
      mcp: 'MCP',
      skill: 'Skills',
      tool: '工具',
    } satisfies Record<ResourceGroupKey, string>
  )[group];
}

function groupPath(group: ResourceGroupKey) {
  return (
    {
      agent: 'application_ids',
      mcp: 'mcp_tool_ids',
      skill: 'skill_tool_ids',
      tool: 'tool_ids',
    } satisfies Record<ResourceGroupKey, string>
  )[group];
}

function groupIds(group: ResourceGroupKey) {
  const data = formData.value;
  return (
    {
      agent: data.application_ids,
      mcp: data.mcp_tool_ids,
      skill: data.skill_tool_ids,
      tool: data.tool_ids,
    } satisfies Record<ResourceGroupKey, Id[]>
  )[group];
}

function groupOptions(group: ResourceGroupKey) {
  return (
    {
      agent: applicationRecords.value,
      mcp: mcpToolOptions.value,
      skill: skillToolOptions.value,
      tool: commonToolOptions.value,
    } satisfies Record<ResourceGroupKey, ResourceRecord[]>
  )[group];
}

function selectedGroupRecords(group: ResourceGroupKey) {
  const options = groupOptions(group);
  return groupIds(group).map((id) => {
    return (
      options.find((record) => `${resourceId(record)}` === `${id}`) || {
        id,
        name: `${id}`,
      }
    );
  });
}

function openResourcePicker(group: ResourceGroupKey) {
  selectedResourceGroup.value = group;
  resourceDraft.value = [...groupIds(group)];
  resourcePickerOpen.value = true;
}

function confirmResourcePicker() {
  patchIdList(groupPath(selectedResourceGroup.value), resourceDraft.value);
  collapseData[selectedResourceGroup.value] = true;
  resourcePickerOpen.value = false;
}

function removeGroupItem(group: ResourceGroupKey, id: Id) {
  patchIdList(
    groupPath(group),
    groupIds(group).filter((item) => `${item}` !== `${id}`),
  );
}

function resourceId(record: ResourceRecord): Id {
  const value =
    record.id ??
    record.value ??
    record.knowledgeId ??
    record.knowledge_id ??
    record.toolId ??
    record.tool_id ??
    record.applicationId ??
    record.application_id;
  return typeof value === 'number' || typeof value === 'string'
    ? value
    : `${value || ''}`;
}

function resourceName(record: ResourceRecord) {
  return `${record.name || record.title || record.label || record.modelName || resourceId(record) || ''}`;
}

function resourceType(record: ResourceRecord) {
  return `${record.toolType || record.tool_type || record.type || record.category || ''}`.toUpperCase();
}

function toIdList(value: unknown): Id[] {
  return Array.isArray(value)
    ? value.flatMap((item) =>
        typeof item === 'number' || typeof item === 'string' ? [item] : [],
      )
    : [];
}

async function loadResources() {
  resourceLoading.value = true;
  try {
    const [knowledgeResponse, toolResponse, applicationResponse] =
      await Promise.all([listKnowledge(), listTools(), listApplications()]);
    knowledgeRecords.value = recordsOf<ResourceRecord>(knowledgeResponse);
    toolRecords.value = recordsOf<ResourceRecord>(toolResponse);
    applicationRecords.value = recordsOf<ResourceRecord>(
      applicationResponse,
    ).filter((record) => resourceId(record) !== '');
  } finally {
    resourceLoading.value = false;
  }
}

// --- TTS 试听 ---
const demoPlaying = ref(false);
let demoAudio: HTMLAudioElement | null = null;
let demoAudioUrl: null | string = null;

function stopDemoAudio() {
  if (demoAudio) {
    demoAudio.pause();
    demoAudio.src = '';
    demoAudio = null;
  }
  if (demoAudioUrl) {
    URL.revokeObjectURL(demoAudioUrl);
    demoAudioUrl = null;
  }
  demoPlaying.value = false;
}

async function playTtsDemo() {
  if (demoPlaying.value) {
    stopDemoAudio();
    return;
  }
  if (!formData.value.tts_model_enable || !formData.value.tts_model_id) {
    ElMessage.warning('请先启用并选择 TTS 模型');
    return;
  }
  const id = props.applicationId;
  if (id === undefined || id === null || id === '') {
    ElMessage.info('请先保存应用后再试听');
    return;
  }
  try {
    demoPlaying.value = true;
    const blob = await playDemoText(id);
    if (!(blob instanceof Blob) || blob.size === 0) {
      throw new Error('试听内容为空');
    }
    demoAudioUrl = URL.createObjectURL(blob);
    demoAudio = new Audio(demoAudioUrl);
    demoAudio.addEventListener('ended', stopDemoAudio);
    demoAudio.addEventListener('error', () => {
      ElMessage.error('试听播放失败');
      stopDemoAudio();
    });
    await demoAudio.play();
  } catch (error) {
    console.error('试听失败', error);
    ElMessage.error('试听失败');
    stopDemoAudio();
  }
}

onMounted(loadResources);
</script>

<template>
  <ElForm
    :model="formData"
    class="simple-agent-settings"
    label-position="top"
    v-loading="resourceLoading"
    @submit.prevent
  >
    <section class="simple-agent-settings__section">
      <div class="simple-agent-settings__section-title">基本信息</div>
      <ElFormItem label="名称" required>
        <ElInput
          :model-value="formData.name"
          maxlength="64"
          show-word-limit
          @blur="patch('name', `${formData.name || ''}`.trim())"
          @update:model-value="patch('name', $event)"
        />
      </ElFormItem>
      <ElFormItem label="描述">
        <ElInput
          :model-value="formData.desc"
          maxlength="256"
          show-word-limit
          type="textarea"
          :rows="3"
          @update:model-value="patch('desc', $event)"
        />
      </ElFormItem>
    </section>

    <section class="simple-agent-settings__section">
      <div class="simple-agent-settings__section-title">模型设置</div>
      <ElFormItem label="AI 模型" required>
        <div class="simple-agent-settings__model-row">
          <LocalModelSelect
            class="simple-agent-settings__model-select"
            :model-value="formData.model_id"
            model-type="LLM"
            placeholder="请选择 AI 模型"
            @update:model-value="patch('model_id', $event || '')"
          />
          <ElButton
            :disabled="!formData.model_id"
            :icon="Setting"
            @click="openModelParamSetting"
          >
            参数设置
          </ElButton>
        </div>
      </ElFormItem>
      <ElFormItem label="角色设定">
        <div class="simple-agent-settings__prompt-field">
          <div class="simple-agent-settings__prompt-toolbar">
            <ElButton
              link
              type="primary"
              :icon="MagicStick"
              :disabled="!formData.model_id"
              @click="openGeneratePrompt"
            >
              AI 生成
            </ElButton>
          </div>
          <ElInput
            :model-value="formData.model_setting.system"
            type="textarea"
            :rows="4"
            @update:model-value="patch('model_setting.system', $event)"
          />
        </div>
      </ElFormItem>
      <ElFormItem label="用户提示词（无引用知识库）">
        <ElInput
          :model-value="formData.model_setting.no_references_prompt"
          type="textarea"
          :rows="4"
          @update:model-value="
            patch('model_setting.no_references_prompt', $event)
          "
        />
      </ElFormItem>
      <ElFormItem label="历史聊天记录">
        <ElInputNumber
          :model-value="formData.dialogue_number"
          :min="0"
          :step="1"
          :step-strictly="true"
          :value-on-clear="0"
          class="w-full"
          controls-position="right"
          @update:model-value="patch('dialogue_number', $event ?? 0)"
        />
      </ElFormItem>
      <ElFormItem label="长期记忆">
        <div class="setting-control-row">
          <ElSwitch
            :model-value="formData.long_term_enable"
            size="small"
            @update:model-value="patch('long_term_enable', $event)"
          />
        </div>
        <LocalModelSelect
          v-if="formData.long_term_enable"
          class="setting-follow-control"
          :model-value="formData.long_term_model_id"
          model-type="LLM"
          placeholder="请选择长期记忆模型"
          @update:model-value="patch('long_term_model_id', $event || '')"
        />
      </ElFormItem>
    </section>

    <section class="simple-agent-settings__section">
      <div class="simple-agent-settings__section-title">知识库</div>
      <div class="resource-card">
        <ElFormItem>
          <template #label>
            <div
              class="collapse-label"
              @click="knowledgeCollapse.prompt = !knowledgeCollapse.prompt"
            >
              <ElIcon
                class="resource-group__arrow"
                :class="{ 'is-open': knowledgeCollapse.prompt }"
              >
                <CaretRight />
              </ElIcon>
              <span>用户提示词（引用知识库）</span>
            </div>
          </template>
          <ElInput
            v-if="knowledgeCollapse.prompt"
            :model-value="formData.model_setting.prompt"
            type="textarea"
            :rows="4"
            @update:model-value="patch('model_setting.prompt', $event)"
          />
        </ElFormItem>
        <div class="resource-group">
          <div
            class="resource-group__head"
            @click="knowledgeCollapse.list = !knowledgeCollapse.list"
          >
            <div class="resource-group__title">
              <ElIcon
                class="resource-group__arrow"
                :class="{ 'is-open': knowledgeCollapse.list }"
              >
                <CaretRight />
              </ElIcon>
              <span>关联知识库</span>
              <span v-if="formData.knowledge_id_list.length > 0">
                ({{ formData.knowledge_id_list.length }})
              </span>
            </div>
            <div class="resource-group__actions">
              <ElButton
                :icon="Setting"
                link
                type="primary"
                @click.stop="knowledgeSettingOpen = true"
              />
              <ElButton
                :icon="Plus"
                link
                type="primary"
                @click.stop="openKnowledgePicker"
              />
            </div>
          </div>
          <div v-if="knowledgeCollapse.list" class="resource-list">
            <div
              v-for="record in selectedKnowledgeRecords()"
              :key="resourceId(record)"
              class="resource-item"
            >
              <div class="resource-item__icon">知</div>
              <span :title="resourceName(record)">{{
                resourceName(record)
              }}</span>
              <ElButton
                :icon="Close"
                text
                @click="removeKnowledge(resourceId(record))"
              />
            </div>
            <span
              v-if="selectedKnowledgeRecords().length === 0"
              class="resource-placeholder"
            >
              请选择关联知识库
            </span>
          </div>
        </div>
      </div>
    </section>

    <section class="simple-agent-settings__section">
      <div class="simple-agent-settings__section-head">
        <div class="simple-agent-settings__section-title">技能</div>
        <ElCheckbox
          :model-value="formData.mcp_output_enable"
          @update:model-value="patch('mcp_output_enable', $event)"
        >
          输出执行过程
        </ElCheckbox>
      </div>
      <div class="resource-card">
        <div
          v-for="group in [
            'mcp',
            'tool',
            'skill',
            'agent',
          ] as ResourceGroupKey[]"
          :key="group"
          class="resource-group"
        >
          <div
            class="resource-group__head"
            @click="collapseData[group] = !collapseData[group]"
          >
            <div class="resource-group__title">
              <ElIcon
                class="resource-group__arrow"
                :class="{ 'is-open': collapseData[group] }"
              >
                <CaretRight />
              </ElIcon>
              <span>{{ groupTitle(group) }}</span>
              <span v-if="groupIds(group).length > 0">
                ({{ groupIds(group).length }})
              </span>
            </div>
            <ElButton
              :icon="Plus"
              link
              type="primary"
              @click.stop="openResourcePicker(group)"
            />
          </div>
          <div
            v-if="collapseData[group] && selectedGroupRecords(group).length > 0"
            class="resource-list"
          >
            <div
              v-for="record in selectedGroupRecords(group)"
              :key="resourceId(record)"
              class="resource-item"
            >
              <div class="resource-item__icon">
                {{ groupTitle(group).slice(0, 1) }}
              </div>
              <span :title="resourceName(record)">{{
                resourceName(record)
              }}</span>
              <ElButton
                :icon="Close"
                text
                @click="removeGroupItem(group, resourceId(record))"
              />
            </div>
          </div>
          <div
            v-if="
              group === 'mcp' && collapseData[group] && formData.mcp_servers
            "
            class="resource-list"
          >
            <div class="resource-item">
              <div class="resource-item__icon">M</div>
              <span>自定义 MCP</span>
              <ElButton :icon="Close" text @click="patch('mcp_servers', '')" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="simple-agent-settings__section">
      <div class="simple-agent-settings__section-title">对话体验</div>
      <ElFormItem label="开场白">
        <ElInput
          :model-value="formData.prologue"
          type="textarea"
          :rows="4"
          @update:model-value="patch('prologue', $event)"
        />
      </ElFormItem>
      <ElFormItem label="输出思考">
        <div class="setting-control-row">
          <ElButton :icon="Setting" link type="primary" />
          <ElSwitch
            :model-value="formData.model_setting.reasoning_content_enable"
            size="small"
            @update:model-value="
              patch('model_setting.reasoning_content_enable', $event)
            "
          />
        </div>
      </ElFormItem>
      <ElFormItem label="语音输入">
        <div class="setting-control-row">
          <ElCheckbox
            v-if="formData.stt_model_enable"
            :model-value="formData.stt_autosend"
            @update:model-value="patch('stt_autosend', $event)"
          >
            自动发送
          </ElCheckbox>
          <ElSwitch
            :model-value="formData.stt_model_enable"
            size="small"
            @update:model-value="patch('stt_model_enable', $event)"
          />
        </div>
        <LocalModelSelect
          v-if="formData.stt_model_enable"
          class="setting-follow-control"
          :model-value="formData.stt_model_id"
          model-type="STT"
          placeholder="请选择语音输入模型"
          @update:model-value="patch('stt_model_id', $event || '')"
        />
      </ElFormItem>
      <ElFormItem label="语音播放">
        <div class="setting-control-row">
          <ElCheckbox
            v-if="formData.tts_model_enable"
            :model-value="formData.tts_autoplay"
            @update:model-value="patch('tts_autoplay', $event)"
          >
            自动播放
          </ElCheckbox>
          <ElSwitch
            :model-value="formData.tts_model_enable"
            size="small"
            @update:model-value="patch('tts_model_enable', $event)"
          />
        </div>
        <div v-if="formData.tts_model_enable" class="voice-play-panel">
          <ElRadioGroup
            :model-value="formData.tts_type"
            @update:model-value="patch('tts_type', $event)"
          >
            <ElRadio value="BROWSER">浏览器播放</ElRadio>
            <ElRadio value="TTS">TTS 模型</ElRadio>
          </ElRadioGroup>
          <LocalModelSelect
            v-if="formData.tts_type === 'TTS'"
            :model-value="formData.tts_model_id"
            model-type="TTS"
            placeholder="请选择语音播放模型"
            @update:model-value="patch('tts_model_id', $event || '')"
          />
          <div v-if="formData.tts_type === 'TTS'" class="voice-play-actions">
            <ElButton
              :icon="VideoPlay"
              :disabled="!formData.tts_model_id"
              :loading="demoPlaying"
              size="small"
              type="primary"
              @click="playTtsDemo"
            >
              试听
            </ElButton>
          </div>
        </div>
      </ElFormItem>
    </section>
  </ElForm>

  <ElDialog
    v-model="knowledgeSettingOpen"
    title="知识库设置"
    width="520px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
  >
    <ElForm :model="formData.knowledge_setting" label-position="top">
      <ElFormItem label="检索模式">
        <ElSelect
          :model-value="formData.knowledge_setting.search_mode"
          @update:model-value="patch('knowledge_setting.search_mode', $event)"
        >
          <ElOption label="向量检索" value="embedding" />
          <ElOption label="全文检索" value="keywords" />
          <ElOption label="混合检索" value="blend" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="Top N">
        <ElInputNumber
          :model-value="formData.knowledge_setting.top_n"
          :min="1"
          :step="1"
          :step-strictly="true"
          :value-on-clear="1"
          class="w-full"
          controls-position="right"
          @update:model-value="patch('knowledge_setting.top_n', $event || 1)"
        />
      </ElFormItem>
      <ElFormItem label="最大字符">
        <ElInputNumber
          :model-value="formData.knowledge_setting.max_paragraph_char_number"
          :min="1"
          :step="500"
          :step-strictly="true"
          class="w-full"
          controls-position="right"
          @update:model-value="
            patch('knowledge_setting.max_paragraph_char_number', $event || 1)
          "
        />
      </ElFormItem>
      <ElFormItem label="相似度">
        <ElSlider
          :model-value="formData.knowledge_setting.similarity"
          :max="1"
          :min="0"
          :step="0.01"
          show-input
          @update:model-value="patch('knowledge_setting.similarity', $event)"
        />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="knowledgeSettingOpen = false">取消</ElButton>
      <ElButton type="primary" @click="knowledgeSettingOpen = false">
        保存
      </ElButton>
    </template>
  </ElDialog>

  <ElDialog
    v-model="knowledgePickerOpen"
    title="添加知识库"
    width="520px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
  >
    <ElSelect
      v-model="knowledgeDraft"
      class="resource-picker"
      clearable
      collapse-tags
      filterable
      multiple
      placeholder="选择知识库"
    >
      <ElOption
        v-for="record in knowledgeRecords"
        :key="resourceId(record)"
        :label="resourceName(record)"
        :value="resourceId(record)"
      />
    </ElSelect>
    <template #footer>
      <ElButton @click="knowledgePickerOpen = false">取消</ElButton>
      <ElButton type="primary" @click="confirmKnowledgePicker">确定</ElButton>
    </template>
  </ElDialog>

  <ElDialog
    v-model="resourcePickerOpen"
    :title="`添加${groupTitle(selectedResourceGroup)}`"
    width="520px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
  >
    <ElSelect
      v-model="resourceDraft"
      class="resource-picker"
      clearable
      collapse-tags
      filterable
      multiple
      :placeholder="`选择${groupTitle(selectedResourceGroup)}`"
    >
      <ElOption
        v-for="record in groupOptions(selectedResourceGroup)"
        :key="resourceId(record)"
        :label="resourceName(record)"
        :value="resourceId(record)"
      />
    </ElSelect>
    <ElFormItem
      v-if="selectedResourceGroup === 'mcp'"
      class="resource-mcp-servers"
      label="自定义 MCP Servers"
    >
      <ElInput
        :model-value="formData.mcp_servers"
        :rows="5"
        type="textarea"
        @update:model-value="patch('mcp_servers', $event)"
      />
    </ElFormItem>
    <template #footer>
      <ElButton @click="resourcePickerOpen = false">取消</ElButton>
      <ElButton type="primary" @click="confirmResourcePicker">确定</ElButton>
    </template>
  </ElDialog>

  <GeneratePromptDialog
    v-model="generatePromptOpen"
    :application-id="props.applicationId"
    :model-id="formData.model_id"
    @replace="applyGeneratedPrompt"
  />

  <ModelParamSettingDialog
    v-model="modelParamOpen"
    :model-id="formData.model_id"
    :setting="formData.model_params_setting"
    @refresh="applyModelParams"
  />
</template>

<style scoped lang="scss">
.simple-agent-settings {
  --simple-agent-control-height: 32px;

  display: grid;
  gap: 14px;
  align-items: start;
}

.simple-agent-settings__section {
  display: grid;
  gap: 12px;
  padding: 14px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
}

.simple-agent-settings__section-head {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.simple-agent-settings__model-row {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
}

.simple-agent-settings__model-select {
  flex: 1 1 auto;
  min-width: 0;
}

.simple-agent-settings__prompt-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.simple-agent-settings__prompt-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.simple-agent-settings__section-title {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  font-size: var(--el-font-size-base);
  font-weight: var(--el-font-weight-primary);
  color: var(--el-text-color-primary);
}

.simple-agent-settings__section-title::before {
  width: 3px;
  height: 14px;
  content: '';
  background: var(--el-color-primary);
  border-radius: 999px;
}

.simple-agent-settings :deep(.el-form-item) {
  margin-bottom: 0;
}

.simple-agent-settings :deep(.el-form-item__label) {
  padding-bottom: 6px;
  font-weight: 500;
  color: var(--el-text-color-regular);
}

.simple-agent-settings :deep(.el-input),
.simple-agent-settings :deep(.el-select),
.simple-agent-settings :deep(.el-input-number),
.simple-agent-settings :deep(.el-slider) {
  width: 100%;
}

.simple-agent-settings :deep(.el-input__wrapper),
.simple-agent-settings :deep(.el-select__wrapper) {
  min-height: var(--simple-agent-control-height);
  box-shadow: 0 0 0 1px var(--el-border-color-lighter) inset;
}

.simple-agent-settings :deep(.el-textarea__inner) {
  min-height: 96px;
  resize: vertical;
  box-shadow: 0 0 0 1px var(--el-border-color-lighter) inset;
}

.simple-agent-settings :deep(.el-input-number .el-input__wrapper) {
  min-height: var(--simple-agent-control-height);
}

.resource-card {
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.resource-group + .resource-group {
  margin-top: 8px;
}

.resource-group__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.resource-group__title {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  min-width: 0;
}

.resource-group__actions {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.collapse-label {
  display: flex;
  align-items: center;
  width: 100%;
  cursor: pointer;
}

.setting-control-row {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  min-height: var(--simple-agent-control-height);
}

.setting-follow-control {
  margin-top: 8px;
}

.voice-play-panel {
  display: grid;
  gap: 8px;
  width: 100%;
}

.resource-group__arrow {
  margin-right: 4px;
  transition: transform 0.16s ease;
}

.resource-group__arrow.is-open {
  transform: rotate(90deg);
}

.resource-list {
  display: grid;
  gap: 4px;
  margin-bottom: 12px;
}

.resource-item {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
  min-height: 32px;
  padding: 5px 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.resource-item__icon {
  display: inline-flex;
  flex: 0 0 20px;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 12px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 4px;
}

.resource-item span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-placeholder {
  display: block;
  min-height: 24px;
  color: var(--el-text-color-secondary);
}

.resource-picker {
  width: 100%;
}

.resource-mcp-servers {
  margin-top: 16px;
}

@media (max-width: 720px) {
  .simple-agent-settings :deep(.el-col) {
    flex: 0 0 100%;
    max-width: 100%;
  }
}
</style>
