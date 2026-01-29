export function filesize(size: number) {
  if (!size) return '';
  /* byte */
  const num = 1024;

  if (size < num) return `${size}B`;
  if (size < num ** 2) return `${(size / num).toFixed(2)}K`; // kb
  if (size < num ** 3) return `${(size / num ** 2).toFixed(2)}M`; // M
  if (size < num ** 4) return `${(size / num ** 3).toFixed(2)}G`; // G
  return `${(size / num ** 4).toFixed(2)}T`; // T
}

/*
  获取文件后缀
*/
export function fileType(name: string) {
  const suffix = name.split('.');
  if (!suffix) {
    return null;
  }
  return suffix[suffix.length - 1];
}

/**
 * 安全获取文件后缀（小写），若无有效后缀则返回 null
 */
export function getFileExtension(filename: string): null | string {
  if (!filename || typeof filename !== 'string') return null;
  const parts = filename.split('.');
  if (parts.length < 2 || !parts[parts.length - 1]) return null;
  // 可选：排除 .gitignore 这类隐藏文件作为“有后缀”
  if (parts.length === 2 && parts[0] === '') return null;
  return parts[parts.length - 1]?.toLowerCase() || null;
}

const typeList = {
  txt: ['txt', 'pdf', 'docx', 'md', 'html', 'zip', 'xlsx', 'xls', 'csv'],
  table: ['xlsx', 'xls', 'csv'],
  QA: ['xlsx', 'csv', 'xls', 'zip'],
} as const;

type Category = keyof typeof typeList;

const allValidExtensions = new Set(
  Object.values(typeList)
    .flat()
    .map((ext) => ext.toLowerCase()),
);

export function getImgUrl(name: string): string {
  const ext = getFileExtension(name);
  const type = ext && allValidExtensions.has(ext) ? ext : 'unknown';
  return `/static/fileType/${type}-icon.svg`;
}

export function isRightType(name: string, type: Category): boolean {
  const ext = getFileExtension(name);
  return ext !== null && (typeList[type] as readonly string[]).includes(ext);
}
