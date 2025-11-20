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
      field: 'post',
      title: $t('user.sysuser.post'),
      slots: { default: 'post' },
    },
    {
      field: 'role',
      title: $t('user.sysuser.role'),
      slots: { default: 'role' },
    },
    {
      field: 'lockFlag',
      title: $t('user.sysuser.lockFlag'),
      slots: { default: 'lockFlag' },
    },
    {
      field: 'action',
      fixed: 'right',
      slots: { default: 'action' },
      title: $t('page.common.action'),
      width: 150,
    },
  ];
}

export const querySchema = [
  {
    component: 'Input',
    componentProps: {
      clearable: true,
      placeholder: $t('user.sysuser.inputUsernameTip'),
    },
    fieldName: 'username',
    label: $t('user.sysuser.username'),
  },
  {
    component: 'Input',
    componentProps: {
      clearable: true,
      placeholder: $t('user.sysuser.inputPhoneTip'),
    },
    fieldName: 'phone',
    label: $t('user.sysuser.phone'),
  },
];
