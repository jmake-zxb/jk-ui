import { cloneDeep, set } from 'lodash-es';

import { isWorkflowApplication } from './application-entry';

type Id = number | string;
type JsonRecord = Record<string, unknown>;

export type SimpleApplicationSectionId =
  | 'basic'
  | 'conversation'
  | 'knowledge'
  | 'model'
  | 'skills'
  | 'voice';

export interface SimpleApplicationSection {
  id: SimpleApplicationSectionId;
  title: string;
}

export interface SimpleApplicationLike extends JsonRecord {
  description?: string;
  desc?: string;
  id?: Id;
  name?: string;
  title?: string;
  type?: string;
}

export interface SimpleApplicationModelSetting extends JsonRecord {
  no_references_prompt: string;
  prompt: string;
  reasoning_content_enable: boolean;
  reasoning_content_end: string;
  reasoning_content_start: string;
  system: string;
}

export interface SimpleApplicationKnowledgeSetting extends JsonRecord {
  max_paragraph_char_number: number;
  no_references_setting: {
    status: string;
    value: string;
  };
  search_mode: 'blend' | 'embedding' | 'keywords';
  similarity: number;
  top_n: number;
}

export interface SimpleApplicationSettings extends JsonRecord {
  application_enable: boolean;
  application_ids: Id[];
  desc: string;
  dialogue_number: number;
  knowledge_id_list: Id[];
  knowledge_list: JsonRecord[];
  knowledge_setting: SimpleApplicationKnowledgeSetting;
  long_term_enable: boolean;
  long_term_model_id: '' | Id;
  long_term_model_params_setting: JsonRecord;
  long_term_trigger_setting: JsonRecord;
  long_term_trigger_type: string;
  mcp_enable: boolean;
  mcp_output_enable: boolean;
  mcp_servers: string;
  mcp_source: string;
  mcp_tool_ids: Id[];
  model_id: '' | Id;
  model_params_setting: JsonRecord;
  model_setting: SimpleApplicationModelSetting;
  name: string;
  problem_optimization: boolean;
  problem_optimization_prompt: string;
  prologue: string;
  skill_tool_ids: Id[];
  stt_autosend: boolean;
  stt_model_enable: boolean;
  stt_model_id: '' | Id;
  stt_model_params_setting: JsonRecord;
  tool_enable: boolean;
  tool_ids: Id[];
  tts_autoplay: boolean;
  tts_model_enable: boolean;
  tts_model_id: '' | Id;
  tts_model_params_setting: JsonRecord;
  tts_type: 'BROWSER' | 'TTS';
  type: 'SIMPLE';
}

export interface SimpleWorkflowNode {
  id: string;
  name?: string;
  properties?: JsonRecord;
  type: string;
  x?: number;
  y?: number;
}

export interface SimpleWorkflowEdge {
  id?: string;
  source?: string;
  sourceAnchorId?: string;
  sourceAnchorType?: string;
  target?: string;
  targetAnchorId?: string;
  targetAnchorType?: string;
  type?: string;
}

export interface SimpleWorkflowGraph {
  edges: SimpleWorkflowEdge[];
  global: JsonRecord;
  mode: string;
  nodes: SimpleWorkflowNode[];
  version: string;
}

const SIMPLE_SECTIONS: SimpleApplicationSection[] = [
  { id: 'basic', title: '基本信息' },
  { id: 'model', title: '模型设置' },
  { id: 'knowledge', title: '知识库' },
  { id: 'skills', title: '技能' },
  { id: 'conversation', title: '对话体验' },
  { id: 'voice', title: '语音能力' },
];

const BASIC_SECTION: SimpleApplicationSection[] = [
  { id: 'basic', title: '基本信息' },
];

export const SIMPLE_SEARCH_NODE_ID = 'simple-search-knowledge-node';
export const SIMPLE_AI_CHAT_NODE_ID = 'simple-ai-chat-node';

export const DEFAULT_SIMPLE_PROLOGUE =
  '您好，我是您的 AI 助手，请问有什么可以帮您？';

export const DEFAULT_SIMPLE_PROMPT =
  '已知信息：{data}\n用户问题：{question}\n回答要求：\n- 请使用中文回答用户问题';

export const DEFAULT_SIMPLE_OPTIMIZATION_PROMPT =
  '请根据用户问题优化出一个更适合知识库检索的问题：{question}<data></data>请仅返回优化后的问题。';

function defaultKnowledgeSetting(): SimpleApplicationKnowledgeSetting {
  return {
    max_paragraph_char_number: 5000,
    no_references_setting: {
      status: 'ai_questioning',
      value: '{question}',
    },
    search_mode: 'embedding',
    similarity: 0.6,
    top_n: 3,
  };
}

function defaultModelSetting(): SimpleApplicationModelSetting {
  return {
    no_references_prompt: '{question}',
    prompt: DEFAULT_SIMPLE_PROMPT,
    reasoning_content_enable: false,
    reasoning_content_end: '</think>',
    reasoning_content_start: '<think>',
    system: '',
  };
}

export function simpleApplicationSettingSections(type?: string) {
  return isWorkflowApplication(type)
    ? cloneDeep(BASIC_SECTION)
    : cloneDeep(SIMPLE_SECTIONS);
}

export function createDefaultSimpleApplicationSettings(
  application: SimpleApplicationLike = {},
): SimpleApplicationSettings {
  const name = textValue(firstValue(application, ['name', 'title']));
  const desc = textValue(firstValue(application, ['desc', 'description']));
  return {
    application_enable: true,
    application_ids: [],
    desc,
    dialogue_number: 1,
    knowledge_id_list: [],
    knowledge_list: [],
    knowledge_setting: defaultKnowledgeSetting(),
    long_term_enable: false,
    long_term_model_id: '',
    long_term_model_params_setting: {},
    long_term_trigger_setting: { rounds: 10 },
    long_term_trigger_type: 'ROUND',
    mcp_enable: true,
    mcp_output_enable: false,
    mcp_servers: '',
    mcp_source: 'referencing',
    mcp_tool_ids: [],
    model_id: '',
    model_params_setting: {},
    model_setting: defaultModelSetting(),
    name,
    problem_optimization: false,
    problem_optimization_prompt: DEFAULT_SIMPLE_OPTIMIZATION_PROMPT,
    prologue: DEFAULT_SIMPLE_PROLOGUE,
    skill_tool_ids: [],
    stt_autosend: false,
    stt_model_enable: false,
    stt_model_id: '',
    stt_model_params_setting: {},
    tool_enable: true,
    tool_ids: [],
    tts_autoplay: false,
    tts_model_enable: false,
    tts_model_id: '',
    tts_model_params_setting: {},
    tts_type: 'BROWSER',
    type: 'SIMPLE',
  };
}

export function parseSimpleApplicationSettings(
  graphData: unknown,
  application: SimpleApplicationLike = {},
): SimpleApplicationSettings {
  const settings = createDefaultSimpleApplicationSettings(application);
  const graph = parseGraphData(graphData);
  const baseNodeData = nodeData(findNode(graph, 'base-node'));
  const searchNodeData = nodeData(
    findNode(graph, SIMPLE_SEARCH_NODE_ID, 'search-knowledge-node'),
  );
  const aiNodeData = nodeData(
    findNode(graph, SIMPLE_AI_CHAT_NODE_ID, 'ai-chat-node'),
  );

  if (baseNodeData) {
    setIfPresent(settings, 'name', textValue(baseNodeData.name, settings.name));
    setIfPresent(settings, 'desc', textValue(baseNodeData.desc, settings.desc));
    setIfPresent(
      settings,
      'prologue',
      textValue(baseNodeData.prologue, settings.prologue),
    );
    setIfPresent(
      settings,
      'long_term_enable',
      booleanValue(baseNodeData.long_term_enable, settings.long_term_enable),
    );
    setIfPresent(
      settings,
      'long_term_model_id',
      idValue(baseNodeData.long_term_model_id, settings.long_term_model_id),
    );
    setIfPresent(
      settings,
      'long_term_model_params_setting',
      recordValue(
        baseNodeData.long_term_model_params_setting,
        settings.long_term_model_params_setting,
      ),
    );
    setIfPresent(
      settings,
      'long_term_trigger_setting',
      recordValue(
        baseNodeData.long_term_trigger_setting,
        settings.long_term_trigger_setting,
      ),
    );
    setIfPresent(
      settings,
      'long_term_trigger_type',
      textValue(
        baseNodeData.long_term_trigger_type,
        settings.long_term_trigger_type,
      ),
    );
    setIfPresent(
      settings,
      'stt_autosend',
      booleanValue(baseNodeData.stt_autosend, settings.stt_autosend),
    );
    setIfPresent(
      settings,
      'stt_model_enable',
      booleanValue(baseNodeData.stt_model_enable, settings.stt_model_enable),
    );
    setIfPresent(
      settings,
      'stt_model_id',
      idValue(baseNodeData.stt_model_id, settings.stt_model_id),
    );
    setIfPresent(
      settings,
      'stt_model_params_setting',
      recordValue(
        baseNodeData.stt_model_params_setting,
        settings.stt_model_params_setting,
      ),
    );
    setIfPresent(
      settings,
      'tts_autoplay',
      booleanValue(baseNodeData.tts_autoplay, settings.tts_autoplay),
    );
    setIfPresent(
      settings,
      'tts_model_enable',
      booleanValue(baseNodeData.tts_model_enable, settings.tts_model_enable),
    );
    setIfPresent(
      settings,
      'tts_model_id',
      idValue(baseNodeData.tts_model_id, settings.tts_model_id),
    );
    setIfPresent(
      settings,
      'tts_model_params_setting',
      recordValue(
        baseNodeData.tts_model_params_setting,
        settings.tts_model_params_setting,
      ),
    );
    setIfPresent(
      settings,
      'tts_type',
      baseNodeData.tts_type === 'TTS' ? 'TTS' : 'BROWSER',
    );
  }

  if (searchNodeData) {
    setIfPresent(
      settings,
      'knowledge_id_list',
      idListValue(searchNodeData.knowledge_id_list),
    );
    setIfPresent(
      settings,
      'knowledge_list',
      recordListValue(searchNodeData.knowledge_list),
    );
    setIfPresent(
      settings,
      'knowledge_setting',
      normalizeKnowledgeSetting(searchNodeData.knowledge_setting),
    );
  }

  if (aiNodeData) {
    const modelSetting = normalizeModelSetting(aiNodeData.model_setting);
    const hasKnowledge = settings.knowledge_id_list.length > 0;
    const savedPrompt = textValue(aiNodeData.prompt);
    const savedSystem = textValue(aiNodeData.system);
    setIfPresent(
      settings,
      'model_id',
      idValue(aiNodeData.model_id, settings.model_id),
    );
    setIfPresent(
      settings,
      'model_params_setting',
      recordValue(
        aiNodeData.model_params_setting,
        settings.model_params_setting,
      ),
    );
    setIfPresent(
      settings,
      'dialogue_number',
      numberValue(aiNodeData.dialogue_number, settings.dialogue_number),
    );
    setIfPresent(settings, 'model_setting', {
      ...modelSetting,
      no_references_prompt: toMaxKbPrompt(
        textValue(
          modelSetting.no_references_prompt,
          settings.model_setting.no_references_prompt,
        ),
      ),
      prompt: toMaxKbPrompt(
        textValue(
          modelSetting.prompt || savedPrompt,
          hasKnowledge
            ? settings.model_setting.prompt
            : settings.model_setting.no_references_prompt,
        ),
      ),
      system: toMaxKbPrompt(textValue(modelSetting.system || savedSystem)),
    });
    setIfPresent(
      settings,
      'application_enable',
      booleanValue(aiNodeData.application_enable, settings.application_enable),
    );
    setIfPresent(
      settings,
      'application_ids',
      idListValue(aiNodeData.application_ids),
    );
    setIfPresent(
      settings,
      'mcp_enable',
      booleanValue(aiNodeData.mcp_enable, settings.mcp_enable),
    );
    setIfPresent(
      settings,
      'mcp_output_enable',
      booleanValue(aiNodeData.mcp_output_enable, settings.mcp_output_enable),
    );
    setIfPresent(
      settings,
      'mcp_servers',
      textValue(aiNodeData.mcp_servers, settings.mcp_servers),
    );
    setIfPresent(
      settings,
      'mcp_source',
      textValue(aiNodeData.mcp_source, settings.mcp_source),
    );
    setIfPresent(
      settings,
      'mcp_tool_ids',
      idListValue(aiNodeData.mcp_tool_ids),
    );
    setIfPresent(
      settings,
      'problem_optimization',
      booleanValue(
        aiNodeData.problem_optimization,
        settings.problem_optimization,
      ),
    );
    setIfPresent(
      settings,
      'problem_optimization_prompt',
      toMaxKbPrompt(
        textValue(
          aiNodeData.problem_optimization_prompt,
          settings.problem_optimization_prompt,
        ),
      ),
    );
    setIfPresent(
      settings,
      'skill_tool_ids',
      idListValue(aiNodeData.skill_tool_ids),
    );
    setIfPresent(
      settings,
      'tool_enable',
      booleanValue(aiNodeData.tool_enable, settings.tool_enable),
    );
    setIfPresent(settings, 'tool_ids', idListValue(aiNodeData.tool_ids));
  }

  return settings;
}

export function buildSimpleApplicationGraph(
  settings: SimpleApplicationSettings,
): SimpleWorkflowGraph {
  const normalized = normalizeSettings(settings);
  const hasKnowledge = normalized.knowledge_id_list.length > 0;
  const nodes: SimpleWorkflowNode[] = [baseNode(normalized), startNode()];
  if (hasKnowledge) nodes.push(searchKnowledgeNode(normalized));
  nodes.push(aiChatNode(normalized, hasKnowledge));
  return {
    edges: hasKnowledge ? knowledgeEdges() : directChatEdges(),
    global: {},
    mode: 'APPLICATION',
    nodes,
    version: '1.0',
  };
}

export function serializeSimpleApplicationGraph(
  settings: SimpleApplicationSettings,
) {
  return JSON.stringify(buildSimpleApplicationGraph(settings));
}

export function normalizeSettings(
  settings: SimpleApplicationSettings,
): SimpleApplicationSettings {
  const defaults = createDefaultSimpleApplicationSettings(settings);
  const next = cloneDeep(defaults);
  Object.entries(settings).forEach(([key, value]) => {
    set(next, key, cloneDeep(value));
  });
  set(next, 'knowledge_id_list', idListValue(next.knowledge_id_list));
  set(next, 'knowledge_list', recordListValue(next.knowledge_list));
  set(
    next,
    'knowledge_setting',
    normalizeKnowledgeSetting(next.knowledge_setting),
  );
  set(next, 'model_setting', normalizeModelSetting(next.model_setting));
  set(next, 'application_ids', idListValue(next.application_ids));
  set(next, 'mcp_tool_ids', idListValue(next.mcp_tool_ids));
  set(next, 'skill_tool_ids', idListValue(next.skill_tool_ids));
  set(next, 'tool_ids', idListValue(next.tool_ids));
  set(next, 'tts_type', next.tts_type === 'TTS' ? 'TTS' : 'BROWSER');
  return next;
}

function baseNode(settings: SimpleApplicationSettings): SimpleWorkflowNode {
  return {
    id: 'base-node',
    name: '基本信息',
    properties: {
      api_input_field_list: [],
      chat_input_field_list: [],
      config: outputConfig([]),
      enableException: false,
      input_field_list: [],
      name: '基本信息',
      node_data: {
        desc: settings.desc,
        file_upload_enable: false,
        long_term_enable: settings.long_term_enable,
        long_term_model_id: settings.long_term_model_id,
        long_term_model_params_setting: cloneDeep(
          settings.long_term_model_params_setting,
        ),
        long_term_trigger_setting: cloneDeep(
          settings.long_term_trigger_setting,
        ),
        long_term_trigger_type: settings.long_term_trigger_type,
        name: settings.name,
        prologue: settings.prologue,
        stt_autosend: settings.stt_autosend,
        stt_model_enable: settings.stt_model_enable,
        stt_model_id: settings.stt_model_id,
        stt_model_params_setting: cloneDeep(settings.stt_model_params_setting),
        tts_autoplay: settings.tts_autoplay,
        tts_model_enable: settings.tts_model_enable,
        tts_model_id: settings.tts_model_id,
        tts_model_params_setting: cloneDeep(settings.tts_model_params_setting),
        tts_type: settings.tts_type,
      },
      providerRequired: false,
      showNode: true,
      status: 200,
      stepName: '基本信息',
      templateStatus: 'logic',
      type: 'base-node',
      unsupportedTemplate: false,
      user_input_config: { title: '用户输入' },
      user_input_field_list: [],
      width: 600,
    },
    type: 'base-node',
    x: 180,
    y: 140,
  };
}

function startNode(): SimpleWorkflowNode {
  return {
    id: 'start-node',
    name: '开始',
    properties: {
      config: outputConfig([
        outputField('question', '用户问题'),
        outputField('time', '当前时间'),
        outputField('history_context', '历史对话'),
        outputField('chat_id', '会话 ID'),
      ]),
      enableException: false,
      name: '开始',
      node_data: { question: '{{input}}' },
      providerRequired: false,
      showNode: true,
      status: 200,
      stepName: '开始',
      templateStatus: 'input',
      type: 'start-node',
      unsupportedTemplate: false,
      width: 340,
    },
    type: 'start-node',
    x: 600,
    y: 140,
  };
}

function searchKnowledgeNode(
  settings: SimpleApplicationSettings,
): SimpleWorkflowNode {
  return {
    id: SIMPLE_SEARCH_NODE_ID,
    name: '知识检索',
    properties: {
      config: outputConfig([
        outputField('paragraph_list', '检索结果的分段列表', 'array'),
        outputField(
          'is_hit_handling_method_list',
          '满足直接回答的分段列表',
          'array',
        ),
        outputField('data', '检索结果'),
        outputField('result', '检索结果'),
        outputField('directly_return', '满足直接回答的分段内容'),
      ]),
      enableException: false,
      name: '知识检索',
      node_data: {
        knowledge_id_list: cloneDeep(settings.knowledge_id_list),
        knowledge_list: cloneDeep(settings.knowledge_list),
        knowledge_setting: cloneDeep(settings.knowledge_setting),
        question_reference_address: ['start-node', 'question'],
        search_scope_reference: [],
        search_scope_source: 'knowledge',
        search_scope_type: 'custom',
        show_knowledge: true,
      },
      providerRequired: false,
      showNode: true,
      status: 200,
      stepName: '知识检索',
      templateStatus: 'resource',
      type: 'search-knowledge-node',
      unsupportedTemplate: false,
      width: 520,
    },
    type: 'search-knowledge-node',
    x: 940,
    y: 140,
  };
}

function aiChatNode(
  settings: SimpleApplicationSettings,
  hasKnowledge: boolean,
): SimpleWorkflowNode {
  const maxKbPrompt = hasKnowledge
    ? settings.model_setting.prompt
    : settings.model_setting.no_references_prompt;
  const modelSetting = {
    ...cloneDeep(settings.model_setting),
    prompt: settings.model_setting.prompt,
    system: settings.model_setting.system,
  };
  return {
    id: SIMPLE_AI_CHAT_NODE_ID,
    name: 'AI 对话',
    properties: {
      config: outputConfig([
        outputField('answer', '回复'),
        outputField('question', '问题'),
        outputField('reasoning_content', '思考'),
        outputField('history_message', '历史消息', 'array'),
      ]),
      enableException: false,
      name: 'AI 对话',
      node_data: {
        application_enable: settings.application_enable,
        application_ids: cloneDeep(settings.application_ids),
        dialogue_number: settings.dialogue_number,
        dialogue_type: 'WORKFLOW',
        is_result: true,
        mcp_enable: settings.mcp_enable,
        mcp_output_enable: settings.mcp_output_enable,
        mcp_servers: settings.mcp_servers,
        mcp_source: settings.mcp_source,
        mcp_tool_ids: cloneDeep(settings.mcp_tool_ids),
        model_id: settings.model_id,
        model_id_reference: [],
        model_id_type: 'custom',
        model_params_setting: cloneDeep(settings.model_params_setting),
        model_setting: modelSetting,
        problem_optimization: settings.problem_optimization,
        problem_optimization_prompt: toRuntimePrompt(
          settings.problem_optimization_prompt,
          hasKnowledge,
        ),
        prompt: toRuntimePrompt(maxKbPrompt, hasKnowledge),
        skill_tool_ids: cloneDeep(settings.skill_tool_ids),
        system: toRuntimePrompt(settings.model_setting.system, hasKnowledge),
        tool_enable: settings.tool_enable,
        tool_ids: cloneDeep(settings.tool_ids),
      },
      providerRequired: false,
      showNode: true,
      status: 200,
      stepName: 'AI 对话',
      templateStatus: 'ai',
      type: 'ai-chat-node',
      unsupportedTemplate: false,
      width: 600,
    },
    type: 'ai-chat-node',
    x: hasKnowledge ? 1280 : 940,
    y: 140,
  };
}

function directChatEdges(): SimpleWorkflowEdge[] {
  return [edge('start-node', SIMPLE_AI_CHAT_NODE_ID)];
}

function knowledgeEdges(): SimpleWorkflowEdge[] {
  return [
    edge('start-node', SIMPLE_SEARCH_NODE_ID),
    edge(SIMPLE_SEARCH_NODE_ID, SIMPLE_AI_CHAT_NODE_ID),
  ];
}

function edge(source: string, target: string): SimpleWorkflowEdge {
  return {
    id: `edge_${source}_to_${target}`,
    source,
    sourceAnchorId: `${source}_right`,
    sourceAnchorType: 'right',
    target,
    targetAnchorId: `${target}_left`,
    targetAnchorType: 'left',
    type: 'app-edge',
  };
}

function outputField(name: string, label: string, type = 'string') {
  return { label, name, type, value: name };
}

function outputConfig(fields: JsonRecord[] = []) {
  return {
    chatFields: [],
    fields,
    globalFields: [],
  };
}

function toRuntimePrompt(prompt: string, hasKnowledge: boolean) {
  const dataReference = hasKnowledge
    ? `{{${SIMPLE_SEARCH_NODE_ID}.result}}`
    : '';
  return prompt
    .replaceAll('{question}', '{{start-node.question}}')
    .replaceAll('{data}', dataReference);
}

function toMaxKbPrompt(prompt: string) {
  return prompt
    .replaceAll(`{{${SIMPLE_SEARCH_NODE_ID}.result}}`, '{data}')
    .replaceAll(`{{${SIMPLE_SEARCH_NODE_ID}.data}}`, '{data}')
    .replaceAll('{{start-node.question}}', '{question}');
}

function parseGraphData(value: unknown): SimpleWorkflowGraph {
  const fallback: SimpleWorkflowGraph = {
    edges: [],
    global: {},
    mode: 'APPLICATION',
    nodes: [],
    version: '1.0',
  };
  if (!value) return fallback;
  try {
    const parsed =
      typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
    const record = isRecord(parsed) ? parsed : {};
    return {
      edges: Array.isArray(record.edges)
        ? (cloneDeep(record.edges) as SimpleWorkflowEdge[])
        : [],
      global: recordValue(record.global, {}),
      mode: textValue(record.mode, 'APPLICATION'),
      nodes: Array.isArray(record.nodes)
        ? (cloneDeep(record.nodes) as SimpleWorkflowNode[])
        : [],
      version: textValue(record.version, '1.0'),
    };
  } catch {
    return fallback;
  }
}

function findNode(
  graph: SimpleWorkflowGraph,
  preferredId: string,
  fallbackType = preferredId,
) {
  return (
    graph.nodes.find((node) => node.id === preferredId) ||
    graph.nodes.find((node) => node.type === fallbackType)
  );
}

function nodeData(node?: SimpleWorkflowNode): JsonRecord | undefined {
  if (!node?.properties) return undefined;
  const data = node.properties.node_data;
  return isRecord(data) ? data : undefined;
}

function normalizeKnowledgeSetting(
  value: unknown,
): SimpleApplicationKnowledgeSetting {
  const defaults = defaultKnowledgeSetting();
  const source = recordValue(value, {});
  const noReferences = recordValue(source.no_references_setting, {});
  return {
    max_paragraph_char_number: numberValue(
      source.max_paragraph_char_number,
      defaults.max_paragraph_char_number,
    ),
    no_references_setting: {
      status: textValue(
        noReferences.status,
        defaults.no_references_setting.status,
      ),
      value: textValue(
        noReferences.value,
        defaults.no_references_setting.value,
      ),
    },
    search_mode: searchModeValue(source.search_mode, defaults.search_mode),
    similarity: numberValue(source.similarity, defaults.similarity),
    top_n: numberValue(source.top_n, defaults.top_n),
  };
}

function normalizeModelSetting(value: unknown): SimpleApplicationModelSetting {
  const defaults = defaultModelSetting();
  const source = recordValue(value, {});
  return {
    no_references_prompt: textValue(
      source.no_references_prompt,
      defaults.no_references_prompt,
    ),
    prompt: textValue(source.prompt, defaults.prompt),
    reasoning_content_enable: booleanValue(
      source.reasoning_content_enable,
      defaults.reasoning_content_enable,
    ),
    reasoning_content_end: textValue(
      source.reasoning_content_end,
      defaults.reasoning_content_end,
    ),
    reasoning_content_start: textValue(
      source.reasoning_content_start,
      defaults.reasoning_content_start,
    ),
    system: textValue(source.system, defaults.system),
  };
}

function firstValue(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordValue(value: unknown, fallback: JsonRecord): JsonRecord {
  return isRecord(value) ? cloneDeep(value) : cloneDeep(fallback);
}

function recordListValue(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.flatMap((item) => (isRecord(item) ? [cloneDeep(item)] : []))
    : [];
}

function idListValue(value: unknown): Id[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const id = idValue(item, undefined);
        return id === undefined ? [] : [id];
      })
    : [];
}

function idValue(value: unknown, fallback: '' | Id | undefined): '' | Id {
  if (typeof value === 'number' || typeof value === 'string') return value;
  return fallback ?? '';
}

function textValue(value: unknown, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return `${value}`;
}

function booleanValue(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function searchModeValue(
  value: unknown,
  fallback: SimpleApplicationKnowledgeSetting['search_mode'],
) {
  return value === 'blend' || value === 'keywords' || value === 'embedding'
    ? value
    : fallback;
}

function setIfPresent(
  target: SimpleApplicationSettings,
  key: string,
  value: unknown,
) {
  set(target, key, cloneDeep(value));
}
