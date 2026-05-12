import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Auth/LoginView.vue'),
      meta: { guestOnly: true }
    },
    {
      path: '/register',
      name: 'Register',
      component: () => import('@/views/Auth/RegisterView.vue'),
      meta: { guestOnly: true }
    },
    {
      path: '/forgot-password',
      name: 'ForgotPassword',
      component: () => import('@/views/Auth/ForgotPasswordView.vue'),
      meta: { guestOnly: true }
    },
    {
      path: '/',
      component: MainLayout,
      meta: { requiresAuth: true },
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
          component: () => import('@/views/Assets/MyWorksView.vue')
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
          component: () => import('@/views/Learning/AcademyView.vue')
        },
        {
          path: 'members',
          name: 'Members',
          component: () => import('@/views/Community/MembersView.vue')
        },
        {
          path: 'projects',
          name: 'Projects',
          component: () => import('@/views/Assets/ProjectsView.vue')
        },
        {
          path: 'team/:id',
          name: 'TeamDetail',
          component: () => import('@/views/Community/TeamDetailView.vue')
        },
        {
          path: 'materials',
          name: 'Materials',
          component: () => import('@/views/Assets/MaterialsView.vue')
        },
        {
          path: 'messages',
          name: 'Messages',
          component: () => import('@/views/Community/MessagesView.vue')
        },
        {
          path: 'showcase',
          name: 'Showcase',
          component: () => import('@/views/Community/ShowcaseView.vue')
        },
        {
          path: 'settings',
          name: 'Settings',
          component: () => import('@/views/Settings/SettingsView.vue')
        },
        {
          path: 'report-bug',
          name: 'ReportBug',
          component: () => import('@/views/Support/ReportBugView.vue')
        },
        {
          path: 'academy/player/:id',
          name: 'AcademyPlayer',
          component: () => import('@/views/Learning/AcademyPlayerView.vue')
        },
        // Admin Routes
        {
          path: 'admin/dashboard',
          name: 'AdminDashboard',
          component: () => import('@/views/Admin/AdminDashboardView.vue'),
          meta: { requiresAdmin: true }
        },
        {
          path: 'admin/users',
          name: 'AdminUsers',
          component: () => import('@/views/Admin/UsersView.vue'),
          meta: { requiresAdmin: true }
        },
        {
          path: 'admin/feedback',
          name: 'AdminFeedback',
          component: () => import('@/views/Admin/FeedbackView.vue'),
          meta: { requiresAdmin: true }
        },
        {
          path: 'admin/assets',
          name: 'AdminAssets',
          component: () => import('@/views/Admin/AdminAssetsView.vue'),
          meta: { requiresAdmin: true }
        },
        {
          path: 'admin/roadmaps',
          name: 'AdminRoadmaps',
          component: () => import('@/views/Admin/AdminRoadmapsView.vue'),
          meta: { requiresAdmin: true }
        },
        {
          path: 'admin/courses',
          name: 'AdminCourses',
          component: () => import('@/views/Admin/AdminCoursesView.vue'),
          meta: { requiresAdmin: true }
        },
        {
          path: 'admin/teams',
          name: 'AdminTeams',
          component: () => import('@/views/Admin/AdminTeamsView.vue'),
          meta: { requiresAdmin: true }
        },
        {
          path: 'admin/audits',
          name: 'AdminAudits',
          component: () => import('@/views/Admin/AdminAuditsView.vue'),
          meta: { requiresAdmin: true }
        },
        {
          path: 'admin/settings',
          name: 'AdminSettings',
          component: () => import('@/views/Admin/AdminSettingsView.vue'),
          meta: { requiresAdmin: true }
        }
      ]
    }
  ]
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  const token = localStorage.getItem('token')

  // If we have a token but no user, or if we just want to ensure the session is fresh
  if (token && !authStore.user) {
    await authStore.fetchMe()
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'Login' }
  } 
  
  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return { name: 'Dashboard' }
  }

  if (to.meta.requiresAdmin && authStore.user?.role !== 'ADMIN') {
    return { name: 'Dashboard' }
  }
})

export default router
