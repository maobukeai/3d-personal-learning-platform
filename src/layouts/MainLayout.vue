<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElNotification } from 'element-plus'
import {
  LayoutDashboard, Box, Layers, MapPin, Image as ImageIcon,
  Users, MonitorPlay, MessageSquare, Briefcase, GraduationCap,
  Settings, HelpCircle, ChevronDown, Plus, LogOut, User as UserIcon, CreditCard, Bell,
  ShieldCheck, BarChart3, Database, MessageCircle, Crown, Zap, Notebook, Terminal, FolderTree,
  Search, ExternalLink, Share2
} from 'lucide-vue-next'
import CreateTeamDialog from '@/components/CreateTeamDialog.vue'
import ExploreGroupsDialog from '@/components/ExploreGroupsDialog.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import InvitationDialog from '@/components/InvitationDialog.vue'

import { useAuthStore } from '@/stores/auth'
import { useSystemStore } from '@/stores/system'
import { useWorkspaceStore } from '@/stores/workspace'
import api from '@/utils/api'
import { socketService } from '@/utils/socket'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const systemStore = useSystemStore()
const workspaceStore = useWorkspaceStore()

const adminGroups = computed(() => [
  {
    title: '系统概览',
    items: [
      { name: '平台概览', icon: BarChart3, path: '/admin/dashboard' },
      { name: '审计日志', icon: Terminal, path: '/admin/audit-logs' },
    ]
  },
  {
    title: '用户与团队',
    items: [
      { name: '用户管理', icon: Users, path: '/admin/users' },
      { name: '团队管理', icon: Briefcase, path: '/admin/teams' },
      { name: '用户反馈', icon: MessageCircle, path: '/admin/feedback' },
    ]
  },
  {
    title: '内容审核',
    items: [
      { name: '资产管理', icon: Database, path: '/admin/assets' },
      { name: '材料管理', icon: Layers, path: '/admin/materials' },
      { name: '审核中心', icon: ShieldCheck, path: '/admin/audits' },
    ]
  },
  {
    title: '教学管理',
    items: [
      { name: '课程管理', icon: GraduationCap, path: '/admin/courses' },
      { name: '路线管理', icon: MapPin, path: '/admin/roadmaps' },
      { name: '分类管理', icon: FolderTree, path: '/admin/categories' },
    ]
  },
  {
    title: '运营管理',
    items: [
      { name: '订阅管理', icon: CreditCard, path: '/admin/subscriptions' },
      { name: '系统设置', icon: Settings, path: '/admin/settings' },
    ]
  }
])

const isCreateTeamVisible = ref(false)
const isExploreGroupsVisible = ref(false)
const isInvitationVisible = ref(false)
const isSearchVisible = ref(false)
const searchQuery = ref('')
const activeInvitationId = ref<string | null>(null)

const handleSearch = () => {
  isSearchVisible.value = true
}

const handleShare = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href)
    ElMessage.success('页面链接已复制')
  } catch (err) {
    ElMessage.error('复制失败')
  }
}

const handleExternalLink = () => {
  window.open(window.location.href, '_blank')
}

const handleKeyDown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    handleSearch()
  }
}

const handleTeamCreated = (team: any) => {
  workspaceStore.fetchWorkspaces()
  router.push(`/team/${team.id}`)
}

const handleInvitationSuccess = (data: { accept: boolean, teamId?: string }) => {
  if (data.accept && data.teamId) {
    workspaceStore.fetchWorkspaces()
    router.push(`/team/${data.teamId}`)
  }
}

const handleSwitchWorkspace = (ws: any) => {
  workspaceStore.setWorkspace(ws)
  if (ws.type === 'admin') {
    router.push('/admin/dashboard')
  } else if (ws.type === 'team') {
    router.push(`/team/${ws.id}`)
  } else {
    router.push('/dashboard')
  }
}

const handleQuickSettings = (ws: any) => {
  if (ws.type === 'admin') {
    router.push('/admin/settings')
  } else if (ws.type === 'personal') {
    router.push({ path: '/settings', query: { tab: 'profile' } })
  } else {
    router.push(`/settings/workspace/${ws.id}`)
  }
}

// Watch for workspace changes
watch(() => workspaceStore.activeTeamId, (newId, oldId) => {
  // Navigation is handled by handleSwitchWorkspace
})

const handleProfileClick = (type: string) => {
  if (type === 'profile') {
    router.push({ path: '/settings', query: { tab: 'profile' } })
  } else if (type === 'notifications') {
    router.push('/notifications')
  } else if (type === 'billing') {
    router.push('/billing')
  } else if (type === 'logout') {
    handleLogout()
  }
}

const handleReportBug = () => {
  router.push('/report-bug')
}

const handleLogout = () => {
  socketService.disconnect()
  authStore.logout()
  ElMessage.success('已成功退出登录')
  router.push('/login')
}

const menuGroups = computed(() => {
  if (workspaceStore.isAdminWorkspace) {
    return adminGroups.value
  }
  
  return [
    {
      title: '我的学习',
      items: [
        { name: '仪表盘', icon: LayoutDashboard, path: '/dashboard' },
        { name: t('sidebar.work'), icon: Briefcase, path: '/work' },
        { name: t('sidebar.roadmaps'), icon: MapPin, path: '/roadmaps' },
        { name: t('sidebar.academy'), icon: GraduationCap, path: '/academy' },
        { name: '我的笔记', icon: Notebook, path: '/notes' },
      ]
    },
    {
      title: '团队协作',
      items: [
        { name: t('sidebar.teamTasks'), icon: Briefcase, path: '/team-tasks' },
        { 
          name: t('sidebar.members'), 
          icon: Users, 
          path: workspaceStore.activeTeamId ? `/team/${workspaceStore.activeTeamId}` : '/members' 
        },
      ]
    },
    {
      title: '资源中心',
      items: [
        { name: t('sidebar.myWorks'), icon: Box, path: '/my-works' },
        { name: t('sidebar.assets'), icon: ImageIcon, path: '/assets' },
        { name: t('sidebar.materials'), icon: Layers, path: '/materials' },
      ]
    },
    {
      title: '交流社区',
      items: [
        { name: t('sidebar.discussions'), icon: MessageSquare, path: '/discussions' },
        { name: t('sidebar.messages'), icon: MessageSquare, path: '/messages' },
        { name: t('sidebar.showcase'), icon: MonitorPlay, path: '/showcase' },
      ]
    }
  ]
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
}

const applyAccentColor = (color: string) => {
  const root = document.documentElement
  root.style.setProperty('--accent', color)
  root.style.setProperty('--el-color-primary', color)
  root.style.setProperty('--el-color-primary-light-3', `${color}b3`)
  root.style.setProperty('--el-color-primary-light-5', `${color}80`)
  root.style.setProperty('--el-color-primary-light-9', `${color}1a`)
}

const notifications = ref<any[]>([])
const unreadCount = computed(() => notifications.value.filter(n => !n.isRead).length)

const fetchNotifications = async () => {
  try {
    const response = await api.get('/api/notifications')
    notifications.value = response.data
  } catch (error) {
    console.error('Fetch notifications error:', error)
  }
}

const handleMarkAsRead = async (notification: any) => {
  if (!notification.isRead) {
    try {
      await api.put(`/api/notifications/${notification.id}/read`)
      const n = notifications.value.find(notif => notif.id === notification.id)
      if (n) n.isRead = true
    } catch (error) {
      console.error('Mark as read error:', error)
    }
  }

  // Handle specific notification types
  if (notification.title === '收到团队邀请' && notification.link) {
    const url = new URL(notification.link, window.location.origin)
    const invitationId = url.searchParams.get('invitationId')
    if (invitationId) {
      activeInvitationId.value = invitationId
      isInvitationVisible.value = true
    }
  } else if (notification.link) {
    const resolved = router.resolve(notification.link)
    if (resolved.name) {
      router.push(notification.link)
    } else {
      console.warn('Notification link points to unknown route:', notification.link)
    }
  }
}

const handleMarkAllRead = async () => {
  try {
    await api.put('/api/notifications/read-all')
    notifications.value.forEach(n => n.isRead = true)
    ElMessage.success('已全部标记为已读')
  } catch (error) {
    console.error('Mark all read error:', error)
  }
}

const fetchUnreadMessagesCount = async () => {
  try {
    const response = await api.get('/api/messages/conversations')
    const total = response.data.reduce((acc: number, conv: any) => acc + (conv.unreadCount || 0), 0)
    authStore.setUnreadMessagesCount(total)
  } catch (error) {
    console.error('Fetch unread messages count error:', error)
  }
}

const onNewNotification = (notification: any) => {
  notifications.value.unshift(notification)

  ElNotification({
    title: notification.title,
    message: notification.content,
    type: 'info',
    duration: 5000,
    position: 'top-right',
    onClick: () => {
      if (notification.link) {
        const resolved = router.resolve(notification.link)
        if (resolved.name) {
          router.push(notification.link)
        }
      }
    }
  })
}

const onOnlineUsersList = (ids: string[]) => {
  authStore.setOnlineUsers(ids)
}

const onUserStatus = ({ userId, status }: { userId: string, status: 'online' | 'offline' }) => {
  authStore.updateUserStatus(userId, status)
}

const onMessageReceived = ({ conversationId: _conversationId, message }: any) => {
  const isMessagesPage = route.path === '/messages'

  if (!isMessagesPage) {
    authStore.incrementUnreadMessagesCount()

    ElNotification({
      title: `来自 ${message.sender.name} 的新消息`,
      message: message.type === 'TEXT' ? message.content : '[图片/文件]',
      type: 'success',
      duration: 3000,
      position: 'bottom-right',
      onClick: () => {
        router.push('/messages')
      }
    })
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  socketService.connect()

  const savedTheme = localStorage.getItem('theme') || 'light'
  applyTheme(savedTheme)

  const savedAccent = localStorage.getItem('accentColor') || '#3b82f6'
  applyAccentColor(savedAccent)

  fetchNotifications()
  workspaceStore.initialize(route.path)
  fetchUnreadMessagesCount()
  authStore.fetchMe()

  setInterval(fetchNotifications, 300000)

  socketService.on('new_notification', onNewNotification)
  socketService.on('online_users_list', onOnlineUsersList)
  socketService.on('user_status', onUserStatus)
  socketService.on('message_received', onMessageReceived)
})

// Sync workspace with route
watch(() => route.path, (path) => {
  if (path.startsWith('/team/')) {
    const id = path.split('/')[2]
    workspaceStore.setWorkspaceById(id)
  } else if (path.startsWith('/admin/')) {
    workspaceStore.setWorkspaceById('admin-workspace')
  }
}, { immediate: false })

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  socketService.off('new_notification', onNewNotification)
  socketService.off('message_received', onMessageReceived)
  socketService.off('online_users_list', onOnlineUsersList)
  socketService.off('user_status', onUserStatus)
})
</script>

<template>
  <div class="flex flex-col h-screen w-full overflow-hidden text-sm transition-colors duration-300" style="background-color: var(--bg-app); color: var(--text-primary)">
    <!-- Top Navigation Bar -->
    <header class="topbar h-16 flex items-center justify-between px-6 shrink-0 border-b z-30" style="background-color: var(--bg-sidebar); border-color: var(--border-base)">
      <!-- Left: Workspace Switcher / Logo -->
      <template v-if="!workspaceStore.isInitialized">
        <div class="flex items-center gap-2.5 ml-4 animate-pulse">
          <div class="w-8 h-8 rounded-lg bg-slate-200/50 dark:bg-white/10"></div>
          <div class="w-24 h-4 rounded-md bg-slate-200/50 dark:bg-white/10"></div>
        </div>
      </template>
      <template v-else>
        <el-dropdown trigger="click" placement="bottom-start" v-if="workspaceStore.currentWorkspace">
          <div class="flex items-center gap-2.5 cursor-pointer hover:opacity-80 ml-4 transition-all duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]" 
               :style="{ 
                 transform: `translateX(${
                   workspaceStore.currentWorkspace?.type === 'personal' ? 0 : 
                   workspaceStore.currentWorkspace?.type === 'team' ? 12 : 24
                 }px)` 
               }">
            <div class="w-8 h-8 rounded-lg text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm transition-all duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]" 
                 :class="workspaceStore.isAdminWorkspace ? '' : workspaceStore.currentWorkspace.color"
                 :style="workspaceStore.isAdminWorkspace ? {
                   background: 'linear-gradient(135deg, #fb7185 0%, #e11d48 100%)',
                   boxShadow: '0 4px 12px rgba(225, 29, 72, 0.3)'
                 } : {}">
              {{ workspaceStore.currentWorkspace.name.charAt(0) }}
            </div>
            <span class="text-sm font-bold truncate max-w-[200px] transition-all duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]" 
                  :class="{ 'tracking-wide': workspaceStore.isAdminWorkspace }"
                  style="color: var(--text-primary)">
              {{ workspaceStore.currentWorkspace.name }}
            </span>
            <ChevronDown class="w-4 h-4 text-slate-400 shrink-0 transition-all duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]" 
                         :class="{ 'text-rose-400': workspaceStore.isAdminWorkspace }" />
          </div>
          <template #dropdown>
            <el-dropdown-menu class="w-72 p-2 rounded-2xl border-none shadow-2xl">
              <div class="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">切换工作空间</div>
              <el-dropdown-item 
                v-for="ws in workspaceStore.workspaces" 
                :key="ws.id" 
                @click="handleSwitchWorkspace(ws)" 
                class="rounded-2xl my-1 p-2 group transition-all duration-200"
                :class="workspaceStore.currentWorkspace?.id === ws.id ? 'bg-accent/5' : ''"
              >
                <div class="flex items-center justify-between w-full">
                  <div class="flex items-center gap-3">
                    <!-- 圆形头像 -->
                    <div class="relative">
                      <div class="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-105" :class="ws.color">
                        {{ ws.name.charAt(0) }}
                      </div>
                      <!-- 徽标 -->
                      <div v-if="ws.badgeCount" class="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 px-1">
                        {{ ws.badgeCount > 99 ? '99+' : ws.badgeCount }}
                      </div>
                    </div>
                    <!-- 文字信息 -->
                    <div class="flex flex-col text-left">
                      <span class="font-semibold text-sm" :class="workspaceStore.currentWorkspace?.id === ws.id ? 'text-accent' : 'text-slate-700 dark:text-slate-200'">
                        {{ ws.name }}
                      </span>
                      <span class="text-[10px] text-slate-400">
                        {{ ws.type === 'admin' ? '系统管理中心' : (ws.type === 'personal' ? '个人工作空间' : '团队协作空间') }}
                      </span>
                    </div>
                  </div>
                  <!-- 快捷按钮 -->
                  <div class="flex items-center gap-2">
                    <button 
                      @click.stop="handleQuickSettings(ws)"
                      class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-accent transition-all duration-200 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0"
                    >
                      <Settings class="w-4 h-4" />
                    </button>
                    <div v-if="workspaceStore.currentWorkspace?.id === ws.id" class="w-1.5 h-1.5 rounded-full bg-accent"></div>
                  </div>
                </div>
              </el-dropdown-item>
              <div class="border-t border-slate-100 dark:border-slate-800 my-2"></div>
              <el-dropdown-item class="rounded-xl my-0.5" @click="router.push('/explore-teams')">
                <div class="flex items-center gap-3 py-1 text-slate-500">
                  <Plus class="w-4 h-4" />
                  <span class="font-medium">创建或加入团队</span>
                </div>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <div v-else class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-md bg-accent flex items-center justify-center">
            <Box class="w-4 h-4 text-white" />
          </div>
          <span class="text-sm font-bold" style="color: var(--text-primary)">3D Studio</span>
        </div>
      </template>

      <!-- Center: Search Bar -->
      <div class="topbar-search flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer hover:border-[var(--border-strong)] transition-colors" 
           @click="handleSearch"
           style="background-color: var(--bg-card); border-color: var(--border-base); min-width: 320px;">
        <Search class="w-4 h-4 text-slate-400" />
        <span class="text-xs text-slate-400 flex-1">搜索功能、作品或文档...</span>
        <kbd class="text-[10px] px-2 py-0.5 rounded border font-mono" style="border-color: var(--border-base); color: var(--text-muted)">Ctrl+K</kbd>
      </div>

      <!-- Right: Actions + Avatar -->
      <div class="flex items-center gap-3">
        <!-- Share -->
        <button @click="handleShare" class="topbar-icon-btn w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <Share2 class="w-4.5 h-4.5" style="color: var(--text-muted)" />
        </button>
        <!-- External Link -->
        <button @click="handleExternalLink" class="topbar-icon-btn w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ExternalLink class="w-4.5 h-4.5" style="color: var(--text-muted)" />
        </button>
        <!-- Notification Bell -->
        <el-dropdown trigger="click" placement="bottom-end" popper-class="notification-glass">
          <button class="topbar-icon-btn w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative">
            <Bell class="w-4.5 h-4.5" style="color: var(--text-muted)" />
            <div v-if="unreadCount > 0" class="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900"></div>
          </button>
            <template #dropdown>
              <div class="notification-panel w-80 p-0 rounded-3xl overflow-hidden border border-white/20 dark:border-white/10 shadow-2xl">
                <div class="notification-header px-4 py-3 flex items-center justify-between border-b border-white/10">
                  <span class="text-xs font-bold uppercase tracking-wider text-slate-500/80 dark:text-slate-400/80">通知中心</span>
                  <div class="flex items-center gap-3">
                    <button @click="handleMarkAllRead" class="text-[10px] font-bold text-accent hover:underline">全部忽略</button>
                    <button @click="router.push('/notifications')" class="text-[10px] font-bold text-slate-400 hover:text-accent">查看全部</button>
                  </div>
                </div>
                <div class="max-h-96 overflow-y-auto scrollbar-hide">
                  <div v-for="n in notifications" :key="n.id" @click="handleMarkAsRead(n)" class="notification-item p-4 cursor-pointer transition-colors" :class="!n.isRead ? 'bg-accent/[0.04] dark:bg-accent/[0.08]' : ''">
                    <p class="text-xs font-bold mb-1" :class="!n.isRead ? 'text-accent' : 'text-slate-700/90 dark:text-slate-300/90'">{{ n.title }}</p>
                    <p class="text-[11px] text-slate-500/80 dark:text-slate-400/80 leading-relaxed mb-2">{{ n.content }}</p>
                    <p class="text-[9px] text-slate-400/60 dark:text-slate-500/60">{{ new Date(n.createdAt).toLocaleString() }}</p>
                  </div>
                  <div v-if="notifications.length === 0" class="py-10 text-center text-slate-400/60">
                    <Bell class="w-8 h-8 mx-auto mb-2 opacity-10" />
                    <p class="text-xs">暂无新通知</p>
                  </div>
                </div>
              </div>
            </template>
          </el-dropdown>

        <!-- User Avatar Dropdown -->
        <el-dropdown trigger="click" placement="bottom-end" @command="handleProfileClick">
          <button class="flex items-center gap-0 p-0.5 rounded-full hover:ring-2 hover:ring-accent/30 transition-all cursor-pointer outline-none">
            <UserAvatar :user="authStore.user ?? undefined" size="md" />
          </button>
          <template #dropdown>
            <el-dropdown-menu class="w-56 p-2 rounded-2xl border-none shadow-2xl">
              <div class="px-3 py-2 border-b mb-1" style="border-color: var(--border-base)">
                <p class="text-sm font-bold" style="color: var(--text-primary)">{{ authStore.user?.name || '未命名用户' }}</p>
                <p class="text-[10px]" style="color: var(--text-muted)">{{ authStore.user?.email }}</p>
              </div>
              <el-dropdown-item command="profile" class="rounded-xl my-0.5">
                <div class="flex items-center gap-3 py-1"><UserIcon class="w-4 h-4 text-slate-400" /><span class="font-medium text-slate-600">个人资料</span></div>
              </el-dropdown-item>
              <el-dropdown-item command="notifications" class="rounded-xl my-0.5">
                <div class="flex items-center gap-3 py-1"><Bell class="w-4 h-4 text-slate-400" /><span class="font-medium text-slate-600">消息通知</span></div>
              </el-dropdown-item>
              <el-dropdown-item command="billing" class="rounded-xl my-0.5">
                <div class="flex items-center gap-3 py-1"><CreditCard class="w-4 h-4 text-slate-400" /><span class="font-medium text-slate-600">订阅与账单</span></div>
              </el-dropdown-item>
              <div class="border-t border-slate-100 my-2"></div>
              <el-dropdown-item command="logout" class="rounded-xl my-0.5 text-rose-600">
                <div class="flex items-center gap-3 py-1"><LogOut class="w-4 h-4" /><span class="font-bold">退出登录</span></div>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <div class="flex flex-1 overflow-hidden">
      <!-- Global Sidebar -->
      <aside class="w-60 flex flex-col h-full shrink-0 border-r transition-colors duration-300" style="background-color: var(--bg-sidebar); border-color: var(--border-base)">

        <div class="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-hide">
          <div v-for="(group, index) in menuGroups" :key="index">
            <h3 v-if="group.title" 
                class="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"
                :class="workspaceStore.isAdminWorkspace ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'">
              <ShieldCheck v-if="workspaceStore.isAdminWorkspace" class="w-3 h-3" />
              {{ group.title }}
            </h3>
            <ul class="space-y-1">
              <li v-for="item in group.items" :key="item.name">
                <RouterLink :to="item.path"
                  class="flex items-center justify-between px-3 py-2 rounded-md transition-colors duration-150"
                  :class="route.path === item.path 
                    ? (workspaceStore.isAdminWorkspace ? 'bg-rose-600 text-white font-medium shadow-md' : 'bg-accent-subtle dark:bg-accent/20 text-accent font-medium')
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'">
                  <div class="flex items-center gap-3">
                    <component :is="item.icon" class="w-4 h-4" :class="route.path === item.path ? (workspaceStore.isAdminWorkspace ? 'text-white' : 'text-accent') : 'text-slate-400'" />
                    {{ item.name }}
                  </div>
                  <!-- Unread Badge for Messages -->
                  <div v-if="item.path === '/messages' && authStore.unreadMessagesCount > 0" 
                       class="min-w-[16px] h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                    {{ authStore.unreadMessagesCount }}
                  </div>
                </RouterLink>
              </li>
            </ul>
          </div>
        </div>

        <div class="p-4 border-t space-y-1" style="border-color: var(--border-base)">
          <RouterLink to="/settings" class="flex items-center gap-3 px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 rounded-md transition-colors"
            :class="route.path === '/settings' ? 'bg-accent-subtle dark:bg-accent/20 text-accent' : ''">
            <Settings class="w-4 h-4" :class="route.path === '/settings' ? 'text-accent' : 'text-slate-400'" />
            设置选项
          </RouterLink>
          <button @click="handleReportBug" class="w-full flex items-center gap-3 px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 rounded-md transition-colors">
            <HelpCircle class="w-4 h-4 text-slate-400" />
            问题反馈
          </button>
        </div>
      </aside>

      <!-- Main Content Area -->
      <main class="flex-1 flex flex-col overflow-hidden relative transition-colors duration-300" style="background-color: var(--bg-app)">
        <div v-if="systemStore.settings.MAINTENANCE_MODE && authStore.user?.role === 'ADMIN'" class="bg-rose-600 text-white px-6 py-2 flex items-center justify-between shrink-0 z-50 shadow-lg">
          <div class="flex items-center gap-3">
            <ShieldCheck class="w-4 h-4 animate-pulse" />
            <span class="text-xs font-bold uppercase tracking-wider">系统维护模式已开启 - 仅管理员可访问</span>
          </div>
          <RouterLink to="/admin/settings" class="text-[10px] font-black underline hover:opacity-80 transition-opacity">前往关闭</RouterLink>
        </div>
        <RouterView />
      </main>
    </div>

    <!-- Create Team Dialog -->
    <CreateTeamDialog 
      v-model:visible="isCreateTeamVisible"
      @success="handleTeamCreated"
    />

    <InvitationDialog 
      v-model:visible="isInvitationVisible"
      :invitation-id="activeInvitationId"
      @success="handleInvitationSuccess"
    />

    <ExploreGroupsDialog 
      v-model:visible="isExploreGroupsVisible"
    />

    <!-- Global Search Dialog -->
    <el-dialog
      v-model="isSearchVisible"
      title="全局搜索"
      width="600px"
      top="15vh"
      class="search-dialog custom-rounded-dialog"
      :show-close="false"
    >
      <div class="relative">
        <el-input
          v-model="searchQuery"
          placeholder="搜索作品、素材、课程或文档..."
          size="large"
          clearable
          @keyup.enter="isSearchVisible = false"
        >
          <template #prefix>
            <Search class="w-5 h-5 text-slate-400" />
          </template>
        </el-input>
      </div>
      <div class="mt-4">
        <div class="flex items-center justify-between px-2 mb-2">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">最近搜索</span>
          <el-button link size="small" class="text-[10px]">清空</el-button>
        </div>
        <div class="space-y-1">
          <div class="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors group">
            <Layers class="w-4 h-4 text-slate-400" />
            <span class="text-sm flex-1">3D 模型资源库</span>
            <kbd class="text-[10px] px-1.5 py-0.5 rounded border opacity-0 group-hover:opacity-100 transition-opacity">Enter</kbd>
          </div>
          <div class="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors group">
            <GraduationCap class="w-4 h-4 text-slate-400" />
            <span class="text-sm flex-1">Blender 进阶教程</span>
            <kbd class="text-[10px] px-1.5 py-0.5 rounded border opacity-0 group-hover:opacity-100 transition-opacity">Enter</kbd>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex items-center justify-between text-[10px] text-slate-400">
          <div class="flex gap-4">
            <span class="flex items-center gap-1.5"><kbd class="px-1 py-0.5 rounded border bg-slate-50 dark:bg-slate-900">↵</kbd> 选择</span>
            <span class="flex items-center gap-1.5"><kbd class="px-1 py-0.5 rounded border bg-slate-50 dark:bg-slate-900">↑↓</kbd> 导航</span>
            <span class="flex items-center gap-1.5"><kbd class="px-1 py-0.5 rounded border bg-slate-50 dark:bg-slate-900">esc</kbd> 关闭</span>
          </div>
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
