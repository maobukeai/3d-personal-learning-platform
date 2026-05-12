<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { 
  Users, 
  Search, 
  Shield, 
  UserMinus, 
  MoreVertical,
  Flag,
  Calendar,
  Settings
} from 'lucide-vue-next'
import api from '@/utils/api'

const teams = ref<any[]>([])
const isLoading = ref(true)
const searchQuery = ref('')

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

const updateMemberRole = async (teamId: string, userId: string, role: string) => {
  try {
    await api.put(`/api/admin/teams/${teamId}/members/${userId}/role`, { role })
    fetchTeams()
  } catch (error) {
    console.error('Update member role error:', error)
  }
}

const removeMember = async (teamId: string, userId: string) => {
  if (!confirm('确定要从团队中移除该成员吗？')) return
  try {
    await api.delete(`/api/admin/teams/${teamId}/members/${userId}`)
    fetchTeams()
  } catch (error) {
    console.error('Remove member error:', error)
  }
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString()
}

onMounted(() => {
  fetchTeams()
})
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="h-20 border-b px-8 flex items-center justify-between shrink-0 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div>
        <h1 class="text-2xl font-black tracking-tight" style="color: var(--text-primary)">团队权限管理</h1>
        <p class="text-xs font-medium mt-1" style="color: var(--text-muted)">监控和管理平台内的所有团队及其成员权限</p>
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
        <div v-for="team in teams" :key="team.id" 
             class="rounded-3xl border overflow-hidden transition-all hover:shadow-lg"
             style="background-color: var(--bg-card); border-color: var(--border-base)">
          <div class="p-6">
            <div class="flex items-center justify-between mb-6">
              <div class="flex items-center gap-4">
                <div class="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/5 overflow-hidden flex-shrink-0">
                  <img v-if="team.avatarUrl" :src="team.avatarUrl" class="w-full h-full object-cover" />
                  <Users v-else class="w-full h-full p-3 text-slate-400" />
                </div>
                <div>
                  <h3 class="font-bold text-lg" style="color: var(--text-primary)">{{ team.name }}</h3>
                  <div class="flex items-center gap-3 text-[10px] font-bold text-slate-400 mt-1">
                    <span class="flex items-center gap-1"><Flag class="w-3 h-3" /> 负责人: {{ team.owner.name }}</span>
                    <span>•</span>
                    <span class="flex items-center gap-1"><Calendar class="w-3 h-3" /> 创建于 {{ formatDate(team.createdAt) }}</span>
                  </div>
                </div>
              </div>
              <div class="px-4 py-1.5 rounded-xl bg-slate-50 dark:bg-white/5 text-[10px] font-black text-slate-400 uppercase tracking-widest border border-transparent group-hover:border-slate-200 transition-all">
                {{ team._count.members }} 成员
              </div>
            </div>

            <!-- Members Table -->
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th class="pb-4 pl-2">成员</th>
                    <th class="pb-4">邮箱</th>
                    <th class="pb-4">权限角色</th>
                    <th class="pb-4 text-right pr-2">操作</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-white/5">
                  <tr v-for="member in team.members" :key="member.user.id" class="group/member">
                    <td class="py-4 pl-2">
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                          <img v-if="member.user.avatarUrl" :src="member.user.avatarUrl" class="w-full h-full object-cover" />
                        </div>
                        <span class="text-sm font-bold" style="color: var(--text-primary)">{{ member.user.name }}</span>
                      </div>
                    </td>
                    <td class="py-4">
                      <span class="text-xs text-slate-400">{{ member.user.email }}</span>
                    </td>
                    <td class="py-4">
                      <div class="flex items-center gap-2">
                        <span class="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter"
                              :class="{
                                'bg-purple-100 text-purple-600': member.role === 'OWNER',
                                'bg-blue-100 text-blue-600': member.role === 'ADMIN',
                                'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400': member.role === 'MEMBER'
                              }">
                          {{ member.role === 'OWNER' ? '创建者' : (member.role === 'ADMIN' ? '管理员' : '成员') }}
                        </span>
                        
                        <select v-if="member.role !== 'OWNER'" 
                                @change="(e: any) => updateMemberRole(team.id, member.user.id, e.target.value)"
                                class="bg-transparent border-none text-[10px] font-bold text-accent outline-none cursor-pointer opacity-0 group-hover/member:opacity-100 transition-opacity">
                          <option value="MEMBER">改为成员</option>
                          <option value="ADMIN">改为管理员</option>
                        </select>
                      </div>
                    </td>
                    <td class="py-4 text-right pr-2">
                      <button v-if="member.role !== 'OWNER'" 
                              @click="removeMember(team.id, member.user.id)"
                              class="p-2 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all opacity-0 group-hover/member:opacity-100">
                        <UserMinus class="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
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
