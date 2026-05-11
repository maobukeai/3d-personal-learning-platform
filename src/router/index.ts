import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: MainLayout,
      children: [
        {
          path: '',
          redirect: '/assets'
        },
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('@/views/Dashboard/DashboardView.vue')
        },
        {
          path: 'assets',
          name: 'Assets',
          component: () => import('@/views/Assets/AssetsView.vue')
        },
        {
          path: 'my-works',
          name: 'MyWorks',
          component: () => import('@/views/Assets/AssetsView.vue')
        },
        {
          path: 'work',
          name: 'TaskBoard',
          component: () => import('@/views/Tasks/TaskBoard.vue')
        },
        {
          path: 'team-tasks',
          name: 'TeamTasks',
          component: () => import('@/views/Tasks/TaskBoard.vue')
        },
        {
          path: 'discussions',
          name: 'Discussions',
          component: () => import('@/views/Community/DiscussionsView.vue')
        },
        {
          path: 'roadmaps',
          name: 'Roadmaps',
          component: () => import('@/views/Learning/RoadmapsView.vue')
        },
        {
          path: 'academy',
          name: 'Academy',
          component: () => import('@/views/Assets/AssetsView.vue')
        },
        {
          path: 'members',
          name: 'Members',
          component: () => import('@/views/Community/DiscussionsView.vue')
        },
        {
          path: 'projects',
          name: 'Projects',
          component: () => import('@/views/Assets/AssetsView.vue')
        },
        {
          path: 'materials',
          name: 'Materials',
          component: () => import('@/views/Assets/AssetsView.vue')
        },
        {
          path: 'messages',
          name: 'Messages',
          component: () => import('@/views/Community/DiscussionsView.vue')
        },
        {
          path: 'showcase',
          name: 'Showcase',
          component: () => import('@/views/Community/DiscussionsView.vue')
        }
      ]
    }
  ]
})

export default router
