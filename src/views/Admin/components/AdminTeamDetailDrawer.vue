<script setup lang="ts">
import { formatDate, formatDateTime } from '@/utils/format';
import { ref, watch } from 'vue';
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
import type {
  AdminTeam,
  TeamDetailResponse,
  AdminTeamUser,
  TeamApplication,
  TeamInvitation,
} from '../AdminTeamsView.vue';

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
  <el-drawer
    :model-value="modelValue"
    :size="isMobile ? '100%' : '760px'"
    :with-header="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="drawer-shell">
      <div v-if="isDetailLoading" class="loading-state drawer-loading">
        <RefreshCw class="spinning" />
        <span>正在加载团队洞察</span>
      </div>

      <template v-else-if="team">
        <header class="drawer-header">
          <div class="drawer-title">
            <div class="team-avatar large">
              <img v-if="team.avatarUrl" :src="team.avatarUrl" alt="" />
              <Briefcase v-else />
            </div>
            <div>
              <h2>{{ team.name }}</h2>
              <p>{{ team.description || team.category || '暂无团队描述' }}</p>
              <div class="drawer-pills">
                <span class="pill" :class="visibilityClass(team.visibility)">
                  <Globe v-if="team.visibility === 'PUBLIC'" />
                  <Lock v-else />
                  {{ visibilityLabel(team.visibility) }}
                </span>
                <span
                  class="pill"
                  :class="riskClass(detail?.team?.metrics?.riskLevel || team.metrics?.riskLevel)"
                >
                  {{ riskLabel(detail?.team?.metrics?.riskLevel || team.metrics?.riskLevel) }}
                </span>
                <span class="pill tone-slate">{{ formatDate(team.createdAt) }} 创建</span>
              </div>
            </div>
          </div>
          <button type="button" class="icon-btn" @click="emit('update:modelValue', false)">
            <X />
          </button>
        </header>

        <div class="drawer-actions">
          <button type="button" @click="emit('edit', team)"><Edit3 />编辑</button>
          <button type="button" @click="emit('add-member', team)"><UserPlus />添加成员</button>
          <button type="button" class="danger-action" @click="emit('delete', team)">
            <Trash2 />解散
          </button>
        </div>

        <section class="drawer-scoreboard">
          <div
            class="score-hero"
            :class="scoreClass(detail?.counts?.healthScore || team.metrics?.healthScore)"
          >
            <span>健康分</span>
            <strong>{{ detail?.counts?.healthScore ?? team.metrics?.healthScore ?? 100 }}</strong>
          </div>
          <div>
            <span>成员</span>
            <strong>{{ detail?.counts?.members ?? team._count?.members ?? 0 }}</strong>
          </div>
          <div>
            <span>项目</span>
            <strong>{{ detail?.counts?.projects ?? team._count?.projects ?? 0 }}</strong>
          </div>
          <div>
            <span>任务</span>
            <strong>{{ detail?.counts?.tasks ?? team._count?.tasks ?? 0 }}</strong>
          </div>
          <div>
            <span>资源</span>
            <strong>{{
              (detail?.counts?.assets || 0) +
              (detail?.counts?.materials || 0) +
              (detail?.counts?.showcases || 0)
            }}</strong>
          </div>
          <div>
            <span>待处理</span>
            <strong>{{
              (detail?.counts?.pendingApplications || 0) + (detail?.counts?.pendingInvitations || 0)
            }}</strong>
          </div>
        </section>

        <nav class="drawer-tabs">
          <button
            type="button"
            :class="{ active: detailTab === 'overview' }"
            @click="detailTab = 'overview'"
          >
            <Activity />概览
          </button>
          <button
            type="button"
            :class="{ active: detailTab === 'members' }"
            @click="detailTab = 'members'"
          >
            <Users />成员
          </button>
          <button
            type="button"
            :class="{ active: detailTab === 'pending' }"
            @click="detailTab = 'pending'"
          >
            <AlertTriangle />申请与邀请
          </button>
          <button
            type="button"
            :class="{ active: detailTab === 'activity' }"
            @click="detailTab = 'activity'"
          >
            <Clock />活动
          </button>
        </nav>

        <section v-if="detailTab === 'overview'" class="drawer-content">
          <div class="detail-section">
            <div class="detail-head">
              <h3>优先处理</h3>
              <span>{{ detail?.actionItems?.length || 0 }}</span>
            </div>
            <article v-for="item in detail?.actionItems || []" :key="item.id" class="action-row">
              <span class="severity-dot" :class="`severity-${item.severity}`" />
              <div>
                <strong>{{ item.title }}</strong>
                <small
                  >{{ actionItemLabel(item.type) }} · {{ item.project?.title || '团队事项' }}</small
                >
              </div>
              <button
                v-if="item.application"
                type="button"
                class="mini-btn"
                @click="emit('handle-application', { application: item.application, accept: true })"
              >
                <Check />通过
              </button>
            </article>
            <div v-if="!detail?.actionItems?.length" class="quiet-state inline">
              <CheckCircle2 />
              <span>暂无高优先级事项</span>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-head">
              <h3>项目健康</h3>
              <span>{{ detail?.projectHealth?.length || 0 }}</span>
            </div>
            <article
              v-for="project in detail?.projectHealth || []"
              :key="project.id"
              class="project-row"
            >
              <div>
                <strong>{{ project.title }}</strong>
                <small>
                  {{ project.membersCount }} 人 · {{ project.tasks.active }} 活跃任务 ·
                  {{ project.tasks.overdue }} 逾期
                </small>
              </div>
              <div class="project-progress">
                <span>{{ project.progress }}%</span>
                <i><b :style="{ width: `${project.progress}%` }" /></i>
              </div>
              <span class="pill" :class="riskClass(project.riskLevel)">{{
                project.healthScore
              }}</span>
            </article>
            <div v-if="!detail?.projectHealth?.length" class="quiet-state inline">
              <Layers />
              <span>暂无项目</span>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-head">
              <h3>最近资源</h3>
              <span>
                {{
                  (detail?.resources?.assets?.length || 0) +
                  (detail?.resources?.materials?.length || 0) +
                  (detail?.resources?.showcases?.length || 0)
                }}
              </span>
            </div>
            <div class="resource-columns">
              <article
                v-for="resource in [
                  ...(detail?.resources?.assets || []).slice(0, 3),
                  ...(detail?.resources?.materials || []).slice(0, 3),
                  ...(detail?.resources?.showcases || []).slice(0, 3),
                ]"
                :key="resource.id"
                class="resource-row"
              >
                <Boxes />
                <span>
                  <strong>{{ resource.title }}</strong>
                  <small>{{ resource.status }} · {{ relativeTime(resource.updatedAt) }}</small>
                </span>
              </article>
            </div>
          </div>
        </section>

        <section v-else-if="detailTab === 'members'" class="secondary-tabs-content drawer-content">
          <article
            v-for="member in detail?.members || team.members || []"
            :key="member.userId"
            class="member-row"
          >
            <div class="owner-cell">
              <UserAvatar :user="member.user" size="sm" />
              <span>
                <strong>{{ ownerName(member.user) }}</strong>
                <small>{{ member.user?.email || '未记录邮箱' }}</small>
              </span>
            </div>
            <div class="member-metrics">
              <span>{{ member.metrics?.activeTasks || 0 }} 活跃</span>
              <span>{{ member.metrics?.completionRate || 0 }}% 完成</span>
              <span>{{ relativeTime(member.metrics?.lastActiveAt || member.joinedAt) }}</span>
            </div>
            <div class="member-actions">
              <span class="pill" :class="roleClass(member.role)">{{ roleLabel(member.role) }}</span>
              <el-dropdown v-if="member.role !== 'OWNER'" trigger="click">
                <button type="button" class="icon-btn"><MoreHorizontal /></button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
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
                    </el-dropdown-item>
                    <el-dropdown-item
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
                    </el-dropdown-item>
                    <el-dropdown-item
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
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </article>
        </section>

        <section v-else-if="detailTab === 'pending'" class="drawer-content">
          <div class="detail-section">
            <div class="detail-head">
              <h3>加入申请</h3>
              <span>{{ detail?.applications?.length || 0 }}</span>
            </div>
            <article
              v-for="application in detail?.applications || []"
              :key="application.id"
              class="pending-row"
            >
              <div class="owner-cell">
                <UserAvatar :user="application.user" size="sm" />
                <span>
                  <strong>{{ ownerName(application.user) }}</strong>
                  <small>{{ application.message || '没有留言' }}</small>
                </span>
              </div>
              <div class="pending-actions">
                <button
                  type="button"
                  class="mini-btn"
                  @click="emit('handle-application', { application, accept: true })"
                >
                  <Check />通过
                </button>
                <button
                  type="button"
                  class="mini-btn danger-action"
                  @click="emit('handle-application', { application, accept: false })"
                >
                  <Ban />拒绝
                </button>
              </div>
            </article>
            <div v-if="!detail?.applications?.length" class="quiet-state inline">
              <CheckCircle2 />
              <span>暂无加入申请</span>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-head">
              <h3>待确认邀请</h3>
              <span>{{ detail?.invitations?.length || 0 }}</span>
            </div>
            <article
              v-for="invitation in detail?.invitations || []"
              :key="invitation.id"
              class="pending-row"
            >
              <div>
                <strong>{{ invitation.inviteeEmail }}</strong>
                <small>过期时间 {{ formatDate(invitation.expiresAt) }}</small>
              </div>
              <button
                type="button"
                class="mini-btn danger-action"
                @click="emit('cancel-invitation', invitation)"
              >
                <X />撤销
              </button>
            </article>
            <div v-if="!detail?.invitations?.length" class="quiet-state inline">
              <CheckCircle2 />
              <span>暂无待确认邀请</span>
            </div>
          </div>
        </section>

        <section v-else class="drawer-content">
          <article v-for="item in detail?.activity || []" :key="item.id" class="activity-row">
            <span class="activity-icon">
              <Activity />
            </span>
            <div>
              <strong>{{ item.title }}</strong>
              <small>
                {{ activityTypeLabel(item.type) }} ·
                {{ item.actor ? ownerName(item.actor) : '系统' }} ·
                {{ formatDateTime(item.createdAt) }}
              </small>
            </div>
          </article>
          <div v-if="!detail?.activity?.length" class="quiet-state inline">
            <Clock />
            <span>暂无活动记录</span>
          </div>
        </section>
      </template>
    </div>
  </el-drawer>
</template>

<style scoped>
.drawer-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
}

.drawer-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drawer-title {
  display: flex;
  align-items: center;
  gap: 16px;
}

.drawer-title h2 {
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
}

.drawer-title p {
  color: #64748b;
  font-size: 13px;
  margin-top: 2px;
}

.drawer-pills {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}

.drawer-actions {
  padding: 12px 20px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  gap: 8px;
}

.drawer-scoreboard {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.drawer-scoreboard > div {
  text-align: center;
  padding: 8px;
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  background: #fbfdff;
}

.drawer-scoreboard span {
  display: block;
  font-size: 11px;
  color: #64748b;
  font-weight: 700;
}

.drawer-scoreboard strong {
  display: block;
  font-size: 16px;
  color: #0f172a;
  margin-top: 4px;
}

.score-hero {
  border-color: transparent !important;
}

.score-hero.score-green {
  background: #d1fae5 !important;
  color: #047857 !important;
}

.score-hero.score-amber {
  background: #fef3c7 !important;
  color: #b45309 !important;
}

.score-hero.score-red {
  background: #ffe4e6 !important;
  color: #be123c !important;
}

.score-hero strong {
  color: inherit !important;
}

.drawer-tabs {
  display: flex;
  padding: 0 20px;
  border-bottom: 1px solid #e2e8f0;
  background: #ffffff;
}

.drawer-tabs button {
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 800;
  color: #64748b;
  border-bottom: 2px solid transparent;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.drawer-tabs button.active {
  color: #7c3aed;
  border-bottom-color: #7c3aed;
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-left: 3px solid #7c3aed;
  padding-left: 8px;
}

.detail-head h3 {
  font-size: 14px;
  font-weight: 800;
  color: #0f172a;
}

.detail-head span {
  font-size: 12px;
  color: #64748b;
  font-weight: 700;
}

.action-row,
.project-row,
.member-row,
.pending-row,
.activity-row,
.resource-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  background: #ffffff;
}

.action-row strong,
.project-row strong,
.member-row strong,
.pending-row strong,
.activity-row strong,
.resource-row strong {
  display: block;
  font-size: 13px;
  color: #0f172a;
}

.action-row small,
.project-row small,
.member-row small,
.pending-row small,
.activity-row small,
.resource-row small {
  display: block;
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}

.severity-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
}

.severity-critical {
  background: #ef4444;
}

.severity-high {
  background: #f97316;
}

.severity-medium {
  background: #eab308;
}

.project-progress {
  margin-left: auto;
  width: 120px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.project-progress span {
  font-size: 11px;
  color: #64748b;
  font-weight: 700;
  width: 32px;
}

.project-progress i {
  flex: 1;
  height: 6px;
  background: #f1f5f9;
  border-radius: 999px;
  overflow: hidden;
  display: block;
}

.project-progress b {
  display: block;
  height: 100%;
  background: #7c3aed;
  border-radius: inherit;
}

.member-metrics {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #64748b;
  font-size: 12px;
}

.member-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pending-actions {
  margin-left: auto;
  display: flex;
  gap: 6px;
}

.activity-icon {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #f3e8ff;
  color: #7c3aed;
  display: flex;
  align-items: center;
  justify-content: center;
}

.activity-icon svg {
  width: 14px;
  height: 14px;
}

.resource-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

/* Common UI styles */
.pill {
  min-height: 22px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 11px;
  font-weight: 800;
}

.tone-green {
  color: #047857;
  background: #d1fae5;
  border-color: #a7f3d0;
}

.tone-blue {
  color: #0369a1;
  background: #e0f2fe;
  border-color: #bae6fd;
}

.tone-amber {
  color: #b45309;
  background: #fef3c7;
  border-color: #fde68a;
}

.tone-red {
  color: #be123c;
  background: #ffe4e6;
  border-color: #fecdd3;
}

.tone-slate {
  color: #475569;
  background: #f1f5f9;
  border-color: #e2e8f0;
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

.owner-cell {
  display: flex;
  align-items: center;
  gap: 8px;
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

.primary-btn,
.mini-btn {
  min-height: 28px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 800;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.mini-btn {
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #334155;
}

.danger-action {
  color: #ef4444;
  border-color: #fee2e2;
  background: #fef2f2;
}

.drawer-actions button {
  min-height: 30px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 800;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #334155;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.drawer-actions button.danger-action {
  border-color: #fee2e2;
  background: #fef2f2;
  color: #ef4444;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #64748b;
  font-size: 13px;
  gap: 8px;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

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
