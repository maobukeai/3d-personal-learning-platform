export const TaskStatus = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export interface UserType {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  role?: string;
  language?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  role?: string;
  user: UserType;
}

export interface ProjectMember {
  userId: string;
  user: UserType;
  role?: string;
}

export interface TaskProject {
  id: string;
  title: string;
  color?: string;
}

export interface Project extends TaskProject {
  description?: string | null;
  progress?: number;
  status: string;
  tags?: string | null;
  dueDate?: string | null;
  visibility?: string;
  maxMembers?: number;
  members: ProjectMember[];
  roadmap?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

export interface Team {
  id: string;
  name: string;
  avatarUrl?: string;
  members: TeamMember[];
}

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
  assigneeId?: string | null;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority?: string;
  tags?: string | null;
  dueDate?: string | null;
  assigneeId?: string | null;
  projectId?: string | null;
  teamId?: string | null;
  subtasks?: string | null;
  project?: TaskProject | null;
  team?: Team | null;
  assignee?: UserType | null;
  participants?: {
    id: string;
    userId: string;
    user: UserType;
  }[];
  timeEstimate?: number | null;
  timeSpent?: number | null;
  dependencies?: {
    id: string;
    dependsOnId: string;
    dependsOn: { id: string; title: string; status: string };
  }[];
  dependents?: { id: string; task: { id: string; title: string; status: string } }[];
  createdAt?: string;
  updatedAt?: string;
  parsedTags?: string[];
  parsedSubtasks?: any[];
}

export interface ActiveColumn {
  id: string;
  title: string;
  color: string;
  headerBg: string;
}

export interface TaskProjectGroup {
  id: string | null;
  name: string;
  tasks: Task[];
}

export interface TaskUpdatePayload {
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assigneeId: string | null;
  projectId: string | null;
  teamId: string | null;
  tags: string | null;
  subtasks: string;
  participantIds: string[];
  timeEstimate?: number;
  timeSpent?: number;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  userId: string;
  user: UserType;
  action: string;
  description: string;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt: string;
}
