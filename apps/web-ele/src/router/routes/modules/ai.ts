import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:bot',
      order: 20,
      title: 'AI 编排',
    },
    name: 'AiOrchestration',
    path: '/ai/orchestration',
    children: [
      {
        component: () => import('#/views/ai/orchestration/dashboard/index.vue'),
        meta: {
          icon: 'lucide:gauge',
          title: '仪表盘',
        },
        name: 'AiOrchestrationDashboard',
        path: '/ai/orchestration/dashboard/index',
      },
      {
        component: () =>
          import('#/views/ai/orchestration/applications/index.vue'),
        meta: {
          icon: 'lucide:blocks',
          title: '应用',
        },
        name: 'AiOrchestrationApplications',
        path: '/ai/orchestration/applications/index',
      },
      {
        component: () =>
          import('#/views/ai/orchestration/applications/detail/index.vue'),
        meta: {
          hideInMenu: true,
          title: '应用详情',
        },
        name: 'AiOrchestrationApplicationDetail',
        path: '/ai/orchestration/applications/detail',
      },
      {
        component: () => import('#/views/ai/orchestration/knowledge/index.vue'),
        meta: {
          icon: 'lucide:database',
          title: '知识库',
        },
        name: 'AiOrchestrationKnowledge',
        path: '/ai/orchestration/knowledge/index',
      },
      {
        component: () => import('#/views/ai/orchestration/knowledge/index.vue'),
        meta: {
          hideInMenu: true,
          title: '知识库详情',
        },
        name: 'AiOrchestrationKnowledgeDetail',
        path: '/ai/orchestration/knowledge/detail',
      },
      {
        component: () => import('#/views/ai/orchestration/tools/index.vue'),
        meta: {
          icon: 'lucide:wrench',
          title: '工具',
        },
        name: 'AiOrchestrationTools',
        path: '/ai/orchestration/tools/index',
      },
      {
        component: () => import('#/views/ai/orchestration/models/index.vue'),
        meta: {
          icon: 'lucide:brain-circuit',
          title: '模型',
        },
        name: 'AiOrchestrationModels',
        path: '/ai/orchestration/models/index',
      },
      {
        component: () => import('#/views/ai/orchestration/resources/index.vue'),
        meta: {
          icon: 'lucide:folder-tree',
          title: '资源',
        },
        name: 'AiOrchestrationResources',
        path: '/ai/orchestration/resources/index',
      },
      {
        component: () => import('#/views/ai/orchestration/triggers/index.vue'),
        meta: {
          icon: 'lucide:radio-tower',
          title: '触发器',
        },
        name: 'AiOrchestrationTriggers',
        path: '/ai/orchestration/triggers/index',
      },
      {
        component: () => import('#/views/ai/orchestration/workflow/index.vue'),
        meta: {
          hideInMenu: true,
          title: '工作流设计',
        },
        name: 'AiOrchestrationWorkflow',
        path: '/ai/orchestration/workflow/index',
      },
      {
        component: () =>
          import('#/views/ai/orchestration/public-chat/index.vue'),
        meta: {
          hideInMenu: true,
          title: '公开聊天',
        },
        name: 'AiOrchestrationPublicChat',
        path: '/ai/orchestration/public-chat/index',
      },
    ],
  },
];

export default routes;
