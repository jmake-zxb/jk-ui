import { ElMessage } from 'element-plus';

import { $t } from '#/locales';

/*
  复制粘贴
*/
export async function copyClick(info: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(info);
    } else {
      // Fallback for older browsers or non-secure contexts
      const textArea = document.createElement('textarea');
      textArea.value = info;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.append(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
    }
    ElMessage.success($t('common.copySuccess'));
  } catch (error) {
    console.error(error);
    ElMessage.error($t('common.copyError'));
  }
}
