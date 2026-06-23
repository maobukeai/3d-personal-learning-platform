import type { Asset } from '@/types';

export type ShowcaseType = 'IMAGE' | 'VIDEO' | 'MODEL' | 'TEXT' | 'OTHER';
export type ShowcaseSortKey =
  | 'popular'
  | 'newest'
  | 'trending'
  | 'viewed'
  | 'discussed'
  | 'featured';
export type ShowcaseScope = 'all' | 'my' | 'liked';
export type ShowcaseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ShowcaseBucket =
  | 'all'
  | 'fresh'
  | 'downloadable'
  | 'discussed'
  | 'pending'
  | 'rejected';

export interface ShowcaseUser {
  id: string;
  name?: string | null;
  avatar?: string;
  avatarUrl?: string | null;
  role?: string;
  email?: string;
  bio?: string | null;
}

export interface ShowcaseItem {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  images?: string | null;
  type: ShowcaseType;
  views: number;
  likesCount: number;
  commentsCount: number;
  user: ShowcaseUser;
  createdAt: string;
  isLiked?: boolean;
  isVideo?: boolean;
  videoUrl?: string | null;
  tags?: string | null;
  asset?: Asset | null;
  assetId?: string | null;
  status?: ShowcaseStatus;
}

export interface ShowcaseActivity {
  id: string;
  content: string;
  createdAt: string;
  user: ShowcaseUser;
  showcase: Pick<ShowcaseItem, 'id' | 'title' | 'type' | 'thumbnailUrl'>;
}

export interface ShowcaseStats {
  totalWorks: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  todayWorks: number;
  weekWorks: number;
  myWorks: number;
  myLikes: number;
  downloadableWorks?: number;
  discussedWorks?: number;
  myPendingWorks?: number;
  myRejectedWorks?: number;
  statusBreakdown?: Array<{ status: ShowcaseStatus; count: number }>;
  typeBreakdown: Array<{ type: ShowcaseType; count: number; views: number }>;
  topTags: Array<{ name: string; count: number }>;
  topCreators: Array<
    ShowcaseUser & {
      works: number;
      likes: number;
      comments: number;
      views: number;
      score: number;
    }
  >;
  recentActivity: ShowcaseActivity[];
}

export interface TypeBreakdownItem {
  value: ShowcaseType | 'all';
  label: string;
  icon: unknown;
  count: number;
  percent: number;
}
