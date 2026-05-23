export interface User {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'BANNED';
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon?: string | null;
  order: number;
  _count?: {
    assets: number;
  };
}

export interface CourseCategory {
  id: string;
  name: string;
  order: number;
}

export interface Course {
  id: string;
  title: string;
  description?: string | null;
  thumbnail?: string | null;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  status: 'DRAFT' | 'PUBLISHED';
  categoryId?: string | null;
  category?: CourseCategory | null;
  lessons?: Lesson[];
  createdAt: string;
  updatedAt: string;
}

export interface Lesson {
  id: string;
  title: string;
  content?: string | null;
  videoUrl?: string | null;
  hotspots?: string | null;
  sceneConfig?: string | null;
  duration: number;
  courseId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  title: string;
  description?: string | null;
  url: string;
  thumbnail?: string | null;
  type: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectReason?: string | null;
  size?: number | null;
  vertices?: number | null;
  faces?: number | null;
  materials?: number | null;
  animations?: number | null;
  hasAnimations: boolean;
  dimensions?: string | null;
  categoryId?: string | null;
  category?: Category | null;
  userId: string;
  user?: User;
  teamId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  type: 'PERSONAL' | 'TEAM';
  visibility: 'PUBLIC' | 'PRIVATE';
  category?: string | null;
  ownerId: string;
  owner?: User;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  user?: User;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joinedAt: string;
}

export interface Project {
  id: string;
  title: string;
  description?: string | null;
  progress: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED';
  dueDate?: string | null;
  color: string;
  tags?: string | null;
  visibility: 'PUBLIC' | 'PRIVATE';
  maxMembers: number;
  teamId?: string | null;
  members?: ProjectMember[];
  tasks?: Task[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  user?: User;
  role: 'OWNER' | 'MEMBER';
  joinedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  tags?: string | null;
  dueDate?: string | null;
  userId: string;
  assigneeId?: string | null;
  assignee?: User | null;
  teamId?: string | null;
  projectId?: string | null;
  project?: Project | null;
  createdAt: string;
  updatedAt: string;
}

export interface Showcase {
  id: string;
  title: string;
  description?: string | null;
  tags?: string | null;
  type: 'IMAGE' | 'VIDEO' | 'MODEL' | 'OTHER';
  thumbnailUrl: string;
  images?: string | null;
  videoUrl?: string | null;
  isVideo: boolean;
  views: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  assetId?: string | null;
  asset?: Asset | null;
  userId: string;
  user?: User;
  teamId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Feedback {
  id: string;
  type: 'Bug' | 'Feature' | 'UI' | 'Other';
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  attachmentUrl?: string | null;
  adminReply?: string | null;
  repliedAt?: string | null;
  userId: string;
  user?: User;
  createdAt: string;
  updatedAt: string;
}
