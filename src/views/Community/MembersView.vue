<script setup lang="ts">
import { ref, computed } from 'vue'
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

const searchQuery = ref('')
const activeFilter = ref('全部')

const filters = ['全部', '管理员', '设计师', '学习者']

const members = [
  {
    id: 1,
    name: '设计师小王 (你)',
    email: 'admin@3dlearn.com',
    role: '管理员',
    status: '在线',
    avatar: 'https://i.pravatar.cc/150?img=11',
    joinedDate: '2026-01-15'
  },
  {
    id: 2,
    name: 'Sarah Chen',
    email: 'sarah.c@3dlearn.com',
    role: '设计师',
    status: '忙碌',
    avatar: 'https://i.pravatar.cc/150?img=32',
    joinedDate: '2026-02-10'
  },
  {
    id: 3,
    name: 'Alex Rivera',
    email: 'alex.r@3dlearn.com',
    role: '设计师',
    status: '离线',
    avatar: 'https://i.pravatar.cc/150?img=12',
    joinedDate: '2026-03-05'
  },
  {
    id: 4,
    name: 'David Wilson',
    email: 'david.w@3dlearn.com',
    role: '学习者',
    status: '在线',
    avatar: 'https://i.pravatar.cc/150?img=13',
    joinedDate: '2026-04-20'
  },
  {
    id: 5,
    name: 'Emily Zhang',
    email: 'emily.z@3dlearn.com',
    role: '学习者',
    status: '在线',
    avatar: 'https://i.pravatar.cc/150?img=25',
    joinedDate: '2026-05-01'
  }
]

const filteredMembers = computed(() => {
  return members.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                          member.email.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesFilter = activeFilter.value === '全部' || member.role === activeFilter.value
    return matchesSearch && matchesFilter
  })
})

const getStatusColor = (status: string) => {
  switch (status) {
    case '在线': return 'text-emerald-500'
    case '忙碌': return 'text-amber-500'
    default: return 'text-slate-300 dark:text-slate-600'
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="h-16 border-b px-8 flex items-center justify-between shrink-0 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <Users class="w-5 h-5 text-purple-600 dark:text-purple-400" />
        </div>
        <h1 class="text-xl font-bold" style="color: var(--text-primary)">团队成员</h1>
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
          <UserPlus class="w-4 h-4" /> 邀请成员
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
          {{ filter }}
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
              <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider" style="color: var(--text-muted)">成员姓名</th>
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
                  <img :src="member.avatar" class="w-10 h-10 rounded-full border transition-colors duration-300" style="border-color: var(--border-base)" />
                  <div>
                    <p class="text-sm font-bold" style="color: var(--text-primary)">{{ member.name }}</p>
                    <p class="text-xs" style="color: var(--text-muted)">{{ member.email }}</p>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center gap-1.5">
                  <ShieldCheck v-if="member.role === '管理员'" class="w-3.5 h-3.5 text-accent" />
                  <span class="text-xs font-bold" style="color: var(--text-secondary)">{{ member.role }}</span>
                </div>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                  <Circle class="w-2 h-2 fill-current" :class="getStatusColor(member.status)" />
                  <span class="text-xs font-bold" style="color: var(--text-secondary)">{{ member.status }}</span>
                </div>
              </td>
              <td class="px-6 py-4 text-xs font-bold" style="color: var(--text-secondary)">
                {{ member.joinedDate }}
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button class="p-2 hover:text-accent hover:bg-accent-subtle rounded-lg transition-all" 
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
