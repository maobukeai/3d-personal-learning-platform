import api from '@/utils/api';

export interface TeamWorkspaceResponse {
  id: string;
  name: string;
  type: 'PERSONAL' | 'TEAM';
  avatarUrl?: string | null;
  ownerId?: string | null;
  _count?: {
    members?: number;
  };
}

export interface ResourceWorkspaceResponse {
  id: string;
  displayName: string;
  description?: string | null;
  totalResources?: number;
  iconUrl?: string | null;
}

export interface AdminStatsResponse {
  counts: {
    pendingAssets?: number;
    openFeedbacks?: number;
    pendingMaterials?: number;
    pendingShowcases?: number;
    pendingPlugins?: number;
  };
}

export const fetchTeams = async () => {
  const { data } = await api.get('/api/teams');
  return data as TeamWorkspaceResponse[];
};

export const fetchMirrorSources = async () => {
  const { data } = await api.get('/api/mirror/sources');
  return (data || []) as ResourceWorkspaceResponse[];
};

export const fetchManualStations = async () => {
  const { data } = await api.get('/api/manual/stations');
  return (data || []) as ResourceWorkspaceResponse[];
};

export const fetchAdminStats = async () => {
  const { data } = await api.get('/api/admin/stats');
  return data as AdminStatsResponse;
};
