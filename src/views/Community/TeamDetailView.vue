<script setup lang="ts">
import { getApiErrorMessage, getApiErrorStatus } from '@/utils/error';
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  Users,
  Settings,
  UserPlus,
  Mail,
  Trash2,
  LogOut,
  Camera,
  Search,
  Plus,
  X,
  Clock,
  ClipboardList,
  Activity,
  AlertTriangle,
  ArrowRight,
  Ban,
  BarChart3,
  Circle,
  ClipboardCheck,
  Briefcase,
  Globe,
} from 'lucide-vue-next';
import SegmentedControl from '@/components/ui/SegmentedControl.vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import SafeHtml from '@/components/SafeHtml.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import UserProfileDialog from '@/components/UserProfileDialog.vue';
import TeamPeopleTab from './components/TeamPeopleTab.vue';
import TeamInsightsTab from './components/TeamInsightsTab.vue';
import TeamApplicationsTab from './components/TeamApplicationsTab.vue';
import TeamSettingsTab from './components/TeamSettingsTab.vue';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';

const getCategoryLabel = (cat?: string | null) => {
  if (!cat) return '';
  const mapping: Record<string, string> = {
    modeling: '建模',
    rendering: '渲染',
    animation: '动画',
    materials: '材质',
    gameEngine: '游戏引擎',
  };
  return mapping[cat] || cat;
};

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

type TeamRole = 'OWNER' | 'ADMIN' | 'MEMBER';
type MemberFilter = 'all' | 'admins' | 'members' | 'busy' | 'risk' | 'pending';
type RecommendationSeverity = 'critical' | 'high' | 'medium' | 'low';

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

interface OverviewMember {
  userId: string;
  role: TeamRole;
  metrics: MemberMetrics;
}

interface TeamOverview {
  currentUserRole: TeamRole | 'ADMIN' | null;
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

interface MemberRow extends DetailedMember {
  metrics: MemberMetrics;
}

interface MemberInsightTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  updatedAt: string;
  project?: {
    id: string;
    title: string;
    color?: string | null;
  } | null;
  targetRoute: string;
}

interface MemberInsightProject {
  id: string;
  title: string;
  progress: number;
  status: string;
  dueDate?: string | null;
  role: string;
  taskCount: number;
  projectTaskCount: number;
  activeTasks: number;
  overdueTasks: number;
  completionRate: number;
  updatedAt: string;
  targetRoute: string;
}

interface MemberInsightDetail {
  member: DetailedMember;
  stats: {
    projects: number;
    assignedTasks: number;
    createdTasks: number;
    activeTasks: number;
    doneTasks: number;
    overdueTasks: number;
    dueSoonTasks: number;
    completedThisWeek: number;
    completionRate: number;
    capacityScore: number;
    lastActiveAt?: string | null;
  };
  tasks: {
    active: MemberInsightTask[];
    overdue: MemberInsightTask[];
    dueSoon: MemberInsightTask[];
    recent: MemberInsightTask[];
  };
  projects: MemberInsightProject[];
  recommendations: {
    id: string;
    severity: RecommendationSeverity;
    title: string;
    description: string;
    targetRoute: string;
  }[];
}

const { t: i18nT, locale } = useI18n();
const t = (key: string, ...args: any[]) => {
  const prefixes = ['showcase.', 'teams.', 'members.', 'teamDetail.', 'discussions.', 'chat.'];
  if (prefixes.some((p) => key.startsWith(p))) {
    return (i18nT as any)(`community.${key}`, ...args);
  }
  return (i18nT as any)(key, ...args);
};
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();
const teamId = computed(() => route.params.id as string);

const team = ref<DetailedTeam | null>(null);
const parsedDescription = computed(() => {
  const desc = team.value?.description || '';
  const separator = '\n\n===CORE_VALUES===\n';
  return desc.split(separator)[0];
});
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
const isMemberInsightLoading = ref(false);
const memberInsight = ref<MemberInsightDetail | null>(null);

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
    console.error('Fetch team detail error:', error);
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
const healthScore = computed(() => insightSummary.value?.healthScore ?? 100);
const actionItems = computed(() => insights.value?.actionItems || []);
const activityItems = computed(() => insights.value?.activity || []);
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

const opsKpis = computed(() => [
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

const selectedMember = computed(() => {
  const uid = selectedPanelUserId.value;
  if (!uid) return null;
  return team.value?.members.find((m) => m.userId === uid) || null;
});

const selectedMemberCapacity = computed(() => {
  const uid = selectedPanelUserId.value;
  if (!uid) return null;
  return capacityByUserId.value.get(uid) || null;
});

const drawerTasks = computed(() => {
  if (!memberInsight.value) return [];
  if (memberInsight.value.tasks.overdue.length > 0) return memberInsight.value.tasks.overdue;
  if (memberInsight.value.tasks.active.length > 0) return memberInsight.value.tasks.active;
  return memberInsight.value.tasks.recent;
});

const drawerTaskTitle = computed(() => {
  if (!memberInsight.value) return '任务流';
  if (memberInsight.value.tasks.overdue.length > 0) return '逾期任务';
  if (memberInsight.value.tasks.active.length > 0) return '进行中任务';
  return '最近完成任务';
});

const closeMemberPanel = () => {
  isMemberPanelOpen.value = false;
  selectedPanelUserId.value = null;
  memberInsight.value = null;
};

const openMemberWorkbench = (userId: string) => {
  selectedPanelUserId.value = userId;
  isMemberPanelOpen.value = true;
  void fetchMemberInsight(userId);
};

const fetchMemberInsight = async (userId: string) => {
  isMemberInsightLoading.value = true;
  memberInsight.value = null;
  try {
    const response = await api.get(`/api/teams/${teamId.value}/members/${userId}/insight`);
    if (selectedPanelUserId.value === userId) {
      memberInsight.value = response.data;
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '获取画像失败'));
  } finally {
    isMemberInsightLoading.value = false;
  }
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
const userSearchQuery = ref('');
const searchResults = ref<TeamUser[]>([]);
const isSearchingUsers = ref(false);
const inviteEmailInput = ref('');

const searchUsers = async () => {
  if (!userSearchQuery.value) {
    searchResults.value = [];
    return;
  }
  isSearchingUsers.value = true;
  try {
    const { data } = await api.get(`/api/auth/users/public?search=${userSearchQuery.value}`);
    searchResults.value = data;
  } catch (error) {
    console.error('Search users error:', error);
  } finally {
    isSearchingUsers.value = false;
  }
};

let _searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(userSearchQuery, () => {
  if (_searchTimer) clearTimeout(_searchTimer);
  _searchTimer = setTimeout(searchUsers, 300);
});

const handleAddUser = async (user: TeamUser) => {
  try {
    await api.post('/api/teams/invite', {
      teamId: teamId.value,
      inviteeEmail: user.email,
    });
    ElMessage.success(t('teamDetail.inviteSent', { name: user.name }));
    isAddModalOpen.value = false;
    fetchTeamDetail();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, t('teamDetail.inviteFailed')));
  }
};

const handleSendInvite = async () => {
  if (!inviteEmailInput.value) return;
  try {
    await api.post('/api/teams/invite', {
      teamId: teamId.value,
      inviteeEmail: inviteEmailInput.value,
    });
    ElMessage.success(t('teamDetail.inviteSent', { name: inviteEmailInput.value }));
    inviteEmailInput.value = '';
    isAddModalOpen.value = false;
    fetchTeamDetail();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, t('teamDetail.inviteFailed')));
  }
};

// Team Settings
const editForm = ref({
  name: '',
  description: '',
  avatarUrl: '',
  visibility: 'PUBLIC',
  category: '',
});
const categories = ['建模', '渲染', '动画', '材质', '游戏引擎'];
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

const avatarInput = ref<HTMLInputElement | null>(null);
const coverInput = ref<HTMLInputElement | null>(null);

const triggerAvatarUpload = () => {
  avatarInput.value?.click();
};

const triggerCoverUpload = () => {
  coverInput.value?.click();
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

const isDissolveModalOpen = ref(false);
const dissolveCode = ref('');
const isDissolving = ref(false);
const dissolveCountdown = ref(0);
let dissolveTimer: ReturnType<typeof setInterval> | null = null;

const startDissolveCountdown = () => {
  dissolveCountdown.value = 60;
  dissolveTimer = setInterval(() => {
    if (dissolveCountdown.value > 0) {
      dissolveCountdown.value--;
    } else {
      if (dissolveTimer) clearInterval(dissolveTimer);
    }
  }, 1000);
};

const sendDissolveCode = async () => {
  if (dissolveCountdown.value > 0) return;
  try {
    await api.post('/api/auth/email/send-code');
    ElMessage.success(t('teamDetail.verifyCodeSent'));
    startDissolveCountdown();
  } catch {
    ElMessage.error(t('teamDetail.inviteFailed'));
  }
};

const handleDeleteTeam = async () => {
  dissolveCode.value = '';
  isDissolveModalOpen.value = true;
};

watch(isDissolveModalOpen, (isOpen) => {
  if (!isOpen) {
    dissolveCode.value = '';
    if (dissolveTimer) clearInterval(dissolveTimer);
    dissolveCountdown.value = 0;
  }
});

const confirmDeleteTeam = async () => {
  if (!dissolveCode.value) {
    return ElMessage.warning(t('teamDetail.enterCodeWarning'));
  }
  try {
    isDissolving.value = true;
    await api.delete(`/api/teams/${teamId.value}`, {
      data: { code: dissolveCode.value },
    });
    ElMessage.success(t('teamDetail.dissolveSuccess'));
    isDissolveModalOpen.value = false;
    await workspaceStore.fetchWorkspaces();
    router.push('/dashboard');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, t('teamDetail.dissolveFailed')));
  } finally {
    isDissolving.value = false;
  }
};

// Formatting helpers (Members details)
const memberNameStr = (member: MemberRow) => {
  return member.user.name || member.user.email || '未命名';
};

const progressWidthStr = (activeTasks: number) => {
  return `${Math.min(100, activeTasks * 16)}%`;
};

const capacityLabel = (userId: string) => {
  return capacityByUserId.value.get(userId)?.focus || '稳定推进';
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

const navigateInsight = (targetRoute?: string) => {
  if (targetRoute) {
    router.push(targetRoute);
  }
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

const capacityClass = (score?: number) => {
  if (score === undefined || score < 60) return 'bg-emerald-500/10 text-emerald-500';
  if (score < 80) return 'bg-sky-500/10 text-sky-500';
  if (score < 90) return 'bg-amber-500/10 text-amber-500';
  return 'bg-rose-500/10 text-rose-500';
};

const priorityClass = (p?: string) => {
  if (p === 'HIGH') return 'bg-rose-500/10 text-rose-500';
  if (p === 'MEDIUM') return 'bg-amber-500/10 text-amber-500';
  return 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400';
};

const taskStatusLabel = (status?: string) => {
  if (status === 'TODO') return '待办';
  if (status === 'IN_PROGRESS') return '进行中';
  if (status === 'DONE') return '已完成';
  return '未指派';
};

const progressWidth = (percent: number) => {
  return `${Math.min(100, Math.max(0, percent))}%`;
};

const handleChatWithUser = async (user: TeamUser) => {
  try {
    await api.post('/api/messages/conversations', {
      participantIds: [user.id],
      isGroup: false,
    });
    router.push('/messages');
  } catch {
    ElMessage.error('会话创建失败');
  }
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

const activityDotClass = (type: string) => {
  if (type.startsWith('task')) return 'bg-accent';
  if (type.startsWith('project')) return 'bg-emerald-500';
  if (type.startsWith('team')) return 'bg-purple-500';
  return 'bg-slate-400';
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

onUnmounted(() => {
  if (dissolveTimer) clearInterval(dissolveTimer);
  if (_searchTimer) clearTimeout(_searchTimer);
});
</script>

<template>
  <div class="flex-1 overflow-y-auto scrollbar-hide" style="background-color: var(--bg-app)">
    <div v-if="isLoading && !team" class="h-full flex items-center justify-center">
      <div
        class="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin"
      ></div>
    </div>

    <div
      v-else-if="team"
      class="animate-in fade-in duration-500 w-full max-w-none px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6"
    >
      <!-- Top Card (Hero Section - No Cover Image) -->
      <div
        class="glass-card rounded-2xl border border-white/20 dark:border-slate-800/50 shadow-xl bg-white/40 dark:bg-slate-900/30 backdrop-blur-md relative px-6 py-3.5"
      >
        <div class="flex flex-col lg:flex-row items-center gap-4 relative z-20">
          <!-- Team Avatar -->
          <div class="relative group shrink-0">
            <input
              ref="avatarInput"
              type="file"
              class="hidden"
              accept="image/*"
              @change="handleAvatarChange"
            />
            <div
              class="w-16 h-16 lg:w-20 lg:h-20 rounded-xl overflow-hidden shadow-md border-2 border-white dark:border-slate-900 bg-white dark:bg-slate-800 transition-transform group-hover:scale-105 duration-500"
            >
              <img
                v-if="team.avatarUrl"
                alt=""
                :src="team.avatarUrl"
                class="w-full h-full object-cover"
              />
              <div
                v-else
                class="w-full h-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-white text-xl lg:text-3xl font-black"
              >
                {{ team.name.charAt(0).toUpperCase() }}
              </div>
            </div>
            <button
              v-if="isOwnerOrAdmin"
              type="button"
              class="absolute -bottom-1 -right-1 p-1.5 bg-accent text-white rounded-lg shadow-lg hover:scale-110 active:scale-95 transition-all border border-white/10"
              :title="t('teamDetail.changeAvatar')"
              @click="triggerAvatarUpload"
            >
              <Camera class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- Team Text Info -->
          <div class="flex-1 text-center lg:text-left pt-1">
            <div
              class="flex flex-col lg:flex-row lg:items-center gap-2 mb-1 justify-center lg:justify-start"
            >
              <h1
                class="text-xl lg:text-2xl font-black tracking-tight"
                style="color: var(--text-primary)"
              >
                {{ team.name }}
              </h1>
              <div class="flex items-center gap-1.5 justify-center">
                <div
                  class="px-2 py-0.5 bg-accent/10 text-accent text-[9px] sm:text-xs font-black rounded-md uppercase tracking-wider border border-accent/20"
                >
                  {{ t('teamDetail.spaceLabel') }}
                </div>
                <div
                  v-if="team.visibility"
                  class="px-2 py-0.5 rounded text-[9px] font-bold border"
                  :class="
                    team.visibility === 'PUBLIC'
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                  "
                >
                  {{ team.visibility === 'PUBLIC' ? '公开' : '私有' }}
                </div>
              </div>
            </div>

            <div
              class="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs font-bold text-slate-500 dark:text-slate-400 mt-1"
            >
              <div class="flex items-center gap-1.5">
                <Users class="w-4 h-4 text-slate-400" />
                <span>{{ team.members.length }} {{ t('teams.members') }}</span>
              </div>
              <div v-if="team.invitations?.length" class="flex items-center gap-1.5">
                <Clock class="w-4 h-4 text-slate-400" />
                <span>{{ team.invitations.length }} {{ t('teamDetail.pendingBadge') }}</span>
              </div>
              <div v-if="team.category" class="flex items-center gap-1.5">
                <Globe class="w-4 h-4 text-slate-400" />
                <span>{{ getCategoryLabel(team.category) }}</span>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div
            class="flex flex-row flex-wrap justify-center items-center gap-2 w-full lg:w-auto shrink-0"
          >
            <template v-if="canManageTeam">
              <button
                type="button"
                class="flex items-center justify-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent/95 text-white rounded-lg font-bold text-xs shadow-md shadow-accent/20 hover:scale-[1.03] active:scale-95 transition-all cursor-pointer border-none"
                @click="isAddModalOpen = true"
              >
                <UserPlus class="w-4 h-4" />
                {{ t('teamDetail.manageMembers') }}
              </button>
            </template>
            <template v-if="!isMember && team?.visibility === 'PUBLIC'">
              <button
                type="button"
                class="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-accent hover:bg-accent/95 text-white rounded-xl font-bold text-xs shadow-md shadow-accent/20 hover:scale-[1.03] active:scale-95 transition-all cursor-pointer border-none"
                @click="handleApplyFromDetail"
              >
                <UserPlus class="w-4 h-4" />
                {{ t('teams.applyJoin') }}
              </button>
            </template>
            <button
              v-if="canLeaveTeam"
              type="button"
              class="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200/50 dark:border-rose-500/20 rounded-xl font-bold text-xs transition-all cursor-pointer"
              @click="handleLeaveTeam"
            >
              <LogOut class="w-4 h-4" />
              {{ t('teamDetail.leaveBtn') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Two Column Layout Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <!-- Main Content (Left, 3 cols) -->
        <div class="lg:col-span-3 space-y-3.5">
          <!-- Segmented Tab Bar -->
          <div
            class="flex items-center justify-between border-b pb-2"
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

        <!-- Sidebar Content (Right, 1 col) -->
        <div class="lg:col-span-1 space-y-6 text-left">
          <!-- Space Info Card -->
          <div
            class="glass-card p-5 rounded-2xl border border-white/20 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/30 backdrop-blur-md shadow-lg space-y-4"
          >
            <h3
              class="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-2"
              style="border-color: var(--border-base)"
            >
              空间信息
            </h3>
            <div class="space-y-3.5">
              <div>
                <span class="block text-[10px] font-black text-slate-400 uppercase tracking-wider"
                  >空间介绍</span
                >
                <p
                  class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium mt-1"
                >
                  {{ parsedDescription || '暂无空间描述信息。' }}
                </p>
              </div>
              <div
                class="grid grid-cols-2 gap-4 pt-2 border-t"
                style="border-color: var(--border-base)"
              >
                <div>
                  <span class="block text-[10px] font-black text-slate-400 uppercase tracking-wider"
                    >空间类别</span
                  >
                  <span class="text-xs font-bold text-slate-700 dark:text-slate-200 mt-1 block">
                    {{ getCategoryLabel(team.category) || '未分类' }}
                  </span>
                </div>
                <div>
                  <span class="block text-[10px] font-black text-slate-400 uppercase tracking-wider"
                    >空间属性</span
                  >
                  <span class="text-xs font-bold text-slate-700 dark:text-slate-200 mt-1 block">
                    {{ team.type === 'PERSONAL' ? '个人空间' : '协作空间' }}
                  </span>
                </div>
              </div>
              <div class="pt-3 border-t" style="border-color: var(--border-base)">
                <div class="flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span>创建时间</span>
                  <span>{{ formatDate(team.createdAt) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Space Statistics KPIs (TEAM type only) -->
          <div
            v-if="team.type === 'TEAM'"
            class="glass-card p-5 rounded-2xl border border-white/20 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/30 backdrop-blur-md shadow-lg space-y-4"
          >
            <h3
              class="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-2"
              style="border-color: var(--border-base)"
            >
              运行指标
            </h3>
            <div class="grid grid-cols-1 gap-2.5">
              <div
                v-for="kpi in opsKpis"
                :key="kpi.key"
                class="flex items-center justify-between p-3 bg-white/20 dark:bg-slate-950/20 border border-white/10 dark:border-slate-800/50 rounded-xl hover:-translate-y-0.5 transition-all duration-200"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <div
                    class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    :class="kpi.tone"
                  >
                    <component :is="kpi.icon" class="w-4 h-4" />
                  </div>
                  <div class="min-w-0">
                    <span class="block text-[10px] font-black text-slate-400 leading-none">{{
                      kpi.label
                    }}</span>
                    <span class="block text-[9px] font-bold text-slate-500 mt-1.5 leading-none">{{
                      kpi.helper
                    }}</span>
                  </div>
                </div>
                <strong
                  class="text-sm font-black tracking-tight text-slate-800 dark:text-slate-100"
                >
                  {{ kpi.value }}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Unified Add Member Modal -->
    <div
      v-if="isAddModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 dark:bg-black/70 backdrop-blur-md transition-all duration-300"
    >
      <!-- Premium background glows -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          class="absolute top-[20%] left-[25%] w-72 h-72 bg-purple-500/15 dark:bg-purple-500/10 rounded-full blur-3xl animate-pulse"
        ></div>
        <div
          class="absolute bottom-[20%] right-[25%] w-80 h-80 bg-blue-500/15 dark:bg-blue-500/10 rounded-full blur-3xl animate-pulse"
          style="animation-duration: 6s"
        ></div>
      </div>

      <div
        class="relative w-full max-w-xl rounded-[2rem] p-8 md:p-10 shadow-2xl bg-white/80 dark:bg-slate-900/80 border border-white/50 dark:border-slate-800/80 backdrop-blur-2xl transition-all duration-300 transform scale-100"
      >
        <!-- Modal Header -->
        <div
          class="flex items-center justify-between mb-6 border-b border-slate-100 dark:border-slate-800/60 pb-5"
        >
          <div>
            <h3
              class="text-xl md:text-2xl font-black tracking-tight"
              style="color: var(--text-primary)"
            >
              {{ t('teamDetail.addMemberTitle') }}
            </h3>
            <p class="text-xs text-[var(--text-secondary)] opacity-75 font-semibold mt-1">
              {{ t('teamDetail.addMemberSubtitle') }}
            </p>
          </div>
          <button
            type="button"
            class="p-2 bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-[var(--text-secondary)] rounded-xl transition-all duration-300 hover:rotate-90"
            @click="isAddModalOpen = false"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="space-y-6">
          <!-- Search Users -->
          <div class="space-y-3">
            <label
              class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1"
            >
              {{ t('teamDetail.internalSearchLabel') }}
            </label>
            <div class="relative group">
              <Search
                class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-accent transition-colors"
              />
              <input
                v-model="userSearchQuery"
                type="text"
                :placeholder="t('teamDetail.searchUserPlaceholder')"
                class="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/80 rounded-xl text-sm focus:border-accent dark:focus:border-accent focus:bg-white dark:focus:bg-slate-950 outline-none transition-all duration-300 shadow-2xs focus:shadow-md focus:shadow-accent/5"
                style="color: var(--text-primary)"
              />
            </div>

            <!-- Search Results -->
            <div
              v-if="searchResults.length > 0"
              class="max-h-56 overflow-y-auto space-y-2 p-1 bg-slate-50/50 dark:bg-slate-950/30 rounded-xl scrollbar-hide border border-slate-100 dark:border-slate-800/40"
            >
              <div
                v-for="user in searchResults"
                :key="user.id"
                class="flex items-center justify-between p-3 bg-white/70 dark:bg-slate-900/40 rounded-lg border border-slate-100/80 dark:border-slate-800/40 hover:border-accent/50 dark:hover:border-accent/50 hover:bg-white dark:hover:bg-slate-900 hover:shadow-xs transition-all duration-300 group"
              >
                <div class="flex items-center gap-3">
                  <UserAvatar :user="user" size="md" />
                  <div>
                    <p class="text-sm font-bold" style="color: var(--text-primary)">
                      {{ user.name }}
                    </p>
                    <p class="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                      {{ user.email }}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  class="p-2 bg-accent/15 hover:bg-accent text-accent hover:text-white rounded-lg transition-all duration-300 shadow-sm active:scale-90"
                  @click="handleAddUser(user)"
                >
                  <Plus class="w-4 h-4" />
                </button>
              </div>
            </div>
            <div
              v-else-if="userSearchQuery && !isSearchingUsers"
              class="text-center py-4 text-slate-400 dark:text-slate-500 text-xs italic font-medium"
            >
              {{ t('teamDetail.noUsersFound') }}
            </div>
          </div>

          <!-- Divider -->
          <div class="relative flex items-center justify-center my-2">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-slate-100 dark:border-slate-800/80"></div>
            </div>
            <span
              class="relative px-4 bg-white/90 dark:bg-slate-900/90 rounded-full text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] backdrop-blur-md"
            >
              {{ t('teamDetail.orLabel') }}
            </span>
          </div>

          <!-- Email Invite -->
          <div class="space-y-3">
            <label
              class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1"
            >
              {{ t('teamDetail.emailInviteLabel') }}
            </label>
            <div class="flex gap-3">
              <div class="relative flex-1 group">
                <Mail
                  class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-accent transition-colors"
                />
                <input
                  v-model="inviteEmailInput"
                  type="email"
                  placeholder="example@email.com"
                  class="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/80 rounded-xl text-sm focus:border-accent dark:focus:border-accent focus:bg-white dark:focus:bg-slate-950 outline-none transition-all duration-300 shadow-2xs focus:shadow-md focus:shadow-accent/5"
                  style="color: var(--text-primary)"
                />
              </div>
              <button
                type="button"
                :disabled="!inviteEmailInput"
                class="px-6 py-3 bg-accent hover:bg-accent/90 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-400 dark:disabled:text-slate-500 text-white rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-md shadow-accent/10 disabled:shadow-none disabled:hover:scale-100 disabled:cursor-not-allowed shrink-0"
                @click="handleSendInvite"
              >
                {{ t('teamDetail.sendBtn') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Dissolve Team Modal -->
    <div
      v-if="isDissolveModalOpen"
      class="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
    >
      <div
        class="glass-dialog w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl animate-in fade-in zoom-in-95 duration-300"
      >
        <div class="flex items-center justify-between mb-8">
          <div class="p-4 bg-rose-50 dark:bg-rose-500/10 rounded-2xl text-rose-500">
            <Trash2 class="w-6 h-6" />
          </div>
          <button
            type="button"
            class="p-3 hover:bg-slate-100 dark:hover:bg-white/5 rounded-2xl transition-all"
            @click="isDissolveModalOpen = false"
          >
            <X class="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div class="space-y-6">
          <div>
            <h3 class="text-2xl font-black text-rose-600">
              {{ t('teamDetail.dissolveConfirmTitle') }}
            </h3>
            <SafeHtml
              class="text-xs text-slate-400 font-medium mt-1 leading-relaxed"
              tag="p"
              :html="t('teamDetail.dissolveWarning', { name: team?.name })"
            />
          </div>

          <div class="space-y-4">
            <div v-if="authStore.user?.twoFactorEnabled" class="space-y-2">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{{
                t('teamDetail.twoFactorLabel')
              }}</label>
              <input
                v-model="dissolveCode"
                type="text"
                maxlength="6"
                placeholder="000000"
                class="w-full px-6 py-4 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl text-center text-2xl font-black tracking-[0.5em] focus:ring-4 focus:ring-rose-500/10 outline-none transition-all"
                style="color: var(--text-primary)"
              />
            </div>
            <div v-else class="space-y-2">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{{
                t('teamDetail.emailCodeLabel')
              }}</label>
              <div class="flex gap-3">
                <input
                  v-model="dissolveCode"
                  type="text"
                  maxlength="6"
                  placeholder="000000"
                  class="flex-1 px-6 py-4 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl text-center text-xl font-black tracking-[0.2em] focus:ring-4 focus:ring-rose-500/10 outline-none transition-all"
                  style="color: var(--text-primary)"
                />
                <button
                  type="button"
                  :disabled="dissolveCountdown > 0"
                  class="px-4 py-4 bg-accent/10 text-accent rounded-2xl font-bold text-xs hover:bg-accent/20 transition-all whitespace-nowrap disabled:opacity-50"
                  @click="sendDissolveCode"
                >
                  {{ dissolveCountdown > 0 ? `${dissolveCountdown}s` : t('teamDetail.getCodeBtn') }}
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            :disabled="isDissolving || dissolveCode.length !== 6"
            class="w-full py-4 bg-rose-600 text-white rounded-2xl font-bold shadow-xl shadow-rose-600/20 hover:bg-rose-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            @click="confirmDeleteTeam"
          >
            <Trash2 class="w-4 h-4" />
            {{ isDissolving ? t('teamDetail.dissolving') : t('teamDetail.confirmDissolveBtn') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Member Workload Portrait Drawer -->
    <div
      v-if="isMemberPanelOpen"
      class="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-[2px]"
      @click.self="closeMemberPanel"
    >
      <aside
        class="member-drawer flex flex-col h-full bg-slate-900 border-l border-white/10 shadow-2xl relative"
      >
        <div
          class="drawer-head flex items-center justify-between p-4 border-b"
          style="border-color: var(--border-base)"
        >
          <div class="flex items-center gap-3 min-w-0">
            <UserAvatar v-if="selectedMember" :user="selectedMember.user" size="md" />
            <div class="min-w-0 text-left">
              <p class="text-sm font-black truncate" style="color: var(--text-primary)">
                {{ selectedMember?.user.name || memberInsight?.member.user.name || '未命名成员' }}
              </p>
              <p class="text-[10px] font-bold text-slate-400 truncate">
                {{ selectedMember?.user.email || memberInsight?.member.user.email || '成员画像' }}
              </p>
            </div>
          </div>
          <button type="button" class="drawer-close" @click="closeMemberPanel">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div
          v-if="isMemberInsightLoading"
          class="flex-1 flex flex-col items-center justify-center text-slate-400 p-6"
        >
          <div
            class="w-9 h-9 border-4 border-accent border-t-transparent rounded-full animate-spin mb-3"
          ></div>
          <p class="text-xs font-black">正在生成成员画像</p>
        </div>

        <div
          v-else-if="memberInsight"
          class="drawer-body flex-1 overflow-y-auto scrollbar-hide p-4 space-y-4"
        >
          <section
            class="drawer-section p-3 rounded-xl border animate-in fade-in duration-300"
            style="border-color: var(--border-base); background: rgb(148 163 184 / 0.04)"
          >
            <div class="drawer-score flex justify-between items-center">
              <div class="text-left">
                <p class="text-[10px] font-black text-slate-400 leading-none">容量分</p>
                <strong
                  class="text-3xl font-black mt-1 block leading-none"
                  style="color: var(--text-primary)"
                >
                  {{ memberInsight.stats.capacityScore }}
                </strong>
              </div>
              <span
                class="px-2.5 py-1 rounded-md text-[10px] font-black"
                :class="capacityClass(memberInsight.stats.capacityScore)"
              >
                {{ selectedMemberCapacity?.focus || '工作节奏' }}
              </span>
            </div>
            <div class="drawer-stat-grid grid grid-cols-4 gap-2 mt-3 text-center">
              <div
                class="p-2 bg-white/5 dark:bg-black/20 border rounded-lg"
                style="border-color: var(--border-base)"
              >
                <span class="block text-[9px] font-black text-slate-400 uppercase tracking-widest"
                  >项目</span
                >
                <strong
                  class="block text-base font-black mt-1 leading-none"
                  style="color: var(--text-primary)"
                  >{{ memberInsight.stats.projects }}</strong
                >
              </div>
              <div
                class="p-2 bg-white/5 dark:bg-black/20 border rounded-lg"
                style="border-color: var(--border-base)"
              >
                <span class="block text-[9px] font-black text-slate-400 uppercase tracking-widest"
                  >进行</span
                >
                <strong
                  class="block text-base font-black mt-1 leading-none"
                  style="color: var(--text-primary)"
                  >{{ memberInsight.stats.activeTasks }}</strong
                >
              </div>
              <div
                class="p-2 bg-white/5 dark:bg-black/20 border rounded-lg"
                style="border-color: var(--border-base)"
              >
                <span class="block text-[9px] font-black text-slate-400 uppercase tracking-widest"
                  >逾期</span
                >
                <strong
                  class="block text-base font-black mt-1 leading-none"
                  style="color: var(--text-primary)"
                  >{{ memberInsight.stats.overdueTasks }}</strong
                >
              </div>
              <div
                class="p-2 bg-white/5 dark:bg-black/20 border rounded-lg"
                style="border-color: var(--border-base)"
              >
                <span class="block text-[9px] font-black text-slate-400 uppercase tracking-widest"
                  >完成率</span
                >
                <strong
                  class="block text-base font-black mt-1 leading-none"
                  style="color: var(--text-primary)"
                  >{{ memberInsight.stats.completionRate }}%</strong
                >
              </div>
            </div>
          </section>

          <section
            class="drawer-section p-3 rounded-xl border text-left"
            style="border-color: var(--border-base); background: rgb(148 163 184 / 0.04)"
          >
            <div
              class="drawer-title flex items-center gap-1.5 mb-2 font-black text-xs text-slate-700 dark:text-slate-200"
            >
              <ClipboardCheck class="w-4 h-4 text-amber-500" />
              <span>建议动作</span>
            </div>
            <div
              v-if="memberInsight.recommendations.length === 0"
              class="text-center py-4 text-slate-400 text-xs italic"
            >
              无特别建议动作
            </div>
            <div v-else class="space-y-2">
              <button
                v-for="item in memberInsight.recommendations"
                :key="item.id"
                type="button"
                class="drawer-action hover:bg-accent/5 p-2 bg-white/5 rounded-lg border flex items-center gap-2 w-full text-left cursor-pointer"
                style="border-color: var(--border-base)"
                @click="navigateInsight(item.targetRoute)"
              >
                <span
                  class="px-1.5 py-0.5 rounded text-[8px] font-bold shrink-0"
                  :class="severityClass(item.severity)"
                >
                  {{ severityLabel(item.severity) }}
                </span>
                <span class="min-w-0 flex-1">
                  <span
                    class="block text-[11px] font-black truncate"
                    style="color: var(--text-primary)"
                    >{{ item.title }}</span
                  >
                  <span class="block text-[9px] font-bold text-slate-400 truncate mt-0.5">{{
                    item.description
                  }}</span>
                </span>
                <ArrowRight class="w-3.5 h-3.5 text-slate-300 shrink-0" />
              </button>
            </div>
          </section>

          <section
            class="drawer-section p-3 rounded-xl border text-left"
            style="border-color: var(--border-base); background: rgb(148 163 184 / 0.04)"
          >
            <div
              class="drawer-title flex items-center gap-1.5 mb-2 font-black text-xs text-slate-700 dark:text-slate-200"
            >
              <Briefcase class="w-4 h-4 text-accent" />
              <span>{{ drawerTaskTitle }}</span>
            </div>
            <div
              v-if="drawerTasks.length === 0"
              class="text-center py-4 text-slate-400 text-xs italic"
            >
              暂无任务记录
            </div>
            <div v-else class="space-y-2">
              <button
                v-for="task in drawerTasks"
                :key="task.id"
                type="button"
                class="drawer-task hover:bg-accent/5 p-2 bg-white/5 rounded-lg border flex items-center justify-between w-full text-left cursor-pointer"
                style="border-color: var(--border-base)"
                @click="navigateInsight(task.targetRoute)"
              >
                <span class="min-w-0 flex-1">
                  <span
                    class="block text-[11px] font-black truncate"
                    style="color: var(--text-primary)"
                    >{{ task.title }}</span
                  >
                  <span class="block text-[9px] font-bold text-slate-400 truncate mt-0.5">
                    {{ task.project?.title || '独立任务' }} · {{ taskStatusLabel(task.status) }} ·
                    {{ formatDate(task.dueDate || task.updatedAt) }}
                  </span>
                </span>
                <span
                  class="px-1.5 py-0.5 rounded text-[8px] font-bold shrink-0 ml-2"
                  :class="priorityClass(task.priority)"
                >
                  {{ task.priority || 'NONE' }}
                </span>
              </button>
            </div>
          </section>

          <section
            class="drawer-section p-3 rounded-xl border text-left"
            style="border-color: var(--border-base); background: rgb(148 163 184 / 0.04)"
          >
            <div
              class="drawer-title flex items-center gap-1.5 mb-2 font-black text-xs text-slate-700 dark:text-slate-200"
            >
              <BarChart3 class="w-4 h-4 text-emerald-500" />
              <span>参与项目</span>
            </div>
            <div
              v-if="memberInsight.projects.length === 0"
              class="text-center py-4 text-slate-400 text-xs italic"
            >
              暂未参与项目
            </div>
            <div v-else class="space-y-2">
              <button
                v-for="project in memberInsight.projects.slice(0, 6)"
                :key="project.id"
                type="button"
                class="drawer-project hover:bg-accent/5 p-2 bg-white/5 rounded-lg border flex items-center justify-between w-full text-left cursor-pointer"
                style="border-color: var(--border-base)"
                @click="navigateInsight(project.targetRoute)"
              >
                <span class="min-w-0 flex-1">
                  <span
                    class="block text-[11px] font-black truncate"
                    style="color: var(--text-primary)"
                    >{{ project.title }}</span
                  >
                  <span class="block text-[9px] font-bold text-slate-400 truncate mt-0.5">
                    {{ roleLabel(project.role) }} · {{ project.activeTasks }} 进行 ·
                    {{ project.overdueTasks }} 逾期
                  </span>
                </span>
                <span class="w-14 shrink-0 ml-2">
                  <span class="block text-right text-[9px] font-black text-slate-400"
                    >{{ project.progress }}%</span
                  >
                  <span
                    class="block h-1 mt-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
                  >
                    <span
                      class="block h-full rounded-full bg-accent"
                      :style="{ width: progressWidth(project.progress) }"
                    ></span>
                  </span>
                </span>
              </button>
            </div>
          </section>
        </div>

        <div
          v-if="memberInsight"
          class="drawer-foot p-4 border-t grid grid-cols-2 gap-3 shrink-0"
          style="border-color: var(--border-base)"
        >
          <button
            type="button"
            class="drawer-secondary cursor-pointer"
            @click="openUserProfile(memberInsight.member.userId)"
          >
            查看资料
          </button>
          <button
            type="button"
            class="drawer-primary cursor-pointer"
            @click="handleChatWithUser(memberInsight.member.user)"
          >
            发起私聊
          </button>
        </div>
      </aside>
    </div>

    <UserProfileDialog
      v-model="isProfileDialogOpen"
      :user-id="selectedUserId"
      @chat="handleStartChat"
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

/* Animations */
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

/* Consolidated Styles from Members Dashboard */
.rail-card {
  border: 1px solid var(--border-base);
  background: var(--bg-card);
  border-radius: 12px;
  padding: 16px;
}

.rail-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 900;
}

.kpi-tile {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--border-base);
  border-radius: 12px;
  background: var(--bg-card);
  text-align: left;
}

.tone-sky {
  background: rgb(14 165 233 / 0.1);
  color: rgb(2 132 199);
}

.tone-purple {
  background: rgb(168 85 247 / 0.1);
  color: rgb(147 51 234);
}

.tone-emerald {
  background: rgb(16 185 129 / 0.1);
  color: rgb(5 150 105);
}

.tone-rose {
  background: rgb(244 63 94 / 0.1);
  color: rgb(225 29 72);
}

.tone-amber {
  background: rgb(245 158 11 / 0.12);
  color: rgb(217 119 6);
}

.tone-slate {
  background: rgb(100 116 139 / 0.1);
  color: rgb(71 85 105);
}

.action-row,
.rail-member,
.risk-project,
.activity-row,
.drawer-action,
.drawer-task,
.drawer-project {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  border: 0;
  border-radius: 8px;
  background: rgb(148 163 184 / 0.08);
  padding: 8px;
  text-align: left;
  cursor: pointer;
  transition: background 0.18s ease;
}

.action-row:hover,
.rail-member:hover,
.risk-project:hover,
.activity-row:hover,
.drawer-action:hover,
.drawer-task:hover,
.drawer-project:hover {
  background: rgb(99 102 241 / 0.08);
}

.filter-chip {
  height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: rgb(148 163 184 / 0.08);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-chip b {
  min-width: 17px;
  height: 17px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgb(148 163 184 / 0.14);
  font-size: 9px;
}

.filter-chip.is-active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
  box-shadow: 0 8px 18px rgb(99 102 241 / 0.18);
}

.filter-chip.is-active b {
  background: rgb(255 255 255 / 0.22);
}

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

.activity-row {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
}

.compact-empty {
  padding: 24px 8px;
  text-align: center;
  color: rgb(148 163 184);
  font-size: 12px;
  font-weight: 800;
}

/* Member Portrait Side Drawer Styles */
.member-drawer {
  width: min(460px, 100vw);
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 0;
  border-top: 0;
  border-right: 0;
  border-bottom: 0;
  box-shadow: -24px 0 60px rgb(15 23 42 / 0.22);
  background: var(--bg-card);
  animation: slide-in 0.3s ease-out;
}

@keyframes slide-in {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.drawer-head {
  min-height: 62px;
  padding: 16px;
  border-bottom: 1px solid var(--border-base);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.drawer-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 0;
  background: rgb(148 163 184 / 0.12);
  color: var(--text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.drawer-close:hover {
  background: rgb(148 163 184 / 0.2);
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.drawer-section {
  border: 1px solid var(--border-base);
  border-radius: 12px;
  padding: 16px;
  background: rgb(148 163 184 / 0.04);
}

.drawer-score {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.drawer-stat-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.drawer-stat-grid div {
  border-radius: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  padding: 8px;
}

.drawer-stat-grid span {
  display: block;
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 900;
}

.drawer-stat-grid strong {
  display: block;
  margin-top: 2px;
  color: var(--text-primary);
  font-size: 16px;
  line-height: 1;
}

.drawer-title {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 12px;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 900;
}

.drawer-foot {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 16px;
  background: var(--bg-card);
}

.drawer-primary,
.drawer-secondary {
  height: 40px;
  border-radius: 8px;
  border: 0;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
  transition: all 0.2s;
}

.drawer-primary {
  background: var(--accent);
  color: white;
}

.drawer-primary:hover {
  opacity: 0.9;
}

.drawer-secondary {
  background: rgb(148 163 184 / 0.14);
  color: var(--text-primary);
}

.drawer-secondary:hover {
  background: rgb(148 163 184 / 0.2);
}

.role-select :deep(.el-select__wrapper) {
  min-height: 28px;
  height: 28px;
  width: 90px;
  border-radius: 8px;
  box-shadow: 0 0 0 1px var(--border-base) inset;
  background: var(--bg-app);
}

@media (max-width: 1024px) {
  .member-table {
    min-width: 720px;
  }
}
</style>
