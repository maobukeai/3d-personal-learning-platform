<script setup lang="ts">
import { formatDate, formatDateTime } from '@/utils/format';
import { cleanTeamDescription } from '@/utils/team';
import { ref, watch, computed } from 'vue';
import {
  Activity,
  AlertTriangle,
  Ban,
  Boxes,
  Briefcase,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  Globe,
  Layers,
  Lock,
  MoreHorizontal,
  RefreshCw,
  Shield,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import Modal from '@/components/ui/Modal.vue';
import Tabs from '@/components/ui/Tabs.vue';
import UiButton from '@/components/ui/Button.vue';
import type {
  AdminTeam,
  TeamDetailResponse,
  AdminTeamUser,
  TeamApplication,
  TeamInvitation,
} from './adminTeamsTypes';

const props = defineProps<{
  modelValue: boolean;
  team: AdminTeam | null;
  detail: TeamDetailResponse | null;
  isDetailLoading: boolean;
  isMobile: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'edit', team: AdminTeam): void;
  (e: 'add-member', team: AdminTeam): void;
  (e: 'delete', team: AdminTeam): void;
  (
    e: 'update-member-role',
    payload: { teamId: string; userId: string; role: 'ADMIN' | 'MEMBER' },
  ): void;
  (e: 'remove-member', payload: { teamId: string; userId: string; label: string }): void;
  (e: 'handle-application', payload: { application: TeamApplication; accept: boolean }): void;
  (e: 'cancel-invitation', invitation: TeamInvitation): void;
}>();

const detailTab = ref<'overview' | 'members' | 'pending' | 'activity'>('overview');

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      detailTab.value = 'overview';
    }
  },
);

const detailTabOptions = computed(() => [
  {
    value: 'overview',
    label: '概览',
    icon: Activity,
    badge: props.detail?.actionItems?.length || 0,
  },
  {
    value: 'members',
    label: '成员',
    icon: Users,
    badge: (props.detail?.members || props.team?.members || []).length || 0,
  },
  {
    value: 'pending',
    label: '申请与邀请',
    icon: AlertTriangle,
    badge: (props.detail?.applications?.length || 0) + (props.detail?.invitations?.length || 0),
  },
  {
    value: 'activity',
    label: '活动',
    icon: Clock,
  },
]);

// Helper/formatting functions
const safeTime = (value?: string | null) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

const relativeTime = (value?: string | null) => {
  const time = safeTime(value);
  if (!time) return '暂无活动';
  const diff = Math.max(0, Date.now() - time);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 30) return `${days} 天前`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前`;
  return `${Math.floor(days / 365)} 年前`;
};

const ownerName = (user?: AdminTeamUser | null) => user?.name || user?.email || '未指定';

const roleLabel = (role: string) => {
  const map: Record<string, string> = {
    OWNER: '负责人',
    ADMIN: '管理员',
    MEMBER: '成员',
  };
  return map[role] || role;
};

const visibilityLabel = (visibility?: string) => (visibility === 'PUBLIC' ? '公开' : '私有');

const riskLabel = (level?: string) => {
  if (level === 'HIGH') return '高风险';
  if (level === 'MEDIUM') return '需关注';
  return '稳定';
};

const activityTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    TASK: '任务',
    PROJECT: '项目',
    APPLICATION: '申请',
    INVITATION: '邀请',
    ASSET: '资产',
    MATERIAL: '材质',
    SHOWCASE: '作品',
  };
  return map[type] || type;
};

const actionItemLabel = (type: string) => {
  const map: Record<string, string> = {
    TASK_OVERDUE: '逾期任务',
    TASK_UNASSIGNED: '未分配任务',
    TASK_DUE_SOON: '即将到期',
    TEAM_APPLICATION: '加入申请',
  };
  return map[type] || type;
};

const riskClass = (level?: string) => ({
  'tone-red': level === 'HIGH',
  'tone-amber': level === 'MEDIUM',
  'tone-green': !level || level === 'LOW',
});

const scoreClass = (score?: number) => ({
  'score-red': (score || 0) < 60,
  'score-amber': (score || 0) >= 60 && (score || 0) < 80,
  'score-green': (score || 0) >= 80,
});

const visibilityClass = (visibility?: string) => ({
  'tone-green': visibility === 'PUBLIC',
  'tone-slate': visibility !== 'PUBLIC',
});

const roleClass = (role: string) => ({
  'tone-amber': role === 'OWNER',
  'tone-blue': role === 'ADMIN',
  'tone-slate': role === 'MEMBER',
});
</script>

<template>
  <Modal :show="modelValue" size="xl" padding="md" @close="emit('update:modelValue', false)">
    <!-- Header Slot (direct child of Modal) -->
    <template #header>
      <div v-if="team && !isDetailLoading" class="flex items-center gap-3 w-full pr-8 mobile-row">
        <div class="team-avatar large shrink-0">
          <img v-if="team.avatarUrl" :src="team.avatarUrl" alt="" />
          <Briefcase v-else />
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="text-base sm:text-lg font-bold truncate text-[var(--text-primary)]">
            {{ team.name }}
          </h2>
          <p
            class="text-[11px] sm:text-xs text-[var(--text-secondary)] whitespace-normal break-words line-clamp-2 max-w-2xl mt-0.5"
          >
            {{ cleanTeamDescription(team.description) || team.category || '暂无团队描述' }}
          </p>
          <div class="drawer-pills flex items-center gap-1.5 mt-1.5">
            <span
              class="pill text-[9px] px-1 py-0.5 rounded leading-none"
              :class="visibilityClass(team.visibility)"
            >
              <component
                :is="team.visibility === 'PUBLIC' ? Globe : Lock"
                class="w-2.5 h-2.5 inline-block align-middle mr-0.5"
              />
              {{ visibilityLabel(team.visibility) }}
            </span>
            <span
              class="pill text-[9px] px-1 py-0.5 rounded leading-none"
              :class="riskClass(detail?.team?.metrics?.riskLevel || team.metrics?.riskLevel)"
            >
              {{ riskLabel(detail?.team?.metrics?.riskLevel || team.metrics?.riskLevel) }}
            </span>
            <span class="pill tone-slate text-[9px] px-1 py-0.5 rounded leading-none"
              >{{ formatDate(team.createdAt) }} 创建</span
            >
          </div>
        </div>
      </div>
      <div v-else class="h-6"></div>
    </template>

    <!-- Default Slot Body -->
    <div class="modal-shell">
      <div
        v-if="isDetailLoading"
        class="loading-state py-12 flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)]"
      >
        <RefreshCw class="spinning w-6 h-6 text-accent" />
        <span>正在加载团队洞察...</span>
      </div>

      <div v-else-if="team" class="space-y-4">
        <!-- Actions Toolbar -->
        <div class="flex items-center gap-2 mb-4 mobile-row">
          <UiButton size="sm" variant="secondary" :icon="Edit3" @click="emit('edit', team)"
            >编辑</UiButton
          >
          <UiButton size="sm" variant="secondary" :icon="UserPlus" @click="emit('add-member', team)"
            >添加成员</UiButton
          >
          <UiButton size="sm" variant="danger" :icon="Trash2" @click="emit('delete', team)"
            >解散</UiButton
          >
        </div>

        <!-- Scoreboard KPI Grid -->
        <section class="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-5 mobile-grid">
          <div
            class="score-hero border rounded-xl p-3 flex flex-col items-center justify-center text-center transition-all duration-300 shadow-sm"
            :class="scoreClass(detail?.counts?.healthScore || team.metrics?.healthScore)"
          >
            <span class="text-[10px] sm:text-xs opacity-90">健康分</span>
            <strong class="text-lg sm:text-xl font-black mt-1">{{
              detail?.counts?.healthScore ?? team.metrics?.healthScore ?? 100
            }}</strong>
          </div>
          <div
            class="border border-base bg-slate-50/50 dark:bg-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center"
          >
            <span class="text-[10px] sm:text-xs text-[var(--text-secondary)]">成员</span>
            <strong class="text-base sm:text-lg font-bold text-[var(--text-primary)] mt-1">{{
              detail?.counts?.members ?? team._count?.members ?? 0
            }}</strong>
          </div>
          <div
            class="border border-base bg-slate-50/50 dark:bg-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center"
          >
            <span class="text-[10px] sm:text-xs text-[var(--text-secondary)]">项目</span>
            <strong class="text-base sm:text-lg font-bold text-[var(--text-primary)] mt-1">{{
              detail?.counts?.projects ?? team._count?.projects ?? 0
            }}</strong>
          </div>
          <div
            class="border border-base bg-slate-50/50 dark:bg-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center"
          >
            <span class="text-[10px] sm:text-xs text-[var(--text-secondary)]">任务</span>
            <strong class="text-base sm:text-lg font-bold text-[var(--text-primary)] mt-1">{{
              detail?.counts?.tasks ?? team._count?.tasks ?? 0
            }}</strong>
          </div>
          <div
            class="border border-base bg-slate-50/50 dark:bg-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center"
          >
            <span class="text-[10px] sm:text-xs text-[var(--text-secondary)]">资源</span>
            <strong class="text-base sm:text-lg font-bold text-[var(--text-primary)] mt-1">{{
              (detail?.counts?.assets || 0) +
              (detail?.counts?.materials || 0) +
              (detail?.counts?.showcases || 0)
            }}</strong>
          </div>
          <div
            class="border border-base bg-slate-50/50 dark:bg-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center"
          >
            <span class="text-[10px] sm:text-xs text-[var(--text-secondary)]">待处理</span>
            <strong class="text-base sm:text-lg font-bold text-[var(--text-primary)] mt-1">{{
              (detail?.counts?.pendingApplications || 0) + (detail?.counts?.pendingInvitations || 0)
            }}</strong>
          </div>
        </section>

        <!-- sliding tabs -->
        <div class="mb-4">
          <Tabs v-model="detailTab" :options="detailTabOptions" size="sm" />
        </div>

        <!-- Scrollable content area -->
        <div class="max-h-[50vh] overflow-y-auto pr-1">
          <!-- Overview Tab -->
          <section
            v-if="detailTab === 'overview'"
            class="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start mobile-grid"
          >
            <!-- Left Column: Priority items -->
            <div class="space-y-4">
              <div class="detail-section">
                <div class="detail-head flex items-center justify-between mb-3">
                  <h3 class="text-sm font-bold text-[var(--text-primary)]">优先处理</h3>
                  <span class="pill text-[10px] font-bold px-1.5 py-0.5 tone-amber">{{
                    detail?.actionItems?.length || 0
                  }}</span>
                </div>
                <div class="space-y-2">
                  <article
                    v-for="item in detail?.actionItems || []"
                    :key="item.id"
                    class="action-row flex items-center justify-between p-2.5 border border-base rounded-xl bg-card"
                  >
                    <div class="flex items-center gap-2.5 min-w-0">
                      <span
                        class="severity-dot w-2 h-2 rounded-full shrink-0"
                        :class="`severity-${item.severity}`"
                      />
                      <div class="min-w-0">
                        <strong
                          class="text-sm font-bold text-[var(--text-primary)] truncate block"
                          >{{ item.title }}</strong
                        >
                        <small class="text-[11px] text-[var(--text-secondary)] block mt-0.5">
                          {{ actionItemLabel(item.type) }} · {{ item.project?.title || '团队事项' }}
                        </small>
                      </div>
                    </div>
                    <UiButton
                      v-if="item.application"
                      size="sm"
                      variant="secondary"
                      :icon="Check"
                      @click="
                        emit('handle-application', { application: item.application, accept: true })
                      "
                    >
                      通过
                    </UiButton>
                  </article>
                  <div v-if="!detail?.actionItems?.length" class="quiet-state inline">
                    <CheckCircle2 class="w-4 h-4 text-emerald-500" />
                    <span>暂无高优先级事项</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Column: Project Health & Recent Resources -->
            <div class="space-y-4">
              <div class="detail-section">
                <div class="detail-head flex items-center justify-between mb-3">
                  <h3 class="text-sm font-bold text-[var(--text-primary)]">项目健康</h3>
                  <span class="pill text-[10px] font-bold px-1.5 py-0.5 tone-slate">{{
                    detail?.projectHealth?.length || 0
                  }}</span>
                </div>
                <div class="space-y-2">
                  <article
                    v-for="project in detail?.projectHealth || []"
                    :key="project.id"
                    class="project-row flex items-center justify-between p-2.5 border border-base rounded-xl bg-card"
                  >
                    <div class="min-w-0 flex-1">
                      <strong class="text-sm font-bold text-[var(--text-primary)] truncate block">{{
                        project.title
                      }}</strong>
                      <small class="text-[11px] text-[var(--text-secondary)] block mt-0.5">
                        {{ project.membersCount }} 人 · {{ project.tasks.active }} 活跃任务 ·
                        {{ project.tasks.overdue }} 逾期
                      </small>
                    </div>
                    <div class="flex items-center gap-3 shrink-0 ml-4">
                      <div class="project-progress flex items-center gap-2">
                        <span class="text-xs font-bold text-[var(--text-secondary)]"
                          >{{ project.progress }}%</span
                        >
                        <i
                          class="w-16 h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden block"
                        >
                          <b
                            class="bg-accent h-full rounded-full block"
                            :style="{ width: `${project.progress}%` }"
                          />
                        </i>
                      </div>
                      <span
                        class="pill text-xs px-1.5 py-0.5 font-bold"
                        :class="riskClass(project.riskLevel)"
                      >
                        {{ project.healthScore }}
                      </span>
                    </div>
                  </article>
                  <div v-if="!detail?.projectHealth?.length" class="quiet-state inline">
                    <Layers class="w-4 h-4 text-slate-400" />
                    <span>暂无项目</span>
                  </div>
                </div>
              </div>

              <div class="detail-section">
                <div class="detail-head flex items-center justify-between mb-3">
                  <h3 class="text-sm font-bold text-[var(--text-primary)]">最近资源</h3>
                  <span class="pill text-[10px] font-bold px-1.5 py-0.5 tone-slate">
                    {{
                      (detail?.resources?.assets?.length || 0) +
                      (detail?.resources?.materials?.length || 0) +
                      (detail?.resources?.showcases?.length || 0)
                    }}
                  </span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mobile-grid">
                  <article
                    v-for="resource in [
                      ...(detail?.resources?.assets || []).slice(0, 3),
                      ...(detail?.resources?.materials || []).slice(0, 3),
                      ...(detail?.resources?.showcases || []).slice(0, 3),
                    ]"
                    :key="resource.id"
                    class="resource-row flex items-center gap-2.5 p-2.5 border border-base rounded-xl bg-card"
                  >
                    <span class="p-1.5 bg-accent-subtle rounded-lg text-accent shrink-0">
                      <Boxes class="w-4 h-4" />
                    </span>
                    <span class="min-w-0">
                      <strong class="text-sm font-bold text-[var(--text-primary)] truncate block">{{
                        resource.title
                      }}</strong>
                      <small class="text-[11px] text-[var(--text-secondary)] block mt-0.5"
                        >{{ resource.status }} · {{ relativeTime(resource.updatedAt) }}</small
                      >
                    </span>
                  </article>
                  <div
                    v-if="
                      !detail?.resources?.assets?.length &&
                      !detail?.resources?.materials?.length &&
                      !detail?.resources?.showcases?.length
                    "
                    class="quiet-state inline col-span-full"
                  >
                    <Boxes class="w-4 h-4 text-slate-400" />
                    <span>暂无内容资源</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Members Tab -->
          <section v-else-if="detailTab === 'members'" class="space-y-2">
            <article
              v-for="member in detail?.members || team.members || []"
              :key="member.userId"
              class="member-row flex items-center justify-between p-2.5 border border-base rounded-xl bg-card"
            >
              <div class="owner-cell flex items-center gap-2.5 min-w-0 flex-1">
                <UserAvatar :user="member.user" size="sm" />
                <div class="min-w-0">
                  <strong class="text-sm font-bold text-[var(--text-primary)] truncate block">{{
                    ownerName(member.user)
                  }}</strong>
                  <small class="text-[11px] text-[var(--text-secondary)] truncate block mt-0.5">{{
                    member.user?.email || '未记录邮箱'
                  }}</small>
                </div>
              </div>
              <div
                class="member-metrics hidden sm:flex items-center gap-4 text-xs text-[var(--text-secondary)] shrink-0 ml-4 mr-6"
              >
                <span>{{ member.metrics?.activeTasks || 0 }} 活跃</span>
                <span>{{ member.metrics?.completionRate || 0 }}% 完成</span>
                <span>{{ relativeTime(member.metrics?.lastActiveAt || member.joinedAt) }}</span>
              </div>
              <div class="member-actions flex items-center gap-2 shrink-0">
                <span class="pill text-xs px-1.5 py-0.5 font-bold" :class="roleClass(member.role)">
                  {{ roleLabel(member.role) }}
                </span>
                <Dropdown v-if="member.role !== 'OWNER'" trigger="click">
                  <button
                    type="button"
                    class="icon-btn p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                  >
                    <MoreHorizontal class="w-4 h-4 text-slate-500" />
                  </button>
                  <template #dropdown>
                    <DropdownMenu>
                      <DropdownItem
                        v-if="member.role !== 'ADMIN'"
                        @click="
                          emit('update-member-role', {
                            teamId: team.id,
                            userId: member.userId,
                            role: 'ADMIN',
                          })
                        "
                      >
                        <Shield class="dropdown-icon" /> 设为管理员
                      </DropdownItem>
                      <DropdownItem
                        v-if="member.role !== 'MEMBER'"
                        @click="
                          emit('update-member-role', {
                            teamId: team.id,
                            userId: member.userId,
                            role: 'MEMBER',
                          })
                        "
                      >
                        <Users class="dropdown-icon" /> 设为成员
                      </DropdownItem>
                      <DropdownItem
                        divided
                        @click="
                          emit('remove-member', {
                            teamId: team.id,
                            userId: member.userId,
                            label: ownerName(member.user),
                          })
                        "
                      >
                        <UserMinus class="dropdown-icon danger" /> 移除成员
                      </DropdownItem>
                    </DropdownMenu>
                  </template>
                </Dropdown>
              </div>
            </article>
          </section>

          <!-- Pending Invites / Applications Tab -->
          <section v-else-if="detailTab === 'pending'" class="space-y-4">
            <div class="detail-section">
              <div class="detail-head flex items-center justify-between mb-3">
                <h3 class="text-sm font-bold text-[var(--text-primary)]">加入申请</h3>
                <span class="pill text-[10px] font-bold px-1.5 py-0.5 tone-slate">{{
                  detail?.applications?.length || 0
                }}</span>
              </div>
              <div class="space-y-2">
                <article
                  v-for="application in detail?.applications || []"
                  :key="application.id"
                  class="pending-row flex items-center justify-between p-2.5 border border-base rounded-xl bg-card"
                >
                  <div class="owner-cell flex items-center gap-2.5 min-w-0">
                    <UserAvatar :user="application.user" size="sm" />
                    <div class="min-w-0">
                      <strong class="text-sm font-bold text-[var(--text-primary)] truncate block">{{
                        ownerName(application.user)
                      }}</strong>
                      <small class="text-[11px] text-[var(--text-secondary)] block mt-0.5">{{
                        application.message || '没有留言'
                      }}</small>
                    </div>
                  </div>
                  <div class="pending-actions flex items-center gap-2 shrink-0 ml-4">
                    <UiButton
                      size="sm"
                      variant="secondary"
                      :icon="Check"
                      @click="emit('handle-application', { application, accept: true })"
                    >
                      通过
                    </UiButton>
                    <UiButton
                      size="sm"
                      variant="danger"
                      :icon="Ban"
                      @click="emit('handle-application', { application, accept: false })"
                    >
                      拒绝
                    </UiButton>
                  </div>
                </article>
                <div v-if="!detail?.applications?.length" class="quiet-state inline">
                  <CheckCircle2 class="w-4 h-4 text-slate-400" />
                  <span>暂无加入申请</span>
                </div>
              </div>
            </div>

            <div class="detail-section">
              <div class="detail-head flex items-center justify-between mb-3">
                <h3 class="text-sm font-bold text-[var(--text-primary)]">待确认邀请</h3>
                <span class="pill text-[10px] font-bold px-1.5 py-0.5 tone-slate">{{
                  detail?.invitations?.length || 0
                }}</span>
              </div>
              <div class="space-y-2">
                <article
                  v-for="invitation in detail?.invitations || []"
                  :key="invitation.id"
                  class="pending-row flex items-center justify-between p-2.5 border border-base rounded-xl bg-card"
                >
                  <div class="min-w-0">
                    <strong class="text-sm font-bold text-[var(--text-primary)] block">{{
                      invitation.inviteeEmail
                    }}</strong>
                    <small class="text-[11px] text-[var(--text-secondary)] block mt-0.5">
                      过期时间 {{ formatDate(invitation.expiresAt) }}
                    </small>
                  </div>
                  <UiButton
                    size="sm"
                    variant="danger"
                    :icon="X"
                    @click="emit('cancel-invitation', invitation)"
                  >
                    撤销
                  </UiButton>
                </article>
                <div v-if="!detail?.invitations?.length" class="quiet-state inline">
                  <CheckCircle2 class="w-4 h-4 text-slate-400" />
                  <span>暂无待确认邀请</span>
                </div>
              </div>
            </div>
          </section>

          <!-- Activity Tab -->
          <section v-else class="space-y-2">
            <article
              v-for="item in detail?.activity || []"
              :key="item.id"
              class="activity-row flex items-start gap-2.5 p-2.5 border border-base rounded-xl bg-card"
            >
              <span
                class="p-1.5 bg-slate-50 dark:bg-white/5 border border-base rounded-lg text-slate-400 shrink-0"
              >
                <Activity class="w-4 h-4" />
              </span>
              <div class="min-w-0">
                <strong class="text-sm font-bold text-[var(--text-primary)] block">{{
                  item.title
                }}</strong>
                <small class="text-[11px] text-[var(--text-secondary)] block mt-0.5">
                  {{ activityTypeLabel(item.type) }} ·
                  {{ item.actor ? ownerName(item.actor) : '系统' }} ·
                  {{ formatDateTime(item.createdAt) }}
                </small>
              </div>
            </article>
            <div v-if="!detail?.activity?.length" class="quiet-state inline">
              <Clock class="w-4 h-4 text-slate-400" />
              <span>暂无活动记录</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.modal-shell {
  background: transparent;
}

.team-avatar {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: #f3e8ff;
  color: #7c3aed;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.team-avatar.large {
  width: 48px;
  height: 48px;
}

.team-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  background: #ffffff;
}

.score-red {
  color: #e11d48;
  background: #fff1f2;
  border-color: #fecdd3;
}
.score-amber {
  color: #d97706;
  background: #fef3c7;
  border-color: #fde68a;
}
.score-green {
  color: #16a34a;
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.severity-dot.severity-critical {
  background: #ef4444;
}
.severity-dot.severity-high {
  background: #f97316;
}
.severity-dot.severity-medium {
  background: #eab308;
}

/* .spinning + @keyframes spin provided globally by src/styles/layout.css */

.quiet-state {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #94a3b8;
  font-size: 12px;
  justify-content: center;
  padding: 16px;
}

.quiet-state.inline {
  border: 1px dashed #e2e8f0;
  border-radius: 8px;
}

.dropdown-icon {
  width: 14px;
  height: 14px;
  margin-right: 6px;
}

.dropdown-icon.danger {
  color: #ef4444;
}
</style>
