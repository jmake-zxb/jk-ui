import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { $t } from '#/locales';

export function useColumns(): VxeTableGridOptions['columns'] {
  return [
    { align: 'center', type: 'checkbox', width: 40 },
    { title: '序号', type: 'seq', width: 50 },
    { field: 'fileName', title: '文件名称' },
    { field: 'charCount', title: '字符数', slots: { default: 'charCount' } },
    { field: 'chunkCount', title: '分段' },
    {
      field: 'enabled',
      title: '启用状态',
      slots: { default: 'enabled' },
    },
    { field: 'createdAt', title: '创建时间' },
    { field: 'updatedAt', title: '更新时间' },
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
      placeholder: '请输入文件名称',
    },
    fieldName: 'fileName',
    label: '文件名称',
  },
];

export function useRulerColumns(): VxeTableGridOptions['columns'] {
  return [
    { align: 'center', type: 'checkbox', width: 40 },
    { title: '序号', type: 'seq', width: 50 },
    { field: 'ruleName', title: '规则名称' },
    { field: 'tabName', title: '数据源表' },
    { field: 'conditionSql', title: '规则' },
    {
      field: 'conditionDescription',
      title: '规则说明',
    },
    { field: 'createdAt', title: '创建时间' },
    { field: 'updatedAt', title: '更新时间' },
    {
      field: 'action',
      fixed: 'right',
      slots: { default: 'action' },
      title: $t('page.common.action'),
      width: 150,
    },
  ];
}

export const queryRulerSchema = [
  {
    component: 'Input',
    componentProps: {
      clearable: true,
      placeholder: '请输入文件名称',
    },
    fieldName: 'fileName',
    label: '文件名称',
  },
];
