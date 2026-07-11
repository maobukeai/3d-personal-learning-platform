<script setup lang="ts">
import { formatDate } from '@/utils/format';
import { ref, computed, type Component } from 'vue';
import { useCommunityI18n } from '@/composables/useCommunityI18n';
import { useAuthStore } from '@/stores/auth';
import {
  ShieldCheck,
  Clock,
  Circle,
  Crown,
  Plus,
  RefreshCw,
  Search,
  MoreHorizontal,
  LayoutGrid,
  List,
} from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import Button from '@/components/ui/Button.vue';
import Dropdown from '@/components/ui/Dropdown.vue';

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

interface OverviewMember {
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  metrics: MemberMetrics;
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
  members: OverviewMember[];
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
    icon: Component;
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

const authStore = useAuthStore();

const { t } = useCommunityI18n();

const activeFilter = ref<MemberFilter>('all');
const memberSearchQuery = ref('');
const viewMode = ref<'grid' | 'list'>('grid');

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
</script>

<template>
  <div class="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500 mobile-adaptive">
    <!-- Header & Actions -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2"
      style="border-color: var(--border-base)"
    >
      <!-- Left: Title & Refresh -->
      <div class="flex items-center gap-3 shrink-0">
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

      <!-- Center: Centered Search Input -->
      <div class="flex justify-center flex-1 w-full sm:max-w-xs md:max-w-md sm:px-4 shrink-0">
        <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 shrink-0">
          <Search />
          <input
            v-model="memberSearchQuery"
            type="text"
            :placeholder="t('teamDetail.searchPlaceholder')"
          />
        </label>
      </div>

      <!-- Right: View Mode Switcher & Invite Button -->
      <div
        class="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-between sm:justify-end"
      >
        <!-- View Mode Switcher -->
        <div
          v-if="activeFilter !== 'pending'"
          class="flex items-center gap-1 border border-slate-200/50 dark:border-white/10 rounded-lg p-0.5 bg-slate-100/50 dark:bg-white/5 shrink-0"
        >
          <button
            type="button"
            class="p-1.5 rounded-md transition-colors cursor-pointer border-none bg-transparent"
            :class="
              viewMode === 'grid'
                ? 'text-accent bg-white dark:bg-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            "
            title="卡片网格"
            @click="viewMode = 'grid'"
          >
            <LayoutGrid class="w-4 h-4" />
          </button>
          <button
            type="button"
            class="p-1.5 rounded-md transition-colors cursor-pointer border-none bg-transparent"
            :class="
              viewMode === 'list'
                ? 'text-accent bg-white dark:bg-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            "
            title="表格列表"
            @click="viewMode = 'list'"
          >
            <List class="w-4 h-4" />
          </button>
        </div>

        <Button
          v-if="canManageTeam"
          variant="primary"
          size="sm"
          :icon="Plus"
          class="hover:scale-105 transition-transform font-bold text-xs shrink-0"
          @click="emit('invite-member')"
        >
          {{ t('teamDetail.inviteNewMember') }}
        </Button>
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
        class="flex items-center justify-between p-4 bg-white/40 dark:bg-slate-900/20 border border-white/20 dark:border-slate-800/50 rounded-xl mobile-row"
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
            <Button
              v-if="canManageTeam"
              variant="danger"
              size="sm"
              class="!py-1 !px-2.5 !text-[10px] font-black"
              @click="emit('cancel-invitation', item.id)"
            >
              撤销邀请
            </Button>
          </template>
          <template v-else>
            <div class="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                class="!py-1 !px-2.5 !text-[10px] hover:!bg-rose-500 hover:!text-white hover:!border-rose-500 font-black"
                @click="emit('respond-application', item.id, false, item.title)"
              >
                拒绝
              </Button>
              <Button
                variant="primary"
                size="sm"
                class="!py-1 !px-2.5 !text-[10px] !bg-emerald-500 hover:!bg-emerald-600 border-none font-black"
                @click="emit('respond-application', item.id, true, item.title)"
              >
                同意
              </Button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Active Members View -->
    <div v-else>
      <!-- Grid View of Members -->
      <div v-if="viewMode === 'grid'" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div
          v-for="member in filteredRows"
          :key="member.id"
          class="glass-card p-5 rounded-2xl border border-white/20 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/30 backdrop-blur-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative flex flex-col justify-between"
        >
          <!-- Top Info -->
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="relative shrink-0">
                <UserAvatar
                  :user="member.user"
                  size="md"
                  class="cursor-pointer hover:ring-2 hover:ring-accent transition-all shrink-0"
                  @click="emit('open-profile', member.userId)"
                />
                <div
                  class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center"
                  :class="authStore.isUserOnline(member.userId) ? 'bg-emerald-500' : 'bg-slate-400'"
                ></div>
              </div>
              <div class="min-w-0 text-left">
                <button
                  type="button"
                  class="block text-xs font-black truncate bg-transparent border-none p-0 cursor-pointer hover:text-accent outline-none text-left"
                  style="color: var(--text-primary)"
                  @click="
                    team.type === 'TEAM'
                      ? emit('open-workbench', member.userId)
                      : emit('open-profile', member.userId)
                  "
                >
                  {{ memberNameStr(member) }}
                </button>
                <span class="block text-[10px] text-slate-400 truncate mt-0.5">
                  {{ member.user.email }}
                </span>
              </div>
            </div>

            <!-- Role Badge -->
            <span
              class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black shrink-0"
              :class="roleBadgeClass(member.role)"
            >
              <Crown v-if="member.role === 'OWNER'" class="w-3 h-3" />
              <ShieldCheck v-else-if="member.role === 'ADMIN'" class="w-3 h-3" />
              {{ roleLabel(member.role) }}
            </span>
          </div>

          <!-- Middle Details (TEAM type metrics) -->
          <div
            v-if="team.type === 'TEAM'"
            class="mt-4 pt-4 border-t border-slate-200/50 dark:border-white/5 space-y-3"
          >
            <!-- Load progress -->
            <div>
              <div class="flex justify-between text-[10px] font-black mb-1">
                <span class="text-slate-400">进行中任务 ({{ member.metrics.activeTasks }})</span>
                <span :class="member.metrics.overdueTasks > 0 ? 'text-rose-500' : 'text-accent'">
                  完成率 {{ member.metrics.completionRate }}%
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
            </div>

            <!-- Stat tags -->
            <div class="flex flex-wrap gap-2 text-[9px] font-bold text-slate-400">
              <span class="px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded-md">
                已完 {{ member.metrics.doneTasks }}
              </span>
              <span class="px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded-md">
                项目 {{ member.metrics.projects }}
              </span>
              <span
                v-if="member.metrics.overdueTasks > 0"
                class="px-2 py-0.5 bg-rose-500/10 text-rose-500 rounded-md"
              >
                逾期 {{ member.metrics.overdueTasks }}
              </span>
            </div>
          </div>

          <!-- Footer Actions -->
          <div
            class="mt-5 pt-3 border-t border-slate-200/50 dark:border-white/5 flex items-center justify-between"
          >
            <span class="text-[10px] font-bold text-slate-400">
              最近协作: {{ formatDate(member.metrics.lastTaskAt || member.joinedAt) }}
            </span>

            <div class="flex items-center gap-1.5">
              <Button
                v-if="team.type === 'TEAM'"
                variant="secondary"
                size="sm"
                class="!h-7.5 !px-3 !text-[10px] !bg-accent/10 !text-accent hover:!bg-accent hover:!text-white !border-transparent transition-colors font-black"
                @click="emit('open-workbench', member.userId)"
              >
                画像
              </Button>
              <Dropdown align="right" width-class="w-36">
                <template #trigger>
                  <button
                    type="button"
                    class="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border-none cursor-pointer text-slate-400 hover:text-accent transition-colors flex items-center justify-center"
                    style="color: var(--text-secondary)"
                  >
                    <MoreHorizontal class="w-4 h-4" />
                  </button>
                </template>
                <template #content>
                  <button
                    type="button"
                    class="w-full text-left px-3 py-2 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-700 dark:text-slate-300 transition-colors border-none bg-transparent cursor-pointer"
                    @click="emit('open-workbench', member.userId)"
                  >
                    打开画像
                  </button>
                  <button
                    type="button"
                    class="w-full text-left px-3 py-2 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-700 dark:text-slate-300 transition-colors border-none bg-transparent cursor-pointer"
                    @click="emit('open-profile', member.userId)"
                  >
                    查看资料
                  </button>
                  <button
                    v-if="member.userId !== authStore.user?.id"
                    type="button"
                    class="w-full text-left px-3 py-2 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-700 dark:text-slate-300 transition-colors border-none bg-transparent cursor-pointer"
                    @click="emit('start-chat', member.user)"
                  >
                    发起私聊
                  </button>
                  <template
                    v-if="
                      canManageTeam &&
                      member.userId !== authStore.user?.id &&
                      member.role !== 'OWNER'
                    "
                  >
                    <div class="h-[1px] bg-slate-200 dark:bg-white/10 my-1"></div>
                    <button
                      type="button"
                      class="w-full text-left px-3 py-2 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-rose-500 transition-colors border-none bg-transparent cursor-pointer"
                      @click="emit('remove-member', member.userId, member.user.name)"
                    >
                      移出空间
                    </button>
                  </template>
                </template>
              </Dropdown>
            </div>
          </div>
        </div>
      </div>

      <!-- List (Table) View of Members -->
      <div v-else class="overflow-x-auto scrollbar-hide member-table-wrap">
        <table class="member-table mobile-table">
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
                      class="block text-xs font-black truncate bg-transparent border-none p-0 cursor-pointer hover:text-accent max-w-full md:max-w-[190px] text-left outline-none"
                      style="color: var(--text-primary)"
                      @click="
                        team.type === 'TEAM'
                          ? emit('open-workbench', member.userId)
                          : emit('open-profile', member.userId)
                      "
                    >
                      {{ memberNameStr(member) }}
                    </button>
                    <p class="text-[10px] text-slate-400 truncate max-w-full md:max-w-[210px]">
                      {{ member.user.email }}
                    </p>
                  </div>
                </div>
              </td>
              <td>
                <Select
                  v-if="
                    canManageTeam && member.userId !== authStore.user?.id && member.role !== 'OWNER'
                  "
                  :model-value="member.role"
                  class="role-select"
                  @change="(role: unknown) => emit('update-role', member.userId, String(role))"
                >
                  <SelectOption label="管理员" value="ADMIN" />
                  <SelectOption label="成员" value="MEMBER" />
                </Select>
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
                        authStore.isUserOnline(member.userId)
                          ? 'text-emerald-500'
                          : 'text-slate-300'
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
                <div class="w-full md:w-36 text-left">
                  <div class="flex justify-between text-[10px] font-black mb-1">
                    <span class="text-slate-400">进行 {{ member.metrics.activeTasks }}</span>
                    <span
                      :class="member.metrics.overdueTasks > 0 ? 'text-rose-500' : 'text-accent'"
                    >
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
                  <Button
                    v-if="team.type === 'TEAM'"
                    variant="secondary"
                    size="sm"
                    class="!h-7 !px-2.5 !text-[10px] !bg-accent/10 !text-accent hover:!bg-accent hover:!text-white !border-transparent transition-colors font-black"
                    @click="emit('open-workbench', member.userId)"
                  >
                    画像
                  </Button>
                  <Dropdown align="right" width-class="w-36">
                    <template #trigger>
                      <button
                        type="button"
                        class="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border-none cursor-pointer text-slate-400 hover:text-accent transition-colors flex items-center justify-center"
                        style="color: var(--text-secondary)"
                      >
                        <MoreHorizontal class="w-4 h-4" />
                      </button>
                    </template>
                    <template #content>
                      <button
                        type="button"
                        class="w-full text-left px-3 py-2 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-700 dark:text-slate-300 transition-colors border-none bg-transparent cursor-pointer"
                        @click="emit('open-workbench', member.userId)"
                      >
                        打开画像
                      </button>
                      <button
                        type="button"
                        class="w-full text-left px-3 py-2 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-700 dark:text-slate-300 transition-colors border-none bg-transparent cursor-pointer"
                        @click="emit('open-profile', member.userId)"
                      >
                        查看资料
                      </button>
                      <button
                        v-if="member.userId !== authStore.user?.id"
                        type="button"
                        class="w-full text-left px-3 py-2 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-700 dark:text-slate-300 transition-colors border-none bg-transparent cursor-pointer"
                        @click="emit('start-chat', member.user)"
                      >
                        发起私聊
                      </button>
                      <template
                        v-if="
                          canManageTeam &&
                          member.userId !== authStore.user?.id &&
                          member.role !== 'OWNER'
                        "
                      >
                        <div class="h-[1px] bg-slate-200 dark:bg-white/10 my-1"></div>
                        <button
                          type="button"
                          class="w-full text-left px-3 py-2 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-rose-500 transition-colors border-none bg-transparent cursor-pointer"
                          @click="emit('remove-member', member.userId, member.user.name)"
                        >
                          移出空间
                        </button>
                      </template>
                    </template>
                  </Dropdown>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.member-table {
  width: 100%;
  min-width: 820px;
  border-collapse: collapse;
  text-align: left;
}

.member-table th {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-base);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
}

.member-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-base);
  vertical-align: middle;
}

.member-table tbody tr:last-child td {
  border-bottom: 0;
}

.member-table tbody tr:hover {
  background: rgb(148 163 184 / 0.07);
}
@media (max-width: 1024px) {
  .member-table {
    min-width: 720px;
  }
}
@media (max-width: 767px) {
  .member-table-wrap {
    overflow-x: hidden;
  }
  .member-table {
    min-width: 100%;
    table-layout: fixed;
    width: 100%;
  }
  .member-table th,
  .member-table td {
    word-break: break-word;
  }
}
</style>
