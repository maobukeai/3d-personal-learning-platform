<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import {
  Users,
  ShieldCheck,
  UserCog,
  Briefcase,
  AlertTriangle,
  Clock,
  Circle,
  Crown,
  Plus,
  RefreshCw,
  Search,
  MoreHorizontal,
} from 'lucide-vue-next';
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

interface MemberMetrics {
  projects: number;
  assignedTasks: number;
  activeTasks: number;
  doneTasks: number;
  dueSoonTasks: number;
  overdueTasks: number;
  recentlyCompleted: number;
  completionRate: number;
  lastTaskAt?: string | null;
}

interface MemberRow extends DetailedMember {
  metrics: MemberMetrics;
}

interface InsightMemberCapacity {
  userId: string;
  focus: string;
  capacityScore: number;
  activeTasks: number;
  overdueTasks: number;
  completedThisWeek: number;
}

interface TeamOverview {
  currentUserRole: 'OWNER' | 'ADMIN' | 'MEMBER' | null;
  capabilities: {
    canManage: boolean;
    canInvite: boolean;
    canUpdateRoles: boolean;
    canRemoveMembers: boolean;
    canLeave: boolean;
  };
  counts: {
    members: number;
    admins: number;
    pendingInvitations: number;
    pendingApplications: number;
    projects: number;
    activeProjects: number;
    tasks: number;
    overdueTasks: number;
    dueSoonTasks: number;
    completedThisWeek: number;
  };
  members: any[];
  invitations: DetailedInvitation[];
  applications: DetailedApplication[];
}

type MemberFilter = 'all' | 'admins' | 'members' | 'busy' | 'risk' | 'pending';

type PendingItem =
  | {
      id: string;
      kind: 'invite';
      title: string;
      subtitle: string;
      createdAt: string;
      invitation: DetailedInvitation;
    }
  | {
      id: string;
      kind: 'application';
      title: string;
      subtitle: string;
      createdAt: string;
      application: DetailedApplication;
    };

const props = defineProps<{
  team: DetailedTeam;
  overview: TeamOverview | null;
  opsKpis: Array<{
    key: string;
    label: string;
    value: string | number;
    helper: string;
    icon: any;
    tone: string;
  }>;
  isRefreshing: boolean;
  canManageTeam: boolean;
  capacityByUserId: Map<string, InsightMemberCapacity>;
  memberRows: MemberRow[];
}>();

const emit = defineEmits<{
  (e: 'manual-refresh'): void;
  (e: 'invite-member'): void;
  (e: 'cancel-invitation', id: string): void;
  (e: 'respond-application', id: string, approve: boolean, title: string): void;
  (e: 'open-profile', userId: string): void;
  (e: 'open-workbench', userId: string): void;
  (e: 'update-role', userId: string, role: string): void;
  (e: 'start-chat', user: TeamUser): void;
  (e: 'remove-member', userId: string, name: string): void;
}>();

const { t: i18nT } = useI18n();
const authStore = useAuthStore();

const t = (key: string, ...args: any[]) => {
  const prefixes = ['showcase.', 'teams.', 'members.', 'teamDetail.', 'discussions.', 'chat.'];
  if (prefixes.some((p) => key.startsWith(p))) {
    return (i18nT as any)(`community.${key}`, ...args);
  }
  return (i18nT as any)(key, ...args);
};

const activeFilter = ref<MemberFilter>('all');
const memberSearchQuery = ref('');

const pendingInvitationsList = computed(
  () => props.overview?.invitations || props.team?.invitations || [],
);
const pendingApplicationsList = computed(
  () => props.overview?.applications || props.team?.applications || [],
);

const visiblePendingItems = computed<PendingItem[]>(() => {
  const invites = pendingInvitationsList.value.map((inv) => ({
    id: inv.id,
    kind: 'invite' as const,
    title: inv.inviteeEmail,
    subtitle: '受邀加入空间',
    createdAt: inv.createdAt,
    invitation: inv,
  }));
  const apps = pendingApplicationsList.value.map((app) => ({
    id: app.id,
    kind: 'application' as const,
    title: app.user.name || app.user.email || '申请人',
    subtitle: app.message || '申请加入空间',
    createdAt: app.createdAt,
    application: app,
  }));
  return [...invites, ...apps];
});

const filteredRows = computed(() => {
  let list = props.memberRows;
  if (memberSearchQuery.value) {
    const query = memberSearchQuery.value.toLowerCase();
    list = list.filter(
      (row) =>
        row.user.name?.toLowerCase().includes(query) ||
        row.user.email?.toLowerCase().includes(query),
    );
  }

  if (activeFilter.value === 'admins') {
    return list.filter((row) => row.role !== 'MEMBER');
  }
  if (activeFilter.value === 'members') {
    return list.filter((row) => row.role === 'MEMBER');
  }
  if (activeFilter.value === 'busy') {
    return list.filter((row) => (props.capacityByUserId.get(row.userId)?.capacityScore ?? 0) >= 80);
  }
  if (activeFilter.value === 'risk') {
    return list.filter(
      (row) =>
        row.metrics.overdueTasks > 0 ||
        (props.capacityByUserId.get(row.userId)?.capacityScore ?? 0) >= 90,
    );
  }
  return list;
});

const filters = [
  { value: 'all', label: '全部', icon: Users },
  { value: 'admins', label: '管理组', icon: ShieldCheck },
  { value: 'members', label: '成员', icon: UserCog },
  { value: 'busy', label: '高负载', icon: Briefcase },
  { value: 'risk', label: '有风险', icon: AlertTriangle },
  { value: 'pending', label: '待处理', icon: Clock },
] as const;

const filterCount = (val: MemberFilter) => {
  if (val === 'all') return props.memberRows.length;
  if (val === 'admins') return props.memberRows.filter((row) => row.role !== 'MEMBER').length;
  if (val === 'members') return props.memberRows.filter((row) => row.role === 'MEMBER').length;
  if (val === 'busy') {
    return props.memberRows.filter(
      (row) => (props.capacityByUserId.get(row.userId)?.capacityScore ?? 0) >= 80,
    ).length;
  }
  if (val === 'risk') {
    return props.memberRows.filter(
      (row) =>
        row.metrics.overdueTasks > 0 ||
        (props.capacityByUserId.get(row.userId)?.capacityScore ?? 0) >= 90,
    ).length;
  }
  if (val === 'pending') {
    return visiblePendingItems.value.length;
  }
  return 0;
};

// Formatting helpers
const memberNameStr = (member: MemberRow) => {
  return member.user.name || member.user.email || '未命名';
};

const progressWidthStr = (activeTasks: number) => {
  return `${Math.min(100, activeTasks * 16)}%`;
};

const capacityLabel = (userId: string) => {
  return props.capacityByUserId.get(userId)?.focus || '稳定推进';
};

const roleLabel = (role?: string) => {
  if (role === 'OWNER') return '所有者';
  if (role === 'ADMIN') return '管理员';
  return '成员';
};

const roleBadgeClass = (role?: string) => {
  if (role === 'OWNER') return 'bg-amber-500/10 text-amber-500 border border-amber-500/25';
  if (role === 'ADMIN') return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/25';
  return 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-white/10';
};

const capacityClass = (score?: number) => {
  if (score === undefined || score < 60) return 'bg-emerald-500/10 text-emerald-500';
  if (score < 80) return 'bg-sky-500/10 text-sky-500';
  if (score < 90) return 'bg-amber-500/10 text-amber-500';
  return 'bg-rose-500/10 text-rose-500';
};

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
</script>

<template>
  <div class="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <!-- KPIs Stats Dashboard Bar for TEAM type -->
    <div v-if="team.type === 'TEAM'" class="grid grid-cols-2 lg:grid-cols-6 gap-3">
      <div
        v-for="kpi in opsKpis"
        :key="kpi.key"
        class="flex items-center gap-3 backdrop-blur-md bg-white/40 dark:bg-slate-900/30 border border-white/15 dark:border-slate-800/50 rounded-xl p-3 shadow-sm hover:-translate-y-0.5 transition-all duration-200 text-left"
      >
        <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" :class="kpi.tone">
          <component :is="kpi.icon" class="w-4 h-4" />
        </div>
        <div class="min-w-0">
          <span
            class="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none"
            >{{ kpi.label }}</span
          >
          <strong
            class="block text-base lg:text-lg font-black tracking-tight mt-1 leading-none"
            style="color: var(--text-primary)"
            >{{ kpi.value }}</strong
          >
          <span class="block text-[9px] font-bold text-slate-400 mt-1 leading-none">{{
            kpi.helper
          }}</span>
        </div>
      </div>
    </div>

    <!-- Header & Actions -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3.5"
      style="border-color: var(--border-base)"
    >
      <div class="flex items-center gap-3">
        <h2 class="text-base sm:text-lg font-black" style="color: var(--text-primary)">
          {{ t('teamDetail.boardTitle') }}
        </h2>
        <button
          v-if="team.type === 'TEAM'"
          type="button"
          class="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded-md text-slate-400 transition-all cursor-pointer border-none bg-transparent"
          :class="isRefreshing ? 'animate-spin' : ''"
          title="同步数据"
          @click="emit('manual-refresh')"
        >
          <RefreshCw class="w-3.5 h-3.5" />
        </button>
      </div>
      <div class="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
        <div class="relative w-full sm:w-56 md:w-64">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            v-model="memberSearchQuery"
            type="text"
            :placeholder="t('teamDetail.searchPlaceholder')"
            class="w-full pl-9 pr-4 py-2 bg-white/40 dark:bg-slate-900/20 border border-white/20 dark:border-slate-800/50 rounded-lg text-xs focus:ring-4 focus:ring-accent/10 outline-none transition-all placeholder-slate-400"
            style="color: var(--text-primary)"
          />
        </div>
        <button
          v-if="canManageTeam"
          type="button"
          class="w-full sm:w-auto flex items-center justify-center gap-1 px-3.5 py-2 bg-accent text-white rounded-lg font-bold text-xs hover:scale-105 active:scale-95 hover:shadow-md hover:shadow-accent/20 transition-all cursor-pointer whitespace-nowrap border-none"
          @click="emit('invite-member')"
        >
          <Plus class="w-3.5 h-3.5" />
          {{ t('teamDetail.inviteNewMember') }}
        </button>
      </div>
    </div>

    <!-- Filter Chips for TEAM type -->
    <div
      class="flex items-center justify-between border-b py-2 px-1"
      :class="team.type === 'TEAM' ? '' : 'hidden'"
      style="border-color: var(--border-base)"
    >
      <div class="flex items-center gap-2 overflow-x-auto scrollbar-hide min-w-0">
        <button
          v-for="filter in filters"
          :key="filter.value"
          type="button"
          class="filter-chip border-none cursor-pointer"
          :class="activeFilter === filter.value ? 'is-active' : ''"
          @click="activeFilter = filter.value"
        >
          <component :is="filter.icon" class="w-3.5 h-3.5" />
          <span>{{ filter.label }}</span>
          <b>{{ filterCount(filter.value) }}</b>
        </button>
      </div>
      <div class="hidden lg:flex items-center gap-2 text-[10px] font-black text-slate-400 shrink-0">
        <span
          >{{
            activeFilter === 'pending' ? visiblePendingItems.length : filteredRows.length
          }}
          条结果</span
        >
        <span>·</span>
        <span>容量按风险优先排序</span>
      </div>
    </div>

    <!-- Pending invitations / applications content list -->
    <div v-if="activeFilter === 'pending'" class="space-y-3">
      <div
        v-if="visiblePendingItems.length === 0"
        class="text-center py-12 text-slate-400 text-xs italic font-bold"
      >
        无待处理邀请或申请
      </div>
      <div
        v-for="item in visiblePendingItems"
        :key="item.id"
        class="flex items-center justify-between p-4 bg-white/40 dark:bg-slate-900/20 border border-white/20 dark:border-slate-800/50 rounded-xl"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-amber-500/10 text-amber-500 shrink-0"
          >
            <Clock class="w-4 h-4" />
          </div>
          <div class="text-left">
            <p class="text-xs font-black" style="color: var(--text-primary)">{{ item.title }}</p>
            <p class="text-[10px] text-slate-400">
              {{ item.subtitle }} · {{ formatDate(item.createdAt) }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <template v-if="item.kind === 'invite'">
            <button
              v-if="canManageTeam"
              type="button"
              class="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 rounded-lg text-[10px] font-black transition-all cursor-pointer border-none"
              @click="emit('cancel-invitation', item.id)"
            >
              撤销邀请
            </button>
          </template>
          <template v-else>
            <div class="flex gap-2">
              <button
                type="button"
                class="px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-rose-500 hover:text-white rounded-lg text-[10px] font-black transition-all cursor-pointer border-none"
                @click="emit('respond-application', item.id, false, item.title)"
              >
                拒绝
              </button>
              <button
                type="button"
                class="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-[10px] font-black transition-all cursor-pointer border-none"
                @click="emit('respond-application', item.id, true, item.title)"
              >
                同意
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Active Members Table View -->
    <div v-else class="overflow-x-auto scrollbar-hide">
      <table class="member-table">
        <thead>
          <tr>
            <th>成员</th>
            <th>角色</th>
            <th>状态</th>
            <th v-if="team.type === 'TEAM'">负载</th>
            <th v-if="team.type === 'TEAM'">项目</th>
            <th>最近协作</th>
            <th class="text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="member in filteredRows" :key="member.id">
            <td>
              <div class="flex items-center gap-2.5 min-w-0">
                <UserAvatar
                  :user="member.user"
                  size="sm"
                  class="cursor-pointer hover:ring-2 hover:ring-accent transition-all"
                  @click="emit('open-profile', member.userId)"
                />
                <div class="min-w-0 text-left">
                  <button
                    type="button"
                    class="block text-xs font-black truncate bg-transparent border-none p-0 cursor-pointer hover:text-accent max-w-[190px] text-left outline-none"
                    style="color: var(--text-primary)"
                    @click="
                      team.type === 'TEAM'
                        ? emit('open-workbench', member.userId)
                        : emit('open-profile', member.userId)
                    "
                  >
                    {{ memberNameStr(member) }}
                  </button>
                  <p class="text-[10px] text-slate-400 truncate max-w-[210px]">
                    {{ member.user.email }}
                  </p>
                </div>
              </div>
            </td>
            <td>
              <el-select
                v-if="
                  canManageTeam && member.userId !== authStore.user?.id && member.role !== 'OWNER'
                "
                :model-value="member.role"
                class="role-select"
                @change="(role: unknown) => emit('update-role', member.userId, String(role))"
              >
                <el-option label="管理员" value="ADMIN" />
                <el-option label="成员" value="MEMBER" />
              </el-select>
              <span
                v-else
                class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black"
                :class="roleBadgeClass(member.role)"
              >
                <Crown v-if="member.role === 'OWNER'" class="w-3 h-3" />
                <ShieldCheck v-else-if="member.role === 'ADMIN'" class="w-3 h-3" />
                {{ roleLabel(member.role) }}
              </span>
            </td>
            <td>
              <div class="space-y-1 text-left">
                <div class="flex items-center gap-1.5">
                  <Circle
                    class="w-2 h-2 fill-current"
                    :class="
                      authStore.isUserOnline(member.userId) ? 'text-emerald-500' : 'text-slate-300'
                    "
                  />
                  <span class="text-[10px] font-black text-slate-500">
                    {{ authStore.isUserOnline(member.userId) ? '在线' : '离线' }}
                  </span>
                </div>
                <span
                  v-if="team.type === 'TEAM'"
                  class="inline-flex px-2 py-0.5 rounded-md text-[9px] font-black"
                  :class="capacityClass(capacityByUserId.get(member.userId)?.capacityScore)"
                >
                  {{ capacityLabel(member.userId) }}
                </span>
              </div>
            </td>
            <td v-if="team.type === 'TEAM'">
              <div class="w-36 text-left">
                <div class="flex justify-between text-[10px] font-black mb-1">
                  <span class="text-slate-400">进行 {{ member.metrics.activeTasks }}</span>
                  <span :class="member.metrics.overdueTasks > 0 ? 'text-rose-500' : 'text-accent'">
                    {{ member.metrics.completionRate }}%
                  </span>
                </div>
                <div class="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full"
                    :class="
                      member.metrics.overdueTasks > 0
                        ? 'bg-rose-500'
                        : member.metrics.activeTasks >= 5
                          ? 'bg-amber-500'
                          : 'bg-accent'
                    "
                    :style="{ width: progressWidthStr(member.metrics.activeTasks) }"
                  ></div>
                </div>
                <p class="mt-1 text-[9px] font-bold text-slate-400">
                  已完 {{ member.metrics.doneTasks }} · 本周
                  {{
                    capacityByUserId.get(member.userId)?.completedThisWeek ??
                    member.metrics.recentlyCompleted
                  }}
                  · 逾期 {{ member.metrics.overdueTasks }}
                </p>
              </div>
            </td>
            <td v-if="team.type === 'TEAM'" class="text-xs font-black text-slate-500 text-left">
              {{ member.metrics.projects }}
            </td>
            <td class="text-xs font-bold text-slate-500 text-left">
              {{ formatDate(member.metrics.lastTaskAt || member.joinedAt) }}
            </td>
            <td class="text-right">
              <div class="inline-flex items-center gap-1.5">
                <button
                  v-if="team.type === 'TEAM'"
                  type="button"
                  class="h-7 px-2 rounded-lg bg-accent/10 text-accent text-[10px] font-black border-none cursor-pointer hover:bg-accent hover:text-white transition-colors"
                  @click="emit('open-workbench', member.userId)"
                >
                  画像
                </button>
                <el-dropdown trigger="click" placement="bottom-end">
                  <button
                    type="button"
                    class="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border-none cursor-pointer text-slate-400 hover:text-accent transition-colors"
                    style="color: var(--text-secondary)"
                  >
                    <MoreHorizontal class="w-4 h-4" />
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu class="!rounded-xl !p-2">
                      <el-dropdown-item
                        class="!rounded-lg !font-bold"
                        @click="emit('open-workbench', member.userId)"
                      >
                        打开画像
                      </el-dropdown-item>
                      <el-dropdown-item
                        class="!rounded-lg !font-bold"
                        @click="emit('open-profile', member.userId)"
                      >
                        查看资料
                      </el-dropdown-item>
                      <el-dropdown-item
                        v-if="member.userId !== authStore.user?.id"
                        class="!rounded-lg !font-bold"
                        @click="emit('start-chat', member.user)"
                      >
                        发起私聊
                      </el-dropdown-item>
                      <template
                        v-if="
                          canManageTeam &&
                          member.userId !== authStore.user?.id &&
                          member.role !== 'OWNER'
                        "
                      >
                        <el-divider class="!my-1" />
                        <el-dropdown-item
                          class="!rounded-lg !font-bold !text-rose-500"
                          @click="emit('remove-member', member.userId, member.user.name)"
                        >
                          移出空间
                        </el-dropdown-item>
                      </template>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
