import { defineStore } from 'pinia';
import api from '@/utils/api';
import { useAuthStore } from './auth';

export interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'team' | 'admin';
  color: string;
  description?: string;
  badgeCount?: number;
}

export const useWorkspaceStore = defineStore('workspace', {
  state: () => ({
    rawWorkspaces: [] as Workspace[],
    activeWorkspaceId: localStorage.getItem('activeWorkspaceId') || null,
    isLoading: false,
    isInitialized: false,
    adminStats: {
      pendingAssets: 0,
      openFeedbacks: 0,
      pendingMaterials: 0,
      pendingShowcases: 0,
    },
  }),
  getters: {
    workspaces: (state): Workspace[] => {
      const authStore = useAuthStore();
      // Ensure Pinia tracks unreadMessagesCount by accessing it explicitly
      const unreadCount = authStore.unreadMessagesCount;

      return state.rawWorkspaces.map((ws) => {
        if (ws.type === 'personal') {
          return { ...ws, badgeCount: unreadCount };
        }
        if (ws.type === 'admin') {
          const total =
            state.adminStats.pendingAssets +
            state.adminStats.openFeedbacks +
            state.adminStats.pendingMaterials +
            state.adminStats.pendingShowcases;
          return { ...ws, badgeCount: total };
        }
        return ws;
      });
    },
    currentWorkspace(): Workspace | null {
      const all = this.workspaces;
      return all.find((w) => w.id === this.activeWorkspaceId) || all[0] || null;
    },
    isAdminWorkspace(): boolean {
      return this.activeWorkspaceId === 'admin-workspace';
    },
    activeTeamId(): string | null {
      const id = this.activeWorkspaceId;
      return id && id !== 'admin-workspace' ? id : null;
    },
  },
  actions: {
    async fetchWorkspaces() {
      const authStore = useAuthStore();
      try {
        const response = await api.get('/api/teams');
        const fetchedWorkspaces = response.data.map((t: any) => ({
          id: t.id,
          name: t.name,
          type: t.type.toLowerCase() as 'personal' | 'team',
          color: t.type === 'PERSONAL' ? 'bg-accent' : 'bg-orange-500',
          description: t.type === 'PERSONAL' ? '默认个人空间' : `${t._count?.members || 1} 名成员`,
        }));

        this.rawWorkspaces = fetchedWorkspaces;

        if (authStore.user?.role === 'ADMIN') {
          this.rawWorkspaces.unshift({
            id: 'admin-workspace',
            name: '管理中心',
            type: 'admin',
            color: 'bg-rose-600',
            description: '系统管理与审核',
          });
          this.fetchAdminStats();
        }

        // Validate activeWorkspaceId: must be null or exist in rawWorkspaces
        const exists = this.rawWorkspaces.some((ws) => ws.id === this.activeWorkspaceId);
        if (!exists && this.rawWorkspaces.length > 0) {
          this.activeWorkspaceId = this.rawWorkspaces[0].id;
        }

        if (this.activeWorkspaceId) {
          localStorage.setItem('activeWorkspaceId', this.activeWorkspaceId);
        }
      } catch (error) {
        console.error('Fetch workspaces error:', error);
      }
    },

    async fetchAdminStats() {
      try {
        const res = await api.get('/api/admin/stats');
        const counts = res.data.counts;
        this.adminStats = {
          pendingAssets: counts.pendingAssets || 0,
          openFeedbacks: counts.openFeedbacks || 0,
          pendingMaterials: counts.pendingMaterials || 0,
          pendingShowcases: counts.pendingShowcases || 0,
        };
      } catch (error) {
        // Silently fail if not admin or error
      }
    },

    async initialize(currentPath?: string) {
      const authStore = useAuthStore();
      // If already initialized with workspaces, or if we are a guest and already tried, skip
      if (this.isInitialized && (this.rawWorkspaces.length > 0 || !authStore.isAuthenticated)) return;

      this.isLoading = true;
      await this.fetchWorkspaces();

      // Priority: Current Route
      if (currentPath?.startsWith('/team/')) {
        this.activeWorkspaceId = currentPath.split('/')[2];
      } else if (currentPath?.startsWith('/admin/')) {
        this.activeWorkspaceId = 'admin-workspace';
      }

      if (this.activeWorkspaceId) {
        localStorage.setItem('activeWorkspaceId', this.activeWorkspaceId);
      }

      this.isInitialized = true;
      this.isLoading = false;
    },

    setWorkspace(workspace: Workspace) {
      this.activeWorkspaceId = workspace.id;
      localStorage.setItem('activeWorkspaceId', workspace.id);
      if (workspace.id === 'admin-workspace') {
        this.fetchAdminStats();
      }
    },

    async setWorkspaceById(id: string) {
      if (!this.isInitialized) {
        await this.initialize();
      }
      this.activeWorkspaceId = id;
      localStorage.setItem('activeWorkspaceId', id);
      if (id === 'admin-workspace') {
        this.fetchAdminStats();
      }
    },

    reset() {
      this.rawWorkspaces = [];
      this.activeWorkspaceId = null;
      this.isInitialized = false;
      this.isLoading = false;
      this.adminStats = {
        pendingAssets: 0,
        openFeedbacks: 0,
        pendingMaterials: 0,
        pendingShowcases: 0,
      };
    },
  },
});
