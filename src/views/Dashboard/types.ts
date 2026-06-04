export interface DashboardEnrollment {
  courseId: string;
  progress: number;
  course: {
    title: string;
    thumbnail?: string | null;
    _count: {
      lessons: number;
    };
  };
}

export interface DashboardActivity {
  id: string;
  action: string;
  target: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
}

export interface DashboardAsset {
  id: string;
  title: string;
  type?: string;
  thumbnail?: string | null;
}

export interface DashboardTask {
  id: string;
  title: string;
  status: string;
  dueDate?: string | null;
}

