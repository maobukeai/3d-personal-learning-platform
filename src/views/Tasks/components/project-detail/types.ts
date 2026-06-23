import type { Roadmap } from '@/types';

export interface ProjectUser {
  id: string;
  name?: string;
  email?: string;
  avatarUrl?: string | null;
}

export interface ProjectMember {
  id?: string;
  userId: string;
  role: string;
  user: ProjectUser;
}

export interface ProjectTask {
  id: string;
  title: string;
  status: string;
  priority?: string;
  assignee?: ProjectUser | null;
  participants?: {
    id: string;
    userId: string;
    user: ProjectUser;
  }[];
}

export interface ProjectInvitation {
  id: string;
  invitee: ProjectUser;
  createdAt?: string;
}

export interface ProjectDetail {
  id: string;
  teamId?: string;
  title: string;
  description?: string | null;
  visibility?: string;
  color?: string;
  dueDate?: string | null;
  progress: number;
  tasks: ProjectTask[];
  members: ProjectMember[];
  invitations?: ProjectInvitation[];
  roadmap?: Roadmap | null;
}

export interface BatchTaskPayload {
  title: string;
  priority: string;
  dueDate: string | Date | null;
  assigneeId: string | null;
}
