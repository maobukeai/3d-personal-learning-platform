<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { 
  Search, 
  Users, 
  Mail, 
  MessageSquare, 
  MoreHorizontal, 
  UserPlus,
  ShieldCheck,
  Circle
} from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import { useRouter } from 'vue-router'
import { socketService } from '@/utils/socket'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const router = useRouter()
const searchQuery = ref('')
const activeFilter = ref('全部')
const members = ref<any[]>([])
const isLoading = ref(false)

const filters = ['全部', 'ADMIN', 'USER']
const roleLabels: Record<string, string> = {
  'ADMIN': '管理员',
  'USER': '学习者'
}

const fetchMembers = async () => {
  isLoading.value = true
  try {
    const response = await api.get('/api/auth/users/public')
    members.value = response.data
  } catch (error) {
    ElMessage.error('获取成员列表失败')
  } finally {
    isLoading.value = false
  }
}

const filteredMembers = computed(() => {
  return members.value.filter(member => {
    const name = (member.name || '').toLowerCase()
    const email = member.email.toLowerCase()
    const matchesSearch = name.includes(searchQuery.value.toLowerCase()) ||
                          email.includes(searchQuery.value.toLowerCase())
    const matchesFilter = activeFilter.value === '全部' || member.role === activeFilter.value
    return matchesSearch && matchesFilter
  })
})

const handleChatWithMember = async (member: any) => {
  try {
    await api.post('/api/messages/conversations', {
      participantIds: [member.id],
      isGroup: false
    })
    router.push('/messages')
  } catch (error) {
    ElMessage.error('无法发起对话')
  }
}

onMounted(() => {
  fetchMembers()
})
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="h-16 border-b px-8 flex items-center justify-between shrink-0 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-purple-50 rounded-lg">
          <Users class="w-5 h-5 text-purple-600" />
        </div>
        <h1 class="text-xl font-bold" style="color: var(--text-primary)">平台成员</h1>
      </div>
      
      <div class="flex items-center gap-4">
        <div class="relative">
          <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style="color: var(--text-muted)" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="搜索姓名或邮箱..." 
            class="pl-10 pr-4 py-2 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 w-64 transition-all"
            style="background-color: var(--bg-app); color: var(--text-primary)"
          />
        </div>
        <button class="bg-accent text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-accent transition-all shadow-lg shadow-accent/20 flex items-center gap-2">
          <UserPlus class="w-4 h-4" /> 邀请伙伴
        </button>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="border-b px-8 py-2 shrink-0 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-2">
        <button 
          v-for="filter in filters" 
          :key="filter"
          @click="activeFilter = filter"
          class="px-4 py-1.5 rounded-lg text-sm font-bold transition-all"
          :class="activeFilter === filter ? 'bg-slate-800 dark:bg-accent text-white' : 'hover:opacity-80'"
          :style="activeFilter !== filter ? 'color: var(--text-secondary); background-color: var(--bg-app)' : ''"
        >
          {{ roleLabels[filter] || filter }}
        </button>
      </div>
    </div>

    <!-- Members List Area -->
    <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
      <div class="max-w-6xl mx-auto rounded-3xl border shadow-sm overflow-hidden transition-colors duration-300"
           style="background-color: var(--bg-card); border-color: var(--border-base)">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b transition-colors duration-300" style="background-color: var(--bg-app); border-color: var(--border-base)">
              <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider" style="color: var(--text-muted)">成员信息</th>
              <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider" style="color: var(--text-muted)">角色</th>
              <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider" style="color: var(--text-muted)">状态</th>
              <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider" style="color: var(--text-muted)">加入时间</th>
              <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-right" style="color: var(--text-muted)">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y transition-colors duration-300" style="border-color: var(--border-base)">
            <tr v-for="member in filteredMembers" :key="member.id" class="hover:opacity-90 transition-colors group">
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <img :src="member.avatarUrl || `https://ui-avatars.com/api/?name=${member.name || member.email}`" class="w-10 h-10 rounded-full border transition-colors duration-300" style="border-color: var(--border-base)" />
                  <div>
                    <p class="text-sm font-bold" style="color: var(--text-primary)">{{ member.name || '未设置昵称' }}</p>
                    <p class="text-xs" style="color: var(--text-muted)">{{ member.email }}</p>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center gap-1.5">
                  <ShieldCheck v-if="member.role === 'ADMIN'" class="w-3.5 h-3.5 text-accent" />
                  <span class="text-xs font-bold" style="color: var(--text-secondary)">{{ roleLabels[member.role] || member.role }}</span>
                </div>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                  <Circle class="w-2 h-2 fill-current" :class="authStore.isUserOnline(member.id) ? 'text-emerald-500' : 'text-slate-300'" />
                  <span class="text-xs font-bold" style="color: var(--text-secondary)">{{ authStore.isUserOnline(member.id) ? '在线' : '离线' }}</span>
                </div>
              </td>
              <td class="px-6 py-4 text-xs font-bold" style="color: var(--text-secondary)">
                {{ new Date(member.createdAt).toLocaleDateString() }}
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click="handleChatWithMember(member)" class="p-2 hover:text-accent hover:bg-accent-subtle rounded-lg transition-all" 
                          style="color: var(--text-muted)" title="发送消息">
                    <MessageSquare class="w-4 h-4" />
                  </button>
                  <button class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all" style="color: var(--text-muted)">
                    <MoreHorizontal class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
