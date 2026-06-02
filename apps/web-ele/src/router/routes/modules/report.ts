import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/report',
    name: 'report',
    component: () => import('#/views/ai/mf-project-info/analysis/report.vue'),
    meta: {
      title: '独立页面',
      noBasicLayout: true,
      openInNewWindow: true,
    },
  },
];

export default routes;
