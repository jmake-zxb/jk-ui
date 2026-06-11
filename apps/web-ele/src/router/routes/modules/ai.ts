import type { RouteRecordRaw } from 'vue-router';

function queryString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

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
          hideInMenu: true,
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
          title: '智能体',
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
          hideInMenu: true,
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
        component: () =>
          import('#/views/ai/orchestration/application-workflow/index.vue'),
        meta: {
          hideInMenu: true,
          title: '智能体工作流',
        },
        name: 'AiOrchestrationApplicationWorkflow',
        path: '/ai/orchestration/applications/:id/workflow',
        props: (route) => ({
          applicationId: route.params.id,
        }),
      },
      {
        component: () =>
          import('#/views/ai/orchestration/tool-workflow/index.vue'),
        meta: {
          hideInMenu: true,
          title: '工具工作流',
        },
        name: 'AiOrchestrationToolWorkflow',
        path: '/ai/orchestration/tools/:id/workflow',
        props: (route) => ({
          toolId: route.params.id,
        }),
      },
      {
        // Legacy routes for backward compatibility
        meta: {
          hideInMenu: true,
          title: '智能体工作流 (旧)',
        },
        name: 'AiOrchestrationAgentWorkflow',
        path: '/ai/orchestration/workflow/agent',
        redirect: (to) => ({
          name: 'AiOrchestrationApplicationWorkflow',
          params: { id: queryString(to.query.applicationId) },
        }),
      },
      {
        meta: {
          hideInMenu: true,
          title: '工具工作流 (旧)',
        },
        name: 'AiOrchestrationToolWorkflowLegacy',
        path: '/ai/orchestration/workflow/tool',
        redirect: (to) => ({
          name: 'AiOrchestrationToolWorkflow',
          params: { id: queryString(to.query.toolId) },
        }),
      },
      {
        // Backward-compat: legacy single workflow route. Redirects bookmarked
        // /ai/orchestration/workflow/index links to the split routes so the
        // migration is order-independent and external links keep working.
        meta: {
          hideInMenu: true,
          title: '工作流设计',
        },
        name: 'AiOrchestrationWorkflow',
        path: '/ai/orchestration/workflow/index',
        redirect: (to) =>
          to.query.toolId
            ? {
                name: 'AiOrchestrationToolWorkflow',
                query: { toolId: to.query.toolId },
              }
            : {
                name: 'AiOrchestrationAgentWorkflow',
                query: { applicationId: to.query.applicationId },
              },
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
