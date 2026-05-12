<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { 
  Users, 
  Settings, 
  UserPlus, 
  Mail, 
  Shield, 
  ShieldCheck, 
  MoreVertical,
  Trash2,
  LogOut,
  Camera,
  ChevronRight,
  Info
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const teamId = computed(() => route.params.id as string)

const team = ref<any>(null)
const isLoading = ref(false)
const activeTab = ref('members') // 'members', 'settings', 'invitations'

const fetchTeamDetail = async () => {
  isLoading.value = true
  try {
    const response = await api.get(`/api/teams/${teamId.value}`)
    team.value = response.data
  } catch (error) {
    console.error('Fetch team detail error:', error)
    ElMessage.error('获取团队详情失败')
    router.push('/dashboard')
  } finally {
    isLoading.value = false
  }
}

const currentUserRole = computed(() => {
  if (!team.value || !authStore.user) return null
  const member = team.value.members.find((m: any) => m.userId === authStore.user?.id)
  return member?.role
})

const isOwnerOrAdmin = computed(() => {
  return ['OWNER', 'ADMIN'].includes(currentUserRole.value || '')
})

const isOwner = computed(() => currentUserRole.value === 'OWNER')

// Member Management
const handleRemoveMember = async (user: any) => {
  try {
    await ElMessageBox.confirm(`确定要移除成员 ${user.name} 吗？`, '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    await api.delete(`/api/teams/${teamId.value}/members/${user.id}`)
    ElMessage.success('成员已移除')
    fetchTeamDetail()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('移除成员失败')
    }
  }
}

const handleUpdateRole = async (user: any, newRole: string) => {
  try {
    await api.patch(`/api/teams/${teamId.value}/members/${user.id}/role`, { role: newRole })
    ElMessage.success('角色已更新')
    fetchTeamDetail()
  } catch (error) {
    ElMessage.error('更新角色失败')
  }
}

// Team Settings
const editForm = ref({
  name: '',
  description: '',
  avatarUrl: ''
})

const isSaving = ref(false)
const handleUpdateTeam = async () => {
  isSaving.value = true
  try {
    await api.patch(`/api/teams/${teamId.value}`, editForm.value)
    ElMessage.success('团队资料已更新')
    fetchTeamDetail()
  } catch (error) {
    ElMessage.error('更新团队资料失败')
  } finally {
    isSaving.value = false
  }
}

const handleDeleteTeam = async () => {
  try {
    await ElMessageBox.confirm('确定要解散该团队吗？此操作不可逆！', '极端警告', {
      confirmButtonText: '解散团队',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger',
      type: 'error'
    })
    
    await api.delete(`/api/teams/${teamId.value}`)
    ElMessage.success('团队已解散')
    router.push('/dashboard')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('解散团队失败')
    }
  }
}

// Invite Member
const inviteEmail = ref('')
const isInviting = ref(false)
const handleInvite = async () => {
  if (!inviteEmail.value) return
  isInviting.value = true
  try {
    await api.post('/api/teams/invite', {
      teamId: teamId.value,
      inviteeEmail: inviteEmail.value
    })
    ElMessage.success('邀请已发送')
    inviteEmail.value = ''
    fetchTeamDetail()
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '邀请发送失败')
  } finally {
    isInviting.value = false
  }
}

onMounted(() => {
  fetchTeamDetail()
})

watch(() => team.value, (newTeam) => {
  if (newTeam) {
    editForm.value = {
      name: newTeam.name,
      description: newTeam.description || '',
      avatarUrl: newTeam.avatarUrl || ''
    }
  }
}, { immediate: true })
</script>

<template>
  <div class="flex-1 overflow-y-auto" style="background-color: var(--bg-app)">
    <div v-if="isLoading" class="h-full flex items-center justify-center">
      <div class="text-center">
        <div class="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-xs text-slate-400 font-bold uppercase tracking-widest">加载团队数据中</p>
      </div>
    </div>

    <template v-else-if="team">
      <!-- Header Section -->
      <div class="bg-white dark:bg-slate-900 border-b transition-colors duration-300" style="border-color: var(--border-base)">
        <div class="max-w-6xl mx-auto px-6 py-10">
          <div class="flex flex-col md:flex-row items-center gap-8">
            <div class="relative group">
              <div class="w-32 h-32 rounded-3xl overflow-hidden border-4 border-white dark:border-slate-800 shadow-xl" :class="!team.avatarUrl ? 'bg-orange-500 flex items-center justify-center text-white text-4xl font-bold' : ''">
                <img v-if="team.avatarUrl" :src="team.avatarUrl" class="w-full h-full object-cover" />
                <span v-else>{{ team.name.charAt(0) }}</span>
              </div>
              <button v-if="isOwnerOrAdmin" class="absolute -bottom-2 -right-2 p-2 bg-accent text-white rounded-xl shadow-lg hover:scale-110 transition-all">
                <Camera class="w-4 h-4" />
              </button>
            </div>
            
            <div class="flex-1 text-center md:text-left">
              <div class="flex items-center justify-center md:justify-start gap-3 mb-2">
                <h1 class="text-3xl font-black" style="color: var(--text-primary)">{{ team.name }}</h1>
                <div class="px-2 py-0.5 bg-orange-500/10 text-orange-500 text-[10px] font-bold rounded uppercase tracking-wider">团队空间</div>
              </div>
              <p class="text-slate-500 max-w-xl mb-6">{{ team.description || '暂无团队描述' }}</p>
              
              <div class="flex flex-wrap items-center justify-center md:justify-start gap-6">
                <div class="flex items-center gap-2">
                  <Users class="w-4 h-4 text-slate-400" />
                  <span class="text-sm font-bold" style="color: var(--text-primary)">{{ team.members.length }} 成员</span>
                </div>
                <div class="flex items-center gap-2">
                  <ShieldCheck class="w-4 h-4 text-slate-400" />
                  <span class="text-sm font-bold" style="color: var(--text-primary)">由 {{ team.members.find((m: any) => m.role === 'OWNER')?.user.name }} 创建</span>
                </div>
                <div class="flex items-center gap-2">
                  <Mail class="w-4 h-4 text-slate-400" />
                  <span class="text-sm font-bold" style="color: var(--text-primary)">{{ team.invitations?.length || 0 }} 待处理邀请</span>
                </div>
              </div>
            </div>

            <div v-if="isOwnerOrAdmin" class="flex items-center gap-3">
              <button @click="activeTab = 'settings'" class="px-6 py-3 border rounded-2xl font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-all flex items-center gap-2" style="border-color: var(--border-base); color: var(--text-primary)">
                <Settings class="w-4 h-4" />
                团队设置
              </button>
              <button @click="activeTab = 'members'" class="px-6 py-3 bg-accent text-white rounded-2xl font-bold shadow-lg shadow-accent/20 hover:scale-105 transition-all flex items-center gap-2">
                <UserPlus class="w-4 h-4" />
                邀请成员
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Content Tabs -->
      <div class="max-w-6xl mx-auto px-6 py-10">
        <!-- Tab Navigation -->
        <div class="flex gap-8 mb-10 border-b" style="border-color: var(--border-base)">
          <button 
            @click="activeTab = 'members'"
            class="pb-4 text-sm font-bold transition-all relative"
            :class="activeTab === 'members' ? 'text-accent' : 'text-slate-400 hover:text-slate-600'"
          >
            成员列表
            <div v-if="activeTab === 'members'" class="absolute bottom-0 left-0 right-0 h-1 bg-accent rounded-full"></div>
          </button>
          <button 
            @click="activeTab = 'invitations'"
            class="pb-4 text-sm font-bold transition-all relative"
            :class="activeTab === 'invitations' ? 'text-accent' : 'text-slate-400 hover:text-slate-600'"
          >
            待处理邀请
            <div v-if="activeTab === 'invitations'" class="absolute bottom-0 left-0 right-0 h-1 bg-accent rounded-full"></div>
          </button>
          <button 
            v-if="isOwnerOrAdmin"
            @click="activeTab = 'settings'"
            class="pb-4 text-sm font-bold transition-all relative"
            :class="activeTab === 'settings' ? 'text-accent' : 'text-slate-400 hover:text-slate-600'"
          >
            团队设置
            <div v-if="activeTab === 'settings'" class="absolute bottom-0 left-0 right-0 h-1 bg-accent rounded-full"></div>
          </button>
        </div>

        <!-- Members Tab -->
        <div v-if="activeTab === 'members'" class="space-y-6">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold" style="color: var(--text-primary)">团队成员</h2>
            <div class="flex items-center gap-4">
              <div class="relative">
                <input type="text" placeholder="搜索成员..." class="pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs focus:ring-2 focus:ring-accent/20 outline-none w-64 transition-all" style="border-color: var(--border-base); color: var(--text-primary)" />
                <Users class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-for="member in team.members" :key="member.id" class="p-4 bg-white dark:bg-slate-900 rounded-3xl border flex items-center gap-4 group transition-all hover:shadow-lg" style="border-color: var(--border-base)">
              <img :src="member.user.avatarUrl || 'https://www.gravatar.com/avatar/0?d=mp'" class="w-14 h-14 rounded-2xl object-cover border" style="border-color: var(--border-base)" />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-0.5">
                  <span class="font-bold truncate" style="color: var(--text-primary)">{{ member.user.name }}</span>
                  <div v-if="member.role === 'OWNER'" class="px-1.5 py-0.5 bg-accent/10 text-accent text-[8px] font-black rounded uppercase tracking-tighter">创建者</div>
                  <div v-else-if="member.role === 'ADMIN'" class="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 text-[8px] font-black rounded uppercase tracking-tighter">管理员</div>
                </div>
                <p class="text-xs text-slate-400 truncate">{{ member.user.email }}</p>
                <p class="text-[9px] text-slate-400 mt-1 uppercase font-bold tracking-widest">加入于 {{ new Date(member.joinedAt).toLocaleDateString() }}</p>
              </div>

              <div v-if="isOwnerOrAdmin && member.userId !== authStore.user?.id" class="opacity-0 group-hover:opacity-100 transition-all">
                <el-dropdown trigger="click" placement="bottom-end">
                  <button class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all" style="color: var(--text-muted)">
                    <MoreVertical class="w-4 h-4" />
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu class="w-48 p-2 rounded-2xl shadow-2xl border-none">
                      <template v-if="isOwner">
                        <el-dropdown-item v-if="member.role === 'MEMBER'" @click="handleUpdateRole(member.user, 'ADMIN')" class="rounded-xl my-0.5">
                          <div class="flex items-center gap-3 py-1 text-emerald-600 font-bold">
                            <ShieldCheck class="w-4 h-4" />
                            设为管理员
                          </div>
                        </el-dropdown-item>
                        <el-dropdown-item v-if="member.role === 'ADMIN'" @click="handleUpdateRole(member.user, 'MEMBER')" class="rounded-xl my-0.5">
                          <div class="flex items-center gap-3 py-1 text-slate-600 font-bold">
                            <Shield class="w-4 h-4" />
                            降为普通成员
                          </div>
                        </el-dropdown-item>
                      </template>
                      <el-dropdown-item @click="handleRemoveMember(member.user)" class="rounded-xl my-0.5 text-rose-600 font-bold">
                        <div class="flex items-center gap-3 py-1">
                          <Trash2 class="w-4 h-4" />
                          移出团队
                        </div>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>

            <!-- Invite Card -->
            <div v-if="isOwnerOrAdmin" class="p-4 bg-accent/5 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all hover:bg-accent/10" style="border-color: var(--accent)">
              <div class="flex items-center gap-3 w-full">
                <input 
                  v-model="inviteEmail"
                  type="email" 
                  placeholder="输入邮箱地址..." 
                  class="flex-1 px-4 py-2.5 bg-white dark:bg-slate-900 border rounded-2xl text-xs focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                  style="border-color: var(--border-base); color: var(--text-primary)"
                />
                <button 
                  @click="handleInvite"
                  :disabled="isInviting || !inviteEmail"
                  class="px-6 py-2.5 bg-accent text-white rounded-2xl text-xs font-bold disabled:opacity-50"
                >
                  发送邀请
                </button>
              </div>
              <p class="text-[10px] text-accent font-bold uppercase tracking-widest">通过电子邮件邀请新成员</p>
            </div>
          </div>
        </div>

        <!-- Invitations Tab -->
        <div v-if="activeTab === 'invitations'" class="space-y-6">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold" style="color: var(--text-primary)">待处理邀请</h2>
            <div class="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {{ team.invitations?.length || 0 }} 个待处理
            </div>
          </div>

          <div v-if="team.invitations?.length > 0" class="space-y-3">
            <div v-for="inv in team.invitations" :key="inv.id" class="p-6 bg-white dark:bg-slate-900 rounded-3xl border flex items-center justify-between" style="border-color: var(--border-base)">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400">
                  <Mail class="w-6 h-6" />
                </div>
                <div>
                  <p class="font-bold" style="color: var(--text-primary)">{{ inv.inviteeEmail }}</p>
                  <p class="text-xs text-slate-400 mt-1">有效期至 {{ new Date(inv.expiresAt).toLocaleDateString() }}</p>
                </div>
              </div>
              <div class="flex items-center gap-4">
                <div class="px-3 py-1 bg-orange-500/10 text-orange-500 text-[10px] font-black rounded uppercase tracking-tighter">等待响应</div>
                <button v-if="isOwnerOrAdmin" class="text-xs font-bold text-rose-500 hover:underline">撤回邀请</button>
              </div>
            </div>
          </div>

          <div v-else class="py-20 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-dashed" style="border-color: var(--border-base)">
            <Mail class="w-12 h-12 mx-auto mb-4 opacity-10" />
            <p class="text-sm">暂无待处理的团队邀请</p>
          </div>
        </div>

        <!-- Settings Tab -->
        <div v-if="activeTab === 'settings' && isOwnerOrAdmin" class="space-y-10">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div class="lg:col-span-1">
              <h3 class="text-lg font-bold mb-2" style="color: var(--text-primary)">基本资料</h3>
              <p class="text-xs text-slate-500 leading-relaxed">修改团队名称、描述和公开头像。这些信息对所有成员可见。</p>
            </div>
            
            <div class="lg:col-span-2 space-y-6 bg-white dark:bg-slate-900 p-8 rounded-3xl border shadow-sm" style="border-color: var(--border-base)">
              <div class="space-y-2">
                <label class="text-xs font-black text-slate-400 uppercase tracking-widest">团队名称</label>
                <input v-model="editForm.name" type="text" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border rounded-2xl focus:ring-2 focus:ring-accent/20 outline-none transition-all" style="border-color: var(--border-base); color: var(--text-primary)" />
              </div>
              <div class="space-y-2">
                <label class="text-xs font-black text-slate-400 uppercase tracking-widest">团队描述</label>
                <textarea v-model="editForm.description" rows="4" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border rounded-2xl focus:ring-2 focus:ring-accent/20 outline-none transition-all" style="border-color: var(--border-base); color: var(--text-primary)"></textarea>
              </div>
              <div class="flex justify-end pt-4">
                <button 
                  @click="handleUpdateTeam"
                  :disabled="isSaving"
                  class="px-8 py-3 bg-accent text-white rounded-2xl font-bold shadow-lg shadow-accent/20 hover:scale-105 transition-all disabled:opacity-50"
                >
                  {{ isSaving ? '正在保存...' : '保存更改' }}
                </button>
              </div>
            </div>
          </div>

          <div class="border-t pt-10" style="border-color: var(--border-base)">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div class="lg:col-span-1">
                <h3 class="text-lg font-bold mb-2 text-rose-500">危险区域</h3>
                <p class="text-xs text-slate-500 leading-relaxed">解散团队将删除所有成员关系和相关数据，此操作不可恢复。请谨慎操作。</p>
              </div>
              
              <div class="lg:col-span-2 bg-rose-50 dark:bg-rose-500/5 p-8 rounded-3xl border border-rose-200 dark:border-rose-500/20 flex items-center justify-between">
                <div>
                  <h4 class="font-bold text-rose-600 mb-1">解散团队</h4>
                  <p class="text-xs text-rose-500">删除此团队的所有数据</p>
                </div>
                <button 
                  v-if="isOwner"
                  @click="handleDeleteTeam"
                  class="px-8 py-3 bg-rose-600 text-white rounded-2xl font-bold shadow-lg shadow-rose-600/20 hover:bg-rose-700 transition-all"
                >
                  解散团队
                </button>
                <div v-else class="flex items-center gap-2 text-rose-400 italic text-xs">
                  <Info class="w-4 h-4" />
                  只有团队创建者可以解散团队
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
