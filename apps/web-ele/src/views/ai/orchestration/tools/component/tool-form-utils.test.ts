import type { ToolPayloadFormState } from './tool-form-utils';

import { describe, expect, it } from 'vitest';

import {
  buildToolPayload,
  defaultCodeForToolType,
  isValidMcpServerConfigJson,
  keepLatestSkillZipFiles,
  MAX_SKILL_ZIP_FILE_SIZE_BYTES,
  supportsToolAiGenerate,
  validateSkillZipFile,
} from './tool-form-utils';

function formOf(
  overrides: Partial<ToolPayloadFormState> = {},
): ToolPayloadFormState {
  const form: ToolPayloadFormState = {
    code: '',
    description: '描述',
    folder_id: 'folder-1',
    icon: '',
    init_field_list: [],
    init_params: '{}',
    input_field_list: [],
    name: '  demo tool  ',
    tool_type: 'CUSTOM',
    workspace_id: 'default',
  };

  return { ...form, ...overrides };
}

describe('tool type defaults', () => {
  it('uses the MaxKB data source Python template and excludes data source AI generation', () => {
    const code = defaultCodeForToolType('DATA_SOURCE');

    expect(code).toContain('def get_form_list');
    expect(code).toContain('def download');
    expect(supportsToolAiGenerate('DATA_SOURCE')).toBe(false);
    expect(supportsToolAiGenerate('CUSTOM')).toBe(true);
  });

  it('requires MCP server config to be a non-empty JSON object with server entries', () => {
    expect(isValidMcpServerConfigJson('{"math":{"transport":"sse"}}')).toBe(
      true,
    );
    expect(isValidMcpServerConfigJson('{}')).toBe(false);
    expect(isValidMcpServerConfigJson('{"math":{}}')).toBe(false);
    expect(isValidMcpServerConfigJson('{"math":[]}')).toBe(false);
    expect(isValidMcpServerConfigJson('{"":{"transport":"sse"}}')).toBe(false);
    expect(isValidMcpServerConfigJson('[]')).toBe(false);
    expect(isValidMcpServerConfigJson('')).toBe(false);
  });
});

describe('skill ZIP upload helpers', () => {
  it('accepts a non-empty .zip file at the 100MB limit', () => {
    expect(
      validateSkillZipFile({
        name: 'skill.ZIP',
        size: MAX_SKILL_ZIP_FILE_SIZE_BYTES,
      }).valid,
    ).toBe(true);
  });

  it('rejects non-zip, empty, and oversized files', () => {
    expect(validateSkillZipFile({ name: 'skill.txt', size: 1 }).valid).toBe(
      false,
    );
    expect(validateSkillZipFile({ name: 'skill.zip', size: 0 }).valid).toBe(
      false,
    );
    expect(
      validateSkillZipFile({
        name: 'skill.zip',
        size: MAX_SKILL_ZIP_FILE_SIZE_BYTES + 1,
      }).valid,
    ).toBe(false);
  });

  it('keeps only the latest selected skill ZIP file', () => {
    const oldFile = { name: 'old.zip' };
    const latestFile = { name: 'latest.zip' };

    expect(keepLatestSkillZipFiles([oldFile, latestFile])).toEqual([
      latestFile,
    ]);
    expect(keepLatestSkillZipFiles([latestFile])).toEqual([latestFile]);
  });
});

describe('buildToolPayload', () => {
  it('creates workflow tools with MaxKB-compatible defaults and current folder', () => {
    const payload = buildToolPayload(formOf({ tool_type: 'WORKFLOW' }), {
      isEdit: false,
      workflowValue: '{}',
    });

    expect(payload).toMatchObject({
      code: 'None',
      folder_id: 'folder-1',
      graphData: '{}',
      graph_data: '{}',
      name: 'demo tool',
      toolType: 'WORKFLOW',
      tool_type: 'WORKFLOW',
      work_flow: '{}',
      workspace_id: 'default',
    });
    expect(payload.work_flow).toBe(payload.graphData);
    expect(payload).not.toHaveProperty('input_field_list');
    expect(payload).not.toHaveProperty('init_field_list');
  });

  it('edits workflow tools with base fields only', () => {
    const payload = buildToolPayload(
      formOf({ code: 'stale-code', tool_type: 'WORKFLOW' }),
      { isEdit: true, workflowValue: { nodes: [] } },
    );

    expect(payload).toEqual({
      desc: '描述',
      description: '描述',
      name: 'demo tool',
    });
  });

  it('sends MCP server config through code and mcp_servers without param tables', () => {
    const mcpServers =
      '{"math":{"transport":"sse","url":"https://mcp.example/sse"}}';
    const payload = buildToolPayload(
      formOf({
        code: mcpServers,
        init_field_list: [{ field: 'api_key' }],
        input_field_list: [{ name: 'query' }],
        tool_type: 'MCP',
      }),
      { isEdit: false },
    );

    expect(payload.code).toBe(mcpServers);
    expect(payload.mcp_servers).toBe(mcpServers);
    expect(payload.tool_type).toBe('MCP');
    expect(payload).not.toHaveProperty('input_field_list');
    expect(payload).not.toHaveProperty('init_field_list');
  });

  it('keeps skill payloads to init params and uploaded file id', () => {
    const payload = buildToolPayload(
      formOf({
        code: 'file-42',
        init_field_list: [{ field: 'token', required: true }],
        input_field_list: [{ name: 'query' }],
        tool_type: 'SKILL',
      }),
      { isEdit: false },
    );

    expect(payload.code).toBe('file-42');
    expect(payload.input_field_list).toBe('[]');
    expect(JSON.parse(`${payload.init_field_list}`)).toEqual([
      { field: 'token', required: true },
    ]);
  });
});
