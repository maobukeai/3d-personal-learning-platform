import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
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
  BarChart3,
  Database,
  MessageCircle,
  Notebook,
  Terminal,
  FolderTree,
  Globe,
  Video,
  Palette,
  Cpu,
  Sparkles,
  Camera,
  Tv,
  Compass,
  Folder,
  Mail,
  ShieldCheck,
  CreditCard,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { useMirrorStore, type MirrorCategory } from '@/stores/mirror';
import { useManualStore, type ManualCategory } from '@/stores/manual';
import type { Component } from 'vue';

export interface SidebarMenuItem {
  name: string;
  icon: Component;
  path: string;
  badge?: number;
}

export interface SidebarMenuGroup {
  title: string;
  items: SidebarMenuItem[];
}

export interface MobileNavItem {
  name: string;
  icon: Component;
  path: string;
  badge?: number;
  active: (path: string) => boolean;
}

// Dynamic icon mapper for categories to make sidebar look premium and diverse
export function getCategoryIcon(name: string) {
  const lowercaseName = name.toLowerCase();

  if (
    lowercaseName.includes('视频') ||
    lowercaseName.includes('剪辑') ||
    lowercaseName.includes('播放') ||
    lowercaseName.includes('影视')
  ) {
    return Video;
  }
  if (
    lowercaseName.includes('建模') ||
    lowercaseName.includes('模型') ||
    lowercaseName.includes('渲染') ||
    lowercaseName.includes('室内') ||
    lowercaseName.includes('3d')
  ) {
    return Box;
  }
  if (
    lowercaseName.includes('绘画') ||
    lowercaseName.includes('插画') ||
    lowercaseName.includes('设计') ||
    lowercaseName.includes('平面') ||
    lowercaseName.includes('ui') ||
    lowercaseName.includes('美术')
  ) {
    return Palette;
  }
  if (
    lowercaseName.includes('摄影') ||
    lowercaseName.includes('拍照') ||
    lowercaseName.includes('相机') ||
    lowercaseName.includes('特效')
  ) {
    return Camera;
  }
  if (
    lowercaseName.includes('场景') ||
    lowercaseName.includes('环境') ||
    lowercaseName.includes('地图') ||
    lowercaseName.includes('关卡')
  ) {
    return Compass;
  }
  if (
    lowercaseName.includes('软件') ||
    lowercaseName.includes('工具') ||
    lowercaseName.includes('系统') ||
    lowercaseName.includes('引擎')
  ) {
    return Cpu;
  }
  if (
    lowercaseName.includes('aigc') ||
    lowercaseName.includes('ai') ||
    lowercaseName.includes('智能') ||
    lowercaseName.includes('生成')
  ) {
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

export function useSidebarMenus() {
  const { t } = useI18n();
  const route = useRoute();
  const authStore = useAuthStore();
  const workspaceStore = useWorkspaceStore();
  const mirrorStore = useMirrorStore();
  const manualStore = useManualStore();

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
        { name: '轮播管理', icon: ImageIcon, path: '/admin/banners' },
        { name: '订阅管理', icon: CreditCard, path: '/admin/subscriptions' },
        { name: '镜像源管理', icon: Globe, path: '/admin/mirror' },
        { name: '资源站管理', icon: Database, path: '/admin/manual' },
        { name: '系统设置', icon: Settings, path: '/admin/settings' },
      ],
    },
  ]);

  const mirrorGroups = computed<SidebarMenuGroup[]>(() => {
    const currentSourceId = workspaceStore.currentWorkspace?.mirrorSourceId;
    if (!currentSourceId) return [];

    const mainGroup: SidebarMenuGroup = {
      title: workspaceStore.currentWorkspace?.name || '镜像资源',
      items: [
        {
          name: '全部资源',
          icon: Database,
          path: `/mirror/source/${currentSourceId}`,
        },
      ],
    };

    const groups: SidebarMenuGroup[] = [mainGroup];

    const categories = mirrorStore.categories || [];
    if (categories.length) {
      // 1. Group categories by parentExternalId
      const parentMap = new Map<string, MirrorCategory[]>();
      categories.forEach((cat) => {
        if (cat.parentExternalId) {
          if (!parentMap.has(cat.parentExternalId)) {
            parentMap.set(cat.parentExternalId, []);
          }
          parentMap.get(cat.parentExternalId)!.push(cat);
        }
      });

      // 2. Identify top level and check if they have children
      const topLevel: MirrorCategory[] = [];
      categories.forEach((cat) => {
        const hasParent =
          cat.parentExternalId && categories.some((p) => p.externalId === cat.parentExternalId);
        if (!hasParent) {
          topLevel.push(cat);
        }
      });

      // Sort top level by order
      topLevel.sort((a, b) => (a.order || 0) - (b.order || 0));

      topLevel.forEach((parent) => {
        const children = parentMap.get(parent.externalId) || [];
        if (children.length > 0) {
          // Create a new sidebar group
          const childItems = children
            .map((child) => ({
              name: child.name,
              icon: getCategoryIcon(child.name),
              path: `/mirror/source/${currentSourceId}?categoryId=${child.id}`,
            }))
            .sort((a, b) => {
              const childA = children.find((c) => c.name === a.name);
              const childB = children.find((c) => c.name === b.name);
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
          path: `/manual/station/${currentStationId}`,
        },
      ],
    };

    const groups: SidebarMenuGroup[] = [mainGroup];

    const categories = manualStore.categories || [];
    if (categories.length) {
      // 1. Group categories by parentId
      const parentMap = new Map<string, ManualCategory[]>();
      categories.forEach((cat) => {
        if (cat.parentId) {
          if (!parentMap.has(cat.parentId)) {
            parentMap.set(cat.parentId, []);
          }
          parentMap.get(cat.parentId)!.push(cat);
        }
      });

      // 2. Identify top level and check if they have children
      const topLevel: ManualCategory[] = [];
      categories.forEach((cat) => {
        const hasParent = cat.parentId && categories.some((p) => p.id === cat.parentId);
        if (!hasParent) {
          topLevel.push(cat);
        }
      });

      // Sort top level by order
      topLevel.sort((a, b) => (a.order || 0) - (b.order || 0));

      topLevel.forEach((parent) => {
        const children = parentMap.get(parent.id) || [];
        if (children.length > 0) {
          // Create a new sidebar group
          const childItems = children
            .map((child) => ({
              name: child.name,
              icon: getCategoryIcon(child.name),
              path: `/manual/station/${currentStationId}?categoryId=${child.id}`,
            }))
            .sort((a, b) => {
              const childA = children.find((c) => c.name === a.name);
              const childB = children.find((c) => c.name === b.name);
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
        title: t('sidebar.groups.learning'),
        items: [
          { name: t('sidebar.dashboard'), icon: LayoutDashboard, path: '/dashboard' },
          { name: t('sidebar.work'), icon: Briefcase, path: '/work' },
          { name: t('sidebar.roadmaps'), icon: MapPin, path: '/roadmaps' },
          { name: t('sidebar.academy'), icon: GraduationCap, path: '/academy' },
          { name: t('sidebar.notes'), icon: Notebook, path: '/notes' },
        ],
      },
      {
        title: t('sidebar.groups.collaboration'),
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
        title: t('sidebar.groups.resources'),
        items: [
          { name: t('sidebar.myWorks'), icon: Box, path: '/my-works' },
          { name: t('sidebar.assets'), icon: ImageIcon, path: '/assets' },
          { name: t('sidebar.materials'), icon: Layers, path: '/materials' },
        ],
      },
      {
        title: t('sidebar.groups.community'),
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
      {
        title: t('sidebar.groups.tools'),
        items: [{ name: t('sidebar.emailSystem'), icon: Mail, path: '/tools/email' }],
      },
    ];
  });

  const mobileNavItems = computed<MobileNavItem[]>(() => {
    if (route.path.startsWith('/admin')) {
      return [
        {
          name: '概览',
          icon: BarChart3,
          path: '/admin/dashboard',
          active: (path) => path === '/admin/dashboard',
        },
        {
          name: '用户',
          icon: Users,
          path: '/admin/users',
          active: (path) => path.startsWith('/admin/users'),
        },
        {
          name: '审核',
          icon: ShieldCheck,
          path: '/admin/audits',
          badge:
            workspaceStore.adminStats.pendingAssets +
            workspaceStore.adminStats.pendingMaterials +
            workspaceStore.adminStats.pendingShowcases,
          active: (path) =>
            path.startsWith('/admin/audits') ||
            path.startsWith('/admin/assets') ||
            path.startsWith('/admin/materials'),
        },
        {
          name: '课程',
          icon: GraduationCap,
          path: '/admin/courses',
          active: (path) =>
            path.startsWith('/admin/courses') ||
            path.startsWith('/admin/roadmaps') ||
            path.startsWith('/admin/categories'),
        },
        {
          name: '设置',
          icon: Settings,
          path: '/admin/settings',
          active: (path) => path.startsWith('/admin/settings'),
        },
      ];
    }

    return [
      {
        name: t('sidebar.dashboard'),
        icon: LayoutDashboard,
        path: '/dashboard',
        active: (path) => path === '/dashboard' || path.startsWith('/dashboard'),
      },
      {
        name: t('sidebar.academy'),
        icon: GraduationCap,
        path: '/academy',
        active: (path) => path.startsWith('/academy') || path.startsWith('/roadmaps'),
      },
      {
        name: t('sidebar.showcase'),
        icon: MonitorPlay,
        path: '/showcase',
        active: (path) =>
          path.startsWith('/showcase') || path.startsWith('/assets') || path.startsWith('/my-works'),
      },
      {
        name: t('sidebar.discussions'),
        icon: MessageSquare,
        path: '/discussions',
        active: (path) => path.startsWith('/discussions') || path.startsWith('/members'),
      },
      {
        name: t('sidebar.messages'),
        icon: MessageCircle,
        path: '/messages',
        badge: authStore.unreadMessagesCount,
        active: (path) => path.startsWith('/messages'),
      },
    ];
  });

  return {
    menuGroups,
    mobileNavItems,
  };
}
