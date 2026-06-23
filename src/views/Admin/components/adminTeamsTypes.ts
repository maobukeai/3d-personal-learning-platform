export type TeamVisibility = 'PUBLIC' | 'PRIVATE';
export type VisibilityFilter = 'ALL' | TeamVisibility;
export type TeamRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type RiskFilter = 'ALL' | 'PENDING' | 'OVERDUE' | 'UNASSIGNED' | 'EMPTY';
export type SortBy = 'createdAt' | 'updatedAt' | 'name' | 'health';
export type SortOrder = 'asc' | 'desc';

export interface AdminTeamUser {
  id: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

export interface AdminTeamMember {
  id?: string;
  userId: string;
  role: TeamRole;
  joinedAt?: string;
  user?: AdminTeamUser;
  metrics?: {
    projects: number;
    assignedTasks: number;
    activeTasks: number;
    doneTasks: number;
    overdueTasks: number;
    dueSoonTasks: number;
    completedThisWeek: number;
    completionRate: number;
    capacityScore: number;
    lastActiveAt?: string | null;
  };
}

export interface AdminTeamCounts {
  members?: number;
  assets?: number;
  projects?: number;
  tasks?: number;
  materials?: number;
  showcases?: number;
  invitations?: number;
  applications?: number;
}

export interface AdminTeamMetrics {
  healthScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  activeTasks: number;
  doneTasks: number;
  overdueTasks: number;
  dueSoonTasks: number;
  unassignedTasks: number;
  completionRate: number;
  averageProjectProgress: number;
  pendingApplications: number;
  pendingInvitations: number;
  admins: number;
  resourceTotal: number;
  lastActivityAt?: string | null;
}

export interface AdminTeam {
  id: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  visibility?: TeamVisibility;
  category?: string | null;
  ownerId: string;
  owner: AdminTeamUser;
  members?: AdminTeamMember[];
  createdAt?: string;
  updatedAt?: string;
  _count?: AdminTeamCounts;
  metrics?: AdminTeamMetrics;
}

export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminTeamsSummary {
  totalTeams: number;
  filteredTeams: number;
  publicTeams: number;
  privateTeams: number;
  totalMembers: number;
  totalProjects: number;
  totalTasks: number;
  totalResources: number;
  totalAssets: number;
  totalMaterials: number;
  totalShowcases: number;
  pendingApplications: number;
  pendingInvitations: number;
  overdueTeams: number;
  pendingTeams: number;
  emptyTeams: number;
}

export interface AdminTeamsResponse {
  data: AdminTeam[];
  pagination: PaginationState;
  summary: AdminTeamsSummary;
  filters?: {
    categories?: string[];
  };
}

export interface AdminUsersResponse {
  data?: AdminTeamUser[];
}

export interface TeamApplication {
  id: string;
  teamId: string;
  userId: string;
  message?: string | null;
  status: string;
  createdAt: string;
  user: AdminTeamUser;
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  inviterId: string;
  inviteeEmail: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface TeamProjectHealth {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  progress: number;
  dueDate?: string | null;
  color?: string;
  visibility?: string;
  updatedAt?: string;
  membersCount: number;
  healthScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  tasks: {
    total: number;
    active: number;
    done: number;
    overdue: number;
    dueSoon: number;
    unassigned: number;
    completionRate: number;
  };
}

export interface TeamActionItem {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium';
  title: string;
  dueDate?: string | null;
  assignee?: AdminTeamUser | null;
  project?: { id: string; title: string; color?: string } | null;
  application?: TeamApplication;
}

export interface TeamActivityItem {
  id: string;
  type: string;
  title: string;
  actor?: AdminTeamUser | null;
  project?: { id: string; title: string; color?: string } | null;
  createdAt: string;
}

export interface TeamDetailResponse {
  team: AdminTeam & {
    invitations?: TeamInvitation[];
    applications?: TeamApplication[];
  };
  counts: {
    members: number;
    admins: number;
    projects: number;
    activeProjects: number;
    tasks: number;
    activeTasks: number;
    doneTasks: number;
    overdueTasks: number;
    dueSoonTasks: number;
    unassignedTasks: number;
    completedThisWeek: number;
    assets: number;
    materials: number;
    showcases: number;
    pendingApplications: number;
    pendingInvitations: number;
    averageProjectProgress: number;
    healthScore: number;
  };
  members: AdminTeamMember[];
  projectHealth: TeamProjectHealth[];
  tasks: {
    overdue: TeamActionItem[];
    dueSoon: TeamActionItem[];
    unassigned: TeamActionItem[];
    recentlyUpdated: TeamActionItem[];
  };
  resources: {
    assets: Array<{
      id: string;
      title: string;
      type: string;
      status: string;
      updatedAt: string;
      user?: AdminTeamUser;
    }>;
    materials: Array<{
      id: string;
      title: string;
      category: string;
      status: string;
      updatedAt: string;
      user?: AdminTeamUser;
    }>;
    showcases: Array<{
      id: string;
      title: string;
      type: string;
      status: string;
      updatedAt: string;
      user?: AdminTeamUser;
    }>;
  };
  invitations: TeamInvitation[];
  applications: TeamApplication[];
  actionItems: TeamActionItem[];
  activity: TeamActivityItem[];
  generatedAt: string;
}
