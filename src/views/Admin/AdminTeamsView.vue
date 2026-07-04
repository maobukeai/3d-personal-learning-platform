<script setup lang="ts">
import { formatDate } from '@/utils/format';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Boxes, Briefcase, CheckCircle2, Users, RefreshCw, Download, Plus } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import { useWorkspaceStore } from '@/stores/workspace';
import AdminTeamDetailDialog from './components/AdminTeamDetailDialog.vue';
import AdminTeamFormDialog from './components/AdminTeamFormDialog.vue';
import AdminHeader from './components/AdminHeader.vue';
import Badge from '@/components/ui/Badge.vue';
import UiButton from '@/components/ui/Button.vue';
import AdminTeamsFilters from './components/AdminTeamsFilters.vue';
import AdminTeamsBatchBar from './components/AdminTeamsBatchBar.vue';
import AdminTeamsTable from './components/AdminTeamsTable.vue';
import AdminTeamAddMemberModal from './components/AdminTeamAddMemberModal.vue';
import type {
  AdminTeam,
  AdminTeamUser,
  AdminTeamsResponse,
  AdminTeamsSummary,
  AdminUsersResponse,
  PaginationState,
  TeamApplication,
  TeamDetailResponse,
  TeamInvitation,
  TeamVisibility,
  VisibilityFilter,
  RiskFilter,
  SortBy,
  SortOrder,
} from './components/adminTeamsTypes';
import { ownerName, visibilityLabel, compactNumber } from './components/adminTeamsUtils';

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

const allPageSelected = computed(
  () => teams.value.length > 0 && teams.value.every((team) => selectedIds.value.includes(team.id)),
);

const totalPending = computed(
  () => summary.value.pendingApplications + summary.value.pendingInvitations,
);

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

const detailTeam = computed(() => selectedTeamDetail.value?.team || selectedTeam.value);
const detailMembers = computed(
  () => selectedTeamDetail.value?.members || detailTeam.value?.members || [],
);

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
    logError(error, { operation: 'fetchUsers', view: 'AdminTeamsView' });
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

const onFormSubmit = (formData: typeof form.value) => {
  form.value = formData;
  handleSubmit();
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
  <div class="admin-teams-page flex flex-1 min-h-0 flex-col overflow-hidden mobile-adaptive">
    <main class="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
      <!-- Ultra-Compact Single Row Header -->
      <AdminHeader
        title="团队管理"
        subtitle="全站团队组织、协作规范及数据资产的合规统计与治理"
        :cards="consolidatedCards"
        v-model="searchQuery"
        placeholder="搜索团队、负责人..."
      >
        <template #title-badge>
          <div class="flex flex-wrap items-center gap-1.5">
            <Badge variant="info">团队数: {{ compactNumber(summary.totalTeams) }}</Badge>
            <Badge variant="info">成员数: {{ compactNumber(summary.totalMembers) }}</Badge>
            <Badge variant="info">待处理: {{ compactNumber(totalPending) }}</Badge>
          </div>
        </template>

        <UiButton
          variant="secondary"
          size="sm"
          :icon="RefreshCw"
          :loading="isLoading"
          @click="refreshAll"
          class="!h-7.5 !text-xs !px-2.5"
        >
          刷新
        </UiButton>
        <UiButton
          variant="secondary"
          size="sm"
          :icon="Download"
          @click="exportCsv"
          class="!h-7.5 !text-xs !px-2.5"
        >
          导出
        </UiButton>
        <UiButton
          variant="primary"
          size="sm"
          :icon="Plus"
          @click="openCreateModal"
          class="!h-7.5 !text-xs !px-2.5"
        >
          新建团队
        </UiButton>
      </AdminHeader>

      <AdminTeamsFilters
        :visibility-filter="visibilityFilter"
        :risk-filter="riskFilter"
        :category-filter="categoryFilter"
        :sort-by="sortBy"
        :categories="categories"
        @update:visibility-filter="visibilityFilter = $event"
        @update:risk-filter="riskFilter = $event"
        @update:category-filter="categoryFilter = $event"
        @update:sort-by="sortBy = $event"
      />

      <AdminTeamsBatchBar
        v-if="selectedIds.length"
        :selected-count="selectedIds.length"
        @set-public="handleBatchVisibility('PUBLIC')"
        @set-private="handleBatchVisibility('PRIVATE')"
        @set-category="handleBatchCategory"
        @delete="handleBatchDelete"
      />

      <AdminTeamsTable
        :teams="teams"
        :is-loading="isLoading"
        :selected-ids="selectedIds"
        :pagination="pagination"
        :all-page-selected="allPageSelected"
        @row-click="openDetail"
        @toggle-select="toggleSelect"
        @toggle-select-all="toggleSelectAll"
        @page-change="fetchTeams"
        @size-change="fetchTeams(1)"
        @edit="openEditModal"
        @add-member="openAddMemberDialog"
        @delete="deleteTeam"
      />
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
      @submit="onFormSubmit"
    />

    <AdminTeamAddMemberModal
      :model-value="addMemberDialogVisible"
      :available-users="availableUsers"
      :selected-user-id="selectedUserId"
      :selected-member-role="selectedMemberRole"
      @update:model-value="addMemberDialogVisible = $event"
      @update:selected-user-id="selectedUserId = $event"
      @update:selected-member-role="selectedMemberRole = $event"
      @add="handleAddMember"
    />
  </div>
</template>

<style scoped>
.admin-teams-page {
  min-height: 0;
  background: transparent;
  color: #0f172a;
}
</style>
