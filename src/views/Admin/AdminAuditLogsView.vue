<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { 
  Shield, 
  Search, 
  Filter, 
  Calendar,
  User as UserIcon,
  Activity,
  ChevronLeft,
  ChevronRight,
  Info,
  RefreshCw,
  Terminal
} from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'

const logs = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const totalPages = ref(1)
const isLoading = ref(true)

const moduleFilter = ref('')
const actionFilter = ref('')

const modules = [
  { label: '全部模块', value: '' },
  { label: '系统设置', value: 'SETTINGS' },
  { label: '用户管理', value: 'USER' },
  { label: '资产管理', value: 'ASSET' },
  { label: '认证', value: 'AUTH' },
  { label: '内容审核', value: 'MATERIAL' },
  { label: '作品展示', value: 'SHOWCASE' }
]

const fetchLogs = async () => {
  try {
    isLoading.value = true
    const { data } = await api.get('/api/admin/audit-logs', {
      params: {
        page: currentPage.value,
        module: moduleFilter.value,
        action: actionFilter.value
      }
    })
    logs.value = data.logs
    total.value = data.total
    totalPages.value = data.pages
  } catch (error) {
    ElMessage.error('获取审计日志失败')
  } finally {
    isLoading.value = false
  }
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleString()
}

const getActionLabel = (action: string) => {
  const labels: Record<string, string> = {
    'LOGIN': '登录',
    'LOGOUT': '登出',
    'UPDATE_SETTINGS': '更新设置',
    'CREATE_USER': '创建用户',
    'UPDATE_USER': '更新用户',
    'DELETE_USER': '删除用户',
    'RESET_PASSWORD': '重置密码',
    'APPROVE_ASSET': '通过资产',
    'REJECT_ASSET': '拒绝资产',
    'DELETE_ASSET': '删除资产',
    'APPROVE_MATERIAL': '通过材料',
    'REJECT_MATERIAL': '拒绝材料',
    'APPROVE_SHOWCASE': '通过作品',
    'REJECT_SHOWCASE': '拒绝作品'
  }
  return labels[action] || action
}

const getModuleColor = (module: string) => {
  const colors: Record<string, string> = {
    'SETTINGS': 'bg-blue-500',
    'USER': 'bg-purple-500',
    'ASSET': 'bg-orange-500',
    'AUTH': 'bg-emerald-500',
    'MATERIAL': 'bg-cyan-500',
    'SHOWCASE': 'bg-rose-500'
  }
  return colors[module] || 'bg-slate-500'
}

watch([moduleFilter, actionFilter], () => {
  currentPage.value = 1
  fetchLogs()
})

onMounted(fetchLogs)
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="h-20 border-b px-8 flex items-center justify-between shrink-0 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
          <Terminal class="w-6 h-6" />
        </div>
        <div>
          <h1 class="text-2xl font-black tracking-tight" style="color: var(--text-primary)">审计日志</h1>
          <p class="text-xs font-medium mt-1" style="color: var(--text-muted)">记录管理员与系统的所有关键操作</p>
        </div>
      </div>
      
      <div class="flex items-center gap-3">
        <button @click="fetchLogs" class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors text-slate-500">
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="p-6 border-b shrink-0 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div class="flex items-center gap-4 w-full md:w-auto">
          <div class="flex items-center gap-2">
            <span class="text-xs font-black text-slate-400 uppercase tracking-widest">模块</span>
            <select v-model="moduleFilter" class="px-4 py-2 rounded-xl border outline-none font-bold text-xs" style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)">
              <option v-for="m in modules" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
          </div>
        </div>

        <div class="text-xs font-bold text-slate-400">
          共 {{ total }} 条记录
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-hidden flex flex-col p-8">
      <div class="flex-1 bg-white dark:bg-slate-900 rounded-[2.5rem] border shadow-sm flex flex-col overflow-hidden transition-colors duration-300" style="border-color: var(--border-base)">
        <div class="overflow-x-auto flex-1 scrollbar-hide">
          <table class="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr class="border-b bg-slate-50/50 dark:bg-slate-800/50" style="border-color: var(--border-base)">
                <th class="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">时间</th>
                <th class="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">操作者</th>
                <th class="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">模块</th>
                <th class="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">操作</th>
                <th class="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">描述</th>
                <th class="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">IP地址</th>
              </tr>
            </thead>
            <tbody class="divide-y" style="border-color: var(--border-base)">
              <tr v-if="isLoading" v-for="i in 5" :key="i" class="animate-pulse">
                <td v-for="j in 6" :key="j" class="px-8 py-6"><div class="h-4 bg-slate-100 dark:bg-white/5 rounded w-full"></div></td>
              </tr>
              <tr v-else v-for="log in logs" :key="log.id" class="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                <td class="px-8 py-5">
                  <div class="flex flex-col">
                    <span class="text-xs font-bold" style="color: var(--text-primary)">{{ formatDate(log.createdAt).split(' ')[0] }}</span>
                    <span class="text-[10px] text-slate-400">{{ formatDate(log.createdAt).split(' ')[1] }}</span>
                  </div>
                </td>
                <td class="px-8 py-5">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                      <img v-if="log.user?.avatarUrl" :src="log.user.avatarUrl" class="w-full h-full object-cover" />
                      <UserIcon v-else class="w-4 h-4 text-slate-400" />
                    </div>
                    <div class="flex flex-col min-w-0">
                      <span class="text-xs font-black truncate" style="color: var(--text-primary)">{{ log.user?.name || '系统' }}</span>
                      <span class="text-[10px] text-slate-400 truncate">{{ log.user?.email || 'SYSTEM' }}</span>
                    </div>
                  </div>
                </td>
                <td class="px-8 py-5">
                  <span class="px-2.5 py-1 rounded-lg text-[9px] font-black text-white uppercase tracking-wider" :class="getModuleColor(log.module)">
                    {{ log.module }}
                  </span>
                </td>
                <td class="px-8 py-5">
                  <span class="text-xs font-bold" style="color: var(--text-primary)">{{ getActionLabel(log.action) }}</span>
                </td>
                <td class="px-8 py-5">
                  <p class="text-xs text-slate-500 line-clamp-1 max-w-xs">{{ log.description || '-' }}</p>
                </td>
                <td class="px-8 py-5">
                  <span class="text-[10px] font-mono text-slate-400">{{ log.ipAddress || 'Unknown' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="p-6 border-t flex items-center justify-between bg-slate-50/30 dark:bg-white/5 transition-colors duration-300" style="border-color: var(--border-base)">
          <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            第 {{ currentPage }} / {{ totalPages }} 页
          </div>
          <div class="flex items-center gap-2">
            <button @click="currentPage--" :disabled="currentPage === 1" 
                    class="p-2 rounded-xl border hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 transition-all shadow-sm" style="border-color: var(--border-base)">
              <ChevronLeft class="w-4 h-4" />
            </button>
            <button @click="currentPage++" :disabled="currentPage === totalPages"
                    class="p-2 rounded-xl border hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 transition-all shadow-sm" style="border-color: var(--border-base)">
              <ChevronRight class="w-4 h-4" />
            </button>
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
