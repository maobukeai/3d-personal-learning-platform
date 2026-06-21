<script setup lang="ts">
import { formatDate } from '@/utils/format';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  Boxes,
  Briefcase,
  CheckCircle2,
  ClipboardList,
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
  UserPlus,
  Users,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import UserAvatar from '@/components/UserAvatar.vue';
import { useWorkspaceStore } from '@/stores/workspace';
import AdminTeamDetailDialog from './components/AdminTeamDetailDialog.vue';
import AdminTeamFormDialog from './components/AdminTeamFormDialog.vue';
import Modal from '@/components/ui/Modal.vue';
import UiButton from '@/components/ui/Button.vue';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';
import PageHeader from '@/components/PageHeader.vue';

export type TeamVisibility = 'PUBLIC' | 'PRIVATE';
type VisibilityFilter = 'ALL' | TeamVisibility;
export type TeamRole = 'OWNER' | 'ADMIN' | 'MEMBER';
type RiskFilter = 'ALL' | 'PENDING' | 'OVERDUE' | 'UNASSIGNED' | 'EMPTY';
type SortBy = 'createdAt' | 'updatedAt' | 'name' | 'health';
type SortOrder = 'asc' | 'desc';

export interface AdminTeamUser {
  id: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

export interface AdminTeamMember {
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

export interface AdminTeamCounts {
  members?: number;
  assets?: number;
  projects?: number;
  tasks?: number;
  materials?: number;
  showcases?: number;
  invitations?: number;
  applications?: number;
}

export interface AdminTeamMetrics {
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

export interface AdminTeam {
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

export interface TeamApplication {
  id: string;
  teamId: string;
  userId: string;
  message?: string | null;
  status: string;
  createdAt: string;
  user: AdminTeamUser;
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  inviterId: string;
  inviteeEmail: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface TeamProjectHealth {
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

export interface TeamActionItem {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium';
  title: string;
  dueDate?: string | null;
  assignee?: AdminTeamUser | null;
  project?: { id: string; title: string; color?: string } | null;
  application?: TeamApplication;
}

export interface TeamActivityItem {
  id: string;
  type: string;
  title: string;
  actor?: AdminTeamUser | null;
  project?: { id: string; title: string; color?: string } | null;
  createdAt: string;
}

export interface TeamDetailResponse {
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
const detailDialogVisible = ref(false);
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

const scoreToneClass = (score?: number) => ({
  'tone-red': (score || 0) < 60,
  'tone-amber': (score || 0) >= 60 && (score || 0) < 80,
  'tone-green': (score || 0) >= 80,
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

const getBadgeVariant = (label: string) => {
  if (label === '正常' || label === '稳定' || label === '低风险' || label === '丰富')
    return 'success';
  if (label === '关注' || label === '需关注' || label === '存在逾期') return 'warning';
  if (label === '高压' || label === '高风险') return 'danger';
  return 'primary';
};

const averageHealth = computed(() => {
  if (teams.value.length === 0) return 100;
  const sum = teams.value.reduce((acc, t) => acc + (t.metrics?.healthScore ?? 100), 0);
  return Math.round(sum / teams.value.length);
});

const consolidatedCards = computed(() => {
  const sumVal = summary.value;
  return [
    {
      label: '全站团队规模',
      value: sumVal.totalTeams,
      hint: `${sumVal.publicTeams} 公开 · ${sumVal.privateTeams} 私有`,
      icon: Briefcase,
      color: 'text-sky-600 bg-sky-500/10 border-sky-500/20',
      health: { label: '正常', variant: 'success' as const },
    },
    {
      label: '协作成员覆盖',
      value: sumVal.totalMembers,
      hint: `活动项目 ${sumVal.totalProjects} · 平均健康 ${averageHealth.value}分`,
      icon: Users,
      color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      health:
        averageHealth.value < 70
          ? { label: '关注', variant: 'warning' as const }
          : { label: '稳定', variant: 'success' as const },
    },
    {
      label: '内容资产沉淀',
      value: sumVal.totalResources,
      hint: `${sumVal.totalAssets} 资产 · ${sumVal.totalMaterials} 材质 · ${sumVal.totalShowcases} 作品`,
      icon: Boxes,
      color: 'text-purple-600 bg-purple-500/10 border-purple-500/20',
      health: { label: '丰富', variant: 'success' as const },
    },
    {
      label: '项目任务状态',
      value: sumVal.totalTasks,
      hint: `逾期团队 ${sumVal.overdueTeams} · 待处理 ${totalPending.value}`,
      icon: CheckCircle2,
      color: sumVal.overdueTeams
        ? 'text-amber-600 bg-amber-500/10 border-amber-500/20'
        : 'text-green-600 bg-green-500/10 border-green-500/20',
      health: sumVal.overdueTeams
        ? { label: '存在逾期', variant: 'warning' as const }
        : { label: '稳定', variant: 'success' as const },
    },
  ];
});

const visibilityOptions = [
  { value: 'ALL', label: '全部公开性' },
  { value: 'PUBLIC', label: '公开' },
  { value: 'PRIVATE', label: '私有' },
];

const riskOptions = [
  { value: 'ALL', label: '全部状态' },
  { value: 'PENDING', label: '有待处理' },
  { value: 'OVERDUE', label: '存在逾期' },
  { value: 'UNASSIGNED', label: '未分配任务' },
  { value: 'EMPTY', label: '空团队' },
];

const sortOptions = [
  { value: 'createdAt', label: '创建时间' },
  { value: 'updatedAt', label: '最近更新' },
  { value: 'name', label: '团队名称' },
  { value: 'health', label: '健康分' },
];

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

    if (detailDialogVisible.value && detailTeam.value) {
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
  if (detailDialogVisible.value && detailTeam.value) {
    await fetchTeamDetail(detailTeam.value.id);
  }
};

const openDetail = async (team: AdminTeam) => {
  selectedTeam.value = team;
  selectedTeamDetail.value = null;
  detailTab.value = 'overview';
  detailDialogVisible.value = true;
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
    if (detailDialogVisible.value && form.value.id) await fetchTeamDetail(form.value.id);
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
    if (detailTeam.value?.id === team.id) detailDialogVisible.value = false;
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
    detailDialogVisible.value = false;
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

void consolidatedCards.value;
</script>

<template>
  <div class="admin-teams-page flex flex-1 min-h-0 flex-col overflow-hidden">
    <main class="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
      <PageHeader
        title="团队管理"
        subtitle="全站团队组织、协作规范及数据资产的合规统计与治理"
        variant="card"
      >
        <template #title-badge>
          <div class="flex flex-wrap items-center gap-1.5 ml-2">
            <Badge variant="info">团队数: {{ compactNumber(summary.totalTeams) }}</Badge>
            <Badge variant="info">成员数: {{ compactNumber(summary.totalMembers) }}</Badge>
            <Badge variant="info">待处理: {{ compactNumber(totalPending) }}</Badge>
          </div>
        </template>

        <template #center>
          <!-- Compact Search Box (Centered) -->
          <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 shrink-0">
            <Search />
            <input v-model="searchQuery" placeholder="搜索团队、负责人..." type="search" />
          </label>
        </template>

        <UiButton
          variant="secondary"
          size="sm"
          :icon="RefreshCw"
          :loading="isLoading"
          @click="refreshAll"
        >
          刷新
        </UiButton>
        <UiButton variant="secondary" size="sm" :icon="Download" @click="exportCsv">
          导出
        </UiButton>
        <UiButton variant="primary" size="sm" :icon="Plus" @click="openCreateModal">
          新建团队
        </UiButton>
      </PageHeader>
      <!-- Top KPI metrics grid (Horizontal compact) -->
      <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card
          v-for="card in consolidatedCards"
          :key="card.label"
          hoverable
          glow
          class="group !p-2 px-2.5"
        >
          <div class="flex items-center justify-between w-full gap-3">
            <!-- Left: Icon & Info -->
            <div class="flex items-center gap-2 min-w-0">
              <span
                class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                :class="card.color"
              >
                <component :is="card.icon" class="h-3.5 w-3.5" />
              </span>
              <div class="min-w-0">
                <p
                  class="text-[11px] font-bold text-[var(--text-secondary)] truncate leading-tight"
                >
                  {{ card.label }}
                </p>
                <p
                  class="text-[9px] text-[var(--text-secondary)] opacity-80 truncate mt-0.5 leading-none"
                  :title="card.hint"
                >
                  {{ card.hint }}
                </p>
              </div>
            </div>

            <!-- Right: Metric & Health Badge -->
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-base font-black text-[var(--text-primary)] leading-none">
                {{ card.value.toLocaleString() }}
              </span>
              <Badge :variant="getBadgeVariant(card.health.label)">
                {{ card.health.label }}
              </Badge>
            </div>
          </div>
        </Card>
      </section>

      <Card padding="sm">
        <div class="flex items-center gap-2 flex-wrap">
          <el-select v-model="visibilityFilter" size="small" style="width: 110px">
            <el-option
              v-for="option in visibilityOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>

          <el-select v-model="riskFilter" size="small" style="width: 120px">
            <el-option
              v-for="option in riskOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>

          <el-select v-model="categoryFilter" size="small" style="width: 110px">
            <el-option label="全部分类" value="" />
            <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
          </el-select>

          <el-select v-model="sortBy" size="small" style="width: 110px">
            <el-option
              v-for="option in sortOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </div>
      </Card>

      <section v-if="selectedIds.length" class="batch-bar">
        <span>已选择 {{ selectedIds.length }} 个团队</span>
        <div class="batch-actions">
          <UiButton variant="secondary" :icon="Globe" @click="handleBatchVisibility('PUBLIC')"
            >设为公开</UiButton
          >
          <UiButton variant="secondary" :icon="Lock" @click="handleBatchVisibility('PRIVATE')"
            >设为私有</UiButton
          >
          <UiButton variant="secondary" :icon="Layers" @click="handleBatchCategory">分类</UiButton>
          <UiButton variant="danger" :icon="Trash2" @click="handleBatchDelete">解散</UiButton>
        </div>
      </section>

      <div class="content-grid">
        <Card padding="none" class="table-shell-card overflow-hidden">
          <div class="table-wrap flex-1 min-h-0 overflow-auto">
            <el-table
              v-loading="isLoading"
              :data="teams"
              class="user-table w-full"
              row-class-name="table-row"
              @row-click="openDetail"
            >
              <el-table-column width="48">
                <template #header>
                  <input
                    type="checkbox"
                    :checked="allPageSelected"
                    @change="toggleSelectAll"
                    @click.stop
                  />
                </template>
                <template #default="{ row }">
                  <input
                    type="checkbox"
                    :checked="selectedIds.includes(row.id)"
                    @change="toggleSelect(row.id)"
                    @click.stop
                  />
                </template>
              </el-table-column>

              <el-table-column label="团队" min-width="220">
                <template #default="{ row }">
                  <div class="team-cell flex items-center gap-2.5">
                    <div
                      class="team-avatar w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-purple-50 text-[var(--accent)] border border-purple-100 dark:bg-white/5 dark:border-white/10"
                    >
                      <img
                        v-if="row.avatarUrl"
                        :src="row.avatarUrl"
                        alt=""
                        class="w-full h-full object-cover"
                      />
                      <Briefcase v-else class="w-4 h-4 text-purple-500" />
                    </div>
                    <div class="min-w-0">
                      <strong class="text-sm font-bold truncate text-[var(--text-primary)] block">{{
                        row.name
                      }}</strong>
                      <small
                        class="text-[11px] text-[var(--text-secondary)] truncate block mt-0.5"
                        >{{ row.category || row.description || '未分类' }}</small
                      >
                    </div>
                  </div>
                </template>
              </el-table-column>

              <el-table-column label="负责人" width="160">
                <template #default="{ row }">
                  <div class="owner-cell flex items-center gap-2">
                    <UserAvatar :user="row.owner" size="xs" />
                    <span class="text-sm font-semibold text-[var(--text-primary)] truncate">{{
                      ownerName(row.owner)
                    }}</span>
                  </div>
                </template>
              </el-table-column>

              <el-table-column label="健康" width="150">
                <template #default="{ row }">
                  <div class="health-cell flex flex-col gap-1.5 w-full pr-2">
                    <div class="flex items-center justify-between gap-1 text-xs">
                      <span
                        class="pill text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none shrink-0"
                        :class="scoreToneClass(row.metrics?.healthScore)"
                      >
                        {{ row.metrics?.healthScore ?? 100 }}分
                      </span>
                      <span
                        class="pill text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none shrink-0"
                        :class="riskClass(row.metrics?.riskLevel)"
                      >
                        {{ riskLabel(row.metrics?.riskLevel) }}
                      </span>
                    </div>
                    <div
                      class="w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden"
                    >
                      <div
                        class="h-full rounded-full"
                        :class="scoreClass(row.metrics?.healthScore)"
                        :style="{ width: `${row.metrics?.healthScore ?? 100}%` }"
                      ></div>
                    </div>
                  </div>
                </template>
              </el-table-column>

              <el-table-column label="协作规模" width="180">
                <template #default="{ row }">
                  <div
                    class="dense-metrics flex items-center gap-3 text-xs text-[var(--text-secondary)]"
                  >
                    <span class="inline-flex items-center gap-1" title="成员数量"
                      ><Users class="w-3.5 h-3.5 text-slate-400" />{{
                        row._count?.members || 0
                      }}</span
                    >
                    <span class="inline-flex items-center gap-1" title="管理员数量"
                      ><Shield class="w-3.5 h-3.5 text-slate-400" />{{
                        row.metrics?.admins || 0
                      }}</span
                    >
                    <span class="inline-flex items-center gap-1" title="完成率"
                      ><CheckCircle2 class="w-3.5 h-3.5 text-slate-400" />{{
                        row.metrics?.completionRate || 0
                      }}%</span
                    >
                  </div>
                </template>
              </el-table-column>

              <el-table-column label="内容资产" width="180">
                <template #default="{ row }">
                  <div
                    class="dense-metrics flex items-center gap-3 text-xs text-[var(--text-secondary)]"
                  >
                    <span class="inline-flex items-center gap-1" title="项目数"
                      ><Briefcase class="w-3.5 h-3.5 text-slate-400" />{{
                        row._count?.projects || 0
                      }}</span
                    >
                    <span class="inline-flex items-center gap-1" title="任务数"
                      ><ClipboardList class="w-3.5 h-3.5 text-slate-400" />{{
                        row._count?.tasks || 0
                      }}</span
                    >
                    <span class="inline-flex items-center gap-1" title="资源总数"
                      ><Boxes class="w-3.5 h-3.5 text-slate-400" />{{
                        row.metrics?.resourceTotal || 0
                      }}</span
                    >
                  </div>
                </template>
              </el-table-column>

              <el-table-column label="待处理" width="150">
                <template #default="{ row }">
                  <div class="flex items-center gap-2">
                    <span
                      class="pill text-xs px-1.5 py-0.5 font-bold"
                      :class="
                        (row.metrics?.pendingApplications || 0) +
                          (row.metrics?.pendingInvitations || 0) >
                        0
                          ? 'tone-amber'
                          : 'tone-green'
                      "
                    >
                      {{
                        (row.metrics?.pendingApplications || 0) +
                        (row.metrics?.pendingInvitations || 0)
                      }}
                      申请
                    </span>
                    <span class="text-[11px] text-[var(--text-secondary)]">
                      {{ row.metrics?.overdueTasks || 0 }} 逾期
                    </span>
                  </div>
                </template>
              </el-table-column>

              <el-table-column label="最近活动" min-width="150">
                <template #default="{ row }">
                  <div class="flex flex-col gap-0.5 text-xs">
                    <span class="font-bold text-[var(--text-primary)]">{{
                      relativeTime(row.metrics?.lastActivityAt || row.updatedAt)
                    }}</span>
                    <span
                      class="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] mt-0.5"
                    >
                      <component
                        :is="row.visibility === 'PUBLIC' ? Globe : Lock"
                        class="w-3 h-3 text-slate-400"
                      />
                      {{ visibilityLabel(row.visibility) }}
                    </span>
                  </div>
                </template>
              </el-table-column>

              <el-table-column label="操作" width="80" align="right">
                <template #default="{ row }">
                  <div @click.stop>
                    <el-dropdown trigger="click">
                      <button
                        type="button"
                        class="icon-btn p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                      >
                        <MoreHorizontal class="w-4 h-4 text-slate-500" />
                      </button>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item @click="openDetail(row)">
                            <Eye class="dropdown-icon" /> 查看详情
                          </el-dropdown-item>
                          <el-dropdown-item @click="openEditModal(row)">
                            <Edit3 class="dropdown-icon" /> 编辑团队
                          </el-dropdown-item>
                          <el-dropdown-item @click="openAddMemberDialog(row)">
                            <UserPlus class="dropdown-icon" /> 添加成员
                          </el-dropdown-item>
                          <el-dropdown-item divided @click="deleteTeam(row)">
                            <Trash2 class="dropdown-icon danger" /> 解散团队
                          </el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <div
            class="pagination-wrap mt-4 flex items-center justify-between p-3 border-t border-slate-100 dark:border-white/5 bg-white/40 dark:bg-transparent"
          >
            <el-pagination
              v-model:current-page="pagination.page"
              v-model:page-size="pagination.limit"
              :page-sizes="[20, 30, 50, 100]"
              :total="pagination.total"
              layout="total, sizes, prev, pager, next"
              @current-change="fetchTeams"
              @size-change="fetchTeams(1)"
            />
          </div>
        </Card>
      </div>
    </main>

    <AdminTeamDetailDialog
      v-model="detailDialogVisible"
      :team="selectedTeam"
      :detail="selectedTeamDetail"
      :is-detail-loading="isDetailLoading"
      :is-mobile="isMobile"
      @edit="openEditModal"
      @add-member="openAddMemberDialog"
      @delete="deleteTeam"
      @update-member-role="
        (payload) => updateMemberRole(payload.teamId, payload.userId, payload.role)
      "
      @remove-member="(payload) => removeMember(payload.teamId, payload.userId, payload.label)"
      @handle-application="(payload) => handleApplication(payload.application, payload.accept)"
      @cancel-invitation="cancelInvitation"
    />

    <AdminTeamFormDialog
      v-model="teamDialogVisible"
      :mode="modalMode"
      :team="selectedTeam"
      :users="users"
      :is-submitting="isSubmitting"
      @submit="
        async (formData) => {
          form = formData;
          await handleSubmit();
        }
      "
    />

    <Modal
      :show="addMemberDialogVisible"
      title="添加团队成员"
      size="sm"
      @close="addMemberDialogVisible = false"
    >
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
        <UiButton variant="secondary" class="ml-2" @click="addMemberDialogVisible = false">
          取消
        </UiButton>
        <UiButton
          variant="primary"
          class="ml-2"
          :disabled="!selectedUserId"
          @click="handleAddMember"
        >
          添加
        </UiButton>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.admin-teams-page {
  min-height: 0;
  background: transparent;
  color: #0f172a;
}

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
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
}

.table-shell-card {
  min-height: 480px;
}

.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
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
  display: flex;
  align-items: center;
  gap: 12px;
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

/* Side panel styles removed */

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

  .drawer-scoreboard,
  .resource-columns {
    grid-template-columns: 1fr;
  }

  .drawer-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
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
