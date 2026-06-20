<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Gauge,
  RefreshCw,
  ShieldCheck,
  Workflow,
} from 'lucide-vue-next';
import {
  fetchManagementInsights,
  formatCompactNumber,
  getHealthClasses,
  getHealthLabel,
  getIssueClasses,
  isLoadingManagementInsights,
  managementInsights,
  managementInsightsError,
  type AdminControlMetric,
  type AdminInsightIssue,
  type AdminWorkloadItem,
} from '../adminManagementInsights';

type AdminScope =
  | 'overview'
  | 'users'
  | 'teams'
  | 'feedback'
  | 'audits'
  | 'courses'
  | 'roadmaps'
  | 'categories'
  | 'banners'
  | 'subscriptions'
  | 'mirror'
  | 'manual'
  | 'cloudflare';

type Tone = 'neutral' | 'good' | 'warn' | 'risk' | 'info';

type MetricCard = {
  label: string;
  value: number | string;
  sub: string;
  tone: Tone;
};

type ActivityItem = {
  title: string;
  meta: string;
  route: string;
};

type ControlTone = AdminControlMetric['tone'];

const props = withDefaults(
  defineProps<{
    scope: AdminScope;
    compact?: boolean;
  }>(),
  {
    compact: false,
  },
);

const router = useRouter();
const isExpanded = ref(false);

const scopeTitles: Record<AdminScope, string> = {
  overview: '运营总控台',
  users: '账号与安全',
  teams: '团队协作',
  feedback: '反馈工单',
  audits: '内容审核',
  courses: '课程运营',
  roadmaps: '路线运营',
  categories: '分类治理',
  banners: '轮播投放',
  subscriptions: '订阅商业',
  mirror: '镜像同步',
  manual: '资源站运营',
  cloudflare: 'Cloudflare 域名',
};

const issueRouteMap: Record<Exclude<AdminScope, 'overview'>, string[]> = {
  users: ['/admin/users'],
  teams: ['/admin/teams'],
  feedback: ['/admin/feedback'],
  audits: ['/admin/audits', '/admin/assets', '/admin/materials'],
  courses: ['/admin/courses'],
  roadmaps: ['/admin/roadmaps'],
  categories: ['/admin/categories'],
  banners: ['/admin/banners'],
  subscriptions: ['/admin/subscriptions'],
  mirror: ['/admin/mirror'],
  manual: ['/admin/manual'],
  cloudflare: ['/admin/cloudflare-domains'],
};

const toneClasses: Record<Tone, string> = {
  neutral: 'text-[var(--text-primary)]',
  good: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  risk: 'text-rose-600 dark:text-rose-400',
  info: 'text-sky-600 dark:text-sky-400',
};

const controlToneClasses: Record<ControlTone, string> = {
  good: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  risk: 'text-rose-600 dark:text-rose-400',
  info: 'text-sky-600 dark:text-sky-400',
};

const controlBarClasses: Record<ControlTone, string> = {
  good: 'bg-emerald-500',
  warn: 'bg-amber-500',
  risk: 'bg-rose-500',
  info: 'bg-sky-500',
};

const workloadLevelClasses: Record<AdminWorkloadItem['level'], string> = {
  ok: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  watch: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  high: 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

const compactDate = (value?: string | null) => {
  if (!value) return '未记录';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '未记录';
  return new Date(time).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  });
};

const compactTime = (value?: string | null) => {
  if (!value) return '刚刚';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '刚刚';
  return new Date(time).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const personName = (user?: { name?: string | null; email?: string | null }) =>
  user?.name || user?.email || '未命名用户';

const percent = (value: number, total: number) =>
  total > 0 ? `${Math.round((value / total) * 100)}%` : '0%';

const formatValue = (value: number | string) =>
  typeof value === 'number' ? formatCompactNumber(value) : value;

const clampPercent = (value: number) => `${Math.min(100, Math.max(0, Math.round(value)))}%`;

const metricCards = computed<MetricCard[]>(() => {
  const data = managementInsights.value;
  if (!data) return [];

  if (props.scope === 'overview') {
    return [
      {
        label: '健康分',
        value: data.overview.healthScore,
        sub: getHealthLabel(data.overview.healthScore),
        tone: data.overview.healthScore >= 75 ? 'good' : 'warn',
      },
      {
        label: '待处理',
        value: data.overview.issueCount,
        sub: `${data.actions.length} 个行动项`,
        tone: data.overview.issueCount ? 'warn' : 'good',
      },
      {
        label: '运营对象',
        value: data.overview.totalOperationItems,
        sub: '账号、内容、商业、资源',
        tone: 'info',
      },
      {
        label: '活跃权益',
        value: data.overview.activeEntitlements,
        sub: '当前有效订阅',
        tone: 'good',
      },
    ];
  }

  if (props.scope === 'users') {
    const u = data.accounts.users;
    return [
      { label: '全站用户', value: u.total, sub: `${u.newLast7d} 个 7 日新增`, tone: 'info' },
      {
        label: '正常账号',
        value: percent(u.active, u.total),
        sub: `${u.banned} 个封禁`,
        tone: u.banned ? 'warn' : 'good',
      },
      {
        label: '管理员 2FA',
        value: u.adminsWithoutMfa,
        sub: `${u.admins} 个管理员`,
        tone: u.adminsWithoutMfa ? 'risk' : 'good',
      },
      {
        label: '活跃会话',
        value: u.activeSessions,
        sub: `${u.activeSessionUsers} 个用户在线`,
        tone: 'good',
      },
    ];
  }

  if (props.scope === 'teams') {
    const t = data.accounts.teams;
    return [
      { label: '协作团队', value: t.collaboration, sub: `${t.totalMembers} 个成员`, tone: 'info' },
      {
        label: '待处理申请',
        value: t.pendingApplications,
        sub: `${t.pendingInvitations} 个邀请`,
        tone: t.pendingApplications ? 'warn' : 'good',
      },
      {
        label: '空团队',
        value: t.withoutAssets,
        sub: '缺少资源沉淀',
        tone: t.withoutAssets ? 'warn' : 'good',
      },
      {
        label: '项目任务',
        value: t.totalProjects + t.totalTasks,
        sub: `${t.totalProjects} 项目 / ${t.totalTasks} 任务`,
        tone: 'good',
      },
    ];
  }

  if (props.scope === 'feedback') {
    const f = data.accounts.feedback;
    return [
      {
        label: '待处理',
        value: f.open + f.inProgress,
        sub: `${f.total} 条总反馈`,
        tone: f.open ? 'warn' : 'good',
      },
      {
        label: '高优先级',
        value: f.highPriorityOpen,
        sub: '需要优先响应',
        tone: f.highPriorityOpen ? 'risk' : 'good',
      },
      {
        label: '未回复',
        value: f.withoutReply,
        sub: `${f.stale} 条超时`,
        tone: f.stale ? 'risk' : 'warn',
      },
      {
        label: '闭环率',
        value: percent(f.resolved + f.closed, f.total),
        sub: `${f.resolved} 已解决`,
        tone: 'good',
      },
    ];
  }

  if (props.scope === 'audits') {
    const a = data.moderation;
    return [
      {
        label: '待审核',
        value: a.totalPending,
        sub: `${a.stalePending} 条积压`,
        tone: a.stalePending ? 'risk' : 'warn',
      },
      {
        label: '资产队列',
        value: a.assets.pending,
        sub: `${a.assets.approved} 已通过`,
        tone: a.assets.pending ? 'warn' : 'good',
      },
      {
        label: '材质队列',
        value: a.materials.pending,
        sub: `${a.materials.approved} 已通过`,
        tone: a.materials.pending ? 'warn' : 'good',
      },
      {
        label: '作品插件',
        value: a.showcases.pending + a.plugins.pending,
        sub: `${a.totalRejected} 已打回`,
        tone: 'info',
      },
    ];
  }

  if (props.scope === 'courses') {
    const c = data.teaching.courses;
    return [
      { label: '课程总量', value: c.total, sub: `${c.published} 已发布`, tone: 'info' },
      {
        label: '总课时',
        value: c.totalLessons,
        sub: `平均 ${c.avgLessonsPerCourse} 节`,
        tone: 'good',
      },
      { label: '学习人次', value: c.totalEnrollments, sub: `${c.draft} 个草稿`, tone: 'good' },
      {
        label: '待完善',
        value: c.withoutLessons + c.withoutThumbnail,
        sub: `${c.withoutLessons} 个无课时`,
        tone: c.withoutLessons ? 'warn' : 'good',
      },
    ];
  }

  if (props.scope === 'roadmaps') {
    const r = data.teaching.roadmaps;
    return [
      {
        label: '官方路线',
        value: r.total,
        sub: `${r.withoutSteps} 个待补阶段`,
        tone: r.withoutSteps ? 'warn' : 'good',
      },
      {
        label: '路线节点',
        value: r.totalSteps,
        sub: `平均 ${r.avgStepsPerRoadmap} 阶段`,
        tone: 'info',
      },
      {
        label: '完整路线',
        value: Math.max(0, r.total - r.withoutSteps),
        sub: '已有阶段配置',
        tone: 'good',
      },
      { label: '最近维护', value: r.recent.length, sub: '按更新时间排序', tone: 'neutral' },
    ];
  }

  if (props.scope === 'categories') {
    const c = data.teaching.categories;
    return [
      {
        label: '资产分类',
        value: c.asset,
        sub: `${c.emptyAssetCategories} 个空分类`,
        tone: c.emptyAssetCategories ? 'warn' : 'good',
      },
      {
        label: '课程分类',
        value: c.course,
        sub: `${c.emptyCourseCategories} 个空分类`,
        tone: c.emptyCourseCategories ? 'warn' : 'good',
      },
      { label: '前台频道', value: c.material + c.showcase, sub: '材质与作品分类', tone: 'info' },
      {
        label: '分类总量',
        value: c.asset + c.course + c.material + c.showcase,
        sub: '跨业务分类池',
        tone: 'neutral',
      },
    ];
  }

  if (props.scope === 'banners') {
    const b = data.operations.banners;
    return [
      {
        label: '启用轮播',
        value: b.active,
        sub: `${b.total} 个总轮播`,
        tone: b.active ? 'good' : 'risk',
      },
      { label: '停用轮播', value: b.inactive, sub: '不在前台展示', tone: 'neutral' },
      {
        label: '缺图素材',
        value: b.withoutImage,
        sub: '需要补图',
        tone: b.withoutImage ? 'warn' : 'good',
      },
      { label: '投放位', value: b.recent.length, sub: '按排序预览', tone: 'info' },
    ];
  }

  if (props.scope === 'subscriptions') {
    const s = data.operations.subscriptions;
    return [
      { label: '活跃订阅', value: s.activeSubscriptions, sub: `${s.plans} 个套餐`, tone: 'good' },
      {
        label: '月收入估算',
        value: `¥${formatCompactNumber(s.estimatedMonthlyRevenue)}`,
        sub: '按当前订阅',
        tone: 'info',
      },
      {
        label: '即将到期',
        value: s.expiringSoon,
        sub: `${s.cancelAtPeriodEnd} 个期末取消`,
        tone: s.expiringSoon ? 'warn' : 'good',
      },
      { label: '激活码', value: s.activeCodes, sub: `${s.usedCodes} 已使用`, tone: 'neutral' },
    ];
  }

  if (props.scope === 'mirror') {
    const m = data.operations.mirror;
    return [
      {
        label: '可用镜像',
        value: `${m.active}/${m.sources}`,
        sub: `${m.resources} 个资源`,
        tone: m.errors ? 'risk' : 'good',
      },
      {
        label: '同步中',
        value: m.syncing,
        sub: `${m.stale} 个过期`,
        tone: m.stale ? 'warn' : 'info',
      },
      { label: '异常源', value: m.errors, sub: '需要查看日志', tone: m.errors ? 'risk' : 'good' },
      { label: '镜像分类', value: m.categories, sub: '资源目录', tone: 'neutral' },
    ];
  }

  if (props.scope === 'cloudflare') {
    return [
      { label: '域名管理', value: 'DNS', sub: 'Zone / SSL / 解析', tone: 'info' },
      { label: 'Token', value: 'API', sub: '独立于 R2 存储', tone: 'neutral' },
      { label: '控制台', value: '跳转', sub: '高级 SSL / 缓存', tone: 'good' },
      { label: '建议', value: '只读', sub: '日常 DNS 维护', tone: 'neutral' },
    ];
  }

  const manual = data.operations.manual;
  return [
    {
      label: '启用站点',
      value: `${manual.active}/${manual.stations}`,
      sub: `${manual.locked} 个会员站`,
      tone: 'good',
    },
    {
      label: '资源总量',
      value: manual.resources,
      sub: `${manual.categories} 个分类`,
      tone: 'info',
    },
    {
      label: '空站点',
      value: manual.empty,
      sub: '需要补资源',
      tone: manual.empty ? 'warn' : 'good',
    },
    { label: '停用站点', value: manual.disabled, sub: '不对前台开放', tone: 'neutral' },
  ];
});

const visibleIssues = computed<AdminInsightIssue[]>(() => {
  const data = managementInsights.value;
  if (!data) return [];
  if (props.scope === 'overview') return data.issues.slice(0, 5);
  const routes = issueRouteMap[props.scope];
  return data.issues.filter((issue) => routes.includes(issue.route)).slice(0, 4);
});

const scopeActions = computed(() => {
  const data = managementInsights.value;
  if (!data) return [];
  if (props.scope === 'overview') return data.actions.slice(0, 5);
  return data.actions.filter((action) => action.scope === props.scope).slice(0, 4);
});

const primaryAction = computed(() => scopeActions.value[0]);

const controlMetrics = computed(() => managementInsights.value?.command?.controlMetrics || []);

const scopedControlMetrics = computed(() => {
  if (props.scope === 'overview') return controlMetrics.value.slice(0, 6);
  const routes =
    props.scope === 'audits'
      ? ['/admin/audits', '/admin/assets', '/admin/materials']
      : props.scope === 'users'
        ? ['/admin/users']
        : props.scope === 'feedback'
          ? ['/admin/feedback']
          : props.scope === 'courses'
            ? ['/admin/courses']
            : props.scope === 'roadmaps'
              ? ['/admin/roadmaps']
              : props.scope === 'subscriptions'
                ? ['/admin/subscriptions']
                : props.scope === 'banners'
                  ? ['/admin/banners']
                  : props.scope === 'mirror'
                    ? ['/admin/mirror']
                    : props.scope === 'manual'
                      ? ['/admin/manual']
                      : props.scope === 'cloudflare'
                        ? ['/admin/cloudflare-domains']
                        : [];
  const localMetrics = controlMetrics.value.filter((metric) => routes.includes(metric.route));
  return localMetrics.length ? localMetrics : controlMetrics.value.slice(0, 3);
});

const workloadItems = computed(() => managementInsights.value?.command?.workload || []);

const scopedWorkloadItems = computed(() => {
  if (props.scope === 'overview') return workloadItems.value;
  const routeMap: Partial<Record<AdminScope, string[]>> = {
    users: ['/admin/users'],
    teams: ['/admin/teams'],
    feedback: ['/admin/feedback'],
    audits: ['/admin/audits'],
    courses: ['/admin/courses'],
    subscriptions: ['/admin/subscriptions'],
    mirror: ['/admin/mirror'],
    manual: ['/admin/manual'],
    cloudflare: ['/admin/cloudflare-domains'],
  };
  const routes = routeMap[props.scope] || [];
  const localWorkload = workloadItems.value.filter((item) => routes.includes(item.route));
  return localWorkload.length ? localWorkload : workloadItems.value.slice(0, 2);
});

const healthDialStyle = computed(() => ({
  '--score': clampPercent(managementInsights.value?.overview.healthScore || 0),
}));

const workloadWidth = (item: AdminWorkloadItem) => {
  const max = Math.max(item.capacity, item.current, 1);
  return clampPercent((item.current / max) * 100);
};

const activityItems = computed<ActivityItem[]>(() => {
  const data = managementInsights.value;
  if (!data) return [];

  if (props.scope === 'overview') {
    return [
      ...data.moderation.recentPending.slice(0, 3).map((item) => ({
        title: item.title,
        meta: `${item.kind} / ${personName(item.user)}`,
        route: item.route,
      })),
      ...data.accounts.feedback.recentOpen.slice(0, 2).map((feedback) => ({
        title: feedback.title,
        meta: `${feedback.priority} / ${personName(feedback.user)}`,
        route: '/admin/feedback',
      })),
    ];
  }

  if (props.scope === 'users') {
    return data.accounts.users.recent.map((user) => ({
      title: personName(user),
      meta: `${user.role} / ${user.status} / ${compactDate(user.createdAt)}`,
      route: '/admin/users',
    }));
  }

  if (props.scope === 'teams') {
    return data.accounts.teams.recent.map((team) => ({
      title: team.name,
      meta: `${team.visibility} / ${team._count.members} 成员 / ${personName(team.owner)}`,
      route: '/admin/teams',
    }));
  }

  if (props.scope === 'feedback') {
    return data.accounts.feedback.recentOpen.map((feedback) => ({
      title: feedback.title,
      meta: `${feedback.priority} / ${feedback.status} / ${personName(feedback.user)}`,
      route: '/admin/feedback',
    }));
  }

  if (props.scope === 'audits') {
    return data.moderation.recentPending.map((item) => ({
      title: item.title,
      meta: `${item.kind} / ${item.channel} / ${personName(item.user)}`,
      route: item.route,
    }));
  }

  if (props.scope === 'courses') {
    return data.teaching.courses.topCourses.map((course) => ({
      title: course.title,
      meta: `${course.enrollments} 学员 / ${course.lessons} 课时 / ${course.status}`,
      route: '/admin/courses',
    }));
  }

  if (props.scope === 'roadmaps') {
    return data.teaching.roadmaps.recent.map((roadmap) => ({
      title: roadmap.title,
      meta: `${roadmap._count.steps} 阶段 / ${compactDate(roadmap.updatedAt)}`,
      route: '/admin/roadmaps',
    }));
  }

  if (props.scope === 'banners') {
    return data.operations.banners.recent.map((banner) => ({
      title: banner.title,
      meta: `${banner.isActive ? '启用' : '停用'} / ${banner.route || '未配置跳转'}`,
      route: '/admin/banners',
    }));
  }

  if (props.scope === 'mirror') {
    return data.operations.mirror.recentFailedSyncLogs.map((log) => ({
      title: log.sourceName,
      meta: `${log.status} / ${log.type} / ${compactDate(log.startedAt)}`,
      route: '/admin/mirror',
    }));
  }

  if (props.scope === 'manual') {
    return data.operations.manual.recentResources.map((resource) => ({
      title: resource.title,
      meta: `${resource.stationName} / ${compactDate(resource.updatedAt)}`,
      route: '/admin/manual',
    }));
  }

  return [];
});

const panelSummary = computed(() => {
  const data = managementInsights.value;
  if (!data) return managementInsightsError.value || '正在加载运营数据';
  return `${visibleIssues.value.length} 个风险 / ${scopeActions.value.length} 个行动项 / ${compactTime(data.generatedAt)}`;
});

const openRoute = (route?: string) => {
  if (route) router.push(route);
};

onMounted(() => {
  fetchManagementInsights();
});
</script>

<template>
  <section
    class="ops-panel mb-4 rounded-lg border border-[var(--border-base)] bg-[var(--bg-card)] overflow-hidden"
    :class="{ 'ops-panel-compact': compact }"
  >
    <div class="px-3 py-2.5 flex flex-col gap-3 xl:flex-row xl:items-center">
      <div class="flex items-center gap-2 min-w-0 xl:w-64 shrink-0">
        <span
          class="w-9 h-9 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0"
        >
          <Activity class="w-4 h-4 text-sky-500" />
        </span>
        <div class="min-w-0">
          <div class="flex items-center gap-2 min-w-0">
            <h2 class="text-sm font-black text-[var(--text-primary)] truncate">
              {{ scopeTitles[scope] }}
            </h2>
            <span
              v-if="managementInsights"
              class="px-2 py-0.5 rounded-md border text-[10px] font-black shrink-0"
              :class="getHealthClasses(managementInsights.overview.healthScore)"
            >
              {{ managementInsights.overview.healthScore }}
            </span>
          </div>
          <p class="text-[10px] font-semibold text-[var(--text-muted)] truncate">
            {{ panelSummary }}
          </p>
        </div>
      </div>

      <!-- KPI Metrics Grid (Hidden in compact mode) -->
      <div v-if="!compact" class="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1 min-w-0">
        <template v-if="!managementInsights">
          <div
            v-for="i in 4"
            :key="i"
            class="min-h-14 rounded-lg border border-[var(--border-base)] bg-slate-50/60 dark:bg-white/[0.03] px-3 py-2 animate-pulse"
          >
            <div class="h-2 w-12 bg-slate-200 dark:bg-white/10 rounded"></div>
            <div class="mt-1.5 flex items-baseline gap-2">
              <div class="h-4.5 w-8 bg-slate-300 dark:bg-white/20 rounded"></div>
              <div class="h-2 w-16 bg-slate-200 dark:bg-white/10 rounded"></div>
            </div>
          </div>
        </template>
        <template v-else>
          <div
            v-for="card in metricCards"
            :key="card.label"
            class="min-h-14 rounded-lg border border-[var(--border-base)] bg-slate-50/60 dark:bg-white/[0.03] px-3 py-2"
          >
            <div
              class="text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)] truncate"
            >
              {{ card.label }}
            </div>
            <div class="mt-0.5 flex items-baseline gap-2 min-w-0">
              <strong class="text-base font-black truncate" :class="toneClasses[card.tone]">
                {{ formatValue(card.value) }}
              </strong>
              <span class="text-[10px] font-semibold text-[var(--text-muted)] truncate">
                {{ card.sub }}
              </span>
            </div>
          </div>
        </template>
      </div>

      <div
        class="flex items-center gap-2 xl:w-[300px] xl:justify-end shrink-0"
        :class="{ 'ml-auto xl:w-auto': compact }"
      >
        <button
          v-if="primaryAction"
          type="button"
          class="min-w-0 flex-1 xl:flex-none xl:w-36 h-9 px-3 rounded-lg bg-rose-600 text-white text-[11px] font-black flex items-center justify-center gap-1.5 hover:bg-rose-700 transition-colors"
          @click="openRoute(primaryAction.route)"
        >
          <ExternalLink class="w-3.5 h-3.5 shrink-0" />
          <span class="truncate">{{ primaryAction.cta }}</span>
        </button>
        <span
          v-else
          class="min-w-0 flex-1 xl:flex-none xl:w-36 h-9 px-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-black flex items-center justify-center gap-1.5"
        >
          <CheckCircle2 class="w-3.5 h-3.5 shrink-0" />
          <span class="truncate">状态稳定</span>
        </span>

        <button
          type="button"
          class="w-9 h-9 rounded-lg border border-[var(--border-base)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center justify-center"
          :disabled="isLoadingManagementInsights"
          title="刷新运营数据"
          @click="fetchManagementInsights(true)"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoadingManagementInsights }" />
        </button>

        <button
          type="button"
          class="w-9 h-9 rounded-lg border border-[var(--border-base)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center justify-center"
          :title="isExpanded ? '收起行动面板' : '展开行动面板'"
          @click="isExpanded = !isExpanded"
        >
          <ChevronDown class="w-4 h-4 transition-transform" :class="{ 'rotate-180': isExpanded }" />
        </button>
      </div>
    </div>

    <!-- Bottom Command Grid (Includes loading skeletons) -->
    <div
      v-if="!managementInsights || managementInsights?.command"
      class="ops-command-grid border-t border-[var(--border-base)] px-3 py-3"
    >
      <template v-if="!managementInsights">
        <!-- Skeleton for ops-score-block -->
        <div class="ops-score-block animate-pulse">
          <div
            class="ops-score-ring bg-slate-200 dark:bg-white/10 flex items-center justify-center"
          >
            <div class="h-6 w-6 rounded-full bg-slate-300 dark:bg-white/20"></div>
          </div>
          <div class="space-y-1.5 flex-1">
            <div class="h-3 w-16 bg-slate-200 dark:bg-white/10 rounded"></div>
            <div class="h-2.5 w-24 bg-slate-200 dark:bg-white/10 rounded"></div>
          </div>
        </div>
        <!-- Skeleton for ops-control-list -->
        <div class="ops-control-list animate-pulse">
          <div v-for="i in 3" :key="i" class="ops-control-item space-y-2">
            <div class="h-3 w-20 bg-slate-200 dark:bg-white/10 rounded"></div>
            <div class="h-1.5 w-full bg-slate-200 dark:bg-white/10 rounded-full"></div>
            <div class="h-2.5 w-24 bg-slate-200 dark:bg-white/10 rounded"></div>
          </div>
        </div>
        <!-- Skeleton for ops-workload-list -->
        <div class="ops-workload-list animate-pulse">
          <div v-for="i in 3" :key="i" class="ops-workload-item space-y-2">
            <div class="h-3 w-20 bg-slate-200 dark:bg-white/10 rounded"></div>
            <div class="h-1.5 w-full bg-slate-200 dark:bg-white/10 rounded-full"></div>
            <div class="h-2.5 w-12 bg-slate-200 dark:bg-white/10 rounded"></div>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="ops-score-block">
          <div class="ops-score-ring" :style="healthDialStyle">
            <div>
              <strong>{{ managementInsights.overview.healthScore }}</strong>
              <span>{{ getHealthLabel(managementInsights.overview.healthScore) }}</span>
            </div>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 text-xs font-black text-[var(--text-primary)]">
              <Gauge class="h-4 w-4 text-sky-500" />
              后台态势
            </div>
            <p class="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">
              {{ managementInsights.command?.workloadTotal || 0 }} 个待处理负载，{{
                managementInsights.overview.issueCount
              }}
              个风险信号
            </p>
          </div>
        </div>

        <div class="ops-control-list">
          <button
            v-for="metric in scopedControlMetrics.slice(0, 3)"
            :key="metric.key"
            type="button"
            class="ops-control-item"
            @click="openRoute(metric.route)"
          >
            <div class="flex items-center justify-between gap-3">
              <span class="truncate text-[11px] font-black text-[var(--text-primary)]">{{
                metric.label
              }}</span>
              <strong class="text-xs font-black" :class="controlToneClasses[metric.tone]"
                >{{ metric.score }}%</strong
              >
            </div>
            <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
              <span
                class="block h-full rounded-full"
                :class="controlBarClasses[metric.tone]"
                :style="{ width: clampPercent(metric.score) }"
              ></span>
            </div>
            <div
              class="mt-1 flex items-center justify-between gap-2 text-[10px] font-semibold text-[var(--text-muted)]"
            >
              <span class="truncate">{{ metric.primary }}</span>
              <span class="truncate">{{ metric.secondary }}</span>
            </div>
          </button>
        </div>

        <div class="ops-workload-list">
          <button
            v-for="item in scopedWorkloadItems.slice(0, 3)"
            :key="item.key"
            type="button"
            class="ops-workload-item"
            @click="openRoute(item.route)"
          >
            <div class="flex items-center justify-between gap-3">
              <span
                class="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-black text-[var(--text-primary)]"
              >
                <Workflow class="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span class="truncate">{{ item.label }}</span>
              </span>
              <span
                class="rounded-md border px-1.5 py-0.5 text-[10px] font-black"
                :class="workloadLevelClasses[item.level]"
              >
                {{ item.current }}
              </span>
            </div>
            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
              <span
                class="block h-full rounded-full bg-sky-500"
                :style="{ width: workloadWidth(item) }"
              ></span>
            </div>
            <p class="mt-1 text-[10px] font-semibold text-[var(--text-muted)]">
              {{ item.overdue ? `${item.overdue} 个超时` : '队列可控' }}
            </p>
          </button>
        </div>
      </template>
    </div>

    <div
      v-if="isExpanded"
      class="grid grid-cols-1 xl:grid-cols-[1fr_1fr_1fr] border-t border-[var(--border-base)]"
    >
      <div class="p-3 border-b xl:border-b-0 xl:border-r border-[var(--border-base)]">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
            行动项
          </span>
          <span class="text-[10px] font-bold text-[var(--text-muted)]">{{
            scopeActions.length
          }}</span>
        </div>
        <button
          v-for="action in scopeActions"
          :key="action.id"
          type="button"
          class="w-full text-left rounded-lg border px-3 py-2 mb-2 last:mb-0 transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
          :class="getIssueClasses(action.severity)"
          @click="openRoute(action.route)"
        >
          <div class="flex items-center justify-between gap-3">
            <span class="text-xs font-black truncate">{{ action.title }}</span>
            <span class="text-sm font-black shrink-0">{{ action.metric }}</span>
          </div>
          <div class="mt-1 text-[10px] leading-relaxed opacity-80">{{ action.detail }}</div>
        </button>
        <div
          v-if="scopeActions.length === 0"
          class="rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-2"
        >
          <div class="text-xs font-black">暂无高优行动项</div>
          <div class="mt-1 text-[10px] leading-relaxed opacity-80">
            当前模块没有需要立即处理的运营事项。
          </div>
        </div>
      </div>

      <div class="p-3 border-b xl:border-b-0 xl:border-r border-[var(--border-base)]">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
            风险信号
          </span>
          <span class="text-[10px] font-bold text-[var(--text-muted)]">{{
            visibleIssues.length
          }}</span>
        </div>
        <button
          v-for="issue in visibleIssues"
          :key="issue.title"
          type="button"
          class="w-full text-left rounded-lg border px-3 py-2 mb-2 last:mb-0 transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
          :class="getIssueClasses(issue.severity)"
          @click="openRoute(issue.route)"
        >
          <div class="text-xs font-black truncate">{{ issue.title }}</div>
          <div class="mt-1 text-[10px] leading-relaxed opacity-80">{{ issue.detail }}</div>
        </button>
        <div
          v-if="visibleIssues.length === 0"
          class="rounded-lg border border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400 px-3 py-2"
        >
          <div class="text-xs font-black">风险清爽</div>
          <div class="mt-1 text-[10px] leading-relaxed opacity-80">
            这个模块没有被后端洞察标记的异常。
          </div>
        </div>
      </div>

      <div class="p-3">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
            最近信号
          </span>
          <span class="text-[10px] font-bold text-[var(--text-muted)]">{{
            activityItems.length
          }}</span>
        </div>
        <button
          v-for="item in activityItems.slice(0, 5)"
          :key="`${item.route}-${item.title}`"
          type="button"
          class="w-full text-left rounded-lg px-3 py-2 mb-1 last:mb-0 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
          @click="openRoute(item.route)"
        >
          <div class="text-xs font-black text-[var(--text-primary)] truncate">
            {{ item.title }}
          </div>
          <div class="mt-1 text-[10px] font-semibold text-[var(--text-muted)] truncate">
            {{ item.meta }}
          </div>
        </button>
        <div
          v-if="activityItems.length === 0"
          class="rounded-lg border border-[var(--border-base)] px-3 py-2 text-[var(--text-muted)]"
        >
          <div class="text-xs font-black flex items-center gap-1.5">
            <ShieldCheck class="w-3.5 h-3.5" />
            暂无最近信号
          </div>
        </div>
      </div>
    </div>

    <!-- Error Alert Footer (only visible when failed to load insights) -->
    <div
      v-if="!managementInsights && managementInsightsError"
      class="px-3 pb-3 flex items-center gap-2 text-xs text-[var(--text-muted)]"
    >
      <AlertTriangle class="w-4 h-4 text-amber-500" />
      <span>{{ managementInsightsError }}</span>
    </div>
  </section>
</template>

<style scoped>
.ops-panel {
  box-shadow: var(--shadow-enterprise);
}

.ops-command-grid {
  display: grid;
  grid-template-columns: minmax(220px, 0.72fr) minmax(0, 1.34fr) minmax(260px, 0.94fr);
  gap: 0.65rem;
  background: var(--bg-card);
}

.ops-score-block,
.ops-control-item,
.ops-workload-item {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
}

.ops-score-block {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  align-items: center;
  gap: 0.7rem;
  padding: 0.7rem;
}

.ops-score-ring {
  display: grid;
  height: 64px;
  width: 64px;
  place-items: center;
  border-radius: 999px;
  background:
    radial-gradient(circle at center, var(--bg-card) 0 54%, transparent 55%),
    conic-gradient(var(--accent) var(--score), rgba(148, 163, 184, 0.22) 0);
}

.ops-score-ring > div {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.ops-score-ring strong {
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 900;
}

.ops-score-ring span {
  margin-top: 0.25rem;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
}

.ops-control-list,
.ops-workload-list {
  display: grid;
  gap: 0.5rem;
}

.ops-control-list {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.ops-workload-list {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.ops-control-item,
.ops-workload-item {
  min-height: 78px;
  padding: 0.62rem;
  text-align: left;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    transform 0.2s ease;
}

.ops-control-item:hover,
.ops-workload-item:hover {
  border-color: rgba(var(--accent-rgb), 0.35);
  background: color-mix(in srgb, var(--bg-app) 88%, var(--accent-subtle));
  transform: translateY(-1px);
}

@media (max-width: 1280px) {
  .ops-command-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .ops-control-list,
  .ops-workload-list {
    grid-template-columns: 1fr;
  }

  .ops-score-block {
    grid-template-columns: 64px minmax(0, 1fr);
  }

  .ops-score-ring {
    height: 60px;
    width: 60px;
  }
}

/* Compact mode overrides for narrow layout */
.ops-panel-compact .ops-command-grid {
  grid-template-columns: 1fr !important;
}

.ops-panel-compact .ops-control-list,
.ops-panel-compact .ops-workload-list {
  grid-template-columns: 1fr !important;
}
</style>
