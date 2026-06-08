import { cloneDeep } from 'lodash-es';

export type NodeStatus =
  | 'ai'
  | 'data'
  | 'input'
  | 'logic'
  | 'output'
  | 'resource'
  | 'tool';

export type WorkflowFoundationMode = 'application' | 'tool';

export type PaletteMode = 'application' | 'application-loop' | 'tool';

export type BranchConfig = {
  condition?: 'AND' | 'and' | 'OR' | 'or';
  conditions?: Array<Record<string, any>>;
  id: string;
  name?: string;
  type?: string;
};

export type NodeTemplate = {
  category: string;
  config?: Record<string, any>;
  description: string;
  height?: number;
  name: string;
  nodeData: Record<string, any>;
  outputs?: Array<{
    id: string;
    label: string;
    type?: 'branch' | 'exception' | 'normal';
  }>;
  providerRequired?: boolean;
  status: NodeStatus;
  stub?: boolean;
  type: string;
  width?: number;
};

export type OutputField = {
  label?: string;
  name: string;
  type?: string;
  value?: string;
};

export type WorkflowNode = {
  id: string;
  name?: string;
  properties?: Record<string, any>;
  type: string;
  x?: number;
  y?: number;
};

export type WorkflowEdge = {
  id?: string;
  source?: string;
  sourceAnchorId?: string;
  sourceAnchorType?: string;
  target?: string;
  targetAnchorId?: string;
  targetAnchorType?: string;
  type?: string;
};

export type WorkflowGraphData = {
  edges: WorkflowEdge[];
  global?: Record<string, any>;
  mode?: string;
  nodes: WorkflowNode[];
  version?: string;
};

export type LogicFlowGraph = {
  edges?: any[];
  nodes?: any[];
};

export const DEFAULT_CONFIG = { chatFields: [], fields: [], globalFields: [] };
export const CONDITION_EMPTY_VALUE_OPERATORS = new Set([
  'is_not_null',
  'is_not_true',
  'is_null',
  'is_true',
]);
export const CONDITION_COMPARE_OPERATORS = new Set([
  'contain',
  'end_with',
  'eq',
  'ge',
  'gt',
  'is_not_null',
  'is_not_true',
  'is_null',
  'is_true',
  'le',
  'len_eq',
  'len_ge',
  'len_gt',
  'len_le',
  'len_lt',
  'lt',
  'not_contain',
  'not_eq',
  'regex',
  'start_with',
  'wildcard',
]);
const DEFAULT_AI_CHAT_PROMPT =
  '请根据用户问题和知识库检索结果回答。\n\n用户问题：{{start-node.question}}\n\n知识库检索结果：\n{{search-knowledge-node.data}}\n\n如果检索结果不足以回答，请说明无法从现有知识中确认。';
const DEFAULT_BASE_NODE_PROLOGUE =
  '您好，我是您的 AI 助手，请问有什么可以帮您？';
export const DEFAULT_BASE_NODE_POSITION = { x: 180, y: 140 };
export const DEFAULT_START_NODE_POSITION = { x: 600, y: 140 };
export const DEFAULT_LOOP_START_NODE_POSITION = { x: 480, y: 3340 };
export const DEFAULT_LOOP_START_NODE_HEIGHT = 364;
export const WORKFLOW_SINGLETON_NODE_TYPES = new Set([
  'base-node',
  'start-node',
  'tool-base-node',
  'tool-start-node',
]);
export const WORKFLOW_PROTECTED_ACTION_NODE_TYPES = new Set([
  'base-node',
  'loop-body-node',
  'loop-start-node',
  'start-node',
  'tool-base-node',
  'tool-start-node',
]);
const APPLICATION_PALETTE_NODE_TYPES = [
  'ai-chat-node',
  'intent-node',
  'text-to-speech-node',
  'speech-to-text-node',
  'image-generate-node',
  'image-understand-node',
  'text-to-video-node',
  'image-to-video-node',
  'video-understand-node',
  'question-node',
  'search-knowledge-node',
  'search-document-node',
  'reranker-node',
  'document-extract-node',
  'condition-node',
  'form-node',
  'reply-node',
  'loop-node',
  'variable-assign-node',
  'variable-aggregation-node',
  'variable-splitting-node',
  'parameter-extraction-node',
  'mcp-node',
  'tool-node',
] as const;
const APPLICATION_LOOP_PALETTE_NODE_TYPES = [
  'ai-chat-node',
  'intent-node',
  'text-to-speech-node',
  'speech-to-text-node',
  'image-generate-node',
  'image-understand-node',
  'text-to-video-node',
  'image-to-video-node',
  'video-understand-node',
  'question-node',
  'search-knowledge-node',
  'search-document-node',
  'reranker-node',
  'document-extract-node',
  'condition-node',
  'form-node',
  'reply-node',
  'loop-continue-node',
  'loop-break-node',
  'variable-assign-node',
  'variable-aggregation-node',
  'variable-splitting-node',
  'parameter-extraction-node',
  'mcp-node',
  'tool-node',
] as const;
const TOOL_PALETTE_NODE_TYPES = [
  'ai-chat-node',
  'intent-node',
  'text-to-speech-node',
  'speech-to-text-node',
  'image-generate-node',
  'image-understand-node',
  'text-to-video-node',
  'image-to-video-node',
  'video-understand-node',
  'question-node',
  'search-knowledge-node',
  'search-document-node',
  'reranker-node',
  'document-extract-node',
  'condition-node',
  'form-node',
  'reply-node',
  'loop-node',
  'variable-assign-node',
  'variable-aggregation-node',
  'variable-splitting-node',
  'parameter-extraction-node',
  'mcp-node',
  'tool-node',
] as const;
const PALETTE_NODE_TYPES_BY_MODE: Record<PaletteMode, readonly string[]> = {
  application: APPLICATION_PALETTE_NODE_TYPES,
  'application-loop': APPLICATION_LOOP_PALETTE_NODE_TYPES,
  tool: TOOL_PALETTE_NODE_TYPES,
};

function outputField(
  name: string,
  label: string,
  type = 'string',
): OutputField {
  return { label, name, type };
}

function outputConfig(
  fields: OutputField[] = [],
  extra: Record<string, any> = {},
) {
  return {
    ...DEFAULT_CONFIG,
    ...extra,
    fields,
  };
}

function loopField(name: string, label: string, type = 'string') {
  return {
    field: name,
    label,
    type,
    value: name,
  };
}

function defaultLoopOutputFields() {
  return cloneDeep([
    loopField('index', '下标', 'number'),
    loopField('item', '循环元素'),
  ]);
}

export function defaultLoopInputFields() {
  return cloneDeep([]);
}

function defaultLoopStartNodeData() {
  return {};
}

function defaultLoopStartOutputFields() {
  return defaultLoopOutputFields().map((field) =>
    outputField(field.value, field.label, field.type),
  );
}

export function createDefaultLoopBodyGraphData(
  loopNodeId = '',
): WorkflowGraphData {
  const loopFields = defaultLoopInputFields();
  return {
    edges: [],
    global: {},
    mode: 'APPLICATION',
    nodes: [
      {
        id: 'loop-start-node',
        name: '循环开始',
        properties: {
          config: outputConfig(defaultLoopStartOutputFields()),
          enableException: false,
          height: DEFAULT_LOOP_START_NODE_HEIGHT,
          name: '循环开始',
          loop_input_field_list: cloneDeep(loopFields),
          node_data: {},
          providerRequired: false,
          showNode: true,
          status: 200,
          stepName: '循环开始',
          templateStatus: 'logic',
          type: 'loop-start-node',
          unsupportedTemplate: false,
          width: 340,
          ...(loopNodeId ? { loop_node_id: loopNodeId, loopNodeId } : {}),
        },
        type: 'loop-start-node',
        ...DEFAULT_LOOP_START_NODE_POSITION,
      },
    ],
    version: '1.0',
  };
}

export const END_NODE_TYPES = new Set([
  'ai-chat-node',
  'application-node',
  'data-source-local-node',
  'data-source-web-node',
  'document-extract-node',
  'document-split-node',
  'form-node',
  'function-lib-node',
  'function-node',
  'image-generate-node',
  'image-to-video-node',
  'image-understand-node',
  'knowledge-write-node',
  'loop-node',
  'mcp-node',
  'parameter-extraction-node',
  'reply-node',
  'reranker-node',
  'speech-to-text-node',
  'text-to-speech-node',
  'text-to-video-node',
  'tool-base-node',
  'tool-lib-node',
  'tool-node',
  'tool-workflow-lib-node',
  'variable-aggregation-node',
  'variable-assign-node',
  'variable-splitting-node',
  'video-understand-node',
]);

export const nodeTemplates: NodeTemplate[] = [
  {
    type: 'start-node',
    name: '开始',
    category: 'AI能力',
    status: 'input',
    description: '流程入口',
    nodeData: { question: '{{input}}' },
    config: outputConfig([outputField('question', '用户问题')]),
  },
  {
    type: 'question-node',
    name: '用户问题',
    category: 'AI能力',
    status: 'input',
    description: '读取输入',
    nodeData: {
      dialogue_number: 1,
      is_result: false,
      model_id: '',
      model_id_reference: [],
      model_id_type: 'custom',
      model_params_setting: {},
      prompt: '{{start-node.question}}',
      system:
        '请根据用户问题和历史对话，生成一个清晰、完整、适合后续节点处理的问题。',
    },
    config: outputConfig([
      outputField('answer', '回复'),
      outputField('question', '问题'),
    ]),
  },
  {
    type: 'ai-chat-node',
    name: 'AI 对话',
    category: 'AI能力',
    status: 'ai',
    description: '模型生成',
    nodeData: {
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
      model_setting: {
        reasoning_content_enable: false,
        reasoning_content_end: '</think>',
        reasoning_content_start: '<think>',
      },
      prompt: DEFAULT_AI_CHAT_PROMPT,
      skill_tool_ids: [],
      system: '',
      tool_ids: [],
    },
    config: outputConfig([
      outputField('answer', '回复'),
      outputField('question', '问题'),
      outputField('reasoning_content', '思考'),
      outputField('history_message', '历史消息', 'array'),
    ]),
  },
  {
    type: 'intent-node',
    name: '意图识别',
    category: 'AI能力',
    status: 'ai',
    description: '按模型识别用户意图并选择分支',
    height: 260,
    nodeData: {
      branch: [
        { content: '其他', id: 'other', isOther: true },
        { content: '意图 1', id: 'intent_1', isOther: false },
      ],
      content_list: ['start-node', 'question'],
      dialogue_number: 1,
      model_id: '',
      model_id_reference: [],
      model_id_type: 'custom',
      model_params_setting: {},
    },
    config: outputConfig([
      outputField('category', '分类'),
      outputField('reason', '原因'),
    ]),
  },
  {
    type: 'image-understand-node',
    name: '图像理解',
    category: 'AI能力',
    status: 'ai',
    description: '理解图片内容并输出文本',
    nodeData: {
      dialogue_number: 0,
      dialogue_type: 'NODE_BASED',
      image_list: [],
      is_result: true,
      model_id: '',
      model_id_reference: [],
      model_id_type: 'custom',
      model_params_setting: {},
      model_setting: {},
      prompt: '{{input}}',
      system: '',
    },
    config: outputConfig([
      outputField('answer', '理解结果'),
      outputField('image', '图片列表'),
      outputField('question', '提示词'),
      outputField('result', '文本结果'),
    ]),
  },
  {
    type: 'image-understand',
    name: '图像理解 MaxKB',
    category: 'AI能力',
    status: 'ai',
    description: '图像理解兼容模板',
    nodeData: { image: '', prompt: '' },
    config: outputConfig([outputField('text', '识别结果')]),
    stub: true,
    providerRequired: true,
  },
  {
    type: 'speech-to-text-node',
    name: '语音转文本',
    category: 'AI能力',
    status: 'ai',
    description: '将音频内容转换为文本',
    nodeData: {
      audio_list: [],
      is_result: true,
      model_params_setting: {},
      stt_model_id: '',
      stt_model_id_reference: [],
      stt_model_id_type: 'custom',
    },
    config: outputConfig([
      outputField('answer', '识别文本'),
      outputField('content', '分段内容'),
      outputField('result', '识别结果'),
    ]),
  },
  {
    type: 'text-to-speech-node',
    name: '文本转语音',
    category: 'AI能力',
    status: 'ai',
    description: '将文本内容转换为音频',
    nodeData: {
      content_list: [],
      is_result: true,
      model_params_setting: {},
      tts_model_id: '',
      tts_model_id_reference: [],
      tts_model_id_type: 'custom',
    },
    config: outputConfig([
      outputField('answer', '音频播放器'),
      outputField('audio', '音频文件'),
      outputField('result', '音频结果'),
    ]),
  },
  {
    type: 'image-generate-node',
    name: '图像生成',
    category: 'AI能力',
    status: 'ai',
    description: '根据提示词生成图片',
    nodeData: {
      dialogue_number: 0,
      dialogue_type: 'NODE_BASED',
      is_result: true,
      model_id: '',
      model_id_reference: [],
      model_id_type: 'custom',
      model_params_setting: {},
      negative_prompt: '',
      prompt: '{{input}}',
    },
    config: outputConfig([
      outputField('answer', '图片内容'),
      outputField('image', '图片文件'),
      outputField('question', '提示词'),
      outputField('result', '生成结果'),
    ]),
  },
  {
    type: 'image-generate',
    name: '图像生成 MaxKB',
    category: 'AI能力',
    status: 'ai',
    description: '图像生成兼容模板',
    nodeData: { prompt: '{{input}}', modelId: '' },
    config: outputConfig([outputField('image', '图片')]),
    stub: true,
    providerRequired: true,
  },
  {
    type: 'text-to-video-node',
    name: '文生视频',
    category: 'AI能力',
    status: 'ai',
    description: '根据提示词生成视频',
    nodeData: {
      dialogue_number: 0,
      dialogue_type: 'NODE_BASED',
      is_result: true,
      model_id: '',
      model_id_reference: [],
      model_id_type: 'custom',
      model_params_setting: {},
      negative_prompt: '',
      prompt: '{{input}}',
    },
    config: outputConfig([
      outputField('answer', '视频播放器'),
      outputField('question', '提示词'),
      outputField('result', '视频结果'),
      outputField('video', '视频文件'),
    ]),
    providerRequired: true,
  },
  {
    type: 'image-to-video-node',
    name: '图生视频',
    category: 'AI能力',
    status: 'ai',
    description: '根据首帧图片和提示词生成视频',
    nodeData: {
      dialogue_number: 0,
      dialogue_type: 'NODE_BASED',
      first_frame_url: [],
      is_result: true,
      last_frame_url: [],
      model_id: '',
      model_id_reference: [],
      model_id_type: 'custom',
      model_params_setting: {},
      negative_prompt: '',
      prompt: '{{input}}',
    },
    config: outputConfig([
      outputField('answer', '视频播放器'),
      outputField('image', '首帧图片'),
      outputField('question', '提示词'),
      outputField('result', '视频结果'),
      outputField('video', '视频文件'),
    ]),
    providerRequired: true,
  },
  {
    type: 'video-understand-node',
    name: '视频理解',
    category: 'AI能力',
    status: 'ai',
    description: '理解视频内容并输出文本',
    nodeData: {
      dialogue_number: 0,
      dialogue_type: 'NODE_BASED',
      is_result: true,
      model_id: '',
      model_id_reference: [],
      model_id_type: 'custom',
      model_params_setting: {},
      model_setting: {},
      prompt: '{{input}}',
      system: '',
      video_list: [],
    },
    config: outputConfig([
      outputField('answer', '理解结果'),
      outputField('question', '提示词'),
      outputField('result', '文本结果'),
      outputField('video', '视频列表'),
    ]),
    providerRequired: true,
  },
  {
    type: 'search-knowledge-node',
    name: '知识检索',
    category: '知识库',
    status: 'resource',
    description: '召回知识',
    nodeData: {
      knowledge_id_list: [],
      knowledge_setting: {
        max_paragraph_char_number: 5000,
        search_mode: 'embedding',
        similarity: 0.6,
        top_n: 3,
      },
      question_reference_address: [],
      search_scope_reference: [],
      search_scope_source: 'knowledge',
      search_scope_type: 'custom',
      show_knowledge: false,
    },
    config: outputConfig([
      outputField('paragraph_list', '检索结果的分段列表', 'array'),
      outputField(
        'is_hit_handling_method_list',
        '满足直接回答的分段列表',
        'array',
      ),
      outputField('data', '检索结果'),
      outputField('directly_return', '满足直接回答的分段内容'),
    ]),
  },
  {
    type: 'search-document-node',
    name: '文档检索',
    category: '知识库',
    status: 'resource',
    description: '文档过滤',
    nodeData: {
      knowledge_id_list: [],
      question_reference: ['start-node', 'question'],
      search_condition_list: [],
      search_condition_type: 'AND',
      search_mode: 'auto',
      search_scope_reference: [],
      search_scope_source: 'knowledge',
      search_scope_type: 'custom',
      topK: 5,
    },
    config: outputConfig([
      outputField('document_list', '文档 ID 列表', 'array'),
      outputField('document_items', '文档详情列表', 'array'),
      outputField('knowledge_list', '知识库 ID 列表', 'array'),
      outputField('knowledge_items', '知识库详情列表', 'array'),
    ]),
  },
  {
    type: 'reranker-node',
    name: '重排',
    category: '知识库',
    status: 'ai',
    description: '结果重排',
    nodeData: {
      question_reference_address: ['start-node', 'question'],
      reranker_model_id: '',
      reranker_model_id_reference: [],
      reranker_model_id_type: 'custom',
      reranker_reference_list: [['search-knowledge-node', 'paragraph_list']],
      reranker_setting: {
        max_paragraph_char_number: 5000,
        similarity: 0,
        top_n: 3,
      },
      show_knowledge: false,
    },
    config: outputConfig([
      outputField('result_list', '重排结果列表', 'array'),
      outputField('result', '重排结果'),
      outputField('is_hit_handling_method_list', '命中处理方式列表', 'array'),
    ]),
  },
  {
    type: 'knowledge-write-node',
    name: '写入知识',
    category: '知识库',
    status: 'resource',
    description: '沉淀知识',
    nodeData: {
      document_list: ['document-split-node', 'paragraph_list'],
      knowledgeId: '',
    },
    config: outputConfig([
      outputField('write_content', '写入内容', 'array'),
      outputField('documentId', '文档ID'),
      outputField('status', '写入状态'),
    ]),
  },
  {
    type: 'knowledge-base-node',
    name: '知识库基础',
    category: '知识库',
    status: 'resource',
    description: '知识库应用入口模板',
    nodeData: { userInputFields: [], knowledgeIds: [] },
    config: outputConfig([
      outputField('query', '问题'),
      outputField('documents', '知识片段', 'array'),
    ]),
    width: 600,
  },
  {
    type: 'base-node',
    name: '基本信息',
    category: '业务逻辑',
    status: 'logic',
    description: '应用基本信息',
    nodeData: {
      desc: '',
      file_upload_enable: false,
      long_term_enable: false,
      name: '',
      prologue: DEFAULT_BASE_NODE_PROLOGUE,
      stt_autosend: false,
      stt_model_enable: false,
      tts_autoplay: false,
      tts_model_enable: false,
      tts_type: 'BROWSER',
    },
    config: outputConfig([]),
  },
  {
    type: 'condition-node',
    name: '条件',
    category: '业务逻辑',
    status: 'logic',
    description: '分支判断',
    nodeData: {},
    config: outputConfig([
      outputField('branch_id', '分支ID'),
      outputField('branch_name', '分支名称'),
    ]),
  },
  {
    type: 'loop-node',
    name: '循环',
    category: '业务逻辑',
    status: 'logic',
    description: '迭代执行',
    height: 252,
    nodeData: {
      array: [],
      loop_body: createDefaultLoopBodyGraphData(),
      loop_type: 'ARRAY',
      number: 1,
    },
    config: outputConfig([]),
  },
  {
    type: 'loop-start-node',
    name: '循环开始',
    category: '业务逻辑',
    status: 'logic',
    description: '循环变量入口',
    height: DEFAULT_LOOP_START_NODE_HEIGHT,
    nodeData: defaultLoopStartNodeData(),
    config: outputConfig(defaultLoopStartOutputFields()),
  },
  {
    type: 'loop-body-node',
    name: '循环体',
    category: '业务逻辑',
    status: 'logic',
    description: '循环体容器',
    height: 1080,
    nodeData: {
      loop_body: createDefaultLoopBodyGraphData(),
      loop_node_id: '',
      loopNodeId: '',
    },
    config: outputConfig([]),
    width: 1920,
  },
  {
    type: 'loop-break-node',
    name: '跳出循环',
    category: '业务逻辑',
    status: 'logic',
    description: '循环控制',
    height: 100,
    nodeData: {
      condition: 'and',
      condition_list: [],
      condition_relation: 'and',
    },
    width: 600,
  },
  {
    type: 'loop-continue-node',
    name: '继续循环',
    category: '业务逻辑',
    status: 'logic',
    description: '循环控制',
    height: 100,
    nodeData: {
      condition: 'and',
      condition_list: [],
      condition_relation: 'and',
    },
    width: 600,
  },
  {
    type: 'reply-node',
    name: '回复',
    category: '业务逻辑',
    status: 'output',
    description: '返回文本',
    nodeData: {
      content: '',
      fields: [],
      is_result: true,
      reply_type: 'content',
    },
    config: outputConfig([
      outputField('answer', '回复内容'),
      outputField('content', '回复内容'),
    ]),
  },
  {
    type: 'form-node',
    name: '表单',
    category: '业务逻辑',
    status: 'input',
    description: '收集字段',
    nodeData: {
      form_content_format:
        '你好，请先填写下面表单内容：\n{{form}}\n填写后请点击【提交】按钮进行提交。',
      form_field_list: [],
      is_result: true,
    },
    config: outputConfig([
      {
        label: '表单全部内容',
        name: 'form_data',
        type: 'object',
        value: 'form_data',
      },
    ]),
  },
  {
    type: 'variable-assign-node',
    name: '变量赋值',
    category: '数据处理',
    status: 'data',
    description: '写入变量',
    nodeData: {
      variable_list: [
        {
          fields: ['output', 'answer'],
          id: 'var_1',
          name: 'answer',
          reference: [],
          source: 'custom',
          type: 'string',
          value: '{{input}}',
        },
      ],
    },
    config: outputConfig([
      outputField('variables', '变量', 'object'),
      outputField('variable_list', '变量配置', 'array'),
      outputField('result_list', '赋值结果', 'array'),
    ]),
  },
  {
    type: 'variable-splitting-node',
    name: '变量拆分',
    category: '数据处理',
    status: 'data',
    description: '按 JSONPath 拆分对象字段',
    nodeData: { input_variable: [], variable_list: [] },
    config: outputConfig([outputField('result', '结果', 'object')]),
  },
  {
    type: 'variable-aggregation-node',
    name: '变量聚合',
    category: '数据处理',
    status: 'data',
    description: '按策略聚合多个变量',
    nodeData: {
      group_list: [
        {
          field: 'Group1',
          id: 'group_1',
          label: 'Group1',
          variable_list: [{ v_id: 'variable_1', variable: [] }],
        },
      ],
      strategy: 'first_non_null',
    },
    config: outputConfig([outputField('Group1', 'Group1')]),
    width: 450,
  },
  {
    type: 'parameter-extraction-node',
    name: '参数提取',
    category: '数据处理',
    status: 'data',
    description: '使用模型从文本中抽取参数',
    height: 345,
    nodeData: {
      input_variable: [],
      model_id: '',
      model_id_reference: [],
      model_id_type: 'custom',
      model_params_setting: {},
      variable_list: [],
    },
    config: outputConfig([outputField('result', '结果', 'object')]),
    width: 430,
  },
  {
    type: 'document-extract-node',
    name: '文档提取',
    category: '数据处理',
    status: 'data',
    description: '抽取文本',
    nodeData: { document_list: ['start-node', 'document'] },
    config: outputConfig([
      outputField('content', '文档内容'),
      outputField('document_list', '文档列表', 'array'),
    ]),
  },
  {
    type: 'document-split-node',
    name: '文档分段',
    category: '数据处理',
    status: 'data',
    description: '切分文本',
    nodeData: {
      chunk_size: 256,
      chunk_size_reference: [],
      chunk_size_type: 'custom',
      document_list: ['start-node', 'document'],
      document_name_relate_problem: true,
      document_name_relate_problem_reference: [],
      document_name_relate_problem_type: 'custom',
      limit: 4096,
      limit_reference: [],
      limit_type: 'custom',
      paragraph_title_relate_problem: true,
      paragraph_title_relate_problem_reference: [],
      paragraph_title_relate_problem_type: 'custom',
      patterns: [],
      patterns_reference: [],
      patterns_type: 'custom',
      split_strategy: 'auto',
      with_filter: false,
      with_filter_reference: [],
      with_filter_type: 'custom',
    },
    config: outputConfig([outputField('paragraph_list', '分段列表', 'array')]),
  },
  {
    type: 'tool-node',
    name: '工具',
    category: '工具/其他',
    status: 'tool',
    description: '调用工具',
    nodeData: { input: '{{input}}', toolId: '' },
    config: outputConfig([outputField('result', '工具结果')]),
  },
  {
    type: 'tool-lib-node',
    name: '工具库',
    category: '工具/其他',
    status: 'tool',
    description: '调用工具库工具',
    nodeData: {
      input: '{{input}}',
      input_field_list: [],
      is_result: true,
      toolLibId: '',
      tool_lib_id: '',
    },
    config: outputConfig([outputField('result', '工具库结果')]),
  },
  {
    type: 'tool-workflow-lib-node',
    name: '工作流工具',
    category: '工具/其他',
    status: 'tool',
    description: '工作流工具库调用',
    nodeData: {
      input: '{{input}}',
      input_field_list: [],
      is_result: true,
      toolId: '',
      toolLibId: '',
      tool_lib_id: '',
      workflowId: '',
    },
    config: outputConfig([outputField('result', '工作流结果')]),
  },
  {
    type: 'tool-start-node',
    name: '工具开始',
    category: '工具/其他',
    status: 'input',
    description: '工具工作流入口',
    nodeData: { input_field_list: [] },
    config: {
      chatFields: [],
      fields: [],
      globalFields: [],
    },
  },
  {
    type: 'tool-base-node',
    name: '工具基础',
    category: '工具/其他',
    status: 'tool',
    description: '定义工具工作流输入输出',
    nodeData: {
      input_field_list: [],
      output_field_list: [],
      tool_desc: '',
      tool_name: '',
    },
    config: {
      chatFields: [],
      fields: [],
      globalFields: [],
    },
  },
  {
    type: 'function-node',
    name: '函数',
    category: '工具/其他',
    status: 'tool',
    description: '执行函数',
    nodeData: { code: '', input: '{{input}}' },
    config: outputConfig([outputField('result', '执行结果')]),
  },
  {
    type: 'function-lib-node',
    name: '函数库',
    category: '工具/其他',
    status: 'tool',
    description: '函数库调用',
    nodeData: { functionId: '', input: '{{input}}' },
    config: outputConfig([outputField('result', '函数结果')]),
  },
  {
    type: 'application-node',
    name: '应用',
    category: '工具/其他',
    status: 'tool',
    description: '调用应用',
    nodeData: { applicationId: '', message: '{{input}}' },
    config: outputConfig([outputField('answer', '应用回复')]),
  },
  {
    type: 'mcp-node',
    name: 'MCP',
    category: '工具/其他',
    status: 'tool',
    description: 'MCP 调用',
    nodeData: {
      mcp_tool: '',
      mcp_tools: [],
      mcp_servers: '',
      mcp_server: '',
      mcp_source: 'referencing',
      mcp_tool_id: '',
      tool_params: {},
      tool_form_field: [],
      params_nested: '',
    },
    config: outputConfig([outputField('result', 'MCP结果')]),
  },
  {
    type: 'data-source-local-node',
    name: '本地数据源',
    category: '数据源',
    status: 'resource',
    description: '本地内容',
    nodeData: { content: '{{input}}' },
    config: outputConfig([outputField('content', '内容')]),
  },
  {
    type: 'data-source-web-node',
    name: '网页数据源',
    category: '数据源',
    status: 'resource',
    description: '抓取网页',
    nodeData: {
      document_list: ['start-node', 'document'],
      selector: '',
      source_url: '',
    },
    config: outputConfig([
      outputField('document_list', '文档列表', 'array'),
      outputField('source_url', '网页地址'),
      outputField('selector', '选择器'),
    ]),
  },
];

export function cloneValue<T>(value: T): T {
  return cloneDeep(value);
}

export function isWorkflowSingletonNode(type?: string) {
  return WORKFLOW_SINGLETON_NODE_TYPES.has(`${type || ''}`);
}

export function isProtectedWorkflowActionNode(type?: string) {
  return WORKFLOW_PROTECTED_ACTION_NODE_TYPES.has(`${type || ''}`);
}

export function createDefaultWorkflowNodes(): WorkflowNode[] {
  return [
    {
      id: 'base-node',
      name: '基本信息',
      properties: defaultProperties('base-node', '基本信息'),
      type: 'base-node',
      ...DEFAULT_BASE_NODE_POSITION,
    },
    {
      id: 'start-node',
      name: '开始',
      properties: defaultProperties('start-node', '开始'),
      type: 'start-node',
      ...DEFAULT_START_NODE_POSITION,
    },
  ];
}

export function createDefaultToolWorkflowNodes(): WorkflowNode[] {
  return [
    {
      id: 'tool-base-node',
      name: '工具基础',
      properties: defaultProperties('tool-base-node', '工具基础'),
      type: 'tool-base-node',
      ...DEFAULT_BASE_NODE_POSITION,
    },
    {
      id: 'tool-start-node',
      name: '工具开始',
      properties: defaultProperties('tool-start-node', '工具开始'),
      type: 'tool-start-node',
      ...DEFAULT_START_NODE_POSITION,
    },
  ];
}

export const DEFAULT_GRAPH_DATA = JSON.stringify(
  {
    edges: [],
    global: {},
    mode: 'APPLICATION',
    nodes: createDefaultWorkflowNodes(),
    version: '1.0',
  },
  null,
  2,
);

export const DEFAULT_TOOL_GRAPH_DATA = JSON.stringify(
  {
    edges: [],
    global: {},
    mode: 'APPLICATION',
    nodes: createDefaultToolWorkflowNodes(),
    version: '1.0',
  },
  null,
  2,
);

export function nodeMeta(type?: string) {
  const matched = nodeTemplates.find((item) => item.type === type);
  if (matched) return matched;
  const fallback = nodeTemplates.find((item) => item.type === 'base-node');
  if (fallback) return fallback;
  throw new Error('base-node template is missing');
}

export function groupedNodeTemplates(mode: PaletteMode = 'application') {
  const groups = new Map<string, NodeTemplate[]>();
  const templatesByType = new Map(
    nodeTemplates.map((item) => [item.type, item]),
  );
  PALETTE_NODE_TYPES_BY_MODE[mode].forEach((type) => {
    const item = templatesByType.get(type);
    if (!item) return;
    const groupItems = groups.get(item.category) || [];
    groupItems.push(item);
    groups.set(item.category, groupItems);
  });
  return [...groups.entries()].map(([name, items]) => ({ items, name }));
}

export function defaultProperties(
  type: string,
  name?: string,
): Record<string, any> {
  const meta = nodeMeta(type);
  const width = meta.width || (type === 'condition-node' ? 600 : 340);
  if (type === 'base-node') {
    return {
      api_input_field_list: [],
      chat_input_field_list: [],
      config: cloneValue(meta.config || DEFAULT_CONFIG),
      enableException: false,
      input_field_list: [],
      name: name || meta.name,
      node_data: cloneValue(meta.nodeData),
      providerRequired: false,
      showNode: true,
      status: 200,
      stepName: name || meta.name,
      templateStatus: meta.status,
      type,
      unsupportedTemplate: !!meta.stub,
      user_input_config: { title: '用户输入' },
      user_input_field_list: [],
      width: 600,
    };
  }
  const properties = {
    config: cloneValue(meta.config || DEFAULT_CONFIG),
    enableException: false,
    name: name || meta.name,
    node_data: cloneValue(meta.nodeData),
    providerRequired: !!meta.providerRequired,
    ...(type === 'start-node' ? { showNode: true } : {}),
    status: 200,
    stepName: name || meta.name,
    templateStatus: meta.status,
    type,
    unsupportedTemplate: !!meta.stub,
    width,
    ...(meta.height ? { height: meta.height } : {}),
  };
  return properties;
}

export function normalizeProperties(
  properties: Record<string, any>,
  type: string,
  name?: string,
): Record<string, any> {
  const defaults = defaultProperties(type, name);
  const source = properties || {};
  const sourceConfig =
    typeof source.config === 'object' && source.config !== null
      ? source.config
      : {};
  const mergedConfig = { ...cloneValue(defaults.config), ...sourceConfig };
  if (!Array.isArray(mergedConfig.fields) || mergedConfig.fields.length === 0) {
    mergedConfig.fields = cloneValue(defaults.config.fields || []);
  }
  const sourceNodeData =
    typeof source.node_data === 'object' && source.node_data !== null
      ? source.node_data
      : {};
  if (
    type === 'condition-node' &&
    !mergedConfig.fields?.some((field: any) =>
      ['branch_id', 'branch_name'].includes(field?.name || field?.value),
    )
  ) {
    mergedConfig.fields = cloneValue(defaults.config.fields || []);
  }
  const mergedNodeData = {
    ...cloneValue(defaults.node_data),
    ...sourceNodeData,
  };
  const normalized: Record<string, any> = {
    ...defaults,
    ...source,
    config: mergedConfig,
    name: name || source.name || source.stepName || defaults.name,
    node_data: mergedNodeData,
    stepName: name || source.stepName || source.name || defaults.stepName,
    templateStatus: source.templateStatus || defaults.templateStatus,
    type,
  };
  return normalized;
}

export function outputFields(properties?: Record<string, any>): OutputField[] {
  const fields = properties?.config?.fields;
  return Array.isArray(fields) ? fields : [];
}

export function nodeSummary(type: string, properties?: Record<string, any>) {
  const data = properties?.node_data || {};
  const compact = (value: any, fallback = '未配置') => {
    if (Array.isArray(value))
      return value.length > 0 ? `${value.length} 项` : fallback;
    if (typeof value === 'boolean') return value ? '启用' : '关闭';
    if (value === undefined || value === null || value === '') return fallback;
    const text = `${value}`.replaceAll(/\s+/g, ' ').trim();
    return text.length > 24 ? `${text.slice(0, 24)}...` : text;
  };

  const summaries: Record<string, string[]> = {
    'ai-chat-node': [
      `模型 ${compact(data.model_id || data.modelId)}`,
      `提示 ${compact(data.prompt)}`,
    ],
    'application-node': [
      `应用 ${compact(data.applicationId)}`,
      `消息 ${compact(data.message)}`,
    ],
    'condition-node': [
      `分支 ${Array.isArray(data.branch) ? data.branch.length : 0}`,
    ],
    'data-source-web-node': [
      `URL ${compact(data.source_url)}`,
      `选择器 ${compact(data.selector)}`,
    ],
    'document-extract-node': [`文档 ${compact(data.document_list)}`],
    'document-split-node': [
      `策略 ${compact(data.split_strategy)}`,
      `分段 ${compact(data.chunk_size ?? data.chunkSize)}`,
    ],
    'function-lib-node': [`函数 ${compact(data.functionId)}`],
    'function-node': [`代码 ${data.code ? '已配置' : '未配置'}`],
    'form-node': [
      `字段 ${compact(data.form_field_list)}`,
      `内容 ${compact(data.form_content_format)}`,
    ],
    'image-generate': [
      `模型 ${compact(data.modelId)}`,
      `提示 ${compact(data.prompt)}`,
    ],
    'image-to-video-node': [
      `模型 ${compact(data.modelId)}`,
      `图片 ${compact(data.image)}`,
    ],
    'image-understand': [
      `图片 ${compact(data.image)}`,
      `提示 ${compact(data.prompt)}`,
    ],
    'intent-node': [
      `意图 ${compact(data.branch)}`,
      `问题 ${compact(data.content_list)}`,
    ],
    'knowledge-base-node': [`知识库 ${compact(data.knowledgeIds)}`],
    'knowledge-write-node': [`知识库 ${compact(data.knowledgeId)}`],
    'loop-body-node': [`循环 ${compact(data.loop_node_id || data.loopNodeId)}`],
    'loop-node': [
      `类型 ${compact(data.loop_type)}`,
      `次数 ${compact(data.number)}`,
    ],
    'loop-start-node': [
      `字段 ${compact(Array.isArray(data.loop_input_field_list) ? data.loop_input_field_list : [])}`,
    ],
    'mcp-node': [
      `服务 ${compact(data.mcp_server)}`,
      `工具 ${compact(data.mcp_tool)}`,
    ],
    'question-node': [
      `模型 ${compact(data.model_id_type === 'reference' ? data.model_id_reference : data.model_id)}`,
      `问题 ${compact(data.prompt || data.question || data.question_reference)}`,
    ],
    'reply-node': [
      `回复 ${compact(data.reply_type === 'referencing' ? data.fields : data.content)}`,
    ],
    'reranker-node': [
      `Top ${compact(data.reranker_setting?.top_n ?? data.topK)}`,
      `文档 ${compact(data.reranker_reference_list ?? data.documents)}`,
    ],
    'search-document-node': [
      `模式 ${compact(data.search_mode)}`,
      `知识库 ${compact(data.knowledge_id_list)}`,
    ],
    'search-knowledge-node': [
      `Top ${compact(data.knowledge_setting?.top_n ?? data.topK)}`,
      `阈值 ${compact(data.knowledge_setting?.similarity ?? data.similarityThreshold)}`,
    ],
    'text-to-video-node': [
      `模型 ${compact(data.modelId)}`,
      `提示 ${compact(data.prompt)}`,
    ],
    'tool-base-node': [
      `输入 ${compact(data.input_field_list)}`,
      `输出 ${compact(data.output_field_list)}`,
    ],
    'tool-lib-node': [
      `工具库 ${compact(data.toolLibId)}`,
      `工具 ${compact(data.toolId)}`,
    ],
    'tool-node': [`工具 ${compact(data.toolId)}`],
    'tool-start-node': [`输入 ${compact(data.input_field_list)}`],
    'tool-workflow-lib-node': [
      `工作流 ${compact(data.workflowId)}`,
      `工具 ${compact(data.toolId)}`,
    ],
    'video-understand-node': [
      `视频 ${compact(data.video)}`,
      `提示 ${compact(data.prompt)}`,
    ],
  };

  return (
    summaries[type] ||
    Object.entries(data)
      .slice(0, 2)
      .map(([key, value]) => `${key} ${compact(value)}`)
  );
}

export function edgeAnchorOptions(node: WorkflowNode) {
  const properties = normalizeProperties(
    node.properties || {},
    node.type,
    node.name,
  );
  const branches = Array.isArray(properties.node_data?.branch)
    ? properties.node_data.branch
    : [];
  const options = ['base-node', 'condition-node'].includes(node.type)
    ? []
    : [{ label: '默认输出', value: `${node.id}_right` }];
  if (node.type === 'loop-node') {
    options.push({ label: '循环体', value: `${node.id}_children` });
  }
  options.push(
    ...branches.map((branch: BranchConfig) => ({
      label: branch.type || branch.name || branch.id,
      value: `${node.id}_${branch.id}_right`,
    })),
  );
  if (properties.enableException) {
    options.push({ label: '异常', value: `${node.id}_exception_right` });
  }
  return options;
}
