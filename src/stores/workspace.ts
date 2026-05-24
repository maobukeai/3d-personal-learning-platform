import { defineStore } from 'pinia';
import { useAuthStore } from './auth';
import { preferences } from '@/utils/preferences';
import {
  fetchAdminStats as fetchAdminStatsRequest,
  fetchManualStations,
  fetchMirrorSources,
  fetchTeams,
} from '@/services/workspace.service';
import type { Asset } from '@/types';

export interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'team' | 'admin' | 'mirror' | 'manual';
  color: string;
  description?: string;
  badgeCount?: number;
  mirrorSourceId?: string;
  manualStationId?: string;
  avatarUrl?: string | null;
}

export const useWorkspaceStore = defineStore('workspace', {
  state: () => ({
    rawWorkspaces: [] as Workspace[],
    activeWorkspaceId: preferences.getActiveWorkspaceId(),
    isLoading: false,
    isInitialized: false,
    adminStats: {
      pendingAssets: 0,
      openFeedbacks: 0,
      pendingMaterials: 0,
      pendingShowcases: 0,
    },
    selectedAsset: null as Asset | null,
    isDetailDrawerOpen: false,
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
      if (!authStore.isAuthenticated) return;

      try {
        const teams = await fetchTeams();
        const fetchedWorkspaces = teams.map((t) => ({
          id: t.id,
          name: t.name,
          type: t.type.toLowerCase() as 'personal' | 'team',
          color: t.type === 'PERSONAL' ? 'bg-accent' : 'bg-orange-500',
          description: t.type === 'PERSONAL' ? '默认个人空间' : `${t._count?.members || 1} 名成员`,
          avatarUrl: t.avatarUrl || (t.type === 'PERSONAL' ? authStore.user?.avatarUrl : null),
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

        // Fetch Mirror Sources
        try {
          const mirrorSources = await fetchMirrorSources();
          for (const ms of mirrorSources) {
            this.rawWorkspaces.push({
              id: `mirror-${ms.id}`,
              name: ms.displayName,
              type: 'mirror',
              color: 'bg-violet-600',
              description: ms.description || `${ms.totalResources} 个资源`,
              mirrorSourceId: ms.id,
              avatarUrl: ms.iconUrl,
            });
          }
        } catch (_e) {
          // Mirror sources not available, skip
        }

        // Fetch Manual Stations
        try {
          const manualStations = await fetchManualStations();
          for (const ms of manualStations) {
            this.rawWorkspaces.push({
              id: `manual-${ms.id}`,
              name: ms.displayName,
              type: 'manual',
              color: 'bg-cyan-600',
              description: ms.description || `手动资源站 (${ms.totalResources} 个资源)`,
              manualStationId: ms.id,
              avatarUrl: ms.iconUrl,
            });
          }
        } catch (_e) {
          // Manual stations not available, skip
        }

        // Validate activeWorkspaceId: must be null or exist in rawWorkspaces
        const exists = this.rawWorkspaces.some((ws) => ws.id === this.activeWorkspaceId);
        if (!exists && this.rawWorkspaces.length > 0) {
          this.activeWorkspaceId = this.rawWorkspaces[0].id;
        }

        if (this.activeWorkspaceId) {
          preferences.setActiveWorkspaceId(this.activeWorkspaceId);
        }
      } catch (error) {
        console.error('Fetch workspaces error:', error);
      }
    },

    async fetchAdminStats() {
      const authStore = useAuthStore();
      if (!authStore.isAuthenticated || authStore.user?.role !== 'ADMIN') return;

      try {
        const res = await fetchAdminStatsRequest();
        const counts = res.counts;
        this.adminStats = {
          pendingAssets: counts.pendingAssets || 0,
          openFeedbacks: counts.openFeedbacks || 0,
          pendingMaterials: counts.pendingMaterials || 0,
          pendingShowcases: counts.pendingShowcases || 0,
        };
      } catch (_error) {
        // Silently fail if not admin or error
      }
    },

    async initialize(currentPath?: string) {
      const authStore = useAuthStore();

      // If not authenticated, we are a guest, no workspaces to fetch
      if (!authStore.isAuthenticated) {
        this.isInitialized = true;
        this.isLoading = false;
        return;
      }

      // If already initialized with workspaces, skip
      if (this.isInitialized && this.rawWorkspaces.length > 0) return;

      this.isInitialized = false;
      this.isLoading = true;
      await this.fetchWorkspaces();

      // Priority: Current Route
      if (currentPath?.startsWith('/team/')) {
        this.activeWorkspaceId = currentPath.split('/')[2];
      } else if (currentPath?.startsWith('/admin/')) {
        this.activeWorkspaceId = 'admin-workspace';
      } else if (currentPath?.startsWith('/mirror/source/')) {
        const sourceId = currentPath.split('/')[3];
        this.activeWorkspaceId = `mirror-${sourceId}`;
      } else if (currentPath?.startsWith('/manual/station/')) {
        const stationId = currentPath.split('/')[3];
        this.activeWorkspaceId = `manual-${stationId}`;
      }

      if (this.activeWorkspaceId) {
        preferences.setActiveWorkspaceId(this.activeWorkspaceId);
      }

      this.isInitialized = true;
      this.isLoading = false;
    },

    setWorkspace(workspace: Workspace) {
      this.activeWorkspaceId = workspace.id;
      preferences.setActiveWorkspaceId(workspace.id);
      if (workspace.id === 'admin-workspace') {
        this.fetchAdminStats();
      }
    },

    async setWorkspaceById(id: string) {
      if (!this.isInitialized) {
        await this.initialize();
      }
      this.activeWorkspaceId = id;
      preferences.setActiveWorkspaceId(id);
      if (id === 'admin-workspace') {
        this.fetchAdminStats();
      }
    },

    openDetails(asset: Asset) {
      this.selectedAsset = asset;
      this.isDetailDrawerOpen = true;
    },

    closeDetails() {
      this.isDetailDrawerOpen = false;
    },

    reset() {
      this.rawWorkspaces = [];
      this.activeWorkspaceId = null;
      this.isInitialized = false;
      this.isLoading = false;
      this.selectedAsset = null;
      this.isDetailDrawerOpen = false;
      this.adminStats = {
        pendingAssets: 0,
        openFeedbacks: 0,
        pendingMaterials: 0,
        pendingShowcases: 0,
      };
    },
  },
});
