import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { $t } from '#/locales';

export function useColumns(): VxeTableGridOptions['columns'] {
  return [
    { align: 'center', type: 'checkbox', width: 40 },
    { title: $t('user.sysuser.index'), type: 'seq', width: 50 },
    { field: 'username', title: $t('user.sysuser.username') },
    { field: 'nickname', title: $t('user.sysuser.nickname') },
    { field: 'phone', title: $t('user.sysuser.phone') },
    {
      field: 'role',
      title: $t('user.sysuser.role'),
      slots: { default: 'role' },
    },
    {
      field: 'action',
      fixed: 'right',
      slots: { default: 'action' },
      title: $t('page.common.action'),
      width: 200,
    },
  ];
}
