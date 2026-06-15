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
  createdAt?: string | null;
}

export interface DashboardTask {
  id: string;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string | null;
  project?: {
    id: string;
    title: string;
    color?: string | null;
  } | null;
}

export interface DashboardProjectSummaryItem {
  id: string;
  title: string;
  progress: number;
  status: string;
  dueDate?: string | null;
  updatedAt?: string;
}

export interface DashboardInsight {
  id: string;
  tone: 'danger' | 'warning' | 'success' | 'info';
  title: string;
  detail: string;
  route: string;
  action: string;
}

export interface DashboardStatsResponse {
  assetCount: number;
  taskCount: number;
  feedbackCount: number;
  learningProgress: string;
  points: number;
  focusScore?: number;
  taskSummary?: {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    overdue: number;
    dueToday: number;
    dueSelectedDay: number;
    completedToday: number;
    completionRate: number;
  };
  assetSummary?: {
    total: number;
    pending: number;
    approved: number;
    views: number;
    likes: number;
    downloads: number;
    engagement: number;
  };
  projectSummary?: {
    active: number;
    stalled: number;
    recent: DashboardProjectSummaryItem[];
  };
  learningSummary?: {
    enrollments: number;
    activeEnrollments: number;
    completedLessonsThisWeek: number;
    progress: number;
  };
  communitySummary?: {
    rank: number;
    points: number;
    pointsThisWeek: number;
  };
  urgentTasks?: DashboardTask[];
  insights?: DashboardInsight[];
  weeklyMomentum?: {
    assets: number;
    tasks: number;
    discussions: number;
    comments: number;
    showcases: number;
    completedLessons: number;
    completedTasks: number;
    points: number;
  };
  trends?: {
    assets?: string;
    tasks?: string;
    feedbacks?: string;
    learning?: string;
    points?: string;
  };
}

export interface WorkbenchTrendPoint {
  date: string;
  learning: number;
  tasks: number;
  content: number;
  community: number;
  total: number;
}

export interface WorkbenchFocusProject {
  id: string;
  title: string;
  progress: number;
  status: string;
  color?: string | null;
  dueDate?: string | null;
  updatedAt?: string;
  memberCount: number;
  taskCount: number;
  doneTaskCount: number;
  overdueTaskCount: number;
  urgentTaskCount: number;
  dueSoon: boolean;
  roadmapStepCount: number;
  healthScore: number;
}

export interface WorkbenchRecentAsset {
  id: string;
  title: string;
  type?: string | null;
  thumbnail?: string | null;
  status: string;
  viewCount: number;
  downloads: number;
  likes: number;
  qualityScore: number;
  updatedAt?: string;
}

export interface WorkbenchFocusQueueItem {
  id: string;
  severity: 'danger' | 'warning' | 'notice' | 'info';
  title: string;
  detail: string;
  metric: number;
  route: string;
}

export interface WorkbenchSmartAction {
  id: string;
  title: string;
  description: string;
  impact: string;
  route: string;
}

export interface WorkbenchData {
  generatedAt: string;
  workspace: {
    id: string | null;
    memberCount: number;
  };
  profile: {
    id: string;
    name?: string | null;
    email: string;
    avatarUrl?: string | null;
    points: number;
    createdAt: string;
  } | null;
  command: {
    momentumScore: number;
    productivityTrend: string;
    learningProgress: number;
    taskCompletionRate: number;
    contentApprovalRate: number;
    collaborationLoad: number;
  };
  learning: {
    activeCourse: DashboardEnrollment | null;
    enrollmentCount: number;
    completedLessonCount: number;
    courseProgress: number;
    roadmapProgress: number;
    roadmapCount: number;
    roadmapStepCount: number;
    roadmapCompletedCount: number;
  };
  work: {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    overdue: number;
    dueToday: number;
    urgent: number;
    assignedToMe: number;
    completionRate: number;
    recentDone: number;
  };
  projects: {
    total: number;
    focus: WorkbenchFocusProject[];
    health: WorkbenchFocusProject[];
  };
  content: {
    total: number;
    assets: number;
    approvedAssets: number;
    pendingAssets: number;
    rejectedAssets: number;
    missingThumbAssets: number;
    materials: number;
    showcases: number;
    plugins: number;
    notes: number;
    publicNotes: number;
    typeDistribution: { type: string; count: number }[];
    recentAssets: WorkbenchRecentAsset[];
  };
  collaboration: {
    discussions: number;
    projectDiscussions: number;
    unreadNotifications: number;
    unreadMessages: number;
    activeAiBots: number;
  };
  trend: WorkbenchTrendPoint[];
  focusQueue: WorkbenchFocusQueueItem[];
  smartActions: WorkbenchSmartAction[];
  signals: {
    hasCourse: boolean;
    hasProject: boolean;
    hasContent: boolean;
    hasTeam: boolean;
    tagCoverage: number;
  };
}

export interface TeamMemberRecord {
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

export interface ProjectRecord {
  id: string;
  title: string;
  progress?: number;
  color?: string | null;
  status?: string;
  dueDate?: string | null;
  updatedAt?: string;
  members?: unknown[];
}

export interface ProjectSummary {
  id: string;
  title: string;
  progress: number;
  color: string;
  status: string;
  dueDate?: string | null;
  updatedAt?: string;
  memberCount: number;
}

export interface LeaderboardMember {
  id: string;
  name: string;
  avatarUrl?: string | null;
  score?: number;
  points?: number;
  rank: number;
}

export interface ActiveBanner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  route: string;
  tag: string | null;
  tagColor: string | null;
  buttonText: string;
  order: number;
}

export interface MetricTile {
  id: string;
  label: string;
  value: string | number;
  detail: string;
  trend?: string;
  icon: any;
  route: string;
  tone: string;
}

export interface QuickAction {
  id: string;
  label: string;
  hint: string;
  icon: any;
  route?: string;
  mode?: 'ai_assistant' | 'traditional';
  tone: string;
}

export interface FeedItem {
  id: string;
  icon: any;
  title: string;
  description: string;
  time: string;
  rawTime: Date;
  route?: string;
  imageUrl?: string | null;
  user?: {
    name: string;
    avatarUrl?: string | null;
  };
  badge?: string;
}
