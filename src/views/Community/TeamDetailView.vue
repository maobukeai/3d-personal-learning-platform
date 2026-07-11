<script setup lang="ts">
import { getApiErrorMessage, getApiErrorStatus, logError } from '@/utils/error';
import { cleanTeamDescription } from '@/utils/team';
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCommunityI18n } from '@/composables/useCommunityI18n';
import {
  Users,
  Settings,
  ClipboardList,
  Activity,
  AlertTriangle,
  Ban,
  Circle,
  ClipboardCheck,
  Briefcase,
} from 'lucide-vue-next';
import SegmentedControl from '@/components/ui/SegmentedControl.vue';
import { ElMessage, ElMessageBox } from '@/utils/feedbackBridge';
import UserProfileDialog from '@/components/UserProfileDialog.vue';
import TeamPeopleTab from './components/TeamPeopleTab.vue';
import TeamInsightsTab from './components/TeamInsightsTab.vue';
import TeamApplicationsTab from './components/TeamApplicationsTab.vue';
import TeamSettingsTab from './components/TeamSettingsTab.vue';
import TeamDetailHeader from './components/TeamDetailHeader.vue';
import TeamDetailSidebar from './components/TeamDetailSidebar.vue';
import TeamDetailSkeleton from './components/TeamDetailSkeleton.vue';
import TeamAddMemberModal from './components/TeamAddMemberModal.vue';
import TeamDissolveModal from './components/TeamDissolveModal.vue';
import TeamMemberWorkbenchModal from './components/TeamMemberWorkbenchModal.vue';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import AiImageGeneratorDialog from '@/components/AiImageGeneratorDialog.vue';
import type {
  DetailedTeam,
  DetailedMember,
  TeamOverview,
  TeamCollaborationInsights,
  MemberRow,
  MemberMetrics,
  OpsKpi,
  InsightMemberCapacity,
  TeamUser,
} from './components/teamDetailTypes';

const { t } = useCommunityI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();
const teamId = computed(() => route.params.id as string);

const team = ref<DetailedTeam | null>(null);
const parsedDescription = computed(() => cleanTeamDescription(team.value?.description));
const overview = ref<TeamOverview | null>(null);
const insights = ref<TeamCollaborationInsights | null>(null);
const isLoading = ref(false);
const activeTab = ref('people'); // 'people', 'insights', 'applications', 'settings'

const tabOptions = computed(() => {
  const options = [{ id: 'people', label: t('teamDetail.peopleTab'), icon: Users }];
  if (!isPersonalSpace.value) {
    options.push({ id: 'insights', label: '协作洞察', icon: Activity });
  }
  if (isMember.value && isOwnerOrAdmin.value) {
    options.push({
      id: 'applications',
      label: pendingApplications.value.length
        ? `${t('teamDetail.applicationsTab')} (${pendingApplications.value.length})`
        : t('teamDetail.applicationsTab'),
      icon: ClipboardList,
    });
    options.push({
      id: 'settings',
      label: t('teamDetail.settingsTab'),
      icon: Settings,
    });
  }
  return options;
});

const isProfileDialogOpen = ref(false);
const selectedUserId = ref<string | null>(null);
const isRefreshing = ref(false);
const lastSyncedAt = ref<Date | null>(null);

const selectedPanelUserId = ref<string | null>(null);
const isMemberPanelOpen = ref(false);

const openUserProfile = (userId: string) => {
  selectedUserId.value = userId;
  isProfileDialogOpen.value = true;
};

const handleStartChat = async (user: TeamUser) => {
  try {
    await api.post('/api/messages/conversations', {
      participantIds: [user.id],
      isGroup: false,
    });
    router.push('/messages');
  } catch {
    ElMessage.error(t('members.chatInitFailed') || '会话创建失败');
  }
};

const fetchTeamDetail = async (options: { silent?: boolean } = {}) => {
  if (!teamId.value) return;
  if (!options.silent) isLoading.value = true;
  try {
    const response = await api.get(`/api/teams/${teamId.value}`);
    team.value = response.data;

    if (team.value && team.value.type === 'TEAM') {
      const [overviewResponse, insightsResponse] = await Promise.all([
        api.get(`/api/teams/${teamId.value}/overview`),
        api.get(`/api/teams/${teamId.value}/collaboration-insights`),
      ]);
      overview.value = overviewResponse.data;
      insights.value = insightsResponse.data;
    } else {
      overview.value = null;
      insights.value = null;
    }
    lastSyncedAt.value = new Date();
  } catch (error) {
    logError(error, { operation: 'fetchTeamDetail', view: 'TeamDetailView' });
    if (getApiErrorStatus(error) === 403) {
      ElMessage.error(t('teamDetail.noPermission'));
    } else {
      ElMessage.error(t('teamDetail.fetchFailed'));
    }
    router.push('/dashboard');
  } finally {
    if (!options.silent) isLoading.value = false;
  }
};

const isMember = computed(() => {
  if (!team.value || !authStore.user) return false;
  return team.value.members.some((m: DetailedMember) => m.userId === authStore.user?.id);
});

const currentUserRole = computed(() => {
  if (!team.value || !authStore.user) return null;
  const member = team.value.members.find((m: DetailedMember) => m.userId === authStore.user?.id);
  return member?.role;
});

const isOwnerOrAdmin = computed(() => {
  return ['OWNER', 'ADMIN'].includes(currentUserRole.value || '');
});

const isOwner = computed(() => currentUserRole.value === 'OWNER');

const isPersonalSpace = computed(() => {
  return team.value?.type === 'PERSONAL';
});

const isSpecialPublicSpace = computed(() => {
  return team.value?.name === '公共空间';
});

const canManageTeam = computed(() => {
  return isMember.value && isOwnerOrAdmin.value && !isPersonalSpace.value;
});

const canLeaveTeam = computed(() => {
  return !isOwner.value && !isSpecialPublicSpace.value;
});

const pendingApplications = computed(() => team.value?.applications || []);

const defaultMetrics = (): MemberMetrics => ({
  projects: 0,
  assignedTasks: 0,
  activeTasks: 0,
  doneTasks: 0,
  dueSoonTasks: 0,
  overdueTasks: 0,
  recentlyCompleted: 0,
  completionRate: 0,
  lastTaskAt: null,
});

const metricsByUserId = computed(() => {
  const map = new Map<string, MemberMetrics>();
  for (const member of overview.value?.members || []) {
    map.set(member.userId, member.metrics);
  }
  return map;
});

const memberRows = computed<MemberRow[]>(() => {
  return (team.value?.members || []).map((member) => ({
    ...member,
    metrics: metricsByUserId.value.get(member.userId) || defaultMetrics(),
  }));
});

const pendingInvitationsList = computed(
  () => overview.value?.invitations || team.value?.invitations || [],
);
const pendingApplicationsList = computed(
  () => overview.value?.applications || team.value?.applications || [],
);
const pendingTotal = computed(
  () => pendingInvitationsList.value.length + pendingApplicationsList.value.length,
);
const insightSummary = computed(() => insights.value?.summary || null);
const highRiskProjects = computed(
  () => insights.value?.projectHealth.filter((project) => project.riskLevel !== 'LOW') || [],
);

const capacityByUserId = computed(() => {
  const map = new Map<string, InsightMemberCapacity>();
  for (const member of insights.value?.memberCapacity || []) {
    map.set(member.userId, member);
  }
  return map;
});

const teamOverviewStats = computed(() => {
  const rows = memberRows.value;
  const activeTasks = rows.reduce((sum, row) => sum + row.metrics.activeTasks, 0);
  const overdueTasks = rows.reduce((sum, row) => sum + row.metrics.overdueTasks, 0);
  const doneTasks = rows.reduce((sum, row) => sum + row.metrics.doneTasks, 0);
  const assignedTasks = rows.reduce((sum, row) => sum + row.metrics.assignedTasks, 0);

  return {
    members: overview.value?.counts.members ?? rows.length,
    admins: overview.value?.counts.admins ?? rows.filter((row) => row.role !== 'MEMBER').length,
    pending: pendingTotal.value,
    activeTasks,
    overdueTasks,
    doneTasks,
    completionRate: assignedTasks ? Math.round((doneTasks / assignedTasks) * 100) : 0,
  };
});

const opsKpis = computed<OpsKpi[]>(() => [
  {
    key: 'members',
    label: '成员',
    value: teamOverviewStats.value.members,
    helper: `${teamOverviewStats.value.admins} 管理`,
    icon: Users,
    tone: 'tone-sky',
  },
  {
    key: 'tasks',
    label: '任务总量',
    value:
      overview.value?.counts.tasks ??
      teamOverviewStats.value.activeTasks + teamOverviewStats.value.doneTasks,
    helper: `${insightSummary.value?.dueSoonTasks ?? 0} 近到期`,
    icon: Briefcase,
    tone: 'tone-purple',
  },
  {
    key: 'done',
    label: '完成度',
    value: `${teamOverviewStats.value.completionRate}%`,
    helper: `本周 ${insightSummary.value?.completedThisWeek ?? 0}`,
    icon: ClipboardCheck,
    tone: 'tone-emerald',
  },
  {
    key: 'overdue',
    label: '逾期任务',
    value: insightSummary.value?.overdueTasks ?? teamOverviewStats.value.overdueTasks,
    helper: '需尽快处理',
    icon: AlertTriangle,
    tone: 'tone-rose',
  },
  {
    key: 'unassigned',
    label: '未指派任务',
    value: insightSummary.value?.unassignedTasks ?? 0,
    helper: '待分配池',
    icon: Circle,
    tone: 'tone-amber',
  },
  {
    key: 'risk',
    label: '风险项目',
    value: insightSummary.value?.highRiskProjects ?? highRiskProjects.value.length,
    helper: '健康度偏低',
    icon: Ban,
    tone: 'tone-rose',
  },
]);

const closeMemberPanel = () => {
  isMemberPanelOpen.value = false;
  selectedPanelUserId.value = null;
};

const openMemberWorkbench = (userId: string) => {
  selectedPanelUserId.value = userId;
  isMemberPanelOpen.value = true;
};

const handleManualRefresh = async () => {
  isRefreshing.value = true;
  try {
    await fetchTeamDetail({ silent: true });
    ElMessage.success('空间数据已同步');
  } finally {
    isRefreshing.value = false;
  }
};

const handleRemoveMember = async (userId: string, name: string) => {
  try {
    await ElMessageBox.confirm(
      t('teamDetail.removeConfirm', { name }),
      t('teamDetail.removeTitle'),
      {
        confirmButtonText: t('teamDetail.removeBtn'),
        cancelButtonText: t('teamDetail.cancelBtn'),
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      },
    );

    await api.delete(`/api/teams/${teamId.value}/members/${userId}`);
    ElMessage.success(t('members.removeSuccess') || '成员已移除');
    fetchTeamDetail();
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(t('teamDetail.operationFailed'));
  }
};

const handleUpdateRole = async (userId: string, newRole: string) => {
  try {
    await api.patch(`/api/teams/${teamId.value}/members/${userId}/role`, { role: newRole });
    ElMessage.success(t('teamDetail.roleUpdated'));
    fetchTeamDetail();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, t('teamDetail.operationFailed')));
  }
};

const handleCancelInvitation = async (invitationId: string) => {
  try {
    await api.delete(`/api/teams/invitations/${invitationId}`);
    ElMessage.success(t('teamDetail.invitationCancelled'));
    fetchTeamDetail();
  } catch {
    ElMessage.error(t('teamDetail.operationFailed'));
  }
};

const handleRespondApplication = async (
  applicationId: string,
  approve: boolean,
  applicantName: string,
) => {
  try {
    await api.post('/api/teams/applications/respond', { applicationId, accept: approve });
    ElMessage.success(
      approve
        ? t('teamDetail.joinedSuccess', { name: applicantName })
        : t('teamDetail.rejectedSuccess', { name: applicantName }),
    );
    fetchTeamDetail();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, t('teamDetail.operationFailed')));
  }
};

// Add Member Modal
const isAddModalOpen = ref(false);

// Team Settings
const editForm = ref({
  name: '',
  description: '',
  avatarUrl: '',
  visibility: 'PUBLIC',
  category: '',
});
const isSaving = ref(false);

const handleUpdateTeam = async () => {
  isSaving.value = true;
  try {
    await api.patch(`/api/teams/${teamId.value}`, editForm.value);
    ElMessage.success(t('teamDetail.updatedSuccess'));
    await workspaceStore.fetchWorkspaces();
    fetchTeamDetail();
  } catch {
    ElMessage.error(t('teamDetail.updateFailed'));
  } finally {
    isSaving.value = false;
  }
};

const handleLeaveTeam = async () => {
  try {
    await ElMessageBox.confirm(t('teamDetail.leaveConfirm'), t('teamDetail.leaveTitle'), {
      confirmButtonText: t('teamDetail.leaveBtn'),
      cancelButtonText: t('teamDetail.cancelBtn'),
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    });

    await api.delete(`/api/teams/${teamId.value}/members/${authStore.user?.id}`);
    ElMessage.success(t('teamDetail.leftTeamSuccess'));
    await workspaceStore.fetchWorkspaces();
    router.push('/dashboard');
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(t('teamDetail.leaveTeamFailed'));
  }
};

const handleApplyFromDetail = async () => {
  try {
    await ElMessageBox.confirm(
      t('teamDetail.applyConfirm', { name: team.value?.name || '' }),
      t('teamDetail.applyTitle'),
      {
        confirmButtonText: t('teamDetail.applySubmit'),
        cancelButtonText: t('teamDetail.cancelBtn'),
        type: 'info',
      },
    );
    await api.post('/api/teams/apply', { teamId: teamId.value });
    ElMessage.success(t('teamDetail.applySuccess'));
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, t('teamDetail.applyFailed')));
    }
  }
};

const handleAvatarChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('avatar', file);

  try {
    const { data } = await api.post(`/api/teams/${teamId.value}/upload-avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (team.value) team.value.avatarUrl = data.avatarUrl;
    ElMessage.success(t('teamDetail.avatarUpdateSuccess'));
    await workspaceStore.fetchWorkspaces();
  } catch {
    ElMessage.error(t('teamDetail.avatarUpdateFailed'));
  }
};

const handleCoverChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('cover', file);

  try {
    const { data } = await api.post(`/api/teams/${teamId.value}/upload-cover`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (team.value) team.value.coverUrl = data.coverUrl;
    ElMessage.success(t('teamDetail.coverUpdateSuccess'));
  } catch {
    ElMessage.error(t('teamDetail.coverUpdateFailed'));
  }
};

const aiGeneratorShow = ref(false);
const aiGeneratorType = ref<'avatar' | 'cover'>('avatar');
const aiGeneratorTitle = ref('');

const openAiAvatarGenerator = () => {
  aiGeneratorType.value = 'avatar';
  aiGeneratorTitle.value = 'AI 生成团队头像';
  aiGeneratorShow.value = true;
};

const openAiCoverGenerator = () => {
  aiGeneratorType.value = 'cover';
  aiGeneratorTitle.value = 'AI 生成团队封面';
  aiGeneratorShow.value = true;
};

const handleAiImageSave = async (file: File) => {
  const formData = new FormData();
  if (aiGeneratorType.value === 'avatar') {
    formData.append('avatar', file);
    try {
      const { data } = await api.post(`/api/teams/${teamId.value}/upload-avatar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (team.value) team.value.avatarUrl = data.avatarUrl;
      ElMessage.success(t('teamDetail.avatarUpdateSuccess'));
    } catch {
      ElMessage.error(t('teamDetail.avatarUpdateFailed'));
    }
  } else {
    formData.append('cover', file);
    try {
      const { data } = await api.post(`/api/teams/${teamId.value}/upload-cover`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (team.value) team.value.coverUrl = data.coverUrl;
      ElMessage.success(t('teamDetail.coverUpdateSuccess'));
    } catch {
      ElMessage.error(t('teamDetail.coverUpdateFailed'));
    }
  }
};

const isDissolveModalOpen = ref(false);

const handleDeleteTeam = () => {
  isDissolveModalOpen.value = true;
};

const handleDissolved = async () => {
  isDissolveModalOpen.value = false;
  await workspaceStore.fetchWorkspaces();
  router.push('/dashboard');
};

const navigateInsight = (targetRoute?: string) => {
  if (targetRoute) {
    router.push(targetRoute);
  }
};

onMounted(() => {
  fetchTeamDetail();
  if (route.query.tab) {
    activeTab.value = route.query.tab as string;
  }
});

watch(
  () => route.query.tab,
  (newTab) => {
    if (newTab) {
      activeTab.value = newTab as string;
    }
  },
);

watch(teamId, (newId) => {
  if (newId) {
    fetchTeamDetail();
  }
});

watch(
  () => team.value,
  (newTeam) => {
    if (newTeam) {
      editForm.value = {
        name: newTeam.name,
        description: newTeam.description || '',
        avatarUrl: newTeam.avatarUrl || '',
        visibility: newTeam.visibility || 'PUBLIC',
        category: newTeam.category || '建模',
      };
    }
  },
  { immediate: true },
);
</script>

<template>
  <div
    class="flex-1 overflow-y-auto scrollbar-hide mobile-adaptive"
    style="background-color: var(--bg-app)"
  >
    <TeamDetailSkeleton v-if="isLoading && !team" />

    <div
      v-else-if="team"
      class="animate-in fade-in duration-500 w-full max-w-none px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6"
    >
      <TeamDetailHeader
        :team="team"
        :is-owner-or-admin="isOwnerOrAdmin"
        :can-manage-team="canManageTeam"
        :can-leave-team="canLeaveTeam"
        :is-member="isMember"
        @avatar-change="handleAvatarChange"
        @cover-change="handleCoverChange"
        @open-ai-avatar-generator="openAiAvatarGenerator"
        @open-ai-cover-generator="openAiCoverGenerator"
        @add-member="isAddModalOpen = true"
        @apply-join="handleApplyFromDetail"
        @leave-team="handleLeaveTeam"
      />

      <!-- Two Column Layout Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <!-- Main Content (Left, 3 cols) -->
        <div class="lg:col-span-3 space-y-3.5">
          <!-- Segmented Tab Bar -->
          <div
            class="flex items-center justify-between border-b pb-2 mobile-row"
            style="border-color: var(--border-base)"
          >
            <SegmentedControl v-model="activeTab" :options="tabOptions" size="sm" />
          </div>

          <!-- Tab Content Views -->
          <div class="transition-all duration-300">
            <TeamPeopleTab
              v-if="activeTab === 'people'"
              :team="team"
              :overview="overview"
              :ops-kpis="opsKpis"
              :is-refreshing="isRefreshing"
              :can-manage-team="canManageTeam"
              :capacity-by-user-id="capacityByUserId"
              :member-rows="memberRows"
              @manual-refresh="handleManualRefresh"
              @invite-member="isAddModalOpen = true"
              @cancel-invitation="handleCancelInvitation"
              @respond-application="handleRespondApplication"
              @open-profile="openUserProfile"
              @open-workbench="openMemberWorkbench"
              @update-role="handleUpdateRole"
              @start-chat="handleStartChat"
              @remove-member="handleRemoveMember"
            />

            <TeamInsightsTab
              v-if="activeTab === 'insights' && !isPersonalSpace"
              :team="team"
              :insights="insights"
            />

            <TeamApplicationsTab
              v-if="activeTab === 'applications' && isOwnerOrAdmin"
              :pending-applications="pendingApplications"
              @respond-application="handleRespondApplication"
            />

            <TeamSettingsTab
              v-if="activeTab === 'settings' && isOwnerOrAdmin"
              v-model:edit-form="editForm"
              :is-personal-space="isPersonalSpace"
              :is-owner="isOwner"
              :is-saving="isSaving"
              @update-team="handleUpdateTeam"
              @delete-team="handleDeleteTeam"
            />
          </div>
        </div>

        <TeamDetailSidebar
          :team="team"
          :parsed-description="parsedDescription"
          :ops-kpis="opsKpis"
        />
      </div>
    </div>

    <TeamAddMemberModal
      :show="isAddModalOpen"
      :team-id="teamId"
      @close="isAddModalOpen = false"
      @added="
        () => {
          isAddModalOpen = false;
          fetchTeamDetail();
        }
      "
    />

    <TeamDissolveModal
      :show="isDissolveModalOpen"
      :team-id="teamId"
      :team-name="team?.name"
      :two-factor-enabled="!!authStore.user?.twoFactorEnabled"
      @close="isDissolveModalOpen = false"
      @dissolved="handleDissolved"
    />

    <TeamMemberWorkbenchModal
      :show="isMemberPanelOpen"
      :team-id="teamId"
      :user-id="selectedPanelUserId"
      :members="team?.members || []"
      :capacity-by-user-id="capacityByUserId"
      @close="closeMemberPanel"
      @navigate="navigateInsight"
      @view-profile="openUserProfile"
      @chat="handleStartChat"
    />

    <UserProfileDialog
      v-model="isProfileDialogOpen"
      :user-id="selectedUserId"
      @chat="handleStartChat"
    />

    <!-- AI Image Generator Dialog -->
    <AiImageGeneratorDialog
      :show="aiGeneratorShow"
      :title="aiGeneratorTitle"
      :type="aiGeneratorType"
      @close="aiGeneratorShow = false"
      @save="handleAiImageSave"
    />
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.animate-in {
  animation: animate-in 0.5s ease-out;
}

@keyframes animate-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 767px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
