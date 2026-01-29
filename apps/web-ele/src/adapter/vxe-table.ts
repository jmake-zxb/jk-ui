import type { VxeTableGridOptions } from '@vben/plugins/vxe-table';

import { h } from 'vue';

import { setupVbenVxeTable, useVbenVxeGrid } from '@vben/plugins/vxe-table';

import { ElImage } from 'element-plus';

import DictTag from '#/component/DictTag/index.vue';

import { useVbenForm } from './form';

setupVbenVxeTable({
  configVxeTable: (vxeUI) => {
    vxeUI.setConfig({
      grid: {
        keepSource: false,
        border: true,
        columnConfig: {
          resizable: true,
        },
        height: 'auto',
        rowConfig: {
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

    // 表格配置项可以用 cellRender: { name: 'CellImage' },
    vxeUI.renderer.add('CellImage', {
      renderTableDefault(renderOpts, params) {
        const { column, row } = params;
        const { props } = renderOpts;
        return h(ElImage, {
          src: row[column.field],
          lazy: true,
          loading: 'lazy',
          previewSrcList: [row[column.field]],
          previewTeleported: true,
          style: { width: '50px', height: '50px' },
          ...props,
        });
      },
    });

    vxeUI.renderer.add('CellDictTag', {
      renderTableDefault(renderOpts, params) {
        const { column, row } = params;
        const { props } = renderOpts;
        return h(DictTag, {
          value: row[column.field],
          options: props?.options || [],
        });
      },
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
