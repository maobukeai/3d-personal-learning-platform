import type { Project, Task, UserType } from '@/types/task';

export type ProjectStatusFilter = 'ALL' | 'PLANNED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED';
export type FocusFilter = 'all' | 'attention' | 'dueSoon' | 'unassigned';
export type ViewMode = 'grid' | 'list';

export interface ProjectDetailPanelExpose {
  open: (projectId: string) => Promise<void> | void;
}

export interface ProjectFormPanelExpose {
  openAdd: () => void;
  openEdit: (project: Project) => void;
}

export interface TeamMemberResponse {
  user: UserType;
}

export interface OverviewCounts {
  members: number;
  admins: number;
  pendingInvitations: number;
  pendingApplications: number;
  projects: number;
  activeProjects: number;
  completedProjects: number;
  tasks: number;
  todoTasks: number;
  inProgressTasks: number;
  doneTasks: number;
  overdueTasks: number;
  dueSoonTasks: number;
  unassignedTasks: number;
  completedThisWeek: number;
  averageProjectProgress: number;
  assets: number;
  materials: number;
  showcases: number;
}

export interface OverviewProject {
  id: string;
  title: string;
  status: string;
  progress: number;
  dueDate?: string | null;
  membersCount: number;
  tasks: {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    overdue: number;
    dueSoon: number;
    unassigned: number;
    completionRate: number;
  };
}

export interface TeamOverview {
  team: {
    id: string;
    name: string;
    type: 'PERSONAL' | 'TEAM';
  };
  counts: OverviewCounts;
  projects: OverviewProject[];
  tasks: {
    dueSoon: Task[];
    overdue: Task[];
    recentlyUpdated: Task[];
  };
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
  overdueTasks: number;
  dueSoonTasks: number;
  unassignedTasks: number;
}

export interface InsightOperationalLane {
  key: 'overdue' | 'unassigned' | 'dueSoon' | 'riskProjects';
  label: string;
  count: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  targetRoute: string;
}

export interface InsightRecommendedAssignee {
  user: InsightUser;
  capacityScore: number;
  activeTasks: number;
  overdueTasks: number;
  completedThisWeek: number;
  reason: string;
}

export interface TeamCollaborationInsights {
  generatedAt?: string;
  summary: {
    healthScore: number;
    completedThisWeek: number;
    overdueTasks: number;
    dueSoonTasks: number;
    unassignedTasks: number;
    highRiskProjects: number;
    averageProjectProgress: number;
  };
  projectHealth: InsightProjectHealth[];
  memberCapacity?: unknown[];
  recommendedAssignee?: InsightRecommendedAssignee | null;
  operationalLanes?: InsightOperationalLane[];
  activity: InsightActivityItem[];
  actionItems: InsightActionItem[];
}

export interface AdminColumn<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  formatter?: (val: any, row: T) => string;
  width?: string;
  align?: string;
  component?: any;
}

export interface AdminFilterOption {
  label: string;
  value: any;
}

export interface AdminFilterConfig {
  key: string;
  label: string;
  type: 'select' | 'text' | 'date' | string;
  defaultValue?: any;
  options?: AdminFilterOption[];
}

export interface AdminAction {
  id: string;
  label: string;
  icon?: any;
  variant?: 'primary' | 'secondary' | 'danger' | string;
  handler?: (items: any[]) => void | Promise<void>;
}

export interface AdminBulkAction<T = any> {
  id: string;
  label: string;
  icon?: any;
  variant?: 'primary' | 'secondary' | 'danger' | string;
  requireSelection?: boolean;
  confirm?: string;
  handler?: (rows: T[]) => void | Promise<void>;
}

export interface AdminCrudConfig {
  create?: {
    label: string;
    icon?: any;
  };
  edit?: {
    label: string;
    icon?: any;
  };
  delete?: {
    label: string;
    confirm?: string;
  };
}

export interface AdminFetchParams {
  page: number;
  pageSize: number;
  sort?: string;
  order?: 'asc' | 'desc';
  filters?: Record<string, any>;
  search?: string;
  signal?: AbortSignal;
}

export interface AdminTableAdapter<T = any> {
  title: string;
  rowKey?: string;
  pageSize?: number;
  defaultSort?: string;
  columns: AdminColumn<T>[];
  filters?: AdminFilterConfig[];
  actions?: AdminAction[];
  bulkActions?: AdminBulkAction<T>[];
  crud?: AdminCrudConfig;
  fetch: (params: AdminFetchParams) => Promise<{ items: T[]; total: number }>;
  create?: (data: any) => Promise<any>;
  update?: (id: any, data: any) => Promise<any>;
  delete?: (ids: (string | number)[]) => Promise<void>;
}

export interface AdminFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | string;
  required?: boolean;
  options?: { label: string; value: any }[];
  defaultValue?: any;
  span?: number;
  placeholder?: string;
  help?: string;
}
