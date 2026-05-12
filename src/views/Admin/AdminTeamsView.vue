<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { 
  Users, 
  Search, 
  Shield, 
  Trash2, 
  Edit3,
  Plus,
  Flag,
  Settings,
  X,
  UserPlus,
  UserMinus,
  ChevronRight,
  RefreshCw,
  Crown,
  UserCheck
} from 'lucide-vue-next'
import api from '@/utils/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const teams = ref<any[]>([])
const users = ref<any[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const isModalOpen = ref(false)
const isSubmitting = ref(false)
const modalMode = ref<'create' | 'edit'>('create')

const expandedTeamId = ref<string | null>(null)

const initialForm = {
  id: '',
  name: '',
  description: '',
  avatarUrl: '',
  ownerId: ''
}
const form = ref({ ...initialForm })

const fetchTeams = async () => {
  try {
    isLoading.value = true
    const { data } = await api.get('/api/admin/teams')
    teams.value = data
  } catch (error) {
    console.error('Fetch teams error:', error)
  } finally {
    isLoading.value = false
  }
}

const fetchUsers = async () => {
  try {
    const { data } = await api.get('/api/admin/users')
    users.value = data
  } catch (error) {
    console.error('Fetch users error:', error)
  }
}

const openCreateModal = () => {
  modalMode.value = 'create'
  form.value = { ...initialForm }
  isModalOpen.value = true
}

const openEditModal = (team: any) => {
  modalMode.value = 'edit'
  form.value = {
    id: team.id,
    name: team.name,
    description: team.description || '',
    avatarUrl: team.avatarUrl || '',
    ownerId: team.ownerId
  }
  isModalOpen.value = true
}

const handleSubmit = async () => {
  if (!form.value.name || !form.value.ownerId) {
    ElMessage.warning('请填写团队名称并选择负责人')
    return
  }

  try {
    isSubmitting.value = true
    if (modalMode.value === 'create') {
      await api.post('/api/admin/teams', form.value)
      ElMessage.success('团队创建成功')
    } else {
      await api.put(`/api/admin/teams/${form.value.id}`, form.value)
      ElMessage.success('团队信息已更新')
    }
    isModalOpen.value = false
    fetchTeams()
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '操作失败')
  } finally {
    isSubmitting.value = false
  }
}

const deleteTeam = async (id: string) => {
  try {
    await ElMessageBox.confirm('确定要解散该团队吗？此操作不可逆，将删除所有相关协作数据。', '确认解散团队', {
      confirmButtonText: '确定解散',
      cancelButtonText: '取消',
      type: 'error',
      confirmButtonClass: 'el-button--danger'
    })
    await api.delete(`/api/admin/teams/${id}`)
    ElMessage.success('团队已解散')
    if (expandedTeamId.value === id) expandedTeamId.value = null
    fetchTeams()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '删除失败')
    }
  }
}

const toggleTeamExpansion = (teamId: string) => {
  expandedTeamId.value = expandedTeamId.value === teamId ? null : teamId
}

const updateMemberRole = async (teamId: string, userId: string, role: string) => {
  try {
    await api.put(`/api/admin/teams/${teamId}/members/${userId}/role`, { role })
    ElMessage.success('成员角色已更新')
    fetchTeams()
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '更新角色失败')
  }
}

const removeMember = async (teamId: string, userId: string, userName: string) => {
  try {
    await ElMessageBox.confirm(`确定要将成员 "${userName}" 移出团队吗？`, '移除成员', {
      confirmButtonText: '确定移除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await api.delete(`/api/admin/teams/${teamId}/members/${userId}`)
    ElMessage.success('成员已移除')
    fetchTeams()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '移除失败')
    }
  }
}

const addMemberDialogVisible = ref(false)
const currentTeamForAddMember = ref<any>(null)
const selectedUserId = ref('')

const openAddMemberDialog = (team: any) => {
  currentTeamForAddMember.value = team
  selectedUserId.value = ''
  addMemberDialogVisible.value = true
}

const handleAddMember = async () => {
  if (!selectedUserId.value || !currentTeamForAddMember.value) return
  try {
    await api.post('/api/teams/members', {
      teamId: currentTeamForAddMember.value.id,
      userId: selectedUserId.value,
      role: 'MEMBER'
    })
    ElMessage.success('成员已添加')
    addMemberDialogVisible.value = false
    fetchTeams()
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '添加成员失败')
  }
}

const getAvailableUsersForAdd = computed(() => {
  if (!currentTeamForAddMember.value) return []
  const existingMemberIds = currentTeamForAddMember.value.members?.map((m: any) => m.userId) || []
  return users.value.filter(u => !existingMemberIds.includes(u.id))
})

const filteredTeams = computed(() => {
  if (!searchQuery.value) return teams.value
  const query = searchQuery.value.toLowerCase()
  return teams.value.filter(t => 
    t.name.toLowerCase().includes(query) || 
    t.owner.name?.toLowerCase().includes(query)
  )
})

const getRoleLabel = (role: string) => {
  switch (role) {
    case 'OWNER': return '负责人'
    case 'ADMIN': return '管理员'
    case 'MEMBER': return '成员'
    default: return role
  }
}

const getRoleColor = (role: string) => {
  switch (role) {
    case 'OWNER': return 'text-amber-600 bg-amber-50'
    case 'ADMIN': return 'text-blue-600 bg-blue-50'
    case 'MEMBER': return 'text-slate-600 bg-slate-50'
    default: return 'text-slate-600 bg-slate-50'
  }
}

onMounted(() => {
  fetchTeams()
  fetchUsers()
})
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="h-20 border-b px-8 flex items-center justify-between shrink-0 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div>
        <h1 class="text-2xl font-black tracking-tight" style="color: var(--text-primary)">团队架构管理</h1>
        <p class="text-xs font-medium mt-1" style="color: var(--text-muted)">定义和管理平台内的协作团队及其负责人</p>
      </div>
      <div class="flex items-center gap-3">
        <button @click="fetchTeams(); fetchUsers()" class="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
        </button>
        <button @click="openCreateModal" class="flex items-center gap-2 px-6 py-2.5 bg-accent text-white rounded-xl font-bold text-xs shadow-lg shadow-accent/20 hover:scale-105 transition-all">
          <Plus class="w-4 h-4" />
          创建新团队
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="p-8 border-b shrink-0 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="relative w-full md:w-96">
        <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input v-model="searchQuery" 
               type="text" 
               placeholder="搜索团队名称或负责人..." 
               class="w-full pl-11 pr-4 py-3 rounded-2xl border transition-all focus:ring-2 focus:ring-accent/20 outline-none"
               style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-24 text-slate-400">
        <div class="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="text-sm font-bold">加载团队数据...</p>
      </div>

      <div v-else class="max-w-6xl mx-auto space-y-6">
        <div v-for="team in filteredTeams" :key="team.id" 
             class="rounded-3xl border overflow-hidden transition-all hover:shadow-lg"
             style="background-color: var(--bg-card); border-color: var(--border-base)">
          <!-- Team Header -->
          <div class="p-6">
            <div class="flex items-start justify-between mb-4">
              <div class="flex items-center gap-4 cursor-pointer flex-1 min-w-0" @click="toggleTeamExpansion(team.id)">
                <div class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 overflow-hidden flex-shrink-0">
                  <img v-if="team.avatarUrl" :src="team.avatarUrl" class="w-full h-full object-cover" />
                  <Users v-else class="w-full h-full p-4 text-slate-400" />
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <h3 class="font-bold text-lg truncate" style="color: var(--text-primary)">{{ team.name }}</h3>
                    <ChevronRight class="w-4 h-4 text-slate-300 transition-transform duration-300 shrink-0" :class="{ 'rotate-90': expandedTeamId === team.id }" />
                  </div>
                  <div class="flex items-center gap-3 mt-1">
                    <div class="px-2 py-0.5 inline-block rounded-lg bg-slate-100 dark:bg-white/10 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {{ team._count.members }} 成员
                    </div>
                    <div class="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <Flag class="w-3 h-3" />
                      <span class="font-bold">{{ team.owner.name }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button @click="openEditModal(team)" class="p-2 rounded-xl text-slate-400 hover:text-accent hover:bg-accent/5 transition-all">
                  <Edit3 class="w-4 h-4" />
                </button>
                <button @click="deleteTeam(team.id)" class="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>

            <p class="text-xs text-slate-400 line-clamp-2 min-h-[1.25rem]">{{ team.description || '暂无团队描述' }}</p>
          </div>

          <!-- Members Panel (Expanded) -->
          <div v-if="expandedTeamId === team.id" class="border-t transition-all duration-300" style="border-color: var(--border-base); background-color: var(--bg-app)">
            <div class="p-6">
              <div class="flex items-center justify-between mb-4">
                <h4 class="text-sm font-bold" style="color: var(--text-primary)">团队成员</h4>
                <button @click="openAddMemberDialog(team)" 
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-bold hover:bg-accent/20 transition-all">
                  <UserPlus class="w-3.5 h-3.5" />
                  添加成员
                </button>
              </div>

              <div class="space-y-2">
                <div v-for="member in team.members" :key="member.id" 
                     class="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-800/50 border border-transparent hover:border-accent/20 transition-all group/member">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 overflow-hidden flex-shrink-0">
                      <img v-if="member.user?.avatarUrl" :src="member.user.avatarUrl" class="w-full h-full object-cover" />
                      <Users v-else class="w-full h-full p-1.5 text-slate-400" />
                    </div>
                    <div>
                      <span class="text-sm font-bold" style="color: var(--text-primary)">{{ member.user?.name || member.user?.email }}</span>
                      <span class="text-[10px] text-slate-400 ml-2">{{ member.user?.email }}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold" :class="getRoleColor(member.role)">
                      <Crown v-if="member.role === 'OWNER'" class="w-3 h-3 inline -mt-0.5" />
                      {{ getRoleLabel(member.role) }}
                    </span>
                    <template v-if="member.role !== 'OWNER'">
                      <el-dropdown trigger="click">
                        <button class="p-1 rounded-md text-slate-400 hover:text-accent opacity-0 group-hover/member:opacity-100 transition-all">
                          <Settings class="w-3.5 h-3.5" />
                        </button>
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item v-if="member.role !== 'ADMIN'" @click="updateMemberRole(team.id, member.userId, 'ADMIN')">
                              <div class="flex items-center gap-2 font-bold text-blue-600">
                                <Shield class="w-3.5 h-3.5" /> 设为管理员
                              </div>
                            </el-dropdown-item>
                            <el-dropdown-item v-if="member.role !== 'MEMBER'" @click="updateMemberRole(team.id, member.userId, 'MEMBER')">
                              <div class="flex items-center gap-2 font-bold text-slate-600">
                                <UserCheck class="w-3.5 h-3.5" /> 设为普通成员
                              </div>
                            </el-dropdown-item>
                            <el-dropdown-item @click="removeMember(team.id, member.userId, member.user?.name || member.user?.email)" divided>
                              <div class="flex items-center gap-2 font-bold text-rose-600">
                                <UserMinus class="w-3.5 h-3.5" /> 移除成员
                              </div>
                            </el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                    </template>
                  </div>
                </div>

                <div v-if="team.members.length === 0" class="py-8 text-center text-slate-400">
                  <Users class="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p class="text-xs font-bold">暂无成员</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="filteredTeams.length === 0" class="py-24 text-center text-slate-400">
          <Users class="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p class="text-sm font-bold">未找到符合条件的团队</p>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="isModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <div class="w-full max-w-lg rounded-3xl p-8 shadow-2xl transition-colors duration-300" style="background-color: var(--bg-card)">
        <div class="flex items-center justify-between mb-8">
          <h3 class="text-xl font-bold" style="color: var(--text-primary)">{{ modalMode === 'create' ? '创建协作团队' : '编辑团队信息' }}</h3>
          <button @click="isModalOpen = false" class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full">
            <X class="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div class="space-y-6">
          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">团队名称</label>
            <input v-model="form.name" type="text" placeholder="输入团队名称..." 
                   class="w-full px-4 py-3 rounded-2xl border transition-all outline-none"
                   style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
          </div>

          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">团队负责人</label>
            <select v-model="form.ownerId" 
                    class="w-full px-4 py-3 rounded-2xl border transition-all outline-none appearance-none"
                    style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)">
              <option value="">默认 (当前管理员)</option>
              <option v-for="user in users" :key="user.id" :value="user.id">
                {{ user.name }} ({{ user.email }})
              </option>
            </select>
          </div>

          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">团队描述</label>
            <textarea v-model="form.description" rows="3" placeholder="描述该团队的协作职责..." 
                      class="w-full px-4 py-3 rounded-2xl border transition-all outline-none resize-none"
                      style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)"></textarea>
          </div>

          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">团队头像 URL (可选)</label>
            <input v-model="form.avatarUrl" type="text" placeholder="https://..." 
                   class="w-full px-4 py-3 rounded-2xl border transition-all outline-none"
                   style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
          </div>

          <div class="pt-4 flex gap-4">
            <button @click="isModalOpen = false" class="flex-1 py-4 rounded-2xl font-bold text-xs border hover:bg-slate-50 dark:hover:bg-white/5 transition-all" style="border-color: var(--border-base); color: var(--text-secondary)">取消</button>
            <button @click="handleSubmit" :disabled="isSubmitting"
                    class="flex-1 py-4 rounded-2xl bg-accent text-white font-bold text-xs transition-all shadow-lg shadow-accent/20 hover:scale-105 disabled:opacity-50">
              {{ isSubmitting ? '正在处理...' : (modalMode === 'create' ? '立即创建' : '保存修改') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Member Dialog -->
    <el-dialog v-model="addMemberDialogVisible" title="添加团队成员" width="400px" destroy-on-close>
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-400 mb-2 uppercase">选择用户</label>
          <el-select v-model="selectedUserId" filterable placeholder="搜索并选择用户..." class="w-full">
            <el-option v-for="user in getAvailableUsersForAdd" :key="user.id" :label="`${user.name} (${user.email})`" :value="user.id" />
          </el-select>
        </div>
        <p class="text-[10px] text-slate-400">提示: 新成员将以"普通成员"身份加入团队。</p>
      </div>
      <template #footer>
        <div class="flex gap-3">
          <button @click="addMemberDialogVisible = false" class="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold text-xs hover:bg-slate-50 transition-all">取消</button>
          <button @click="handleAddMember" :disabled="!selectedUserId"
                  class="flex-1 py-2.5 rounded-xl bg-accent text-white font-bold text-xs shadow-lg shadow-accent/20 disabled:opacity-50 transition-all">
            添加成员
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
</style>
