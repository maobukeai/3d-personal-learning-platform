export interface UserType {
  id: string;
  name: string;
  avatarUrl?: string | null;
  role?: string;
  language?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  avatarUrl?: string | null;
  role?: string;
  user: UserType;
}

export interface Project {
  id: string;
  title: string;
  color?: string;
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
  project?: Project | null;
  team?: Team | null;
  assignee?: UserType | null;
  participants?: { userId: string }[];
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
}
