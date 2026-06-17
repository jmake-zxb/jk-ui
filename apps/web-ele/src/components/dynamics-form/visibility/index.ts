export type CompareOptions =
  | 'contain'
  | 'eq'
  | 'ge'
  | 'gt'
  | 'is_not_true'
  | 'is_true'
  | 'le'
  | 'lt'
  | 'not_contain'
  | 'not_eq';

export interface VisibilityCondition {
  _left?: any;
  compare: '' | CompareOptions;
  field: [string, string];
  id: string;
  value: any;
}

export interface VisibilityRules {
  action: 'hide' | 'show';
  condition: 'and' | 'or';
  conditions: VisibilityCondition[];
  node_id?: string;
  node_name?: string;
}

export interface VisibilityCtx {
  currentNodeId: string;
  currentNodeName: string;
  formValue: Record<string, any>;
}

export function resolveValue(raw: string, ctx: VisibilityCtx): string {
  return raw.replaceAll(
    /\{\{([^.\s}]+)\.([^.\s}]+)\}\}/g,
    (match, nodeName, fieldName) => {
      if (nodeName !== ctx.currentNodeName) {
        return match;
      }
      const v = ctx.formValue?.[fieldName];
      return v === null || v === undefined ? match : String(v);
    },
  );
}

export function lookupLeft(cond: VisibilityCondition, ctx: VisibilityCtx): any {
  const scope = cond.field[0] === 'global' ? 'base-node' : cond.field[0];
  if (scope === ctx.currentNodeId) {
    return ctx.formValue?.[cond.field[1]];
  }
  return (cond as any)._left;
}

type CmpFn = (left: any, right: any) => boolean;

function containImpl(source: any, target: any): boolean {
  if (Array.isArray(target)) {
    return target.every((t) => containImpl(source, t));
  }
  const t = String(target);
  if (typeof source === 'string') return source.includes(t);
  if (Array.isArray(source)) return source.some((item) => String(item) === t);
  return String(source).includes(t);
}

function numOrStrCmp(
  left: any,
  right: any,
  numFn: (a: number, b: number) => boolean,
  strFn: (a: string, b: string) => boolean,
): boolean {
  const a = Number(left);
  const b = Number(right);
  if (!Number.isNaN(a) && !Number.isNaN(b)) return numFn(a, b);
  try {
    return strFn(String(left), String(right));
  } catch {
    return false;
  }
}

const compareHandlers: Record<CompareOptions, CmpFn> = {
  eq: (l, r) => String(l) === String(r),
  not_eq: (l, r) => String(l) !== String(r),
  contain: (l, r) => containImpl(l, r),
  not_contain: (l, r) => !containImpl(l, r),
  is_true: (l) => l === true,
  is_not_true: (l) => l !== true,
  gt: (l, r) =>
    numOrStrCmp(
      l,
      r,
      (a, b) => a > b,
      (a, b) => a > b,
    ),
  ge: (l, r) =>
    numOrStrCmp(
      l,
      r,
      (a, b) => a >= b,
      (a, b) => a >= b,
    ),
  lt: (l, r) =>
    numOrStrCmp(
      l,
      r,
      (a, b) => a < b,
      (a, b) => a < b,
    ),
  le: (l, r) =>
    numOrStrCmp(
      l,
      r,
      (a, b) => a <= b,
      (a, b) => a <= b,
    ),
};

export function compareByOp(
  left: any,
  op: CompareOptions,
  right: any,
): boolean {
  const fn = compareHandlers[op];
  if (!fn) throw new Error(`Unknown compare op: ${op}`);
  return fn(left, right);
}

export function evaluateVisibility(
  rules: null | undefined | VisibilityRules,
  ctx: VisibilityCtx,
): boolean {
  if (!rules || !rules.conditions || rules.conditions.length === 0) {
    return true;
  }

  const results = rules.conditions.map((cond) => {
    const left = lookupLeft(cond, ctx);
    if (
      (left === null || left === undefined) &&
      cond.compare !== 'is_true' &&
      cond.compare !== 'is_not_true'
    ) {
      return false;
    }
    const right =
      typeof cond.value === 'string'
        ? resolveValue(cond.value, ctx)
        : cond.value;
    return compareByOp(left, cond.compare as CompareOptions, right);
  });

  const matched =
    rules.condition === 'or' ? results.some(Boolean) : results.every(Boolean);

  return rules.action === 'show' ? matched : !matched;
}

export function computeVisibilityMap(
  fields: Array<{ field: string; visibility_rules?: VisibilityRules }>,
  formValue: Record<string, any>,
): Record<string, boolean> {
  const copy: Record<string, any> = { ...formValue };
  const map: Record<string, boolean> = {};

  for (const f of fields) {
    if (!f.visibility_rules?.node_id) {
      map[f.field] = true;
      continue;
    }
    const visible = evaluateVisibility(f.visibility_rules, {
      formValue: copy,
      currentNodeId: f.visibility_rules.node_id,
      currentNodeName: f.visibility_rules.node_name || '',
    });
    map[f.field] = visible;
    if (!visible) {
      copy[f.field] = null;
    }
  }
  return map;
}
