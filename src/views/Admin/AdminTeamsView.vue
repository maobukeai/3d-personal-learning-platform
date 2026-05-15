<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import {
  Users,
  Search,
  Shield,
  Trash2,
  Edit3,
  Plus,

  Settings,
  X,
  UserPlus,
  UserMinus,
  ChevronRight,
  RefreshCw,

  UserCheck,
} from 'lucide-vue-next';
import api from '@/utils/api';
import { ElMessage, ElMessageBox } from 'element-plus';
import UserAvatar from '@/components/UserAvatar.vue';

const teams = ref<any[]>([]);
const users = ref<any[]>([]);
const isLoading = ref(true);
const searchQuery = ref('');
const isModalOpen = ref(false);
const isSubmitting = ref(false);
const modalMode = ref<'create' | 'edit'>('create');

const isMemberDrawerOpen = ref(false);
const selectedTeam = ref<any>(null);

const openMemberDrawer = (team: any) => {
  selectedTeam.value = team;
  isMemberDrawerOpen.value = true;
};

const initialForm = {
  id: '',
  name: '',
  description: '',
  avatarUrl: '',
  ownerId: '',
};
const form = ref({ ...initialForm });

const fetchTeams = async () => {
  try {
    isLoading.value = true;
    const { data } = await api.get('/api/admin/teams');
    teams.value = data;
    // Update selectedTeam if drawer is open
    if (isMemberDrawerOpen.value && selectedTeam.value) {
      const updated = data.find((t: any) => t.id === selectedTeam.value.id);
      if (updated) selectedTeam.value = updated;
    }
  } catch (error) {
    console.error('Fetch teams error:', error);
  } finally {
    isLoading.value = false;
  }
};

const fetchUsers = async () => {
  try {
    const { data } = await api.get('/api/admin/users');
    users.value = data;
  } catch (error) {
    console.error('Fetch users error:', error);
  }
};

const openCreateModal = () => {
  modalMode.value = 'create';
  form.value = { ...initialForm };
  isModalOpen.value = true;
};

const openEditModal = (team: any) => {
  modalMode.value = 'edit';
  form.value = {
    id: team.id,
    name: team.name,
    description: team.description || '',
    avatarUrl: team.avatarUrl || '',
    ownerId: team.ownerId,
  };
  isModalOpen.value = true;
};

const handleSubmit = async () => {
  if (!form.value.name || !form.value.ownerId) {
    ElMessage.warning('请填写团队名称并选择负责人');
    return;
  }

  try {
    isSubmitting.value = true;
    if (modalMode.value === 'create') {
      await api.post('/api/admin/teams', form.value);
      ElMessage.success('团队创建成功');
    } else {
      await api.put(`/api/admin/teams/${form.value.id}`, form.value);
      ElMessage.success('团队信息已更新');
    }
    isModalOpen.value = false;
    fetchTeams();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '操作失败');
  } finally {
    isSubmitting.value = false;
  }
};

const deleteTeam = async (id: string) => {
  try {
    await ElMessageBox.confirm(
      '确定要解散该团队吗？此操作不可逆，将删除所有相关协作数据。',
      '确认解散团队',
      {
        confirmButtonText: '确定解散',
        cancelButtonText: '取消',
        type: 'error',
        confirmButtonClass: 'el-button--danger',
      },
    );
    await api.delete(`/api/admin/teams/${id}`);
    ElMessage.success('团队已解散');
    if (selectedTeam.value?.id === id) isMemberDrawerOpen.value = false;
    fetchTeams();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '删除失败');
    }
  }
};

const updateMemberRole = async (teamId: string, userId: string, role: string) => {
  try {
    await api.put(`/api/admin/teams/${teamId}/members/${userId}/role`, { role });
    ElMessage.success('成员角色已更新');
    fetchTeams();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '更新角色失败');
  }
};

const removeMember = async (teamId: string, userId: string, userName: string) => {
  try {
    await ElMessageBox.confirm(`确定要将成员 "${userName}" 移出团队吗？`, '移除成员', {
      confirmButtonText: '确定移除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await api.delete(`/api/admin/teams/${teamId}/members/${userId}`);
    ElMessage.success('成员已移除');
    fetchTeams();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '移除失败');
    }
  }
};

const addMemberDialogVisible = ref(false);
const currentTeamForAddMember = ref<any>(null);
const selectedUserId = ref('');

const openAddMemberDialog = (team: any) => {
  currentTeamForAddMember.value = team;
  selectedUserId.value = '';
  addMemberDialogVisible.value = true;
};

const handleAddMember = async () => {
  if (!selectedUserId.value || !currentTeamForAddMember.value) return;
  try {
    await api.post('/api/teams/members', {
      teamId: currentTeamForAddMember.value.id,
      userId: selectedUserId.value,
      role: 'MEMBER',
    });
    ElMessage.success('成员已添加');
    addMemberDialogVisible.value = false;
    fetchTeams();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '添加成员失败');
  }
};

const getAvailableUsersForAdd = computed(() => {
  if (!currentTeamForAddMember.value) return [];
  const existingMemberIds = currentTeamForAddMember.value.members?.map((m: any) => m.userId) || [];
  return users.value.filter((u) => !existingMemberIds.includes(u.id));
});

const filteredTeams = computed(() => {
  if (!searchQuery.value) return teams.value;
  const query = searchQuery.value.toLowerCase();
  return teams.value.filter(
    (t) => t.name.toLowerCase().includes(query) || t.owner.name?.toLowerCase().includes(query),
  );
});

const getRoleLabel = (role: string) => {
  switch (role) {
    case 'OWNER':
      return '负责人';
    case 'ADMIN':
      return '管理员';
    case 'MEMBER':
      return '成员';
    default:
      return role;
  }
};

const getRoleColor = (role: string) => {
  switch (role) {
    case 'OWNER':
      return 'text-amber-600 bg-amber-50';
    case 'ADMIN':
      return 'text-blue-600 bg-blue-50';
    case 'MEMBER':
      return 'text-slate-600 bg-slate-50';
    default:
      return 'text-slate-600 bg-slate-50';
  }
};

onMounted(() => {
  fetchTeams();
  fetchUsers();
});
</script>

<template>
  <div
    class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <!-- Header -->
    <div
      class="h-20 border-b px-8 flex items-center justify-between shrink-0 transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-8">
        <div>
          <h1 class="text-xl font-black tracking-tight" style="color: var(--text-primary)">
            团队架构管理
          </h1>
          <p
            class="text-[10px] font-bold mt-0.5 opacity-50 uppercase tracking-wider"
            style="color: var(--text-primary)"
          >
            Manage Collaborative Teams
          </p>
        </div>

        <!-- Integrated Search -->
        <div class="relative hidden md:block w-72">
          <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索团队名称或负责人..."
            class="w-full pl-11 pr-4 py-2.5 rounded-2xl border text-sm transition-all focus:ring-2 focus:ring-accent/20 outline-none"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          />
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button
          class="p-2.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors text-slate-500"
          @click="
            fetchTeams();
            fetchUsers();
          "
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
        </button>
        <button
          class="flex items-center gap-2 px-6 py-2.5 bg-accent text-white rounded-xl font-bold text-xs shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 transition-all"
          @click="openCreateModal"
        >
          <Plus class="w-4 h-4" />
          创建团队
        </button>
      </div>
    </div>

    <!-- Mobile Search -->
    <div
      class="md:hidden p-4 border-b transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="relative w-full">
        <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索团队..."
          class="w-full pl-11 pr-4 py-3 rounded-2xl border transition-all focus:ring-2 focus:ring-accent/20 outline-none"
          style="
            background-color: var(--bg-app);
            border-color: var(--border-base);
            color: var(--text-primary);
          "
        />
      </div>
    </div>

    <!-- Content: Grid Layout -->
    <div class="flex-1 overflow-y-auto p-6 scrollbar-hide">
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-24 text-slate-400">
        <div
          class="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"
        ></div>
        <p class="text-sm font-bold tracking-widest uppercase">Loading Teams...</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        <div
          v-for="team in filteredTeams"
          :key="team.id"
          class="group rounded-2xl border transition-all hover:shadow-xl hover:-translate-y-1 flex flex-col"
          style="background-color: var(--bg-card); border-color: var(--border-base)"
        >
          <div class="p-5 flex-1 cursor-pointer" @click="openMemberDrawer(team)">
            <div class="flex items-start gap-4 mb-4">
              <div
                class="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/5 overflow-hidden flex-shrink-0 shadow-inner"
              >
                <img
                  v-if="team.avatarUrl"
                  :src="team.avatarUrl"
                  class="w-full h-full object-cover"
                />
                <Users v-else class="w-full h-full p-3.5 text-slate-400" />
              </div>
              <div class="min-w-0 flex-1">
                <h3
                  class="font-black text-base truncate group-hover:text-accent transition-colors"
                  style="color: var(--text-primary)"
                >
                  {{ team.name }}
                </h3>
                <div class="flex items-center gap-2 mt-1">
                  <div
                    class="px-2 py-0.5 rounded-lg bg-accent/5 text-accent text-[10px] font-black uppercase tracking-widest"
                  >
                    {{ team._count.members }} 成员
                  </div>
                </div>
              </div>

              <div class="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  class="p-2 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/5 transition-all"
                  @click.stop="openEditModal(team)"
                >
                  <Edit3 class="w-4 h-4" />
                </button>
                <button
                  class="p-2 rounded-lg text-slate-400 hover:text-rose-50 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
                  @click.stop="deleteTeam(team.id)"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>

            <p class="text-xs text-slate-400 line-clamp-2 leading-relaxed h-8">
              {{ team.description || '暂无团队描述' }}
            </p>
          </div>

          <div
            class="px-5 py-4 border-t flex items-center justify-between"
            style="
              border-color: var(--border-base);
              background-color: var(--bg-app);
              border-bottom-left-radius: 1rem;
              border-bottom-right-radius: 1rem;
            "
          >
            <div class="flex items-center gap-2">
              <UserAvatar :user="team.owner" size="xs" />
              <div class="min-w-0">
                <p
                  class="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5"
                >
                  负责人
                </p>
                <p
                  class="text-xs font-bold truncate max-w-[120px]"
                  style="color: var(--text-primary)"
                >
                  {{ team.owner.name }}
                </p>
              </div>
            </div>

            <button
              class="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-accent hover:bg-accent/10 transition-all active:scale-90"
              @click="openMemberDrawer(team)"
            >
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Add Team Placeholder -->
        <button
          class="rounded-2xl border border-dashed flex flex-col items-center justify-center p-8 text-slate-400 hover:text-accent hover:border-accent hover:bg-accent/5 transition-all min-h-[180px]"
          style="border-color: var(--border-base)"
          @click="openCreateModal"
        >
          <div
            class="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"
          >
            <Plus class="w-6 h-6" />
          </div>
          <span class="text-xs font-bold uppercase tracking-widest">创建新团队</span>
        </button>
      </div>

      <div v-if="filteredTeams.length === 0 && !isLoading" class="py-24 text-center text-slate-400">
        <Users class="w-16 h-16 mx-auto mb-4 opacity-20" />
        <p class="text-sm font-bold uppercase tracking-widest">No Teams Found</p>
      </div>
    </div>

    <!-- Member Drawer -->
    <el-drawer v-model="isMemberDrawerOpen" direction="rtl" size="450px" :with-header="false">
      <div
        v-if="selectedTeam"
        class="h-full flex flex-col"
        style="background-color: var(--bg-card)"
      >
        <div class="p-8 border-b shrink-0" style="border-color: var(--border-base)">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-4">
              <div
                class="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/5 overflow-hidden flex-shrink-0"
              >
                <img
                  v-if="selectedTeam.avatarUrl"
                  :src="selectedTeam.avatarUrl"
                  class="w-full h-full object-cover"
                />
                <Users v-else class="w-full h-full p-3.5 text-slate-400" />
              </div>
              <div>
                <h3 class="text-xl font-black tracking-tight" style="color: var(--text-primary)">
                  {{ selectedTeam.name }}
                </h3>
                <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                  成员管理 ({{ selectedTeam._count.members }})
                </p>
              </div>
            </div>
            <button
              class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
              @click="isMemberDrawerOpen = false"
            >
              <X class="w-6 h-6 text-slate-400" />
            </button>
          </div>

          <button
            class="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-accent text-white text-xs font-bold shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-95 transition-all"
            @click="openAddMemberDialog(selectedTeam)"
          >
            <UserPlus class="w-4 h-4" />
            添加成员
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-8 space-y-3 scrollbar-hide">
          <div
            v-for="member in selectedTeam.members"
            :key="member.id"
            class="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800/50 border border-transparent hover:border-accent/20 transition-all group/member shadow-sm"
          >
            <div class="flex items-center gap-4">
              <UserAvatar :user="member.user" size="md" />
              <div class="min-w-0">
                <p class="text-sm font-black truncate" style="color: var(--text-primary)">
                  {{ member.user?.name || member.user?.email }}
                </p>
                <p class="text-[10px] text-slate-400 font-bold truncate tracking-tight">
                  {{ member.user?.email }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span
                class="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider"
                :class="getRoleColor(member.role)"
              >
                {{ getRoleLabel(member.role) }}
              </span>

              <template v-if="member.role !== 'OWNER'">
                <el-dropdown trigger="click">
                  <button
                    class="p-1.5 rounded-lg text-slate-300 hover:text-accent hover:bg-accent/5 transition-all"
                  >
                    <Settings class="w-4 h-4" />
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item
                        v-if="member.role !== 'ADMIN'"
                        @click="updateMemberRole(selectedTeam.id, member.userId, 'ADMIN')"
                      >
                        <div
                          class="flex items-center gap-2 font-black text-[10px] uppercase text-blue-600 tracking-widest"
                        >
                          <Shield class="w-4 h-4" /> 设为管理员
                        </div>
                      </el-dropdown-item>
                      <el-dropdown-item
                        v-if="member.role !== 'MEMBER'"
                        @click="updateMemberRole(selectedTeam.id, member.userId, 'MEMBER')"
                      >
                        <div
                          class="flex items-center gap-2 font-black text-[10px] uppercase text-slate-600 tracking-widest"
                        >
                          <UserCheck class="w-4 h-4" /> 设为普通成员
                        </div>
                      </el-dropdown-item>
                      <el-dropdown-item
                        divided
                        @click="
                          removeMember(
                            selectedTeam.id,
                            member.userId,
                            member.user?.name || member.user?.email,
                          )
                        "
                      >
                        <div
                          class="flex items-center gap-2 font-black text-[10px] uppercase text-rose-600 tracking-widest"
                        >
                          <UserMinus class="w-4 h-4" /> 移除成员
                        </div>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </template>
            </div>
          </div>
        </div>
      </div>
    </el-drawer>

    <!-- Create/Edit Modal -->
    <div
      v-if="isModalOpen"
      class="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
    >
      <div
        class="w-full max-w-lg rounded-3xl p-8 shadow-2xl transition-colors duration-300"
        style="background-color: var(--bg-card)"
      >
        <div class="flex items-center justify-between mb-8">
          <h3 class="text-xl font-black tracking-tight" style="color: var(--text-primary)">
            {{ modalMode === 'create' ? '创建协作团队' : '编辑团队信息' }}
          </h3>
          <button
            class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl"
            @click="isModalOpen = false"
          >
            <X class="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div class="space-y-6">
          <div>
            <label
              class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2"
              >团队名称</label
            >
            <input
              v-model="form.name"
              type="text"
              placeholder="输入团队名称..."
              class="w-full px-4 py-3 rounded-2xl border transition-all outline-none font-bold"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
          </div>

          <div>
            <label
              class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2"
              >团队负责人</label
            >
            <el-select
              v-model="form.ownerId"
              filterable
              placeholder="选择负责人..."
              class="w-full modern-select"
            >
              <el-option
                v-for="user in users"
                :key="user.id"
                :label="`${user.name} (${user.email})`"
                :value="user.id"
              />
            </el-select>
          </div>

          <div>
            <label
              class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2"
              >团队描述</label
            >
            <textarea
              v-model="form.description"
              rows="3"
              placeholder="描述该团队的协作职责..."
              class="w-full px-4 py-3 rounded-2xl border transition-all outline-none resize-none text-sm font-medium"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            ></textarea>
          </div>

          <div class="pt-4 flex gap-4">
            <button
              class="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
              style="border-color: var(--border-base); color: var(--text-secondary)"
              @click="isModalOpen = false"
            >
              取消
            </button>
            <button
              :disabled="isSubmitting"
              class="flex-1 py-4 rounded-2xl bg-accent text-white font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 disabled:opacity-50"
              @click="handleSubmit"
            >
              {{
                isSubmitting
                  ? 'Processing...'
                  : modalMode === 'create'
                    ? 'Confirm Create'
                    : 'Save Changes'
              }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Member Dialog -->
    <el-dialog
      v-model="addMemberDialogVisible"
      title="添加团队成员"
      width="400px"
      destroy-on-close
      align-center
    >
      <div class="space-y-4">
        <div>
          <label class="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest"
            >选择用户</label
          >
          <el-select
            v-model="selectedUserId"
            filterable
            placeholder="搜索并选择用户..."
            class="w-full modern-select"
          >
            <el-option
              v-for="user in getAvailableUsersForAdd"
              :key="user.id"
              :label="`${user.name} (${user.email})`"
              :value="user.id"
            />
          </el-select>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-3 mt-4">
          <button
            class="flex-1 py-3 rounded-2xl border border-slate-200 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all"
            @click="addMemberDialogVisible = false"
          >
            取消
          </button>
          <button
            :disabled="!selectedUserId"
            class="flex-1 py-3 rounded-2xl bg-accent text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-accent/20 disabled:opacity-50 transition-all active:scale-95"
            @click="handleAddMember"
          >
            确认添加
          </button>
        </div>
      </template>
    </el-dialog>
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
:deep(.el-drawer) {
  background: transparent;
  box-shadow: none;
}
:deep(.el-drawer__body) {
  padding: 0;
}
</style>
