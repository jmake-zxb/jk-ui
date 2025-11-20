import type { VxeTableGridOptions } from '@vben/plugins/vxe-table';

import { setupVbenVxeTable, useVbenVxeGrid } from '@vben/plugins/vxe-table';

import { useVbenForm } from './form';

setupVbenVxeTable({
  configVxeTable: (vxeUI) => {
    vxeUI.setConfig({
      grid: {
        align: 'center',
        border: true,
        columnConfig: {
          resizable: true,
        },
        height: 'auto',
        rowConfig: {
          isCurrent: true,
          isHover: true,
        },
        formConfig: {
          // 全局禁用vxe-table的表单配置，使用formOptions
          enabled: false,
        },
        exportConfig: {
          excludeFields: ['action'],
        },
        pagerConfig: {
          pageSize: 20,
        },
        proxyConfig: {
          autoLoad: true,
          response: {
            result: 'records',
            total: 'total',
            list: 'items',
          },
          showActiveMsg: true,
          showResponseMsg: false,
        },
        round: true,
        showOverflow: true,
        size: 'small',
      } as VxeTableGridOptions,
    });

    // 创建一个简单的工具栏-右侧工具渲染
    // 自定义导出
    // vxeUI.renderer.add('JkExport', {
    //   renderToolbarTool(renderOpts, _renderParams) {
    //     return h(
    //       VbenIconButton,
    //       {
    //         tooltip: '导出',
    //         circle: true,
    //         variant: 'outline',
    //         onClick: renderOpts?.props?.onClick,
    //       },
    //       {
    //         default: () =>
    //           h(VbenIcon, { icon: 'ant-design:download-outlined' }),
    //       },
    //     );
    //   },
    // });

    // 这里可以自行扩展 vxe-table 的全局配置，比如自定义格式化
    // vxeUI.formats.add

    // 这里可以自定义替换图标
    // vxeUI.setIcon
  },
  useVbenForm,
});

export { useVbenVxeGrid };

export type * from '@vben/plugins/vxe-table';
