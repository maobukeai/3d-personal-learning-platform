<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElNotification } from 'element-plus';
import {
  LayoutDashboard,
  Box,
  Layers,
  MapPin,
  Image as ImageIcon,
  Users,
  MonitorPlay,
  MessageSquare,
  Briefcase,
  GraduationCap,
  Settings,
  HelpCircle,
  ChevronDown,
  Plus,
  LogOut,
  User as UserIcon,
  CreditCard,
  Bell,
  ShieldCheck,
  ArrowRight,
  BarChart3,
  Database,
  MessageCircle,
  Notebook,
  Terminal,
  FolderTree,
  Search,
  ExternalLink,
  Share2,
  Menu,
  X,
  Globe,
  Video,
  Palette,
  Cpu,
  Sparkles,
  Camera,
  Tv,
  Compass,
  Folder,
} from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';

const CreateTeamDialog = defineAsyncComponent(() => import('@/components/CreateTeamDialog.vue'));
const ExploreGroupsDialog = defineAsyncComponent(() => import('@/components/ExploreGroupsDialog.vue'));
const InvitationDialog = defineAsyncComponent(() => import('@/components/InvitationDialog.vue'));
const AssetDetailsDrawer = defineAsyncComponent(() => import('@/components/AssetDetailsDrawer.vue'));

import { useAuthStore } from '@/stores/auth';
import { useSystemStore } from '@/stores/system';
import { useWorkspaceStore } from '@/stores/workspace';
import { useMirrorStore, type MirrorCategory } from '@/stores/mirror';
import { useManualStore, type ManualCategory } from '@/stores/manual';
import api, { getAssetUrl } from '@/utils/api';
import { socketService } from '@/utils/socket';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const systemStore = useSystemStore();
const workspaceStore = useWorkspaceStore();
const mirrorStore = useMirrorStore();
const manualStore = useManualStore();

// Dynamic icon mapper for categories to make sidebar look premium and diverse
function getCategoryIcon(name: string) {
  const lowercaseName = name.toLowerCase();
  
  if (lowercaseName.includes('视频') || lowercaseName.includes('剪辑') || lowercaseName.includes('播放') || lowercaseName.includes('影视')) {
    return Video;
  }
  if (lowercaseName.includes('建模') || lowercaseName.includes('模型') || lowercaseName.includes('渲染') || lowercaseName.includes('室内') || lowercaseName.includes('3d')) {
    return Box;
  }
  if (lowercaseName.includes('绘画') || lowercaseName.includes('插画') || lowercaseName.includes('设计') || lowercaseName.includes('平面') || lowercaseName.includes('ui') || lowercaseName.includes('美术')) {
    return Palette;
  }
  if (lowercaseName.includes('摄影') || lowercaseName.includes('拍照') || lowercaseName.includes('相机') || lowercaseName.includes('特效')) {
    return Camera;
  }
  if (lowercaseName.includes('场景') || lowercaseName.includes('环境') || lowercaseName.includes('地图') || lowercaseName.includes('关卡')) {
    return Compass;
  }
  if (lowercaseName.includes('软件') || lowercaseName.includes('工具') || lowercaseName.includes('系统') || lowercaseName.includes('引擎')) {
    return Cpu;
  }
  if (lowercaseName.includes('aigc') || lowercaseName.includes('ai') || lowercaseName.includes('智能') || lowercaseName.includes('生成')) {
    return Sparkles;
  }
  
  // Deterministic fallback hash to keep it consistent
  const icons = [Folder, Layers, Database, MonitorPlay, Tv];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % icons.length;
  return icons[index];
}

interface SidebarMenuItem {
  name: string;
  icon: any;
  path: string;
  badge?: number;
}

interface SidebarMenuGroup {
  title: string;
  items: SidebarMenuItem[];
}

const adminGroups = computed<SidebarMenuGroup[]>(() => [
  {
    title: '系统概览',
    items: [
      { name: '平台概览', icon: BarChart3, path: '/admin/dashboard' },
      { name: '审计日志', icon: Terminal, path: '/admin/audit-logs' },
    ],
  },
  {
    title: '用户与团队',
    items: [
      { name: '用户管理', icon: Users, path: '/admin/users' },
      { name: '团队管理', icon: Briefcase, path: '/admin/teams' },
      {
        name: '用户反馈',
        icon: MessageCircle,
        path: '/admin/feedback',
        badge: workspaceStore.adminStats.openFeedbacks,
      },
    ],
  },
  {
    title: '内容审核',
    items: [
      {
        name: '审核中心',
        icon: ShieldCheck,
        path: '/admin/audits',
        badge:
          workspaceStore.adminStats.pendingAssets +
          workspaceStore.adminStats.pendingMaterials +
          workspaceStore.adminStats.pendingShowcases,
      },
    ],
  },
  {
    title: '教学管理',
    items: [
      { name: '课程管理', icon: GraduationCap, path: '/admin/courses' },
      { name: '路线管理', icon: MapPin, path: '/admin/roadmaps' },
      { name: '分类管理', icon: FolderTree, path: '/admin/categories' },
    ],
  },
  {
    title: '运营管理',
    items: [
      { name: '订阅管理', icon: CreditCard, path: '/admin/subscriptions' },
      { name: '镜像源管理', icon: Globe, path: '/admin/mirror' },
      { name: '资源站管理', icon: Database, path: '/admin/manual' },
      { name: '系统设置', icon: Settings, path: '/admin/settings' },
    ],
  },
]);

const isCreateTeamVisible = ref(false);
const isExploreGroupsVisible = ref(false);
const isInvitationVisible = ref(false);
const isSearchVisible = ref(false);
const searchQuery = ref('');
const searchResults = ref<{
  assets: any[];
  courses: any[];
  teams: any[];
}>({
  assets: [],
  courses: [],
  teams: [],
});
const isSearching = ref(false);
const selectedResultIndex = ref(-1);
const searchHistory = ref<string[]>(JSON.parse(localStorage.getItem('searchHistory') || '[]'));

const activeInvitationId = ref<string | null>(null);
const isMobileSidebarOpen = ref(false);
const isMobile = ref(window.innerWidth < 768);

const updateIsMobile = () => {
  isMobile.value = window.innerWidth < 768;
};

const handleSearch = () => {
  isSearchVisible.value = true;
  selectedResultIndex.value = -1;
};

const addToHistory = (query: string) => {
  if (!query.trim()) return;
  const history = searchHistory.value.filter((h) => h !== query);
  history.unshift(query);
  searchHistory.value = history.slice(0, 5);
  localStorage.setItem('searchHistory', JSON.stringify(searchHistory.value));
};

const clearHistory = () => {
  searchHistory.value = [];
  localStorage.removeItem('searchHistory');
};

const flattenedResults = computed(() => {
  const items: any[] = [];
  searchResults.value.assets.forEach((item) => items.push({ ...item, searchType: 'asset' }));
  searchResults.value.courses.forEach((item) => items.push({ ...item, searchType: 'course' }));
  searchResults.value.teams.forEach((item) => items.push({ ...item, searchType: 'team' }));
  return items;
});

const handleShare = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    ElMessage.success('页面链接已复制');
  } catch (err) {
    ElMessage.error('复制失败');
  }
};

const handleExternalLink = () => {
  window.open(window.location.href, '_blank');
};

let searchTimeout: any = null;
const performSearch = async (query: string) => {
  if (!query.trim()) {
    searchResults.value = { assets: [], courses: [], teams: [] };
    selectedResultIndex.value = -1;
    return;
  }

  isSearching.value = true;
  try {
    const [assetsRes, coursesRes, teamsRes] = await Promise.all([
      api.get('/api/assets/public', { params: { search: query, limit: 5 } }),
      api.get('/api/courses', { params: { search: query } }),
      api.get('/api/teams/public', { params: { search: query } }),
    ]);

    searchResults.value = {
      assets: assetsRes.data.assets || [],
      courses: (coursesRes.data || []).slice(0, 5),
      teams: (teamsRes.data || []).slice(0, 5),
    };
    selectedResultIndex.value = -1;
  } catch (error) {
    console.error('Search error:', error);
  } finally {
    isSearching.value = false;
  }
};

watch(searchQuery, (newQuery) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    performSearch(newQuery);
  }, 300);
});

const navigateToResult = (type: string, id: string) => {
  addToHistory(searchQuery.value);
  isSearchVisible.value = false;
  searchQuery.value = '';
  searchResults.value = { assets: [], courses: [], teams: [] };
  
  if (type === 'asset') {
    router.push(`/assets?id=${id}`);
  } else if (type === 'course') {
    router.push(`/academy/course/${id}`);
  } else if (type === 'team') {
    router.push(`/team/${id}`);
  }
};

const handleKeyDown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    handleSearch();
    return;
  }

  if (!isSearchVisible.value) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedResultIndex.value = (selectedResultIndex.value + 1) % flattenedResults.value.length;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedResultIndex.value = (selectedResultIndex.value - 1 + flattenedResults.value.length) % flattenedResults.value.length;
  } else if (e.key === 'Enter') {
    if (selectedResultIndex.value >= 0 && flattenedResults.value[selectedResultIndex.value]) {
      const item = flattenedResults.value[selectedResultIndex.value];
      navigateToResult(item.searchType, item.id);
    }
  } else if (e.key === 'Escape') {
    isSearchVisible.value = false;
  }
};

const handleTeamCreated = (team: any) => {
  workspaceStore.fetchWorkspaces();
  router.push(`/team/${team.id}`);
};

const handleInvitationSuccess = (data: { accept: boolean; teamId?: string }) => {
  if (data.accept && data.teamId) {
    workspaceStore.fetchWorkspaces();
    router.push(`/team/${data.teamId}`);
  }
};

const handleSwitchWorkspace = (ws: any) => {
  workspaceStore.setWorkspace(ws);
  if (ws.type === 'admin') {
    router.push('/admin/dashboard');
  } else if (ws.type === 'mirror') {
    if (ws.mirrorSourceId) {
      router.push(`/mirror/source/${ws.mirrorSourceId}`);
    } else {
      router.push('/mirror');
    }
  } else if (ws.type === 'manual') {
    if (ws.manualStationId) {
      router.push(`/manual/station/${ws.manualStationId}`);
    } else {
      router.push('/academy');
    }
  } else {
    router.push('/dashboard');
  }
};

const handleQuickSettings = (ws: any) => {
  if (ws.type === 'admin') {
    router.push('/admin/settings');
  } else if (ws.type === 'mirror') {
    router.push('/mirror');
  } else if (ws.type === 'manual') {
    router.push('/admin/manual');
  } else if (ws.type === 'personal') {
    router.push({ path: '/settings', query: { tab: 'profile' } });
  } else {
    router.push(`/settings/workspace/${ws.id}`);
  }
};

// Watch for workspace changes
watch(
  () => workspaceStore.activeTeamId,
  (_newId, _oldId) => {
    // Navigation is handled by handleSwitchWorkspace
  },
);

const handleProfileClick = (type: string) => {
  if (type === 'profile') {
    router.push({ path: '/settings', query: { tab: 'profile' } });
  } else if (type === 'notifications') {
    router.push('/notifications');
  } else if (type === 'billing') {
    router.push('/billing');
  } else if (type === 'logout') {
    handleLogout();
  }
};

const handleReportBug = () => {
  router.push('/report-bug');
};

const handleLogout = async () => {
  socketService.disconnect();
  await authStore.logout();
  ElMessage.success('已成功退出登录');
  router.push('/login');
};

const mirrorGroups = computed<SidebarMenuGroup[]>(() => {
  const currentSourceId = workspaceStore.currentWorkspace?.mirrorSourceId;
  if (!currentSourceId) return [];

  const mainGroup: SidebarMenuGroup = {
    title: workspaceStore.currentWorkspace?.name || '镜像资源',
    items: [
      { 
        name: '全部资源', 
        icon: Database, 
        path: `/mirror/source/${currentSourceId}` 
      },
    ],
  };

  const groups: SidebarMenuGroup[] = [mainGroup];

  const categories = mirrorStore.categories || [];
  if (categories.length) {
    // 1. Group categories by parentExternalId
    const parentMap = new Map<string, MirrorCategory[]>();
    categories.forEach(cat => {
      if (cat.parentExternalId) {
        if (!parentMap.has(cat.parentExternalId)) {
          parentMap.set(cat.parentExternalId, []);
        }
        parentMap.get(cat.parentExternalId)!.push(cat);
      }
    });

    // 2. Identify top level and check if they have children
    const topLevel: MirrorCategory[] = [];
    categories.forEach(cat => {
      const hasParent = cat.parentExternalId && categories.some(p => p.externalId === cat.parentExternalId);
      if (!hasParent) {
        topLevel.push(cat);
      }
    });

    // Sort top level by order
    topLevel.sort((a, b) => (a.order || 0) - (b.order || 0));

    topLevel.forEach(parent => {
      const children = parentMap.get(parent.externalId) || [];
      if (children.length > 0) {
        // Create a new sidebar group
        const childItems = children
          .map(child => ({
            name: child.name,
            icon: getCategoryIcon(child.name),
            path: `/mirror/source/${currentSourceId}?categoryId=${child.id}`,
          }))
          .sort((a, b) => {
            const childA = children.find(c => c.name === a.name);
            const childB = children.find(c => c.name === b.name);
            return (childA?.order || 0) - (childB?.order || 0);
          });

        groups.push({
          title: parent.name,
          items: [
            {
              name: `全部 ${parent.name}`,
              icon: getCategoryIcon(parent.name),
              path: `/mirror/source/${currentSourceId}?categoryId=${parent.id}`,
            },
            ...childItems,
          ],
        });
      } else {
        // Childless parent category stays in main group
        mainGroup.items.push({
          name: parent.name,
          icon: getCategoryIcon(parent.name),
          path: `/mirror/source/${currentSourceId}?categoryId=${parent.id}`,
        });
      }
    });
  }

  return groups;
});

const manualGroups = computed<SidebarMenuGroup[]>(() => {
  const currentStationId = workspaceStore.currentWorkspace?.manualStationId;
  if (!currentStationId) return [];

  const mainGroup: SidebarMenuGroup = {
    title: workspaceStore.currentWorkspace?.name || '手动资源站',
    items: [
      { 
        name: '全部资源', 
        icon: Database, 
        path: `/manual/station/${currentStationId}` 
      },
    ],
  };

  const groups: SidebarMenuGroup[] = [mainGroup];

  const categories = manualStore.categories || [];
  if (categories.length) {
    // 1. Group categories by parentId
    const parentMap = new Map<string, ManualCategory[]>();
    categories.forEach(cat => {
      if (cat.parentId) {
        if (!parentMap.has(cat.parentId)) {
          parentMap.set(cat.parentId, []);
        }
        parentMap.get(cat.parentId)!.push(cat);
      }
    });

    // 2. Identify top level and check if they have children
    const topLevel: ManualCategory[] = [];
    categories.forEach(cat => {
      const hasParent = cat.parentId && categories.some(p => p.id === cat.parentId);
      if (!hasParent) {
        topLevel.push(cat);
      }
    });

    // Sort top level by order
    topLevel.sort((a, b) => (a.order || 0) - (b.order || 0));

    topLevel.forEach(parent => {
      const children = parentMap.get(parent.id) || [];
      if (children.length > 0) {
        // Create a new sidebar group
        const childItems = children
          .map(child => ({
            name: child.name,
            icon: getCategoryIcon(child.name),
            path: `/manual/station/${currentStationId}?categoryId=${child.id}`,
          }))
          .sort((a, b) => {
            const childA = children.find(c => c.name === a.name);
            const childB = children.find(c => c.name === b.name);
            return (childA?.order || 0) - (childB?.order || 0);
          });

        groups.push({
          title: parent.name,
          items: [
            {
              name: `全部 ${parent.name}`,
              icon: getCategoryIcon(parent.name),
              path: `/manual/station/${currentStationId}?categoryId=${parent.id}`,
            },
            ...childItems,
          ],
        });
      } else {
        // Childless parent category stays in main group
        mainGroup.items.push({
          name: parent.name,
          icon: getCategoryIcon(parent.name),
          path: `/manual/station/${currentStationId}?categoryId=${parent.id}`,
        });
      }
    });
  }

  return groups;
});

const menuGroups = computed<SidebarMenuGroup[]>(() => {
  if (workspaceStore.isAdminWorkspace) {
    return adminGroups.value;
  }
  if (workspaceStore.currentWorkspace?.type === 'mirror') {
    return mirrorGroups.value;
  }
  if (workspaceStore.currentWorkspace?.type === 'manual') {
    return manualGroups.value;
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
      ],
    },
    {
      title: '团队协作',
      items: [
        { name: t('sidebar.teamTasks'), icon: Briefcase, path: '/team-tasks' },
        {
          name: t('sidebar.members'),
          icon: Users,
          path: workspaceStore.activeTeamId ? `/team/${workspaceStore.activeTeamId}` : '/members',
        },
      ],
    },
    {
      title: '资源中心',
      items: [
        { name: t('sidebar.myWorks'), icon: Box, path: '/my-works' },
        { name: t('sidebar.assets'), icon: ImageIcon, path: '/assets' },
        { name: t('sidebar.materials'), icon: Layers, path: '/materials' },
      ],
    },
    {
      title: '交流社区',
      items: [
        { name: t('sidebar.discussions'), icon: MessageSquare, path: '/discussions' },
        {
          name: t('sidebar.messages'),
          icon: MessageSquare,
          path: '/messages',
          badge: authStore.unreadMessagesCount,
        },
        { name: t('sidebar.showcase'), icon: MonitorPlay, path: '/showcase' },
      ],
    },
  ];
});

const currentTheme = ref(localStorage.getItem('theme') || 'light');

const applyTheme = (theme: string) => {
  currentTheme.value = theme;
  const root = document.documentElement;

  // Batch all class changes into a single operation to avoid multiple repaints
  const classes = new Set(root.classList);
  classes.delete('dark');
  classes.delete('theme-glass');

  if (theme === 'light') {
    localStorage.setItem('lastBaseTheme', 'light');
  } else if (theme === 'dark') {
    localStorage.setItem('lastBaseTheme', 'dark');
    classes.add('dark');
  } else if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    localStorage.setItem('lastBaseTheme', isDark ? 'dark' : 'light');
    if (isDark) classes.add('dark');
  } else if (theme === 'glass') {
    const lastBase = localStorage.getItem('lastBaseTheme') || 'light';
    classes.add('theme-glass');
    if (lastBase === 'dark') classes.add('dark');
  }

  // Apply all classes in one shot – triggers only a single style recalculation
  root.className = Array.from(classes).join(' ');
};

const applyAccentColor = (color: string) => {
  const root = document.documentElement;
  root.style.setProperty('--accent', color);
  root.style.setProperty('--el-color-primary', color);
  root.style.setProperty('--el-color-primary-light-3', `${color}b3`);
  root.style.setProperty('--el-color-primary-light-5', `${color}80`);
  root.style.setProperty('--el-color-primary-light-9', `${color}1a`);
};

const notifications = ref<any[]>([]);
const unreadCount = computed(() => notifications.value.filter((n) => !n.isRead).length);

const fetchNotifications = async () => {
  if (!authStore.isAuthenticated) return;

  try {
    const response = await api.get('/api/notifications');
    notifications.value = response.data.notifications || [];

    // Also refresh admin stats if applicable
    if (authStore.user?.role === 'ADMIN') {
      workspaceStore.fetchAdminStats();
    }
  } catch (error) {
    console.error('Fetch notifications error:', error);
  }
};

const handleMarkAsRead = async (notification: any) => {
  if (!notification.isRead) {
    try {
      await api.put(`/api/notifications/${notification.id}/read`);
      const n = notifications.value.find((notif) => notif.id === notification.id);
      if (n) n.isRead = true;
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  }

  // Handle specific notification types
  if (notification.title === '收到团队邀请' && notification.link) {
    const url = new URL(notification.link, window.location.origin);
    const invitationId = url.searchParams.get('invitationId');
    if (invitationId) {
      activeInvitationId.value = invitationId;
      isInvitationVisible.value = true;
    }
  } else if (notification.link) {
    const resolved = router.resolve(notification.link);
    if (resolved.name) {
      router.push(notification.link);
    } else {
      console.warn('Notification link points to unknown route:', notification.link);
    }
  }
};

const handleMarkAllRead = async () => {
  try {
    await api.put('/api/notifications/read-all');
    notifications.value.forEach((n) => (n.isRead = true));
    ElMessage.success('已全部标记为已读');
  } catch (error) {
    console.error('Mark all read error:', error);
  }
};

const fetchUnreadMessagesCount = async () => {
  if (!authStore.isAuthenticated) return;

  try {
    const response = await api.get('/api/messages/conversations');
    const total = response.data.reduce(
      (acc: number, conv: any) => acc + (conv.unreadCount || 0),
      0,
    );
    authStore.setUnreadMessagesCount(total);
  } catch (error) {
    console.error('Fetch unread messages count error:', error);
  }
};

const onNewNotification = (notification: any) => {
  notifications.value.unshift(notification);

  // Immediate sync when notification arrives
  if (authStore.user?.role === 'ADMIN') {
    workspaceStore.fetchAdminStats();
  }

  ElNotification({
    title: notification.title,
    message: notification.content,
    type: 'info',
    duration: 5000,
    position: 'top-right',
    onClick: () => {
      if (notification.link) {
        const resolved = router.resolve(notification.link);
        if (resolved.name) {
          router.push(notification.link);
        }
      }
    },
  });
};

const onOnlineUsersList = (ids: string[]) => {
  authStore.setOnlineUsers(ids);
};

const onUserStatus = ({ userId, status }: { userId: string; status: 'online' | 'offline' }) => {
  authStore.updateUserStatus(userId, status);
};

const onMessageReceived = ({ conversationId: _conversationId, message }: any) => {
  const isMessagesPage = route.path === '/messages';

  if (!isMessagesPage) {
    authStore.incrementUnreadMessagesCount();

    ElNotification({
      title: `来自 ${message.sender.name} 的新消息`,
      message: message.type === 'TEXT' ? message.content : '[图片/文件]',
      type: 'success',
      duration: 3000,
      position: 'bottom-right',
      onClick: () => {
        router.push('/messages');
      },
    });
  }
};

// Watch for auth changes to re-initialize workspaces
watch(
  () => authStore.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) {
      workspaceStore.initialize(route.path);
    }
  },
);

// Watch for workspace changes to refresh stats
watch(
  () => workspaceStore.activeWorkspaceId,
  (id) => {
    if (id === 'admin-workspace') {
      workspaceStore.fetchAdminStats();
    }
  },
);

const onMirrorSyncStarted = ({ sourceName, type }: any) => {
  ElNotification({
    title: '镜像同步开始',
    message: `镜像源「${sourceName}」的${type === 'FULL' ? '全量' : '增量'}同步任务已启动...`,
    type: 'info',
    duration: 4000,
    position: 'top-right',
  });
};

const onMirrorSyncFinished = ({ sourceName, status, result, error }: any) => {
  if (status === 'SUCCESS') {
    ElNotification({
      title: '镜像同步成功',
      message: `镜像源「${sourceName}」同步完成！新增 ${result?.resourcesCreated || 0} 个资源，更新 ${result?.resourcesUpdated || 0} 个资源。`,
      type: 'success',
      duration: 6000,
      position: 'top-right',
    });
  } else if (status === 'CANCELLED') {
    ElNotification({
      title: '镜像同步已取消',
      message: `镜像源「${sourceName}」的同步任务已由用户手动取消。`,
      type: 'warning',
      duration: 4000,
      position: 'top-right',
    });
  } else {
    ElNotification({
      title: '镜像同步失败',
      message: `镜像源「${sourceName}」同步遇到错误：${error || '未知错误'}`,
      type: 'error',
      duration: 6000,
      position: 'top-right',
    });
  }
  workspaceStore.fetchWorkspaces();
};

let statsInterval: any = null;

const handleThemeChangeExternal = (e: Event) => {
  applyTheme((e as CustomEvent).detail);
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('resize', updateIsMobile);
  window.addEventListener('theme-changed', handleThemeChangeExternal);
  socketService.connect();

  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);

  const savedAccent = localStorage.getItem('accentColor') || '#3b82f6';
  applyAccentColor(savedAccent);

  if (!systemStore.isInitialized) {
    systemStore.fetchSettings();
  }

  fetchNotifications();
  workspaceStore.initialize(route.path);
  fetchUnreadMessagesCount();
  authStore.fetchMe();

  if (authStore.user?.role === 'ADMIN') {
    workspaceStore.fetchAdminStats();
  }

  // Real-time Sync: Polling every 15 seconds
  statsInterval = setInterval(() => {
    fetchNotifications();
    if (authStore.user?.role === 'ADMIN') {
      workspaceStore.fetchAdminStats();
    }
  }, 15000);

  socketService.on('new_notification', onNewNotification);
  socketService.on('online_users_list', onOnlineUsersList);
  socketService.on('user_status', onUserStatus);
  socketService.on('message_received', onMessageReceived);
  socketService.on('mirror_sync_started', onMirrorSyncStarted);
  socketService.on('mirror_sync_finished', onMirrorSyncFinished);

  // Custom event for immediate admin stat refresh
  socketService.on('refresh_admin_stats', () => {
    if (authStore.user?.role === 'ADMIN') {
      workspaceStore.fetchAdminStats();
    }
  });
});

// Sync workspace with route
watch(
  () => route.path,
  (path) => {
    isMobileSidebarOpen.value = false;
    if (path.startsWith('/team/')) {
      const id = path.split('/')[2];
      workspaceStore.setWorkspaceById(id);
    } else if (path.startsWith('/admin/')) {
      workspaceStore.setWorkspaceById('admin-workspace');
    } else if (path.startsWith('/mirror/source/')) {
      const sourceId = path.split('/')[3];
      workspaceStore.setWorkspaceById(`mirror-${sourceId}`);
    } else if (path.startsWith('/manual/station/')) {
      const stationId = path.split('/')[3];
      workspaceStore.setWorkspaceById(`manual-${stationId}`);
    }
  },
  { immediate: false },
);

onUnmounted(() => {
  if (statsInterval) clearInterval(statsInterval);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('resize', updateIsMobile);
  window.removeEventListener('theme-changed', handleThemeChangeExternal);
  socketService.off('new_notification', onNewNotification);
  socketService.off('message_received', onMessageReceived);
  socketService.off('online_users_list', onOnlineUsersList);
  socketService.off('user_status', onUserStatus);
  socketService.off('mirror_sync_started', onMirrorSyncStarted);
  socketService.off('mirror_sync_finished', onMirrorSyncFinished);
  socketService.off('refresh_admin_stats');
});
</script>

<template>
  <div
    class="flex flex-col h-screen h-dvh w-full overflow-hidden text-sm relative"
    style="background-color: var(--bg-app); color: var(--text-primary)"
  >
    <!-- Global Glass Theme Animated Background Glowing Blobs -->
    <div
      v-show="currentTheme === 'glass'"
      class="absolute inset-0 overflow-hidden pointer-events-none z-0"
      style="contain: strict"
    >
      <div class="absolute w-[45vw] h-[45vw] rounded-full top-[-15%] left-[-15%] animate-float-blob" style="will-change: transform; background: radial-gradient(circle at center, color-mix(in srgb, var(--accent) 15%, transparent) 0%, transparent 70%)"></div>
      <div class="absolute w-[50vw] h-[50vw] rounded-full bottom-[-20%] right-[-15%] animate-float-blob-reverse" style="will-change: transform; background: radial-gradient(circle at center, rgba(99, 102, 241, 0.12) 0%, transparent 70%)"></div>
      <div class="absolute w-[35vw] h-[35vw] rounded-full top-[30%] right-[15%] animate-pulse-slow" style="will-change: transform, opacity; background: radial-gradient(circle at center, rgba(236, 72, 153, 0.1) 0%, transparent 70%)"></div>
    </div>

    <!-- Top Navigation Bar -->
    <header
      class="topbar h-14 md:h-16 flex items-center justify-between px-4 md:px-6 shrink-0 z-30 glass-header"
    >
      <!-- Left: Hamburger + Workspace Switcher / Logo -->
      <div class="flex items-center gap-1 md:gap-3">
        <button
          class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors lg:hidden shrink-0 -ml-1"
          @click="isMobileSidebarOpen = true"
        >
          <Menu class="w-5 h-5" style="color: var(--text-muted)" />
        </button>

        <template v-if="!workspaceStore.isInitialized && authStore.isAuthenticated">
          <div class="flex items-center gap-2.5 ml-2 md:ml-4 animate-pulse">
            <div class="w-7 h-7 rounded-xl bg-slate-200/50 dark:bg-white/10"></div>
            <div class="w-24 h-4 rounded-md bg-slate-200/50 dark:bg-white/10"></div>
          </div>
        </template>
        <template v-else>
          <el-dropdown
            v-if="workspaceStore.currentWorkspace"
            trigger="click"
            placement="bottom-start"
          >
            <div
              class="flex items-center gap-2 md:gap-2.5 cursor-pointer hover:opacity-80 ml-1 md:ml-4 transition-all duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]"
              :style="{
                transform: `translateX(${
                  workspaceStore.currentWorkspace?.type === 'personal'
                    ? 0
                    : workspaceStore.currentWorkspace?.type === 'team'
                      ? (isMobile ? 4 : 12)
                      : (isMobile ? 8 : 24)
                }px)`,
              }"
            >
              <div class="relative">
                <div
                  class="w-7 h-7 rounded-xl text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm transition-all duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] backdrop-blur-md border border-white/20 shadow-[inset_0_1px_rgba(255,255,255,0.4)]"
                  :class="
                    workspaceStore.isAdminWorkspace ? '' : workspaceStore.currentWorkspace.color
                  "
                  :style="
                    workspaceStore.isAdminWorkspace
                      ? {
                          background: 'linear-gradient(135deg, #fb7185 0%, #e11d48 100%)',
                          boxShadow: '0 4px 12px rgba(225, 29, 72, 0.3)',
                        }
                      : {}
                  "
                >
                  {{ workspaceStore.currentWorkspace.name.charAt(0) }}
                </div>
                <!-- Active Workspace Badge -->
                <div
                  v-if="workspaceStore.currentWorkspace?.badgeCount"
                  class="absolute -top-1 -right-1 min-w-[16px] h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-[var(--bg-sidebar)] px-1 animate-in zoom-in duration-300"
                >
                  {{
                    workspaceStore.currentWorkspace.badgeCount > 99
                      ? '99+'
                      : workspaceStore.currentWorkspace.badgeCount
                  }}
                </div>
              </div>
              <span
                class="text-sm font-bold truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px] transition-all duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]"
                :class="{ 'tracking-wide': workspaceStore.isAdminWorkspace }"
                style="color: var(--text-primary)"
              >
                {{ workspaceStore.currentWorkspace.name }}
              </span>
              <ChevronDown
                class="w-4 h-4 text-slate-400 shrink-0 transition-all duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]"
                :class="{ 'text-rose-400': workspaceStore.isAdminWorkspace }"
              />
            </div>
            <template #dropdown>
              <el-dropdown-menu class="w-72 p-2 rounded-2xl border-none shadow-2xl">
                <div class="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  切换工作空间
                </div>
                <el-dropdown-item
                  v-for="ws in workspaceStore.workspaces"
                  :key="ws.id"
                  class="rounded-2xl my-1 p-2 group transition-all duration-200"
                  :class="workspaceStore.activeWorkspaceId === ws.id ? 'bg-accent/5' : ''"
                  @click="handleSwitchWorkspace(ws)"
                >
                  <div class="flex items-center justify-between w-full">
                    <div class="flex items-center gap-3">
                      <!-- 玻璃质感头像 -->
                      <div class="relative">
                        <div
                          class="w-8 h-8 rounded-xl text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-110 backdrop-blur-md border border-white/20 shadow-[inset_0_1px_rgba(255,255,255,0.4)]"
                          :class="ws.color"
                        >
                          {{ ws.name.charAt(0) }}
                        </div>
                        <!-- 徽标 -->
                        <div
                          v-if="ws.badgeCount"
                          class="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 px-1"
                        >
                          {{ ws.badgeCount > 99 ? '99+' : ws.badgeCount }}
                        </div>
                      </div>
                      <!-- 文字信息 -->
                      <div class="flex flex-col text-left">
                        <span
                          class="font-semibold text-sm"
                          :class="
                            workspaceStore.activeWorkspaceId === ws.id
                              ? 'text-accent'
                              : 'text-slate-700 dark:text-slate-200'
                          "
                        >
                          {{ ws.name }}
                        </span>
                        <span class="text-[10px] text-slate-400">
                          {{ ws.description }}
                        </span>
                      </div>
                    </div>
                    <!-- 快捷按钮 -->
                    <div class="flex items-center gap-2">
                      <button
                        class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-accent transition-all duration-200 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0"
                        @click.stop="handleQuickSettings(ws)"
                      >
                        <Settings class="w-4 h-4" />
                      </button>
                      <div
                        v-if="workspaceStore.activeWorkspaceId === ws.id"
                        class="w-1.5 h-1.5 rounded-full bg-accent"
                      ></div>
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
            <div
              class="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden"
              :class="systemStore.settings.PLATFORM_LOGO_URL ? 'bg-transparent' : 'bg-accent'"
            >
              <img
                v-if="systemStore.settings.PLATFORM_LOGO_URL"
                :src="getAssetUrl(systemStore.settings.PLATFORM_LOGO_URL)"
                class="w-full h-full object-contain"
              />
              <Box v-else class="w-4 h-4 text-white" />
            </div>
            <span class="text-sm font-bold" style="color: var(--text-primary)">{{
              systemStore.settings.PLATFORM_NAME
            }}</span>
          </div>
        </template>
      </div>

      <!-- Center: Search Bar -->
      <div
        class="topbar-search hidden md:flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer hover:border-[var(--border-strong)] transition-colors"
        style="background-color: var(--bg-card); border-color: var(--border-base); min-width: 240px; lg:min-width: 320px"
        @click="handleSearch"
      >
        <Search class="w-4 h-4 text-slate-400" />
        <span class="text-xs text-slate-400 flex-1">搜索功能、作品或文档...</span>
        <kbd
          class="text-[10px] px-2 py-0.5 rounded border font-mono hidden lg:inline-block"
          style="border-color: var(--border-base); color: var(--text-muted)"
          >Ctrl+K</kbd
        >
      </div>

      <!-- Right: Actions + Avatar -->
      <div class="flex items-center gap-2 md:gap-3">
        <!-- Mobile Search Button -->
        <button
          class="md:hidden w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          @click="handleSearch"
        >
          <Search class="w-4.5 h-4.5" style="color: var(--text-muted)" />
        </button>
        <!-- Share -->
        <button
          class="topbar-icon-btn hidden sm:flex w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          @click="handleShare"
        >
          <Share2 class="w-4.5 h-4.5" style="color: var(--text-muted)" />
        </button>
        <!-- External Link -->
        <button
          class="topbar-icon-btn hidden sm:flex w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          @click="handleExternalLink"
        >
          <ExternalLink class="w-4.5 h-4.5" style="color: var(--text-muted)" />
        </button>
        <!-- Notification Bell -->
        <el-dropdown trigger="click" placement="bottom-end" popper-class="notification-glass">
          <button
            class="topbar-icon-btn w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
          >
            <Bell class="w-4.5 h-4.5" style="color: var(--text-muted)" />
            <div
              v-if="unreadCount > 0"
              class="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900"
            ></div>
          </button>
          <template #dropdown>
            <div
              class="notification-panel w-80 p-0 rounded-3xl overflow-hidden border border-white/20 dark:border-white/10 shadow-2xl"
            >
              <div
                class="notification-header px-4 py-3 flex items-center justify-between border-b border-white/10"
              >
                <span
                  class="text-xs font-bold uppercase tracking-wider text-slate-500/80 dark:text-slate-400/80"
                  >通知中心</span
                >
                <div class="flex items-center gap-3">
                  <button
                    class="text-[10px] font-bold text-accent hover:underline"
                    @click="handleMarkAllRead"
                  >
                    全部忽略
                  </button>
                  <button
                    class="text-[10px] font-bold text-slate-400 hover:text-accent"
                    @click="router.push('/notifications')"
                  >
                    查看全部
                  </button>
                </div>
              </div>
              <div class="max-h-96 overflow-y-auto scrollbar-hide">
                <div
                  v-for="n in notifications"
                  :key="n.id"
                  class="notification-item p-4 cursor-pointer transition-colors"
                  :class="!n.isRead ? 'bg-accent/[0.04] dark:bg-accent/[0.08]' : ''"
                  @click="handleMarkAsRead(n)"
                >
                  <p
                    class="text-xs font-bold mb-1"
                    :class="!n.isRead ? 'text-accent' : 'text-slate-700/90 dark:text-slate-300/90'"
                  >
                    {{ n.title }}
                  </p>
                  <p
                    class="text-[11px] text-slate-500/80 dark:text-slate-400/80 leading-relaxed mb-2"
                  >
                    {{ n.content }}
                  </p>
                  <p class="text-[9px] text-slate-400/60 dark:text-slate-500/60">
                    {{ new Date(n.createdAt).toLocaleString() }}
                  </p>
                </div>
                <div v-if="notifications.length === 0" class="py-10 text-center text-slate-400/60">
                  <Bell class="w-8 h-8 mx-auto mb-2 opacity-10" />
                  <p class="text-xs">暂无新通知</p>
                </div>
              </div>
            </div>
          </template>
        </el-dropdown>

        <!-- User Avatar or Login Button -->
        <template v-if="authStore.isAuthenticated">
          <el-dropdown trigger="click" placement="bottom-end" @command="handleProfileClick">
            <button
              class="flex items-center gap-0 p-0.5 rounded-full hover:ring-2 hover:ring-accent/30 transition-all cursor-pointer outline-none"
            >
              <UserAvatar :user="authStore.user ?? undefined" size="md" />
            </button>
            <template #dropdown>
              <el-dropdown-menu class="w-56 p-2 rounded-2xl border-none shadow-2xl">
                <div class="px-3 py-2 border-b mb-1" style="border-color: var(--border-base)">
                  <p class="text-sm font-bold" style="color: var(--text-primary)">
                    {{ authStore.user?.name || '未命名用户' }}
                  </p>
                  <p class="text-[10px]" style="color: var(--text-muted)">
                    {{ authStore.user?.email }}
                  </p>
                </div>
                <el-dropdown-item command="profile" class="rounded-xl my-0.5">
                  <div class="flex items-center gap-3 py-1">
                    <UserIcon class="w-4 h-4 text-slate-400" /><span
                      class="font-medium text-slate-600"
                      >个人资料</span
                    >
                  </div>
                </el-dropdown-item>
                <el-dropdown-item command="notifications" class="rounded-xl my-0.5">
                  <div class="flex items-center gap-3 py-1">
                    <Bell class="w-4 h-4 text-slate-400" /><span class="font-medium text-slate-600"
                      >消息通知</span
                    >
                  </div>
                </el-dropdown-item>
                <el-dropdown-item command="billing" class="rounded-xl my-0.5">
                  <div class="flex items-center gap-3 py-1">
                    <CreditCard class="w-4 h-4 text-slate-400" /><span
                      class="font-medium text-slate-600"
                      >订阅与账单</span
                    >
                  </div>
                </el-dropdown-item>
                <div class="border-t border-slate-100 my-2"></div>
                <el-dropdown-item command="logout" class="rounded-xl my-0.5 text-rose-600">
                  <div class="flex items-center gap-3 py-1">
                    <LogOut class="w-4 h-4" /><span class="font-bold">退出登录</span>
                  </div>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
        <template v-else>
          <button
            class="px-4 py-1.5 bg-accent text-white text-xs font-bold rounded-xl shadow-lg shadow-accent/20 hover:shadow-xl transition-all"
            @click="router.push({ path: '/login', query: { redirect: route.fullPath } })"
          >
            登录
          </button>
        </template>
      </div>
    </header>

    <div class="flex flex-1 overflow-hidden">
      <!-- Global Sidebar -->
      <aside
        class="w-60 hidden lg:flex flex-col h-full shrink-0 glass-sidebar"
      >
        <div class="flex-1 overflow-y-auto py-4 px-3 scrollbar-hide">
          <div v-for="(group, index) in menuGroups" :key="index" :class="{ 'mt-1': index > 0 }">
            <!-- Divider before the group if it's not the first one -->
            <div
              v-if="index > 0"
              class="mb-1 border-t"
              style="border-color: var(--border-base); opacity: 0.4"
            ></div>

            <h3
              v-if="group.title"
              class="px-3 mb-0.5 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"
              :class="
                workspaceStore.isAdminWorkspace
                  ? 'text-rose-500 dark:text-rose-400'
                  : 'text-slate-400 dark:text-slate-500'
              "
            >
              <ShieldCheck v-if="workspaceStore.isAdminWorkspace" class="w-3 h-3" />
              {{ group.title }}
            </h3>
            <ul class="space-y-1">
              <li v-for="item in group.items" :key="item.name">
                <RouterLink
                  :to="item.path"
                  class="flex items-center justify-between px-3 py-1.5 rounded-md transition-colors duration-150"
                  :class="
                    route.fullPath === item.path
                      ? workspaceStore.isAdminWorkspace
                        ? 'bg-rose-600 text-white font-medium shadow-md'
                        : 'bg-accent-subtle dark:bg-accent/20 text-accent font-medium'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                  "
                >
                  <div class="flex items-center gap-3">
                    <component
                      :is="item.icon"
                      v-if="item.icon"
                      class="w-4 h-4"
                      :class="
                        route.fullPath === item.path
                          ? workspaceStore.isAdminWorkspace
                            ? 'text-white'
                            : 'text-accent'
                          : 'text-slate-400'
                      "
                    />
                    <span class="flex-1">{{ item.name }}</span>

                    <!-- High-Visibility Badge -->
                    <div
                      v-if="item.badge && item.badge > 0"
                      class="px-1.5 py-0.5 min-w-[18px] h-4.5 rounded-full text-[10px] font-black flex items-center justify-center transition-all duration-300"
                      :class="
                        route.fullPath === item.path
                          ? 'bg-white text-rose-600 shadow-sm'
                          : workspaceStore.isAdminWorkspace
                            ? 'bg-rose-500 text-white'
                            : 'bg-rose-500 text-white'
                      "
                    >
                      {{ item.badge > 99 ? '99+' : item.badge }}
                    </div>
                  </div>
                </RouterLink>
              </li>
            </ul>
          </div>
        </div>

        <div class="p-2.5 border-t space-y-0.5" style="border-color: var(--border-base)">
          <RouterLink
            to="/settings"
            class="flex items-center gap-3 px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 rounded-md transition-colors"
            :class="
              route.path === '/settings' ? 'bg-accent-subtle dark:bg-accent/20 text-accent' : ''
            "
          >
            <Settings
              class="w-4 h-4"
              :class="route.path === '/settings' ? 'text-accent' : 'text-slate-400'"
            />
            设置选项
          </RouterLink>
          <button
            class="w-full flex items-center gap-3 px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 rounded-md transition-colors"
            @click="handleReportBug"
          >
            <HelpCircle class="w-4 h-4 text-slate-400" />
            问题反馈
          </button>
        </div>
      </aside>

      <!-- Main Content Area -->
      <main
        class="flex-1 flex flex-col overflow-hidden relative pb-14 lg:pb-0"
        style="background-color: var(--bg-app)"
      >
        <div
          v-if="systemStore.settings.MAINTENANCE_MODE && authStore.user?.role === 'ADMIN'"
          class="bg-rose-600 text-white px-6 py-2 flex items-center justify-between shrink-0 z-50 shadow-lg"
        >
          <div class="flex items-center gap-3">
            <ShieldCheck class="w-4 h-4 animate-pulse" />
            <span class="text-xs font-bold uppercase tracking-wider"
              >系统维护模式已开启 - 仅管理员可访问</span
            >
          </div>
          <RouterLink
            to="/admin/settings"
            class="text-[10px] font-black underline hover:opacity-80 transition-opacity"
            >前往关闭</RouterLink
          >
        </div>
        <RouterView v-slot="{ Component }">
          <Transition name="fade-slide" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <!-- Mobile Bottom Tab Bar -->
    <nav
      class="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around h-14 border-t backdrop-blur-xl bg-white/90 dark:bg-slate-900/90"
      style="border-color: var(--border-base); padding-bottom: env(safe-area-inset-bottom);"
    >
      <RouterLink
        to="/dashboard"
        class="flex flex-col items-center justify-center gap-0.5 px-3 py-1 transition-colors relative"
        :class="route.path === '/dashboard' || route.path.startsWith('/dashboard') ? 'text-accent' : ''"
        style="color: route.path === '/dashboard' || route.path.startsWith('/dashboard') ? '' : 'var(--text-muted)'"
      >
        <LayoutDashboard class="w-5 h-5" />
        <span class="text-[10px] font-medium">首页</span>
        <div
          v-if="route.path === '/dashboard' || route.path.startsWith('/dashboard')"
          class="absolute -bottom-0.5 w-1 h-1 rounded-full bg-accent"
        ></div>
      </RouterLink>
      <RouterLink
        to="/academy"
        class="flex flex-col items-center justify-center gap-0.5 px-3 py-1 transition-colors relative"
        :class="route.path.startsWith('/academy') ? 'text-accent' : ''"
        :style="route.path.startsWith('/academy') ? {} : { color: 'var(--text-muted)' }"
      >
        <GraduationCap class="w-5 h-5" />
        <span class="text-[10px] font-medium">学习</span>
        <div
          v-if="route.path.startsWith('/academy')"
          class="absolute -bottom-0.5 w-1 h-1 rounded-full bg-accent"
        ></div>
      </RouterLink>
      <RouterLink
        to="/showcase"
        class="flex flex-col items-center justify-center gap-0.5 px-3 py-1 transition-colors relative"
        :class="route.path.startsWith('/showcase') ? 'text-accent' : ''"
        :style="route.path.startsWith('/showcase') ? {} : { color: 'var(--text-muted)' }"
      >
        <MonitorPlay class="w-5 h-5" />
        <span class="text-[10px] font-medium">作品</span>
        <div
          v-if="route.path.startsWith('/showcase')"
          class="absolute -bottom-0.5 w-1 h-1 rounded-full bg-accent"
        ></div>
      </RouterLink>
      <RouterLink
        to="/discussions"
        class="flex flex-col items-center justify-center gap-0.5 px-3 py-1 transition-colors relative"
        :class="route.path.startsWith('/discussions') ? 'text-accent' : ''"
        :style="route.path.startsWith('/discussions') ? {} : { color: 'var(--text-muted)' }"
      >
        <MessageSquare class="w-5 h-5" />
        <span class="text-[10px] font-medium">社区</span>
        <div
          v-if="route.path.startsWith('/discussions')"
          class="absolute -bottom-0.5 w-1 h-1 rounded-full bg-accent"
        ></div>
      </RouterLink>
      <RouterLink
        to="/messages"
        class="flex flex-col items-center justify-center gap-0.5 px-3 py-1 transition-colors relative"
        :class="route.path.startsWith('/messages') ? 'text-accent' : ''"
        :style="route.path.startsWith('/messages') ? {} : { color: 'var(--text-muted)' }"
      >
        <MessageCircle class="w-5 h-5" />
        <span class="text-[10px] font-medium">消息</span>
        <div
          v-if="authStore.unreadMessagesCount > 0"
          class="absolute -top-0.5 right-1 min-w-[18px] h-[18px] bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1"
        >
          {{ authStore.unreadMessagesCount > 99 ? '99+' : authStore.unreadMessagesCount }}
        </div>
        <div
          v-if="route.path.startsWith('/messages')"
          class="absolute -bottom-0.5 w-1 h-1 rounded-full bg-accent"
        ></div>
      </RouterLink>
    </nav>

    <!-- Create Team Dialog -->
    <CreateTeamDialog v-model:visible="isCreateTeamVisible" @success="handleTeamCreated" />

    <InvitationDialog
      v-model:visible="isInvitationVisible"
      :invitation-id="activeInvitationId"
      @success="handleInvitationSuccess"
    />

    <ExploreGroupsDialog v-model:visible="isExploreGroupsVisible" />

    <!-- Global Search Dialog -->
    <el-dialog
      v-model="isSearchVisible"
      :title="isMobile ? '' : '全局搜索'"
      :width="isMobile ? '90%' : '600px'"
      :top="isMobile ? '8vh' : '15vh'"
      :class="['search-dialog', 'custom-rounded-dialog', isMobile ? 'mobile-search-dialog' : '']"
      :show-close="isMobile"
      :fullscreen="false"
      @opened="() => ($refs.searchInput as any)?.focus()"
    >
      <div class="relative">
        <el-input
          ref="searchInput"
          v-model="searchQuery"
          placeholder="搜索作品、素材、课程或团队..."
          :size="isMobile ? 'default' : 'large'"
          clearable
          @keyup.enter="() => { if (selectedResultIndex === -1 && flattenedResults.length > 0) selectedResultIndex = 0 }"
        >
          <template #prefix>
            <Search :class="[isMobile ? 'w-4 h-4' : 'w-5 h-5', 'text-slate-400']" />
          </template>
          <template #suffix>
            <div v-if="isSearching" class="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
          </template>
        </el-input>
      </div>

      <div :class="[isMobile ? 'mt-4 max-h-[50vh]' : 'mt-6 max-h-[60vh]', 'overflow-y-auto pr-2 custom-scrollbar']">
        <!-- Result Sections -->
        <template v-if="searchQuery.trim()">
          <!-- Assets -->
          <div v-if="searchResults.assets.length > 0" :class="isMobile ? 'mb-4' : 'mb-6'">
            <h3 class="px-2 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Box :class="isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'" /> 3D 资产 ({{ searchResults.assets.length }})
            </h3>
            <div class="space-y-1">
              <div
                v-for="(asset, index) in searchResults.assets"
                :key="asset.id"
                class="flex items-center hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors group relative"
                :class="[isMobile ? 'gap-2 px-2.5 py-1.5 rounded-lg' : 'gap-3 px-3 py-2 rounded-xl', { 'bg-slate-100 dark:bg-slate-800 ring-2 ring-accent/20': selectedResultIndex === index }]"
                @click="navigateToResult('asset', asset.id)"
                @mouseenter="selectedResultIndex = index"
              >
                <div :class="isMobile ? 'w-8 h-8 rounded-md' : 'w-10 h-10 rounded-lg'" class="bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0">
                  <img v-if="asset.thumbnail" :src="asset.thumbnail" class="w-full h-full object-cover" />
                  <ImageIcon v-else :class="[isMobile ? 'p-1.5' : 'p-2', 'w-full h-full text-slate-400']" />
                </div>
                <div class="flex-1 min-w-0">
                  <p :class="isMobile ? 'text-xs' : 'text-sm'" class="font-medium truncate" style="color: var(--text-primary)">{{ asset.title }}</p>
                  <p :class="isMobile ? 'text-[9px]' : 'text-[10px]'" class="text-slate-400 truncate">{{ asset.category?.name || '未分类' }} · {{ asset.type }}</p>
                </div>
                <ArrowRight :class="isMobile ? 'w-3 h-3' : 'w-4 h-4'" class="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>

          <!-- Courses -->
          <div v-if="searchResults.courses.length > 0" :class="isMobile ? 'mb-4' : 'mb-6'">
            <h3 class="px-2 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <GraduationCap :class="isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'" /> 学习课程 ({{ searchResults.courses.length }})
            </h3>
            <div class="space-y-1">
              <div
                v-for="(course, index) in searchResults.courses"
                :key="course.id"
                class="flex items-center hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors group relative"
                :class="[isMobile ? 'gap-2 px-2.5 py-1.5 rounded-lg' : 'gap-3 px-3 py-2 rounded-xl', { 'bg-slate-100 dark:bg-slate-800 ring-2 ring-accent/20': selectedResultIndex === (index + searchResults.assets.length) }]"
                @click="navigateToResult('course', course.id)"
                @mouseenter="selectedResultIndex = index + searchResults.assets.length"
              >
                <div :class="isMobile ? 'w-8 h-8 rounded-md' : 'w-10 h-10 rounded-lg'" class="bg-accent/10 flex items-center justify-center shrink-0">
                  <GraduationCap :class="isMobile ? 'w-4 h-4' : 'w-5 h-5'" class="text-accent" />
                </div>
                <div class="flex-1 min-w-0">
                  <p :class="isMobile ? 'text-xs' : 'text-sm'" class="font-medium truncate" style="color: var(--text-primary)">{{ course.title }}</p>
                  <p :class="isMobile ? 'text-[9px]' : 'text-[10px]'" class="text-slate-400">{{ course.difficulty }} · {{ course._count?.lessons || 0 }} 课时</p>
                </div>
                <ArrowRight :class="isMobile ? 'w-3 h-3' : 'w-4 h-4'" class="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>

          <!-- Teams -->
          <div v-if="searchResults.teams.length > 0" :class="isMobile ? 'mb-4' : 'mb-6'">
            <h3 class="px-2 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Users :class="isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'" /> 活跃团队 ({{ searchResults.teams.length }})
            </h3>
            <div class="space-y-1">
              <div
                v-for="(team, index) in searchResults.teams"
                :key="team.id"
                class="flex items-center hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors group relative"
                :class="[isMobile ? 'gap-2 px-2.5 py-1.5 rounded-lg' : 'gap-3 px-3 py-2 rounded-xl', { 'bg-slate-100 dark:bg-slate-800 ring-2 ring-accent/20': selectedResultIndex === (index + searchResults.assets.length + searchResults.courses.length) }]"
                @click="navigateToResult('team', team.id)"
                @mouseenter="selectedResultIndex = index + searchResults.assets.length + searchResults.courses.length"
              >
                <div :class="isMobile ? 'w-8 h-8 rounded-md' : 'w-10 h-10 rounded-lg'" class="bg-orange-500/10 flex items-center justify-center shrink-0">
                  <Users :class="isMobile ? 'w-4 h-4' : 'w-5 h-5'" class="text-orange-500" />
                </div>
                <div class="flex-1 min-w-0">
                  <p :class="isMobile ? 'text-xs' : 'text-sm'" class="font-medium truncate" style="color: var(--text-primary)">{{ team.name }}</p>
                  <p :class="isMobile ? 'text-[9px]' : 'text-[10px]'" class="text-slate-400">{{ team.category }} · {{ team._count?.members || 0 }} 成员</p>
                </div>
                <ArrowRight :class="isMobile ? 'w-3 h-3' : 'w-4 h-4'" class="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-if="!isSearching && flattenedResults.length === 0" :class="isMobile ? 'py-8' : 'py-12'" class="text-center">
            <Search :class="isMobile ? 'w-8 h-8 mb-2' : 'w-12 h-12 mb-4'" class="mx-auto text-slate-200" />
            <p :class="isMobile ? 'text-xs' : 'text-sm'" class="text-slate-400">未找到与 "{{ searchQuery }}" 相关的结果</p>
          </div>
        </template>

        <!-- Initial State / Recent Search -->
        <template v-else>
          <div v-if="searchHistory.length > 0" :class="isMobile ? 'mb-5' : 'mb-8'">
            <div class="flex items-center justify-between px-2 mb-2">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">搜索历史</span>
              <el-button link size="small" class="text-[10px]" @click="clearHistory">清空历史</el-button>
            </div>
            <div class="flex flex-wrap gap-2 px-1">
              <button
                v-for="h in searchHistory"
                :key="h"
                :class="isMobile ? 'px-2.5 py-1 text-[11px] rounded-md' : 'px-3 py-1.5 text-xs rounded-lg'"
                class="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-accent/10 hover:text-accent transition-all border border-transparent hover:border-accent/20"
                @click="searchQuery = h"
              >
                {{ h }}
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between px-2 mb-4">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">常用功能</span>
          </div>
          <div :class="[isMobile ? 'gap-1.5' : 'gap-2', 'grid grid-cols-1 md:grid-cols-2 px-1']">
            <div
              class="flex items-center border border-slate-100 dark:border-slate-800 hover:border-accent/50 hover:bg-accent/[0.02] cursor-pointer transition-all group"
              :class="isMobile ? 'gap-2.5 px-3 py-2.5 rounded-xl' : 'gap-3 px-4 py-3 rounded-2xl'"
              @click="router.push('/assets'); isSearchVisible = false"
            >
              <div :class="isMobile ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 rounded-xl'" class="bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                <ImageIcon :class="isMobile ? 'w-4 h-4' : 'w-5 h-5'" />
              </div>
              <div>
                <p :class="isMobile ? 'text-xs' : 'text-sm'" class="font-bold">浏览资产库</p>
                <p :class="isMobile ? 'text-[9px]' : 'text-[10px]'" class="text-slate-400">发现高质量 3D 模型</p>
              </div>
            </div>
            <div
              class="flex items-center border border-slate-100 dark:border-slate-800 hover:border-accent/50 hover:bg-accent/[0.02] cursor-pointer transition-all group"
              :class="isMobile ? 'gap-2.5 px-3 py-2.5 rounded-xl' : 'gap-3 px-4 py-3 rounded-2xl'"
              @click="router.push('/academy'); isSearchVisible = false"
            >
              <div :class="isMobile ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 rounded-xl'" class="bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                <GraduationCap :class="isMobile ? 'w-4 h-4' : 'w-5 h-5'" />
              </div>
              <div>
                <p :class="isMobile ? 'text-xs' : 'text-sm'" class="font-bold">开始学习</p>
                <p :class="isMobile ? 'text-[9px]' : 'text-[10px]'" class="text-slate-400">从基础到进阶的课程</p>
              </div>
            </div>
          </div>
        </template>
      </div>

      <template v-if="!isMobile" #footer>
        <div class="flex items-center justify-between text-[10px] text-slate-400 border-t pt-4 mt-2" style="border-color: var(--border-base)">
          <div class="flex gap-4">
            <span class="flex items-center gap-1.5"><kbd class="px-1.5 py-0.5 rounded border bg-slate-50 dark:bg-slate-900 shadow-sm">↑↓</kbd> 选择</span>
            <span class="flex items-center gap-1.5"><kbd class="px-1.5 py-0.5 rounded border bg-slate-50 dark:bg-slate-900 shadow-sm">Enter</kbd> 确认</span>
            <span class="flex items-center gap-1.5"><kbd class="px-1.5 py-0.5 rounded border bg-slate-50 dark:bg-slate-900 shadow-sm">esc</kbd> 关闭</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="opacity-50">Powered by</span>
            <span class="font-bold text-accent">{{ systemStore.settings.PLATFORM_NAME }} Search</span>
          </div>
        </div>
      </template>
    </el-dialog>

    <!-- Asset Details Drawer -->
    <AssetDetailsDrawer />

    <!-- Mobile Sidebar Drawer -->
    <Transition name="fade">
      <div
        v-if="isMobileSidebarOpen"
        class="fixed inset-0 z-40 bg-black/60 lg:hidden"
        @click="isMobileSidebarOpen = false"
      ></div>
    </Transition>

    <Transition name="slide-left">
      <aside
        v-if="isMobileSidebarOpen"
        class="fixed inset-y-0 left-0 w-32 z-50 flex flex-col h-full shadow-2xl lg:hidden glass-sidebar"
        style="will-change: transform;"
      >
        <!-- Header -->
        <div class="h-12 flex items-center justify-between px-2 border-b shrink-0" style="border-color: var(--border-base)">
          <div class="flex items-center gap-1 min-w-0">
            <div
              class="w-5.5 h-5.5 rounded-lg flex items-center justify-center overflow-hidden shrink-0"
              :class="systemStore.settings.PLATFORM_LOGO_URL ? 'bg-transparent' : 'bg-accent'"
            >
              <img
                v-if="systemStore.settings.PLATFORM_LOGO_URL"
                :src="getAssetUrl(systemStore.settings.PLATFORM_LOGO_URL)"
                class="w-full h-full object-contain"
              />
              <Box v-else class="w-3 h-3 text-white" />
            </div>
            <span class="text-[10px] font-bold truncate" style="color: var(--text-primary)">{{
              systemStore.settings.PLATFORM_NAME
            }}</span>
          </div>
          <button
            class="p-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            @click="isMobileSidebarOpen = false"
          >
            <X class="w-3.5 h-3.5" style="color: var(--text-muted)" />
          </button>
        </div>

        <!-- Navigation Menu -->
        <div class="flex-1 overflow-y-auto py-2 px-1.5 scrollbar-hide">
          <div v-for="(group, index) in menuGroups" :key="index" :class="{ 'mt-0.5': index > 0 }">
            <!-- Divider before the group if it's not the first one -->
            <div
              v-if="index > 0"
              class="mb-0.5 border-t"
              style="border-color: var(--border-base); opacity: 0.4"
            ></div>

            <h3
              v-if="group.title"
              class="px-1 mb-0 text-[8px] font-bold uppercase tracking-widest flex items-center gap-1"
              :class="
                workspaceStore.isAdminWorkspace
                  ? 'text-rose-500 dark:text-rose-400'
                  : 'text-slate-400 dark:text-slate-500'
              "
            >
              <ShieldCheck v-if="workspaceStore.isAdminWorkspace" class="w-2 h-2" />
              {{ group.title }}
            </h3>
            <ul class="space-y-0.5">
              <li v-for="item in group.items" :key="item.name">
                <RouterLink
                  :to="item.path"
                  class="flex items-center justify-between px-1.5 py-0.5 rounded-md transition-colors duration-150"
                  :class="
                    route.path === item.path
                      ? workspaceStore.isAdminWorkspace
                        ? 'bg-rose-600 text-white font-medium shadow-md'
                        : 'bg-accent-subtle dark:bg-accent/20 text-accent font-medium'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                  "
                  @click="isMobileSidebarOpen = false"
                >
                  <div class="flex items-center gap-1.5 min-w-0 flex-1">
                    <component
                      :is="item.icon"
                      class="w-3.5 h-3.5 shrink-0"
                      :class="
                        route.path === item.path
                          ? workspaceStore.isAdminWorkspace
                            ? 'text-white'
                            : 'text-accent'
                          : 'text-slate-400'
                      "
                    />
                    <span class="flex-1 text-[10px] truncate">{{ item.name }}</span>

                    <!-- High-Visibility Badge -->
                    <div
                      v-if="item.badge && item.badge > 0"
                      class="px-1 py-0.2 min-w-[14px] h-3.5 rounded-full text-[8px] font-black flex items-center justify-center transition-all duration-300 shrink-0"
                      :class="
                        route.path === item.path
                          ? 'bg-white text-rose-600 shadow-sm'
                          : 'bg-rose-500 text-white'
                      "
                    >
                      {{ item.badge > 99 ? '99+' : item.badge }}
                    </div>
                  </div>
                </RouterLink>
              </li>
            </ul>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-1 border-t space-y-0.5 shrink-0" style="border-color: var(--border-base)">
          <RouterLink
            to="/settings"
            class="flex items-center gap-1.5 px-1.5 py-0.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 rounded-md transition-colors text-[10px]"
            :class="
              route.path === '/settings' ? 'bg-accent-subtle dark:bg-accent/20 text-accent' : ''
            "
            @click="isMobileSidebarOpen = false"
          >
            <Settings
              class="w-3.5 h-3.5 shrink-0"
              :class="route.path === '/settings' ? 'text-accent' : 'text-slate-400'"
            />
            <span class="flex-1 truncate">设置选项</span>
          </RouterLink>
          <button
            class="w-full flex items-center gap-1.5 px-1.5 py-0.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 rounded-md transition-colors text-[10px]"
            @click="
              handleReportBug();
              isMobileSidebarOpen = false;
            "
          >
            <HelpCircle class="w-3.5 h-3.5 shrink-0" />
            <span class="flex-1 text-left truncate">问题反馈</span>
          </button>
        </div>
      </aside>
    </Transition>
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

/* Fade Transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Slide Left Transition */
.slide-left-enter-active,
.slide-left-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(-100%);
}

:deep(.mobile-search-dialog) {
  margin-bottom: 0 !important;
  border-radius: 16px !important;
}
:deep(.mobile-search-dialog .el-dialog__header) {
  padding: 12px 16px !important;
  margin-right: 0;
  border-bottom: none !important;
}
:deep(.mobile-search-dialog .el-dialog__body) {
  padding: 8px 16px 20px !important;
}
:deep(.mobile-search-dialog .el-dialog__headerbtn) {
  top: 12px !important;
  right: 12px !important;
}
</style>
