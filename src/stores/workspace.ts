import { defineStore } from 'pinia';
import api from '@/utils/api';

export interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'team';
  color: string;
}

export const useWorkspaceStore = defineStore('workspace', {
  state: () => ({
    workspaces: [] as Workspace[],
    currentWorkspace: null as Workspace | null,
    isLoading: false
  }),
  getters: {
    activeTeamId: (state) => state.currentWorkspace?.id || null,
    isPersonal: (state) => state.currentWorkspace?.type === 'personal'
  },
  actions: {
    async fetchWorkspaces() {
      this.isLoading = true;
      try {
        const response = await api.get('/api/teams');
        this.workspaces = response.data.map((t: any) => ({
          id: t.id,
          name: t.name,
          type: t.type.toLowerCase(),
          color: t.type === 'PERSONAL' ? 'bg-accent' : 'bg-orange-500'
        }));
        
        // Restore from localStorage if possible
        const savedId = localStorage.getItem('activeWorkspaceId');
        const restored = savedId ? this.workspaces.find(w => w.id === savedId) : null;

        if (restored) {
          this.currentWorkspace = restored;
        } else if (!this.currentWorkspace || !this.workspaces.find(w => w.id === this.currentWorkspace?.id)) {
          const personal = this.workspaces.find(w => w.type === 'personal');
          if (personal) {
            this.currentWorkspace = personal;
          } else if (this.workspaces.length > 0) {
            this.currentWorkspace = this.workspaces[0];
          }
        }
      } catch (error) {
        console.error('Fetch workspaces error:', error);
      } finally {
        this.isLoading = false;
      }
    },
    setWorkspace(workspace: Workspace) {
      this.currentWorkspace = workspace;
      localStorage.setItem('activeWorkspaceId', workspace.id);
    },
    setWorkspaceById(id: string) {
      localStorage.setItem('activeWorkspaceId', id);
      const ws = this.workspaces.find(w => w.id === id);
      if (ws) {
        this.currentWorkspace = ws;
      }
    }
  }
});
