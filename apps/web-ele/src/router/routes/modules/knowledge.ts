import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:database',
      order: 21,
      title: '知识库',
    },
    name: 'Knowledge',
    path: '/knowledge',
    children: [
      {
        component: () => import('#/views/ai/orchestration/knowledge/index.vue'),
        meta: {
          title: '知识库',
        },
        name: 'KnowledgeIndex',
        path: '/knowledge',
      },
      {
        component: () => import('#/views/ai/orchestration/knowledge/index.vue'),
        meta: {
          hideInMenu: true,
          title: '知识库详情',
        },
        name: 'KnowledgeDetail',
        path: '/knowledge/:id/:folderId/:type/:tab(document|problem|termbase|hit-test|setting)',
        props: true,
      },
      {
        component: () =>
          import('#/views/ai/orchestration/knowledge/transform/index.vue'),
        meta: {
          hideInMenu: true,
          title: '转换为工作流知识库',
        },
        name: 'KnowledgeWorkflowSetting',
        path: '/knowledge/:id/:folderId/:type/knowledge-workflow-setting',
        props: true,
      },
      {
        component: () =>
          import('#/views/ai/orchestration/knowledge/workflow/index.vue'),
        meta: {
          hideInMenu: true,
          title: '知识库工作流',
        },
        name: 'KnowledgeWorkflow',
        path: '/knowledge/:id/:folderId/workflow',
        props: true,
      },
      {
        component: () =>
          import('#/views/ai/orchestration/knowledge/upload/UploadDocument.vue'),
        meta: {
          hideInMenu: true,
          title: '上传文档',
        },
        name: 'KnowledgeUpload',
        path: '/knowledge/upload/:folderId/:type',
        props: true,
      },
      {
        component: () =>
          import('#/views/ai/orchestration/knowledge/workflow-import/index.vue'),
        meta: {
          hideInMenu: true,
          title: '导入工作流文档',
        },
        name: 'KnowledgeImportWorkflow',
        path: '/knowledge/import/workflow/:folderId',
        props: true,
      },
    ],
  },
];

export default routes;
