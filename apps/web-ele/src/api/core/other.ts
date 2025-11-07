import { ElMessage } from 'element-plus';

import { requestClient } from '#/api/request';

export function downBlobFile(url: any, query: any, fileName: string) {
  return requestClient
    .download(url, { params: query, responseType: 'blob' })
    .then((response) => {
      handleBlobFile(response, fileName);
    });
}

// eslint-disable-next-line jsdoc/require-returns-check
/**
 * 处理 Blob 文件下载
 * @param response 响应内容
 * @param fileName 文件名称
 * @returns void
 */
export function handleBlobFile(response: any, fileName: string) {
  // 处理返回的文件流
  const blob = response;
  if (blob && blob.size === 0) {
    ElMessage.error('内容为空，无法下载');
    return;
  }
  const link = document.createElement('a');

  // 兼容一下 入参不是 File Blob 类型情况
  const binaryData = [] as any;
  binaryData.push(response);
  link.href = window.URL.createObjectURL(new Blob(binaryData));
  link.download = fileName;
  document.body.append(link);
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(blob);
    link.remove();
  }, 0);
}
