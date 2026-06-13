import { computed, type Component } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  BarChart3,
  Bot,
  Box,
  Briefcase,
  Camera,
  Compass,
  Cpu,
  CreditCard,
  Database,
  Folder,
  FolderTree,
  Gauge,
  Globe,
  GraduationCap,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  MonitorPlay,
  Notebook,
  Palette,
  Settings,
  ShieldCheck,
  Sparkles,
  Terminal,
  Tv,
  Users,
  Video,
  KeyRound,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { useMirrorStore, type MirrorCategory } from '@/stores/mirror';
import { useManualStore, type ManualCategory } from '@/stores/manual';

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

export function getCategoryIcon(name: string) {
  const lowercaseName = name.toLowerCase();

  if (/(视频|剪辑|播放|影视|video|movie|film)/i.test(lowercaseName)) return Video;
  if (/(建模|模型|渲染|室内|3d|model|render)/i.test(lowercaseName)) return Box;
  if (/(绘画|插画|设计|平面|美术|ui|art|design)/i.test(lowercaseName)) return Palette;
  if (/(摄影|拍照|相机|特效|camera|photo|vfx)/i.test(lowercaseName)) return Camera;
  if (/(场景|环境|地图|关卡|scene|environment|level)/i.test(lowercaseName)) return Compass;
  if (/(软件|工具|系统|引擎|tool|engine|software)/i.test(lowercaseName)) return Cpu;
  if (/(aigc|ai|智能|生成)/i.test(lowercaseName)) return Sparkles;

  const icons = [Folder, Layers, Database, MonitorPlay, Tv];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return icons[Math.abs(hash) % icons.length];
}

export function useSidebarMenus() {
  const { t, locale } = useI18n();
  const route = useRoute();
  const authStore = useAuthStore();
  const workspaceStore = useWorkspaceStore();
  const mirrorStore = useMirrorStore();
  const manualStore = useManualStore();
  const label = (zh: string, en: string) => (locale.value === 'en-US' ? en : zh);

  const adminGroups = computed<SidebarMenuGroup[]>(() => [
    {
      title: label('系统概览', 'System'),
      items: [
        { name: label('平台概览', 'Overview'), icon: BarChart3, path: '/admin/dashboard' },
        { name: label('指挥中心', 'Command Center'), icon: Gauge, path: '/admin/command-center' },
        { name: label('审计日志', 'Audit Logs'), icon: Terminal, path: '/admin/audit-logs' },
      ],
    },
    {
      title: label('用户与团队', 'Users & Teams'),
      items: [
        { name: label('用户管理', 'Users'), icon: Users, path: '/admin/users' },
        { name: label('团队管理', 'Teams'), icon: Briefcase, path: '/admin/teams' },
        {
          name: label('用户反馈', 'Feedback'),
          icon: MessageCircle,
          path: '/admin/feedback',
          badge: workspaceStore.adminStats.openFeedbacks,
        },
      ],
    },
    {
      title: label('内容审核', 'Review'),
      items: [
        {
          name: label('审核中心', 'Review Center'),
          icon: ShieldCheck,
          path: '/admin/audits',
          badge:
            workspaceStore.adminStats.pendingAssets +
            workspaceStore.adminStats.pendingMaterials +
            workspaceStore.adminStats.pendingShowcases +
            workspaceStore.adminStats.pendingPlugins,
        },
      ],
    },
    {
      title: label('教学管理', 'Learning'),
      items: [
        { name: label('课程管理', 'Courses'), icon: GraduationCap, path: '/admin/courses' },
        { name: label('路线管理', 'Roadmaps'), icon: MapPin, path: '/admin/roadmaps' },
        { name: label('分类管理', 'Categories'), icon: FolderTree, path: '/admin/categories' },
      ],
    },
    {
      title: label('运营管理', 'Operations'),
      items: [
        { name: label('轮播管理', 'Banners'), icon: ImageIcon, path: '/admin/banners' },
        {
          name: label('订阅管理', 'Subscriptions'),
          icon: CreditCard,
          path: '/admin/subscriptions',
        },
        { name: label('镜像源管理', 'Mirror Sources'), icon: Globe, path: '/admin/mirror' },
        { name: label('资源站管理', 'Resource Stations'), icon: Database, path: '/admin/manual' },
        { name: label('系统设置', 'Settings'), icon: Settings, path: '/admin/settings' },
      ],
    },
  ]);

  const mirrorGroups = computed<SidebarMenuGroup[]>(() => {
    const currentSourceId = workspaceStore.currentWorkspace?.mirrorSourceId;
    if (!currentSourceId) return [];

    const mainGroup: SidebarMenuGroup = {
      title: workspaceStore.currentWorkspace?.name || label('镜像资源', 'Mirror Resources'),
      items: [
        {
          name: label('全部资源', 'All Resources'),
          icon: Database,
          path: `/mirror/source/${currentSourceId}`,
        },
      ],
    };

    const groups: SidebarMenuGroup[] = [mainGroup];
    const categories = mirrorStore.categories || [];
    if (!categories.length) return groups;

    const parentMap = new Map<string, MirrorCategory[]>();
    categories.forEach((category) => {
      if (!category.parentExternalId) return;
      if (!parentMap.has(category.parentExternalId)) {
        parentMap.set(category.parentExternalId, []);
      }
      parentMap.get(category.parentExternalId)!.push(category);
    });

    const topLevel = categories
      .filter((category) => {
        const hasParent =
          category.parentExternalId &&
          categories.some((parent) => parent.externalId === category.parentExternalId);
        return !hasParent;
      })
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    topLevel.forEach((parent) => {
      const children = (parentMap.get(parent.externalId) || []).sort(
        (a, b) => (a.order || 0) - (b.order || 0),
      );

      if (!children.length) {
        mainGroup.items.push({
          name: parent.name,
          icon: getCategoryIcon(parent.name),
          path: `/mirror/source/${currentSourceId}?categoryId=${parent.id}`,
        });
        return;
      }

      groups.push({
        title: parent.name,
        items: [
          {
            name: `${label('全部', 'All')} ${parent.name}`,
            icon: getCategoryIcon(parent.name),
            path: `/mirror/source/${currentSourceId}?categoryId=${parent.id}`,
          },
          ...children.map((child) => ({
            name: child.name,
            icon: getCategoryIcon(child.name),
            path: `/mirror/source/${currentSourceId}?categoryId=${child.id}`,
          })),
        ],
      });
    });

    return groups;
  });

  const manualGroups = computed<SidebarMenuGroup[]>(() => {
    const currentStationId = workspaceStore.currentWorkspace?.manualStationId;
    if (!currentStationId) return [];

    const mainGroup: SidebarMenuGroup = {
      title: workspaceStore.currentWorkspace?.name || label('手动资源站', 'Manual Station'),
      items: [
        {
          name: label('全部资源', 'All Resources'),
          icon: Database,
          path: `/manual/station/${currentStationId}`,
        },
      ],
    };

    const groups: SidebarMenuGroup[] = [mainGroup];
    const categories = manualStore.categories || [];
    if (!categories.length) return groups;

    const parentMap = new Map<string, ManualCategory[]>();
    categories.forEach((category) => {
      if (!category.parentId) return;
      if (!parentMap.has(category.parentId)) {
        parentMap.set(category.parentId, []);
      }
      parentMap.get(category.parentId)!.push(category);
    });

    const topLevel = categories
      .filter((category) => {
        const hasParent =
          category.parentId && categories.some((parent) => parent.id === category.parentId);
        return !hasParent;
      })
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    topLevel.forEach((parent) => {
      const children = (parentMap.get(parent.id) || []).sort(
        (a, b) => (a.order || 0) - (b.order || 0),
      );

      if (!children.length) {
        mainGroup.items.push({
          name: parent.name,
          icon: getCategoryIcon(parent.name),
          path: `/manual/station/${currentStationId}?categoryId=${parent.id}`,
        });
        return;
      }

      groups.push({
        title: parent.name,
        items: [
          {
            name: `${label('全部', 'All')} ${parent.name}`,
            icon: getCategoryIcon(parent.name),
            path: `/manual/station/${currentStationId}?categoryId=${parent.id}`,
          },
          ...children.map((child) => ({
            name: child.name,
            icon: getCategoryIcon(child.name),
            path: `/manual/station/${currentStationId}?categoryId=${child.id}`,
          })),
        ],
      });
    });

    return groups;
  });

  const menuGroups = computed<SidebarMenuGroup[]>(() => {
    if (workspaceStore.isAdminWorkspace) return adminGroups.value;
    if (workspaceStore.currentWorkspace?.type === 'mirror') return mirrorGroups.value;
    if (workspaceStore.currentWorkspace?.type === 'manual') return manualGroups.value;

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
          ...((workspaceStore.currentWorkspace?.type === 'team' || workspaceStore.currentWorkspace?.type === 'personal') && workspaceStore.currentWorkspace?.id
            ? [
                {
                  name: workspaceStore.currentWorkspace.type === 'personal'
                    ? t('sidebar.personalSpace')
                    : t('sidebar.teamSpace'),
                  icon: Users,
                  path: `/team/${workspaceStore.currentWorkspace.id}`,
                },
              ]
            : []),
          { name: t('sidebar.exploreTeams'), icon: Globe, path: '/explore-teams' },
          { name: t('sidebar.projects'), icon: FolderTree, path: '/projects' },
        ],
      },
      {
        title: t('sidebar.groups.resources'),
        items: [
          { name: t('sidebar.resourceCenter'), icon: Database, path: '/resources' },
          { name: t('sidebar.myWorks'), icon: Box, path: '/my-works' },
          { name: t('sidebar.assets'), icon: ImageIcon, path: '/assets' },
          { name: t('sidebar.materials'), icon: Layers, path: '/materials' },
          { name: t('sidebar.plugins'), icon: Cpu, path: '/plugins' },
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
        items: [
          { name: t('sidebar.aiRobotAccess'), icon: Bot, path: '/tools/ai-robots' },
          { name: t('sidebar.emailSystem'), icon: Mail, path: '/tools/email' },
          { name: t('sidebar.googleWarming'), icon: ShieldCheck, path: '/tools/google-warming' },
          { name: t('sidebar.twoFactorAuth'), icon: KeyRound, path: '/tools/two-factor' },
        ],
      },
    ];
  });

  const mobileNavItems = computed<MobileNavItem[]>(() => {
    if (route.path.startsWith('/admin')) {
      return [
        {
          name: label('指挥', 'Command'),
          icon: Gauge,
          path: '/admin/command-center',
          active: (path) => path === '/admin/command-center' || path === '/admin/dashboard',
        },
        {
          name: label('用户', 'Users'),
          icon: Users,
          path: '/admin/users',
          active: (path) => path.startsWith('/admin/users'),
        },
        {
          name: label('审核', 'Review'),
          icon: ShieldCheck,
          path: '/admin/audits',
          badge:
            workspaceStore.adminStats.pendingAssets +
            workspaceStore.adminStats.pendingMaterials +
            workspaceStore.adminStats.pendingShowcases +
            workspaceStore.adminStats.pendingPlugins,
          active: (path) =>
            path.startsWith('/admin/audits') ||
            path.startsWith('/admin/assets') ||
            path.startsWith('/admin/materials'),
        },
        {
          name: label('课程', 'Courses'),
          icon: GraduationCap,
          path: '/admin/courses',
          active: (path) =>
            path.startsWith('/admin/courses') ||
            path.startsWith('/admin/roadmaps') ||
            path.startsWith('/admin/categories'),
        },
        {
          name: label('设置', 'Settings'),
          icon: Settings,
          path: '/admin/settings',
          active: (path) => path.startsWith('/admin/settings'),
        },
      ];
    }

    return [
      {
        name: label('工作台', 'Home'),
        icon: LayoutDashboard,
        path: '/dashboard',
        active: (path) => path === '/dashboard' || path.startsWith('/dashboard'),
      },
      {
        name: label('学院', 'Learn'),
        icon: GraduationCap,
        path: '/academy',
        active: (path) => path.startsWith('/academy') || path.startsWith('/roadmaps'),
      },
      {
        name: label('展示', 'Works'),
        icon: MonitorPlay,
        path: '/showcase',
        active: (path) =>
          path.startsWith('/showcase') ||
          path.startsWith('/assets') ||
          path.startsWith('/my-works'),
      },
      {
        name: label('社区', 'Community'),
        icon: MessageSquare,
        path: '/discussions',
        active: (path) => path.startsWith('/discussions'),
      },
      {
        name: label('消息', 'Messages'),
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
