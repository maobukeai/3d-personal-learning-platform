<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { 
  Users, 
  Shield, 
  Mail, 
  Server, 
  Settings as SettingsIcon,
  Save,
  RefreshCw,
  Search,
  MoreVertical,
  Trash2,
  CheckCircle2,
  AlertCircle
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'

const activeTab = ref('users')
const users = ref<any[]>([])
const isLoading = ref(false)
const searchQuery = ref('')

// System Settings State
const systemSettings = ref({
  SMTP_HOST: '',
  SMTP_PORT: '465',
  SMTP_USER: '',
  SMTP_PASS: '',
  SMTP_FROM: '',
  PLATFORM_NAME: '3D Personal Learning Platform'
})
const isSavingSettings = ref(false)

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

const fetchSettings = async () => {
  try {
    const response = await api.get('/api/admin/settings')
    const settingsMap = response.data.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value
      return acc
    }, {})
    
    // Update local state with fetched values
    Object.keys(systemSettings.value).forEach(key => {
      if (settingsMap[key]) {
        (systemSettings.value as any)[key] = settingsMap[key]
      }
    })
  } catch (error) {
    console.error('Failed to fetch settings')
  }
}

const handleSaveSettings = async () => {
  isSavingSettings.value = true
  try {
    const settingsArray = Object.entries(systemSettings.value).map(([key, value]) => ({
      key, value
    }))
    await api.post('/api/admin/settings', { settings: settingsArray })
    ElMessage.success('系统设置已保存')
  } catch (error) {
    ElMessage.error('保存失败')
  } finally {
    isSavingSettings.value = false
  }
}

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
    `确定要删除用户 ${user.name || user.email} 吗？此操作不可逆。`,
    '警告',
    {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger'
    }
  ).then(async () => {
    try {
      await api.delete(`/api/admin/users/${user.id}`)
      users.value = users.value.filter(u => u.id !== user.id)
      ElMessage.success('用户已删除')
    } catch (error) {
      ElMessage.error('删除失败')
    }
  })
}

onMounted(() => {
  fetchUsers()
  fetchSettings()
})
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
    <!-- Header -->
    <div class="h-16 px-8 border-b flex items-center justify-between shrink-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 transition-colors duration-300">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
          <Shield class="w-6 h-6" />
        </div>
        <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">管理后台</h1>
      </div>
      
      <div class="flex items-center gap-4">
        <div v-if="activeTab === 'users'" class="relative">
          <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="搜索用户..." 
            class="pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 transition-all w-64"
          />
        </div>
        <button @click="fetchUsers" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500">
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Sidebar -->
      <div class="w-64 border-r p-4 space-y-2 shrink-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <button 
          @click="activeTab = 'users'"
          class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all"
          :class="activeTab === 'users' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'"
        >
          <Users class="w-4 h-4" />
          用户管理
        </button>
        <button 
          @click="activeTab = 'settings'"
          class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all"
          :class="activeTab === 'settings' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'"
        >
          <SettingsIcon class="w-4 h-4" />
          系统配置
        </button>
      </div>

      <!-- Panels -->
      <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
        <div class="max-w-6xl mx-auto">
          
          <!-- Users Panel -->
          <div v-if="activeTab === 'users'" class="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <table class="w-full text-left">
                <thead>
                  <tr class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold tracking-widest text-slate-400">
                    <th class="px-6 py-4">用户信息</th>
                    <th class="px-6 py-4">权限角色</th>
                    <th class="px-6 py-4">注册日期</th>
                    <th class="px-6 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr v-for="user in users" :key="user.id" class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td class="px-6 py-4">
                      <div class="flex items-center gap-3">
                        <img :src="user.avatarUrl || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'" class="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-sm" />
                        <div>
                          <p class="text-sm font-bold text-slate-800 dark:text-slate-100">{{ user.name || '未命名' }}</p>
                          <p class="text-xs text-slate-400">{{ user.email }}</p>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4">
                      <el-tag :type="user.role === 'ADMIN' ? 'danger' : 'info'" size="small" class="font-bold">
                        {{ user.role }}
                      </el-tag>
                    </td>
                    <td class="px-6 py-4 text-xs text-slate-500">
                      {{ new Date(user.createdAt).toLocaleDateString() }}
                    </td>
                    <td class="px-6 py-4 text-right">
                      <el-dropdown trigger="click">
                        <button class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                          <MoreVertical class="w-4 h-4 text-slate-400" />
                        </button>
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item @click="handleRoleChange(user, 'USER')">设为普通用户</el-dropdown-item>
                            <el-dropdown-item @click="handleRoleChange(user, 'ADMIN')">设为管理员</el-dropdown-item>
                            <el-dropdown-item divided @click="handleDeleteUser(user)" class="text-rose-600">删除用户</el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div v-if="users.length === 0" class="py-20 flex flex-col items-center text-slate-400">
                <Users class="w-12 h-12 mb-4 opacity-20" />
                <p class="text-sm">暂无用户信息</p>
              </div>
            </div>
          </div>

          <!-- Settings Panel -->
          <div v-else-if="activeTab === 'settings'" class="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-2xl">
            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
              <div class="flex items-center justify-between mb-8">
                <div>
                  <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Mail class="w-5 h-5 text-indigo-600" />
                    SMTP 邮箱配置
                  </h2>
                  <p class="text-xs text-slate-400 mt-1">配置用于发送验证码、找回密码等系统邮件的 SMTP 服务器。</p>
                </div>
              </div>

              <div class="space-y-6">
                <div class="grid grid-cols-2 gap-6">
                  <div class="col-span-1">
                    <label class="block text-xs font-bold text-slate-400 uppercase mb-2">SMTP 服务器</label>
                    <el-input v-model="systemSettings.SMTP_HOST" placeholder="smtp.example.com" />
                  </div>
                  <div class="col-span-1">
                    <label class="block text-xs font-bold text-slate-400 uppercase mb-2">端口</label>
                    <el-input v-model="systemSettings.SMTP_PORT" placeholder="465" />
                  </div>
                  <div class="col-span-2">
                    <label class="block text-xs font-bold text-slate-400 uppercase mb-2">账号 (User)</label>
                    <el-input v-model="systemSettings.SMTP_USER" placeholder="your-email@example.com" />
                  </div>
                  <div class="col-span-2">
                    <label class="block text-xs font-bold text-slate-400 uppercase mb-2">密码 (Password/Auth Token)</label>
                    <el-input v-model="systemSettings.SMTP_PASS" type="password" show-password />
                  </div>
                  <div class="col-span-2">
                    <label class="block text-xs font-bold text-slate-400 uppercase mb-2">发件人地址 (From Email)</label>
                    <el-input v-model="systemSettings.SMTP_FROM" placeholder="no-reply@example.com" />
                  </div>
                </div>

                <div class="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                  <button class="px-6 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2">
                    <AlertCircle class="w-4 h-4" /> 测试连接
                  </button>
                  <button 
                    @click="handleSaveSettings"
                    :disabled="isSavingSettings"
                    class="px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                  >
                    <Save v-if="!isSavingSettings" class="w-4 h-4" />
                    <span v-else class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    {{ isSavingSettings ? '正在保存...' : '保存配置' }}
                  </button>
                </div>
              </div>
            </div>
            
            <div class="mt-8 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-6 flex gap-4">
              <AlertCircle class="w-6 h-6 text-amber-500 shrink-0" />
              <div>
                <p class="text-sm font-bold text-amber-800 dark:text-amber-200">安全提示</p>
                <p class="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                  请确保使用的是专用的发件账号或授权码（如 QQ 邮箱/Gmail 的 APP Password）。不要在此处填写您的登录主密码。
                </p>
              </div>
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
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slide-in-from-bottom-2 {
  from { transform: translateY(0.5rem); }
  to { transform: translateY(0); }
}
.animate-in {
  animation-fill-mode: forwards;
}
.fade-in {
  animation-name: fade-in;
}
.slide-in-from-bottom-2 {
  animation-name: slide-in-from-bottom-2;
}
</style>
