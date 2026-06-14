<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowRight } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';

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

const capacityClass = (score?: number) => {
  if (score === undefined || score < 60) return 'bg-emerald-500/10 text-emerald-500';
  if (score < 80) return 'bg-sky-500/10 text-sky-500';
  if (score < 90) return 'bg-amber-500/10 text-amber-500';
  return 'bg-rose-500/10 text-rose-500';
};

const severityClass = (severity: InsightActionItem['severity'] | RecommendationSeverity) => {
  if (severity === 'critical') return 'bg-rose-500/10 text-rose-500';
  if (severity === 'high') return 'bg-orange-500/10 text-orange-500';
  return 'bg-amber-500/10 text-amber-500';
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
      <!-- Left Panel: Health Gauge & KPI Summary -->
      <div class="space-y-6">
        <section class="rail-card flex flex-col items-center py-6 text-center">
          <h3 class="rail-title mb-4">空间健康度</h3>
          <div class="relative w-36 h-36 flex items-center justify-center">
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
              <span class="text-3xl font-black" style="color: var(--text-primary)">{{
                healthScore
              }}</span>
              <span
                class="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider mt-1"
                :class="healthToneClass"
              >
                {{ healthLabel }}
              </span>
            </div>
          </div>
          <p class="text-xs text-slate-400 mt-4 px-6">
            该得分基于任务逾期率、成员高负载比例以及项目风险综合计算。
          </p>
        </section>

        <!-- Capacity load list -->
        <section class="rail-card">
          <div class="rail-title">
            <span>成员容量排行</span>
            <span class="text-[9px] text-slate-400 font-bold">工作负荷百分比</span>
          </div>
          <div v-if="!insights || insights.memberCapacity.length === 0" class="compact-empty">
            暂无负荷记录
          </div>
          <div v-else class="space-y-3 mt-2">
            <div
              v-for="cap in insights.memberCapacity.slice(0, 5)"
              :key="cap.userId"
              class="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-white/5"
            >
              <div class="flex items-center gap-2 min-w-0">
                <UserAvatar
                  v-if="team?.members.find((m) => m.userId === cap.userId)"
                  :user="team.members.find((m) => m.userId === cap.userId)!.user"
                  size="xs"
                />
                <span class="text-xs font-black truncate text-slate-700 dark:text-slate-200">
                  {{ team?.members.find((m) => m.userId === cap.userId)?.user.name || '团队成员' }}
                </span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="text-[10px] font-black" :class="capacityClass(cap.capacityScore)">
                  {{ cap.capacityScore }}%
                </span>
                <span
                  class="px-1.5 py-0.2 rounded text-[8px] font-bold"
                  :class="capacityClass(cap.capacityScore)"
                >
                  {{ cap.focus }}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Middle Panel: Project Health Risk & Action Items -->
      <div class="space-y-6 lg:col-span-2">
        <section class="rail-card">
          <h3 class="rail-title">高风险项目</h3>
          <div v-if="highRiskProjects.length === 0" class="compact-empty">
            暂无风险项目，运行良好
          </div>
          <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            <div
              v-for="proj in highRiskProjects"
              :key="proj.id"
              class="p-3 bg-rose-500/5 border border-rose-500/15 rounded-xl flex flex-col justify-between text-left"
            >
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <strong class="text-xs font-black text-rose-500 truncate">{{
                    proj.title
                  }}</strong>
                  <span
                    class="text-[10px] font-black text-rose-600 bg-rose-500/10 px-1.5 py-0.5 rounded"
                  >
                    {{ proj.healthScore }}分
                  </span>
                </div>
                <ul class="space-y-1">
                  <li
                    v-for="(reason, idx) in proj.reasons"
                    :key="idx"
                    class="text-[9px] font-bold text-slate-500 flex items-start gap-1 text-left"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1 shrink-0"></span>
                    <span>{{ reason }}</span>
                  </li>
                </ul>
              </div>
              <button
                type="button"
                class="mt-3 w-full py-1 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 rounded-lg text-[10px] font-black transition-colors cursor-pointer border-none"
                @click="navigateInsight(`/project/${proj.id}`)"
              >
                处理项目风险
              </button>
            </div>
          </div>
        </section>

        <!-- Action items list -->
        <section class="rail-card">
          <h3 class="rail-title">建议处理动作</h3>
          <div v-if="actionItems.length === 0" class="compact-empty">当前无待办建议</div>
          <div v-else class="space-y-2 mt-2">
            <button
              v-for="item in actionItems.slice(0, 6)"
              :key="item.id"
              type="button"
              class="drawer-action hover:bg-accent/5 cursor-pointer border-none text-left w-full block bg-transparent"
              @click="navigateInsight(item.targetRoute)"
            >
              <span
                class="px-1.5 py-0.5 rounded-md text-[9px] font-black shrink-0"
                :class="severityClass(item.severity)"
              >
                {{ severityLabel(item.severity) }}
              </span>
              <span class="min-w-0 flex-1 text-left">
                <span
                  class="block text-[11px] font-black truncate"
                  style="color: var(--text-primary)"
                  >{{ item.title }}</span
                >
                <span class="block text-[9px] font-bold text-slate-400 truncate">{{
                  item.description
                }}</span>
              </span>
              <ArrowRight class="w-3.5 h-3.5 text-slate-300 shrink-0" />
            </button>
          </div>
        </section>

        <!-- Activity Feed Timeline -->
        <section class="rail-card">
          <h3 class="rail-title">团队活动记录</h3>
          <div v-if="activityItems.length === 0" class="compact-empty">暂无新动态</div>
          <div v-else class="space-y-2.5 mt-2">
            <button
              v-for="item in activityItems.slice(0, 6)"
              :key="item.id"
              type="button"
              class="activity-row cursor-pointer border-none text-left w-full flex items-start bg-transparent"
              @click="navigateInsight(item.targetRoute)"
            >
              <span
                class="w-2 h-2 rounded-full mt-1.5 shrink-0"
                :class="activityDotClass(item.type)"
              ></span>
              <span class="min-w-0 flex-1 text-left pl-2">
                <span
                  class="block text-[11px] font-black truncate"
                  style="color: var(--text-primary)"
                  >{{ item.title }}</span
                >
                <span class="block text-[9px] font-bold text-slate-400 truncate">{{
                  item.description
                }}</span>
              </span>
              <span class="text-[9px] font-black text-slate-400 shrink-0">{{
                formatRelativeTime(item.createdAt)
              }}</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
