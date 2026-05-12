<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElNotification } from 'element-plus'
import {
  LayoutDashboard, Box, Layers, MapPin, Image as ImageIcon,
  Users, MonitorPlay, MessageSquare, Briefcase, GraduationCap,
  Settings, HelpCircle, ChevronDown, Plus, LogOut, User as UserIcon, CreditCard, Bell,
  ShieldCheck, BarChart3, Database, MessageCircle, Crown, Zap, Notebook
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

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const systemStore = useSystemStore()
const workspaceStore = useWorkspaceStore()

const adminGroups = [
  {
    title: '系统管理',
    items: [
      { name: '平台概览', icon: BarChart3, path: '/admin/dashboard' },
      { name: '用户管理', icon: Users, path: '/admin/users' },
      { name: '用户反馈', icon: MessageCircle, path: '/admin/feedback' },
      { name: '资产审核', icon: Database, path: '/admin/assets' },
      { name: '材料审核', icon: Layers, path: '/admin/materials' },
      { name: '订阅管理', icon: CreditCard, path: '/admin/subscriptions' },
      { name: '系统设置', icon: Settings, path: '/admin/settings' },
    ]
  }
]

const isCreateTeamVisible = ref(false)
const isExploreGroupsVisible = ref(false)
const isInvitationVisible = ref(false)
const activeInvitationId = ref<string | null>(null)

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
  if (ws.type === 'team') {
    router.push(`/team/${ws.id}`)
  } else {
    router.push('/dashboard')
  }
}

// Watch for workspace changes to refresh data if needed
watch(() => workspaceStore.activeTeamId, (newId, oldId) => {
  if (oldId && newId !== oldId) {
    const currentPath = route.path
    const workspaceAwarePaths = [
      '/dashboard', '/assets', '/my-works', '/work', '/team-tasks',
      '/materials', '/showcase', '/members', '/discussions'
    ]
    if (workspaceAwarePaths.some(path => currentPath.startsWith(path))) {
       window.location.reload()
    }
  }
})

const handleProfileClick = (type: string) => {
  if (type === 'profile') {
    router.push({ path: '/settings', query: { tab: 'profile' } })
  } else if (type === 'notifications') {
    router.push({ path: '/settings', query: { tab: 'notifications' } })
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

const menuGroups = computed(() => [
  {
    title: '我的学习',
    items: [
      { name: '仪表盘', icon: LayoutDashboard, path: '/dashboard' },
      { name: '工作与计划', icon: Briefcase, path: '/work' },
      { name: '学习路线', icon: MapPin, path: '/roadmaps' },
      { name: '学院课程', icon: GraduationCap, path: '/academy' },
      { name: '我的笔记', icon: Notebook, path: '/notes' },
    ]
  },
  {
    title: '团队协作',
    items: [
      { name: '团队任务', icon: Briefcase, path: '/team-tasks' },
      { 
        name: '成员', 
        icon: Users, 
        path: workspaceStore.activeTeamId ? `/team/${workspaceStore.activeTeamId}` : '/members' 
      },
    ]
  },
  {
    title: '资源中心',
    items: [
      { name: '我的作品', icon: Box, path: '/my-works' },
      { name: '3D 资产库', icon: ImageIcon, path: '/assets' },
      { name: '材料', icon: Layers, path: '/materials' },
    ]
  },
  {
    title: '交流社区',
    items: [
      { name: '讨论区', icon: MessageSquare, path: '/discussions' },
      { name: '消息', icon: MessageSquare, path: '/messages' },
      { name: '作品展示', icon: MonitorPlay, path: '/showcase' },
    ]
  }
])

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
  socketService.connect()

  const savedTheme = localStorage.getItem('theme') || 'light'
  applyTheme(savedTheme)

  const savedAccent = localStorage.getItem('accentColor') || '#3b82f6'
  applyAccentColor(savedAccent)

  fetchNotifications()
  workspaceStore.fetchWorkspaces()
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
  } else if (!path.includes('/admin/')) {
    // Logic moved to workspaceStore or handled by its own initialization
  }
}, { immediate: true })

onUnmounted(() => {
  socketService.off('new_notification', onNewNotification)
  socketService.off('message_received', onMessageReceived)
  socketService.off('online_users_list', onOnlineUsersList)
  socketService.off('user_status', onUserStatus)
})
</script>

<template>
  <div class="flex h-screen w-full overflow-hidden text-sm transition-colors duration-300" style="background-color: var(--bg-app); color: var(--text-primary)">
    <!-- Global Sidebar -->
    <aside class="w-60 flex flex-col h-full shrink-0 border-r transition-colors duration-300" style="background-color: var(--bg-sidebar); border-color: var(--border-base)">
      
      <!-- Workspace Switcher -->
      <div class="p-4 border-b" style="border-color: var(--border-base)">
        <el-dropdown trigger="click" class="w-full" placement="bottom-start" v-if="workspaceStore.currentWorkspace">
          <div class="flex items-center justify-between w-full p-2 rounded-xl border cursor-pointer hover:border-accent hover:shadow-sm transition-all" style="background-color: var(--bg-card); border-color: var(--border-base)">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-7 h-7 rounded-lg text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm" :class="workspaceStore.currentWorkspace.color">
                {{ workspaceStore.currentWorkspace.name.charAt(0) }}
              </div>
              <span class="font-bold truncate" style="color: var(--text-primary)">{{ workspaceStore.currentWorkspace.name }}</span>
            </div>
            <ChevronDown class="w-4 h-4 text-slate-400 shrink-0" />
          </div>
          <template #dropdown>
            <el-dropdown-menu class="w-64 p-2 rounded-2xl border-none shadow-2xl">
              <div class="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">切换工作空间</div>
              <el-dropdown-item v-for="ws in workspaceStore.workspaces" :key="ws.id" @click="handleSwitchWorkspace(ws)" class="rounded-xl my-0.5">
                <div class="flex items-center justify-between w-full py-1">
                  <div class="flex items-center gap-3">
                    <div class="w-6 h-6 rounded-lg text-white flex items-center justify-center font-bold text-[10px]" :class="ws.color">
                      {{ ws.name.charAt(0) }}
                    </div>
                    <span class="font-medium" :class="workspaceStore.currentWorkspace?.id === ws.id ? 'text-accent' : 'text-slate-600 dark:text-slate-400'">{{ ws.name }}</span>
                  </div>
                  <div v-if="workspaceStore.currentWorkspace?.id === ws.id" class="w-1.5 h-1.5 rounded-full bg-accent"></div>
                </div>
              </el-dropdown-item>
              <div class="border-t border-slate-100 my-2"></div>
              <el-dropdown-item class="rounded-xl my-0.5" @click="router.push('/explore-teams')">
                <div class="flex items-center gap-3 py-1 text-slate-500">
                  <Plus class="w-4 h-4" />
                  <span class="font-medium">创建或加入团队</span>
                </div>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <div v-else class="h-11 animate-pulse bg-slate-100 dark:bg-white/5 rounded-xl"></div>
      </div>

      <div class="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-hide">
        <!-- Admin Section -->
        <div v-if="authStore.user?.role === 'ADMIN'" class="mb-6">
          <div v-for="(group, index) in adminGroups" :key="'admin-'+index">
            <h3 class="px-3 mb-2 text-[10px] font-bold text-accent uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck class="w-3 h-3" />
              {{ group.title }}
            </h3>
            <ul class="space-y-1">
              <li v-for="item in group.items" :key="item.name">
                <RouterLink :to="item.path"
                  class="flex items-center gap-3 px-3 py-2 rounded-md transition-colors duration-150"
                  :class="route.path === item.path ? 'bg-accent text-white font-medium shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-accent-subtle dark:hover:bg-accent/30 hover:text-accent'">
                  <component :is="item.icon" class="w-4 h-4" :class="route.path === item.path ? 'text-white' : 'text-slate-400 dark:text-slate-500'" />
                  {{ item.name }}
                </RouterLink>
              </li>
            </ul>
          </div>
          <div class="mx-3 mt-6 border-t border-slate-200 dark:border-slate-800"></div>
        </div>

        <div v-for="(group, index) in menuGroups" :key="index">
          <h3 v-if="group.title" class="px-3 mb-2 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            {{ group.title }}
          </h3>
          <ul class="space-y-1">
            <li v-for="item in group.items" :key="item.name">
              <RouterLink :to="item.path"
                class="flex items-center justify-between px-3 py-2 rounded-md transition-colors duration-150"
                :class="route.path === item.path ? 'bg-accent-subtle dark:bg-accent/20 text-accent font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'">
                <div class="flex items-center gap-3">
                  <component :is="item.icon" class="w-4 h-4" :class="route.path === item.path ? 'text-accent' : 'text-slate-400'" />
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

        <!-- Notification Bell -->
        <el-dropdown trigger="click" class="w-full" placement="top-start" popper-class="notification-glass">
          <button class="w-full flex items-center justify-between px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors">
            <div class="flex items-center gap-3">
              <div class="relative">
                <Bell class="w-4 h-4" />
                <div v-if="unreadCount > 0" class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 border-2 border-white dark:border-slate-900 rounded-full"></div>
              </div>
              <span>消息通知</span>
            </div>
            <span v-if="unreadCount > 0" class="text-[10px] font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded-full">{{ unreadCount }}</span>
          </button>
          <template #dropdown>
            <div class="notification-panel w-80 p-0 rounded-3xl overflow-hidden">
              <div class="notification-header px-4 py-3 flex items-center justify-between">
                <span class="text-xs font-bold uppercase tracking-wider text-slate-500/80 dark:text-slate-400/80">通知中心</span>
                <button @click="handleMarkAllRead" class="text-[10px] font-bold text-accent hover:underline">全部忽略</button>
              </div>
              <div class="max-h-96 overflow-y-auto scrollbar-hide">
                <div v-for="n in notifications" :key="n.id" 
                  @click="handleMarkAsRead(n)"
                  class="notification-item p-4 cursor-pointer transition-colors"
                  :class="!n.isRead ? 'bg-accent/[0.04] dark:bg-accent/[0.08]' : ''"
                >
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

        <div class="pt-4 mt-4 border-t" style="border-color: var(--border-base)">
          <el-dropdown trigger="click" class="w-full" placement="top-start" @command="handleProfileClick">
            <span class="w-full outline-none">
              <div class="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all w-full">
                <div class="relative">
                  <UserAvatar :user="authStore.user ?? undefined" size="md" />
                  <div v-if="authStore.user?.subscription?.plan?.name && authStore.user.subscription.plan.name !== 'FREE'" 
                       class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900"
                       :style="{ backgroundColor: authStore.user.subscription.plan.name === 'SVIP' ? '#f59e0b' : '#8b5cf6' }">
                    <Crown v-if="authStore.user.subscription.plan.name === 'SVIP'" class="w-2.5 h-2.5 text-white" />
                    <Zap v-else class="w-2.5 h-2.5 text-white" />
                  </div>
                </div>
                <div class="flex-1 min-w-0 text-left ml-1">
                  <div class="flex items-center gap-2">
                    <p class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{{ authStore.user?.name || '未命名用户' }}</p>
                    <span v-if="authStore.user?.subscription?.plan?.name && authStore.user.subscription.plan.name !== 'FREE'" 
                          class="shrink-0 px-1.5 py-0 rounded text-[8px] font-black text-white"
                          :style="{ backgroundColor: authStore.user.subscription.plan.name === 'SVIP' ? '#f59e0b' : '#8b5cf6' }">
                      {{ authStore.user.subscription.plan.name }}
                    </span>
                  </div>
                  <p class="text-[10px] text-slate-400 truncate">{{ authStore.user?.email }}</p>
                </div>
                <ChevronDown class="w-4 h-4 text-slate-400 shrink-0" />
              </div>
            </span>
            <template #dropdown>
              <el-dropdown-menu class="w-56 p-2 rounded-2xl border-none shadow-2xl">
                <el-dropdown-item command="profile" class="rounded-xl my-0.5">
                  <div class="flex items-center gap-3 py-1">
                    <UserIcon class="w-4 h-4 text-slate-400" />
                    <span class="font-medium text-slate-600">个人资料</span>
                  </div>
                </el-dropdown-item>
                <el-dropdown-item command="notifications" class="rounded-xl my-0.5">
                  <div class="flex items-center gap-3 py-1">
                    <Bell class="w-4 h-4 text-slate-400" />
                    <span class="font-medium text-slate-600">消息通知</span>
                  </div>
                </el-dropdown-item>
                <el-dropdown-item command="billing" class="rounded-xl my-0.5">
                  <div class="flex items-center gap-3 py-1">
                    <CreditCard class="w-4 h-4 text-slate-400" />
                    <span class="font-medium text-slate-600">订阅与账单</span>
                  </div>
                </el-dropdown-item>
                <div class="border-t border-slate-100 my-2"></div>
                <el-dropdown-item command="logout" class="rounded-xl my-0.5 text-rose-600">
                  <div class="flex items-center gap-3 py-1">
                    <LogOut class="w-4 h-4" />
                    <span class="font-bold">退出登录</span>
                  </div>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="flex-1 flex flex-col h-full overflow-hidden relative transition-colors duration-300" style="background-color: var(--bg-app)">
      <!-- Maintenance Mode Banner for Admins -->
      <div v-if="systemStore.settings.MAINTENANCE_MODE && authStore.user?.role === 'ADMIN'" 
           class="bg-rose-600 text-white px-6 py-2 flex items-center justify-between shrink-0 z-50 shadow-lg">
        <div class="flex items-center gap-3">
          <ShieldCheck class="w-4 h-4 animate-pulse" />
          <span class="text-xs font-bold uppercase tracking-wider">系统维护模式已开启 - 仅管理员可访问</span>
        </div>
        <RouterLink to="/admin/settings" class="text-[10px] font-black underline hover:opacity-80 transition-opacity">
          前往关闭
        </RouterLink>
      </div>
      
      <RouterView />
    </main>

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
