import type { AiToolType, ToolRequest } from '#/api/ai/tools';

type Id = number | string;

export interface ToolPayloadFormState {
  code: string;
  description: string;
  folder_id?: Id;
  icon: string;
  init_field_list: unknown[];
  init_params: string;
  input_field_list: unknown[];
  name: string;
  tool_type: AiToolType;
  workspace_id: string;
}

export interface BuildToolPayloadOptions {
  enabled?: boolean;
  isEdit?: boolean;
  workflowValue?: unknown;
}

export const DEFAULT_CONFIG_JSON = '{}';
export const DEFAULT_WORKFLOW_JSON = '{}';
export const MAX_SKILL_ZIP_FILE_SIZE_MB = 100;
export const MAX_SKILL_ZIP_FILE_SIZE_BYTES =
  MAX_SKILL_ZIP_FILE_SIZE_MB * 1024 * 1024;
export const MCP_SERVER_JSON_EXAMPLE = `{
  "math": {
    "url": "your_server",
    "transport": "sse"
  }
}`;

export interface SkillZipFileLike {
  name?: string;
  size?: number;
}

export type SkillZipValidationResult =
  | { message: string; valid: false }
  | { valid: true };

export const DATA_SOURCE_CODE_TEMPLATE = `def get_form_list(node, **kwargs):
    """
    获取表单配置列表

    Args:
        node: 节点对象
        **kwargs: 其他关键字参数

    Returns:
        list: 包含表单字段配置的列表，用于构建文件树选择器
    """
    return [{
        "field": 'file_list',
        "text_field": 'name',
        "value_field": 'token',
        "input_type": 'Tree',
        "attrs": {
            "lazy": True,
            "fetch_list_function": "get_file_list",
        },
        "label": '',
    }]


def get_file_list(app_id=None, app_secret=None, folder_token=None, **kwargs):
    """
    获取文件列表

    Args:
        app_id (str, optional): 应用ID
        app_secret (str, optional): 应用密钥
        folder_token (str, optional): 文件夹token
        **kwargs: 其他关键字参数，包括current_node当前节点信息

    Returns:
        list: 过滤后的文件列表，每个文件包含leaf标识和原始文件信息
    """
    pass


def get_down_file_list(app_id=None, app_secret=None, **kwargs):
    """
    获取需要下载的文件列表（过滤掉文件夹）

    Args:
        app_id (str, optional): 应用ID
        app_secret (str, optional): 应用密钥
        **kwargs: 其他关键字参数，包括file_list文件列表

    Returns:
        list: 过滤后的文件列表，不包含文件夹类型
    """
    pass


def download(app_id=None, app_secret=None, **kwargs):
    """
    下载文件

    支持下载文档(docx)、表格(sheet)和普通文件
    - 对于文档和表格，先创建导出任务，轮询等待导出完成后下载
    - 对于普通文件，直接下载

    Args:
        app_id (str, optional): 应用ID
        app_secret (str, optional): 应用密钥
        **kwargs: 其他关键字参数，包括download_item下载项信息

    Returns:
        dict: 包含文件字节数组(base64编码)和文件名的字典
              {'file_bytes': [base64_chunk1, base64_chunk2, ...], 'name': 'filename.ext'}

    Raises:
        Exception: 当创建导出任务失败、查询任务失败或导出任务超时时抛出异常
    """
    pass`;

const codeGeneratingToolTypes = new Set<AiToolType>(['CUSTOM', 'HTTP', 'MOCK']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeJsonText(value: unknown, fallback = '{}') {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return trimmed;
    }
  }
  return JSON.stringify(value, null, 2);
}

function normalizeFolderId(value: Id | undefined) {
  if (value === '') return undefined;
  return value;
}

function workflowRecord(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return { ...value };
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (isRecord(parsed)) return { ...parsed };
    } catch {
      return {};
    }
  }
  return {};
}

function addToolType(payload: ToolRequest, type: AiToolType) {
  payload.toolType = type;
  payload.tool_type = type;
}

function addCreateFields(
  payload: ToolRequest,
  form: ToolPayloadFormState,
  enabled: boolean,
) {
  payload.enabled = enabled;
  payload.folder_id = normalizeFolderId(form.folder_id);
  payload.is_active = enabled;
  payload.workspace_id = form.workspace_id || 'default';
}

function addParamFields(payload: ToolRequest, form: ToolPayloadFormState) {
  payload.init_field_list = JSON.stringify(form.init_field_list || []);
  payload.init_params = normalizeJsonText(form.init_params, '{}');
  payload.input_field_list = JSON.stringify(form.input_field_list || []);
}

function addInitOnlyFields(payload: ToolRequest, form: ToolPayloadFormState) {
  payload.init_field_list = JSON.stringify(form.init_field_list || []);
  payload.init_params = normalizeJsonText(form.init_params, '{}');
  payload.input_field_list = '[]';
}

export function defaultCodeForToolType(type: AiToolType) {
  if (type === 'DATA_SOURCE') return DATA_SOURCE_CODE_TEMPLATE;
  if (type === 'WORKFLOW') return 'None';
  return '';
}

export function supportsToolAiGenerate(type: AiToolType) {
  return codeGeneratingToolTypes.has(type);
}

export function isValidMcpServerConfigJson(value: string) {
  if (!value.trim()) return false;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed)) return false;
    const servers = Object.entries(parsed);
    if (servers.length === 0) return false;
    return servers.every(
      ([name, config]) =>
        name.trim().length > 0 &&
        isRecord(config) &&
        Object.keys(config).length > 0,
    );
  } catch {
    return false;
  }
}

export function validateSkillZipFile(
  file: SkillZipFileLike,
): SkillZipValidationResult {
  const fileName = `${file.name || ''}`.trim();
  if (!fileName.toLowerCase().endsWith('.zip')) {
    return { message: '仅支持上传 ZIP 文件', valid: false };
  }
  const fileSize = file.size;
  if (typeof fileSize !== 'number' || !Number.isFinite(fileSize)) {
    return { message: 'Skill ZIP 文件大小无效', valid: false };
  }
  if (fileSize <= 0) {
    return { message: 'Skill ZIP 文件不能为空', valid: false };
  }
  if (fileSize > MAX_SKILL_ZIP_FILE_SIZE_BYTES) {
    return {
      message: `Skill ZIP 文件不能超过 ${MAX_SKILL_ZIP_FILE_SIZE_MB}MB`,
      valid: false,
    };
  }
  return { valid: true };
}

export function keepLatestSkillZipFiles<T>(files: T[]): T[] {
  return files.length > 1 ? files.slice(-1) : files;
}

export function buildToolPayload(
  form: ToolPayloadFormState,
  options: BuildToolPayloadOptions = {},
): ToolRequest {
  const isEdit = options.isEdit === true;
  const enabled = options.enabled ?? false;
  const payload: ToolRequest = {
    desc: form.description,
    description: form.description,
    name: form.name.trim(),
  };

  if (form.tool_type === 'WORKFLOW') {
    if (isEdit) return payload;
    const workFlow = workflowRecord(options.workflowValue);
    addCreateFields(payload, form, false);
    addToolType(payload, 'WORKFLOW');
    payload.code = 'None';
    const graphJson = normalizeJsonText(workFlow, '{}');
    payload.graphData = graphJson;
    payload.graph_data = graphJson;
    payload.work_flow = graphJson;
    return payload;
  }

  payload.code = form.code;
  payload.icon = form.icon;
  addToolType(payload, form.tool_type);
  if (!isEdit) addCreateFields(payload, form, enabled);

  if (form.tool_type === 'MCP') {
    payload.mcp_servers = form.code;
    return payload;
  }

  if (form.tool_type === 'SKILL') {
    addInitOnlyFields(payload, form);
    return payload;
  }

  addParamFields(payload, form);
  return payload;
}
