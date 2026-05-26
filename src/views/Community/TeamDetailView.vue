<script setup lang="ts">
import { getApiErrorMessage, getApiErrorStatus } from '@/utils/error';
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Users,
  Settings,
  UserPlus,
  Mail,
  Shield,
  ShieldCheck,
  Trash2,
  LogOut,
  Camera,
  Search,
  Plus,
  X,
  Clock,
  ClipboardList,
  CheckCheck,
  XCircle,
  MessageSquare,
  Calendar,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import UserAvatar from '@/components/UserAvatar.vue';
import UserProfileDialog from '@/components/UserProfileDialog.vue';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';

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

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();
const teamId = computed(() => route.params.id as string);

const team = ref<DetailedTeam | null>(null);
const isLoading = ref(false);
const activeTab = ref('people'); // 'people', 'applications', 'settings'
const memberSearchQuery = ref('');

const isProfileDialogOpen = ref(false);
const selectedUserId = ref<string | null>(null);

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
    ElMessage.error('创建对话失败');
  }
};

const fetchTeamDetail = async () => {
  isLoading.value = true;
  try {
    const response = await api.get(`/api/teams/${teamId.value}`);
    team.value = response.data;
  } catch (error) {
    console.error('Fetch team detail error:', error);
    if (getApiErrorStatus(error) === 403) {
      ElMessage.error('你没有权限查看该团队');
    } else {
      ElMessage.error('获取团队详情失败');
    }
    router.push('/dashboard');
  } finally {
    isLoading.value = false;
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

// Unified Member & Invitation List
const filteredPeople = computed(() => {
  if (!team.value) return [];

  const members = team.value.members.map((m: DetailedMember) => ({
    id: m.id,
    userId: m.userId,
    role: m.role,
    isMember: true,
    displayName: m.user.name,
    displayEmail: m.user.email,
    displayAvatar: m.user.avatarUrl,
    joinedAt: m.joinedAt || team.value?.createdAt || '',
    user: m.user,
    createdAt: m.joinedAt || team.value?.createdAt || '',
  }));

  const invitations = (team.value.invitations || []).map((i: DetailedInvitation) => ({
    id: i.id,
    userId: '',
    role: 'PENDING',
    isMember: false,
    displayName: i.inviteeEmail,
    displayEmail: i.inviteeEmail,
    displayAvatar: null,
    joinedAt: i.createdAt,
    user: { id: '', name: i.inviteeEmail, email: i.inviteeEmail } as TeamUser,
    createdAt: i.createdAt,
  }));

  const all = [...members, ...invitations];

  if (!memberSearchQuery.value) return all;
  const query = memberSearchQuery.value.toLowerCase();
  return all.filter(
    (p) =>
      p.displayName?.toLowerCase().includes(query) || p.displayEmail?.toLowerCase().includes(query),
  );
});

const teamStats = computed(() => {
  if (!team.value) return { total: 0, admins: 0, pending: 0 };
  const total = team.value.members.length;
  const admins = team.value.members.filter((m: DetailedMember) => m.role === 'OWNER' || m.role === 'ADMIN').length;
  const pending = (team.value.invitations || []).length;
  return { total, admins, pending };
});

// Member Management
const handleRemoveMember = async (userId: string, name: string) => {
  try {
    await ElMessageBox.confirm(`确定要将 ${name} 移出团队吗？`, '移除成员', {
      confirmButtonText: '确定移除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    });

    await api.delete(`/api/teams/${teamId.value}/members/${userId}`);
    ElMessage.success('成员已移除');
    fetchTeamDetail();
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('操作失败');
  }
};

const handleUpdateRole = async (userId: string, newRole: string) => {
  try {
    await api.patch(`/api/teams/${teamId.value}/members/${userId}/role`, { role: newRole });
    ElMessage.success('角色权限已更新');
    fetchTeamDetail();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '更新失败'));
  }
};

const handleCancelInvitation = async (invitationId: string) => {
  try {
    await api.delete(`/api/teams/invitations/${invitationId}`);
    ElMessage.success('邀请已撤回');
    fetchTeamDetail();
  } catch {
    ElMessage.error('操作失败');
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
      approve ? `已批准 ${applicantName} 加入团队` : `已拒绝 ${applicantName} 的申请`,
    );
    fetchTeamDetail();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '操作失败'));
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
    ElMessage.success(`已向 ${user.name} 发送团队邀请`);
    isAddModalOpen.value = false;
    fetchTeamDetail();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '发送邀请失败'));
  }
};

const handleSendInvite = async () => {
  if (!inviteEmailInput.value) return;
  try {
    await api.post('/api/teams/invite', {
      teamId: teamId.value,
      inviteeEmail: inviteEmailInput.value,
    });
    ElMessage.success('邀请已发送');
    inviteEmailInput.value = '';
    isAddModalOpen.value = false;
    fetchTeamDetail();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '发送失败'));
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
    ElMessage.success('团队资料已更新');
    await workspaceStore.fetchWorkspaces();
    fetchTeamDetail();
  } catch {
    ElMessage.error('更新失败');
  } finally {
    isSaving.value = false;
  }
};

const handleLeaveTeam = async () => {
  try {
    await ElMessageBox.confirm('确定要退出该团队吗？退出后将无法访问团队数据。', '退出团队', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    });

    await api.delete(`/api/teams/${teamId.value}/members/${authStore.user?.id}`);
    ElMessage.success('您已退出该团队');
    await workspaceStore.fetchWorkspaces();
    router.push('/dashboard');
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('退出团队失败');
  }
};

const handleApplyFromDetail = async () => {
  try {
    await ElMessageBox.confirm(
      `你正在申请加入 "${team.value?.name}"，申请信息将发送给团队管理员。`,
      '申请加入团队',
      {
        confirmButtonText: '提交申请',
        cancelButtonText: '取消',
        type: 'info',
      },
    );
    await api.post('/api/teams/apply', { teamId: teamId.value });
    ElMessage.success('申请已提交！等待管理员审批');
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, '申请失败'));
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
    ElMessage.success('团队头像已更新');
    await workspaceStore.fetchWorkspaces();
  } catch {
    ElMessage.error('头像更新失败');
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
    ElMessage.success('团队封面已更新');
  } catch {
    ElMessage.error('封面更新失败');
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
    ElMessage.success('验证码已发送到您的邮箱');
    startDissolveCountdown();
  } catch {
    ElMessage.error('发送验证码失败');
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
    return ElMessage.warning('请输入验证码');
  }
  try {
    isDissolving.value = true;
    await api.delete(`/api/teams/${teamId.value}`, {
      data: { code: dissolveCode.value },
    });
    ElMessage.success('团队已解散');
    isDissolveModalOpen.value = false;
    await workspaceStore.fetchWorkspaces();
    router.push('/dashboard');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '解散团队失败'));
  } finally {
    isDissolving.value = false;
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
  }
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

    <div v-else-if="team" class="animate-in fade-in duration-500">
      <div class="relative">
        <!-- Cover Banner Area -->
        <div class="relative h-32 lg:h-40 w-full bg-slate-100 dark:bg-slate-950 overflow-hidden">
          <img v-if="team.coverUrl" :src="team.coverUrl" class="w-full h-full object-cover transition-all duration-700" alt="Team Cover" />
          <div
            v-else
            class="w-full h-full bg-gradient-to-r from-violet-600/20 via-indigo-600/15 to-rose-600/20 backdrop-blur-3xl relative"
          >
            <!-- Aesthetic abstract blobs for background visual premium look -->
            <div class="absolute top-4 left-1/4 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl animate-pulse"></div>
            <div class="absolute bottom-3 right-1/4 w-36 h-36 bg-blue-500/15 rounded-full blur-2xl animate-pulse" style="animation-duration: 4s"></div>
          </div>
          <!-- Cover Overlay Gradient -->
          <div class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
          
          <!-- Upload Cover Button -->
          <input
            ref="coverInput"
            type="file"
            class="hidden"
            accept="image/*"
            @change="handleCoverChange"
          />
          <button v-if="isOwnerOrAdmin" type="button" class="absolute top-3 right-3 flex items-center gap-1.5 px-3.5 py-2 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white rounded-lg text-xs font-bold transition-all shadow-md border border-white/10" @click="triggerCoverUpload">
            <Camera class="w-4 h-4" />
            <span>更换封面</span>
          </button>
        </div>
 
        <!-- Details Info Area -->
        <div class="max-w-none px-4 sm:px-6 pb-3 lg:pb-4 relative">
          <div class="flex flex-col lg:flex-row items-start lg:items-end gap-3 lg:gap-4 -mt-8 lg:-mt-12 relative z-20">
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
                class="w-20 h-20 lg:w-26 lg:h-26 rounded-xl lg:rounded-2xl overflow-hidden shadow-2xl border-4 border-white dark:border-slate-900 bg-white dark:bg-slate-800 transition-transform group-hover:scale-105 duration-500"
              >
                <img v-if="team.avatarUrl" alt="" :src="team.avatarUrl" class="w-full h-full object-cover" />
                <div
                  v-else
                  class="w-full h-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-white text-2xl lg:text-4xl font-black"
                >
                  {{ team.name.charAt(0).toUpperCase() }}
                </div>
              </div>
              <button v-if="isOwnerOrAdmin" type="button" class="absolute -bottom-1 -right-1 p-1.5 bg-accent text-white rounded-lg shadow-lg hover:scale-110 active:scale-95 transition-all border border-white/10" title="更换头像" @click="triggerAvatarUpload">
                <Camera class="w-4 h-4" />
              </button>
            </div>

            <!-- Team Text Info -->
            <div class="flex-1 text-left pt-1">
              <div class="flex flex-wrap items-center gap-2 mb-1">
                <h1 class="text-2xl lg:text-3xl font-black tracking-tight" style="color: var(--text-primary)">
                  {{ team.name }}
                </h1>
                <div
                  class="px-2.5 py-1 bg-accent/10 text-accent text-[10px] sm:text-xs font-black rounded-md uppercase tracking-wider border border-accent/20"
                >
                  协作空间
                </div>
              </div>
              <p class="text-slate-500 dark:text-slate-400 max-w-xl text-xs sm:text-sm leading-relaxed mb-2.5">
                {{ team.description || '这支团队还没有添加描述，协作从清晰的定义开始。' }}
              </p>

              <div class="flex flex-wrap items-center gap-3">
                <div class="flex items-center gap-1.5 bg-slate-100/80 dark:bg-white/5 px-2.5 py-1 rounded-md">
                  <Users class="w-3.5 h-3.5 text-slate-400" />
                  <span class="text-xs font-bold" style="color: var(--text-primary)"
                    >{{ team.members.length }} 成员</span
                  >
                </div>
                <div class="flex items-center gap-1.5 bg-slate-100/80 dark:bg-white/5 px-2.5 py-1 rounded-md">
                  <Clock class="w-3.5 h-3.5 text-slate-400" />
                  <span class="text-xs font-bold" style="color: var(--text-primary)"
                    >{{ team.invitations?.length || 0 }} 待处理</span
                  >
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto mt-2 lg:mt-0 shrink-0 lg:mb-1">
              <template v-if="canManageTeam">
                <button type="button" class="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2 bg-accent text-white rounded-xl font-bold text-xs shadow-md shadow-accent/20 hover:scale-105 active:scale-95 transition-all cursor-pointer" @click="isAddModalOpen = true">
                  <UserPlus class="w-4 h-4" />
                  管理成员
                </button>
                <button type="button" class="hidden sm:block p-2 border rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer" style="border-color: var(--border-base)" @click="activeTab = 'settings'">
                  <Settings class="w-4 h-4 text-slate-400" />
                </button>
              </template>
              <template v-else-if="isMember && isPersonalSpace">
                <button type="button" class="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2 border rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all font-bold text-xs cursor-pointer" style="border-color: var(--border-base); color: var(--text-primary)" @click="activeTab = 'settings'">
                  <Settings class="w-4 h-4 text-slate-400" />
                  空间设置
                </button>
              </template>
              <template v-if="!isMember && team?.visibility === 'PUBLIC'">
                <button type="button" class="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2 bg-accent text-white rounded-xl font-bold text-xs shadow-md shadow-accent/20 hover:scale-105 active:scale-95 transition-all cursor-pointer" @click="handleApplyFromDetail">
                  <UserPlus class="w-4 h-4" />
                  申请加入
                </button>
              </template>
              <button v-if="canLeaveTeam" type="button" class="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-50 dark:bg-rose-500/10 text-rose-600 rounded-xl font-bold text-xs hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all cursor-pointer" @click="handleLeaveTeam">
                <LogOut class="w-4 h-4" />
                退出团队
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content Container -->
      <div class="max-w-none px-4 sm:px-6 py-4 lg:py-6">
        <!-- Modern Tabs -->
        <div class="flex gap-4 lg:gap-6 mb-5 border-b overflow-x-auto scrollbar-hide" style="border-color: var(--border-base)">
          <button
v-for="t in [
              { id: 'people', label: '成员与协作', icon: Users },
              {
                id: 'applications',
                label: '入团申请',
                icon: ClipboardList,
                hidden: !isMember || !isOwnerOrAdmin,
                badge: pendingApplications.length,
              },
              {
                id: 'settings',
                label: '团队设置',
                icon: Settings,
                hidden: !isMember || !isOwnerOrAdmin,
              },
            ]" v-show="!t.hidden" :key="t.id" type="button" class="flex items-center gap-1.5 pb-2 text-xs font-bold transition-all relative whitespace-nowrap shrink-0 cursor-pointer" :class="activeTab === t.id ? 'text-accent' : 'text-slate-400 hover:text-slate-600'" @click="activeTab = t.id">
            <component :is="t.icon" class="w-3.5 h-3.5" />
            {{ t.label }}
            <span
              v-if="t.badge"
              class="ml-1 px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-black rounded-full"
              >{{ t.badge }}</span
            >
            <div
              v-if="activeTab === t.id"
              class="absolute bottom-0 left-0 right-0 h-1 bg-accent rounded-full translate-y-1/2"
            ></div>
          </button>
        </div>

        <!-- People & Collaboration View -->
        <div
          v-if="activeTab === 'people'"
          class="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <!-- Stats Dashboard Bar -->
          <div class="flex flex-wrap gap-3">
            <!-- Total Members Card -->
            <div class="flex items-center gap-3 backdrop-blur-md bg-white/40 dark:bg-slate-900/30 border border-white/15 dark:border-slate-800/50 rounded-xl py-1.5 px-3 shadow-sm transition-all duration-200">
              <div class="w-8 h-8 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <Users class="w-4 h-4" />
              </div>
              <div class="flex items-baseline gap-1">
                <span class="text-sm lg:text-base font-black tracking-tight" style="color: var(--text-primary)">{{ teamStats.total }}</span>
                <span class="text-[10px] sm:text-xs text-slate-400 font-bold">正式成员</span>
              </div>
            </div>

            <!-- Administrators Card -->
            <div class="flex items-center gap-3 backdrop-blur-md bg-white/40 dark:bg-slate-900/30 border border-white/15 dark:border-slate-800/50 rounded-xl py-1.5 px-3 shadow-sm transition-all duration-200">
              <div class="w-8 h-8 rounded-md bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <ShieldCheck class="w-4 h-4" />
              </div>
              <div class="flex items-baseline gap-1">
                <span class="text-sm lg:text-base font-black tracking-tight" style="color: var(--text-primary)">{{ teamStats.admins }}</span>
                <span class="text-[10px] sm:text-xs text-slate-400 font-bold">管理人员</span>
              </div>
            </div>

            <!-- Pending Invitations Card -->
            <div class="flex items-center gap-3 backdrop-blur-md bg-white/40 dark:bg-slate-900/30 border border-white/15 dark:border-slate-800/50 rounded-xl py-1.5 px-3 shadow-sm transition-all duration-200">
              <div class="w-8 h-8 rounded-md bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <Clock class="w-4 h-4" />
              </div>
              <div class="flex items-baseline gap-1">
                <span class="text-sm lg:text-base font-black tracking-tight" style="color: var(--text-primary)">{{ teamStats.pending }}</span>
                <span class="text-[10px] sm:text-xs text-slate-400 font-bold">待接受邀请</span>
              </div>
            </div>
          </div>

          <!-- Header & Actions -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3.5" style="borderColor: var(--border-base)">
            <div>
              <h2 class="text-base sm:text-lg font-black mb-0.5" style="color: var(--text-primary)">全员看板</h2>
              <p class="text-xs text-slate-400 font-medium">
                查看并管理团队内的所有成员及其访问权限
              </p>
            </div>
            <div class="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
              <div class="relative w-full sm:w-56 md:w-64">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  v-model="memberSearchQuery"
                  type="text"
                  placeholder="搜索成员姓名或邮箱..."
                  class="w-full pl-9 pr-4 py-2 bg-white/40 dark:bg-slate-900/20 border border-white/20 dark:border-slate-800/50 rounded-lg text-xs focus:ring-4 focus:ring-accent/10 outline-none transition-all placeholder-slate-400"
                  style="color: var(--text-primary)"
                />
              </div>
              <button v-if="canManageTeam" type="button" class="w-full sm:w-auto flex items-center justify-center gap-1 px-3.5 py-2 bg-accent text-white rounded-lg font-bold text-xs hover:scale-105 active:scale-95 hover:shadow-md hover:shadow-accent/20 transition-all cursor-pointer whitespace-nowrap" @click="isAddModalOpen = true">
                <Plus class="w-3.5 h-3.5" />
                邀请新成员
              </button>
            </div>
          </div>

          <!-- Members Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            <div
              v-for="person in filteredPeople"
              :key="person.id"
              class="group relative backdrop-blur-md bg-white/60 dark:bg-slate-900/40 border border-white/20 dark:border-slate-800/80 rounded-xl p-4 transition-all duration-300 hover:shadow-[0_8px_20px_rgba(0,0,0,0.04)] dark:hover:shadow-[0_8px_20px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 flex flex-col justify-between"
            >
              <!-- Pending Floating Badge -->
              <div
                v-if="!person.isMember"
                class="absolute -top-2 left-3 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] sm:text-[10px] font-black rounded uppercase tracking-wider shadow-sm z-10"
              >
                邀请中
              </div>

              <div>
                <!-- User Profile Header -->
                <div class="flex items-center gap-2.5">
                  <UserAvatar
                    :user="
                      person.isMember
                        ? person.user
                        : { name: person.displayName, email: person.displayEmail }
                    "
                    size="md"
                    class="cursor-pointer hover:ring-2 hover:ring-accent transition-all duration-300"
                    @click="person.isMember && openUserProfile(person.user.id)"
                  />
                  <div class="min-w-0 flex-1">
                    <h4
                      class="font-black text-sm tracking-tight truncate cursor-pointer hover:text-accent transition-colors duration-200"
                      style="color: var(--text-primary)"
                      @click="person.isMember && openUserProfile(person.user.id)"
                    >
                      {{ person.displayName }}
                    </h4>
                    <!-- Email with Mail Icon -->
                    <div class="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 mt-0.5">
                      <Mail class="w-3.5 h-3.5 shrink-0" />
                      <span class="text-xs truncate font-medium">{{ person.displayEmail }}</span>
                    </div>
                  </div>
                </div>

                <!-- Info (Joined/Invited Date) -->
                <div class="flex items-center gap-1.5 mt-2.5 text-xs text-slate-400 dark:text-slate-500 font-medium">
                  <Calendar class="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {{ person.isMember ? '加入于' : '邀请于' }}
                    {{ new Date(person.joinedAt || person.createdAt).toLocaleDateString('zh-CN', { year: '2-digit', month: '2-digit', day: '2-digit' }) }}
                  </span>
                </div>
              </div>

              <!-- Actions & Role Footer -->
              <div
                class="flex items-center justify-between pt-2.5 mt-3 border-t border-dashed"
                style="borderColor: var(--border-base)"
              >
                <!-- Role Badge -->
                <div>
                  <span
                    class="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border"
                    :class="{
                      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20': person.role === 'OWNER',
                      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20': person.role === 'ADMIN',
                      'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200/50 dark:border-white/10': person.role === 'MEMBER',
                      'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20': person.role === 'PENDING',
                    }"
                  >
                    {{
                      person.role === 'OWNER'
                        ? '创建者'
                        : person.role === 'ADMIN'
                          ? '管理员'
                          : person.role === 'PENDING'
                            ? '邀请中'
                            : '成员'
                    }}
                  </span>
                </div>

                <!-- Action Button Group -->
                <div class="flex items-center gap-1">
                  <!-- Private Message -->
                  <button v-if="person.isMember && person.user.id !== authStore.user?.id" type="button" class="p-1 hover:bg-accent/10 hover:text-accent rounded-md text-slate-400 dark:text-slate-500 transition-all duration-200 cursor-pointer" title="发送私信" @click="handleStartChat(person.user)">
                    <MessageSquare class="w-4 h-4" />
                  </button>

                  <!-- Manage Button / Dropdown -->
                  <template v-if="canManageTeam && person.userId !== authStore.user?.id">
                    <template v-if="person.isMember">
                      <el-dropdown trigger="click" placement="bottom-end">
                        <button type="button" class="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded-md text-slate-400 dark:text-slate-500 transition-all duration-200 cursor-pointer" title="管理角色">
                          <Shield class="w-4 h-4" />
                        </button>
                        <template #dropdown>
                          <el-dropdown-menu class="w-48 p-2 rounded-2xl shadow-2xl border-none">
                            <template v-if="isOwner">
                              <el-dropdown-item
                                v-if="person.role === 'MEMBER'"
                                class="rounded-xl my-0.5"
                                @click="handleUpdateRole(person.user.id, 'ADMIN')"
                              >
                                <div class="flex items-center gap-3 py-1 text-emerald-600 font-bold text-xs">
                                  <ShieldCheck class="w-4 h-4" /> 晋升为管理员
                                </div>
                              </el-dropdown-item>
                              <el-dropdown-item
                                v-if="person.role === 'ADMIN'"
                                class="rounded-xl my-0.5"
                                @click="handleUpdateRole(person.user.id, 'MEMBER')"
                              >
                                <div class="flex items-center gap-3 py-1 text-slate-600 font-bold text-xs">
                                  <Users class="w-4 h-4" /> 降为普通成员
                                </div>
                              </el-dropdown-item>
                            </template>
                            <el-dropdown-item
                              class="rounded-xl my-0.5"
                              @click="handleRemoveMember(person.user.id, person.user.name)"
                            >
                              <div class="flex items-center gap-3 py-1 text-rose-500 font-bold text-xs">
                                <Trash2 class="w-4 h-4" /> 移出团队
                              </div>
                            </el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                    </template>
                    <button v-else type="button" class="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 rounded-md transition-all duration-200 cursor-pointer" title="撤回邀请" @click="handleCancelInvitation(person.id)">
                      <X class="w-4 h-4" />
                    </button>
                  </template>
                </div>
              </div>
            </div>

            <!-- Add Person CTA Card -->
            <button v-if="canManageTeam" type="button" class="backdrop-blur-md bg-white/30 dark:bg-slate-900/20 border border-dashed border-accent/30 dark:border-accent/20 hover:border-accent hover:bg-accent/5 rounded-xl p-4 min-h-[120px] flex flex-col items-center justify-center gap-2 transition-all duration-300 group cursor-pointer" @click="isAddModalOpen = true">
              <div class="w-10 h-10 bg-accent/10 text-accent rounded-lg flex items-center justify-center group-hover:scale-110 group-hover:bg-accent group-hover:text-white transition-all duration-300 shadow-md shadow-accent/5">
                <Plus class="w-5 h-5" />
              </div>
              <span class="text-[10px] sm:text-xs font-black uppercase tracking-widest text-accent">邀请新成员</span>
            </button>
          </div>
        </div>

        <!-- Applications Tab -->
        <div
          v-if="activeTab === 'applications' && isOwnerOrAdmin"
          class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <div>
            <h2 class="text-2xl font-black mb-1" style="color: var(--text-primary)">
              入团申请审核
            </h2>
            <p class="text-xs text-slate-400 font-medium">
              审核用户的加入申请，批准后对方将立即成为团队成员
            </p>
          </div>

          <div
            v-if="pendingApplications.length === 0"
            class="flex flex-col items-center justify-center py-20 rounded-[2rem] border-2 border-dashed"
            style="border-color: var(--border-base)"
          >
            <ClipboardList class="w-12 h-12 mb-4 opacity-10" style="color: var(--text-muted)" />
            <p class="text-slate-400 font-bold">暂无待审核的入团申请</p>
          </div>

          <div v-else class="space-y-4">
            <div
              v-for="app in pendingApplications"
              :key="app.id"
              class="flex items-center gap-6 p-6 bg-white dark:bg-slate-900 rounded-2xl border transition-all hover:shadow-lg"
              style="border-color: var(--border-base)"
            >
              <UserAvatar :user="app.user" size="lg" />
              <div class="flex-1 min-w-0">
                <h4 class="font-bold text-base" style="color: var(--text-primary)">
                  {{ app.user.name || app.user.email }}
                </h4>
                <p class="text-xs text-slate-400">{{ app.user.email }}</p>
                <p v-if="app.message" class="text-xs text-slate-500 mt-2 italic">
                  "{{ app.message }}"
                </p>
                <p class="text-[10px] text-slate-300 mt-1">
                  申请于 {{ new Date(app.createdAt).toLocaleString() }}
                </p>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <button type="button" class="flex items-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-white/5 text-slate-500 rounded-xl font-bold text-sm hover:bg-rose-50 hover:text-rose-600 transition-all" @click="handleRespondApplication(app.id, false, app.user.name)">
                  <XCircle class="w-4 h-4" /> 拒绝
                </button>
                <button type="button" class="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20" @click="handleRespondApplication(app.id, true, app.user.name)">
                  <CheckCheck class="w-4 h-4" /> 批准
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Settings Tab -->
        <div
          v-if="activeTab === 'settings' && isOwnerOrAdmin"
          class="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div class="lg:col-span-1">
              <h3 class="text-xl font-black mb-3" style="color: var(--text-primary)">
                基本资料管理
              </h3>
              <p class="text-sm text-slate-500 leading-relaxed">
                公开的团队名称与描述，帮助成员更好地理解团队目标。
              </p>
            </div>
            <div
              class="lg:col-span-2 space-y-8 bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] border shadow-sm"
              style="border-color: var(--border-base)"
            >
              <div class="space-y-3">
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1"
                  >团队官方名称</label
                >
                <input
                  v-model="editForm.name"
                  type="text"
                  class="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border rounded-2xl focus:ring-4 focus:ring-accent/10 outline-none transition-all"
                  style="border-color: var(--border-base); color: var(--text-primary)"
                />
              </div>
              <div class="space-y-3">
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1"
                  >团队使命与描述</label
                >
                <textarea
                  v-model="editForm.description"
                  rows="4"
                  class="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border rounded-2xl focus:ring-4 focus:ring-accent/10 outline-none transition-all resize-none"
                  style="border-color: var(--border-base); color: var(--text-primary)"
                ></textarea>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-3">
                  <label
                    class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1"
                    >团队分类</label
                  >
                  <el-select
                    v-model="editForm.category"
                    class="w-full custom-select"
                    placeholder="选择团队分类"
                  >
                    <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
                  </el-select>
                </div>
                <div v-if="!isPersonalSpace" class="space-y-3">
                  <label
                    class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1"
                    >隐私与可见性</label
                  >
                  <el-select
                    v-model="editForm.visibility"
                    class="w-full custom-select"
                    placeholder="选择可见性"
                  >
                    <el-option label="公开 (所有人可搜寻)" value="PUBLIC" />
                    <el-option label="私密 (仅限受邀成员)" value="PRIVATE" />
                  </el-select>
                </div>
              </div>
              <div class="flex justify-end pt-4">
                <button type="button" :disabled="isSaving" class="px-10 py-4 bg-accent text-white rounded-2xl font-bold shadow-xl shadow-accent/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50" @click="handleUpdateTeam">
                  {{ isSaving ? '同步中...' : '保存所有更改' }}
                </button>
              </div>
            </div>
          </div>

          <div
            v-if="!isPersonalSpace"
            class="pt-12 border-t"
            style="border-color: var(--border-base)"
          >
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div class="lg:col-span-1">
                <h3 class="text-xl font-black mb-3 text-rose-500">归档与危险操作</h3>
                <p class="text-sm text-slate-500 leading-relaxed">
                  解散团队是一项不可逆的操作，所有协作记录都将被永久擦除。
                </p>
              </div>
              <div
                class="lg:col-span-2 bg-rose-50/50 dark:bg-rose-500/5 p-10 rounded-[2.5rem] border border-rose-100 dark:border-rose-500/20 flex flex-col md:flex-row items-center justify-between gap-6"
              >
                <div>
                  <h4 class="text-lg font-black text-rose-600 mb-1">永久解散此团队</h4>
                  <p class="text-sm text-rose-500 opacity-80">
                    此操作将移除所有成员并删除所有关联的 3D 资产、任务与项目。
                  </p>
                </div>
                <button v-if="isOwner" type="button" class="px-10 py-4 bg-rose-600 text-white rounded-2xl font-bold shadow-xl shadow-rose-600/20 hover:bg-rose-700 active:scale-95 transition-all whitespace-nowrap" @click="handleDeleteTeam">
                  解散团队
                </button>
                <div v-else class="flex items-center gap-2 text-rose-400 font-bold text-sm italic">
                  <Shield class="w-4 h-4" /> 只有所有者拥有解散权
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Unified Add Member Modal -->
    <div
      v-if="isAddModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
    >
      <div
        class="glass-dialog w-full max-w-xl rounded-[2.5rem] p-10 shadow-2xl transition-colors duration-300"
      >
        <div class="flex items-center justify-between mb-8">
          <div>
            <h3 class="text-2xl font-black" style="color: var(--text-primary)">添加新伙伴</h3>
            <p class="text-xs text-slate-400 font-medium mt-1">
              搜索站内用户或通过邮箱邀请外部成员
            </p>
          </div>
          <button type="button" class="p-3 hover:bg-slate-100 dark:hover:bg-white/5 rounded-2xl transition-all" @click="isAddModalOpen = false">
            <X class="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div class="space-y-8">
          <!-- Search Users -->
          <div class="space-y-4">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1"
              >站内快速添加</label
            >
            <div class="relative">
              <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                v-model="userSearchQuery"
                type="text"
                placeholder="输入用户名或邮箱搜索..."
                class="w-full pl-11 pr-4 py-4 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl text-sm focus:ring-4 focus:ring-accent/10 outline-none transition-all"
                style="color: var(--text-primary)"
              />
            </div>

            <!-- Search Results -->
            <div
              v-if="searchResults.length > 0"
              class="max-h-60 overflow-y-auto space-y-2 p-2 bg-black/5 dark:bg-white/5 rounded-2xl scrollbar-hide border border-black/5 dark:border-white/5"
            >
              <div
                v-for="user in searchResults"
                :key="user.id"
                class="flex items-center justify-between p-3 bg-white/20 dark:bg-slate-900/20 rounded-xl border border-black/10 dark:border-white/10 hover:border-accent transition-all group"
              >
                <div class="flex items-center gap-3">
                  <UserAvatar :user="user" size="md" />
                  <div>
                    <p class="text-sm font-bold" style="color: var(--text-primary)">
                      {{ user.name }}
                    </p>
                    <p class="text-[10px] text-slate-400">{{ user.email }}</p>
                  </div>
                </div>
                <button type="button" class="p-2 bg-accent/10 text-accent rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-accent hover:text-white" @click="handleAddUser(user)">
                  <Plus class="w-4 h-4" />
                </button>
              </div>
            </div>
            <div
              v-else-if="userSearchQuery && !isSearchingUsers"
              class="text-center py-4 text-slate-400 text-xs italic"
            >
              未找到匹配的站内用户
            </div>
          </div>

          <div class="relative flex items-center justify-center">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-black/10 dark:border-white/10"></div>
            </div>
            <span
              class="relative px-4 bg-[var(--bg-card)] dark:bg-slate-800/80 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]"
              >或者</span
            >
          </div>

          <!-- Email Invite -->
          <div class="space-y-4">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1"
              >外部邮件邀请</label
            >
            <div class="flex gap-3">
              <div class="relative flex-1">
                <Mail class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  v-model="inviteEmailInput"
                  type="email"
                  placeholder="example@email.com"
                  class="w-full pl-11 pr-4 py-4 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl text-sm focus:ring-4 focus:ring-accent/10 outline-none transition-all"
                  style="color: var(--text-primary)"
                />
              </div>
              <button type="button" :disabled="!inviteEmailInput" class="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-sm hover:scale-105 active:scale-95 transition-all disabled:opacity-50" @click="handleSendInvite">
                发送
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
          <button type="button" class="p-3 hover:bg-slate-100 dark:hover:bg-white/5 rounded-2xl transition-all" @click="isDissolveModalOpen = false">
            <X class="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div class="space-y-6">
          <div>
            <h3 class="text-2xl font-black text-rose-600">确认解散团队？</h3>
            <p class="text-xs text-slate-400 font-medium mt-1 leading-relaxed">
              这是一项高危操作。如果您确定要解散 <strong>{{ team?.name }}</strong
              >，请完成安全验证。
            </p>
          </div>

          <div class="space-y-4">
            <div v-if="authStore.user?.twoFactorEnabled" class="space-y-2">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1"
                >两步验证码</label
              >
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
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1"
                >邮箱验证码</label
              >
              <div class="flex gap-3">
                <input
                  v-model="dissolveCode"
                  type="text"
                  maxlength="6"
                  placeholder="000000"
                  class="flex-1 px-6 py-4 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl text-center text-xl font-black tracking-[0.2em] focus:ring-4 focus:ring-rose-500/10 outline-none transition-all"
                  style="color: var(--text-primary)"
                />
                <button type="button" :disabled="dissolveCountdown > 0" class="px-4 py-4 bg-accent/10 text-accent rounded-2xl font-bold text-xs hover:bg-accent/20 transition-all whitespace-nowrap disabled:opacity-50" @click="sendDissolveCode">
                  {{ dissolveCountdown > 0 ? `${dissolveCountdown}s` : '获取' }}
                </button>
              </div>
            </div>
          </div>

          <button type="button" :disabled="isDissolving || dissolveCode.length !== 6" class="w-full py-4 bg-rose-600 text-white rounded-2xl font-bold shadow-xl shadow-rose-600/20 hover:bg-rose-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2" @click="confirmDeleteTeam">
            <Trash2 class="w-4 h-4" />
            {{ isDissolving ? '正在解散...' : '确认并解散团队' }}
          </button>
        </div>
      </div>
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
</style>
