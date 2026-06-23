export interface ExploreTeam {
  id: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  memberCount?: number;
  _count?: {
    members?: number;
  };
}
