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
    workspaces: [] as Workspace[],
    currentWorkspace: null as Workspace | null,
    isLoading: false,
    isInitialized: false
  }),
  getters: {
    activeTeamId: (state) => (state.currentWorkspace && state.currentWorkspace.type !== 'admin' ? state.currentWorkspace.id : null),
    isPersonal: (state) => state.currentWorkspace?.type === 'personal',
    isAdminWorkspace: (state) => state.currentWorkspace?.type === 'admin'
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
          badgeCount: t.type === 'PERSONAL' ? authStore.unreadMessagesCount : 0
        }));

        this.workspaces = fetchedWorkspaces;

        // Add Admin Workspace if user is ADMIN
        if (authStore.user?.role === 'ADMIN') {
          this.workspaces.unshift({
            id: 'admin-workspace',
            name: '管理中心',
            type: 'admin',
            color: 'bg-rose-600',
            description: '系统管理与审核',
            badgeCount: 3
          });
        }
      } catch (error) {
        console.error('Fetch workspaces error:', error);
      }
    },

    async initialize(currentPath?: string) {
      if (this.isInitialized && this.workspaces.length > 0) return;
      
      this.isLoading = true;
      await this.fetchWorkspaces();

      let targetId: string | null = null;

      // 1. Priority: Current Route
      if (currentPath?.startsWith('/team/')) {
        targetId = currentPath.split('/')[2];
      } else if (currentPath?.startsWith('/admin/')) {
        targetId = 'admin-workspace';
      }

      // 2. Fallback: LocalStorage
      if (!targetId) {
        targetId = localStorage.getItem('activeWorkspaceId');
      }

      // 3. Final Fallback: Personal or First available
      const ws = targetId ? this.workspaces.find(w => w.id === targetId) : null;
      if (ws) {
        this.currentWorkspace = ws;
      } else {
        const personal = this.workspaces.find(w => w.type === 'personal');
        this.currentWorkspace = personal || this.workspaces[0] || null;
      }

      if (this.currentWorkspace) {
        localStorage.setItem('activeWorkspaceId', this.currentWorkspace.id);
      }

      this.isInitialized = true;
      this.isLoading = false;
    },

    setWorkspace(workspace: Workspace) {
      this.currentWorkspace = workspace;
      localStorage.setItem('activeWorkspaceId', workspace.id);
    },

    async setWorkspaceById(id: string) {
      if (this.workspaces.length === 0) {
        await this.fetchWorkspaces();
      }
      const ws = this.workspaces.find(w => w.id === id);
      if (ws) {
        this.currentWorkspace = ws;
        localStorage.setItem('activeWorkspaceId', id);
      }
    }
  }
});
