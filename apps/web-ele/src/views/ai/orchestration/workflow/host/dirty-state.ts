/**
 * 工作流编辑器「未保存改动」检测（纯逻辑，可独立单测）。
 *
 * 对齐 MaxKB 编辑器离开前确认未保存改动的语义：
 * - 保存时记录快照，离开时与当前图比对。
 * - 比对忽略 JSON 格式差异（空白/缩进）与对象键顺序，只比对结构语义。
 * - 空快照视为尚无基线（不脏）。
 */

/** 递归按键排序，消除对象键顺序差异。 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortKeysDeep(item));
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).toSorted()) {
      sorted[key] = sortKeysDeep(source[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * 将图 JSON 归一化为稳定字符串：键深度排序 + 紧凑序列化。
 * 畸形 JSON 回退原始字符串（保证幂等可比）。
 */
export function normalizeGraphSnapshot(raw: string): string {
  if (raw === null || raw === undefined) {
    return '';
  }
  try {
    return JSON.stringify(sortKeysDeep(JSON.parse(raw)));
  } catch {
    return raw;
  }
}

/**
 * 当前图相对已保存快照是否有未保存改动。
 * 空快照视为尚无基线 → 不脏。
 */
export function isGraphDirty(savedSnapshot: string, current: string): boolean {
  if (!savedSnapshot || !savedSnapshot.trim()) {
    return false;
  }
  return (
    normalizeGraphSnapshot(savedSnapshot) !== normalizeGraphSnapshot(current)
  );
}
