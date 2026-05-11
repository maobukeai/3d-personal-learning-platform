<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { User, Bell, Shield, Palette, Users, Globe, Mail, Camera } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'

const route = useRoute()
const authStore = useAuthStore()
const activeTab = ref('profile')
const isSaving = ref(false)
const isUploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const profileForm = ref({
  name: '',
  email: '',
  bio: '',
  location: '',
  website: ''
})

const securityForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const isChangingPassword = ref(false)

// Email state
const showEmailVerifyDialog = ref(false)
const showChangeEmailDialog = ref(false)
const emailCode = ref('')
const newEmail = ref('')
const isVerifyingEmail = ref(false)
const isSendingCode = ref(false)
const countdown = ref(0)
let timer: any = null

const startCountdown = () => {
  countdown.value = 60
  timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timer)
    }
  }, 1000)
}

const handleSendVerifyCode = async () => {
  if (countdown.value > 0) return
  isSendingCode.value = true
  try {
    await authStore.sendEmailVerification()
    ElMessage.success('验证码已发送')
    showEmailVerifyDialog.value = true
    startCountdown()
    } catch (error) {
    ElMessage.error('发送失败')
    } finally {
    isSendingCode.value = false
  }
}

const handleConfirmVerifyEmail = async () => {
  if (!emailCode.value) return
  isVerifyingEmail.value = true
  try {
    await authStore.verifyEmail(emailCode.value)
    ElMessage.success('邮箱验证成功')
    showEmailVerifyDialog.value = false
    emailCode.value = ''
    countdown.value = 0
    if (timer) clearInterval(timer)
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '验证失败')
  } finally {
    isVerifyingEmail.value = false
  }
}

const handleSendChangeCode = async () => {
  if (!newEmail.value) {
    ElMessage.warning('请输入新邮箱')
    return
  }
  if (countdown.value > 0) return
  isSendingCode.value = true
  try {
    await authStore.sendChangeEmailCode(newEmail.value)
    ElMessage.success('验证码已发送到新邮箱')
    startCountdown()
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '发送失败')
  } finally {
    isSendingCode.value = false
  }
}

const handleChangeEmail = async () => {
  if (!newEmail.value || !emailCode.value) return
  isVerifyingEmail.value = true
  try {
    await authStore.changeEmail(newEmail.value, emailCode.value)
    ElMessage.success('邮箱更换成功')
    showChangeEmailDialog.value = false
    newEmail.value = ''
    emailCode.value = ''
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '更换失败')
  } finally {
    isVerifyingEmail.value = false
  }
}

// 2FA state
const show2FADialog = ref(false)
const qrCodeUrl = ref('')
const twoFactorSecret = ref('')
const twoFactorCode = ref('')
const isEnabling2FA = ref(false)

const handleStart2FASetup = async () => {
  try {
    const data = await authStore.setup2FA()
    qrCodeUrl.value = data.qrCodeUrl
    twoFactorSecret.value = data.secret
    show2FADialog.value = true
  } catch (error: any) {
    ElMessage.error('无法启动两步验证设置')
  }
}

const copySecret = () => {
  navigator.clipboard.writeText(twoFactorSecret.value)
  ElMessage.success('密钥已复制到剪贴板')
}

const handleConfirm2FA = async () => {
  if (!twoFactorCode.value) return
  isEnabling2FA.value = true
  try {
    await authStore.enable2FA(twoFactorCode.value)
    ElMessage.success('两步验证已启用')
    show2FADialog.value = false
    twoFactorCode.value = ''
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '验证码错误')
  } finally {
    isEnabling2FA.value = false
  }
}

const handleToggle2FA = async () => {
  if (authStore.user?.twoFactorEnabled) {
    try {
      await authStore.disable2FA()
      ElMessage.success('两步验证已禁用')
    } catch (error) {
      ElMessage.error('禁用失败')
    }
  } else {
    handleStart2FASetup()
  }
}

// 新增设置项状态
const notificationSettings = ref({
  emailSystem: true,
  emailMarketing: false,
  emailTeam: true,
  pushMentions: true,
  pushMessages: true
})

const appearanceSettings = ref({
  theme: localStorage.getItem('theme') || 'light', // light, dark, system
  accentColor: localStorage.getItem('accentColor') || '#3b82f6',
  sidebarDensity: 'comfortable'
})

const applyTheme = (theme: string) => {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else if (theme === 'light') {
    root.classList.remove('dark')
  } else if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', isDark)
  }
  localStorage.setItem('theme', theme)
}

const applyAccentColor = (color: string) => {
  const root = document.documentElement
  root.style.setProperty('--accent', color)
  root.style.setProperty('--el-color-primary', color)
  
  // Update Element Plus primary light variants (simplified)
  // For a production app, we might use a color library to calculate these
  root.style.setProperty('--el-color-primary-light-3', `${color}b3`) // 70% opacity approx
  root.style.setProperty('--el-color-primary-light-5', `${color}80`) // 50% opacity approx
  root.style.setProperty('--el-color-primary-light-9', `${color}1a`) // 10% opacity approx
  
  localStorage.setItem('accentColor', color)
}

watch(() => appearanceSettings.value.theme, (newTheme) => {
  applyTheme(newTheme)
})

watch(() => appearanceSettings.value.accentColor, (newColor) => {
  applyAccentColor(newColor)
})

onMounted(async () => {
  applyTheme(appearanceSettings.value.theme)
  applyAccentColor(appearanceSettings.value.accentColor)
  if (route.query.tab) {
    activeTab.value = route.query.tab as string
  }
  
  // 初始化表单数据
  if (!authStore.user) {
    await authStore.fetchMe()
  }
  
  if (authStore.user) {
    profileForm.value = {
      name: authStore.user.name || '',
      email: authStore.user.email || '',
      bio: authStore.user.bio || '',
      location: authStore.user.location || '',
      website: authStore.user.website || ''
    }
  }
})

watch(() => route.query.tab, (newTab) => {
  if (newTab) {
    activeTab.value = newTab as string
  }
})

const triggerFileUpload = () => {
  fileInput.value?.click()
}

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    
    // 校验文件大小 (2MB)
    if (file.size > 2 * 1024 * 1024) {
      ElMessage.error('图片大小不能超过 2MB')
      return
    }

    isUploading.value = true
    try {
      await authStore.uploadAvatar(file)
      ElMessage.success('头像更新成功')
    } catch (error: any) {
      ElMessage.error(error.response?.data?.error || '上传失败，请重试')
    } finally {
      isUploading.value = false
    }
  }
}

const handleVisitWebsite = () => {
  if (!profileForm.value.website) {
    ElMessage.warning('请先设置您的个人主页链接')
    return
  }
  
  let url = profileForm.value.website
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url
  }
  
  window.open(url, '_blank')
}

const handleSaveProfile = async () => {
  isSaving.value = true
  try {
    await authStore.updateProfile({
      name: profileForm.value.name,
      bio: profileForm.value.bio,
      location: profileForm.value.location,
      website: profileForm.value.website
    })
    ElMessage.success('个人资料已成功更新')
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '更新失败，请重试')
  } finally {
    isSaving.value = false
  }
}

const handlePasswordChange = async () => {
  if (!securityForm.value.currentPassword || !securityForm.value.newPassword) {
    ElMessage.warning('请填写所有必填项')
    return
  }
  
  if (securityForm.value.newPassword !== securityForm.value.confirmPassword) {
    ElMessage.error('新密码与确认密码不一致')
    return
  }

  isChangingPassword.value = true
  try {
    await authStore.changePassword({
      currentPassword: securityForm.value.currentPassword,
      newPassword: securityForm.value.newPassword
    })
    ElMessage.success('密码已成功修改')
    securityForm.value = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '修改失败，请检查当前密码是否正确')
  } finally {
    isChangingPassword.value = false
  }
}

const teams = ref([
  { id: 1, name: 'Blender 核心开发小组', avatar: 'https://i.pravatar.cc/150?img=11', role: '创建者' },
  { id: 2, name: '三维动画进阶班', avatar: 'https://i.pravatar.cc/150?img=24', role: '成员' }
])

const handleMouseOver = (event: MouseEvent, id: string) => {
  const target = event.currentTarget as HTMLElement
  if (target) {
    target.style.backgroundColor = activeTab.value === id ? 'var(--accent-subtle)' : 'var(--bg-app)'
  }
}

const handleMouseLeave = (event: MouseEvent, id: string) => {
  const target = event.currentTarget as HTMLElement
  if (target) {
    target.style.backgroundColor = activeTab.value === id ? 'var(--accent-subtle)' : 'transparent'
  }
}

const tabs = [
  { id: 'profile', name: '个人资料', icon: User },
  { id: 'notifications', name: '消息通知', icon: Bell },
  { id: 'security', name: '账号安全', icon: Shield },
  { id: 'appearance', name: '界面外观', icon: Palette },
  { id: 'teams', name: '我的团队', icon: Users },
]
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="h-16 px-8 border-b flex items-center justify-between shrink-0 transition-colors duration-300" style="border-color: var(--border-base); background-color: var(--bg-card)">
      <h1 class="text-xl font-bold" style="color: var(--text-primary)">设置选项</h1>
      <button 
        @click="handleSaveProfile"
        :disabled="isSaving"
        class="bg-accent text-white px-6 py-2 rounded-xl text-xs font-bold hover:bg-accent transition-all shadow-md shadow-accent/20 disabled:opacity-50"
      >
        {{ isSaving ? '正在保存...' : '保存更改' }}
      </button>
    </div>

    <!-- Content Layout -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Tabs Sidebar -->
      <div class="w-64 border-r p-4 space-y-1 shrink-0 transition-colors duration-300" style="border-color: var(--border-base); background-color: var(--bg-card)">
        <button v-for="tab in tabs" :key="tab.id"
          @click="activeTab = tab.id"
          class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          :style="activeTab === tab.id ? 'background-color: var(--accent-subtle); color: var(--accent)' : 'color: var(--text-secondary)'"
          @mouseover="handleMouseOver($event, tab.id)"
          @mouseleave="handleMouseLeave($event, tab.id)">
          <component :is="tab.icon" class="w-4 h-4" />
          {{ tab.name }}
        </button>
      </div>

      <!-- Settings Panels -->
      <div class="flex-1 overflow-y-auto p-10 scrollbar-hide">
        <div class="max-w-3xl mx-auto">
          
          <!-- Profile Section -->
          <div v-if="activeTab === 'profile'" class="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm" style="background-color: var(--bg-card); border-color: var(--border-base)">
              <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                <div class="w-1.5 h-6 bg-accent rounded-full"></div>
                个人基本信息
              </h2>
              <div class="flex items-center gap-6 mb-8">
                <div class="relative group">
                  <div class="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden ring-4 ring-slate-50 dark:ring-slate-800/50">
                    <img 
                      :src="authStore.user?.avatarUrl || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'" 
                      class="w-full h-full object-cover" 
                      :class="{ 'opacity-50': isUploading }"
                    />
                  </div>
                  <button @click="triggerFileUpload" :disabled="isUploading" class="absolute inset-0 bg-black/40 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50">
                    <Camera v-if="!isUploading" class="w-6 h-6" />
                    <span v-else class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  </button>
                  <input type="file" ref="fileInput" class="hidden" accept="image/*" @change="handleFileUpload" />
                </div>
                <div>
                  <p class="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">更换头像</p>
                  <p class="text-xs text-slate-400">支持 JPG, PNG. 最大 2MB.</p>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-6">
                <div class="col-span-1">
                  <label class="block text-xs font-bold text-slate-400 uppercase mb-2">显示名称</label>
                  <el-input v-model="profileForm.name" />
                </div>
                <div class="col-span-1">
                  <label class="block text-xs font-bold text-slate-400 uppercase mb-2">电子邮箱</label>
                  <el-input v-model="profileForm.email" :disabled="true">
                    <template #prefix><Mail class="w-3.5 h-3.5" /></template>
                  </el-input>
                </div>
                <div class="col-span-2">
                  <label class="block text-xs font-bold text-slate-400 uppercase mb-2">个人简介</label>
                  <el-input v-model="profileForm.bio" type="textarea" :rows="3" />
                </div>
                <div class="col-span-2">
                  <label class="block text-xs font-bold text-slate-400 uppercase mb-2">所在地区</label>
                  <el-select v-model="profileForm.location" class="w-full">
                    <el-option label="杭州, 中国" value="杭州, 中国" />
                    <el-option label="上海, 中国" value="上海, 中国" />
                    <el-option label="北京, 中国" value="北京, 中国" />
                  </el-select>
                </div>
              </div>
            </div>

            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm" style="background-color: var(--bg-card); border-color: var(--border-base)">
              <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                <div class="w-1.5 h-6 bg-accent rounded-full"></div>
                社交链接
              </h2>
              <div class="space-y-4">
                <div class="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:border-accent-subtle transition-all">
                  <div @click="handleVisitWebsite" class="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:bg-accent hover:border-accent group/icon transition-all shadow-sm">
                    <Globe class="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover/icon:text-white transition-colors" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-slate-700 dark:text-slate-200">个人主页/作品集</p>
                    <input v-model="profileForm.website" placeholder="https://your-portfolio.com" class="w-full bg-transparent text-sm text-slate-500 dark:text-slate-400 focus:outline-none focus:text-accent dark:focus:text-accent transition-colors py-1" />
                  </div>
                  <div class="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-widest group-focus-within:bg-accent-subtle group-focus-within:text-accent transition-colors">
                    {{ profileForm.website ? '已链接' : '未设置' }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Notifications Section -->
          <div v-else-if="activeTab === 'notifications'" class="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm" style="background-color: var(--bg-card); border-color: var(--border-base)">
              <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                <div class="w-1.5 h-6 bg-accent rounded-full"></div>
                邮件通知
              </h2>
              <div class="space-y-6">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm font-bold text-slate-700 dark:text-slate-200">系统更新与公告</p>
                    <p class="text-xs text-slate-400">接收关于平台新功能、维护计划的邮件。</p>
                  </div>
                  <el-switch v-model="notificationSettings.emailSystem" />
                </div>
                <div class="h-px bg-slate-100 dark:bg-slate-800"></div>
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm font-bold text-slate-700 dark:text-slate-200">团队活动通知</p>
                    <p class="text-xs text-slate-400">当您的团队有新动态或任务分配时通知您。</p>
                  </div>
                  <el-switch v-model="notificationSettings.emailTeam" />
                </div>
                <div class="h-px bg-slate-100 dark:bg-slate-800"></div>
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm font-bold text-slate-700 dark:text-slate-200">市场营销与活动</p>
                    <p class="text-xs text-slate-400">接收关于特惠、研讨会及行业资讯的邮件。</p>
                  </div>
                  <el-switch v-model="notificationSettings.emailMarketing" />
                </div>
              </div>
            </div>

            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm" style="background-color: var(--bg-card); border-color: var(--border-base)">
              <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                <div class="w-1.5 h-6 bg-accent rounded-full"></div>
                推送通知
              </h2>
              <div class="space-y-6">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm font-bold text-slate-700 dark:text-slate-200">提及与回复</p>
                    <p class="text-xs text-slate-400">当有人在讨论中提到您或回复您的内容时。</p>
                  </div>
                  <el-switch v-model="notificationSettings.pushMentions" />
                </div>
                <div class="h-px bg-slate-100 dark:bg-slate-800"></div>
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm font-bold text-slate-700 dark:text-slate-200">私信通知</p>
                    <p class="text-xs text-slate-400">当您收到新的私信消息时。</p>
                  </div>
                  <el-switch v-model="notificationSettings.pushMessages" />
                </div>
              </div>
            </div>
          </div>

          <!-- Security Section -->
          <div v-else-if="activeTab === 'security'" class="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm" style="background-color: var(--bg-card); border-color: var(--border-base)">
              <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                <div class="w-1.5 h-6 bg-accent rounded-full"></div>
                修改账户密码
              </h2>
              <div class="grid grid-cols-1 gap-6 max-w-md">
                <div>
                  <label class="block text-xs font-bold text-slate-400 uppercase mb-2">当前密码</label>
                  <el-input v-model="securityForm.currentPassword" type="password" show-password />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-400 uppercase mb-2">新密码</label>
                  <el-input v-model="securityForm.newPassword" type="password" show-password />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-400 uppercase mb-2">确认新密码</label>
                  <el-input v-model="securityForm.confirmPassword" type="password" show-password />
                </div>
                <div class="pt-2">
                  <button @click="handlePasswordChange" :disabled="isChangingPassword" class="bg-accent text-white px-8 py-2.5 rounded-xl text-xs font-bold hover:bg-accent transition-all shadow-md shadow-accent/20 disabled:opacity-50">
                    {{ isChangingPassword ? '正在修改...' : '更新密码' }}
                  </button>
                </div>
              </div>
            </div>

            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm" style="background-color: var(--bg-card); border-color: var(--border-base)">
              <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
                <div class="w-1.5 h-6 bg-accent rounded-full"></div>
                邮箱账户安全
              </h2>
              <p class="text-sm text-slate-500 mb-6 pl-3.5">验证邮箱以确保账户安全并接收重要通知。</p>
              
              <div class="space-y-4">
                <div class="p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm">
                      <Mail class="w-6 h-6" :class="authStore.user?.emailVerified ? 'text-emerald-500' : 'text-slate-400'" />
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <p class="text-sm font-bold text-slate-700 dark:text-slate-200">{{ authStore.user?.email }}</p>
                        <span v-if="authStore.user?.emailVerified" class="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-bold uppercase">已验证</span>
                        <span v-else class="text-[10px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-bold uppercase">待验证</span>
                      </div>
                      <p class="text-xs text-slate-400">{{ authStore.user?.emailVerified ? '主邮箱已通过验证。' : '请尽快验证您的邮箱。' }}</p>
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button v-if="!authStore.user?.emailVerified" @click="handleSendVerifyCode" :disabled="isSendingCode || countdown > 0" class="px-4 py-2 bg-accent text-white rounded-xl text-xs font-bold hover:bg-accent transition-all shadow-sm disabled:opacity-50">
                      {{ isSendingCode ? '发送中...' : (countdown > 0 ? `${countdown}s 后重发` : '立即验证') }}
                    </button>
                    <button @click="showChangeEmailDialog = true" class="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm">
                      更改邮箱
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm" style="background-color: var(--bg-card); border-color: var(--border-base)">
              <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
                <div class="w-1.5 h-6 bg-accent rounded-full"></div>
                两步验证 (2FA)
              </h2>
              <p class="text-sm text-slate-500 mb-6 pl-3.5">为您的账户添加额外的安全层。</p>
              <div class="p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-between" :class="{ 'border-accent-subtle dark:border-blue-900/50 bg-accent-subtle/30 bg-accent-subtle': authStore.user?.twoFactorEnabled }">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm" :class="authStore.user?.twoFactorEnabled ? 'text-accent dark:text-accent' : 'text-slate-400'">
                    <Shield class="w-6 h-6" />
                  </div>
                  <div>
                    <p class="text-sm font-bold text-slate-700 dark:text-slate-200">{{ authStore.user?.twoFactorEnabled ? '已启用' : '尚未启用' }}</p>
                    <p class="text-xs text-slate-400">{{ authStore.user?.twoFactorEnabled ? '您的账户目前受到双重验证保护。' : '启用后，登录时将需要输入验证码。' }}</p>
                  </div>
                </div>
                <button 
                  @click="handleToggle2FA"
                  class="px-6 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm"
                  :class="authStore.user?.twoFactorEnabled ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 border-rose-100 dark:border-rose-900/50' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'"
                >
                  {{ authStore.user?.twoFactorEnabled ? '禁用验证' : '立即启用' }}
                </button>
              </div>
            </div>
          </div>

          <div v-else-if="activeTab === 'appearance'" class="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm" style="background-color: var(--bg-card); border-color: var(--border-base)">
              <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                <div class="w-1.5 h-6 bg-accent rounded-full"></div>
                主题模式
              </h2>
              <div class="grid grid-cols-3 gap-4">
                <button v-for="t in ['light', 'dark', 'system']" :key="t" @click="appearanceSettings.theme = t" class="flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all" :class="appearanceSettings.theme === t ? 'border-accent bg-accent-subtle/50 bg-accent-subtle' : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30'">
                  <div class="w-full aspect-video rounded-lg flex items-center justify-center" :class="t === 'dark' ? 'bg-slate-800' : 'bg-white border border-slate-200 dark:border-slate-700'">
                    <Palette class="w-6 h-6" :class="t === 'dark' ? 'text-slate-500' : 'text-slate-300'" />
                  </div>
                  <span class="text-xs font-bold capitalize text-slate-600 dark:text-slate-400">{{ t === 'light' ? '明亮模式' : t === 'dark' ? '暗黑模式' : '跟随系统' }}</span>
                </button>
              </div>
            </div>

            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm" style="background-color: var(--bg-card); border-color: var(--border-base)">
              <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                <div class="w-1.5 h-6 bg-accent rounded-full"></div>
                强调色 (Accent Color)
              </h2>
              <div class="flex gap-4">
                <button v-for="color in ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']" :key="color" @click="appearanceSettings.accentColor = color" class="w-8 h-8 rounded-full border-4 transition-all" :style="{ backgroundColor: color }" :class="appearanceSettings.accentColor === color ? 'border-white dark:border-slate-900 ring-2 ring-accent' : 'border-transparent opacity-60 hover:opacity-100'"></button>
              </div>
            </div>
          </div>

          <!-- Teams Section -->
          <div v-else-if="activeTab === 'teams'" class="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm" style="background-color: var(--bg-card); border-color: var(--border-base)">
              <div class="flex items-center justify-between mb-8">
                <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <div class="w-1.5 h-6 bg-accent rounded-full"></div>
                  我加入的团队
                </h2>
                <button class="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-xs font-bold hover:bg-accent transition-all shadow-md shadow-accent/20">
                  <Plus class="w-3.5 h-3.5" /> 创建新团队
                </button>
              </div>
              <div class="space-y-4">
                <div v-for="team in teams" :key="team.id" class="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl hover:bg-white dark:hover:bg-slate-800 hover:border-accent-subtle dark:hover:border-blue-900 transition-all">
                  <div class="flex items-center gap-4">
                    <img :src="team.avatar" class="w-12 h-12 rounded-xl object-cover shadow-sm border border-slate-100 dark:border-slate-700" />
                    <div>
                      <p class="text-sm font-bold text-slate-700 dark:text-slate-200">{{ team.name }}</p>
                      <p class="text-xs text-slate-400">您的角色: <span class="text-accent font-medium">{{ team.role }}</span></p>
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button class="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                      管理
                    </button>
                    <button class="px-4 py-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/50 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white transition-all">
                      退出
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 2FA Setup Dialog -->
  <el-dialog
    v-model="show2FADialog"
    title="设置两步验证"
    width="400px"
    center
    class="rounded-3xl dark:bg-slate-900"
  >
    <div class="flex flex-col items-center text-center space-y-6 py-4">
      <p class="text-sm text-slate-500 dark:text-slate-400">请使用 Google Authenticator 或 Microsoft Authenticator 扫描下方二维码：</p>
      
      <div class="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <img :src="qrCodeUrl" class="w-48 h-48" alt="2FA QR Code" />
      </div>

      <div class="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
        <p class="text-[10px] text-slate-400 uppercase font-bold mb-1">无法扫描？手动输入密钥：</p>
        <div class="flex items-center justify-between">
          <code class="text-xs font-mono text-accent dark:text-accent font-bold tracking-wider">{{ twoFactorSecret }}</code>
          <button @click="copySecret" class="text-[10px] bg-white dark:bg-slate-800 border px-2 py-1 rounded-md hover:bg-slate-100 transition-colors">复制</button>
        </div>
      </div>
      
      <div class="w-full space-y-2">
        <label class="block text-xs font-bold text-slate-400 uppercase text-left pl-1">输入验证码</label>
        <el-input 
          v-model="twoFactorCode" 
          placeholder="请输入 6 位动态验证码" 
          maxlength="6"
          class="text-center"
        />
      </div>
    </div>
    <template #footer>
      <div class="flex gap-4">
        <button 
          @click="show2FADialog = false"
          class="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          取消
        </button>
        <button 
          @click="handleConfirm2FA"
          :disabled="!twoFactorCode || isEnabling2FA"
          class="flex-1 px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-bold hover:bg-accent transition-all shadow-md shadow-accent/20 disabled:opacity-50"
        >
          {{ isEnabling2FA ? '验证中...' : '确认开启' }}
        </button>
      </div>
    </template>
  </el-dialog>

  <!-- Email Verify Dialog -->
  <el-dialog
    v-model="showEmailVerifyDialog"
    title="验证电子邮箱"
    width="400px"
    center
    class="rounded-3xl dark:bg-slate-900"
  >
    <div class="flex flex-col items-center text-center space-y-6 py-4">
      <p class="text-sm text-slate-500 dark:text-slate-400">验证码已发送至：<br/><span class="font-bold text-slate-800 dark:text-slate-200">{{ authStore.user?.email }}</span></p>
      
      <div class="w-full space-y-2">
        <label class="block text-xs font-bold text-slate-400 uppercase text-left pl-1">输入 6 位验证码</label>
        <el-input 
          v-model="emailCode" 
          placeholder="000000" 
          maxlength="6"
          class="text-center font-bold tracking-[0.5em]"
        />
      </div>
    </div>
    <template #footer>
      <div class="flex gap-4">
        <button @click="showEmailVerifyDialog = false" class="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">取消</button>
        <button @click="handleConfirmVerifyEmail" :disabled="!emailCode || isVerifyingEmail" class="flex-1 px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-bold hover:bg-accent transition-all shadow-md disabled:opacity-50">
          {{ isVerifyingEmail ? '验证中...' : '确认验证' }}
        </button>
      </div>
    </template>
  </el-dialog>

  <!-- Change Email Dialog -->
  <el-dialog
    v-model="showChangeEmailDialog"
    title="更改电子邮箱"
    width="400px"
    center
    class="rounded-3xl dark:bg-slate-900"
  >
    <div class="flex flex-col items-center text-center space-y-5 py-4">
      <div class="w-full space-y-2">
        <label class="block text-xs font-bold text-slate-400 uppercase text-left pl-1">新电子邮箱</label>
        <el-input v-model="newEmail" placeholder="new-email@example.com">
          <template #append>
            <button @click="handleSendChangeCode" :disabled="isSendingCode || !newEmail || countdown > 0" class="text-accent font-bold text-xs px-2 disabled:text-slate-400">
              {{ isSendingCode ? '发送中' : (countdown > 0 ? `${countdown}s` : '获取验证码') }}
            </button>
          </template>
        </el-input>
      </div>
      
      <div class="w-full space-y-2">
        <label class="block text-xs font-bold text-slate-400 uppercase text-left pl-1">验证码 (已发至新邮箱)</label>
        <el-input 
          v-model="emailCode" 
          placeholder="请输入验证码" 
          maxlength="6"
        />
      </div>
    </div>
    <template #footer>
      <div class="flex gap-4">
        <button @click="showChangeEmailDialog = false" class="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">取消</button>
        <button @click="handleChangeEmail" :disabled="!newEmail || !emailCode || isVerifyingEmail" class="flex-1 px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-bold hover:bg-accent transition-all shadow-md disabled:opacity-50">
          {{ isVerifyingEmail ? '提交更改...' : '确认更改' }}
        </button>
      </div>
    </template>
  </el-dialog>
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
