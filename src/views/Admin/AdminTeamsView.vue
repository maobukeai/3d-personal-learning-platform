<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  Activity,
  AlertTriangle,
  Ban,
  BarChart3,
  Boxes,
  Briefcase,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Eye,
  Globe,
  Layers,
  Lock,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import UserAvatar from '@/components/UserAvatar.vue';
import { useWorkspaceStore } from '@/stores/workspace';
import AdminOpsPanel from './components/AdminOpsPanel.vue';

type TeamVisibility = 'PUBLIC' | 'PRIVATE';
type VisibilityFilter = 'ALL' | TeamVisibility;
type TeamRole = 'OWNER' | 'ADMIN' | 'MEMBER';
type RiskFilter = 'ALL' | 'PENDING' | 'OVERDUE' | 'UNASSIGNED' | 'EMPTY';
type SortBy = 'createdAt' | 'updatedAt' | 'name' | 'health';
type SortOrder = 'asc' | 'desc';

interface AdminTeamUser {
  id: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

interface AdminTeamMember {
  id?: string;
  userId: string;
  role: TeamRole;
  joinedAt?: string;
  user?: AdminTeamUser;
  metrics?: {
    projects: number;
    assignedTasks: number;
    activeTasks: number;
    doneTasks: number;
    overdueTasks: number;
    dueSoonTasks: number;
    completedThisWeek: number;
    completionRate: number;
    capacityScore: number;
    lastActiveAt?: string | null;
  };
}

interface AdminTeamCounts {
  members?: number;
  assets?: number;
  projects?: number;
  tasks?: number;
  materials?: number;
  showcases?: number;
  invitations?: number;
  applications?: number;
}

interface AdminTeamMetrics {
  healthScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  activeTasks: number;
  doneTasks: number;
  overdueTasks: number;
  dueSoonTasks: number;
  unassignedTasks: number;
  completionRate: number;
  averageProjectProgress: number;
  pendingApplications: number;
  pendingInvitations: number;
  admins: number;
  resourceTotal: number;
  lastActivityAt?: string | null;
}

interface AdminTeam {
  id: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  visibility?: TeamVisibility;
  category?: string | null;
  ownerId: string;
  owner: AdminTeamUser;
  members?: AdminTeamMember[];
  createdAt?: string;
  updatedAt?: string;
  _count?: AdminTeamCounts;
  metrics?: AdminTeamMetrics;
}

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AdminTeamsSummary {
  totalTeams: number;
  filteredTeams: number;
  publicTeams: number;
  privateTeams: number;
  totalMembers: number;
  totalProjects: number;
  totalTasks: number;
  totalResources: number;
  totalAssets: number;
  totalMaterials: number;
  totalShowcases: number;
  pendingApplications: number;
  pendingInvitations: number;
  overdueTeams: number;
  pendingTeams: number;
  emptyTeams: number;
}

interface AdminTeamsResponse {
  data: AdminTeam[];
  pagination: PaginationState;
  summary: AdminTeamsSummary;
  filters?: {
    categories?: string[];
  };
}

interface AdminUsersResponse {
  data?: AdminTeamUser[];
}

interface TeamApplication {
  id: string;
  teamId: string;
  userId: string;
  message?: string | null;
  status: string;
  createdAt: string;
  user: AdminTeamUser;
}

interface TeamInvitation {
  id: string;
  teamId: string;
  inviterId: string;
  inviteeEmail: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface TeamProjectHealth {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  progress: number;
  dueDate?: string | null;
  color?: string;
  visibility?: string;
  updatedAt?: string;
  membersCount: number;
  healthScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  tasks: {
    total: number;
    active: number;
    done: number;
    overdue: number;
    dueSoon: number;
    unassigned: number;
    completionRate: number;
  };
}

interface TeamActionItem {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium';
  title: string;
  dueDate?: string | null;
  assignee?: AdminTeamUser | null;
  project?: { id: string; title: string; color?: string } | null;
  application?: TeamApplication;
}

interface TeamActivityItem {
  id: string;
  type: string;
  title: string;
  actor?: AdminTeamUser | null;
  project?: { id: string; title: string; color?: string } | null;
  createdAt: string;
}

interface TeamDetailResponse {
  team: AdminTeam & {
    invitations?: TeamInvitation[];
    applications?: TeamApplication[];
  };
  counts: {
    members: number;
    admins: number;
    projects: number;
    activeProjects: number;
    tasks: number;
    activeTasks: number;
    doneTasks: number;
    overdueTasks: number;
    dueSoonTasks: number;
    unassignedTasks: number;
    completedThisWeek: number;
    assets: number;
    materials: number;
    showcases: number;
    pendingApplications: number;
    pendingInvitations: number;
    averageProjectProgress: number;
    healthScore: number;
  };
  members: AdminTeamMember[];
  projectHealth: TeamProjectHealth[];
  tasks: {
    overdue: TeamActionItem[];
    dueSoon: TeamActionItem[];
    unassigned: TeamActionItem[];
    recentlyUpdated: TeamActionItem[];
  };
  resources: {
    assets: Array<{
      id: string;
      title: string;
      type: string;
      status: string;
      updatedAt: string;
      user?: AdminTeamUser;
    }>;
    materials: Array<{
      id: string;
      title: string;
      category: string;
      status: string;
      updatedAt: string;
      user?: AdminTeamUser;
    }>;
    showcases: Array<{
      id: string;
      title: string;
      type: string;
      status: string;
      updatedAt: string;
      user?: AdminTeamUser;
    }>;
  };
  invitations: TeamInvitation[];
  applications: TeamApplication[];
  actionItems: TeamActionItem[];
  activity: TeamActivityItem[];
  generatedAt: string;
}

const workspaceStore = useWorkspaceStore();

const emptySummary = (): AdminTeamsSummary => ({
  totalTeams: 0,
  filteredTeams: 0,
  publicTeams: 0,
  privateTeams: 0,
  totalMembers: 0,
  totalProjects: 0,
  totalTasks: 0,
  totalResources: 0,
  totalAssets: 0,
  totalMaterials: 0,
  totalShowcases: 0,
  pendingApplications: 0,
  pendingInvitations: 0,
  overdueTeams: 0,
  pendingTeams: 0,
  emptyTeams: 0,
});

const teams = ref<AdminTeam[]>([]);
const users = ref<AdminTeamUser[]>([]);
const categories = ref<string[]>([]);
const summary = ref<AdminTeamsSummary>(emptySummary());
const isLoading = ref(false);
const isSubmitting = ref(false);
const isDetailLoading = ref(false);
const searchQuery = ref('');
const visibilityFilter = ref<VisibilityFilter>('ALL');
const riskFilter = ref<RiskFilter>('ALL');
const categoryFilter = ref('');
const sortBy = ref<SortBy>('createdAt');
const sortOrder = ref<SortOrder>('desc');
const selectedIds = ref<string[]>([]);
const selectedTeam = ref<AdminTeam | null>(null);
const selectedTeamDetail = ref<TeamDetailResponse | null>(null);
const detailDrawerVisible = ref(false);
const detailTab = ref<'overview' | 'members' | 'pending' | 'activity'>('overview');
const teamDialogVisible = ref(false);
const addMemberDialogVisible = ref(false);
const modalMode = ref<'create' | 'edit'>('create');
const selectedUserId = ref('');
const selectedMemberRole = ref<'ADMIN' | 'MEMBER'>('MEMBER');
const isMobile = ref(false);
const filterTimer = ref<number | undefined>();

const pagination = ref<PaginationState>({
  page: 1,
  limit: 30,
  total: 0,
  totalPages: 1,
});

const form = ref({
  id: '',
  name: '',
  description: '',
  avatarUrl: '',
  coverUrl: '',
  visibility: 'PRIVATE' as TeamVisibility,
  category: '',
  ownerId: '',
});

const updateMobileStatus = () => {
  isMobile.value = window.innerWidth < 760;
};

const safeTime = (value?: string | null) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

const formatDate = (value?: string | null) => {
  const time = safeTime(value);
  if (!time) return '未记录';
  return new Date(time).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const formatDateTime = (value?: string | null) => {
  const time = safeTime(value);
  if (!time) return '未记录';
  return new Date(time).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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

const compactNumber = (value?: number) => {
  const num = value || 0;
  if (num >= 10000) return `${(num / 10000).toFixed(num >= 100000 ? 0 : 1)}万`;
  if (num >= 1000) return `${(num / 1000).toFixed(num >= 10000 ? 0 : 1)}k`;
  return String(num);
};

const ownerName = (user?: AdminTeamUser | null) => user?.name || user?.email || '未指定';

const teamScore = (team: AdminTeam) => team.metrics?.healthScore ?? 100;

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

const allPageSelected = computed(
  () => teams.value.length > 0 && teams.value.every((team) => selectedIds.value.includes(team.id)),
);

const totalPending = computed(
  () => summary.value.pendingApplications + summary.value.pendingInvitations,
);

const attentionTeams = computed(() =>
  teams.value
    .filter(
      (team) =>
        (team.metrics?.riskLevel || 'LOW') !== 'LOW' ||
        (team.metrics?.pendingApplications || 0) > 0 ||
        (team.metrics?.overdueTasks || 0) > 0,
    )
    .sort((a, b) => teamScore(a) - teamScore(b))
    .slice(0, 6),
);

const quickStats = computed(() => [
  {
    key: 'teams',
    label: '团队',
    value: summary.value.totalTeams,
    sub: `${summary.value.publicTeams} 公开 / ${summary.value.privateTeams} 私有`,
    icon: Briefcase,
    tone: 'blue',
  },
  {
    key: 'members',
    label: '成员',
    value: summary.value.totalMembers,
    sub: `${summary.value.totalProjects} 项目协作中`,
    icon: Users,
    tone: 'green',
  },
  {
    key: 'resources',
    label: '资源',
    value: summary.value.totalResources,
    sub: `${summary.value.totalAssets} 资产 / ${summary.value.totalMaterials} 材质 / ${summary.value.totalShowcases} 作品`,
    icon: Boxes,
    tone: 'purple',
  },
  {
    key: 'tasks',
    label: '任务',
    value: summary.value.totalTasks,
    sub: `${summary.value.overdueTeams} 个团队存在逾期`,
    icon: CheckCircle2,
    tone: summary.value.overdueTeams ? 'amber' : 'green',
  },
  {
    key: 'pending',
    label: '待处理',
    value: totalPending.value,
    sub: `${summary.value.pendingApplications} 申请 / ${summary.value.pendingInvitations} 邀请`,
    icon: AlertTriangle,
    tone: totalPending.value ? 'amber' : 'green',
  },
]);

const detailTeam = computed(() => selectedTeamDetail.value?.team || selectedTeam.value);
const detailCounts = computed(() => selectedTeamDetail.value?.counts);
const detailMembers = computed(
  () => selectedTeamDetail.value?.members || detailTeam.value?.members || [],
);
const detailApplications = computed(() => selectedTeamDetail.value?.applications || []);
const detailInvitations = computed(() => selectedTeamDetail.value?.invitations || []);

const availableUsers = computed(() => {
  const memberIds = new Set(detailMembers.value.map((member) => member.userId));
  return users.value.filter((user) => !memberIds.has(user.id));
});

const fetchUsers = async () => {
  try {
    const response = await api.get<AdminTeamUser[] | AdminUsersResponse>('/api/admin/users', {
      params: { page: 1, limit: 300, status: 'ACTIVE' },
    });
    users.value = Array.isArray(response.data) ? response.data : response.data.data || [];
  } catch (error) {
    console.error('Fetch users error:', error);
  }
};

const fetchTeams = async (page = pagination.value.page) => {
  isLoading.value = true;
  try {
    const response = await api.get<AdminTeam[] | AdminTeamsResponse>('/api/admin/teams', {
      params: {
        page,
        limit: pagination.value.limit,
        q: searchQuery.value.trim() || undefined,
        visibility: visibilityFilter.value !== 'ALL' ? visibilityFilter.value : undefined,
        risk: riskFilter.value !== 'ALL' ? riskFilter.value : undefined,
        category: categoryFilter.value || undefined,
        sortBy: sortBy.value,
        sortOrder: sortOrder.value,
      },
    });

    if (Array.isArray(response.data)) {
      teams.value = response.data;
      pagination.value = {
        page,
        limit: pagination.value.limit,
        total: response.data.length,
        totalPages: 1,
      };
      summary.value = {
        ...emptySummary(),
        totalTeams: response.data.length,
        filteredTeams: response.data.length,
        publicTeams: response.data.filter((team) => team.visibility === 'PUBLIC').length,
        privateTeams: response.data.filter((team) => team.visibility !== 'PUBLIC').length,
        totalMembers: response.data.reduce((sum, team) => sum + (team._count?.members || 0), 0),
        totalProjects: response.data.reduce((sum, team) => sum + (team._count?.projects || 0), 0),
        totalTasks: response.data.reduce((sum, team) => sum + (team._count?.tasks || 0), 0),
        totalResources: response.data.reduce(
          (sum, team) =>
            sum +
            (team._count?.assets || 0) +
            (team._count?.materials || 0) +
            (team._count?.showcases || 0),
          0,
        ),
      };
    } else {
      teams.value = response.data.data;
      pagination.value = response.data.pagination;
      summary.value = response.data.summary;
      categories.value = response.data.filters?.categories || [];
    }

    selectedIds.value = selectedIds.value.filter((id) =>
      teams.value.some((team) => team.id === id),
    );

    if (detailDrawerVisible.value && detailTeam.value) {
      const fresh = teams.value.find((team) => team.id === detailTeam.value?.id);
      if (fresh) selectedTeam.value = fresh;
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '无法加载团队数据'));
  } finally {
    isLoading.value = false;
  }
};

const fetchTeamDetail = async (teamId: string) => {
  isDetailLoading.value = true;
  try {
    const response = await api.get<TeamDetailResponse>(`/api/admin/teams/${teamId}/detail`);
    selectedTeamDetail.value = response.data;
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '无法加载团队详情'));
  } finally {
    isDetailLoading.value = false;
  }
};

const refreshAll = async () => {
  await Promise.all([fetchTeams(), fetchUsers()]);
  if (detailDrawerVisible.value && detailTeam.value) {
    await fetchTeamDetail(detailTeam.value.id);
  }
};

const openDetail = async (team: AdminTeam) => {
  selectedTeam.value = team;
  selectedTeamDetail.value = null;
  detailTab.value = 'overview';
  detailDrawerVisible.value = true;
  await fetchTeamDetail(team.id);
};

const toggleSelectAll = () => {
  const pageIds = teams.value.map((team) => team.id);
  if (allPageSelected.value) {
    selectedIds.value = selectedIds.value.filter((id) => !pageIds.includes(id));
  } else {
    selectedIds.value = Array.from(new Set([...selectedIds.value, ...pageIds]));
  }
};

const toggleSelect = (id: string) => {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((selectedId) => selectedId !== id)
    : [...selectedIds.value, id];
};

const openCreateModal = async () => {
  if (users.value.length === 0) await fetchUsers();
  modalMode.value = 'create';
  form.value = {
    id: '',
    name: '',
    description: '',
    avatarUrl: '',
    coverUrl: '',
    visibility: 'PRIVATE',
    category: '',
    ownerId: users.value[0]?.id || '',
  };
  teamDialogVisible.value = true;
};

const openEditModal = (team: AdminTeam) => {
  modalMode.value = 'edit';
  form.value = {
    id: team.id,
    name: team.name,
    description: team.description || '',
    avatarUrl: team.avatarUrl || '',
    coverUrl: team.coverUrl || '',
    visibility: team.visibility || 'PRIVATE',
    category: team.category || '',
    ownerId: team.ownerId,
  };
  teamDialogVisible.value = true;
};

const handleSubmit = async () => {
  if (!form.value.name.trim() || !form.value.ownerId) {
    ElMessage.warning('请填写团队名称并选择负责人');
    return;
  }

  isSubmitting.value = true;
  try {
    const payload = {
      name: form.value.name.trim(),
      description: form.value.description,
      avatarUrl: form.value.avatarUrl,
      coverUrl: form.value.coverUrl,
      visibility: form.value.visibility,
      category: form.value.category,
      ownerId: form.value.ownerId,
    };

    if (modalMode.value === 'create') {
      await api.post('/api/admin/teams', payload);
      ElMessage.success('团队已创建');
    } else {
      await api.put(`/api/admin/teams/${form.value.id}`, payload);
      ElMessage.success('团队信息已更新');
    }

    teamDialogVisible.value = false;
    await fetchTeams(modalMode.value === 'create' ? 1 : pagination.value.page);
    if (detailDrawerVisible.value && form.value.id) await fetchTeamDetail(form.value.id);
    workspaceStore.fetchWorkspaces();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '操作失败'));
  } finally {
    isSubmitting.value = false;
  }
};

const deleteTeam = async (team: AdminTeam) => {
  try {
    await ElMessageBox.confirm(
      `解散「${team.name}」会移除团队空间和团队关系，此操作不可恢复。`,
      '确认解散团队',
      {
        confirmButtonText: '解散团队',
        cancelButtonText: '取消',
        type: 'error',
        confirmButtonClass: 'el-button--danger',
      },
    );
    await api.delete(`/api/admin/teams/${team.id}`);
    ElMessage.success('团队已解散');
    if (detailTeam.value?.id === team.id) detailDrawerVisible.value = false;
    await fetchTeams();
    workspaceStore.fetchWorkspaces();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getApiErrorMessage(error, '解散失败'));
    }
  }
};

const handleBatchVisibility = async (visibility: TeamVisibility) => {
  if (selectedIds.value.length === 0) return;
  try {
    await ElMessageBox.confirm(
      `确认将 ${selectedIds.value.length} 个团队设为${visibilityLabel(visibility)}？`,
      '批量变更可见性',
      {
        confirmButtonText: '确认变更',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );
    await api.put('/api/admin/teams/batch', { ids: selectedIds.value, visibility });
    ElMessage.success('批量可见性已更新');
    selectedIds.value = [];
    await fetchTeams();
    workspaceStore.fetchWorkspaces();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getApiErrorMessage(error, '批量更新失败'));
    }
  }
};

const handleBatchCategory = () => {
  if (selectedIds.value.length === 0) return;
  ElMessageBox.prompt(`为 ${selectedIds.value.length} 个团队设置分类`, '批量分类', {
    confirmButtonText: '保存分类',
    cancelButtonText: '取消',
    inputPlaceholder: '例如：建模 / 材质 / 教学',
  }).then(async ({ value }) => {
    try {
      await api.put('/api/admin/teams/batch', { ids: selectedIds.value, category: value || '' });
      ElMessage.success('批量分类已更新');
      selectedIds.value = [];
      await fetchTeams();
    } catch (error) {
      ElMessage.error(getApiErrorMessage(error, '批量分类失败'));
    }
  });
};

const handleBatchDelete = async () => {
  if (selectedIds.value.length === 0) return;
  try {
    await ElMessageBox.confirm(
      `确认解散 ${selectedIds.value.length} 个团队？项目、任务、资源会保留但脱离团队。`,
      '批量解散团队',
      {
        confirmButtonText: '确认解散',
        cancelButtonText: '取消',
        type: 'error',
        confirmButtonClass: 'el-button--danger',
      },
    );
    await api.delete('/api/admin/teams/batch', { data: { ids: selectedIds.value } });
    ElMessage.success('批量解散完成');
    selectedIds.value = [];
    detailDrawerVisible.value = false;
    await fetchTeams();
    workspaceStore.fetchWorkspaces();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getApiErrorMessage(error, '批量解散失败'));
    }
  }
};

const updateMemberRole = async (teamId: string, userId: string, role: 'ADMIN' | 'MEMBER') => {
  try {
    await api.put(`/api/admin/teams/${teamId}/members/${userId}/role`, { role });
    ElMessage.success('成员角色已更新');
    await Promise.all([fetchTeams(), fetchTeamDetail(teamId)]);
    workspaceStore.fetchWorkspaces();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '角色更新失败'));
  }
};

const removeMember = async (teamId: string, userId: string, label: string) => {
  try {
    await ElMessageBox.confirm(`确认从团队中移除 ${label}？`, '移除成员', {
      confirmButtonText: '确认移除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await api.delete(`/api/admin/teams/${teamId}/members/${userId}`);
    ElMessage.success('成员已移除');
    await Promise.all([fetchTeams(), fetchTeamDetail(teamId)]);
    workspaceStore.fetchWorkspaces();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getApiErrorMessage(error, '移除失败'));
    }
  }
};

const openAddMemberDialog = async (team: AdminTeam) => {
  if (users.value.length === 0) await fetchUsers();
  selectedTeam.value = team;
  selectedUserId.value = '';
  selectedMemberRole.value = 'MEMBER';
  addMemberDialogVisible.value = true;
};

const handleAddMember = async () => {
  const team = detailTeam.value || selectedTeam.value;
  if (!team || !selectedUserId.value) return;
  try {
    await api.post(`/api/admin/teams/${team.id}/members`, {
      userId: selectedUserId.value,
      role: selectedMemberRole.value,
    });
    ElMessage.success('成员已加入团队');
    addMemberDialogVisible.value = false;
    await Promise.all([fetchTeams(), fetchTeamDetail(team.id)]);
    workspaceStore.fetchWorkspaces();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '添加成员失败'));
  }
};

const handleApplication = async (application: TeamApplication, accept: boolean) => {
  try {
    await api.put(`/api/admin/teams/applications/${application.id}`, { accept });
    ElMessage.success(accept ? '申请已通过' : '申请已拒绝');
    await Promise.all([fetchTeams(), fetchTeamDetail(application.teamId)]);
    workspaceStore.fetchWorkspaces();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '申请处理失败'));
  }
};

const cancelInvitation = async (invitation: TeamInvitation) => {
  try {
    await api.delete(`/api/admin/teams/invitations/${invitation.id}`);
    ElMessage.success('邀请已撤销');
    await Promise.all([fetchTeams(), fetchTeamDetail(invitation.teamId)]);
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '撤销邀请失败'));
  }
};

const exportCsv = () => {
  const header = [
    '团队',
    '负责人',
    '可见性',
    '成员',
    '项目',
    '任务',
    '资源',
    '健康分',
    '待处理',
    '创建时间',
  ];
  const rows = teams.value.map((team) => [
    team.name,
    ownerName(team.owner),
    visibilityLabel(team.visibility),
    team._count?.members || 0,
    team._count?.projects || 0,
    team._count?.tasks || 0,
    team.metrics?.resourceTotal || 0,
    team.metrics?.healthScore || 0,
    (team.metrics?.pendingApplications || 0) + (team.metrics?.pendingInvitations || 0),
    formatDate(team.createdAt),
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `teams-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const setPage = (page: number) => {
  if (page < 1 || page > pagination.value.totalPages || page === pagination.value.page) return;
  fetchTeams(page);
};

watch([searchQuery, visibilityFilter, riskFilter, categoryFilter, sortBy, sortOrder], () => {
  if (filterTimer.value) window.clearTimeout(filterTimer.value);
  filterTimer.value = window.setTimeout(() => fetchTeams(1), searchQuery.value.trim() ? 320 : 80);
});

onMounted(() => {
  updateMobileStatus();
  window.addEventListener('resize', updateMobileStatus);
  refreshAll();
});

onUnmounted(() => {
  if (filterTimer.value) window.clearTimeout(filterTimer.value);
  window.removeEventListener('resize', updateMobileStatus);
});

void quickStats;
</script>

<template>
  <div class="admin-teams-page">
    <header class="page-header">
      <div class="header-copy">
        <p class="eyebrow">用户与团队</p>
        <h1>团队管理</h1>
        <div class="header-meta">
          <span>{{ compactNumber(summary.filteredTeams) }} 个结果</span>
          <span>{{ compactNumber(summary.totalMembers) }} 名成员</span>
          <span>{{ compactNumber(totalPending) }} 个待处理</span>
        </div>
      </div>
      <div class="header-actions">
        <button type="button" class="ghost-btn" @click="refreshAll">
          <RefreshCw :class="{ spinning: isLoading }" />
          刷新
        </button>
        <button type="button" class="ghost-btn" @click="exportCsv">
          <Download />
          导出
        </button>
        <button type="button" class="primary-btn" @click="openCreateModal">
          <Plus />
          新建团队
        </button>
      </div>
    </header>

    <AdminOpsPanel scope="teams" />

    <section class="control-panel">
      <label class="search-box">
        <Search />
        <input v-model="searchQuery" type="search" placeholder="搜索团队、负责人、分类" />
      </label>

      <div class="filter-row">
        <div class="segmented">
          <button
            type="button"
            :class="{ active: visibilityFilter === 'ALL' }"
            @click="visibilityFilter = 'ALL'"
          >
            全部
          </button>
          <button
            type="button"
            :class="{ active: visibilityFilter === 'PUBLIC' }"
            @click="visibilityFilter = 'PUBLIC'"
          >
            公开
          </button>
          <button
            type="button"
            :class="{ active: visibilityFilter === 'PRIVATE' }"
            @click="visibilityFilter = 'PRIVATE'"
          >
            私有
          </button>
        </div>

        <select v-model="riskFilter" class="control-select">
          <option value="ALL">全部状态</option>
          <option value="PENDING">有待处理</option>
          <option value="OVERDUE">存在逾期</option>
          <option value="UNASSIGNED">未分配任务</option>
          <option value="EMPTY">空团队</option>
        </select>

        <select v-model="categoryFilter" class="control-select">
          <option value="">全部分类</option>
          <option v-for="category in categories" :key="category" :value="category">
            {{ category }}
          </option>
        </select>

        <select v-model="sortBy" class="control-select compact">
          <option value="createdAt">创建时间</option>
          <option value="updatedAt">最近更新</option>
          <option value="name">团队名称</option>
          <option value="health">健康分</option>
        </select>

        <button
          type="button"
          class="icon-toggle"
          :title="sortOrder === 'desc' ? '降序' : '升序'"
          @click="sortOrder = sortOrder === 'desc' ? 'asc' : 'desc'"
        >
          <BarChart3 :class="{ flipped: sortOrder === 'asc' }" />
        </button>
      </div>
    </section>

    <section v-if="selectedIds.length" class="batch-bar">
      <span>已选择 {{ selectedIds.length }} 个团队</span>
      <div class="batch-actions">
        <button type="button" @click="handleBatchVisibility('PUBLIC')"><Globe />设为公开</button>
        <button type="button" @click="handleBatchVisibility('PRIVATE')"><Lock />设为私有</button>
        <button type="button" @click="handleBatchCategory"><Layers />分类</button>
        <button type="button" class="danger-action" @click="handleBatchDelete">
          <Trash2 />解散
        </button>
      </div>
    </section>

    <main class="content-grid">
      <section class="table-panel">
        <div v-if="isLoading" class="loading-state">
          <RefreshCw class="spinning" />
          <span>正在同步团队数据</span>
        </div>

        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="select-col">
                  <input type="checkbox" :checked="allPageSelected" @change="toggleSelectAll" />
                </th>
                <th>团队</th>
                <th>负责人</th>
                <th>健康</th>
                <th>协作规模</th>
                <th>内容资产</th>
                <th>待处理</th>
                <th>最近活动</th>
                <th class="right-cell">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="team in teams"
                :key="team.id"
                :class="{ selected: selectedIds.includes(team.id) }"
                @click="openDetail(team)"
              >
                <td class="select-col" @click.stop>
                  <input
                    type="checkbox"
                    :checked="selectedIds.includes(team.id)"
                    @change="toggleSelect(team.id)"
                  />
                </td>
                <td>
                  <div class="team-cell">
                    <div class="team-avatar">
                      <img v-if="team.avatarUrl" :src="team.avatarUrl" alt="" />
                      <Briefcase v-else />
                    </div>
                    <span>
                      <strong>{{ team.name }}</strong>
                      <small>{{ team.category || team.description || '未设置分类' }}</small>
                    </span>
                  </div>
                </td>
                <td>
                  <div class="owner-cell">
                    <UserAvatar :user="team.owner" size="xs" />
                    <span>{{ ownerName(team.owner) }}</span>
                  </div>
                </td>
                <td>
                  <div class="health-cell">
                    <strong :class="scoreClass(team.metrics?.healthScore)">
                      {{ team.metrics?.healthScore ?? 100 }}
                    </strong>
                    <span class="mini-bar">
                      <i
                        :class="scoreClass(team.metrics?.healthScore)"
                        :style="{ width: `${team.metrics?.healthScore ?? 100}%` }"
                      />
                    </span>
                    <small :class="riskClass(team.metrics?.riskLevel)">{{
                      riskLabel(team.metrics?.riskLevel)
                    }}</small>
                  </div>
                </td>
                <td>
                  <div class="dense-metrics">
                    <span><Users />{{ team._count?.members || 0 }} 人</span>
                    <span><Shield />{{ team.metrics?.admins || 0 }} 管理</span>
                    <span><CheckCircle2 />{{ team.metrics?.completionRate || 0 }}%</span>
                  </div>
                </td>
                <td>
                  <div class="dense-metrics">
                    <span><Briefcase />{{ team._count?.projects || 0 }} 项目</span>
                    <span><CheckCircle2 />{{ team._count?.tasks || 0 }} 任务</span>
                    <span><Boxes />{{ team.metrics?.resourceTotal || 0 }} 资源</span>
                  </div>
                </td>
                <td>
                  <div class="pending-cell">
                    <span
                      class="pill"
                      :class="
                        (team.metrics?.pendingApplications || 0) +
                          (team.metrics?.pendingInvitations || 0) >
                        0
                          ? 'tone-amber'
                          : 'tone-green'
                      "
                    >
                      {{
                        (team.metrics?.pendingApplications || 0) +
                        (team.metrics?.pendingInvitations || 0)
                      }}
                    </span>
                    <small
                      >{{ team.metrics?.overdueTasks || 0 }} 逾期 /
                      {{ team.metrics?.unassignedTasks || 0 }} 未分配</small
                    >
                  </div>
                </td>
                <td>
                  <div class="activity-cell">
                    <span>{{ relativeTime(team.metrics?.lastActivityAt || team.updatedAt) }}</span>
                    <small>
                      <Globe v-if="team.visibility === 'PUBLIC'" />
                      <Lock v-else />
                      {{ visibilityLabel(team.visibility) }}
                    </small>
                  </div>
                </td>
                <td class="right-cell" @click.stop>
                  <el-dropdown trigger="click">
                    <button type="button" class="icon-btn"><MoreHorizontal /></button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item @click="openDetail(team)">
                          <Eye class="dropdown-icon" /> 查看详情
                        </el-dropdown-item>
                        <el-dropdown-item @click="openEditModal(team)">
                          <Edit3 class="dropdown-icon" /> 编辑团队
                        </el-dropdown-item>
                        <el-dropdown-item @click="openAddMemberDialog(team)">
                          <UserPlus class="dropdown-icon" /> 添加成员
                        </el-dropdown-item>
                        <el-dropdown-item divided @click="deleteTeam(team)">
                          <Trash2 class="dropdown-icon danger" /> 解散团队
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="teams.length === 0" class="empty-state">
            <Search />
            <strong>没有匹配的团队</strong>
            <span>调整筛选条件后再试一次。</span>
          </div>
        </div>

        <footer class="pagination-bar">
          <span>
            第 {{ pagination.page }} / {{ pagination.totalPages }} 页，{{ pagination.total }} 条
          </span>
          <div class="pagination-actions">
            <select v-model.number="pagination.limit" @change="fetchTeams(1)">
              <option :value="20">20 条</option>
              <option :value="30">30 条</option>
              <option :value="50">50 条</option>
              <option :value="100">100 条</option>
            </select>
            <button
              type="button"
              :disabled="pagination.page <= 1"
              @click="setPage(pagination.page - 1)"
            >
              上一页
            </button>
            <button
              type="button"
              :disabled="pagination.page >= pagination.totalPages"
              @click="setPage(pagination.page + 1)"
            >
              下一页
            </button>
          </div>
        </footer>
      </section>

      <aside class="side-panel">
        <section class="side-section">
          <div class="side-head">
            <h2>待处理队列</h2>
            <span>{{ totalPending }}</span>
          </div>
          <button type="button" class="queue-item" @click="riskFilter = 'PENDING'">
            <AlertTriangle />
            <span>
              <strong>{{ summary.pendingApplications }} 个加入申请</strong>
              <small>{{ summary.pendingInvitations }} 个邀请等待确认</small>
            </span>
          </button>
          <button type="button" class="queue-item" @click="riskFilter = 'OVERDUE'">
            <Clock />
            <span>
              <strong>{{ summary.overdueTeams }} 个团队存在逾期</strong>
              <small>优先检查任务负责人和截止时间</small>
            </span>
          </button>
          <button type="button" class="queue-item" @click="riskFilter = 'EMPTY'">
            <Layers />
            <span>
              <strong>{{ summary.emptyTeams }} 个空团队</strong>
              <small>可归档、补充资源或合并管理</small>
            </span>
          </button>
        </section>

        <section class="side-section">
          <div class="side-head">
            <h2>本页风险团队</h2>
            <span>{{ attentionTeams.length }}</span>
          </div>
          <button
            v-for="team in attentionTeams"
            :key="team.id"
            type="button"
            class="risk-team"
            @click="openDetail(team)"
          >
            <span class="risk-score" :class="scoreClass(team.metrics?.healthScore)">
              {{ team.metrics?.healthScore || 0 }}
            </span>
            <span>
              <strong>{{ team.name }}</strong>
              <small>
                {{ team.metrics?.overdueTasks || 0 }} 逾期 /
                {{ team.metrics?.pendingApplications || 0 }} 申请 /
                {{ team.metrics?.unassignedTasks || 0 }} 未分配
              </small>
            </span>
          </button>
          <div v-if="attentionTeams.length === 0" class="quiet-state">
            <CheckCircle2 />
            <span>本页团队状态稳定</span>
          </div>
        </section>

        <section class="side-section">
          <div class="side-head">
            <h2>运营视图</h2>
            <span>{{ categories.length }}</span>
          </div>
          <div class="mini-grid">
            <button type="button" @click="visibilityFilter = 'PUBLIC'">
              <strong>{{ summary.publicTeams }}</strong>
              <span>公开团队</span>
            </button>
            <button type="button" @click="visibilityFilter = 'PRIVATE'">
              <strong>{{ summary.privateTeams }}</strong>
              <span>私有团队</span>
            </button>
            <button type="button" @click="riskFilter = 'UNASSIGNED'">
              <strong>{{ compactNumber(summary.totalTasks) }}</strong>
              <span>任务池</span>
            </button>
            <button type="button" @click="categoryFilter = ''">
              <strong>{{ compactNumber(summary.totalResources) }}</strong>
              <span>资源池</span>
            </button>
          </div>
        </section>
      </aside>
    </main>

    <el-drawer
      v-model="detailDrawerVisible"
      :size="isMobile ? '100%' : '760px'"
      :with-header="false"
    >
      <div class="drawer-shell">
        <div v-if="isDetailLoading" class="loading-state drawer-loading">
          <RefreshCw class="spinning" />
          <span>正在加载团队洞察</span>
        </div>

        <template v-else-if="detailTeam">
          <header class="drawer-header">
            <div class="drawer-title">
              <div class="team-avatar large">
                <img v-if="detailTeam.avatarUrl" :src="detailTeam.avatarUrl" alt="" />
                <Briefcase v-else />
              </div>
              <div>
                <h2>{{ detailTeam.name }}</h2>
                <p>{{ detailTeam.description || detailTeam.category || '暂无团队描述' }}</p>
                <div class="drawer-pills">
                  <span class="pill" :class="visibilityClass(detailTeam.visibility)">
                    <Globe v-if="detailTeam.visibility === 'PUBLIC'" />
                    <Lock v-else />
                    {{ visibilityLabel(detailTeam.visibility) }}
                  </span>
                  <span class="pill" :class="riskClass(detailTeam.metrics?.riskLevel)">
                    {{ riskLabel(detailTeam.metrics?.riskLevel) }}
                  </span>
                  <span class="pill tone-slate">{{ formatDate(detailTeam.createdAt) }} 创建</span>
                </div>
              </div>
            </div>
            <button type="button" class="icon-btn" @click="detailDrawerVisible = false">
              <X />
            </button>
          </header>

          <div class="drawer-actions">
            <button type="button" @click="openEditModal(detailTeam)"><Edit3 />编辑</button>
            <button type="button" @click="openAddMemberDialog(detailTeam)">
              <UserPlus />添加成员
            </button>
            <button type="button" class="danger-action" @click="deleteTeam(detailTeam)">
              <Trash2 />解散
            </button>
          </div>

          <section class="drawer-scoreboard">
            <div
              class="score-hero"
              :class="scoreClass(detailCounts?.healthScore || detailTeam.metrics?.healthScore)"
            >
              <span>健康分</span>
              <strong>{{
                detailCounts?.healthScore ?? detailTeam.metrics?.healthScore ?? 100
              }}</strong>
            </div>
            <div>
              <span>成员</span>
              <strong>{{ detailCounts?.members ?? detailTeam._count?.members ?? 0 }}</strong>
            </div>
            <div>
              <span>项目</span>
              <strong>{{ detailCounts?.projects ?? detailTeam._count?.projects ?? 0 }}</strong>
            </div>
            <div>
              <span>任务</span>
              <strong>{{ detailCounts?.tasks ?? detailTeam._count?.tasks ?? 0 }}</strong>
            </div>
            <div>
              <span>资源</span>
              <strong>{{
                (detailCounts?.assets || 0) +
                (detailCounts?.materials || 0) +
                (detailCounts?.showcases || 0)
              }}</strong>
            </div>
            <div>
              <span>待处理</span>
              <strong>{{
                (detailCounts?.pendingApplications || 0) + (detailCounts?.pendingInvitations || 0)
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
                <span>{{ selectedTeamDetail?.actionItems.length || 0 }}</span>
              </div>
              <article
                v-for="item in selectedTeamDetail?.actionItems || []"
                :key="item.id"
                class="action-row"
              >
                <span class="severity-dot" :class="`severity-${item.severity}`" />
                <div>
                  <strong>{{ item.title }}</strong>
                  <small
                    >{{ actionItemLabel(item.type) }} ·
                    {{ item.project?.title || '团队事项' }}</small
                  >
                </div>
                <button
                  v-if="item.application"
                  type="button"
                  class="mini-btn"
                  @click="handleApplication(item.application, true)"
                >
                  <Check />通过
                </button>
              </article>
              <div v-if="!selectedTeamDetail?.actionItems.length" class="quiet-state inline">
                <CheckCircle2 />
                <span>暂无高优先级事项</span>
              </div>
            </div>

            <div class="detail-section">
              <div class="detail-head">
                <h3>项目健康</h3>
                <span>{{ selectedTeamDetail?.projectHealth.length || 0 }}</span>
              </div>
              <article
                v-for="project in selectedTeamDetail?.projectHealth || []"
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
              <div v-if="!selectedTeamDetail?.projectHealth.length" class="quiet-state inline">
                <Layers />
                <span>暂无项目</span>
              </div>
            </div>

            <div class="detail-section">
              <div class="detail-head">
                <h3>最近资源</h3>
                <span>
                  {{
                    (selectedTeamDetail?.resources.assets.length || 0) +
                    (selectedTeamDetail?.resources.materials.length || 0) +
                    (selectedTeamDetail?.resources.showcases.length || 0)
                  }}
                </span>
              </div>
              <div class="resource-columns">
                <article
                  v-for="resource in [
                    ...(selectedTeamDetail?.resources.assets || []).slice(0, 3),
                    ...(selectedTeamDetail?.resources.materials || []).slice(0, 3),
                    ...(selectedTeamDetail?.resources.showcases || []).slice(0, 3),
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

          <section v-else-if="detailTab === 'members'" class="drawer-content">
            <article v-for="member in detailMembers" :key="member.userId" class="member-row">
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
                <span class="pill" :class="roleClass(member.role)">{{
                  roleLabel(member.role)
                }}</span>
                <el-dropdown v-if="member.role !== 'OWNER'" trigger="click">
                  <button type="button" class="icon-btn"><MoreHorizontal /></button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item
                        v-if="member.role !== 'ADMIN'"
                        @click="updateMemberRole(detailTeam.id, member.userId, 'ADMIN')"
                      >
                        <Shield class="dropdown-icon" /> 设为管理员
                      </el-dropdown-item>
                      <el-dropdown-item
                        v-if="member.role !== 'MEMBER'"
                        @click="updateMemberRole(detailTeam.id, member.userId, 'MEMBER')"
                      >
                        <Users class="dropdown-icon" /> 设为成员
                      </el-dropdown-item>
                      <el-dropdown-item
                        divided
                        @click="removeMember(detailTeam.id, member.userId, ownerName(member.user))"
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
                <span>{{ detailApplications.length }}</span>
              </div>
              <article
                v-for="application in detailApplications"
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
                    @click="handleApplication(application, true)"
                  >
                    <Check />通过
                  </button>
                  <button
                    type="button"
                    class="mini-btn danger-action"
                    @click="handleApplication(application, false)"
                  >
                    <Ban />拒绝
                  </button>
                </div>
              </article>
              <div v-if="detailApplications.length === 0" class="quiet-state inline">
                <CheckCircle2 />
                <span>暂无加入申请</span>
              </div>
            </div>

            <div class="detail-section">
              <div class="detail-head">
                <h3>待确认邀请</h3>
                <span>{{ detailInvitations.length }}</span>
              </div>
              <article
                v-for="invitation in detailInvitations"
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
                  @click="cancelInvitation(invitation)"
                >
                  <X />撤销
                </button>
              </article>
              <div v-if="detailInvitations.length === 0" class="quiet-state inline">
                <CheckCircle2 />
                <span>暂无待确认邀请</span>
              </div>
            </div>
          </section>

          <section v-else class="drawer-content">
            <article
              v-for="item in selectedTeamDetail?.activity || []"
              :key="item.id"
              class="activity-row"
            >
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
            <div v-if="!selectedTeamDetail?.activity.length" class="quiet-state inline">
              <Clock />
              <span>暂无活动记录</span>
            </div>
          </section>
        </template>
      </div>
    </el-drawer>

    <el-dialog
      v-model="teamDialogVisible"
      :title="modalMode === 'create' ? '新建团队' : '编辑团队'"
      width="560px"
      destroy-on-close
    >
      <div class="form-stack">
        <label>团队名称<input v-model="form.name" placeholder="例如：角色资产制作组" /></label>
        <label>
          负责人
          <select v-model="form.ownerId">
            <option v-for="user in users" :key="user.id" :value="user.id">
              {{ ownerName(user) }}（{{ user.email }}）
            </option>
          </select>
        </label>
        <div class="form-grid">
          <label>
            可见性
            <select v-model="form.visibility">
              <option value="PRIVATE">私有</option>
              <option value="PUBLIC">公开</option>
            </select>
          </label>
          <label>分类<input v-model="form.category" placeholder="建模 / 材质 / 教学" /></label>
        </div>
        <label>头像 URL<input v-model="form.avatarUrl" placeholder="https://..." /></label>
        <label>封面 URL<input v-model="form.coverUrl" placeholder="https://..." /></label>
        <label
          >描述<textarea
            v-model="form.description"
            rows="4"
            placeholder="团队职责、协作范围、审核要求"
          />
        </label>
      </div>
      <template #footer>
        <button type="button" class="ghost-btn dialog-btn" @click="teamDialogVisible = false">
          取消
        </button>
        <button
          type="button"
          class="primary-btn dialog-btn"
          :disabled="isSubmitting"
          @click="handleSubmit"
        >
          保存
        </button>
      </template>
    </el-dialog>

    <el-dialog v-model="addMemberDialogVisible" title="添加团队成员" width="440px" destroy-on-close>
      <div class="form-stack">
        <label>
          用户
          <select v-model="selectedUserId">
            <option value="">请选择用户</option>
            <option v-for="user in availableUsers" :key="user.id" :value="user.id">
              {{ ownerName(user) }}（{{ user.email }}）
            </option>
          </select>
        </label>
        <label>
          角色
          <select v-model="selectedMemberRole">
            <option value="MEMBER">成员</option>
            <option value="ADMIN">管理员</option>
          </select>
        </label>
      </div>
      <template #footer>
        <button type="button" class="ghost-btn dialog-btn" @click="addMemberDialogVisible = false">
          取消
        </button>
        <button
          type="button"
          class="primary-btn dialog-btn"
          :disabled="!selectedUserId"
          @click="handleAddMember"
        >
          添加
        </button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.admin-teams-page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: #f4f7fb;
  color: #0f172a;
}

.page-header,
.control-panel,
.table-panel,
.side-panel,
.batch-bar {
  border: 1px solid #e5eaf3;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.04);
}

.page-header {
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px;
}

.header-copy,
.drawer-title,
.team-cell,
.owner-cell,
.header-meta,
.header-actions,
.filter-row,
.batch-actions,
.drawer-actions,
.drawer-pills,
.member-actions,
.pending-actions,
.pagination-actions {
  display: flex;
  align-items: center;
}

.header-copy {
  align-items: flex-start;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.eyebrow {
  margin: 0;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

h1,
h2,
h3,
p {
  margin: 0;
}

h1 {
  font-size: 22px;
  line-height: 1.15;
  font-weight: 900;
  letter-spacing: 0;
}

.header-meta {
  gap: 10px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.header-actions,
.filter-row,
.batch-actions,
.drawer-actions {
  gap: 8px;
  flex-wrap: wrap;
}

button {
  border: 0;
  cursor: pointer;
  font: inherit;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.primary-btn,
.ghost-btn,
.drawer-actions button,
.batch-actions button,
.mini-btn {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 900;
  white-space: nowrap;
}

.primary-btn {
  color: #ffffff;
  background: #7c3aed;
}

.ghost-btn,
.drawer-actions button,
.batch-actions button,
.mini-btn {
  color: #334155;
  background: #f8fafc;
  border: 1px solid #dbe5f2;
}

.danger-action {
  color: #be123c !important;
  background: #ffe4e6 !important;
  border-color: #fecdd3 !important;
}

button svg {
  width: 16px;
  height: 16px;
}

.metric-strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.metric-tile {
  min-height: 54px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  border: 1px solid #e8eef5;
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
}

.metric-tile > svg {
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
}

.metric-tile div {
  min-width: 0;
}

.metric-tile span,
.metric-tile small {
  display: block;
  color: #64748b;
  font-size: 10px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-tile strong {
  display: block;
  margin-top: 1px;
  color: #0f172a;
  font-size: 19px;
  line-height: 1;
  font-weight: 900;
}

.tile-blue > svg {
  color: #2563eb;
}

.tile-green > svg {
  color: #059669;
}

.tile-purple > svg {
  color: #7c3aed;
}

.tile-amber > svg {
  color: #d97706;
}

.control-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px;
}

.search-box {
  width: min(360px, 100%);
  height: 34px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid #dbe5f2;
  border-radius: 8px;
  background: #f8fafc;
  color: #64748b;
}

.search-box input,
.form-stack input,
.form-stack select,
.form-stack textarea {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #0f172a;
}

.segmented {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: 8px;
  background: #eef3f9;
}

.segmented button {
  min-height: 30px;
  padding: 0 10px;
  border-radius: 6px;
  color: #334155;
  background: transparent;
  font-size: 12px;
  font-weight: 900;
}

.segmented button.active {
  color: #7c3aed;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
}

.control-select,
.pagination-actions select {
  height: 34px;
  min-width: 116px;
  border: 1px solid #dbe5f2;
  border-radius: 8px;
  padding: 0 10px;
  color: #334155;
  background: #ffffff;
  font-size: 13px;
  font-weight: 800;
}

.control-select.compact {
  min-width: 104px;
}

.icon-toggle,
.icon-btn {
  width: 32px;
  height: 32px;
  display: inline-grid;
  place-items: center;
  border-radius: 8px;
  color: #64748b;
  background: #f8fafc;
  border: 1px solid #dbe5f2;
}

.icon-toggle:hover,
.icon-btn:hover {
  color: #0f172a;
  background: #eef3f9;
}

.icon-toggle .flipped {
  transform: rotate(180deg);
}

.batch-bar {
  min-height: 46px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #334155;
  background: #fff7ed;
  border-color: #fed7aa;
  font-size: 13px;
  font-weight: 900;
}

.content-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 10px;
}

.table-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

table {
  width: 100%;
  min-width: 1120px;
  border-collapse: collapse;
}

th,
td {
  padding: 10px 12px;
  border-bottom: 1px solid #edf2f7;
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}

th {
  position: sticky;
  top: 0;
  z-index: 1;
  height: 42px;
  color: #64748b;
  background: #fbfdff;
  font-size: 12px;
  font-weight: 900;
}

tbody tr {
  height: 66px;
  cursor: pointer;
}

tbody tr:hover td,
tbody tr.selected td {
  background: #f8f5ff;
}

.select-col {
  width: 38px;
}

.select-col input {
  width: 15px;
  height: 15px;
  accent-color: #7c3aed;
  cursor: pointer;
}

.right-cell {
  text-align: right;
}

.team-cell,
.owner-cell {
  gap: 10px;
  min-width: 0;
}

.team-avatar {
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 8px;
  color: #7c3aed;
  background: #f3e8ff;
}

.team-avatar.large {
  width: 58px;
  height: 58px;
}

.team-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.team-cell strong,
.team-cell small,
.owner-cell strong,
.owner-cell small {
  display: block;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.team-cell strong,
.owner-cell strong {
  color: #0f172a;
  font-size: 14px;
  font-weight: 900;
}

.team-cell small,
.owner-cell small {
  margin-top: 3px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.owner-cell > span {
  min-width: 0;
  color: #334155;
  font-size: 13px;
  font-weight: 800;
}

.health-cell {
  width: 104px;
  display: grid;
  gap: 4px;
}

.health-cell strong {
  font-size: 18px;
  line-height: 1;
  font-weight: 900;
}

.health-cell small {
  width: fit-content;
  font-size: 11px;
  font-weight: 900;
}

.mini-bar {
  width: 82px;
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: #e2e8f0;
}

.mini-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.score-green,
.score-green i,
.score-green b {
  color: #047857;
  background: #10b981;
}

.score-amber,
.score-amber i,
.score-amber b {
  color: #b45309;
  background: #f59e0b;
}

.score-red,
.score-red i,
.score-red b {
  color: #be123c;
  background: #e11d48;
}

.dense-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, max-content));
  gap: 4px 10px;
}

.dense-metrics span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #475569;
  font-size: 12px;
  font-weight: 800;
}

.dense-metrics svg {
  width: 13px;
  height: 13px;
  color: #94a3b8;
}

.pending-cell,
.activity-cell {
  display: grid;
  gap: 5px;
}

.pending-cell small,
.activity-cell small {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.activity-cell span {
  color: #334155;
  font-size: 13px;
  font-weight: 900;
}

.pill {
  min-height: 24px;
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 12px;
  line-height: 1;
  font-weight: 900;
}

.pill svg {
  width: 13px;
  height: 13px;
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

.dropdown-icon {
  width: 14px;
  height: 14px;
  margin-right: 6px;
}

.dropdown-icon.danger {
  color: #be123c;
}

.loading-state,
.empty-state,
.quiet-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: #64748b;
  font-weight: 800;
}

.loading-state,
.empty-state {
  min-height: 240px;
  flex-direction: column;
}

.loading-state svg,
.empty-state svg {
  width: 34px;
  height: 34px;
}

.quiet-state {
  min-height: 70px;
  border: 1px dashed #dbe5f2;
  border-radius: 8px;
  background: #fbfdff;
}

.quiet-state.inline {
  min-height: 48px;
}

.spinning {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.pagination-bar {
  min-height: 52px;
  padding: 9px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid #edf2f7;
  color: #64748b;
  font-size: 13px;
  font-weight: 800;
}

.pagination-actions {
  gap: 8px;
}

.pagination-actions button {
  height: 34px;
  padding: 0 12px;
  border: 1px solid #dbe5f2;
  border-radius: 8px;
  color: #334155;
  background: #ffffff;
  font-size: 13px;
  font-weight: 900;
}

.side-panel {
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 10px;
  padding: 10px;
  overflow: auto;
}

.side-section {
  display: grid;
  gap: 8px;
}

.side-head {
  min-height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.side-head h2 {
  font-size: 14px;
  font-weight: 900;
}

.side-head span {
  min-width: 24px;
  min-height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 7px;
  border-radius: 999px;
  color: #7c3aed;
  background: #f3e8ff;
  font-size: 12px;
  font-weight: 900;
}

.queue-item,
.risk-team {
  width: 100%;
  min-height: 58px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid #e8eef5;
  border-radius: 8px;
  color: #334155;
  background: #fbfdff;
  text-align: left;
}

.queue-item:hover,
.risk-team:hover {
  border-color: #c4b5fd;
  background: #f8f5ff;
}

.queue-item svg {
  width: 20px;
  height: 20px;
  color: #7c3aed;
  flex: 0 0 auto;
}

.queue-item span,
.risk-team span:not(.risk-score) {
  min-width: 0;
}

.queue-item strong,
.queue-item small,
.risk-team strong,
.risk-team small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-item strong,
.risk-team strong {
  font-size: 13px;
  font-weight: 900;
}

.queue-item small,
.risk-team small {
  margin-top: 3px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.risk-score {
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: #ffffff;
  font-size: 13px;
  font-weight: 900;
}

.mini-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.mini-grid button {
  min-height: 62px;
  display: grid;
  gap: 4px;
  padding: 10px;
  border: 1px solid #e8eef5;
  border-radius: 8px;
  background: #fbfdff;
  color: #334155;
  text-align: left;
}

.mini-grid strong {
  font-size: 20px;
  line-height: 1;
  font-weight: 900;
}

.mini-grid span {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

:deep(.el-drawer__body) {
  padding: 0;
}

.drawer-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  overflow: auto;
  background: #ffffff;
}

.drawer-loading {
  height: 100%;
}

.drawer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.drawer-title {
  gap: 12px;
  min-width: 0;
}

.drawer-title h2 {
  font-size: 22px;
  line-height: 1.15;
  font-weight: 900;
}

.drawer-title p {
  margin-top: 4px;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
}

.drawer-pills {
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.drawer-actions {
  padding: 10px 0;
  border-top: 1px solid #edf2f7;
  border-bottom: 1px solid #edf2f7;
}

.drawer-scoreboard {
  display: grid;
  grid-template-columns: 1.25fr repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.drawer-scoreboard > div {
  min-height: 66px;
  display: grid;
  gap: 4px;
  padding: 10px;
  border: 1px solid #e8eef5;
  border-radius: 8px;
  background: #fbfdff;
}

.drawer-scoreboard span {
  color: #64748b;
  font-size: 12px;
  font-weight: 900;
}

.drawer-scoreboard strong {
  color: #0f172a;
  font-size: 22px;
  line-height: 1;
  font-weight: 900;
}

.score-hero strong,
.score-hero span {
  color: #ffffff;
}

.drawer-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  padding: 4px;
  border-radius: 8px;
  background: #eef3f9;
}

.drawer-tabs button {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 6px;
  color: #334155;
  background: transparent;
  font-size: 12px;
  font-weight: 900;
}

.drawer-tabs button.active {
  color: #7c3aed;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
}

.drawer-content {
  display: grid;
  gap: 12px;
}

.detail-section {
  display: grid;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #edf2f7;
}

.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.detail-head h3 {
  font-size: 14px;
  font-weight: 900;
}

.detail-head span {
  color: #64748b;
  font-size: 12px;
  font-weight: 900;
}

.action-row,
.project-row,
.member-row,
.pending-row,
.activity-row,
.resource-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid #e8eef5;
  border-radius: 8px;
  background: #fbfdff;
}

.action-row > div,
.project-row > div:first-child,
.activity-row > div,
.resource-row span,
.pending-row > div:first-child {
  min-width: 0;
  flex: 1;
}

.action-row strong,
.project-row strong,
.member-row strong,
.pending-row strong,
.activity-row strong,
.resource-row strong,
.action-row small,
.project-row small,
.member-row small,
.pending-row small,
.activity-row small,
.resource-row small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-row strong,
.project-row strong,
.member-row strong,
.pending-row strong,
.activity-row strong,
.resource-row strong {
  color: #0f172a;
  font-size: 13px;
  font-weight: 900;
}

.action-row small,
.project-row small,
.member-row small,
.pending-row small,
.activity-row small,
.resource-row small {
  margin-top: 3px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.severity-dot {
  width: 10px;
  height: 10px;
  flex: 0 0 auto;
  border-radius: 999px;
}

.severity-critical {
  background: #e11d48;
}

.severity-high {
  background: #f97316;
}

.severity-medium {
  background: #f59e0b;
}

.project-progress {
  width: 118px;
  flex: 0 0 auto;
  display: grid;
  gap: 5px;
}

.project-progress span {
  color: #334155;
  font-size: 12px;
  font-weight: 900;
}

.project-progress i {
  width: 100%;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: #e2e8f0;
}

.project-progress b {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #7c3aed;
}

.resource-columns {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.resource-row svg,
.activity-icon {
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: #7c3aed;
  background: #f3e8ff;
}

.activity-icon svg {
  width: 15px;
  height: 15px;
}

.member-row {
  justify-content: space-between;
}

.member-metrics {
  min-width: 180px;
  display: grid;
  grid-template-columns: repeat(3, max-content);
  gap: 6px;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.form-stack {
  display: grid;
  gap: 14px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.form-stack label {
  display: grid;
  gap: 7px;
  color: #334155;
  font-size: 12px;
  font-weight: 900;
}

.form-stack input,
.form-stack select,
.form-stack textarea {
  min-height: 40px;
  padding: 10px 11px;
  border: 1px solid #dbe5f2;
  border-radius: 8px;
  background: #f8fafc;
  resize: vertical;
}

.dialog-btn {
  margin-left: 8px;
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
}

@media (max-width: 1280px) {
  .metric-strip {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .content-grid {
    grid-template-columns: 1fr;
  }

  .side-panel {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 920px) {
  .page-header,
  .control-panel,
  .batch-bar,
  .pagination-bar {
    align-items: stretch;
    flex-direction: column;
  }

  .search-box {
    width: 100%;
  }

  .filter-row,
  .header-actions,
  .batch-actions {
    width: 100%;
  }

  .control-select {
    flex: 1;
  }

  .side-panel,
  .drawer-scoreboard,
  .resource-columns {
    grid-template-columns: 1fr;
  }

  .drawer-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .admin-teams-page {
    padding: 8px;
  }

  .metric-strip {
    grid-template-columns: 1fr;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .member-row,
  .pending-row,
  .project-row {
    align-items: stretch;
    flex-direction: column;
  }

  .member-metrics {
    min-width: 0;
    grid-template-columns: 1fr;
  }
}
</style>
