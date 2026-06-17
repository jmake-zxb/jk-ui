import { describe, expect, it } from 'vitest';

import { isGraphDirty, normalizeGraphSnapshot } from './dirty-state';

/**
 * 返回未保存改动检测测试。
 *
 * 对齐 MaxKB 编辑器「离开前确认未保存改动」语义:
 * - 保存时记录快照,离开时与当前图比对。
 * - 比对忽略 JSON 格式差异(空白/缩进)与对象键顺序。
 * - 只比对结构(nodes/edges 语义),不受 prettyJson 重排影响。
 */

describe('normalizeGraphSnapshot', () => {
  it('produces identical output regardless of whitespace/indent', () => {
    const a = '{"nodes":[{"id":"n1"}],"edges":[]}';
    const b = '{\n  "nodes": [\n    { "id": "n1" }\n  ],\n  "edges": []\n}';

    expect(normalizeGraphSnapshot(a)).toBe(normalizeGraphSnapshot(b));
  });

  it('produces identical output regardless of object key order', () => {
    const a = '{"nodes":[{"id":"n1","type":"start-node"}],"edges":[]}';
    const b = '{"edges":[],"nodes":[{"type":"start-node","id":"n1"}]}';

    expect(normalizeGraphSnapshot(a)).toBe(normalizeGraphSnapshot(b));
  });

  it('returns a stable string for malformed JSON (falls back to raw)', () => {
    expect(normalizeGraphSnapshot('not-json{{{')).toBe('not-json{{{');
  });
});

describe('isGraphDirty', () => {
  it('returns false when saved snapshot equals current (ignoring format)', () => {
    const saved = '{"nodes":[{"id":"n1"}],"edges":[]}';
    const current = '{\n  "nodes": [{ "id": "n1" }],\n  "edges": []\n}';

    expect(isGraphDirty(saved, current)).toBe(false);
  });

  it('returns false when only key order differs', () => {
    const saved = '{"nodes":[{"id":"n1","x":1}],"edges":[]}';
    const current = '{"edges":[],"nodes":[{"x":1,"id":"n1"}]}';

    expect(isGraphDirty(saved, current)).toBe(false);
  });

  it('returns true when a node is added', () => {
    const saved = '{"nodes":[{"id":"n1"}],"edges":[]}';
    const current = '{"nodes":[{"id":"n1"},{"id":"n2"}],"edges":[]}';

    expect(isGraphDirty(saved, current)).toBe(true);
  });

  it('returns true when a node property value changes', () => {
    const saved = '{"nodes":[{"id":"n1","x":1}],"edges":[]}';
    const current = '{"nodes":[{"id":"n1","x":2}],"edges":[]}';

    expect(isGraphDirty(saved, current)).toBe(true);
  });

  it('returns true when an edge is removed', () => {
    const saved = '{"nodes":[],"edges":[{"id":"e1"}]}';
    const current = '{"nodes":[],"edges":[]}';

    expect(isGraphDirty(saved, current)).toBe(true);
  });

  it('treats an empty saved snapshot as not dirty (no baseline yet)', () => {
    expect(isGraphDirty('', '{"nodes":[],"edges":[]}')).toBe(false);
  });

  it('returns true when current differs from a non-empty baseline', () => {
    expect(
      isGraphDirty(
        '{"nodes":[],"edges":[]}',
        '{"nodes":[{"id":"x"}],"edges":[]}',
      ),
    ).toBe(true);
  });
});
