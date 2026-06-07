import type { AiPage, AiRecord } from '#/api/ai/types';

export function recordsOf<T = AiRecord>(page?: AiPage<T> | any | T[]): T[] {
  if (Array.isArray(page)) return page;
  return page?.records || page?.items || [];
}

export function totalOf(page?: AiPage | any) {
  const total = page?.total;
  if (total) return Number(total);
  const recordCount = recordsOf(page).length;
  return Number(Math.max(recordCount, 0));
}

export function prettyJson(value: any, fallback = '{}') {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

export function safeParseJson(text: string, fallback: any) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export function enabledText(enabled?: boolean) {
  return enabled === false ? '停用' : '启用';
}

export function statusType(status?: string) {
  const value = `${status || ''}`.toUpperCase();
  if (['COMPLETED', 'ONLINE', 'PUBLISHED', 'SUCCESS'].includes(value)) {
    return 'success';
  }
  if (['CANCELLED', 'ERROR', 'FAILED'].includes(value)) return 'danger';
  if (['DRAFT', 'PENDING', 'RUNNING'].includes(value)) return 'warning';
  return 'info';
}
