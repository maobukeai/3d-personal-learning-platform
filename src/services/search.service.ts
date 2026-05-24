import api from '@/utils/api';

export type GlobalSearchType = 'asset' | 'course' | 'team';

export interface GlobalSearchItem {
  id: string;
  searchType?: GlobalSearchType;
  title?: string;
  name?: string;
  thumbnail?: string | null;
  type?: string;
  difficulty?: string;
  category?: {
    id?: string;
    name?: string;
  } | string | null;
  _count?: {
    lessons?: number;
    members?: number;
  };
}

export interface GlobalSearchResults {
  assets: GlobalSearchItem[];
  courses: GlobalSearchItem[];
  teams: GlobalSearchItem[];
}

export const emptyGlobalSearchResults = (): GlobalSearchResults => ({
  assets: [],
  courses: [],
  teams: [],
});

export const searchGlobal = async (query: string): Promise<GlobalSearchResults> => {
  const [assetsRes, coursesRes, teamsRes] = await Promise.all([
    api.get('/api/assets/public', { params: { search: query, limit: 5 } }),
    api.get('/api/courses', { params: { search: query } }),
    api.get('/api/teams/public', { params: { search: query } }),
  ]);

  return {
    assets: assetsRes.data.assets || [],
    courses: (coursesRes.data || []).slice(0, 5),
    teams: (teamsRes.data || []).slice(0, 5),
  };
};
