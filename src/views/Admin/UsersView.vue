<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { 
  Users, 
  Shield, 
  Search,
  MoreVertical,
  Trash2,
  UserX,
  UserCheck,
  RefreshCw,
  Mail,
  Calendar,
  Filter
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'

const users = ref<any[]>([])
const isLoading = ref(false)
const searchQuery = ref('')
const roleFilter = ref('ALL')

const fetchUsers = async () => {
  isLoading.value = true
  try {
    const response = await api.get('/api/admin/users')
    users.value = response.data
  } catch (error) {
    ElMessage.error('无法加载用户列表')
  } finally {
    isLoading.value = false
  }
}

const filteredUsers = computed(() => {
  return users.value.filter(user => {
    if (!user) return false
    const matchesSearch = 
      (user.name?.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
       user.email?.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
       false)
    
    const matchesRole = roleFilter.value === 'ALL' || user.role === roleFilter.value
    
    return matchesSearch && matchesRole
  })
})

const handleRoleChange = async (user: any, newRole: string) => {
  try {
    await api.put(`/api/admin/users/${user.id}/role`, { role: newRole })
    user.role = newRole
    ElMessage.success(`用户 ${user.name || user.email} 已设为 ${newRole}`)
  } catch (error) {
    ElMessage.error('权限修改失败')
  }
}

const handleDeleteUser = (user: any) => {
  ElMessageBox.confirm(
    `确定要删除用户 ${user.name || user.email} 吗？此操作不可逆，将删除其所有相关数据。`,
    '极端危险操作',
    {
      confirmButtonText: '确定永久删除',
      cancelButtonText: '取消',
      type: 'error',
      confirmButtonClass: 'el-button--danger'
    }
  ).then(async () => {
    try {
      await api.delete(`/api/admin/users/${user.id}`)
      users.value = users.value.filter(u => u.id !== user.id)
      ElMessage.success('用户及其数据已从系统移除')
    } catch (error) {
      ElMessage.error('删除失败')
    }
  })
}

onMounted(fetchUsers)
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="h-20 border-b px-8 flex items-center justify-between shrink-0 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-4">
        <div class="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
          <Users class="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h1 class="text-2xl font-black tracking-tight" style="color: var(--text-primary)">全平台用户管理</h1>
          <p class="text-xs font-medium mt-1" style="color: var(--text-muted)">监控活跃用户、调整权限等级及账号清理</p>
        </div>
      </div>
      
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-transparent hover:border-slate-200 transition-all">
          <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">总计</span>
          <span class="text-sm font-black text-indigo-600">{{ users.length }}</span>
        </div>
        <button @click="fetchUsers" class="p-2.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors text-slate-400">
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
        </button>
      </div>
    </div>

    <!-- Filters Bar -->
    <div class="p-6 border-b shrink-0 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 justify-between items-center">
        <div class="relative w-full md:w-96">
          <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input v-model="searchQuery" 
                 type="text" 
                 placeholder="按姓名或邮箱搜索用户..." 
                 class="w-full pl-11 pr-4 py-3 rounded-2xl border transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none"
                 style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
        </div>

        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <Filter class="w-4 h-4 text-slate-400" />
            <select v-model="roleFilter" 
                    class="px-4 py-2.5 rounded-xl border outline-none font-bold text-xs"
                    style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)">
              <option value="ALL">所有角色</option>
              <option value="ADMIN">管理员</option>
              <option value="INSTRUCTOR">导师</option>
              <option value="USER">普通用户</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Users List -->
    <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
      <div class="max-w-7xl mx-auto">
        <div v-if="isLoading" class="flex flex-col items-center justify-center py-24 gap-4">
          <div class="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p class="text-sm font-bold text-slate-400">正在同步用户数据...</p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <div v-for="user in filteredUsers" :key="user.id" 
               class="group rounded-3xl border p-6 transition-all hover:shadow-xl hover:border-indigo-200 dark:hover:border-indigo-900/40 relative overflow-hidden"
               style="background-color: var(--bg-card); border-color: var(--border-base)">
            
            <!-- Role Badge -->
            <div class="absolute top-4 right-4">
              <span class="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm"
                    :class="{
                      'bg-rose-100 text-rose-600': user.role === 'ADMIN',
                      'bg-blue-100 text-blue-600': user.role === 'INSTRUCTOR',
                      'bg-slate-100 text-slate-500': user.role === 'USER'
                    }">
                {{ user.role }}
              </span>
            </div>

            <div class="flex items-start gap-4 mb-6">
              <div class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 overflow-hidden border-2 border-white dark:border-slate-800 shadow-sm shrink-0">
                <img :src="user.avatarUrl || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'" class="w-full h-full object-cover" />
              </div>
              <div class="min-w-0 pr-12">
                <h3 class="font-bold text-lg truncate" style="color: var(--text-primary)">{{ user.name || '未命名用户' }}</h3>
                <p class="text-xs text-slate-400 truncate">{{ user.email }}</p>
              </div>
            </div>

            <div class="space-y-3 mb-6">
              <div class="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                <Calendar class="w-3.5 h-3.5" />
                注册于 {{ new Date(user.createdAt).toLocaleDateString() }}
              </div>
              <div class="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                <Shield class="w-3.5 h-3.5" />
                用户 ID: {{ user.id.split('-')[0] }}...
              </div>
            </div>

            <div class="flex items-center gap-2 pt-4 border-t border-slate-50 dark:border-white/5">
              <el-dropdown trigger="click" class="flex-1">
                <button class="w-full py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-600 dark:text-slate-400 hover:text-indigo-600 font-bold text-xs transition-all flex items-center justify-center gap-2">
                  <Shield class="w-3.5 h-3.5" />
                  修改权限
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="handleRoleChange(user, 'USER')">设为普通用户</el-dropdown-item>
                    <el-dropdown-item @click="handleRoleChange(user, 'INSTRUCTOR')">设为平台导师</el-dropdown-item>
                    <el-dropdown-item @click="handleRoleChange(user, 'ADMIN')">设为管理员</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              
              <button @click="handleDeleteUser(user)" 
                      class="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div v-if="filteredUsers.length === 0 && !isLoading" class="flex flex-col items-center justify-center py-24 text-center">
          <div class="w-20 h-20 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-6">
            <Search class="w-10 h-10 text-slate-300" />
          </div>
          <h3 class="text-xl font-bold mb-2" style="color: var(--text-primary)">未找到匹配用户</h3>
          <p class="text-sm text-slate-400 max-w-sm">尝试更换关键词或筛选条件再次搜索。</p>
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
