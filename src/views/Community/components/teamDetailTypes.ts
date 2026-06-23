import type { Component } from 'vue';

export interface TeamUser {
  id: string;
  name: string;
  avatarUrl?: string | null;
  email?: string;
  role?: string;
}

export interface DetailedMember {
  id: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  user: TeamUser;
  joinedAt?: string;
}

export interface DetailedInvitation {
  id: string;
  inviteeEmail: string;
  role: string;
  createdAt: string;
}

export interface DetailedApplication {
  id: string;
  userId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  user: TeamUser;
  createdAt: string;
  message?: string | null;
}

export interface DetailedTeam {
  id: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  type: 'PERSONAL' | 'TEAM';
  visibility: 'PUBLIC' | 'PRIVATE';
  category?: string | null;
  ownerId: string;
  createdAt?: string;
  members: DetailedMember[];
  invitations?: DetailedInvitation[];
  applications?: DetailedApplication[];
}

export type TeamRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type RecommendationSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface MemberMetrics {
  projects: number;
  assignedTasks: number;
  activeTasks: number;
  doneTasks: number;
  dueSoonTasks: number;
  overdueTasks: number;
  recentlyCompleted: number;
  completionRate: number;
  lastTaskAt?: string | null;
}

export interface OverviewMember {
  userId: string;
  role: TeamRole;
  metrics: MemberMetrics;
}

export interface TeamOverview {
  currentUserRole: TeamRole | 'ADMIN' | null;
  capabilities: {
    canManage: boolean;
    canInvite: boolean;
    canUpdateRoles: boolean;
    canRemoveMembers: boolean;
    canLeave: boolean;
  };
  counts: {
    members: number;
    admins: number;
    pendingInvitations: number;
    pendingApplications: number;
    projects: number;
    activeProjects: number;
    tasks: number;
    overdueTasks: number;
    dueSoonTasks: number;
    completedThisWeek: number;
  };
  members: OverviewMember[];
  invitations: DetailedInvitation[];
  applications: DetailedApplication[];
}

export interface InsightUser {
  id: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

export interface InsightActionItem {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  dueDate?: string | null;
  projectId?: string | null;
  assignee?: InsightUser | null;
  targetRoute: string;
}

export interface InsightActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  actor?: InsightUser | null;
  createdAt: string;
  targetRoute: string;
}

export interface InsightProjectHealth {
  id: string;
  title: string;
  healthScore: number;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  reasons: string[];
}

export interface InsightMemberCapacity {
  userId: string;
  focus: string;
  capacityScore: number;
  activeTasks: number;
  overdueTasks: number;
  completedThisWeek: number;
}

export interface TeamCollaborationInsights {
  summary: {
    healthScore: number;
    completedThisWeek: number;
    overdueTasks: number;
    dueSoonTasks: number;
    unassignedTasks: number;
    highRiskProjects: number;
    pendingApplications: number;
  };
  projectHealth: InsightProjectHealth[];
  memberCapacity: InsightMemberCapacity[];
  actionItems: InsightActionItem[];
  activity: InsightActivityItem[];
}

export interface MemberRow extends DetailedMember {
  metrics: MemberMetrics;
}

export interface MemberInsightTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  updatedAt: string;
  project?: {
    id: string;
    title: string;
    color?: string | null;
  } | null;
  targetRoute: string;
}

export interface MemberInsightProject {
  id: string;
  title: string;
  progress: number;
  status: string;
  dueDate?: string | null;
  role: string;
  taskCount: number;
  projectTaskCount: number;
  activeTasks: number;
  overdueTasks: number;
  completionRate: number;
  updatedAt: string;
  targetRoute: string;
}

export interface MemberInsightDetail {
  member: DetailedMember;
  stats: {
    projects: number;
    assignedTasks: number;
    createdTasks: number;
    activeTasks: number;
    doneTasks: number;
    overdueTasks: number;
    dueSoonTasks: number;
    completedThisWeek: number;
    completionRate: number;
    capacityScore: number;
    lastActiveAt?: string | null;
  };
  tasks: {
    active: MemberInsightTask[];
    overdue: MemberInsightTask[];
    dueSoon: MemberInsightTask[];
    recent: MemberInsightTask[];
  };
  projects: MemberInsightProject[];
  recommendations: {
    id: string;
    severity: RecommendationSeverity;
    title: string;
    description: string;
    targetRoute: string;
  }[];
}

export interface OpsKpi {
  key: string;
  label: string;
  value: string | number;
  helper: string;
  icon: Component;
  tone: string;
}
