import type { Directive, DirectiveBinding } from 'vue';

const FORBIDDEN_TAGS =
  /<\s*(?:script|iframe|object|embed|link|meta|base|form)[\s\S]*?>/gi;
const FORBIDDEN_ATTR = /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const FORBIDDEN_PROTOCOL = /(?:javascript|vbscript|data)\s*:/gi;

function sanitize(html: string): string {
  if (!html) return '';
  return html
    .replaceAll(FORBIDDEN_TAGS, '')
    .replaceAll(FORBIDDEN_ATTR, '')
    .replaceAll(FORBIDDEN_PROTOCOL, '');
}

function update(el: HTMLElement, binding: DirectiveBinding<string>) {
  const raw = binding.value ?? '';
  const isTrustedSvg =
    raw.trim().startsWith('<svg') || raw.trim().startsWith('<?xml');
  el.innerHTML = isTrustedSvg ? raw : sanitize(raw);
}

export const vSafeHtml: Directive<HTMLElement, string> = {
  mounted: update,
  updated: update,
};
