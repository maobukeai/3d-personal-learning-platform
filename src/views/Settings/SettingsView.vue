<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { 
  User, 
  Lock, 
  ShieldCheck, 
  Mail, 
  MapPin, 
  Globe, 
  Camera,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Fingerprint,
  Bell,
  Palette,
  Users,
  Plus,
  Monitor,
  Sun,
  Moon,
  ExternalLink
} from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'

const route = useRoute()
const authStore = useAuthStore()
const activeSection = ref('profile')

const profileForm = ref({
  name: authStore.user?.name || '',
  bio: authStore.user?.bio || '',
  location: authStore.user?.location || '',
  website: authStore.user?.website || ''
})

const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const is2FALoading = ref(false)
const qrCodeUrl = ref('')
const tfaCode = ref('')
const show2FASetup = ref(false)

// Appearance State
const currentTheme = ref(localStorage.getItem('theme') || 'light')
const currentAccent = ref(localStorage.getItem('accentColor') || '#3b82f6')
const accentColors = [
  { name: '蓝色', value: '#3b82f6' },
  { name: '紫色', value: '#8b5cf6' },
  { name: '粉色', value: '#ec4899' },
  { name: '翠绿', value: '#10b981' },
  { name: '橙色', value: '#f59e0b' },
  { name: '靛青', value: '#6366f1' }
]

// Teams State
const myTeams = ref<any[]>([])
const isLoadingTeams = ref(false)

const handleUpdateProfile = async () => {
  try {
    await authStore.updateProfile(profileForm.value)
    ElMessage.success('个人资料已更新')
  } catch (error) {
    ElMessage.error('更新失败')
  }
}

const handleChangePassword = async () => {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    ElMessage.warning('两次输入的新密码不一致')
    return
  }
  try {
    await authStore.changePassword({
      currentPassword: passwordForm.value.currentPassword,
      newPassword: passwordForm.value.newPassword
    })
    ElMessage.success('密码已成功修改')
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '修改密码失败')
  }
}

const handleAvatarUpload = async (e: any) => {
  const file = e.target.files[0]
  if (!file) return
  try {
    await authStore.uploadAvatar(file)
    ElMessage.success('头像已更新')
  } catch (error) {
    ElMessage.error('头像上传失败')
  }
}

const start2FASetup = async () => {
  is2FALoading.value = true
  try {
    const data = await authStore.setup2FA()
    qrCodeUrl.value = data.qrCodeUrl
    show2FASetup.value = true
  } catch (error) {
    ElMessage.error('无法启动两步验证设置')
  } finally {
    is2FALoading.value = false
  }
}

const confirm2FA = async () => {
  try {
    await authStore.enable2FA(tfaCode.value)
    ElMessage.success('两步验证已成功启用')
    show2FASetup.value = false
    tfaCode.value = ''
  } catch (error) {
    ElMessage.error('验证码错误')
  }
}

const disable2FA = async () => {
  try {
    await authStore.disable2FA()
    ElMessage.success('两步验证已禁用')
  } catch (error) {
    ElMessage.error('禁用失败')
  }
}

const applyTheme = (theme: string) => {
  currentTheme.value = theme
  localStorage.setItem('theme', theme)
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else if (theme === 'light') {
    root.classList.remove('dark')
  } else if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', isDark)
  }
}

const applyAccentColor = (color: string) => {
  currentAccent.value = color
  localStorage.setItem('accentColor', color)
  const root = document.documentElement
  root.style.setProperty('--accent', color)
  root.style.setProperty('--el-color-primary', color)
  // Simplified light variants calculation
  root.style.setProperty('--el-color-primary-light-3', `${color}b3`)
  root.style.setProperty('--el-color-primary-light-5', `${color}80`)
  root.style.setProperty('--el-color-primary-light-9', `${color}1a`)
}

const fetchMyTeams = async () => {
  isLoadingTeams.value = true
  try {
    const response = await api.get('/api/teams')
    myTeams.value = response.data
  } catch (error) {
    console.error('Fetch teams error:', error)
  } finally {
    isLoadingTeams.value = false
  }
}

const sections = [
  { id: 'profile', label: '个人资料', icon: User },
  { id: 'notifications', label: '消息通知', icon: Bell },
  { id: 'security', label: '账号安全', icon: ShieldCheck },
  { id: 'appearance', label: '界面外观', icon: Palette },
  { id: 'teams', label: '我的团队', icon: Users },
]

watch(() => authStore.user, (newUser) => {
  if (newUser) {
    profileForm.value = {
      name: newUser.name || '',
      bio: newUser.bio || '',
      location: newUser.location || '',
      website: newUser.website || ''
    }
  }
}, { immediate: true })

onMounted(() => {
  if (route.query.tab) {
    activeSection.value = route.query.tab as string
  }
  if (activeSection.value === 'teams') {
    fetchMyTeams()
  }
})

watch(() => route.query.tab, (newTab) => {
  if (newTab) activeSection.value = newTab as string
})

watch(activeSection, (newSection) => {
  if (newSection === 'teams' && myTeams.value.length === 0) {
    fetchMyTeams()
  }
})
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="h-16 px-8 flex items-center justify-between shrink-0 border-b transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold" style="color: var(--text-primary)">账户设置</h1>
      </div>
    </div>

    <div class="flex-1 flex overflow-hidden">
      <!-- Sidebar Nav -->
      <div class="w-64 border-r shrink-0 overflow-y-auto p-4 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
        <div class="px-4 mb-4">
          <h2 class="text-xs font-black uppercase tracking-[0.2em] text-slate-400">设置选项</h2>
        </div>
        <nav class="space-y-1">
          <button 
            v-for="section in sections" 
            :key="section.id"
            @click="activeSection = section.id"
            class="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all"
            :class="activeSection === section.id ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <component :is="section.icon" class="w-4 h-4" />
              {{ section.label }}
            </div>
            <ChevronRight class="w-3.5 h-3.5 opacity-50" />
          </button>
        </nav>
      </div>

      <!-- Main Content -->
      <div class="flex-1 overflow-y-auto p-12 scrollbar-hide">
        <div class="max-w-2xl mx-auto">
          
          <!-- Profile Section -->
          <div v-if="activeSection === 'profile'" class="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div class="flex items-center gap-8">
              <div class="relative group">
                <div class="w-24 h-24 rounded-3xl overflow-hidden bg-slate-100 dark:bg-white/5 border-2 border-white dark:border-slate-800 shadow-xl">
                  <img v-if="authStore.user?.avatarUrl" :src="authStore.user.avatarUrl" class="w-full h-full object-cover" />
                  <div v-else class="w-full h-full flex items-center justify-center text-slate-400">
                    <User class="w-10 h-10" />
                  </div>
                </div>
                <label class="absolute -bottom-2 -right-2 p-2 bg-accent text-white rounded-xl shadow-lg cursor-pointer hover:scale-110 transition-transform">
                  <Camera class="w-4 h-4" />
                  <input type="file" class="hidden" accept="image/*" @change="handleAvatarUpload" />
                </label>
              </div>
              <div>
                <h2 class="text-xl font-bold" style="color: var(--text-primary)">个人形象</h2>
                <p class="text-xs mt-1" style="color: var(--text-secondary)">建议上传 500x500px 以上的 JPG 或 PNG 格式图片</p>
              </div>
            </div>

            <div class="space-y-6">
              <div class="grid grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">昵称</label>
                  <input v-model="profileForm.name" type="text" class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20" style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-primary)" />
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">所在地</label>
                  <div class="relative">
                    <MapPin class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input v-model="profileForm.location" type="text" class="w-full pl-11 pr-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20" style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-primary)" placeholder="城市, 国家" />
                  </div>
                </div>
              </div>

              <div class="space-y-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">个人简介</label>
                <textarea v-model="profileForm.bio" rows="4" class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none" style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-primary)" placeholder="向大家介绍一下你自己吧..."></textarea>
              </div>

              <div class="space-y-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">个人主页/作品集</label>
                <div class="relative">
                  <Globe class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input v-model="profileForm.website" type="text" class="w-full pl-11 pr-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20" style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-primary)" placeholder="https://yourportfolio.com" />
                </div>
              </div>

              <div class="pt-4">
                <button @click="handleUpdateProfile" class="px-8 py-3 bg-accent text-white font-bold rounded-2xl shadow-xl shadow-accent/20 hover:scale-105 transition-all">保存更改</button>
              </div>
            </div>
          </div>

          <!-- Notifications Section -->
          <div v-if="activeSection === 'notifications'" class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <!-- Email Notifications -->
             <div class="p-8 rounded-3xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
               <div class="flex items-center gap-3 mb-8">
                 <div class="w-1.5 h-6 bg-accent rounded-full"></div>
                 <h3 class="text-lg font-bold" style="color: var(--text-primary)">邮件通知</h3>
               </div>
               
               <div class="space-y-8">
                 <div v-for="item in [
                   { title: '系统更新与公告', desc: '接收关于平台新功能、维护计划的邮件。', status: true },
                   { title: '团队活动通知', desc: '当您的团队有新动态或任务分配时通知您。', status: true },
                   { title: '市场营销与活动', desc: '接收关于特惠、研讨会及行业资讯的邮件。', status: false }
                 ]" :key="item.title" class="flex items-center justify-between">
                   <div class="space-y-1">
                     <p class="text-sm font-bold" style="color: var(--text-primary)">{{ item.title }}</p>
                     <p class="text-[11px]" style="color: var(--text-secondary)">{{ item.desc }}</p>
                   </div>
                   <el-switch v-model="item.status" active-color="var(--accent)" />
                 </div>
               </div>
             </div>

             <!-- Push Notifications -->
             <div class="p-8 rounded-3xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
               <div class="flex items-center gap-3 mb-8">
                 <div class="w-1.5 h-6 bg-accent rounded-full"></div>
                 <h3 class="text-lg font-bold" style="color: var(--text-primary)">推送通知</h3>
               </div>
               
               <div class="space-y-8">
                 <div v-for="item in [
                   { title: '提及与回复', desc: '当有人在讨论中提到您或回复您的内容时。', status: true },
                   { title: '私信通知', desc: '当您收到新的私信消息时。', status: true }
                 ]" :key="item.title" class="flex items-center justify-between">
                   <div class="space-y-1">
                     <p class="text-sm font-bold" style="color: var(--text-primary)">{{ item.title }}</p>
                     <p class="text-[11px]" style="color: var(--text-secondary)">{{ item.desc }}</p>
                   </div>
                   <el-switch v-model="item.status" active-color="var(--accent)" />
                 </div>
               </div>
             </div>
          </div>

          <!-- Security Section -->
          <div v-if="activeSection === 'security'" class="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <!-- Password Change -->
            <div class="p-8 rounded-3xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
              <div class="flex items-center gap-3 mb-8">
                <div class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600">
                  <Lock class="w-5 h-5" />
                </div>
                <h3 class="text-lg font-bold" style="color: var(--text-primary)">修改密码</h3>
              </div>

              <div class="space-y-6">
                <div class="space-y-2">
                  <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">当前密码</label>
                  <input v-model="passwordForm.currentPassword" type="password" class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20" style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
                </div>
                <div class="grid grid-cols-2 gap-6">
                  <div class="space-y-2">
                    <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">新密码</label>
                    <input v-model="passwordForm.newPassword" type="password" class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20" style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
                  </div>
                  <div class="space-y-2">
                    <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">确认新密码</label>
                    <input v-model="passwordForm.confirmPassword" type="password" class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20" style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
                  </div>
                </div>
                <div class="pt-2">
                  <button @click="handleChangePassword" class="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl hover:opacity-80 transition-all">更新密码</button>
                </div>
              </div>
            </div>

            <!-- Two Factor Auth -->
            <div class="p-8 rounded-3xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
              <div class="flex items-center justify-between mb-8">
                <div class="flex items-center gap-3">
                  <div class="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600">
                    <Fingerprint class="w-5 h-5" />
                  </div>
                  <div>
                    <h3 class="text-lg font-bold" style="color: var(--text-primary)">两步验证 (2FA)</h3>
                    <p class="text-[10px] font-medium text-slate-400 mt-0.5">为你的账号增加额外安全屏障</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="authStore.user?.twoFactorEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'">
                    {{ authStore.user?.twoFactorEnabled ? '已启用' : '未启用' }}
                  </span>
                </div>
              </div>

              <div v-if="!authStore.user?.twoFactorEnabled">
                <p class="text-xs leading-relaxed mb-6" style="color: var(--text-secondary)">
                  启用两步验证后，在登录时除了输入密码，还需要输入手机身份验证器（如 Google Authenticator）生成的动态验证码。
                </p>
                <button v-if="!show2FASetup" @click="start2FASetup" class="w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-500 hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-2">
                  <Plus class="w-4 h-4" /> 开启两步验证
                </button>

                <div v-else class="space-y-6 animate-in zoom-in-95 duration-300">
                  <div class="flex flex-col md:flex-row gap-8 items-center bg-slate-50 dark:bg-white/5 p-6 rounded-2xl">
                    <div class="p-2 bg-white rounded-xl shadow-lg">
                      <img :src="qrCodeUrl" class="w-32 h-32" />
                    </div>
                    <div class="flex-1 space-y-3">
                      <p class="text-xs font-bold">1. 扫描二维码</p>
                      <p class="text-[10px] text-slate-500 leading-relaxed">使用手机上的 Authenticator App 扫描左侧二维码。如果无法扫描，可以手动输入密钥。</p>
                      <div class="flex gap-2">
                        <input v-model="tfaCode" type="text" maxlength="6" class="flex-1 px-4 py-2 rounded-xl border text-sm text-center font-black tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="000000" />
                        <button @click="confirm2FA" class="px-6 py-2 bg-accent text-white font-bold rounded-xl text-xs">验证并启用</button>
                      </div>
                    </div>
                  </div>
                  <button @click="show2FASetup = false" class="text-xs text-slate-400 hover:text-slate-600">取消设置</button>
                </div>
              </div>

              <div v-else class="space-y-6">
                <div class="flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/20">
                   <CheckCircle2 class="w-5 h-5 text-emerald-500" />
                   <p class="text-xs text-emerald-800 dark:text-emerald-400 font-medium">您的账号正在受到两步验证的保护。</p>
                </div>
                <button @click="disable2FA" class="text-xs font-bold text-rose-500 hover:underline">关闭两步验证</button>
              </div>
            </div>
          </div>

          <!-- Appearance Section -->
          <div v-if="activeSection === 'appearance'" class="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div class="p-8 rounded-3xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
              <h3 class="text-lg font-bold mb-6" style="color: var(--text-primary)">外观模式</h3>
              <div class="grid grid-cols-3 gap-4">
                <button 
                  v-for="theme in [
                    { id: 'light', label: '亮色', icon: Sun },
                    { id: 'dark', label: '暗色', icon: Moon },
                    { id: 'system', label: '系统', icon: Monitor }
                  ]" 
                  :key="theme.id"
                  @click="applyTheme(theme.id)"
                  class="flex flex-col items-center gap-3 p-6 rounded-2xl border transition-all"
                  :class="currentTheme === theme.id ? 'border-accent bg-accent/5 ring-1 ring-accent' : 'hover:bg-slate-50 dark:hover:bg-white/5'"
                  style="border-color: currentTheme === theme.id ? 'var(--accent)' : 'var(--border-base)'"
                >
                  <component :is="theme.icon" class="w-6 h-6" :class="currentTheme === theme.id ? 'text-accent' : 'text-slate-400'" />
                  <span class="text-xs font-bold" :class="currentTheme === theme.id ? 'text-accent' : 'text-slate-600 dark:text-slate-400'">{{ theme.label }}</span>
                </button>
              </div>
            </div>

            <div class="p-8 rounded-3xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
              <h3 class="text-lg font-bold mb-6" style="color: var(--text-primary)">主题色</h3>
              <div class="flex flex-wrap gap-4">
                <button 
                  v-for="color in accentColors" 
                  :key="color.value"
                  @click="applyAccentColor(color.value)"
                  class="w-12 h-12 rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  :style="{ backgroundColor: color.value }"
                >
                  <div v-if="currentAccent === color.value" class="w-2 h-2 rounded-full bg-white shadow-sm"></div>
                </button>
              </div>
              <p class="text-[10px] text-slate-400 mt-6">选择一个你喜欢的颜色，它将作为平台的主要按钮 and 交互高亮色。</p>
            </div>
          </div>

          <!-- Teams Section -->
          <div v-if="activeSection === 'teams'" class="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-xl font-bold" style="color: var(--text-primary)">我的团队</h2>
                <p class="text-xs mt-1" style="color: var(--text-secondary)">管理你创建或加入的所有协作团队</p>
              </div>
            </div>

            <div v-if="isLoadingTeams" class="space-y-4">
              <div v-for="i in 3" :key="i" class="h-24 rounded-3xl bg-slate-100 dark:bg-white/5 animate-pulse"></div>
            </div>

            <div v-else-if="myTeams.length > 0" class="grid gap-4">
              <div v-for="team in myTeams" :key="team.id" class="p-6 rounded-3xl border flex items-center justify-between transition-all hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-none" style="background-color: var(--bg-card); border-color: var(--border-base)">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-bold text-lg">
                    {{ team.name.charAt(0) }}
                  </div>
                  <div>
                    <h3 class="font-bold" style="color: var(--text-primary)">{{ team.name }}</h3>
                    <div class="flex items-center gap-3 mt-1">
                      <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500">{{ team._count?.members || 0 }} 名成员</span>
                      <span v-if="team.ownerId === authStore.user?.id" class="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-bold">创建者</span>
                    </div>
                  </div>
                </div>
                <RouterLink :to="`/team/${team.id}`" class="p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 hover:text-accent transition-all">
                  <ExternalLink class="w-5 h-5" />
                </RouterLink>
              </div>
            </div>

            <div v-else class="text-center py-20 border-2 border-dashed rounded-3xl transition-colors duration-300" style="border-color: var(--border-base)">
              <div class="w-16 h-16 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users class="w-8 h-8 text-slate-300" />
              </div>
              <h3 class="text-sm font-bold mb-1" style="color: var(--text-primary)">暂无团队</h3>
              <p class="text-xs text-slate-400 mb-6">你还没有加入任何团队，快去创建一个吧！</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar { display: none; }
.animate-in { animation: animate-in 0.5s ease-out; }
@keyframes animate-in {
  from { opacity: 0; transform: translateY(1rem); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
