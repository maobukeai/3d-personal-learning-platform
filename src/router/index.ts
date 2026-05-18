import { createRouter, createWebHistory } from 'vue-router';
import MainLayout from '@/layouts/MainLayout.vue';
import { useAuthStore } from '@/stores/auth';
import { useSystemStore } from '@/stores/system';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/maintenance',
      name: 'Maintenance',
      component: () => import('@/views/Support/MaintenanceView.vue'),
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Auth/LoginView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/register',
      name: 'Register',
      component: () => import('@/views/Auth/RegisterView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/onboarding',
      name: 'Onboarding',
      component: () => import('@/views/Auth/OnboardingView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/forgot-password',
      name: 'ForgotPassword',
      component: () => import('@/views/Auth/ForgotPasswordView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/404',
      name: 'NotFound',
      component: () => import('@/views/Support/NotFoundView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/404',
    },
    {
      path: '/',
      component: MainLayout,
      children: [
        {
          path: '',
          redirect: '/academy',
        },
        {
          path: 'academy',
          name: 'Academy',
          component: () => import('@/views/Learning/AcademyView.vue'),
        },
        {
          path: 'academy/course/:id',
          name: 'CourseDetail',
          component: () => import('@/views/Learning/CourseDetailView.vue'),
        },
        {
          path: '',
          meta: { requiresAuth: true },
          children: [
            {
              path: 'dashboard',
              name: 'Dashboard',
              component: () => import('@/views/Dashboard/DashboardView.vue'),
            },
            {
              path: 'assets',
              name: 'Assets',
              component: () => import('@/views/Assets/AssetsView.vue'),
            },
            {
              path: 'my-works',
              name: 'MyWorks',
              component: () => import('@/views/Assets/MyWorksView.vue'),
            },
            {
              path: 'work',
              name: 'TaskBoard',
              component: () => import('@/views/Tasks/TaskBoard.vue'),
            },
            {
              path: 'team-tasks',
              name: 'TeamTasks',
              component: () => import('@/views/Tasks/TeamTasksView.vue'),
            },
            {
              path: 'discussions',
              name: 'Discussions',
              component: () => import('@/views/Community/DiscussionsView.vue'),
            },
            {
              path: 'roadmaps',
              name: 'Roadmaps',
              component: () => import('@/views/Learning/RoadmapsView.vue'),
            },
            {
              path: 'members',
              name: 'Members',
              component: () => import('@/views/Community/MembersView.vue'),
            },
            {
              path: 'projects',
              name: 'Projects',
              component: () => import('@/views/Assets/ProjectsView.vue'),
            },
            {
              path: 'project/:id',
              name: 'ProjectDetail',
              component: () => import('@/views/Assets/ProjectDetailView.vue'),
            },
            {
              path: 'team/:id',
              name: 'TeamDetail',
              component: () => import('@/views/Community/TeamDetailView.vue'),
            },
            {
              path: 'materials',
              name: 'Materials',
              component: () => import('@/views/Assets/MaterialsView.vue'),
            },
            {
              path: 'messages',
              name: 'Messages',
              component: () => import('@/views/Community/MessagesView.vue'),
            },
            {
              path: 'explore-teams',
              name: 'ExploreTeams',
              component: () => import('@/views/Community/ExploreTeamsView.vue'),
            },
            {
              path: 'showcase',
              name: 'Showcase',
              component: () => import('@/views/Community/ShowcaseView.vue'),
            },
            {
              path: 'settings',
              name: 'Settings',
              component: () => import('@/views/Settings/SettingsView.vue'),
            },
            {
              path: 'checkout',
              name: 'Checkout',
              component: () => import('@/views/Settings/CheckoutView.vue'),
              meta: { hideSidebar: true },
            },
            {
              path: 'billing',
              name: 'Billing',
              component: () => import('@/views/Settings/BillingView.vue'),
            },
            {
              path: 'report-bug',
              name: 'ReportBug',
              component: () => import('@/views/Support/ReportBugView.vue'),
            },
            {
              path: 'academy/player/:id',
              name: 'AcademyPlayer',
              component: () => import('@/views/Learning/AcademyPlayerView.vue'),
            },
            {
              path: 'notes',
              name: 'Notes',
              component: () => import('@/views/Learning/NotesView.vue'),
            },
            {
              path: 'notifications',
              name: 'Notifications',
              component: () => import('@/views/NotificationsView.vue'),
            },
            // Admin Routes
            {
              path: 'admin/dashboard',
              name: 'AdminDashboard',
              component: () => import('@/views/Admin/AdminDashboardView.vue'),
              meta: { requiresAdmin: true },
            },
            {
              path: 'admin/users',
              name: 'AdminUsers',
              component: () => import('@/views/Admin/UsersView.vue'),
              meta: { requiresAdmin: true },
            },
            {
              path: 'admin/feedback',
              name: 'AdminFeedback',
              component: () => import('@/views/Admin/FeedbackView.vue'),
              meta: { requiresAdmin: true },
            },
            {
              path: 'admin/assets',
              name: 'AdminAssets',
              component: () => import('@/views/Admin/AdminAuditsView.vue'),
              meta: { requiresAdmin: true, auditType: 'assets' },
            },
            {
              path: 'admin/materials',
              name: 'AdminMaterials',
              component: () => import('@/views/Admin/AdminAuditsView.vue'),
              meta: { requiresAdmin: true, auditType: 'materials' },
            },
            {
              path: 'admin/roadmaps',
              name: 'AdminRoadmaps',
              component: () => import('@/views/Admin/AdminRoadmapsView.vue'),
              meta: { requiresAdmin: true },
            },
            {
              path: 'admin/courses',
              name: 'AdminCourses',
              component: () => import('@/views/Admin/AdminCoursesView.vue'),
              meta: { requiresAdmin: true },
            },
            {
              path: 'admin/categories',
              name: 'AdminCategories',
              component: () => import('@/views/Admin/AdminCategoriesView.vue'),
              meta: { requiresAdmin: true },
            },
            {
              path: 'admin/teams',
              name: 'AdminTeams',
              component: () => import('@/views/Admin/AdminTeamsView.vue'),
              meta: { requiresAdmin: true },
            },
            {
              path: 'admin/subscriptions',
              name: 'AdminSubscriptions',
              component: () => import('@/views/Admin/AdminSubscriptionsView.vue'),
              meta: { requiresAdmin: true },
            },
            {
              path: 'admin/audits',
              name: 'AdminAudits',
              component: () => import('@/views/Admin/AdminAuditsView.vue'),
              meta: { requiresAdmin: true, auditType: 'showcases' },
            },
            {
              path: 'admin/audit-logs',
              name: 'AdminAuditLogs',
              component: () => import('@/views/Admin/AdminAuditLogsView.vue'),
              meta: { requiresAdmin: true },
            },
            {
              path: 'admin/settings',
              name: 'AdminSettings',
              component: () => import('@/views/Admin/AdminSettingsView.vue'),
              meta: { requiresAdmin: true },
            },
          ],
        },
      ],
    },
  ],
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  const systemStore = useSystemStore();

  console.log('Router: Navigating to', to.name);

  // Fetch system settings if not already fetched
  if (!systemStore.isInitialized) {
    try {
      console.log('Router: Initializing system settings...');
      await systemStore.fetchSettings();
      console.log('Router: System settings initialized');
    } catch (e) {
      console.error('Router: System initialization failed', e);
    }
  }

  // If no user in state but route needs auth, try fetching (it will use cookies)
  if (!authStore.user && to.meta.requiresAuth) {
    try {
      await authStore.fetchMe();
    } catch (e) {
      // fetchMe handles logout/redirect if it fails
    }
  } else if (!authStore.user && systemStore.settings.MAINTENANCE_MODE && to.name !== 'Maintenance' && to.name !== 'Login') {
    // If in maintenance mode and no user in state, try fetching to see if it's an admin
    try {
      await authStore.fetchMe();
    } catch (e) {
      // If it fails, they are likely not logged in or not an admin
    }
  }

  // Handle Maintenance Mode
  if (
    systemStore.settings.MAINTENANCE_MODE &&
    to.name !== 'Maintenance' &&
    to.name !== 'Login' &&
    authStore.user?.role !== 'ADMIN'
  ) {
    return { name: 'Maintenance' };
  }

  // If maintenance mode is OFF but user is on Maintenance page, redirect to Dashboard
  if (!systemStore.settings.MAINTENANCE_MODE && to.name === 'Maintenance') {
    return { name: 'Dashboard' };
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'Login' };
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return { name: 'Dashboard' };
  }

  if (to.meta.requiresAdmin && authStore.user?.role !== 'ADMIN') {
    return { name: 'Dashboard' };
  }
});

export default router;
