<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowRight } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';

interface TeamUser {
  id: string;
  name: string;
  avatarUrl?: string | null;
  email?: string;
  role?: string;
}

interface DetailedMember {
  id: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  user: TeamUser;
  joinedAt?: string;
}

interface DetailedInvitation {
  id: string;
  inviteeEmail: string;
  role: string;
  createdAt: string;
}

interface DetailedApplication {
  id: string;
  userId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  user: TeamUser;
  createdAt: string;
  message?: string | null;
}

interface DetailedTeam {
  id: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  type: 'PERSONAL' | 'TEAM';
  visibility: 'PUBLIC' | 'PRIVATE';
  category?: string | null;
  ownerId: string;
  createdAt?: string;
  members: DetailedMember[];
  invitations?: DetailedInvitation[];
  applications?: DetailedApplication[];
}

interface InsightUser {
  id: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

interface InsightActionItem {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  dueDate?: string | null;
  projectId?: string | null;
  assignee?: InsightUser | null;
  targetRoute: string;
}

interface InsightActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  actor?: InsightUser | null;
  createdAt: string;
  targetRoute: string;
}

interface InsightProjectHealth {
  id: string;
  title: string;
  healthScore: number;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  reasons: string[];
}

interface InsightMemberCapacity {
  userId: string;
  focus: string;
  capacityScore: number;
  activeTasks: number;
  overdueTasks: number;
  completedThisWeek: number;
}

interface TeamCollaborationInsights {
  summary: {
    healthScore: number;
    completedThisWeek: number;
    overdueTasks: number;
    dueSoonTasks: number;
    unassignedTasks: number;
    highRiskProjects: number;
    pendingApplications: number;
  };
  projectHealth: InsightProjectHealth[];
  memberCapacity: InsightMemberCapacity[];
  actionItems: InsightActionItem[];
  activity: InsightActivityItem[];
}

type RecommendationSeverity = 'critical' | 'high' | 'medium' | 'low';

const props = defineProps<{
  team: DetailedTeam | null;
  insights: TeamCollaborationInsights | null;
}>();

const router = useRouter();

const healthScore = computed(() => props.insights?.summary.healthScore ?? 100);

const healthLabel = computed(() => {
  if (healthScore.value >= 82) return '健康';
  if (healthScore.value >= 64) return '观察';
  return '高风险';
});

const healthToneClass = computed(() => {
  if (healthScore.value >= 82) return 'tone-emerald';
  if (healthScore.value >= 64) return 'tone-amber';
  return 'tone-rose';
});

const highRiskProjects = computed(
  () => props.insights?.projectHealth.filter((project) => project.riskLevel !== 'LOW') || [],
);

const actionItems = computed(() => props.insights?.actionItems || []);
const activityItems = computed(() => props.insights?.activity || []);

const navigateInsight = (targetRoute?: string) => {
  if (targetRoute) {
    router.push(targetRoute);
  }
};

const capacityBadgeVariant = (workload: number) => {
  if (workload < 30) return 'success';
  if (workload < 60) return 'info';
  if (workload < 80) return 'warning';
  return 'danger';
};

const capacityTextClass = (workload: number) => {
  if (workload < 30) return 'text-emerald-500';
  if (workload < 60) return 'text-cyan-500';
  if (workload < 80) return 'text-amber-500';
  return 'text-rose-500';
};

const severityBadgeVariant = (severity: InsightActionItem['severity'] | RecommendationSeverity) => {
  if (severity === 'critical') return 'danger';
  if (severity === 'high') return 'warning';
  return 'info';
};

const severityLabel = (severity: InsightActionItem['severity'] | RecommendationSeverity) => {
  if (severity === 'critical') return '紧急';
  if (severity === 'high') return '高';
  return '中';
};

const activityDotClass = (type: string) => {
  if (type.startsWith('task')) return 'bg-accent';
  if (type.startsWith('project')) return 'bg-emerald-500';
  if (type.startsWith('team')) return 'bg-purple-500';
  return 'bg-slate-400';
};

const formatRelativeTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
};
</script>

<template>
  <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left Panel: Health Gauge & Capacity -->
      <div class="space-y-6">
        <!-- Space Health Card -->
        <Card class="flex flex-col items-center py-6 text-center animate-in" hoverable glow>
          <template #header>
            <h3
              class="text-xs font-black uppercase tracking-wider text-center"
              style="color: var(--text-primary)"
            >
              空间健康度
            </h3>
          </template>
          <div class="relative w-36 h-36 flex items-center justify-center mt-2">
            <!-- Circular Gauge Indicator -->
            <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="var(--border-base)"
                stroke-width="8"
                fill="transparent"
                class="text-slate-200 dark:text-slate-800"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="currentColor"
                stroke-width="8"
                fill="transparent"
                stroke-dasharray="251.2"
                :stroke-dashoffset="251.2 - (251.2 * healthScore) / 100"
                :class="healthToneClass"
              />
            </svg>
            <div class="absolute flex flex-col items-center">
              <span class="text-3xl font-black" style="color: var(--text-primary)">
                {{ healthScore }}
              </span>
              <span
                class="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider mt-1"
                :class="healthToneClass"
              >
                {{ healthLabel }}
              </span>
            </div>
          </div>
          <p class="text-xs text-slate-450 dark:text-slate-400 mt-4 px-6 leading-relaxed">
            该得分基于任务逾期率、成员高负载比例以及项目风险综合计算。
          </p>
        </Card>

        <!-- Capacity Load List -->
        <Card hoverable>
          <template #header>
            <div class="flex items-center justify-between w-full">
              <h3
                class="text-xs font-black uppercase tracking-wider"
                style="color: var(--text-primary)"
              >
                成员容量排行
              </h3>
              <span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider"
                >工作负荷百分比</span
              >
            </div>
          </template>

          <div
            v-if="!insights || insights.memberCapacity.length === 0"
            class="compact-empty py-8 text-center text-xs text-slate-400"
          >
            暂无负荷记录
          </div>
          <div v-else class="space-y-3 mt-1">
            <div
              v-for="cap in insights.memberCapacity.slice(0, 5)"
              :key="cap.userId"
              class="flex items-center justify-between p-2 rounded-xl bg-slate-50/50 dark:bg-white/3 border border-slate-100/40 dark:border-slate-800/30 transition-all hover:translate-x-1"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <UserAvatar
                  v-if="team?.members.find((m) => m.userId === cap.userId)"
                  :user="team.members.find((m) => m.userId === cap.userId)!.user"
                  size="xs"
                  class="shrink-0"
                />
                <span class="text-xs font-black truncate" style="color: var(--text-primary)">
                  {{ team?.members.find((m) => m.userId === cap.userId)?.user.name || '团队成员' }}
                </span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <!-- Compute workload = 100 - capacityScore -->
                <span
                  class="text-[11px] font-black"
                  :class="capacityTextClass(100 - cap.capacityScore)"
                >
                  {{ 100 - cap.capacityScore }}%
                </span>
                <Badge :variant="capacityBadgeVariant(100 - cap.capacityScore)" outline>
                  {{ cap.focus }}
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <!-- Middle & Right Panel: Project Health Risk & Action Items & Activity Feed -->
      <div class="space-y-6 lg:col-span-2">
        <!-- High Risk Projects -->
        <Card hoverable>
          <template #header>
            <h3
              class="text-xs font-black uppercase tracking-wider"
              style="color: var(--text-primary)"
            >
              高风险项目
            </h3>
          </template>

          <div
            v-if="highRiskProjects.length === 0"
            class="compact-empty py-8 text-center text-xs text-slate-400"
          >
            暂无风险项目，运行良好
          </div>
          <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
            <div
              v-for="proj in highRiskProjects"
              :key="proj.id"
              class="p-3 bg-rose-500/5 border border-rose-500/15 rounded-xl flex flex-col justify-between text-left"
            >
              <div>
                <div class="flex items-center justify-between mb-2">
                  <strong class="text-xs font-black text-rose-500 truncate">{{
                    proj.title
                  }}</strong>
                  <Badge variant="danger" outline> {{ proj.healthScore }}分 </Badge>
                </div>
                <ul class="space-y-1.5">
                  <li
                    v-for="(reason, idx) in proj.reasons"
                    :key="idx"
                    class="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-start gap-1.5 text-left leading-normal"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0"></span>
                    <span>{{ reason }}</span>
                  </li>
                </ul>
              </div>
              <button
                type="button"
                class="mt-4 w-full py-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 rounded-lg text-xs font-black transition-colors cursor-pointer border-none"
                @click="navigateInsight(`/project/${proj.id}`)"
              >
                处理项目风险
              </button>
            </div>
          </div>
        </Card>

        <!-- Suggested Action Items -->
        <Card hoverable>
          <template #header>
            <h3
              class="text-xs font-black uppercase tracking-wider"
              style="color: var(--text-primary)"
            >
              建议处理动作
            </h3>
          </template>

          <div
            v-if="actionItems.length === 0"
            class="compact-empty py-8 text-center text-xs text-slate-400"
          >
            当前无待办建议
          </div>
          <div v-else class="space-y-2 mt-1">
            <button
              v-for="item in actionItems.slice(0, 6)"
              :key="item.id"
              type="button"
              class="drawer-action w-full block bg-transparent"
              @click="navigateInsight(item.targetRoute)"
            >
              <Badge :variant="severityBadgeVariant(item.severity)">
                {{ severityLabel(item.severity) }}
              </Badge>
              <span class="min-w-0 flex-1 text-left pl-1">
                <span class="block text-xs font-black truncate" style="color: var(--text-primary)">
                  {{ item.title }}
                </span>
                <span
                  class="block text-[10px] font-bold text-slate-400 dark:text-slate-450 truncate mt-0.5"
                >
                  {{ item.description }}
                </span>
              </span>
              <ArrowRight
                class="w-4 h-4 text-slate-350 shrink-0 group-hover:translate-x-0.5 transition-transform"
              />
            </button>
          </div>
        </Card>

        <!-- Activity Feed Timeline -->
        <Card hoverable>
          <template #header>
            <h3
              class="text-xs font-black uppercase tracking-wider"
              style="color: var(--text-primary)"
            >
              团队活动记录
            </h3>
          </template>

          <div
            v-if="activityItems.length === 0"
            class="compact-empty py-8 text-center text-xs text-slate-400"
          >
            暂无新动态
          </div>
          <div v-else class="space-y-2.5 mt-1">
            <button
              v-for="item in activityItems.slice(0, 6)"
              :key="item.id"
              type="button"
              class="activity-row w-full flex items-start bg-transparent"
              @click="navigateInsight(item.targetRoute)"
            >
              <span
                class="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                :class="activityDotClass(item.type)"
              ></span>
              <span class="min-w-0 flex-1 text-left pl-2.5">
                <span class="block text-xs font-black truncate" style="color: var(--text-primary)">
                  {{ item.title }}
                </span>
                <span
                  class="block text-[10px] font-bold text-slate-400 dark:text-slate-450 truncate mt-0.5"
                >
                  {{ item.description }}
                </span>
              </span>
              <span class="text-[10px] font-black text-slate-400 shrink-0 ml-2">
                {{ formatRelativeTime(item.createdAt) }}
              </span>
            </button>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Tone variables inside the component scope */
.tone-emerald {
  color: rgb(16 185 129) !important;
  background-color: rgb(16 185 129 / 0.1) !important;
}

.tone-amber {
  color: rgb(245 158 11) !important;
  background-color: rgb(245 158 11 / 0.12) !important;
}

.tone-rose {
  color: rgb(244 63 94) !important;
  background-color: rgb(244 63 94 / 0.1) !important;
}

/* Custom premium list items styling */
.drawer-action,
.activity-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  border: 1px solid var(--border-base);
  border-radius: 12px;
  background: var(--bg-card);
  padding: 10px 14px;
  text-align: left;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.drawer-action:hover,
.activity-row:hover {
  background: var(--bg-card-hover) !important;
  border-color: var(--accent-subtle) !important;
  transform: translateX(4px);
  box-shadow: var(--shadow-sm);
}
</style>
