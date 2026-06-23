import { ref } from 'vue';
import api from '@/utils/api';
import { logError } from '@/utils/error';
export { formatCompactNumber } from '@/utils/format';

export type AdminInsightIssue = {
  severity: 'critical' | 'warning' | 'info';
  module: string;
  title: string;
  detail: string;
  route: string;
};

export type AdminManagementAction = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  scope: string;
  title: string;
  detail: string;
  metric: string;
  cta: string;
  route: string;
};

export type AdminControlMetric = {
  key: string;
  label: string;
  score: number;
  tone: 'good' | 'warn' | 'risk' | 'info';
  route: string;
  primary: string;
  secondary: string;
};

export type AdminWorkloadItem = {
  key: string;
  label: string;
  current: number;
  overdue: number;
  capacity: number;
  route: string;
  level: 'ok' | 'watch' | 'high';
};

export type AdminSlaItem = {
  key: string;
  label: string;
  current: number;
  overdue: number;
  dueSoon: number;
  targetHours: number;
  route: string;
  owner: string;
  status: 'healthy' | 'watch' | 'breached';
};

export type AdminCommandQueueItem = {
  id: string;
  type: 'feedback' | 'audit' | 'team' | 'billing' | 'resource';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  owner: string;
  ageHours: number;
  route: string;
  createdAt: string;
  dueAt?: string | null;
  status: string;
};

export type AdminTrendPoint = {
  date: string;
  users: number;
  content: number;
  feedback: number;
  audit: number;
};

export type AdminPlaybook = {
  id: string;
  title: string;
  detail: string;
  route: string;
  cta: string;
  impact: string;
  severity: 'critical' | 'warning' | 'info';
};

export type AdminSystemSignal = {
  key: string;
  label: string;
  value: string;
  status: 'healthy' | 'watch' | 'breached';
  route: string;
};

export type AdminManagementInsights = {
  generatedAt: string;
  overview: {
    healthScore: number;
    issueCount: number;
    totalTeachingItems: number;
    totalOperationItems: number;
    activeEntitlements: number;
  };
  command?: {
    securityCoverage: number;
    verifiedRate: number;
    moderationClearance: number;
    feedbackClosureRate: number;
    contentReadiness: number;
    businessReadiness: number;
    resourceFreshness: number;
    workloadTotal: number;
    controlMetrics: AdminControlMetric[];
    workload: AdminWorkloadItem[];
  };
  commandCenter?: {
    sla: AdminSlaItem[];
    queue: AdminCommandQueueItem[];
    trend: AdminTrendPoint[];
    playbooks: AdminPlaybook[];
    systemSignals: AdminSystemSignal[];
    riskMix: {
      critical: number;
      warning: number;
      info: number;
    };
    nextReviewAt: string;
  };
  accounts: {
    users: {
      total: number;
      active: number;
      banned: number;
      admins: number;
      instructors: number;
      emailVerified: number;
      mfaEnabled: number;
      adminsWithoutMfa: number;
      newLast7d: number;
      recentLoginUsers: number;
      neverLoggedIn: number;
      activeSessionUsers: number;
      activeSessions: number;
      trustedDevices: number;
      recent: Array<{
        id: string;
        name: string | null;
        email: string;
        role: string;
        status: string;
        createdAt: string;
      }>;
    };
    teams: {
      total: number;
      public: number;
      private: number;
      personal: number;
      collaboration: number;
      totalMembers: number;
      pendingApplications: number;
      pendingInvitations: number;
      withoutMembers: number;
      withoutAssets: number;
      totalAssets: number;
      totalProjects: number;
      totalTasks: number;
      recent: Array<{
        id: string;
        name: string;
        visibility: string;
        category: string | null;
        updatedAt: string;
        owner: { id: string; name: string | null; email: string };
        _count: { members: number; assets: number; projects: number; tasks: number };
      }>;
    };
    feedback: {
      total: number;
      open: number;
      inProgress: number;
      resolved: number;
      closed: number;
      highPriorityOpen: number;
      withoutReply: number;
      stale: number;
      recentOpen: Array<{
        id: string;
        title: string;
        priority: string;
        status: string;
        type: string;
        createdAt: string;
        updatedAt: string;
        user: { id: string; name: string | null; email: string };
      }>;
    };
  };
  teaching: {
    courses: {
      total: number;
      published: number;
      draft: number;
      withoutLessons: number;
      withoutCategory: number;
      withoutThumbnail: number;
      totalLessons: number;
      totalEnrollments: number;
      avgLessonsPerCourse: number;
      topCourses: Array<{
        id: string;
        title: string;
        status: string;
        enrollments: number;
        lessons: number;
        reviews: number;
      }>;
    };
    roadmaps: {
      total: number;
      totalSteps: number;
      withoutSteps: number;
      avgStepsPerRoadmap: number;
      recent: Array<{ id: string; title: string; updatedAt: string; _count: { steps: number } }>;
    };
    categories: {
      course: number;
      asset: number;
      material: number;
      showcase: number;
      emptyCourseCategories: number;
      emptyAssetCategories: number;
    };
  };
  moderation: {
    totalPending: number;
    totalApproved: number;
    totalRejected: number;
    stalePending: number;
    assets: { pending: number; approved: number; rejected: number };
    materials: { pending: number; approved: number; rejected: number };
    showcases: { pending: number; approved: number; rejected: number };
    plugins: { pending: number; approved: number; rejected: number };
    recentPending: Array<{
      id: string;
      title: string;
      kind: string;
      channel: string;
      route: string;
      createdAt: string;
      user: { id: string; name: string | null; email: string };
    }>;
  };
  operations: {
    banners: {
      total: number;
      active: number;
      inactive: number;
      withoutImage: number;
      recent: Array<{
        id: string;
        title: string;
        route: string;
        isActive: boolean;
        updatedAt: string;
      }>;
    };
    subscriptions: {
      plans: number;
      activeSubscriptions: number;
      expiringSoon: number;
      cancelAtPeriodEnd: number;
      activeCodes: number;
      usedCodes: number;
      expiredCodes: number;
      monthlyRecurring: number;
      yearlyRecurring: number;
      estimatedMonthlyRevenue: number;
    };
    mirror: {
      sources: number;
      active: number;
      syncing: number;
      errors: number;
      stale: number;
      resources: number;
      categories: number;
      recentFailedSyncLogs: Array<{
        id: string;
        sourceId: string;
        sourceName: string;
        status: string;
        type: string;
        error: string | null;
        startedAt: string;
      }>;
    };
    manual: {
      stations: number;
      active: number;
      disabled: number;
      locked: number;
      empty: number;
      resources: number;
      categories: number;
      recentResources: Array<{
        id: string;
        title: string;
        stationId: string;
        stationName: string;
        updatedAt: string;
      }>;
    };
  };
  issues: AdminInsightIssue[];
  actions: AdminManagementAction[];
};

export const managementInsights = ref<AdminManagementInsights | null>(null);
export const isLoadingManagementInsights = ref(false);
export const managementInsightsError = ref('');

let currentRequest: Promise<AdminManagementInsights | null> | null = null;

export async function fetchManagementInsights(force = false) {
  if (managementInsights.value && !force) return managementInsights.value;
  if (currentRequest && !force) return currentRequest;

  isLoadingManagementInsights.value = true;
  managementInsightsError.value = '';
  currentRequest = api
    .get<AdminManagementInsights>('/api/admin/management-insights')
    .then(({ data }) => {
      managementInsights.value = data;
      return data;
    })
    .catch((error) => {
      logError(error, {
        operation: 'admin.fetchManagementInsights',
        component: 'adminManagementInsights',
      });
      managementInsightsError.value = '后台运营洞察加载失败';
      return null;
    })
    .finally(() => {
      isLoadingManagementInsights.value = false;
      currentRequest = null;
    });

  return currentRequest;
}

export function getIssueClasses(severity: AdminInsightIssue['severity']) {
  if (severity === 'critical') {
    return 'border-rose-500/25 bg-rose-500/10 text-rose-500';
  }
  if (severity === 'warning') {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-500';
  }
  return 'border-sky-500/25 bg-sky-500/10 text-sky-500';
}

export function getHealthLabel(score: number) {
  if (score >= 90) return '优秀';
  if (score >= 75) return '稳定';
  if (score >= 60) return '需关注';
  return '待修复';
}

export function getHealthClasses(score: number) {
  if (score >= 90) return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500';
  if (score >= 75) return 'border-sky-500/25 bg-sky-500/10 text-sky-500';
  if (score >= 60) return 'border-amber-500/25 bg-amber-500/10 text-amber-500';
  return 'border-rose-500/25 bg-rose-500/10 text-rose-500';
}
