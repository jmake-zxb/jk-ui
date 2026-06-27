export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeUrl(url: string) {
  const trimmed = url.trim();
  if (/^(?:https?:|mailto:|\/|#)/i.test(trimmed)) return escapeHtml(trimmed);
  return '#';
}

function inlineMarkdown(value: string) {
  return value
    .replaceAll(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (_match, alt: string, url: string) => {
        return `<img src="${safeUrl(url)}" alt="${escapeHtml(alt)}" />`;
      },
    )
    .replaceAll(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_match, text: string, url: string) => {
        return `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
      },
    )
    .replaceAll(/`([^`]+)`/g, '<code>$1</code>')
    .replaceAll(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replaceAll(/__([^_]+)__/g, '<strong>$1</strong>')
    .replaceAll(/\*([^*]+)\*/g, '<em>$1</em>')
    .replaceAll(/_([^_]+)_/g, '<em>$1</em>');
}

export function renderMarkdown(source = '') {
  const lines = source.replaceAll('\r\n', '\n').split('\n');
  const html: string[] = [];
  let inCode = false;
  let codeLang = '';
  let codeLines: string[] = [];
  let paragraph: string[] = [];
  let inList = false;

  function flushParagraph() {
    if (paragraph.length === 0) return;
    html.push(`<p>${inlineMarkdown(paragraph.join('<br />'))}</p>`);
    paragraph = [];
  }

  function closeList() {
    if (!inList) return;
    html.push('</ul>');
    inList = false;
  }

  function flushCode() {
    html.push(
      `<pre><code${codeLang ? ` class="language-${escapeHtml(codeLang)}"` : ''}>${escapeHtml(codeLines.join('\n'))}</code></pre>`,
    );
    codeLines = [];
    codeLang = '';
  }

  for (const rawLine of lines) {
    const fence = rawLine.match(/^```\s*(?:(\w+)\s*)?$/);
    if (fence) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        closeList();
        inCode = true;
        codeLang = fence[1] || '';
      }
      continue;
    }

    if (inCode) {
      codeLines.push(rawLine);
      continue;
    }

    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(\S.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1]?.length ?? 2;
      html.push(
        `<h${level}>${inlineMarkdown(escapeHtml(heading[2] || ''))}</h${level}>`,
      );
      continue;
    }

    const listItem = line.match(/^[-*+]\s+(\S.+)$/);
    if (listItem) {
      flushParagraph();
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${inlineMarkdown(escapeHtml(listItem[1] || ''))}</li>`);
      continue;
    }

    if (line.startsWith('> ')) {
      flushParagraph();
      closeList();
      html.push(
        `<blockquote>${inlineMarkdown(escapeHtml(line.slice(2)))}</blockquote>`,
      );
      continue;
    }

    paragraph.push(escapeHtml(line));
  }

  if (inCode) flushCode();
  flushParagraph();
  closeList();
  return html.join('\n');
}

export function parseJsonLike(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}
